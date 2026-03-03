import React, { useState, useEffect } from 'react';
import { X, Users, MapPin, Calendar, Loader2, MessageSquare, UserMinus, Trash2, UserPlus, Lock, Unlock, Archive, Star } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { StudyGroup, GroupMember, GroupStatus, User, Rating } from '../types';
import { apiService } from '../services/apiService';
import { API_CONFIG } from '../constants';
import StarRating from './StarRating';

interface GroupDetailModalProps {
  group: StudyGroup;
  currentUser: User | null;
  onClose: () => void;
  onJoin: (groupId: string) => Promise<void>;
  onLeave: (groupId: string) => Promise<void>;
  onDelete: (groupId: string) => Promise<void>;
  onRefresh: () => void;
}

const GroupDetailModal: React.FC<GroupDetailModalProps> = ({
  group,
  currentUser,
  onClose,
  onJoin,
  onLeave,
  onDelete,
  onRefresh
}) => {
  const navigate = useNavigate();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Rating state
  const [userRating, setUserRating] = useState<Rating | null>(null);
  const [groupRating, setGroupRating] = useState(0);
  const [leaderRating, setLeaderRating] = useState(0);
  const [loadingRating, setLoadingRating] = useState(false);
  const [ratingMessage, setRatingMessage] = useState('');

  const isCreator = group.creator_id === currentUser?.id;
  const isMember = group.is_member;
  const hasPending = group.has_pending_request;
  const isFull = group.members_count >= group.max_members;
  const isArchived = group.status === GroupStatus.ARCHIVED;

  useEffect(() => {
    loadMembers();
    if (isMember) {
      loadUserRating();
    }
  }, [group.id, isMember]);

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const membersList = await apiService.getGroupMembers(group.id);
      setMembers(membersList);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadUserRating = async () => {
    if (!isMember || !currentUser) return;
    try {
      const rating = await apiService.getMyRating(group.id);
      setUserRating(rating);
      if (rating) {
        setGroupRating(rating.group_rating);
        setLeaderRating(rating.leader_rating);
      }
    } catch (err) {
      console.error('Failed to load rating:', err);
    }
  };

  const handleSubmitRating = async () => {
    if (groupRating < 1 || groupRating > 5 || leaderRating < 1 || leaderRating > 5) {
      setRatingMessage('Please select ratings between 1 and 5 stars');
      setTimeout(() => setRatingMessage(''), 3000);
      return;
    }

    setLoadingRating(true);
    setRatingMessage('');
    try {
      const response = await apiService.submitRating(group.id, {
        group_rating: groupRating,
        leader_rating: leaderRating
      });
      setUserRating(response.rating);
      setRatingMessage(response.message || 'Rating submitted successfully!');
      setTimeout(() => setRatingMessage(''), 3000);
      onRefresh(); // Refresh to update average ratings on card
    } catch (err: any) {
      setRatingMessage(err.message || 'Failed to submit rating');
      setTimeout(() => setRatingMessage(''), 3000);
    } finally {
      setLoadingRating(false);
    }
  };

  const handleDeleteRating = async () => {
    if (!confirm('Are you sure you want to delete your rating?')) return;

    setLoadingRating(true);
    setRatingMessage('');
    try {
      await apiService.deleteRating(group.id);
      setUserRating(null);
      setGroupRating(0);
      setLeaderRating(0);
      setRatingMessage('Rating deleted successfully');
      setTimeout(() => setRatingMessage(''), 3000);
      onRefresh(); // Refresh to update average ratings on card
    } catch (err: any) {
      setRatingMessage(err.message || 'Failed to delete rating');
      setTimeout(() => setRatingMessage(''), 3000);
    } finally {
      setLoadingRating(false);
    }
  };

  const handleJoin = async () => {
    setActionLoading(true);
    try {
      await onJoin(group.id);
      onRefresh();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to join group');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm('Are you sure you want to leave this group?')) return;
    setActionLoading(true);
    try {
      await onLeave(group.id);
      onRefresh();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to leave group');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) return;
    setActionLoading(true);
    try {
      await onDelete(group.id);
      onRefresh();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to delete group');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: GroupStatus) => {
    switch (status) {
      case GroupStatus.OPEN:
        return <span className="flex items-center gap-1 text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-lg"><Unlock size={10}/> Open</span>;
      case GroupStatus.CLOSED:
        return <span className="flex items-center gap-1 text-[9px] font-black text-amber-500 uppercase tracking-widest bg-amber-50 px-2 py-1 rounded-lg"><Lock size={10}/> Closed</span>;
      case GroupStatus.ARCHIVED:
        return <span className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-lg"><Archive size={10}/> Archived</span>;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="bg-orange-500 p-8 flex justify-between items-start text-white">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-black tracking-tight">{group.name}</h2>
              {getStatusBadge(group.status)}
            </div>
            <p className="text-orange-100 text-sm font-bold">{group.subject} · {group.faculty}</p>
            <p className="text-orange-100/80 text-xs mt-1">Created by {group.creator_name}</p>
          </div>
          <button
            onClick={onClose}
            className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">About This Group</h3>
            <p className="text-slate-600 leading-relaxed">{group.description}</p>
          </div>

          {/* Rating Section - Only for Members */}
          {isMember && (
            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Star size={14} className="text-orange-500" />
                Rate This Group
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-slate-700 mb-2 block">Group Quality</label>
                  <StarRating value={groupRating} onChange={setGroupRating} size="md" />
                </div>

                <div>
                  <label className="text-sm font-bold text-slate-700 mb-2 block">Leader Effectiveness</label>
                  <StarRating value={leaderRating} onChange={setLeaderRating} size="md" />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={handleSubmitRating}
                    disabled={loadingRating || (userRating && userRating.update_count >= 3) || groupRating === 0 || leaderRating === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-orange-100"
                  >
                    {loadingRating ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        <Star size={16} />
                        {userRating ? 'Update Rating' : 'Submit Rating'}
                      </>
                    )}
                  </button>

                  {userRating && (
                    <>
                      <span className="text-xs text-slate-500 font-semibold">
                        {3 - userRating.update_count} edit{3 - userRating.update_count !== 1 ? 's' : ''} remaining
                      </span>
                      <button
                        onClick={handleDeleteRating}
                        disabled={loadingRating}
                        className="px-4 py-3 bg-red-50 border border-red-200 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-all disabled:opacity-50"
                      >
                        Delete Rating
                      </button>
                    </>
                  )}

                  {ratingMessage && (
                    <p className={`text-sm font-semibold ${ratingMessage.includes('success') ? 'text-emerald-600' : 'text-red-600'}`}>
                      {ratingMessage}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {!isMember && !isCreator && (
            <div className="border-t border-slate-200 pt-6">
              <p className="text-sm text-slate-400 italic">Join this group to leave a rating</p>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-3 gap-4 p-6 bg-slate-50 rounded-2xl">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Users size={12}/> Members
              </p>
              <p className={`text-lg font-bold ${isFull ? 'text-amber-600' : 'text-slate-900'}`}>
                {group.members_count} / {group.max_members}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <MapPin size={12}/> Location
              </p>
              <p className="text-sm font-bold text-slate-900 truncate">{group.location}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar size={12}/> Created
              </p>
              <p className="text-sm font-bold text-slate-900">
                {new Date(group.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Members List */}
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
              Group Members ({members.length})
            </h3>
            {loadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-orange-500" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No members yet</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {members.map(member => (
                  <Link
                    key={member.id}
                    to={`/profile/${member.id}`}
                    onClick={onClose}
                    className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-orange-200 transition-all group"
                  >
                    <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center font-bold text-sm border border-orange-200 group-hover:scale-105 transition-transform overflow-hidden">
                      {member.avatar
                        ? <img src={`${API_CONFIG.STORAGE_URL}/${member.avatar}`} alt={member.name} className="w-full h-full object-cover" />
                        : member.name[0]
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate group-hover:text-orange-500 transition-colors">
                        {member.name}
                        {String(member.id) === String(group.creator_id) && (
                          <span className="ml-1.5 text-[8px] font-black text-orange-500 uppercase bg-orange-50 px-1.5 py-0.5 rounded">Leader</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{member.major || 'Student'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-slate-200 bg-slate-50/50">
          <div className="flex gap-3">
            {/* Join Button - Show if not a member and not creator */}
            {!isMember && !isCreator && (
              <button
                onClick={handleJoin}
                disabled={actionLoading || hasPending || isFull || isArchived}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                  hasPending
                    ? 'bg-amber-50 border-2 border-amber-200 text-amber-600 cursor-default'
                    : isArchived || isFull
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-100'
                }`}
              >
                {actionLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <UserPlus size={18} />
                    {hasPending ? 'Request Pending...' : isArchived ? 'Archived' : isFull ? 'Group Full' : 'Join Group'}
                  </>
                )}
              </button>
            )}

            {/* Open Chat Button - Show if member */}
            {isMember && (
              <button
                onClick={() => {
                  onClose();
                  navigate(`/groups?group=${group.id}`);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-orange-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-600 shadow-lg shadow-orange-100 transition-all"
              >
                <MessageSquare size={18} />
                Open Chat
              </button>
            )}

            {/* Leave Button - Show if member but not creator */}
            {isMember && !isCreator && (
              <button
                onClick={handleLeave}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-red-100 text-red-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-50 transition-all"
              >
                {actionLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <UserMinus size={18} />
                    Leave Group
                  </>
                )}
              </button>
            )}

            {/* Delete Button - Show if creator */}
            {isCreator && (
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-600 shadow-lg shadow-red-100 transition-all"
              >
                {actionLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <Trash2 size={18} />
                    Delete Group
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupDetailModal;
