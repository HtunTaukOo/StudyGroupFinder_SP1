<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Feedback;
use App\Models\Notification;
use App\Models\User;
use App\Mail\ReportSubmittedMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;

class FeedbackController extends Controller
{
    public function index() {
        // Regular users can only see their own feedback
        // Admins can see all feedback (handled in AdminFeedbackController)
        return Feedback::where('user_id', Auth::id())
            ->with('user')
            ->latest()
            ->get();
    }

    public function store(Request $request) {
        $user = Auth::user();

        // Check if email is verified
        if (!$user->email_verified_at) {
            return response()->json([
                'message' => 'Please verify your email address to submit feedback. Check your inbox for the verification link.',
                'requires_verification' => true
            ], 403);
        }

        $validated = $request->validate([
            'group_name' => 'required|string',
            'rating' => 'required|integer|min:1|max:5',
            'text' => 'required|string'
        ]);

        // Map 'text' to 'comment' for database storage
        $feedback = Feedback::create([
            'user_id' => Auth::id(),
            'group_name' => $validated['group_name'],
            'rating' => $validated['rating'],
            'comment' => $validated['text']
        ]);

        // Send notification to all admin accounts
        $adminEmails = ['admin@au.edu', 'studyhub.studygroupfinder@gmail.com'];
        $admins = User::whereIn('email', $adminEmails)->get();

        foreach ($admins as $admin) {
            Notification::create([
                'user_id' => $admin->id,
                'type' => 'feedback_submitted',
                'data' => [
                    'message' => Auth::user()->name . ' submitted feedback',
                    'user_name' => Auth::user()->name,
                    'group_name' => $validated['group_name'],
                    'rating' => $validated['rating'],
                    'feedback_id' => $feedback->id
                ]
            ]);

            // Send email if admin's email is verified
            if ($admin->email_verified_at) {
                try {
                    Mail::to($admin->email)->queue(new ReportSubmittedMail(
                        Auth::user()->name,
                        $validated['group_name'],
                        $validated['rating'],
                        $feedback->id
                    ));
                } catch (\Exception $e) {
                    // Log error but don't fail the request
                    \Log::error('Failed to send feedback notification email: ' . $e->getMessage());
                }
            }
        }

        return response()->json($feedback, 201);
    }
}