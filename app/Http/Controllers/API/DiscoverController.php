<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\StudyGroup;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DiscoverController extends Controller {
    private function scopeLeaderboardRoles($query) {
        return $query->whereIn(DB::raw('LOWER(TRIM(role))'), ['member', 'leader', 'moderator']);
    }

    public function trending() {
        return StudyGroup::withCount('members')
            ->orderBy('members_count', 'desc')
            ->take(6)
            ->get();
    }

    public function subjects() {
        return StudyGroup::select('subject', 'faculty')
            ->selectRaw('count(*) as count')
            ->groupBy('subject', 'faculty')
            ->get();
    }

    public function leaders() {
        // Get all users (not just leaders) and calculate their weekly active hours
        $users = $this->scopeLeaderboardRoles(User::query())
            ->orderBy('karma_points', 'desc')
            ->select('id', 'name', 'email', 'major', 'karma_points', 'role')
            ->take(50) // Get top 50 to calculate activity
            ->get();

        // Calculate average weekly active hours for each user
        $users = $users->map(function ($user) {
            // Count activities in the last 4 weeks
            $fourWeeksAgo = now()->subWeeks(4);

            // Count messages
            $messageCount = DB::table('messages')
                ->where('user_id', $user->id)
                ->where('created_at', '>=', $fourWeeksAgo)
                ->count();

            // Count events created
            $eventCount = DB::table('events')
                ->where('user_id', $user->id)
                ->where('created_at', '>=', $fourWeeksAgo)
                ->count();

            // Count groups created
            $groupCount = DB::table('study_groups')
                ->where('creator_id', $user->id)
                ->where('created_at', '>=', $fourWeeksAgo)
                ->count();

            // Estimate hours: Each message = 2 min, event = 15 min, group = 30 min
            $totalMinutes = ($messageCount * 2) + ($eventCount * 15) + ($groupCount * 30);
            $totalHours = $totalMinutes / 60;

            // Calculate weekly average (over 4 weeks)
            $weeklyActiveHours = round($totalHours / 4, 1);

            $user->weekly_active_hours = $weeklyActiveHours;
            return $user;
        });

        // Sort by weekly active hours descending
        $users = $users->sortByDesc('weekly_active_hours')->values()->take(10);

        return $users;
    }

    public function searchUsers(Request $request) {
        $query = $request->query('q');

        if (!$query) {
            return $this->leaders();
        }

        $lower = strtolower($query);

        return $this->scopeLeaderboardRoles(User::query())
            ->where(function ($q) use ($lower) {
                $q->whereRaw('LOWER(name) LIKE ?', ["%{$lower}%"])
                    ->orWhereRaw('LOWER(major) LIKE ?', ["%{$lower}%"]);
            })
            ->orderBy('karma_points', 'desc')
            ->select('id', 'name', 'email', 'major', 'karma_points', 'role')
            ->take(20)
            ->get();
    }
}
