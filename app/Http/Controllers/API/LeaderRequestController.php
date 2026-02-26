<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\LeaderRequest;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LeaderRequestController extends Controller
{
    /**
     * Submit a request to become a group leader
     */
    public function store(Request $request)
    {
        $user = Auth::user();

        if ($user->role !== 'member') {
            return response()->json([
                'message' => 'Only members can request to become a leader.'
            ], 403);
        }

        // Check if there's already a pending request
        $existing = LeaderRequest::where('user_id', $user->id)
            ->where('status', 'pending')
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'You already have a pending leader request.',
                'request' => $existing
            ], 422);
        }

        $request->validate([
            'reason' => 'nullable|string|max:500'
        ]);

        $leaderRequest = LeaderRequest::create([
            'user_id' => $user->id,
            'reason' => $request->reason,
            'status' => 'pending',
        ]);

        // Notify all admins
        $admins = User::where('role', 'admin')->get();
        foreach ($admins as $admin) {
            Notification::create([
                'user_id' => $admin->id,
                'type' => 'leader_request',
                'data' => [
                    'message' => "{$user->name} has requested to become a group leader",
                    'user_id' => $user->id,
                    'user_name' => $user->name,
                    'request_id' => $leaderRequest->id,
                ]
            ]);
        }

        return response()->json([
            'message' => 'Leader request submitted. You will be notified once reviewed.',
            'request' => $leaderRequest
        ], 201);
    }

    /**
     * Get the current user's most recent leader request
     */
    public function myStatus()
    {
        $user = Auth::user();

        $leaderRequest = LeaderRequest::where('user_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->first();

        return response()->json($leaderRequest);
    }
}
