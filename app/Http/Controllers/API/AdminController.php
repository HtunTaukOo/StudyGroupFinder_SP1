<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\StudyGroup;
use App\Models\Message;
use App\Models\Feedback;
use App\Models\Notification;
use App\Models\Event;
use App\Models\Rating;
use App\Models\Report;
use App\Models\UserWarning;
use App\Models\KarmaLog;
use App\Models\ModerationLog;
use App\Models\LeaderRequest;
use App\Services\KarmaService;
use App\Mail\UserWarnedMail;
use App\Mail\UserBannedMail;
use App\Mail\UserSuspendedMail;
use App\Mail\UserUnbannedMail;
use App\Mail\UserUnsuspendedMail;
use App\Mail\PasswordResetByAdminMail;
use App\Mail\RoleChangedMail;
use App\Mail\GroupApprovedMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Auth;

class AdminController extends Controller
{
    private const DASHBOARD_CACHE_KEY = 'admin_dashboard_stats_v2';
    private const ANALYTICS_CACHE_KEY_PREFIX = 'admin_analytics_v2_';

    /**
     * Scope query to non-admin roles used in student-facing major stats.
     */
    private function scopeMemberLeaderRoles($query)
    {
        return $query->whereIn(DB::raw('LOWER(TRIM(role))'), ['member', 'leader', 'moderator']);
    }

    /**
     * Scope query to users with a non-empty major after trimming spaces.
     */
    private function scopeNonEmptyMajor($query)
    {
        return $query->whereNotNull('major')
            ->whereRaw("TRIM(major) <> ''");
    }

