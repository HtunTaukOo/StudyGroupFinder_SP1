<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class StudyGroup extends Model
{
    protected $fillable = [
        'name', 'subject', 'faculty', 'description', 'max_members',
        'location', 'creator_id', 'status', 'approval_status', 'approved_by',
        'approved_at', 'rejected_reason'
    ];

    protected $casts = [
        'approved_at' => 'datetime',
    ];

    protected $appends = ['members_count', 'creator_name', 'creator_avatar', 'is_member', 'has_pending_request', 'pending_requests_count', 'avg_group_rating', 'avg_leader_rating', 'total_ratings'];

    public function creator() {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function members() {
        // Only approved members
        return $this->belongsToMany(User::class, 'group_user', 'group_id', 'user_id')
            ->withPivot('status', 'approved_at', 'rejected_at', 'invited_by')
            ->wherePivot('status', 'approved')
            ->withTimestamps();
    }

    public function pendingRequests() {
        // Users with pending join requests
        return $this->belongsToMany(User::class, 'group_user', 'group_id', 'user_id')
            ->withPivot('status', 'approved_at', 'rejected_at', 'invited_by')
            ->wherePivot('status', 'pending')
            ->withTimestamps();
    }

    public function invitedUsers() {
        // Users who have been invited by the leader (pending invitations)
        return $this->belongsToMany(User::class, 'group_user', 'group_id', 'user_id')
            ->withPivot('status', 'invited_by', 'created_at')
            ->wherePivot('status', 'pending')
            ->whereNotNull('invited_by')
            ->withTimestamps();
    }

    public function allMemberRelations() {
        // All relations regardless of status (for internal use)
        return $this->belongsToMany(User::class, 'group_user', 'group_id', 'user_id')
            ->withPivot('status', 'approved_at', 'rejected_at', 'invited_by')
            ->withTimestamps();
    }

    public function messages() {
        return $this->hasMany(Message::class, 'group_id');
    }

    public function events() {
        return $this->hasMany(Event::class, 'group_id');
    }

    public function ratings() {
        return $this->hasMany(Rating::class, 'group_id');
    }

    public function approver() {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function reports() {
        return $this->hasMany(Report::class, 'reported_group_id');
    }

    /**
     * Check if group is pending approval
     */
    public function isPending() {
        return $this->approval_status === 'pending';
    }

    /**
     * Check if group is approved
     */
    public function isApproved() {
        return $this->approval_status === 'approved';
    }

    /**
     * Check if group is rejected
     */
    public function isRejected() {
        return $this->approval_status === 'rejected';
    }

    public function getMembersCountAttribute() {
        return $this->members()->count();
    }

    public function getCreatorNameAttribute() {
        return $this->creator->name ?? 'Unknown';
    }

    public function getCreatorAvatarAttribute() {
        return $this->creator->avatar ?? null;
    }

    public function getIsMemberAttribute() {
        if (!Auth::check()) return false;
        // Check if approved member
        return $this->members()->where('user_id', Auth::id())->exists();
    }

    public function getHasPendingRequestAttribute() {
        if (!Auth::check()) return false;
        // Check if user has a pending request
        return $this->pendingRequests()->where('user_id', Auth::id())->exists();
    }

    public function getPendingRequestsCountAttribute() {
        return $this->pendingRequests()->count();
    }

    public function getAvgGroupRatingAttribute() {
        return round($this->ratings()->avg('group_rating') ?? 0, 1);
    }

    public function getAvgLeaderRatingAttribute() {
        return round($this->ratings()->avg('leader_rating') ?? 0, 1);
    }

    public function getTotalRatingsAttribute() {
        return $this->ratings()->count();
    }
}