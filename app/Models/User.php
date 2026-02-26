<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, Notifiable;

    const ROLE_MEMBER = 'member';
    const ROLE_LEADER = 'leader';
    const ROLE_MODERATOR = 'moderator';
    const ROLE_ADMIN = 'admin';

    protected $fillable = [
        'name', 'email', 'password', 'role', 'major', 'bio', 'location', 'karma_points',
        'suspended_until', 'suspension_reason', 'banned_reason',
        'privacy_stats', 'privacy_activity',
    ];

    protected $casts = [
        'suspended_until'  => 'datetime',
        'privacy_stats'    => 'boolean',
        'privacy_activity' => 'boolean',
    ];

    protected $hidden = [
        'password', 'remember_token',
    ];

    /**
     * Check if the user has the 'leader' role.
     * Note: Users become leaders upon creating their first group.
     */
    public function isLeader() {
        return $this->role === self::ROLE_LEADER;
    }

    public function isMember() {
        return $this->role === self::ROLE_MEMBER;
    }

    public function isModerator() {
        return $this->role === self::ROLE_MODERATOR;
    }

    public function isAdmin() {
        return $this->role === self::ROLE_ADMIN;
    }

    public function isModeratorOrAdmin() {
        return in_array($this->role, [self::ROLE_MODERATOR, self::ROLE_ADMIN]);
    }

    /**
     * Check if user is currently suspended
     */
    public function isSuspended() {
        return $this->suspended_until && $this->suspended_until->isFuture();
    }

    /**
     * Check if user can perform actions (not banned or suspended)
     */
    public function canPerformActions() {
        return !$this->banned && !$this->isSuspended();
    }

    public function createdGroups() {
        return $this->hasMany(StudyGroup::class, 'creator_id');
    }

    public function joinedGroups() {
        // Only approved memberships
        return $this->belongsToMany(StudyGroup::class, 'group_user', 'user_id', 'group_id')
            ->withPivot('status', 'approved_at', 'rejected_at', 'invited_by')
            ->wherePivot('status', 'approved')
            ->withTimestamps();
    }

    public function pendingGroupRequests() {
        // Groups where user has pending requests
        return $this->belongsToMany(StudyGroup::class, 'group_user', 'user_id', 'group_id')
            ->withPivot('status', 'approved_at', 'rejected_at', 'invited_by')
            ->wherePivot('status', 'pending')
            ->withTimestamps();
    }

    public function groupInvitations() {
        // Groups where user has been invited (pending invitations)
        return $this->belongsToMany(StudyGroup::class, 'group_user', 'user_id', 'group_id')
            ->withPivot('status', 'invited_by', 'created_at')
            ->wherePivot('status', 'pending')
            ->whereNotNull('invited_by')
            ->withTimestamps();
    }

    public function messages() {
        return $this->hasMany(Message::class);
    }

    public function feedbacks() {
        return $this->hasMany(Feedback::class);
    }

    public function events() {
        return $this->hasMany(Event::class);
    }

    public function notifications() {
        return $this->hasMany(Notification::class)->latest();
    }

    public function userWarnings() {
        return $this->hasMany(UserWarning::class);
    }

    public function activeWarnings() {
        return $this->hasMany(UserWarning::class)->active();
    }

    /**
     * Reports submitted by this user
     */
    public function submittedReports() {
        return $this->hasMany(Report::class, 'reporter_id');
    }

    /**
     * Reports filed against this user
     */
    public function receivedReports() {
        return $this->hasMany(Report::class, 'reported_user_id');
    }

    /**
     * Reports resolved by this moderator/admin
     */
    public function resolvedReports() {
        return $this->hasMany(Report::class, 'resolved_by');
    }

    /**
     * Moderation actions performed by this moderator/admin
     */
    public function moderationActions() {
        return $this->hasMany(ModerationLog::class, 'moderator_id');
    }

    /**
     * Moderation actions received by this user
     */
    public function moderationHistory() {
        return $this->hasMany(ModerationLog::class, 'target_user_id');
    }
}