    /**
     * Clear admin dashboard and analytics caches
     */
    private function clearAdminCaches()
    {
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

    /**
     * Get dashboard statistics
     */
    public function dashboard()
    {
        // Cache dashboard stats for 2 minutes (120 seconds)
        $stats = Cache::remember(self::DASHBOARD_CACHE_KEY, 120, function () {
            // Calculate average rating
            $avgGroupRating = Rating::avg('group_rating');
            $avgLeaderRating = Rating::avg('leader_rating');
            $avgRating = $avgGroupRating && $avgLeaderRating
                ? ($avgGroupRating + $avgLeaderRating) / 2
                : 0;

            // New metrics
            $newGroupsToday = StudyGroup::whereDate('created_at', today())->count();
            $reportsCount = Report::where('status', 'pending')->count();
            $bannedCount = User::where('banned', true)->count();
            $suspendedCount = User::whereNotNull('suspended_until')->where('suspended_until', '>', now())->count();
            $violationsCount = $bannedCount + $suspendedCount;

            $reportsByPriority = Report::where('status', 'pending')
                ->select('priority', DB::raw('count(*) as count'))
                ->groupBy('priority')
                ->pluck('count', 'priority');

            // Meetings this week (events)
            $meetingsThisWeek = Event::whereBetween('start_time', [
                now()->startOfWeek(),
                now()->endOfWeek()
            ])->count();

            // Group with most meetings this week
            $groupWithMostMeetings = StudyGroup::withCount(['events' => function($query) {
                $query->whereBetween('start_time', [now()->startOfWeek(), now()->endOfWeek()]);
            }])
                ->with('creator')
                ->orderBy('events_count', 'desc')
                ->first();

            // Only return if it has meetings this week
            if ($groupWithMostMeetings && $groupWithMostMeetings->events_count === 0) {
                $groupWithMostMeetings = null;
            }

            // Most reported users
            $mostReportedUsers = Report::select('reported_user_id', DB::raw('count(*) as report_count'))
                ->with('reportedUser:id,name,email')
                ->groupBy('reported_user_id')
                ->orderBy('report_count', 'desc')
                ->take(10)
                ->get()
                ->map(function($report) {
                    return [
                        'user_id' => $report->reported_user_id,
                        'name' => $report->reportedUser->name ?? 'Unknown',
                        'email' => $report->reportedUser->email ?? 'Unknown',
                        'report_count' => $report->report_count
                    ];
                });

            // Recent activity feed (mixed activities)
            $recentActivityFeed = collect();

            // Recent user registrations
            $recentUsers = User::orderBy('created_at', 'desc')->take(5)->get()->map(function($user) {
                return [
                    'type' => 'user_joined',
                    'description' => $user->name . ' joined the platform',
                    'timestamp' => $user->created_at,
                    'user_name' => $user->name
                ];
            });

            // Recent group creations
            $recentGroups = StudyGroup::orderBy('created_at', 'desc')->take(5)->get()->map(function($group) {
                return [
                    'type' => 'group_created',
                    'description' => 'New group: ' . $group->name,
                    'timestamp' => $group->created_at,
                    'group_name' => $group->name
                ];
            });

            // Recent reports
            $recentReports = Report::orderBy('created_at', 'desc')->take(5)->get()->map(function($report) {
                return [
                    'type' => 'report_submitted',
                    'description' => 'New report submitted',
                    'timestamp' => $report->created_at,
                    'report_id' => $report->id
                ];
            });

            $recentActivityFeed = $recentUsers->concat($recentGroups)
                ->concat($recentReports)
                ->sortByDesc('timestamp')
                ->take(20)
                ->values();

            // Karma stats
            $totalKarma = User::sum('karma_points');
            $avgKarma = User::avg('karma_points');
            $topKarmaUser = User::orderBy('karma_points', 'desc')->first();

            // Highest rated group (by avg group_rating)
            $highestRatedGroup = DB::table('ratings')
                ->join('study_groups', 'ratings.group_id', '=', 'study_groups.id')
                ->select('study_groups.id', 'study_groups.name', DB::raw('ROUND(AVG(ratings.group_rating)::numeric, 1) as avg_group_rating'), DB::raw('COUNT(*) as rating_count'))
                ->groupBy('study_groups.id', 'study_groups.name')
                ->orderByDesc('avg_group_rating')
                ->first();

            // Highest rated leader (by avg leader_rating across all groups they lead)
            $highestRatedLeader = DB::table('ratings')
                ->join('study_groups', 'ratings.group_id', '=', 'study_groups.id')
                ->join('users', 'study_groups.creator_id', '=', 'users.id')
                ->select('users.id', 'users.name', DB::raw('ROUND(AVG(ratings.leader_rating)::numeric, 1) as avg_leader_rating'), DB::raw('COUNT(*) as rating_count'))
                ->groupBy('users.id', 'users.name')
                ->orderByDesc('avg_leader_rating')
                ->first();

            return [
                'total_users' => User::count(),
                'total_groups' => StudyGroup::count(),
                'total_messages' => Message::count(),
                'total_feedback' => Feedback::count(),
                'total_ratings' => Rating::count(),
                'total_events' => Event::count(),
                'active_groups' => StudyGroup::where('status', 'open')->count(),
                'leaders_count' => User::where('role', 'leader')->count(),
                'members_count' => User::where('role', 'member')->count(),
                'admin_count' => User::where('role', 'admin')->count(),
                'moderator_count' => User::where('role', 'moderator')->count(),
                'avg_rating' => round($avgRating, 1),
                'upcoming_events' => Event::where('start_time', '>', now())->count(),

                // New metrics
                'new_groups_today' => $newGroupsToday,
                'reports_count' => $reportsCount,
                'reports_by_priority' => [
                    'low'    => (int) ($reportsByPriority['low']    ?? 0),
                    'medium' => (int) ($reportsByPriority['medium'] ?? 0),
                    'high'   => (int) ($reportsByPriority['high']   ?? 0),
                    'urgent' => (int) ($reportsByPriority['urgent'] ?? 0),
                ],
                'violations_count' => $violationsCount,
                'banned_count' => $bannedCount,
                'suspended_count' => $suspendedCount,
                'meetings_this_week' => $meetingsThisWeek,
                'total_karma' => (int) $totalKarma,
                'avg_karma' => round($avgKarma ?? 0, 1),
                'top_karma_user' => $topKarmaUser ? ['name' => $topKarmaUser->name, 'karma_points' => $topKarmaUser->karma_points] : null,
                'highest_rated_group' => $highestRatedGroup ? ['id' => $highestRatedGroup->id, 'name' => $highestRatedGroup->name, 'avg_rating' => (float) $highestRatedGroup->avg_group_rating, 'rating_count' => $highestRatedGroup->rating_count] : null,
                'highest_rated_leader' => $highestRatedLeader ? ['id' => $highestRatedLeader->id, 'name' => $highestRatedLeader->name, 'avg_rating' => (float) $highestRatedLeader->avg_leader_rating, 'rating_count' => $highestRatedLeader->rating_count] : null,
                'group_with_most_meetings' => $groupWithMostMeetings,
                'most_reported_users' => $mostReportedUsers,
                'recent_activity_feed' => $recentActivityFeed,

                // Recent activity
                'recent_users' => User::orderBy('created_at', 'desc')->take(5)->get(),
                'recent_groups' => StudyGroup::with('creator')->orderBy('created_at', 'desc')->take(5)->get(),
                'recent_feedback' => Feedback::orderBy('created_at', 'desc')->take(5)->get(),
                'recent_ratings' => Rating::with(['user', 'group'])
                    ->orderBy('created_at', 'desc')
                    ->take(5)
                    ->get()
                    ->map(function ($rating) {
                        $avgRating = ($rating->group_rating + $rating->leader_rating) / 2;
                        return [
                            'id' => $rating->id,
                            'group_rating' => $rating->group_rating,
                            'leader_rating' => $rating->leader_rating,
                            'average_rating' => round($avgRating, 1),
                            'user_name' => $rating->user->name,
                            'group_name' => $rating->group->name,
                            'created_at' => $rating->created_at,
                        ];
                    }),
                'recent_events' => Event::with(['user', 'group'])
                    ->orderBy('start_time', 'desc')
                    ->take(5)
                    ->get(),

                // Charts data
                'groups_by_status' => StudyGroup::select('status', DB::raw('count(*) as count'))
                    ->groupBy('status')
                    ->get(),
                'groups_by_faculty' => StudyGroup::select('faculty', DB::raw('count(*) as count'))
                    ->groupBy('faculty')
                    ->orderBy('count', 'desc')
                    ->take(10)
                    ->get(),
                'users_by_role' => User::select('role', DB::raw('count(*) as count'))
                    ->groupBy('role')
                    ->get(),
                'users_by_major' => $this->scopeNonEmptyMajor(
                    $this->scopeMemberLeaderRoles(
                        User::selectRaw('UPPER(TRIM(major)) as major, count(*) as count')
                    )
                )
                    ->groupBy(DB::raw('UPPER(TRIM(major))'))
                    ->orderBy('count', 'desc')
                    ->take(10)
                    ->get(),
                'distinct_majors_count' => (int) $this->scopeNonEmptyMajor(
                    $this->scopeMemberLeaderRoles(User::query())
                )
                    ->selectRaw('COUNT(DISTINCT UPPER(TRIM(major))) as count')
                    ->value('count'),
            ];
        });

        return response()->json($stats);
    }

    /**
     * Get all users with pagination
     */
    public function getUsers(Request $request)
    {
        $perPage = $request->get('per_page', 20);
        $search = $request->get('search', '');
        $role = $request->get('role', '');
        $status = $request->get('status', '');

        $users = User::when($search, function ($query, $search) {
            return $query->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")
                ->orWhere('major', 'like', "%{$search}%");
        })
        ->when($role, function ($query, $role) {
            return $query->where('role', $role);
        })
        ->when($status, function ($query, $status) {
            if ($status === 'warned') {
                return $query->where('warnings', '>', 0);
            } elseif ($status === 'suspended') {
                return $query->whereNotNull('suspended_until')
                    ->where('suspended_until', '>', now());
            } elseif ($status === 'banned') {
                return $query->where('banned', true);
            }
            return $query;
        })
        ->withCount([
            'createdGroups',
            'joinedGroups as joined_groups_count' => fn($q) =>
                $q->whereColumn('study_groups.creator_id', '!=', 'group_user.user_id'),
        ])
        ->orderBy('created_at', 'desc')
        ->paginate($perPage);

        // Add warning expiration info to each user
        $users->getCollection()->transform(function ($user) {
            // Get the earliest expiring active warning
            $earliestWarning = $user->activeWarnings()
                ->orderBy('expires_at', 'asc')
                ->first();

            $user->warning_expires_at = $earliestWarning ? $earliestWarning->expires_at : null;

            return $user;
        });

        return response()->json($users);
    }

    /**
     * Update user details
     */
    public function updateUser(Request $request, $id)
    {
        if (Auth::user()->role !== 'admin') {
            return response()->json(['message' => 'Admin access required.'], 403);
        }

        $user = User::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $id,
            'role' => 'sometimes|in:member,leader',
            'major' => 'sometimes|string|max:255',
            'bio' => 'sometimes|string',
            'location' => 'sometimes|string|max:255',
        ]);

        $user->update($validated);
        $this->clearAdminCaches();

