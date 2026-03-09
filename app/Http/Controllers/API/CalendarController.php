<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\StudyGroup;
use App\Models\Notification;
use App\Services\KarmaService;
use App\Mail\EventCreatedMail;
use App\Mail\EventCancelledMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class CalendarController extends Controller {
    public function index() {
        $user = Auth::user();
        
        // Get personal events + events of groups the user has joined
        $joinedGroupIds = $user->joinedGroups()->pluck('study_groups.id');
        
        return Event::where('user_id', $user->id)
            ->orWhereIn('group_id', $joinedGroupIds)
            ->orderBy('start_time', 'asc')
            ->get();
    }

    public function store(Request $request) {
        $user = Auth::user();

        // Check if email is verified
        if (!$user->email_verified_at) {
            return response()->json([
                'message' => 'Please verify your email address to create events. Check your inbox for the verification link.',
                'requires_verification' => true
            ], 403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'type' => 'required|string',
            'start_time' => 'required|date',
            'location' => 'nullable|string',
            'group_id' => 'nullable|exists:study_groups,id',
            'recurrence' => 'nullable|string|in:none,daily,weekly,monthly',
            'recurrence_count' => 'nullable|integer|min:1|max:365'
        ]);

        // Authorization check: Only the Leader (creator) of a group can add sessions to it
        if ($request->filled('group_id')) {
            $group = StudyGroup::findOrFail($request->group_id);
            if ($group->creator_id !== Auth::id()) {
                return response()->json(['message' => 'Unauthorized. Only the group leader can schedule sessions for this hub.'], 403);
            }
        }

        $user = Auth::user();

        // Create the first event
        $event = $user->events()->create($validated);

        // Award karma for creating a meeting/event
        KarmaService::awardMeetingCreation($user);

        // Handle recurrence - create additional events
        $createdEvents = [$event];
        if ($request->filled('recurrence') && $request->recurrence !== 'none' && $request->filled('recurrence_count')) {
            $startTime = new \DateTime($validated['start_time']);

            for ($i = 1; $i < $request->recurrence_count; $i++) {
                // Calculate next occurrence
                switch ($request->recurrence) {
                    case 'daily':
                        $startTime->modify('+1 day');
                        break;
                    case 'weekly':
                        $startTime->modify('+1 week');
                        break;
                    case 'monthly':
                        $startTime->modify('+1 month');
                        break;
                }

                // Create recurring event
                $recurringEvent = $user->events()->create([
                    'title' => $validated['title'],
                    'type' => $validated['type'],
                    'start_time' => $startTime->format('Y-m-d H:i:s'),
                    'location' => $validated['location'] ?? null,
                    'group_id' => $validated['group_id'] ?? null,
                    'recurrence' => $validated['recurrence'],
                    'recurrence_count' => $validated['recurrence_count']
                ]);

                $createdEvents[] = $recurringEvent;
            }
        }

        // If this is a group event, notify all members (only once, not for each recurring event)
        if ($request->filled('group_id')) {
            $group = $group ?? StudyGroup::findOrFail($request->group_id);
            $members = $group->members()->where('users.id', '!=', Auth::id())->get();
            $eventTime = date('M j, Y g:i A', strtotime($event->start_time));

            // Add recurrence info to notification
            $recurrenceInfo = '';
            if ($request->recurrence !== 'none' && $request->filled('recurrence_count')) {
                $recurrenceInfo = " (Repeats {$request->recurrence} for {$request->recurrence_count} occurrences)";
            }

            foreach ($members as $member) {
                Notification::create([
                    'user_id' => $member->id,
                    'type' => 'event',
                    'data' => [
                        'group_name' => $group->name,
                        'message' => "New meeting scheduled for '{$group->name}': {$event->title} on {$eventTime}{$recurrenceInfo}"
                    ]
                ]);

                // Send email notification if member's email is verified
                if ($member->email_verified_at) {
                    try {
                        Mail::to($member->email)->queue(new EventCreatedMail(
                            $member->name,
                            $group->name,
                            $event->title,
                            $eventTime
                        ));
                    } catch (\Exception $e) {
                        Log::error('Failed to send event notification email: ' . $e->getMessage());
                    }
                }
            }
        }

        return response()->json([
            'message' => 'Event(s) created successfully',
            'events' => $createdEvents,
            'count' => count($createdEvents)
        ]);
    }

    public function destroy(Request $request, $id) {
        $event = Event::findOrFail($id);

        // Only creator can delete
        if ($event->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Get optional cancellation reason from request body
        $cancellationReason = $request->input('reason');

        // If this is a group event, notify all members before deleting
        if ($event->group_id) {
            $group = StudyGroup::find($event->group_id);
            if ($group) {
                $members = $group->members()->where('users.id', '!=', Auth::id())->get();
                $eventTime = date('M j, Y g:i A', strtotime($event->start_time));

                // Create notification message
                $notificationMessage = "Meeting cancelled for '{$group->name}': {$event->title} (scheduled for {$eventTime})";
                if ($cancellationReason) {
                    $notificationMessage .= " - Reason: {$cancellationReason}";
                }

                foreach ($members as $member) {
                    // Create in-app notification
                    Notification::create([
                        'user_id' => $member->id,
                        'type' => 'event',
                        'data' => [
                            'group_id' => $group->id,
                            'group_name' => $group->name,
                            'event_title' => $event->title,
                            'message' => $notificationMessage,
                            'cancelled' => true,
                            'reason' => $cancellationReason
                        ]
                    ]);

                    // Send email notification if member's email is verified
                    if ($member->email_verified_at) {
                        try {
                            Mail::to($member->email)->queue(new EventCancelledMail(
                                $member->name,
                                $group->name,
                                $event->title,
                                $eventTime,
                                $cancellationReason
                            ));
                        } catch (\Exception $e) {
                            Log::error('Failed to send event cancellation email: ' . $e->getMessage());
                        }
                    }
                }
            }
        }

        $event->delete();
        return response()->json(['message' => 'Event deleted']);
    }
}