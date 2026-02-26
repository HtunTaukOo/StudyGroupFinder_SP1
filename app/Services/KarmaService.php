<?php

namespace App\Services;

use App\Models\KarmaLog;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Centralized service for managing karma points
 *
 * Karma Points System:
 *
 * EARNING KARMA (Positive Actions):
 * - Creating a group: +20 points
 * - Joining a group: +10 points
 * - Leader gains a member: +15 points (when user joins or accepts invitation)
 * - Sending a text message: +5 points
 * - Uploading a file in chat: +10 points (5 for message + 5 bonus)
 * - Creating a meeting/event: +15 points
 * - Join request approved: +5 points
 *
 * LOSING KARMA (Negative Actions):
 * - Receiving a warning: -15 points
 * - Getting suspended (3 days): -10 points
 * - Getting suspended (7 days): -20 points
 * - Getting suspended (30 days): -30 points
 * - Getting banned: -50 points
 * - Being kicked from a group: -20 points
 * - Leaving a group voluntarily: -5 points
 * - Leader loses a member (voluntary leave): -10 points
 * - Receiving a bad rating (1-2 stars average): -5 points per rating
 *
 * RATING SYSTEM KARMA:
 * - Receiving a good rating (4-5 stars average): +10 points per rating
 * - Receiving a mediocre rating (3 stars average): +0 points
 * - Receiving a bad rating (1-2 stars average): -5 points per rating
 */
class KarmaService
{
    /**
     * Award karma for creating a study group
     */
    public static function awardGroupCreation(User $user): void
    {
        self::addKarma($user, 20, 'Created a study group');
    }

    /**
     * Award karma for joining a study group
     */
    public static function awardGroupJoin(User $user): void
    {
        self::addKarma($user, 10, 'Joined a study group');
    }

    /**
     * Award karma to group leader when a member joins
     */
    public static function awardLeaderForMemberJoin(User $leader): void
    {
        self::addKarma($leader, 15, 'Member joined group');
    }

    /**
     * Award karma for sending a message
     */
    public static function awardMessage(User $user, bool $hasFile = false): void
    {
        $points = $hasFile ? 10 : 5;
        $reason = $hasFile ? 'Sent a message with file' : 'Sent a message';
        self::addKarma($user, $points, $reason);
    }

    /**
     * Award karma for creating a meeting/event
     */
    public static function awardMeetingCreation(User $user): void
    {
        self::addKarma($user, 15, 'Created a meeting/event');
    }

    /**
     * Award karma when join request is approved
     */
    public static function awardJoinApproval(User $user): void
    {
        self::addKarma($user, 5, 'Join request approved');
    }

    /**
     * Deduct karma for receiving a warning
     */
    public static function penalizeWarning(User $user): void
    {
        self::deductKarma($user, 15, 'Received a warning');
    }

    /**
     * Deduct karma for being suspended
     */
    public static function penalizeSuspension(User $user, int $days): void
    {
        // Scale penalty based on suspension duration
        $points = match(true) {
            $days <= 3 => 10,
            $days <= 7 => 20,
            $days <= 30 => 30,
            default => 40  // For very long suspensions
        };

        self::deductKarma($user, $points, "Suspended for {$days} days");
    }

    /**
     * Deduct karma for being banned
     */
    public static function penalizeBan(User $user): void
    {
        self::deductKarma($user, 50, 'Banned from platform');
    }

    /**
     * Deduct karma for being kicked from a group
     */
    public static function penalizeKick(User $user): void
    {
        self::deductKarma($user, 20, 'Kicked from a group');
    }

    /**
     * Deduct karma for voluntarily leaving a group
     */
    public static function penalizeLeave(User $user): void
    {
        self::deductKarma($user, 5, 'Left a group');
    }

    /**
     * Deduct karma from group leader when a member leaves voluntarily
     */
    public static function penalizeLeaderForMemberLeave(User $leader): void
    {
        self::deductKarma($leader, 10, 'Member left group');
    }

    /**
     * Award karma for receiving a good rating
     * @param float $averageRating Average of group_rating and leader_rating
     */
    public static function awardGoodRating(User $user, float $averageRating): void
    {
        if ($averageRating >= 4.0) {
            self::addKarma($user, 10, "Received a {$averageRating} star rating");
        }
    }

    /**
     * Deduct karma for receiving a bad rating
     * @param float $averageRating Average of group_rating and leader_rating
     */
    public static function penalizeBadRating(User $user, float $averageRating): void
    {
        if ($averageRating < 3.0) {
            self::deductKarma($user, 5, "Received a {$averageRating} star rating");
        }
    }

    /**
     * Process rating karma (award or deduct based on rating value)
     * @param User $groupLeader The leader being rated
     * @param float $averageRating Average of group_rating and leader_rating
     */
    public static function processRatingKarma(User $groupLeader, float $averageRating): void
    {
        if ($averageRating >= 4.0) {
            self::addKarma($groupLeader, 10, "Received a {$averageRating} star rating");
        } elseif ($averageRating < 3.0) {
            self::deductKarma($groupLeader, 5, "Received a {$averageRating} star rating");
        }
        // No karma change for 3.0-3.9 (mediocre ratings)
    }

    /**
     * Add karma points to a user
     */
    private static function addKarma(User $user, int $points, string $reason): void
    {
        $user->increment('karma_points', $points);
        KarmaLog::create(['user_id' => $user->id, 'points' => $points, 'reason' => $reason]);
        Log::info("Karma awarded: User {$user->id} ({$user->name}) +{$points} - {$reason}");
    }

    /**
     * Deduct karma points from a user (minimum 0)
     */
    private static function deductKarma(User $user, int $points, string $reason): void
    {
        $newKarma = max(0, $user->karma_points - $points);
        $user->update(['karma_points' => $newKarma]);
        KarmaLog::create(['user_id' => $user->id, 'points' => -$points, 'reason' => $reason]);
        Log::info("Karma deducted: User {$user->id} ({$user->name}) -{$points} - {$reason}");
    }

    /**
     * Get karma point value for a specific action (for display purposes)
     */
    public static function getActionValue(string $action): int
    {
        $values = [
            'group_creation' => 20,
            'group_join' => 10,
            'leader_member_join' => 15,
            'message' => 5,
            'file_upload' => 10,
            'meeting_creation' => 15,
            'join_approval' => 5,
            'warning' => -15,
            'suspension_3d' => -10,
            'suspension_7d' => -20,
            'suspension_30d' => -30,
            'ban' => -50,
            'kick' => -20,
            'leave' => -5,
            'leader_member_leave' => -10,
            'good_rating' => 10,
            'bad_rating' => -5,
        ];

        return $values[$action] ?? 0;
    }
}
