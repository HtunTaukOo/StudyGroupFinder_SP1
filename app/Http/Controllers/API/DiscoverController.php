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
        return $this->scopeLeaderboardRoles(User::query())
            ->orderBy('karma_points', 'desc')
            ->select('id', 'name', 'email', 'major', 'karma_points', 'role', 'avatar')
            ->take(10)
            ->get();
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
            ->select('id', 'name', 'email', 'major', 'karma_points', 'role', 'avatar')
            ->take(20)
            ->get();
    }
}
