<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\StudyGroup;
use App\Models\Notification;
use App\Models\User;
use App\Models\Message;
use App\Services\KarmaService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use App\Mail\GroupJoinNotification;
use App\Mail\JoinRequestMail;
use App\Mail\JoinApprovedMail;
use App\Mail\JoinRejectedMail;
use App\Mail\RemovedFromGroupMail;
use App\Mail\GroupApprovedMail;
use App\Mail\OwnershipTransferredMail;
use App\Mail\GroupInvitationMail;
use App\Mail\InvitationAcceptedMail;
use App\Mail\InvitationDeclinedMail;

class StudyGroupController extends Controller
{
    public function index() {
        $query = StudyGroup::with('creator');

        // Regular users should only see approved groups
        // Admins and moderators can see all groups (they manage them in admin panel)
        $user = Auth::user();
        if (!$user || !in_array($user->role, ['admin', 'moderator'])) {
            $query->where('approval_status', 'approved');
        }

        return $query->latest()->get();
    }

    public function store(Request $request) {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        // Check if email is verified
        if (!$user->email_verified_at) {
            return response()->json([
                'message' => 'Please verify your email address to create groups. Check your inbox for the verification link.',
                'requires_verification' => true
            ], 403);
        }

        // Only leaders and admins can create groups
        if (!in_array($user->role, ['leader', 'admin'])) {
            return response()->json([
                'message' => 'Only group leaders can create study groups. Request leader role from the admin first.',
                'requires_leader_role' => true
            ], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string',
            'subject' => 'required|string',
            'faculty' => 'required|string',
            'description' => 'required|string',
            'max_members' => 'required|integer|min:2',
            'location' => 'required|string',
        ]);

        // Leaders with 50+ karma points can create groups freely.
        // Leaders below 50 karma require admin approval.
        // Admins are always auto-approved.
        $approvalStatus = ($user->karma_points >= 50 || $user->role === 'admin') ? 'approved' : 'pending';

        $group = StudyGroup::create(array_merge($validated, [
            'creator_id' => $user->id,
            'status' => 'open',
            'approval_status' => $approvalStatus
        ]));

        // Attach the creator as the first member with approved status
        $group->allMemberRelations()->attach($user->id, [
            'status' => 'approved',
            'approved_at' => now()
        ]);

        // Award karma for creating a group
        KarmaService::awardGroupCreation($user);

        // If group is pending, notify admins/moderators and send notification to user
        if ($approvalStatus === 'pending') {
            // Notify all admins and moderators
            $moderators = User::whereIn('role', ['admin', 'moderator'])->get();
            foreach ($moderators as $moderator) {
                Notification::create([
                    'user_id' => $moderator->id,
                    'type' => 'new_group_pending',
                    'data' => [
                        'message' => "New group '{$group->name}' by {$user->name} is pending approval",
                        'group_id' => $group->id,
                        'group_name' => $group->name,
                        'creator_name' => $user->name
                    ]
                ]);
            }

            return response()->json([
                'group' => $group,
                'message' => 'Group created successfully! It is pending approval by an administrator.',
                'pending_approval' => true
            ], 201);
        }

        return response()->json($group, 201);
    }

    public function update(Request $request, $id) {
        $group = StudyGroup::findOrFail($id);
        
        if ($group->creator_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized. Only the group leader can manage this hub.'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string',
            'subject' => 'sometimes|string',
            'faculty' => 'sometimes|string',
            'description' => 'sometimes|string',
            'max_members' => 'sometimes|integer|min:2',
            'location' => 'sometimes|string',
            'status' => 'sometimes|in:open,closed,archived'
        ]);

        $group->update($validated);

