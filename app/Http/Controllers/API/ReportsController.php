<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Report;
use App\Models\ModerationLog;
use App\Models\User;
use App\Models\UserWarning;
use App\Models\Notification;
use App\Services\KarmaService;
use App\Mail\UserWarnedMail;
use App\Mail\UserBannedMail;
use App\Mail\UserSuspendedMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class ReportsController extends Controller
{
    /**
     * Get all reports with filters (admin/moderator only)
     */
    public function index(Request $request)
    {
        $query = Report::with(['reporter', 'reportedUser', 'reportedGroup', 'resolver', 'moderationLogs.moderator']);

        // Filter by status
        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Filter by priority
        if ($request->has('priority') && $request->priority !== 'all') {
            $query->where('priority', $request->priority);
        }

        // Filter by date range
        if ($request->has('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        if ($request->has('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        // Sort by latest first
        $reports = $query->latest()->paginate(20);

        return response()->json($reports);
    }

    /**
     * Get single report details with moderation history
     */
    public function show($id)
    {
        $report = Report::with([
            'reporter',
            'reportedUser',
            'reportedGroup',
            'reportedMessage',
            'resolver',
            'moderationLogs.moderator'
        ])->findOrFail($id);

        return response()->json($report);
    }

    /**
     * Submit a new report (user-facing)
     */
    public function store(Request $request)
    {
        $user = Auth::user();

        // Check if email is verified
        if (!$user->email_verified_at) {
            return response()->json([
                'message' => 'Please verify your email address to submit reports. Check your inbox for the verification link.',
                'requires_verification' => true
            ], 403);
        }

        $validated = $request->validate([
            'reported_user_id' => 'required|exists:users,id',
            'reported_group_id' => 'nullable|exists:study_groups,id',
            'reported_message_id' => 'nullable|exists:messages,id',
            'reason' => 'required|in:spam,harassment,inappropriate_content,fake_profile,other',
            'description' => 'required|string|max:1000',
            'evidence_url' => 'nullable|url',
            'priority' => 'nullable|in:low,medium,high,urgent'
        ]);

        // Prevent self-reporting
        if ($validated['reported_user_id'] == Auth::id()) {
            return response()->json(['message' => 'You cannot report yourself'], 422);
        }

        $report = Report::create([
            'reporter_id' => Auth::id(),
            'reported_user_id' => $validated['reported_user_id'],
            'reported_group_id' => $validated['reported_group_id'] ?? null,
            'reported_message_id' => $validated['reported_message_id'] ?? null,
            'reason' => $validated['reason'],
            'description' => $validated['description'],
            'evidence_url' => $validated['evidence_url'] ?? null,
            'status' => 'pending',
            'priority' => $validated['priority'] ?? 'medium'
        ]);

        // Load the reported user relationship
        $report->load('reportedUser');

        // Notify all admins and moderators
        $adminEmails = ['admin@au.edu', 'studyhub.studygroupfinder@gmail.com'];
        $admins = User::whereIn('email', $adminEmails)->get();

        foreach ($admins as $admin) {
            Notification::create([
                'user_id' => $admin->id,
                'type' => 'new_report',
                'data' => [
                    'message' => 'New report submitted by ' . Auth::user()->name,
                    'report_id' => $report->id,
                    'reporter_name' => Auth::user()->name,
                    'reported_user_name' => $report->reportedUser->name,
                    'reason' => $validated['reason']
                ]
            ]);
        }

        return response()->json([
            'message' => 'Report submitted successfully',
            'report' => $report->load(['reporter', 'reportedUser'])
        ], 201);
    }

    /**
     * Update report priority
     */
    public function updatePriority(Request $request, $id)
    {
        if (Auth::user()->role !== 'admin') {
            return response()->json(['message' => 'Admin access required.'], 403);
        }

        $validated = $request->validate([
            'priority' => 'required|in:low,medium,high,urgent'
        ]);

        $report = Report::findOrFail($id);
        $report->priority = $validated['priority'];
        $report->save();

        return response()->json([
            'message' => 'Report priority updated',
            'report' => $report
        ]);
    }

    /**
     * Resolve a report with moderation action
     */
    public function resolve(Request $request, $id)
    {
        $validated = $request->validate([
            'resolution_action' => 'required|string',
            'resolution_notes' => 'nullable|string|max:1000'
        ]);

        $report = Report::with(['reportedUser', 'reporter'])->findOrFail($id);

        if ($report->status !== 'pending') {
            return response()->json(['message' => 'Report already resolved'], 422);
        }

        DB::beginTransaction();

        try {
            $targetUser = $report->reportedUser;
            $resolutionAction = $validated['resolution_action'];

            // Map frontend action values to backend actions
            $actionMap = [
                'warning' => 'warn',
                'suspension_3d' => 'suspend',
                'suspension_7d' => 'suspend',
                'suspension_30d' => 'suspend',
                'ban' => 'ban',
                'no_action' => 'dismiss',
                'dismissed' => 'dismiss'
            ];

            $action = $actionMap[$resolutionAction] ?? 'dismiss';

            // Extract suspension duration from action name
            $durationDays = null;
            if (str_contains($resolutionAction, 'suspension_')) {
                $durationDays = (int) str_replace(['suspension_', 'd'], '', $resolutionAction);
            }

            // Create moderation log
            $moderationLog = ModerationLog::create([
                'moderator_id' => Auth::id(),
                'target_user_id' => $targetUser->id,
                'report_id' => $report->id,
                'action_type' => $action === 'dismiss' ? 'dismiss_report' : $action,
                'duration_days' => $durationDays,
                'reason' => $validated['resolution_notes'] ?? '',
                'metadata' => [
                    'report_reason' => $report->reason,
                    'reporter_id' => $report->reporter_id,
                    'resolution_action' => $resolutionAction
                ]
            ]);

            // Apply action to user
            switch ($action) {
                case 'warn':
                    // Create warning record with 7-day expiration
                    UserWarning::create([
                        'user_id' => $targetUser->id,
                        'warned_by' => Auth::id(),
                        'reason' => $validated['resolution_notes'] ?? 'Warning issued via report resolution',
                        'expires_at' => now()->addDays(7),
                    ]);

                    // Count active (non-expired) warnings
                    $activeWarningsCount = $targetUser->activeWarnings()->count();
                    $targetUser->warnings = $activeWarningsCount;

                    // Deduct karma for receiving a warning
                    KarmaService::penalizeWarning($targetUser);

                    // Auto-ban if active warnings reach 3
                    if ($activeWarningsCount >= 3) {
                        $targetUser->banned = true;
                        $targetUser->banned_reason = 'Automatic ban after receiving 3 warnings';

                        // Revoke all tokens to immediately log out the user
                        $targetUser->tokens()->delete();

                        // Additional karma penalty for ban
                        KarmaService::penalizeBan($targetUser);
                    }

                    $targetUser->save();

                    Notification::create([
                        'user_id' => $targetUser->id,
                        'type' => 'warning_received',
                        'data' => [
                            'message' => 'You received a warning from moderators',
                            'reason' => $validated['resolution_notes'] ?? 'No reason provided',
                            'warnings_total' => $targetUser->warnings,
                            'expires_at' => now()->addDays(7)->toDateTimeString()
                        ]
                    ]);

                    // Send warning email if user's email is verified
                    if ($targetUser->email_verified_at) {
                        try {
                            $warningReason = $validated['resolution_notes'] ?? 'Warning issued via report resolution';
                            Mail::to($targetUser->email)->send(new UserWarnedMail(
                                $targetUser->name,
                                $warningReason,
                                $targetUser->warnings
                            ));
                        } catch (\Exception $e) {
                            \Log::error('Failed to send warning email: ' . $e->getMessage());
                        }
                    }

                    // Send ban email if auto-banned
                    if ($activeWarningsCount >= 3 && $targetUser->email_verified_at) {
                        try {
                            Mail::to($targetUser->email)->send(new UserBannedMail(
                                $targetUser->name,
                                'Automatic ban after receiving 3 warnings'
                            ));
                        } catch (\Exception $e) {
                            \Log::error('Failed to send ban email: ' . $e->getMessage());
                        }
                    }
                    break;

                case 'suspend':
                    $days = $durationDays ?? 7;
                    $targetUser->suspended_until = now()->addDays($days);
                    if (isset($validated['resolution_notes']) && !empty($validated['resolution_notes'])) {
                        $targetUser->suspension_reason = $validated['resolution_notes'];
                    }
                    $targetUser->save();

                    // Deduct karma for suspension
                    KarmaService::penalizeSuspension($targetUser, $days);

                    // Revoke all tokens to immediately log out the user
                    $targetUser->tokens()->delete();

                    // Prepare notification data
                    $notificationData = [
                        'message' => "Your account has been suspended for {$days} days",
                        'suspended_until' => $targetUser->suspended_until->toDateTimeString()
                    ];

                    // Only include reason if admin provided one
                    if (isset($validated['resolution_notes']) && !empty($validated['resolution_notes'])) {
                        $notificationData['reason'] = $validated['resolution_notes'];
                    }

                    Notification::create([
                        'user_id' => $targetUser->id,
                        'type' => 'user_suspended',
                        'data' => $notificationData
                    ]);

                    // Send suspension email if user's email is verified
                    if ($targetUser->email_verified_at) {
                        try {
                            $emailReason = $validated['resolution_notes'] ?? "Your account has been suspended for {$days} days";
                            Mail::to($targetUser->email)->send(new UserSuspendedMail(
                                $targetUser,
                                $targetUser->suspended_until->format('F j, Y g:i A'),
                                $emailReason,
                                Auth::user()->name
                            ));
                        } catch (\Exception $e) {
                            \Log::error('Failed to send suspension email: ' . $e->getMessage());
                        }
                    }
                    break;

                case 'ban':
                    $targetUser->banned = true;
                    if (isset($validated['resolution_notes']) && !empty($validated['resolution_notes'])) {
                        $targetUser->banned_reason = $validated['resolution_notes'];
                    }
                    $targetUser->save();

                    // Deduct karma for ban
                    KarmaService::penalizeBan($targetUser);

                    // Revoke all tokens to immediately log out the user
                    $targetUser->tokens()->delete();

                    // Prepare notification data
                    $notificationData = [
                        'message' => 'Your account has been permanently banned'
                    ];

                    // Only include reason if admin provided one
                    if (isset($validated['resolution_notes']) && !empty($validated['resolution_notes'])) {
                        $notificationData['reason'] = $validated['resolution_notes'];
                    }

                    Notification::create([
                        'user_id' => $targetUser->id,
                        'type' => 'user_banned',
                        'data' => $notificationData
                    ]);

                    // Send ban email if user's email is verified
                    if ($targetUser->email_verified_at) {
                        try {
                            $emailReason = $validated['resolution_notes'] ?? 'Your account has been permanently banned';
                            Mail::to($targetUser->email)->send(new UserBannedMail(
                                $targetUser->name,
                                $emailReason
                            ));
                        } catch (\Exception $e) {
                            \Log::error('Failed to send ban email: ' . $e->getMessage());
                        }
                    }
                    break;

                case 'dismiss':
                    // No action on user, just resolve report
                    break;
            }

            // Update report status
            $report->status = $action === 'dismiss' ? 'dismissed' : 'resolved';
            $report->resolved_by = Auth::id();
            $report->resolved_at = now();
            $report->resolution_notes = $validated['resolution_notes'];
            $report->save();

            // Notify reporter
            Notification::create([
                'user_id' => $report->reporter_id,
                'type' => 'report_resolved',
                'data' => [
                    'message' => 'Your report has been reviewed',
                    'report_id' => $report->id,
                    'action_taken' => $resolutionAction,
                    'resolution' => $validated['resolution_notes'] ?? 'No notes provided'
                ]
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Report resolved successfully',
                'report' => $report->fresh()->load(['resolver', 'moderationLogs']),
                'moderation_log' => $moderationLog
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Failed to resolve report: ' . $e->getMessage(), [
                'report_id' => $id,
                'trace' => $e->getTraceAsString(),
                'line' => $e->getLine(),
                'file' => $e->getFile()
            ]);

            return response()->json([
                'message' => 'Failed to resolve report',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get user's own reports
     */
    public function myReports()
    {
        $reports = Report::where('reporter_id', Auth::id())
            ->with(['reportedUser', 'resolver'])
            ->latest()
            ->paginate(10);

        return response()->json($reports);
    }

    /**
     * Get reports statistics
     */
    public function statistics()
    {
        $stats = [
            'total_reports' => Report::count(),
            'pending_reports' => Report::where('status', 'pending')->count(),
            'resolved_reports' => Report::where('status', 'resolved')->count(),
            'dismissed_reports' => Report::where('status', 'dismissed')->count(),
            'reports_by_reason' => Report::select('reason', DB::raw('count(*) as count'))
                ->groupBy('reason')
                ->get(),
            'reports_by_priority' => Report::select('priority', DB::raw('count(*) as count'))
                ->groupBy('priority')
                ->get(),
            'recent_reports' => Report::with(['reporter', 'reportedUser'])
                ->latest()
                ->take(5)
                ->get()
        ];

        return response()->json($stats);
    }
}