        return response()->json([
            'message' => 'User updated successfully',
            'user' => $user
        ]);
    }

    /**
     * Delete user
     */
    public function deleteUser($id)
    {
        // Only admins can delete users
        if (Auth::user()->role !== 'admin') {
            return response()->json(['message' => 'Only admins can delete users permanently'], 403);
        }

        $user = User::findOrFail($id);

        // Prevent deleting admin
        $adminEmails = ['admin@au.edu', 'studyhub.studygroupfinder@gmail.com'];
        if (in_array($user->email, $adminEmails)) {
            return response()->json(['message' => 'Cannot delete admin account'], 403);
        }

        // Delete user's groups (transfer ownership or delete)
        StudyGroup::where('creator_id', $id)->delete();

        $user->delete();

        // Clear caches
        $this->clearAdminCaches();

        return response()->json(['message' => 'User deleted successfully']);
    }

    /**
     * Get all groups with pagination
     */
    public function getGroups(Request $request)
    {
        $perPage = $request->get('per_page', 20);
        $search = $request->get('search', '');
        $status = $request->get('status', '');
        $approvalStatus = $request->get('approval_status', '');

        $groups = StudyGroup::with('creator')
            ->when($search, function ($query, $search) {
                return $query->where('name', 'like', "%{$search}%")
                    ->orWhere('subject', 'like', "%{$search}%")
                    ->orWhere('faculty', 'like', "%{$search}%");
            })
            ->when($status, function ($query, $status) {
                return $query->where('status', $status);
            })
            ->when($approvalStatus, function ($query, $approvalStatus) {
                return $query->where('approval_status', $approvalStatus);
            })
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        return response()->json($groups);
    }

    /**
     * Update group details
     */
    public function updateGroup(Request $request, $id)
    {
        if (Auth::user()->role !== 'admin') {
            return response()->json(['message' => 'Admin access required.'], 403);
        }

        $group = StudyGroup::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'subject' => 'sometimes|string|max:255',
            'faculty' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'max_members' => 'sometimes|integer|min:2',
            'location' => 'sometimes|string|max:255',
            'status' => 'sometimes|in:open,closed,archived',
        ]);

        $group->update($validated);

        return response()->json([
            'message' => 'Group updated successfully',
            'group' => $group
        ]);
    }

    /**
     * Delete group
     */
    public function deleteGroup($id)
    {
        // Only admins can delete groups permanently
        if (Auth::user()->role !== 'admin') {
            return response()->json(['message' => 'Only admins can delete groups permanently'], 403);
        }

        $group = StudyGroup::findOrFail($id);

        // Delete associated messages
        Message::where('group_id', $id)->delete();

        $group->delete();

        // Clear caches
        $this->clearAdminCaches();

        return response()->json(['message' => 'Group deleted successfully']);
    }

    /**
     * Approve a pending group
     */
    public function approveGroup($id)
    {
        if (Auth::user()->role !== 'admin') {
            return response()->json(['message' => 'Admin access required.'], 403);
        }

        $group = StudyGroup::findOrFail($id);

        if ($group->approval_status !== 'pending') {
            return response()->json(['message' => 'Group is not pending approval'], 400);
        }

        $group->update([
            'approval_status' => 'approved',
            'approved_by' => Auth::id(),
            'approved_at' => now()
        ]);

        // Log moderation action
        ModerationLog::create([
            'moderator_id' => Auth::id(),
            'target_user_id' => $group->creator_id,
            'action_type' => 'group_approved',
            'reason' => "Approved group '{$group->name}'",
            'metadata' => [
                'group_id' => $group->id,
                'group_name' => $group->name
            ]
        ]);

        // Notify the group creator
        Notification::create([
            'user_id' => $group->creator_id,
            'type' => 'group_approved',
            'data' => [
                'message' => "Your group '{$group->name}' has been approved!",
                'group_id' => $group->id,
                'group_name' => $group->name,
                'approved_by' => Auth::user()->name
            ]
        ]);

        // Send email to creator
        $creator = User::find($group->creator_id);
        if ($creator && $creator->email_verified_at) {
            Mail::to($creator->email)->send(new GroupApprovedMail($creator, $group, Auth::user()->name));
        }

        // Clear caches
        $this->clearAdminCaches();

        return response()->json([
            'message' => 'Group approved successfully',
            'group' => $group
        ]);
    }

    /**
     * Reject a pending group
     */
    public function rejectGroup(Request $request, $id)
    {
        if (Auth::user()->role !== 'admin') {
            return response()->json(['message' => 'Admin access required.'], 403);
        }

        $validated = $request->validate([
            'reason' => 'required|string'
        ]);

        $group = StudyGroup::findOrFail($id);

        if ($group->approval_status !== 'pending') {
            return response()->json(['message' => 'Group is not pending approval'], 400);
        }

        $group->update([
            'approval_status' => 'rejected',
            'rejected_reason' => $validated['reason'],
            'approved_by' => Auth::id()
        ]);

        // Log moderation action
        ModerationLog::create([
            'moderator_id' => Auth::id(),
            'target_user_id' => $group->creator_id,
            'action_type' => 'group_rejected',
            'reason' => $validated['reason'],
            'metadata' => [
                'group_id' => $group->id,
                'group_name' => $group->name
            ]
        ]);

        // Notify the group creator
        Notification::create([
            'user_id' => $group->creator_id,
            'type' => 'group_rejected',
            'data' => [
                'message' => "Your group '{$group->name}' was not approved",
                'group_id' => $group->id,
                'group_name' => $group->name,
                'reason' => $validated['reason']
            ]
        ]);

        // Clear caches
        $this->clearAdminCaches();

        return response()->json([
            'message' => 'Group rejected',
            'group' => $group
        ]);
    }

    /**
     * Get all feedback with pagination
     */
    public function getFeedback(Request $request)
    {
        $perPage = $request->get('per_page', 20);

        $feedback = Feedback::orderBy('created_at', 'desc')
            ->paginate($perPage);

        return response()->json($feedback);
    }

    /**
     * Delete feedback
     */
    public function deleteFeedback($id)
    {
        $feedback = Feedback::findOrFail($id);
        $feedback->delete();

        return response()->json(['message' => 'Feedback deleted successfully']);
    }

    /**
     * Get analytics data with time range support
     */
    public function getAnalytics(Request $request)
    {
        // Get time range parameter (default: monthly/30 days)
        $range = $request->get('range', 'monthly');

        // Cache analytics for 10 minutes (600 seconds) with range-specific key
        $cacheKey = self::ANALYTICS_CACHE_KEY_PREFIX . $range;

        $analytics = Cache::remember($cacheKey, 600, function () use ($range) {
            // Determine date range
            $daysBack = match($range) {
                'daily' => 1,
                'weekly' => 7,
                'monthly' => 30,
                default => 30
            };

            $startDate = now()->subDays($daysBack);

            // User growth
            $userGrowth = User::select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('count(*) as count')
            )
            ->where('created_at', '>=', $startDate)
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy(DB::raw('DATE(created_at)'))
            ->get();

            // Group creation
            $groupGrowth = StudyGroup::select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('count(*) as count')
            )
            ->where('created_at', '>=', $startDate)
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy(DB::raw('DATE(created_at)'))
            ->get();

            // Message activity
            $messageActivity = Message::select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('count(*) as count')
            )
            ->where('created_at', '>=', $startDate)
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy(DB::raw('DATE(created_at)'))
            ->get();

            // Rating activity
            $ratingActivity = Rating::select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('count(*) as count')
            )
            ->where('created_at', '>=', $startDate)
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy(DB::raw('DATE(created_at)'))
            ->get();

            // Event activity
            $eventActivity = Event::select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('count(*) as count')
            )
            ->where('created_at', '>=', $startDate)
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy(DB::raw('DATE(created_at)'))
            ->get();

            // Top groups by members
            $topGroups = StudyGroup::withCount('members')
                ->orderBy('members_count', 'desc')
                ->take(10)
                ->get();

            // Most reported users
            $mostReportedUsers = Report::select('reported_user_id', DB::raw('count(*) as report_count'))
                ->with('reportedUser:id,name,email')
                ->groupBy('reported_user_id')
                ->orderBy('report_count', 'desc')
                ->take(10)
                ->get()
                ->map(function($report) {
                    return [
                        'user_id' => $report->reported_user_id,
                        'name' => $report->reportedUser->name ?? 'Unknown',
                        'email' => $report->reportedUser->email ?? 'Unknown',
                        'report_count' => $report->report_count
                    ];
                });

            // --- NEW ANALYTICS METRICS ---

            // User retention rate: % of users registered BEFORE the period who were active during the period
            $periodStart = now()->subDays($daysBack);
            $totalUsersBeforePeriod = User::where('created_at', '<', $periodStart)->count();
            $activeUsersInPeriod = User::where('created_at', '<', $periodStart)
                ->where(function($query) use ($periodStart) {
                    $query->whereHas('messages', function($q) use ($periodStart) {
                        $q->where('created_at', '>=', $periodStart);
                    })
                    ->orWhereHas('joinedGroups', function($q) use ($periodStart) {
                        $q->where('group_user.created_at', '>=', $periodStart);
                    });
                })
                ->count();

            $retentionRate = $totalUsersBeforePeriod > 0
                ? round(($activeUsersInPeriod / $totalUsersBeforePeriod) * 100, 1)
                : 0;

            // Database-agnostic SQL for extracting hour and day
            $driver = DB::connection()->getDriverName();
            if ($driver === 'sqlite') {
                $hourSql = "CAST(strftime('%H', created_at) AS INTEGER)";
                $daySql = "CAST(strftime('%w', created_at) AS INTEGER)";
                $eventHourSql = "CAST(strftime('%H', start_time) AS INTEGER)";
                $eventDaySql = "CAST(strftime('%w', start_time) AS INTEGER)";
            } elseif ($driver === 'pgsql') {
                $hourSql = "EXTRACT(HOUR FROM created_at)::int";
                $daySql = "EXTRACT(DOW FROM created_at)::int";
                $eventHourSql = "EXTRACT(HOUR FROM start_time)::int";
                $eventDaySql = "EXTRACT(DOW FROM start_time)::int";
            } else {
                // MySQL / MariaDB
                $hourSql = "HOUR(created_at)";
                $daySql = "DAYOFWEEK(created_at)";
                $eventHourSql = "HOUR(start_time)";
                $eventDaySql = "DAYOFWEEK(start_time)";
            }

            // Peak activity hours (from messages)
            $peakActivityHours = Message::select(
                DB::raw("{$hourSql} as hour"),
                DB::raw('count(*) as count')
            )
            ->where('created_at', '>=', now()->subDays(30))
            ->groupBy(DB::raw($hourSql))
            ->orderBy('count', 'desc')
            ->get();

            // Peak activity days (day of week from messages)
            $peakActivityDays = Message::select(
                DB::raw("{$daySql} as day"),
                DB::raw('count(*) as count')
            )
            ->where('created_at', '>=', now()->subDays(30))
            ->groupBy(DB::raw($daySql))
            ->orderBy('count', 'desc')
            ->get()
            ->map(function($item) use ($driver) {
                $days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                // MySQL DAYOFWEEK returns 1-7 (1=Sunday); SQLite and PostgreSQL return 0-6 (0=Sunday)
                $dayIndex = $driver === 'mysql' ? $item->day - 1 : $item->day;
                $item->day_name = $days[$dayIndex] ?? 'Unknown';
                return $item;
            });

            // Most active day for events
            $mostActiveDayForEvents = Event::select(
                DB::raw("{$eventDaySql} as day"),
                DB::raw('count(*) as count')
            )
            ->where('start_time', '>=', now()->subDays(30))
            ->groupBy(DB::raw($eventDaySql))
            ->orderBy('count', 'desc')
            ->get()
            ->map(function($item) use ($driver) {
                $days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                // MySQL DAYOFWEEK returns 1-7 (1=Sunday); SQLite and PostgreSQL return 0-6 (0=Sunday)
                $dayIndex = $driver === 'mysql' ? $item->day - 1 : $item->day;
                $item->day_name = $days[$dayIndex] ?? 'Unknown';
                return $item;
            });

            // Most active time for events (hour distribution)
            $mostActiveTimeForEvents = Event::select(
                DB::raw("{$eventHourSql} as hour"),
                DB::raw('count(*) as count')
            )
            ->where('start_time', '>=', now()->subDays(30))
            ->groupBy(DB::raw($eventHourSql))
            ->orderBy(DB::raw($eventHourSql))
            ->get();

            // Average group size
            $groups = StudyGroup::withCount('members')
                ->where('status', '!=', 'archived')
                ->get();

            $avgGroupSize = $groups->count() > 0
                ? round($groups->avg('members_count'), 1)
                : 0;

            // Top subjects
            $topSubjects = StudyGroup::select('subject', DB::raw('count(*) as count'))
                ->groupBy('subject')
                ->orderBy('count', 'desc')
                ->take(10)
                ->get();

            // Report severity distribution
            $reportSeverityDistribution = Report::select('priority', DB::raw('count(*) as count'))
                ->groupBy('priority')
                ->get()
                ->sortByDesc(function($item) {
                    // Sort by severity: urgent > high > medium > low
                    $order = ['urgent' => 4, 'high' => 3, 'medium' => 2, 'low' => 1];
                    return $order[$item->priority] ?? 0;
                })
                ->values()
                ->map(function($item) {
                    return [
                        'priority' => $item->priority,
                        'count' => $item->count
                    ];
                });

            // Karma earned vs deducted over time
            $karmaOverTime = KarmaLog::select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('SUM(CASE WHEN points > 0 THEN points ELSE 0 END) as earned'),
                DB::raw('SUM(CASE WHEN points < 0 THEN ABS(points) ELSE 0 END) as deducted')
            )
            ->where('created_at', '>=', $startDate)
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy(DB::raw('DATE(created_at)'))
            ->get()
            ->map(fn($row) => [
                'date' => $row->date,
                'earned' => (int) $row->earned,
                'deducted' => (int) $row->deducted,
            ]);

            // Karma breakdown by reason (positive actions only, within time range)
            $karmaByReason = KarmaLog::select(
                'reason',
                DB::raw('COUNT(*) as occurrences'),
                DB::raw('SUM(points) as total_points')
            )
            ->where('created_at', '>=', $startDate)
            ->where('points', '>', 0)
            ->groupBy('reason')
            ->orderBy('total_points', 'desc')
            ->take(10)
            ->get()
            ->map(fn($row) => [
                'reason' => $row->reason,
                'occurrences' => (int) $row->occurrences,
                'total_points' => (int) $row->total_points,
            ]);

            // Top karma users (all-time)
            $topKarmaUsers = User::select('id', 'name', 'karma_points')
                ->orderBy('karma_points', 'desc')
                ->take(10)
                ->get()
                ->map(fn($u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'karma_points' => (int) $u->karma_points,
                ]);

            return [
                'user_growth' => $userGrowth,
                'group_growth' => $groupGrowth,
                'message_activity' => $messageActivity,
                'rating_activity' => $ratingActivity,
                'event_activity' => $eventActivity,
                'top_groups' => $topGroups,
                'top_subjects' => $topSubjects,
                'most_reported_users' => $mostReportedUsers,
                'report_severity_distribution' => $reportSeverityDistribution,

                // New metrics
                'user_retention_rate' => $retentionRate,
                'peak_activity_hours' => $peakActivityHours,
                'peak_activity_days' => $peakActivityDays,
                'most_active_day_for_events' => $mostActiveDayForEvents,
                'most_active_time_for_events' => $mostActiveTimeForEvents,
                'average_group_size' => $avgGroupSize,
                'time_range' => $range,

                // Karma analytics
                'karma_over_time' => $karmaOverTime,
                'karma_by_reason' => $karmaByReason,
                'top_karma_users' => $topKarmaUsers,

                // Users by major
                'users_by_major' => $this->scopeNonEmptyMajor(
                    $this->scopeMemberLeaderRoles(
                        User::selectRaw('UPPER(TRIM(major)) as major, count(*) as count')
                    )
                )
                    ->groupBy(DB::raw('UPPER(TRIM(major))'))
                    ->orderBy('count', 'desc')
                    ->take(10)
                    ->get(),
            ];
        });

        return response()->json($analytics);
    }

    /**
     * Get system overview
     */
    public function getSystemOverview()
    {
        $today = now()->startOfDay();
        $yesterday = now()->subDay()->startOfDay();

        $todayUsers = User::whereDate('created_at', $today)->count();
        $yesterdayUsers = User::whereDate('created_at', $yesterday)->count();

        $todayGroups = StudyGroup::whereDate('created_at', $today)->count();
        $yesterdayGroups = StudyGroup::whereDate('created_at', $yesterday)->count();

        $todayMessages = Message::whereDate('created_at', $today)->count();
        $yesterdayMessages = Message::whereDate('created_at', $yesterday)->count();

        return response()->json([
            'users' => [
                'total' => User::count(),
                'today' => $todayUsers,
                'change' => $yesterdayUsers > 0 ? (($todayUsers - $yesterdayUsers) / $yesterdayUsers) * 100 : 0
            ],
            'groups' => [
                'total' => StudyGroup::count(),
                'today' => $todayGroups,
                'change' => $yesterdayGroups > 0 ? (($todayGroups - $yesterdayGroups) / $yesterdayGroups) * 100 : 0
            ],
            'messages' => [
                'total' => Message::count(),
                'today' => $todayMessages,
                'change' => $yesterdayMessages > 0 ? (($todayMessages - $yesterdayMessages) / $yesterdayMessages) * 100 : 0
            ],
            'feedback' => [
                'total' => Feedback::count(),
                'average_rating' => Feedback::avg('rating') ?? 0
            ]
        ]);
    }

    /**
     * Warn a user (from report)
     */
    public function warnUser(Request $request, $userId)
    {
        if (Auth::user()->role !== 'admin') {
            return response()->json(['message' => 'Admin access required.'], 403);
        }

        try {
            $user = User::findOrFail($userId);

            // Prevent warning admin
            $adminEmails = ['admin@au.edu', 'studyhub.studygroupfinder@gmail.com'];
            if (in_array($user->email, $adminEmails)) {
                return response()->json(['message' => 'Cannot warn admin account'], 403);
            }

            $validated = $request->validate([
                'reason' => 'nullable|string|max:500',
            ]);

            // Create warning record with 7-day expiration
            UserWarning::create([
                'user_id' => $user->id,
                'warned_by' => auth()->id(),
                'reason' => $validated['reason'] ?? 'General warning from admin',
                'expires_at' => now()->addDays(7),
            ]);

            // Count active (non-expired) warnings
            $activeWarningsCount = $user->activeWarnings()->count();
            $user->warnings = $activeWarningsCount;

            // Deduct karma for receiving a warning
            KarmaService::penalizeWarning($user);

            // Auto-ban if active warnings reach 3
            $autoBanned = false;
            if ($activeWarningsCount >= 3) {
                $user->banned = true;
                $autoBanned = true;

                // Additional karma penalty for ban
                KarmaService::penalizeBan($user);
            }

            $user->save();

            // Log moderation action
            ModerationLog::create([
                'moderator_id' => Auth::id(),
                'target_user_id' => $user->id,
                'action_type' => $autoBanned ? 'ban' : 'warn',
                'reason' => $autoBanned ? 'Automatic ban after 3 warnings' : ($validated['reason'] ?? 'General warning'),
                'metadata' => [
                    'warnings_count' => $activeWarningsCount,
                    'auto_banned' => $autoBanned
                ]
            ]);

        // Send notification to warned user
        if ($autoBanned) {
            $banReason = 'Automatic ban after receiving 3 warnings';
            Notification::create([
                'user_id' => $user->id,
                'type' => 'user_banned',
                'data' => [
                    'message' => 'Your account has been banned due to multiple warnings (3/3)',
                    'reason' => $banReason,
                    'warnings' => $user->warnings
                ]
            ]);

            // Send ban email if user's email is verified
            if ($user->email_verified_at) {
                try {
                    Mail::to($user->email)->send(new UserBannedMail(
                        $user->name,
                        $banReason
                    ));
                } catch (\Exception $e) {
                    \Log::error('Failed to send ban email: ' . $e->getMessage());
                }
            }
        } else {
            // Prepare notification data
            $notificationData = [
                'message' => 'You have received a warning from the admin',
                'warnings' => $user->warnings,
                'max_warnings' => 3,
                'expires_at' => now()->addDays(7)->toDateTimeString()
            ];

            // Only include reason if admin provided one
            if (isset($validated['reason']) && !empty($validated['reason'])) {
                $notificationData['reason'] = $validated['reason'];
            }

            Notification::create([
                'user_id' => $user->id,
                'type' => 'user_warned',
                'data' => $notificationData
            ]);

            // Send warning email if user's email is verified
            if ($user->email_verified_at) {
                try {
                    $emailReason = $validated['reason'] ?? 'You have received a warning from the admin';
                    Mail::to($user->email)->send(new UserWarnedMail(
                        $user->name,
                        $emailReason,
                        $user->warnings
                    ));
                } catch (\Exception $e) {
                    \Log::error('Failed to send warning email: ' . $e->getMessage());
                }
            }
        }

            // Clear caches
            $this->clearAdminCaches();

            return response()->json([
                'message' => 'User warned successfully',
                'user' => $user,
                'auto_banned' => $autoBanned
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to warn user: ' . $e->getMessage(), [
                'user_id' => $userId,
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'Failed to warn user',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Ban a user directly
     */
    public function banUser(Request $request, $userId)
    {
        if (Auth::user()->role !== 'admin') {
            return response()->json(['message' => 'Admin access required.'], 403);
        }

        try {
            $validated = $request->validate([
                'reason' => 'nullable|string|max:1000'
            ]);

            $user = User::findOrFail($userId);

            // Prevent banning admin
            $adminEmails = ['admin@au.edu', 'studyhub.studygroupfinder@gmail.com'];
            if (in_array($user->email, $adminEmails)) {
                return response()->json(['message' => 'Cannot ban admin account'], 403);
            }

            $user->banned = true;
            if (isset($validated['reason'])) {
                $user->banned_reason = $validated['reason'];
            }
            $user->save();

            // Revoke all tokens to immediately log out the user
            $user->tokens()->delete();

            // Deduct karma for being banned
            KarmaService::penalizeBan($user);

            // Log moderation action
            ModerationLog::create([
                'moderator_id' => Auth::id(),
                'target_user_id' => $user->id,
                'action_type' => 'ban',
                'reason' => $validated['reason'] ?? 'User banned by administrator',
            ]);

            // Prepare notification data
            $notificationData = [
                'message' => 'Your account has been banned by an administrator'
            ];

            // Only include reason if admin provided one
            if (isset($validated['reason']) && !empty($validated['reason'])) {
                $notificationData['reason'] = $validated['reason'];
            }

            // Send notification to banned user
            Notification::create([
                'user_id' => $user->id,
                'type' => 'user_banned',
                'data' => $notificationData
            ]);

            // Send ban email if user's email is verified
            if ($user->email_verified_at) {
                try {
                    $emailReason = $validated['reason'] ?? 'Your account has been banned by an administrator';
                    Mail::to($user->email)->send(new UserBannedMail(
                        $user->name,
                        $emailReason
                    ));
                } catch (\Exception $e) {
                    \Log::error('Failed to send ban email: ' . $e->getMessage());
                }
            }

            // Clear caches
            $this->clearAdminCaches();

            return response()->json([
                'message' => 'User banned successfully',
                'user' => $user
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to ban user: ' . $e->getMessage(), [
                'user_id' => $userId,
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'Failed to ban user',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Unban a user
     */
    public function unbanUser($userId)
    {
        if (Auth::user()->role !== 'admin') {
            return response()->json(['message' => 'Admin access required.'], 403);
        }

        $user = User::findOrFail($userId);

        $user->banned = false;
        $user->warnings = 0; // Reset warnings when unbanning
        $user->save();

        // Log moderation action
        ModerationLog::create([
            'moderator_id' => Auth::id(),
            'target_user_id' => $user->id,
            'action_type' => 'unban',
            'reason' => 'User unbanned by administrator',
        ]);

        // Create notification
        Notification::create([
            'user_id' => $user->id,
            'type' => 'ban_lifted',
            'data' => [
                'message' => 'Your account ban has been lifted. All warnings have been cleared.',
                'lifted_by' => Auth::user()->name,
                'lifted_at' => now()->toDateTimeString()
            ]
        ]);

        // Send email if user's email is verified
        if ($user->email_verified_at) {
            try {
                Mail::to($user->email)->send(new UserUnbannedMail(
                    $user,
                    Auth::user()->name
                ));
            } catch (\Exception $e) {
                \Log::error('Failed to send unban email: ' . $e->getMessage());
            }
        }

        // Clear caches
        $this->clearAdminCaches();

        return response()->json([
            'message' => 'User unbanned successfully',
            'user' => $user
        ]);
    }

    /**
     * Unsuspend a user
     */
    public function unsuspendUser($userId)
    {
        if (Auth::user()->role !== 'admin') {
            return response()->json(['message' => 'Admin access required.'], 403);
        }

        $user = User::findOrFail($userId);

        $user->suspended_until = null;
        $user->suspension_reason = null;
        $user->save();

        // Log moderation action
        ModerationLog::create([
            'moderator_id' => Auth::id(),
            'target_user_id' => $user->id,
            'action_type' => 'unsuspend',
            'reason' => 'Suspension lifted by administrator',
        ]);

        // Create notification
        Notification::create([
            'user_id' => $user->id,
            'type' => 'suspension_lifted',
            'data' => [
                'message' => 'Your account suspension has been lifted',
                'lifted_by' => Auth::user()->name,
                'lifted_at' => now()->toDateTimeString()
            ]
        ]);

        // Send email if user's email is verified
        if ($user->email_verified_at) {
            try {
                Mail::to($user->email)->send(new UserUnsuspendedMail(
                    $user,
                    Auth::user()->name
                ));
            } catch (\Exception $e) {
                \Log::error('Failed to send unsuspend email: ' . $e->getMessage());
            }
        }

        // Clear caches
        $this->clearAdminCaches();

        return response()->json([
            'message' => 'User suspension lifted successfully',
            'user' => $user
        ]);
    }

    /**
     * Get admin notifications (report submissions)
     */
    public function getNotifications(Request $request)
    {
        // Get authenticated admin user
        $admin = $request->user();

        if (!$admin) {
            return response()->json([]);
        }

        // Get only admin-relevant notifications
        $notifications = Notification::where('user_id', $admin->id)
            ->whereIn('type', ['report_submitted', 'new_report', 'feedback_submitted', 'new_group_pending'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($notifications);
    }

    /**
     * Get unread notification count for admin
     */
    public function getUnreadCount(Request $request)
    {
        // Get authenticated admin user
        $admin = $request->user();

        if (!$admin) {
            return response()->json(['count' => 0]);
        }

        $count = Notification::where('user_id', $admin->id)
            ->whereIn('type', ['report_submitted', 'new_report', 'feedback_submitted', 'new_group_pending'])
            ->whereNull('read_at')
            ->count();

        return response()->json(['count' => $count]);
    }

    /**
     * Mark all admin notifications as read
     */
    public function markNotificationsAsRead(Request $request)
    {
        // Get authenticated admin user
        $admin = $request->user();

        if (!$admin) {
            return response()->json(['message' => 'Admin not found'], 404);
        }

        Notification::where('user_id', $admin->id)
            ->whereIn('type', ['report_submitted', 'new_report', 'feedback_submitted'])
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'All notifications marked as read']);
    }

    /**
     * Get all events with pagination
     */
    public function getEvents(Request $request)
    {
        $perPage = $request->get('per_page', 20);
        $search = $request->get('search', '');
        $type = $request->get('type', '');
        $status = $request->get('status', ''); // 'upcoming' | 'past' | ''

        $events = Event::with(['user', 'group'])
            ->when($search, function ($query, $search) {
                return $query->where('title', 'like', "%{$search}%")
                    ->orWhere('location', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($q) use ($search) {
                        $q->where('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('group', function ($q) use ($search) {
                        $q->where('name', 'like', "%{$search}%");
                    });
            })
            ->when($type, function ($query, $type) {
                return $query->where('type', $type);
            })
            ->when($status === 'upcoming', function ($query) {
                return $query->where('start_time', '>=', now());
            })
            ->when($status === 'past', function ($query) {
                return $query->where('start_time', '<', now());
            })
            ->orderBy('start_time', 'asc')
            ->paginate($perPage);

        return response()->json($events);
    }

    /**
     * Update event
     */
    public function updateEvent(Request $request, $id)
    {
        $event = Event::findOrFail($id);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'type' => 'required|in:General,Project,Group Meeting,Exam,Assignment',
            'start_time' => 'required|date',
            'location' => 'nullable|string|max:255',
            'recurrence' => 'required|in:none,daily,weekly,monthly',
            'recurrence_count' => 'nullable|integer|min:1|max:365',
        ]);

        $event->update($validated);

        return response()->json(['message' => 'Event updated successfully', 'event' => $event->load(['user', 'group'])]);
    }

    /**
     * Delete event
     */
    public function deleteEvent($id)
    {
        // Only admins can delete events permanently
        if (Auth::user()->role !== 'admin') {
            return response()->json(['message' => 'Only admins can delete events permanently'], 403);
        }

        $event = Event::findOrFail($id);
        $event->delete();

        return response()->json(['message' => 'Event deleted successfully']);
    }

    /**
     * Get all ratings with pagination
     */
    public function getRatings(Request $request)
    {
        $perPage = $request->get('per_page', 20);
        $search = $request->get('search', '');
        $minRating = $request->get('min_rating', '');
        $ratingType = $request->get('rating_type', ''); // 'group', 'leader', or empty for both

        $ratings = Rating::with(['user', 'group'])
            ->when($search, function ($query, $search) {
                return $query->whereHas('user', function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%");
                })
                ->orWhereHas('group', function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%");
                });
            })
            ->when($minRating && $ratingType === 'group', function ($query) use ($minRating) {
                return $query->where('group_rating', '>=', $minRating);
            })
            ->when($minRating && $ratingType === 'leader', function ($query) use ($minRating) {
                return $query->where('leader_rating', '>=', $minRating);
            })
            ->when($minRating && !$ratingType, function ($query) use ($minRating) {
                return $query->whereRaw('(CAST(group_rating AS REAL) + CAST(leader_rating AS REAL)) / 2.0 >= CAST(? AS REAL)', [$minRating]);
            })
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        return response()->json($ratings);
    }

    /**
     * Delete rating
     */
    public function deleteRating($id)
    {
        $rating = Rating::findOrFail($id);
        $rating->delete();

        return response()->json(['message' => 'Rating deleted successfully']);
    }

    /**
     * Get user profile with detailed information
     */
    public function getUserProfile($id)
    {
        $user = User::with([
            'createdGroups',
            'joinedGroups',
            'submittedReports',
            'receivedReports.reporter',
            'moderationHistory.moderator',
            'userWarnings.warnedBy'
        ])
        ->withCount([
            'createdGroups',
            'joinedGroups',
            'messages',
            'submittedReports',
            'receivedReports'
        ])
        ->findOrFail($id);

        // Extract relations before they get serialised inside user
        $createdGroups      = $user->createdGroups;
        $joinedGroups       = $user->joinedGroups;
        $submittedReports   = $user->submittedReports;
        $receivedReports    = $user->receivedReports;
        $moderationHistory  = $user->moderationHistory;

        return response()->json([
            'user'               => $user,
            'created_groups'     => $createdGroups,
            'joined_groups'      => $joinedGroups,
            'reports_made'       => $submittedReports,
            'reports_received'   => $receivedReports,
            'moderation_history' => $moderationHistory,
            'statistics' => [
                'groups_created'    => $user->created_groups_count,
                'groups_joined'     => $user->joined_groups_count,
                'messages_sent'     => $user->messages_count,
                'reports_submitted' => $user->submitted_reports_count,
                'reports_received'  => $user->received_reports_count,
                'warnings'          => $user->warnings ?? 0,
                'active_warnings'   => $user->activeWarnings()->count(),
                'total_warnings'    => $user->userWarnings()->count(),
                'is_banned'         => $user->banned,
                'is_suspended'      => $user->isSuspended(),
                'suspended_until'   => $user->suspended_until,
                'suspension_reason' => $user->suspension_reason,
                'banned_reason'     => $user->banned_reason,
            ],
        ]);
    }

    /**
     * Assign role to user
     */
    public function assignRole(Request $request, $id)
    {
        // Only admins can assign roles
        if (Auth::user()->role !== 'admin') {
            return response()->json(['message' => 'Only admins can assign/change roles'], 403);
        }

        $validated = $request->validate([
            'role' => 'required|in:member,leader,moderator'
        ]);

        $user = User::findOrFail($id);

        // Prevent changing the sole admin account role
        if ($user->email === 'studyhub.studygroupfinder@gmail.com') {
            return response()->json(['message' => 'Cannot change admin account role'], 403);
        }

        $oldRole = $user->role;
        $user->role = $validated['role'];
        $user->save();

        // Log moderation action
        ModerationLog::create([
            'moderator_id' => Auth::id(),
            'target_user_id' => $user->id,
            'action_type' => 'role_change',
            'reason' => "Role changed from {$oldRole} to {$validated['role']}",
            'metadata' => [
                'old_role' => $oldRole,
                'new_role' => $validated['role']
            ]
        ]);

        // Send notification
        Notification::create([
            'user_id' => $user->id,
            'type' => 'role_changed',
            'data' => [
                'message' => "Your role has been changed from {$oldRole} to {$validated['role']}",
                'old_role' => $oldRole,
                'new_role' => $validated['role']
            ]
        ]);

        // Send email notification if user's email is verified
        if ($user->email_verified_at) {
            try {
                Mail::to($user->email)->send(new RoleChangedMail(
                    $user,
                    $oldRole,
                    $validated['role'],
                    Auth::user()->name
                ));
            } catch (\Exception $e) {
                \Log::error('Failed to send role change email: ' . $e->getMessage());
            }
        }

        // Clear caches
        $this->clearAdminCaches();

        return response()->json([
            'message' => 'User role updated successfully',
            'user' => $user
        ]);
    }

    /**
     * Suspend user temporarily
     */
    public function suspendUser(Request $request, $id)
    {
        if (Auth::user()->role !== 'admin') {
            return response()->json(['message' => 'Admin access required.'], 403);
        }

        try {
            $validated = $request->validate([
                'duration_days' => 'required|integer|min:1|max:365',
                'reason' => 'nullable|string|max:1000'
            ]);

            $user = User::findOrFail($id);

            // Prevent suspending admin
            $adminEmails = ['admin@au.edu', 'studyhub.studygroupfinder@gmail.com'];
            if (in_array($user->email, $adminEmails)) {
                return response()->json(['message' => 'Cannot suspend admin account'], 403);
            }

            $user->suspended_until = now()->addDays($validated['duration_days']);
            if (isset($validated['reason'])) {
                $user->suspension_reason = $validated['reason'];
            }
            $user->save();

            // Revoke all tokens to immediately log out the user
            $user->tokens()->delete();

            // Log moderation action
            ModerationLog::create([
                'moderator_id' => Auth::id(),
                'target_user_id' => $user->id,
                'action_type' => 'suspend',
                'duration_days' => $validated['duration_days'],
                'reason' => $validated['reason'] ?? "Suspended for {$validated['duration_days']} days",
                'metadata' => [
                    'suspended_until' => $user->suspended_until->toDateTimeString()
                ]
            ]);

            // Prepare notification data
            $notificationData = [
                'message' => "Your account has been suspended for {$validated['duration_days']} days",
                'suspended_until' => $user->suspended_until->toDateTimeString(),
                'duration_days' => $validated['duration_days']
            ];

            // Only include reason if admin provided one
            if (isset($validated['reason']) && !empty($validated['reason'])) {
                $notificationData['reason'] = $validated['reason'];
            }

            // Send notification
            Notification::create([
                'user_id' => $user->id,
                'type' => 'user_suspended',
                'data' => $notificationData
            ]);

            // Send suspension email if user's email is verified
            if ($user->email_verified_at) {
                try {
                    $emailReason = $validated['reason'] ?? "Your account has been suspended for {$validated['duration_days']} days";
                    Mail::to($user->email)->send(new UserSuspendedMail(
                        $user,
                        $user->suspended_until->format('F j, Y g:i A'),
                        $emailReason,
                        Auth::user()->name
                    ));
                } catch (\Exception $e) {
                    \Log::error('Failed to send suspension email: ' . $e->getMessage());
                }
            }

            // Clear caches
            $this->clearAdminCaches();

            return response()->json([
                'message' => 'User suspended successfully',
                'user' => $user
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to suspend user: ' . $e->getMessage(), [
                'user_id' => $id,
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'Failed to suspend user',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reset user password (generates a temporary password)
     */
    public function resetPassword($id)
    {
        if (Auth::user()->role !== 'admin') {
            return response()->json(['message' => 'Admin access required.'], 403);
        }

        $user = User::findOrFail($id);

        // Generate temporary password
        $tempPassword = 'Temp' . rand(10000, 99999) . '!';
        $user->password = Hash::make($tempPassword);
        $user->save();

        // Log moderation action
        ModerationLog::create([
            'moderator_id' => Auth::id(),
            'target_user_id' => $user->id,
            'action_type' => 'password_reset',
            'reason' => 'Password reset by administrator',
        ]);

        // Send notification
        Notification::create([
            'user_id' => $user->id,
            'type' => 'password_reset',
            'data' => [
                'message' => 'Your password has been reset by an administrator',
                'temp_password' => $tempPassword,
                'note' => 'Please change your password after logging in'
            ]
        ]);

        // Send email notification if user's email is verified
        if ($user->email_verified_at) {
            try {
                Mail::to($user->email)->send(new PasswordResetByAdminMail(
                    $user,
                    $tempPassword,
                    Auth::user()->name
                ));
            } catch (\Exception $e) {
                \Log::error('Failed to send password reset email: ' . $e->getMessage());
            }
        }

        return response()->json([
            'message' => 'Password reset successfully',
            'temp_password' => $tempPassword,
            'note' => 'Temporary password has been sent to user via notification'
        ]);
    }

    /**
     * Get recent moderation activity
     */
    public function getModerationActivity(Request $request)
    {
        $perPage = $request->get('per_page', 50);

        $logs = ModerationLog::with(['moderator:id,name,email,role', 'targetUser:id,name,email'])
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        return response()->json($logs);
    }

    // ─── Leader Requests ───────────────────────────────────────────────────────

    public function getLeaderRequests(Request $request)
    {
        $status = $request->get('status', 'pending');

        $query = LeaderRequest::with(['user:id,name,email,role,karma_points,created_at', 'reviewer:id,name'])
            ->when($status !== 'all', fn($q) => $q->where('status', $status))
            ->orderBy('created_at', 'desc');

        return response()->json($query->paginate(20));
    }

    public function approveLeaderRequest($id)
    {
        if (Auth::user()->role !== 'admin') {
            return response()->json(['message' => 'Admin access required.'], 403);
        }

        $leaderRequest = LeaderRequest::with('user')->findOrFail($id);

        if ($leaderRequest->status !== 'pending') {
            return response()->json(['message' => 'This request has already been reviewed.'], 422);
        }

        $user = $leaderRequest->user;
        $user->role = 'leader';
        $user->save();

        $leaderRequest->update([
            'status' => 'approved',
            'reviewed_by' => Auth::id(),
            'reviewed_at' => now(),
        ]);

        Notification::create([
            'user_id' => $user->id,
            'type' => 'leader_request_approved',
            'data' => [
                'message' => 'Your request to become a group leader has been approved! You can now create study groups.',
            ]
        ]);

        ModerationLog::create([
            'moderator_id' => Auth::id(),
            'target_user_id' => $user->id,
            'action_type' => 'role_change',
            'reason' => "Leader request approved — {$user->name} promoted to leader",
        ]);

        $this->clearAdminCaches();

        return response()->json(['message' => 'Leader request approved.']);
    }

    public function rejectLeaderRequest(Request $request, $id)
    {
        if (Auth::user()->role !== 'admin') {
            return response()->json(['message' => 'Admin access required.'], 403);
        }

        $request->validate(['note' => 'nullable|string|max:500']);

        $leaderRequest = LeaderRequest::with('user')->findOrFail($id);

        if ($leaderRequest->status !== 'pending') {
            return response()->json(['message' => 'This request has already been reviewed.'], 422);
        }

        $leaderRequest->update([
            'status' => 'rejected',
            'admin_note' => $request->note,
            'reviewed_by' => Auth::id(),
            'reviewed_at' => now(),
        ]);

        $user = $leaderRequest->user;

        Notification::create([
            'user_id' => $user->id,
            'type' => 'leader_request_rejected',
            'data' => [
                'message' => 'Your request to become a group leader was not approved.' . ($request->note ? " Reason: {$request->note}" : ''),
            ]
        ]);

        ModerationLog::create([
            'moderator_id' => Auth::id(),
            'target_user_id' => $user->id,
            'action_type' => 'role_change',
            'reason' => "Leader request rejected for {$user->name}" . ($request->note ? ": {$request->note}" : ''),
        ]);

        return response()->json(['message' => 'Leader request rejected.']);
    }
}