        return response()->json($group);
    }

    public function show($id) {
        return StudyGroup::with(['creator', 'members', 'events'])->findOrFail($id);
    }

    public function join($id) {
        $group = StudyGroup::findOrFail($id);
        $user = Auth::user();

        // Check if group is archived
        if ($group->status === 'archived') {
            return response()->json(['message' => 'This group has been archived and is no longer accepting members'], 400);
        }

        // Check if group would be full (count only approved members)
        if ($group->members_count >= $group->max_members) {
            return response()->json(['message' => 'Group is full'], 400);
        }

        // Check if user is already a member (approved)
        if ($group->members()->where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'You are already a member'], 400);
        }

        // Check if user already has a pending request
        $existingRequest = $group->allMemberRelations()
            ->where('user_id', $user->id)
            ->first();

        // Handle based on group status
        if ($group->status === 'open') {
            // OPEN GROUPS: Instant join without approval
            if ($existingRequest) {
                // Update existing record to approved
                $group->allMemberRelations()->updateExistingPivot($user->id, [
                    'status' => 'approved',
                    'approved_at' => now(),
                    'rejected_at' => null,
                    'updated_at' => now()
                ]);
            } else {
                // Create new approved membership
                $group->allMemberRelations()->attach($user->id, [
                    'status' => 'approved',
                    'approved_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }

            // Notify Leader with group_join type (informational)
            if ($group->creator_id !== $user->id) {
                Notification::create([
                    'user_id' => $group->creator_id,
                    'type' => 'group_join',
                    'data' => [
                        'user_name' => $user->name,
                        'group_id' => $group->id,
                        'group_name' => $group->name,
                        'message' => "{$user->name} has joined your study group '{$group->name}'."
                    ]
                ]);

                // Send email notification if leader's email is verified
                $leader = User::find($group->creator_id);
                if ($leader && $leader->email_verified_at) {
                    try {
                        Mail::to($leader->email)->send(new GroupJoinNotification(
                            $user->name,
                            $group->name,
                            $group->id
                        ));
                    } catch (\Exception $e) {
                        \Log::error('Failed to send group join email: ' . $e->getMessage());
                    }
                }
            }

            // Award karma for joining a group
            KarmaService::awardGroupJoin($user);

            // Post system message to group chat
            Message::create([
                'group_id' => $group->id,
                'user_id' => $user->id,
                'content' => 'joined the group',
                'type' => 'system',
            ]);

            return response()->json(['message' => 'Successfully joined the group!']);

        } else {
            // CLOSED GROUPS: Request-based approval workflow
            if ($existingRequest) {
                $status = $existingRequest->pivot->status;
                if ($status === 'pending') {
                    return response()->json(['message' => 'Your join request is pending approval'], 400);
                } elseif ($status === 'rejected') {
                    // Allow reapplying after rejection - update existing record
                    $group->allMemberRelations()->updateExistingPivot($user->id, [
                        'status' => 'pending',
                        'rejected_at' => null,
                        'updated_at' => now()
                    ]);
                }
            } else {
                // Create new pending request
                $group->allMemberRelations()->attach($user->id, [
                    'status' => 'pending',
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }

            // Notify Leader with join_request type
            if ($group->creator_id !== $user->id) {
                Notification::create([
                    'user_id' => $group->creator_id,
                    'type' => 'join_request',
                    'data' => [
                        'user_id' => $user->id,
                        'user_name' => $user->name,
                        'group_id' => $group->id,
                        'group_name' => $group->name,
                        'message' => "{$user->name} wants to join '{$group->name}'."
                    ]
                ]);

                // Send email notification if leader's email is verified
                $leader = User::find($group->creator_id);
                if ($leader && $leader->email_verified_at) {
                    try {
                        Mail::to($leader->email)->send(new JoinRequestMail($leader->name, $user->name, $group->name));
                    } catch (\Exception $e) {
                        \Log::error('Failed to send join request email: ' . $e->getMessage());
                    }
                }
            }

            return response()->json(['message' => 'Join request sent! Waiting for leader approval.']);
        }
    }

    public function leave($id) {
        $group = StudyGroup::findOrFail($id);
        $user = Auth::user();

        $group->members()->detach($user->id);

        // Deduct karma for leaving a group
        KarmaService::penalizeLeave($user);

        // Deduct karma from the group leader for losing a member
        $groupLeader = User::find($group->creator_id);
        if ($groupLeader && $groupLeader->id !== $user->id) {
            KarmaService::penalizeLeaderForMemberLeave($groupLeader);
        }

        return response()->json(['message' => 'Left successfully']);
    }

    /**
     * Get members of a group
     * Only accessible by group members
     */
    public function getMembers($id) {
        $group = StudyGroup::findOrFail($id);
        $userId = Auth::id();

        // Get all approved members with their details
        $members = $group->members()
            ->select('users.id', 'users.name', 'users.email', 'users.major', 'users.role', 'users.avatar', 'group_user.approved_at')
            ->orderByRaw('CASE WHEN users.id = ? THEN 0 ELSE 1 END', [$group->creator_id])
            ->orderBy('group_user.approved_at', 'asc')
            ->get()
            ->map(function ($member) use ($group) {
                return [
                    'id' => $member->id,
                    'name' => $member->name,
                    'email' => $member->email,
                    'major' => $member->major,
                    'role' => $member->role,
                    'avatar' => $member->avatar,
                    'is_leader' => $member->id === $group->creator_id,
                    'joined_at' => $member->approved_at,
                ];
            });

        return response()->json($members);
    }

    public function destroy($id) {
        $group = StudyGroup::findOrFail($id);

        if ($group->creator_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized. Only the group leader can dissolve this hub.'], 403);
        }

        $group->delete();
        return response()->json(['message' => 'Deleted successfully']);
    }

    /**
     * Get pending join requests for a group
     * Only accessible by group leader
     */
    public function pendingRequests($id) {
        $group = StudyGroup::findOrFail($id);
        $user = Auth::user();

        // Only leader can see pending requests
        if ($group->creator_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized. Only the group leader can view join requests.'], 403);
        }

        $requests = $group->pendingRequests()
            ->select('users.id', 'users.name', 'users.email', 'users.major', 'group_user.created_at as requested_at')
            ->get();

        return response()->json($requests);
    }

    /**
     * Approve a join request
     */
    public function approveRequest($groupId, $userId) {
        $group = StudyGroup::findOrFail($groupId);
        $currentUser = Auth::user();

        // Only leader can approve
        if ($group->creator_id !== $currentUser->id) {
            return response()->json(['message' => 'Unauthorized. Only the group leader can approve requests.'], 403);
        }

        // Check if request exists and is pending
        $request = $group->allMemberRelations()
            ->where('user_id', $userId)
            ->first();

        if (!$request || $request->pivot->status !== 'pending') {
            return response()->json(['message' => 'No pending request found for this user.'], 404);
        }

        // Check capacity before approving
        if ($group->members_count >= $group->max_members) {
            return response()->json(['message' => 'Cannot approve - group is now full.'], 400);
        }

        // Approve the request
        $group->allMemberRelations()->updateExistingPivot($userId, [
            'status' => 'approved',
            'approved_at' => now(),
            'updated_at' => now()
        ]);

        // Delete the join_request notification for the leader
        Notification::where('user_id', $currentUser->id)
            ->where('type', 'join_request')
            ->where('data->group_id', $groupId)
            ->where('data->user_id', $userId)
            ->delete();

        // Notify the requesting user that they were approved
        $requestingUser = User::find($userId);
        if ($requestingUser) {
            Notification::create([
                'user_id' => $userId,
                'type' => 'join_approved',
                'data' => [
                    'group_id' => $group->id,
                    'group_name' => $group->name,
                    'message' => "Your request to join '{$group->name}' has been approved! Welcome to the group."
                ]
            ]);

            // Send email notification if user's email is verified
            if ($requestingUser->email_verified_at) {
                try {
                    Mail::to($requestingUser->email)->send(new JoinApprovedMail($requestingUser->name, $group->name));
                } catch (\Exception $e) {
                    \Log::error('Failed to send join approved email: ' . $e->getMessage());
                }
            }

            // Award karma for successful join approval
            KarmaService::awardJoinApproval($requestingUser);

            // Award karma to the group leader for gaining a member
            $groupLeader = User::find($group->creator_id);
            if ($groupLeader) {
                KarmaService::awardLeaderForMemberJoin($groupLeader);
            }

            // Post system message to group chat
            Message::create([
                'group_id' => $group->id,
                'user_id' => $requestingUser->id,
                'content' => 'joined the group',
                'type' => 'system',
            ]);
        }

        return response()->json(['message' => 'Join request approved successfully.']);
    }

    /**
     * Reject a join request
     */
    public function rejectRequest(Request $request, $groupId, $userId) {
        $group = StudyGroup::findOrFail($groupId);
        $currentUser = Auth::user();

        // Only leader can reject
        if ($group->creator_id !== $currentUser->id) {
            return response()->json(['message' => 'Unauthorized. Only the group leader can reject requests.'], 403);
        }

        // Check if request exists and is pending
        $joinRequest = $group->allMemberRelations()
            ->where('user_id', $userId)
            ->first();

        if (!$joinRequest || $joinRequest->pivot->status !== 'pending') {
            return response()->json(['message' => 'No pending request found for this user.'], 404);
        }

        // Get optional rejection reason from request body
        $rejectionReason = $request->input('reason');

        // Reject the request
        $group->allMemberRelations()->updateExistingPivot($userId, [
            'status' => 'rejected',
            'rejected_at' => now(),
            'updated_at' => now()
        ]);

        // Delete the join_request notification for the leader
        Notification::where('user_id', $currentUser->id)
            ->where('type', 'join_request')
            ->where('data->group_id', $groupId)
            ->where('data->user_id', $userId)
            ->delete();

        // Notify the requesting user that they were rejected
        $requestingUser = User::find($userId);
        if ($requestingUser) {
            $notificationMessage = "Your request to join '{$group->name}' was not approved at this time.";
            if ($rejectionReason) {
                $notificationMessage .= " Reason: {$rejectionReason}";
            }

            Notification::create([
                'user_id' => $userId,
                'type' => 'join_rejected',
                'data' => [
                    'group_id' => $group->id,
                    'group_name' => $group->name,
                    'message' => $notificationMessage,
                    'reason' => $rejectionReason
                ]
            ]);

            // Send email notification if user's email is verified
            if ($requestingUser->email_verified_at) {
                try {
                    Mail::to($requestingUser->email)->send(new JoinRejectedMail($requestingUser->name, $group->name, $rejectionReason));
                } catch (\Exception $e) {
                    \Log::error('Failed to send join rejected email: ' . $e->getMessage());
                }
            }
        }

        return response()->json(['message' => 'Join request rejected.']);
    }

    /**
     * Kick a member from the group
     * Only accessible by group leader
     */
    public function kickMember($groupId, $userId) {
        $group = StudyGroup::findOrFail($groupId);
        $currentUser = Auth::user();

        // Only leader can kick members
        if ($group->creator_id !== $currentUser->id) {
            return response()->json(['message' => 'Unauthorized. Only the group leader can remove members.'], 403);
        }

        // Cannot kick the leader themselves
        if ($userId == $group->creator_id) {
            return response()->json(['message' => 'The group leader cannot be removed.'], 400);
        }

        // Check if user is a member
        $isMember = $group->members()->where('users.id', $userId)->exists();
        if (!$isMember) {
            return response()->json(['message' => 'This user is not a member of the group.'], 404);
        }

        // Remove the member
        $group->members()->detach($userId);

        // Notify the removed user
        $removedUser = User::find($userId);
        if ($removedUser) {
            Notification::create([
                'user_id' => $userId,
                'type' => 'removed_from_group',
                'data' => [
                    'group_id' => $group->id,
                    'group_name' => $group->name,
                    'message' => "You have been removed from '{$group->name}'."
                ]
            ]);

            // Send email notification if user's email is verified
            if ($removedUser->email_verified_at) {
                try {
                    Mail::to($removedUser->email)->send(new RemovedFromGroupMail($removedUser->name, $group->name));
                } catch (\Exception $e) {
                    \Log::error('Failed to send removed from group email: ' . $e->getMessage());
                }
            }

            // Deduct karma for being kicked from a group
            KarmaService::penalizeKick($removedUser);
        }

        return response()->json(['message' => 'Member removed successfully.']);
    }

    /**
     * Invite a user to join the group (Leader only)
     */
    public function inviteMember(Request $request, $groupId)
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id'
        ]);

        $group = StudyGroup::findOrFail($groupId);
        $currentUser = Auth::user();
        $targetUserId = $validated['user_id'];

        // Only leader can invite members
        if ($group->creator_id !== $currentUser->id) {
            return response()->json(['message' => 'Only the group leader can invite members.'], 403);
        }

        // Check if group is archived
        if ($group->status === 'archived') {
            return response()->json(['message' => 'Cannot invite members to an archived group.'], 400);
        }

        // Check if group is full
        $currentMembersCount = $group->members()->count();
        if ($currentMembersCount >= $group->max_members) {
            return response()->json(['message' => 'Group is full. Cannot send invitation.'], 400);
        }

        // Cannot invite the leader themselves
        if ($targetUserId == $group->creator_id) {
            return response()->json(['message' => 'Cannot invite the group leader.'], 400);
        }

        // Check if user is already a member
        $isAlreadyMember = $group->members()->where('users.id', $targetUserId)->exists();
        if ($isAlreadyMember) {
            return response()->json(['message' => 'This user is already a member of the group.'], 400);
        }

        // Check if there's already a pending invitation or request
        $existingRelation = $group->allMemberRelations()
            ->where('users.id', $targetUserId)
            ->wherePivot('status', 'pending')
            ->first();

        if ($existingRelation) {
            // If user has a pending join request, auto-approve it and treat as invitation
            if (!$existingRelation->pivot->invited_by) {
                $group->allMemberRelations()->updateExistingPivot($targetUserId, [
                    'status' => 'approved',
                    'invited_by' => $currentUser->id,
                    'approved_at' => now()
                ]);

                // Award karma for joining
                $invitedUser = User::find($targetUserId);
                KarmaService::awardGroupJoin($invitedUser);

                // Award karma to the group leader for gaining a member
                KarmaService::awardLeaderForMemberJoin($currentUser);

                return response()->json([
                    'message' => 'User request was auto-approved!',
                    'auto_approved' => true
                ]);
            } else {
                // Already has a pending invitation
                return response()->json(['message' => 'This user already has a pending invitation.'], 400);
            }
        }

        // Create new invitation
        $group->allMemberRelations()->attach($targetUserId, [
            'status' => 'pending',
            'invited_by' => $currentUser->id,
            'created_at' => now(),
            'updated_at' => now()
        ]);

        // Get invited user
        $invitedUser = User::find($targetUserId);

        // Create notification for invited user
        Notification::create([
            'user_id' => $targetUserId,
            'type' => 'group_invitation',
            'data' => [
                'group_id' => $group->id,
                'group_name' => $group->name,
                'inviter_name' => $currentUser->name,
                'inviter_id' => $currentUser->id,
                'message' => "{$currentUser->name} invited you to join '{$group->name}'"
            ]
        ]);

        // Send email notification if user's email is verified
        if ($invitedUser && $invitedUser->email_verified_at) {
            try {
                Mail::to($invitedUser->email)->send(new GroupInvitationMail(
                    $invitedUser->name,
                    $currentUser->name,
                    $group->name,
                    $group->id
                ));
            } catch (\Exception $e) {
                \Log::error('Failed to send group invitation email: ' . $e->getMessage());
            }
        }

        return response()->json([
            'message' => 'Invitation sent successfully!',
            'invited_user' => [
                'id' => $invitedUser->id,
                'name' => $invitedUser->name,
                'email' => $invitedUser->email
            ]
        ]);
    }

    /**
     * Accept a group invitation
     */
    public function acceptInvitation($groupId)
    {
        $group = StudyGroup::findOrFail($groupId);
        $currentUser = Auth::user();

        // Find the invitation
        $invitation = $group->allMemberRelations()
            ->where('users.id', $currentUser->id)
            ->wherePivot('status', 'pending')
            ->whereNotNull('invited_by')
            ->first();

        if (!$invitation) {
            return response()->json(['message' => 'No pending invitation found.'], 404);
        }

        // Check if group is still not full
        $currentMembersCount = $group->members()->count();
        if ($currentMembersCount >= $group->max_members) {
            return response()->json(['message' => 'Group is now full. Cannot accept invitation.'], 400);
        }

        // Update invitation to approved
        $group->allMemberRelations()->updateExistingPivot($currentUser->id, [
            'status' => 'approved',
            'approved_at' => now()
        ]);

        // Award karma for joining
        KarmaService::awardGroupJoin($currentUser);

        // Delete the invitation notification
        Notification::where('user_id', $currentUser->id)
            ->where('type', 'group_invitation')
            ->where('data->group_id', $group->id)
            ->delete();

        // Get the inviter (leader)
        $inviter = User::find($invitation->pivot->invited_by);

        // Award karma to the group leader for gaining a member
        $groupLeader = User::find($group->creator_id);
        if ($groupLeader) {
            KarmaService::awardLeaderForMemberJoin($groupLeader);
        }

        // Notify the inviter that invitation was accepted
        if ($inviter) {
            Notification::create([
                'user_id' => $inviter->id,
                'type' => 'invitation_accepted',
                'data' => [
                    'group_id' => $group->id,
                    'group_name' => $group->name,
                    'user_name' => $currentUser->name,
                    'message' => "{$currentUser->name} accepted your invitation to join '{$group->name}'"
                ]
            ]);

            // Send email to inviter
            if ($inviter->email_verified_at) {
                try {
                    Mail::to($inviter->email)->send(new InvitationAcceptedMail(
                        $inviter->name,
                        $currentUser->name,
                        $group->name
                    ));
                } catch (\Exception $e) {
                    \Log::error('Failed to send invitation accepted email: ' . $e->getMessage());
                }
            }
        }

        return response()->json([
            'message' => 'Invitation accepted! You are now a member of the group.',
            'group' => $group
        ]);
    }

    /**
     * Decline a group invitation
     */
    public function declineInvitation($groupId)
    {
        $group = StudyGroup::findOrFail($groupId);
        $currentUser = Auth::user();

        // Find the invitation
        $invitation = $group->allMemberRelations()
            ->where('users.id', $currentUser->id)
            ->wherePivot('status', 'pending')
            ->whereNotNull('invited_by')
            ->first();

        if (!$invitation) {
            return response()->json(['message' => 'No pending invitation found.'], 404);
        }

        // Update invitation to rejected
        $group->allMemberRelations()->updateExistingPivot($currentUser->id, [
            'status' => 'rejected',
            'rejected_at' => now()
        ]);

        // Delete the invitation notification
        Notification::where('user_id', $currentUser->id)
            ->where('type', 'group_invitation')
            ->where('data->group_id', $group->id)
            ->delete();

        // Get the inviter (leader)
        $inviter = User::find($invitation->pivot->invited_by);

        // Notify the inviter that invitation was declined
        if ($inviter) {
            Notification::create([
                'user_id' => $inviter->id,
                'type' => 'invitation_declined',
                'data' => [
                    'group_id' => $group->id,
                    'group_name' => $group->name,
                    'user_name' => $currentUser->name,
                    'message' => "{$currentUser->name} declined your invitation to join '{$group->name}'"
                ]
            ]);
        }

        return response()->json(['message' => 'Invitation declined.']);
    }

    /**
     * Get list of users invited to the group (Leader only)
     */
    public function getInvitedUsers($groupId)
    {
        $group = StudyGroup::findOrFail($groupId);
        $currentUser = Auth::user();

        // Only leader can see invited users
        if ($group->creator_id !== $currentUser->id) {
            return response()->json(['message' => 'Only the group leader can view pending invitations.'], 403);
        }

        // Get invited users
        $invitedUsers = $group->invitedUsers()
            ->select('users.id', 'users.name', 'users.email', 'users.major', 'users.avatar')
            ->get()
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'major' => $user->major,
                    'avatar' => $user->avatar,
                    'invited_at' => $user->pivot->created_at
                ];
            });

        return response()->json($invitedUsers);
    }

    /**
     * Transfer group ownership to another member (Leader of that group or Admin)
     */
    public function transferOwnership(Request $request, $groupId)
    {
        $user = Auth::user();
        $validated = $request->validate([
            'new_owner_id' => 'required|exists:users,id'
        ]);

        $group = StudyGroup::with('members')->findOrFail($groupId);
        $newOwnerId = $validated['new_owner_id'];

        // Only the current group leader or an admin can transfer ownership
        if ($group->creator_id !== $user->id && $user->role !== 'admin') {
            return response()->json(['message' => 'Only the group leader can transfer ownership.'], 403);
        }

        // Check if new owner is a member of the group
        $isNewOwnerMember = $group->members()->where('users.id', $newOwnerId)->exists();
        if (!$isNewOwnerMember) {
            return response()->json([
                'message' => 'The new owner must be a current member of the group.'
            ], 422);
        }

        $oldOwner = $group->creator;
        $newOwner = User::find($newOwnerId);

        // Transfer ownership
        $group->creator_id = $newOwnerId;
        $group->save();

        // Update new owner's role to leader if not already
        if ($newOwner->role === 'member') {
            $newOwner->role = 'leader';
            $newOwner->save();
        }

        // Notify old owner
        Notification::create([
            'user_id' => $oldOwner->id,
            'type' => 'ownership_transferred',
            'data' => [
                'message' => "Ownership of '{$group->name}' has been transferred to {$newOwner->name}",
                'group_id' => $group->id,
                'group_name' => $group->name,
                'new_owner' => $newOwner->name
            ]
        ]);

        // Notify new owner
        Notification::create([
            'user_id' => $newOwnerId,
            'type' => 'ownership_received',
            'data' => [
                'message' => "You are now the leader of '{$group->name}'",
                'group_id' => $group->id,
                'group_name' => $group->name,
                'previous_owner' => $oldOwner->name
            ]
        ]);

        // Send email to old owner if their email is verified
        if ($oldOwner->email_verified_at) {
            try {
                Mail::to($oldOwner->email)->send(new OwnershipTransferredMail(
                    $oldOwner,
                    $group,
                    $newOwner,
                    false // isNewOwner = false
                ));
            } catch (\Exception $e) {
                \Log::error('Failed to send ownership transferred email to old owner: ' . $e->getMessage());
            }
        }

        // Send email to new owner if their email is verified
        if ($newOwner->email_verified_at) {
            try {
                Mail::to($newOwner->email)->send(new OwnershipTransferredMail(
                    $newOwner,
                    $group,
                    $newOwner,
                    true // isNewOwner = true
                ));
            } catch (\Exception $e) {
                \Log::error('Failed to send ownership transferred email to new owner: ' . $e->getMessage());
            }
        }

        // Notify all other members
        $otherMembers = $group->members()->where('users.id', '!=', $newOwnerId)->get();
        foreach ($otherMembers as $member) {
            Notification::create([
                'user_id' => $member->id,
                'type' => 'group_leadership_changed',
                'data' => [
                    'message' => "{$newOwner->name} is now the leader of '{$group->name}'",
                    'group_id' => $group->id,
                    'group_name' => $group->name,
                    'new_leader' => $newOwner->name
                ]
            ]);
        }

        return response()->json([
            'message' => 'Ownership transferred successfully',
            'group' => $group->fresh()->load('creator')
        ]);
    }

    /**
     * Approve a pending group (Admin only)
     */
    public function approveGroup($id)
    {
        $group = StudyGroup::with('creator')->findOrFail($id);

        if ($group->approval_status !== 'pending') {
            return response()->json([
                'message' => 'Group is not pending approval'
            ], 422);
        }

        $group->approval_status = 'approved';
        $group->approved_by = Auth::id();
        $group->approved_at = now();
        $group->save();

        // Notify group creator
        Notification::create([
            'user_id' => $group->creator_id,
            'type' => 'group_approved',
            'data' => [
                'message' => "Your group '{$group->name}' has been approved!",
                'group_id' => $group->id,
                'group_name' => $group->name
            ]
        ]);

        // Send email notification if creator's email is verified
        if ($group->creator->email_verified_at) {
            try {
                Mail::to($group->creator->email)->send(new GroupApprovedMail(
                    $group->creator,
                    $group,
                    Auth::user()->name
                ));
            } catch (\Exception $e) {
                \Log::error('Failed to send group approved email: ' . $e->getMessage());
            }
        }

        return response()->json([
            'message' => 'Group approved successfully',
            'group' => $group->fresh()
        ]);
    }

    /**
     * Reject a pending group (Admin only)
     */
    public function rejectGroup(Request $request, $id)
    {
        $validated = $request->validate([
            'reason' => 'required|string|max:1000'
        ]);

        $group = StudyGroup::with('creator')->findOrFail($id);

        if ($group->approval_status !== 'pending') {
            return response()->json([
                'message' => 'Group is not pending approval'
            ], 422);
        }

        $group->approval_status = 'rejected';
        $group->rejected_reason = $validated['reason'];
        $group->save();

        // Notify group creator
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

        return response()->json([
            'message' => 'Group rejected',
            'group' => $group->fresh()
        ]);
    }

    /**
     * Force archive a group with reason (Admin only)
     */
    public function forceArchive(Request $request, $id)
    {
        $validated = $request->validate([
            'reason' => 'required|string|max:1000'
        ]);

        $group = StudyGroup::with(['creator', 'members'])->findOrFail($id);

        $group->status = 'archived';
        $group->save();

        // Notify group leader
        Notification::create([
            'user_id' => $group->creator_id,
            'type' => 'group_archived_admin',
            'data' => [
                'message' => "Your group '{$group->name}' has been archived by administration",
                'group_id' => $group->id,
                'group_name' => $group->name,
                'reason' => $validated['reason']
            ]
        ]);

        // Notify all members
        foreach ($group->members as $member) {
            Notification::create([
                'user_id' => $member->id,
                'type' => 'group_archived_admin',
                'data' => [
                    'message' => "The group '{$group->name}' has been archived by administration",
                    'group_id' => $group->id,
                    'group_name' => $group->name,
                    'reason' => $validated['reason']
                ]
            ]);
        }

        return response()->json([
            'message' => 'Group archived successfully',
            'group' => $group->fresh(),
            'members_notified' => $group->members->count()
        ]);
    }

    /**
     * Get chat logs for a group (Admin only)
     */
    public function getChatLogs($groupId, Request $request)
    {
        $group = StudyGroup::findOrFail($groupId);

        $search = $request->get('search', '');

        $messages = Message::where('group_id', $groupId)
            ->with('user')
            ->when($search, function($query, $search) {
                return $query->where('content', 'like', "%{$search}%")
                    ->orWhereHas('user', function($q) use ($search) {
                        $q->where('name', 'like', "%{$search}%");
                    });
            })
            ->orderBy('created_at', 'asc')  // Changed to asc for chronological order
            ->get();

        return response()->json([
            'group' => $group,
            'messages' => $messages,
            'total_messages' => $messages->count()
        ]);
    }
}