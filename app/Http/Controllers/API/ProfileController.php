<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\KarmaLog;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller {
    private const DASHBOARD_CACHE_KEY = 'admin_dashboard_stats_v2';
    private const ANALYTICS_CACHE_KEY_PREFIX = 'admin_analytics_v2_';

    private function clearAdminCaches(): void {
        // Current cache keys
        Cache::forget(self::DASHBOARD_CACHE_KEY);
        Cache::forget(self::ANALYTICS_CACHE_KEY_PREFIX . 'daily');
        Cache::forget(self::ANALYTICS_CACHE_KEY_PREFIX . 'weekly');
        Cache::forget(self::ANALYTICS_CACHE_KEY_PREFIX . 'monthly');

        // Legacy cache keys
        Cache::forget('admin_dashboard_stats');
        Cache::forget('admin_analytics_daily');
        Cache::forget('admin_analytics_weekly');
        Cache::forget('admin_analytics_monthly');
    }

    public function show() {
        return Auth::user();
    }

    public function update(Request $request) {
        $user = Auth::user();
        $user->update($request->only(['major', 'bio', 'location']));
        $this->clearAdminCaches();
        return $user;
    }

    public function stats() {
        $user = Auth::user();

        // Weekly activity: karma points earned per day (positive only), Mon–Sun of current week
        $weekStart = Carbon::now()->startOfWeek(Carbon::MONDAY);
        $weekEnd   = Carbon::now()->endOfWeek(Carbon::SUNDAY);

        $karmaByDay = KarmaLog::where('user_id', $user->id)
            ->where('points', '>', 0)
            ->whereBetween('created_at', [$weekStart, $weekEnd])
            ->get()
            ->groupBy(fn($log) => Carbon::parse($log->created_at)->dayOfWeekIso - 1) // 0=Mon…6=Sun
            ->map(fn($logs) => $logs->sum('points'));

        $activity = [];
        for ($i = 0; $i < 7; $i++) {
            $activity[] = $karmaByDay[$i] ?? 0;
        }

        $leaderRating = DB::table('ratings')
            ->join('study_groups', 'ratings.group_id', '=', 'study_groups.id')
            ->where('study_groups.creator_id', $user->id)
            ->selectRaw('ROUND(AVG(leader_rating)::numeric, 1) as avg_rating, COUNT(*) as total_ratings')
            ->first();

        return [
            'groups_joined'        => $user->joinedGroups()->count(),
            'study_hours'          => $user->events()->count(),
            'karma'                => $user->karma_points,
            'activity'             => $activity,
            'leader_avg_rating'    => $leaderRating->avg_rating ? (float) $leaderRating->avg_rating : null,
            'leader_total_ratings' => (int) ($leaderRating->total_ratings ?? 0),
        ];
    }

    public function showUser($id) {
        $user = \App\Models\User::findOrFail($id);
        return [
            'id'               => $user->id,
            'name'             => $user->name,
            'email'            => $user->email,
            'avatar'           => $user->avatar,
            'major'            => $user->major,
            'bio'              => $user->bio,
            'location'         => $user->location,
            'role'             => $user->role,
            'warnings'         => $user->warnings ?? 0,
            'banned'           => $user->banned ?? false,
            'created_at'       => $user->created_at,
            'privacy_stats'    => $user->privacy_stats ?? true,
            'privacy_activity' => $user->privacy_activity ?? true,
        ];
    }

    public function userStats($id) {
        $user = \App\Models\User::findOrFail($id);

        $activity = [];
        if ($user->privacy_activity ?? true) {
            $weekStart = Carbon::now()->startOfWeek(Carbon::MONDAY);
            $weekEnd   = Carbon::now()->endOfWeek(Carbon::SUNDAY);

            $karmaByDay = KarmaLog::where('user_id', $user->id)
                ->where('points', '>', 0)
                ->whereBetween('created_at', [$weekStart, $weekEnd])
                ->get()
                ->groupBy(fn($log) => Carbon::parse($log->created_at)->dayOfWeekIso - 1)
                ->map(fn($logs) => $logs->sum('points'));

            for ($i = 0; $i < 7; $i++) {
                $activity[] = $karmaByDay[$i] ?? 0;
            }
        }

        $leaderRating = DB::table('ratings')
            ->join('study_groups', 'ratings.group_id', '=', 'study_groups.id')
            ->where('study_groups.creator_id', $user->id)
            ->selectRaw('ROUND(AVG(leader_rating)::numeric, 1) as avg_rating, COUNT(*) as total_ratings')
            ->first();

        return [
            'groups_joined'        => $user->joinedGroups()->count(),
            'study_hours'          => $user->events()->count(),
            'karma'                => $user->karma_points,
            'activity'             => $activity,
            'activity_private'     => !($user->privacy_activity ?? true),
            'leader_avg_rating'    => $leaderRating->avg_rating ? (float) $leaderRating->avg_rating : null,
            'leader_total_ratings' => (int) ($leaderRating->total_ratings ?? 0),
        ];
    }

    public function updatePrivacy(Request $request) {
        $request->validate([
            'privacy_stats'    => 'required|boolean',
            'privacy_activity' => 'required|boolean',
        ]);

        $user = Auth::user();
        $user->update($request->only(['privacy_stats', 'privacy_activity']));

        return response()->json(['message' => 'Privacy settings updated.', 'user' => $user]);
    }

    public function userDetails($id) {
        $user = \App\Models\User::findOrFail($id);

        if (!($user->privacy_stats ?? true)) {
            return response()->json(['error' => 'This user has hidden their profile details.'], 403);
        }

        // Groups
        $allGroups     = $user->joinedGroups()->with('creator')->get();
        $createdGroups = $allGroups->filter(fn($g) => $g->creator_id === $user->id)->values();
        $joinedGroups  = $allGroups->filter(fn($g) => $g->creator_id !== $user->id)->values();

        // Meetings
        $now              = now();
        $events           = $user->events()->with('group')->orderBy('start_time')->get();
        $upcomingMeetings = $events->filter(fn($e) => $e->start_time >= $now)->values();
        $finishedMeetings = $events->filter(fn($e) => $e->start_time < $now)->sortByDesc('start_time')->values();

        // Warnings
        $warnings = $user->userWarnings()->orderByDesc('created_at')->get()->map(fn($w) => [
            'reason'     => $w->reason,
            'expires_at' => $w->expires_at,
            'is_active'  => $w->isActive(),
        ]);

        // Suspension
        $suspension = null;
        if ($user->isSuspended()) {
            $suspension = [
                'suspended_until' => $user->suspended_until,
                'reason'          => $user->suspension_reason,
            ];
        }

        // Karma log (most recent 50)
        $karmaLogs = KarmaLog::where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json([
            'created_groups'    => $createdGroups,
            'joined_groups'     => $joinedGroups,
            'upcoming_meetings' => $upcomingMeetings,
            'finished_meetings' => $finishedMeetings,
            'warnings'          => $warnings,
            'suspension'        => $suspension,
            'karma_logs'        => $karmaLogs,
        ]);
    }

    public function details() {
        $user = Auth::user();

        // Groups
        $allGroups = $user->joinedGroups()->with('creator')->get();
        $createdGroups = $allGroups->filter(fn($g) => $g->creator_id === $user->id)->values();
        $joinedGroups  = $allGroups->filter(fn($g) => $g->creator_id !== $user->id)->values();

        // Meetings
        $now = now();
        $events = $user->events()->with('group')->orderBy('start_time')->get();
        $upcomingMeetings  = $events->filter(fn($e) => $e->start_time >= $now)->values();
        $finishedMeetings  = $events->filter(fn($e) => $e->start_time < $now)->sortByDesc('start_time')->values();

        // Warnings
        $warnings = $user->userWarnings()->orderByDesc('created_at')->get()->map(fn($w) => [
            'reason'     => $w->reason,
            'expires_at' => $w->expires_at,
            'is_active'  => $w->isActive(),
        ]);

        // Suspension
        $suspension = null;
        if ($user->isSuspended()) {
            $suspension = [
                'suspended_until' => $user->suspended_until,
                'reason'          => $user->suspension_reason,
            ];
        }

        // Karma log (most recent 50)
        $karmaLogs = KarmaLog::where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json([
            'created_groups'   => $createdGroups,
            'joined_groups'    => $joinedGroups,
            'upcoming_meetings'=> $upcomingMeetings,
            'finished_meetings'=> $finishedMeetings,
            'warnings'         => $warnings,
            'suspension'       => $suspension,
            'karma_logs'       => $karmaLogs,
        ]);
    }

    public function deleteAccount(Request $request) {
        $request->validate([
            'password' => 'required|string',
        ]);

        $user = Auth::user();

        if (!Hash::check($request->password, $user->password)) {
            return response()->json(['error' => 'Incorrect password.'], 422);
        }

        // Revoke all Sanctum tokens
        $user->tokens()->delete();

        // Delete the user (DB cascades handle related records)
        $user->delete();

        return response()->json(['message' => 'Account deleted successfully.']);
    }

    public function changePassword(Request $request) {
        $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        $user = Auth::user();

        // Verify current password
        if (!Hash::check($request->current_password, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        // Update password
        $user->password = Hash::make($request->new_password);
        $user->save();

        return response()->json([
            'message' => 'Password changed successfully.'
        ]);
    }
}
