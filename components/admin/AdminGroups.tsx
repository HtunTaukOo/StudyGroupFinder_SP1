import React, { useState, useEffect } from 'react';
import { Search, Edit2, Trash2, X, Users, Loader2, UsersIcon, AlertCircle, Unlock, Lock, Archive, RefreshCw, Clock, CheckCircle, XCircle, HelpCircle, UserCheck, MessageSquare, Calendar, Star, Filter, Repeat, MapPin } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { API_CONFIG } from '../../constants';

// ── Interfaces ──────────────────────────────────────────────────────────────

interface GroupData {
  id: string;
  name: string;
  subject: string;
  faculty: string;
  description: string;
  max_members: number;
  location: string;
  status: string;
  approval_status: string;
  members_count: number;
  created_at: string;
  creator: { name: string; email: string };
}

interface EventData {
  id: string;
  title: string;
  type: string;
  start_time: string;
  location: string | null;
  recurrence: string;
  recurrence_count: number | null;
  user: { id: string; name: string; email: string };
  group: { id: string; name: string } | null;
  created_at: string;
}

interface RatingData {
  id: string;
  group_rating: number;
  leader_rating: number;
  update_count: number;
  user: { id: string; name: string; email: string };
  group: { id: string; name: string };
  created_at: string;
  updated_at: string;
}

interface GroupRatingSummary {
  avgGroup: number;
  avgLeader: number;
  count: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const getToken = () => {
  const s = localStorage.getItem('admin_auth');
  return s ? JSON.parse(s).token : null;
};

const isAdmin = () => {
  const s = localStorage.getItem('admin_auth');
  return s ? JSON.parse(s).role === 'admin' : false;
};

const getTimeAgo = (date: Date | null) => {
  if (!date) return 'Never';
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
};

// ── Component ────────────────────────────────────────────────────────────────

const AdminGroups: React.FC = () => {
  // ── Groups state ──────────────────────────────────────────────
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalGroups, setTotalGroups] = useState(0);
  const [editingGroup, setEditingGroup] = useState<GroupData | null>(null);
  const [editForm, setEditForm] = useState({ name: '', subject: '', faculty: '', description: '', max_members: 5, location: '', status: 'open' });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [approvingGroup, setApprovingGroup] = useState<GroupData | null>(null);
  const [rejectingGroup, setRejectingGroup] = useState<GroupData | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [transferringGroup, setTransferringGroup] = useState<GroupData | null>(null);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [viewingChatLogs, setViewingChatLogs] = useState<GroupData | null>(null);
  const [chatLogs, setChatLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // ── Ratings summary state (inline per group) ──────────────────
  const [groupRatings, setGroupRatings] = useState<Record<string, GroupRatingSummary>>({});
  const [ratingSort, setRatingSort] = useState<'' | 'most' | 'least'>('');

  // ── Group meetings modal state ────────────────────────────────
  const [viewingGroupMeetings, setViewingGroupMeetings] = useState<GroupData | null>(null);
  const [groupMeetingsUpcoming, setGroupMeetingsUpcoming] = useState<EventData[]>([]);
  const [groupMeetingsPast, setGroupMeetingsPast] = useState<EventData[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [evDeleting, setEvDeleting] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventData | null>(null);
  const [evSaving, setEvSaving] = useState(false);

  // ── Fetch: Groups ─────────────────────────────────────────────
  const fetchGroups = async (silent = false) => {
    try {
      if (!silent) setRefreshing(true);
      const token = getToken();
      const res = await fetch(
        `${API_CONFIG.BASE_URL}/admin/groups?page=${currentPage}&search=${searchQuery}&status=${statusFilter}&approval_status=${approvalFilter}`,
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGroups(data.data);
      setCurrentPage(data.current_page);
      setTotalPages(data.last_page);
      setTotalGroups(data.total);
      setLastUpdated(new Date());
    } catch { console.error('Failed to load groups'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  // ── Fetch: Ratings (aggregate per group for inline display) ───
  const fetchAllRatings = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_CONFIG.BASE_URL}/admin/ratings?per_page=500`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const raw: RatingData[] = data.data || [];
      const totals: Record<string, { totalGroup: number; totalLeader: number; count: number }> = {};
      raw.forEach(r => {
        const e = totals[r.group.id] || { totalGroup: 0, totalLeader: 0, count: 0 };
        totals[r.group.id] = { totalGroup: e.totalGroup + r.group_rating, totalLeader: e.totalLeader + r.leader_rating, count: e.count + 1 };
      });
      const summary: Record<string, GroupRatingSummary> = {};
      Object.entries(totals).forEach(([gid, v]) => {
        summary[gid] = { avgGroup: v.totalGroup / v.count, avgLeader: v.totalLeader / v.count, count: v.count };
      });
      setGroupRatings(summary);
    } catch { console.error('Failed to load ratings'); }
  };

  // ── Fetch: Meetings for a specific group ─────────────────────
  const handleViewMeetings = async (group: GroupData) => {
    setViewingGroupMeetings(group);
    setLoadingMeetings(true);
    setGroupMeetingsUpcoming([]);
    setGroupMeetingsPast([]);
    try {
      const token = getToken();
      const res = await fetch(
        `${API_CONFIG.BASE_URL}/admin/events?group_id=${group.id}&per_page=100`,
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      const events: EventData[] = data.data || [];
      const now = new Date();
      setGroupMeetingsUpcoming(
        events.filter(e => new Date(e.start_time) >= now).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      );
      setGroupMeetingsPast(
        events.filter(e => new Date(e.start_time) < now).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
      );
    } catch { alert('Failed to load meetings for this group'); }
    finally { setLoadingMeetings(false); }
  };

  // ── Effects ───────────────────────────────────────────────────
  useEffect(() => {
    fetchGroups();
    const iv = setInterval(() => fetchGroups(true), 30000);
    return () => clearInterval(iv);
  }, [currentPage, searchQuery, statusFilter, approvalFilter]);

  useEffect(() => { fetchAllRatings(); }, []);

  // ── Sorted groups (client-side by avg rating) ─────────────────
  const sortedGroups = ratingSort
    ? [...groups].sort((a, b) => {
        const ra = groupRatings[a.id];
        const rb = groupRatings[b.id];
        const avgA = ra ? (ra.avgGroup + ra.avgLeader) / 2 : 0;
        const avgB = rb ? (rb.avgGroup + rb.avgLeader) / 2 : 0;
        return ratingSort === 'most' ? avgB - avgA : avgA - avgB;
      })
    : groups;

  // ── Groups CRUD ───────────────────────────────────────────────
  const handleEdit = (g: GroupData) => {
    setEditingGroup(g);
    setEditForm({ name: g.name, subject: g.subject, faculty: g.faculty, description: g.description, max_members: g.max_members, location: g.location, status: g.status });
  };

  const handleUpdate = async () => {
    if (!editingGroup) return;
    setSaving(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_CONFIG.BASE_URL}/admin/groups/${editingGroup.id}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) });
      if (!res.ok) throw new Error();
      alert('Group updated successfully!');
      setEditingGroup(null);
      fetchGroups();
    } catch { alert('Failed to update group'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const token = getToken();
      const res = await fetch(`${API_CONFIG.BASE_URL}/admin/groups/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error();
      alert('Group deleted successfully!');
      setDeleteConfirm(null);
      fetchGroups();
    } catch { alert('Failed to delete group'); }
  };

  const handleApproveGroup = async () => {
    if (!approvingGroup) return;
    setSaving(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_CONFIG.BASE_URL}/admin/groups/${approvingGroup.id}/approve`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error();
      alert('Group approved successfully!');
      setApprovingGroup(null);
      fetchGroups();
    } catch { alert('Failed to approve group'); }
    finally { setSaving(false); }
  };

  const handleRejectGroup = async () => {
    if (!rejectingGroup) return;
    setSaving(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_CONFIG.BASE_URL}/admin/groups/${rejectingGroup.id}/reject`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: rejectionReason }) });
      if (!res.ok) throw new Error();
      alert('Group rejected successfully!');
      setRejectingGroup(null);
      setRejectionReason('');
      fetchGroups();
    } catch { alert('Failed to reject group'); }
    finally { setSaving(false); }
  };

  const handleOpenTransferModal = async (group: GroupData) => {
    setTransferringGroup(group);
    try {
      const token = getToken();
      const res = await fetch(`${API_CONFIG.BASE_URL}/groups/${group.id}`, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGroupMembers(data.members || []);
    } catch { alert('Failed to load group members'); }
  };

  const handleTransferOwnership = async () => {
    if (!transferringGroup || !newOwnerId) return;
    setSaving(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_CONFIG.BASE_URL}/admin/groups/${transferringGroup.id}/transfer-ownership`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ new_owner_id: newOwnerId }) });
      if (!res.ok) throw new Error();
      alert('Ownership transferred successfully!');
      setTransferringGroup(null); setNewOwnerId(''); setGroupMembers([]);
      fetchGroups();
    } catch { alert('Failed to transfer ownership'); }
    finally { setSaving(false); }
  };

  const handleViewChatLogs = async (group: GroupData) => {
    setViewingChatLogs(group);
    setLoadingLogs(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_CONFIG.BASE_URL}/admin/groups/${group.id}/chat-logs`, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setChatLogs(data.messages || []);
    } catch { alert('Failed to load chat logs'); }
    finally { setLoadingLogs(false); }
  };

  // ── Events CRUD (for meetings modal) ──────────────────────────
  const handleDeleteEvent = async (id: string, groupId: string) => {
    if (!confirm('Delete this meeting? This cannot be undone.')) return;
    setEvDeleting(id);
    try {
      const token = getToken();
      const res = await fetch(`${API_CONFIG.BASE_URL}/admin/events/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error();
      // Refresh meetings for the current group
      const fakeGroup = viewingGroupMeetings || { id: groupId } as GroupData;
      await handleViewMeetings(fakeGroup);
    } catch { alert('Failed to delete meeting'); }
    finally { setEvDeleting(null); }
  };

  const handleUpdateEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEvent) return;
    setEvSaving(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_CONFIG.BASE_URL}/admin/events/${editingEvent.id}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: editingEvent.title, type: editingEvent.type, start_time: editingEvent.start_time, location: editingEvent.location || null, recurrence: editingEvent.recurrence, recurrence_count: editingEvent.recurrence_count || null }) });
      if (!res.ok) throw new Error();
      alert('Meeting updated successfully');
      setEditingEvent(null);
      if (viewingGroupMeetings) await handleViewMeetings(viewingGroupMeetings);
    } catch { alert('Failed to update meeting'); }
    finally { setEvSaving(false); }
  };

  // ── Display helpers ───────────────────────────────────────────
  const getStatusBadge = (s: string) => {
    if (s === 'open')     return <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg"><Unlock size={12}/> Open</span>;
    if (s === 'closed')   return <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-lg"><Lock size={12}/> Closed</span>;
    if (s === 'archived') return <span className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg"><Archive size={12}/> Archived</span>;
    return null;
  };

  const getApprovalBadge = (s: string) => {
    if (s === 'approved') return <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg"><CheckCircle size={12}/> Approved</span>;
    if (s === 'rejected') return <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-3 py-1 rounded-lg"><XCircle size={12}/> Rejected</span>;
    if (s === 'pending')  return <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-lg"><HelpCircle size={12}/> Pending</span>;
    return null;
  };

  const formatDateTime = (ds: string) => new Date(ds).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

  const getEventTypeColor = (type: string) => (({ 'General': 'bg-slate-100 text-slate-700', 'Project': 'bg-blue-100 text-blue-700', 'Group Meeting': 'bg-purple-100 text-purple-700', 'Exam': 'bg-red-100 text-red-700', 'Assignment': 'bg-orange-100 text-orange-700' } as Record<string, string>)[type] || 'bg-slate-100 text-slate-700');

  const renderRatingStars = (value: number, label: string) => (
    <div className="flex items-center gap-1 mt-1">
      {[1,2,3,4,5].map(s => (
        <Star key={s} size={11} className={s <= Math.round(value) ? 'text-amber-500 fill-amber-500' : 'text-slate-200 fill-slate-200'} />
      ))}
      <span className="ml-1 text-xs font-bold text-slate-500">{value.toFixed(1)}</span>
      <span className="text-xs text-slate-400 font-medium">{label}</span>
    </div>
  );

  const renderGroupRating = (groupId: string) => {
    const r = groupRatings[groupId];
    if (!r) return null;
    return renderRatingStars(r.avgGroup, `· ${r.count} review${r.count !== 1 ? 's' : ''}`);
  };

  const renderLeaderRating = (groupId: string) => {
    const r = groupRatings[groupId];
    if (!r) return null;
    return renderRatingStars(r.avgLeader, '');
  };

  const MeetingCard = ({ event, isPast }: { event: EventData; isPast: boolean }) => (
    <div className={`flex items-start justify-between gap-4 p-4 rounded-xl border-2 transition-colors ${isPast ? 'border-slate-100 bg-slate-50 opacity-70' : 'border-purple-100 bg-purple-50/40'}`}>
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className={`mt-0.5 p-2 rounded-xl ${isPast ? 'bg-slate-200' : 'bg-purple-100'}`}>
          <Calendar size={16} className={isPast ? 'text-slate-500' : 'text-purple-600'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-slate-900 text-sm">{event.title}</p>
            {isPast && <span className="px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded text-[10px] font-black uppercase">Done</span>}
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getEventTypeColor(event.type)}`}>{event.type}</span>
            {event.recurrence !== 'none' && event.recurrence_count && (
              <span className="flex items-center gap-1 text-xs text-slate-500 font-medium"><Repeat size={11} />{event.recurrence} ({event.recurrence_count}x)</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-slate-500 font-medium"><Clock size={11} />{formatDateTime(event.start_time)}</span>
            {event.location && <span className="flex items-center gap-1 text-xs text-slate-500 font-medium"><MapPin size={11} />{event.location}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setEditingEvent(event)}
          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
          title="Edit meeting"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={() => handleDeleteEvent(event.id, event.group?.id || '')}
          disabled={evDeleting === event.id}
          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
          title="Delete meeting"
        >
          {evDeleting === event.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Group Management</h1>
            <p className="text-slate-500 font-medium">{totalGroups} total study groups</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
              <Clock size={16} /><span>Updated {getTimeAgo(lastUpdated)}</span>
            </div>
            <button onClick={() => { fetchGroups(); fetchAllRatings(); }} disabled={refreshing} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50">
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold text-slate-900">
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
          <select value={approvalFilter} onChange={e => { setApprovalFilter(e.target.value); setCurrentPage(1); }} className="px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold text-slate-900">
            <option value="">All Approvals</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select value={ratingSort} onChange={e => setRatingSort(e.target.value as '' | 'most' | 'least')} className="pl-9 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold text-slate-900 appearance-none">
              <option value="">Sort by Rating</option>
              <option value="most">Most Rated ↓</option>
              <option value="least">Least Rated ↑</option>
            </select>
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input type="text" placeholder="Search groups..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold text-slate-900 placeholder:text-slate-400" />
          </div>
        </div>

        {/* Groups Table */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center"><Loader2 size={32} className="animate-spin text-purple-600 mx-auto mb-4" /><p className="text-slate-600 font-bold">Loading groups...</p></div>
          ) : sortedGroups.length === 0 ? (
            <div className="p-12 text-center"><UsersIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" /><p className="text-slate-600 font-bold">No groups found</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b-2 border-slate-200">
                  <tr>
                    {['Group', 'Leader', 'Faculty', 'Members', 'Status', 'Approval', 'Created', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedGroups.map(group => (
                    <tr key={group.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900">{group.name}</p>
                        <p className="text-sm text-slate-500">{group.subject}</p>
                        {renderGroupRating(group.id)}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-700">{group.creator.name}</p>
                        <p className="text-xs text-slate-500">{group.creator.email}</p>
                        {renderLeaderRating(group.id)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm font-bold text-slate-700">{group.faculty}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2"><Users size={14} className="text-purple-600" /><span className="text-sm font-bold text-slate-700">{group.members_count}/{group.max_members}</span></div>
                      </td>
                      <td className="px-5 py-4">{getStatusBadge(group.status)}</td>
                      <td className="px-5 py-4">{getApprovalBadge(group.approval_status)}</td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-slate-500 font-medium">{new Date(group.created_at).toLocaleDateString()}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button onClick={() => handleViewMeetings(group)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="View meetings"><Calendar size={16} /></button>
                          <button onClick={() => handleViewChatLogs(group)} className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-all" title="Chat logs"><MessageSquare size={16} /></button>
                          {isAdmin() && (<>
                            {group.approval_status === 'pending' && (<>
                              <button onClick={() => setApprovingGroup(group)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Approve"><CheckCircle size={16} /></button>
                              <button onClick={() => setRejectingGroup(group)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Reject"><XCircle size={16} /></button>
                            </>)}
                            <button onClick={() => handleOpenTransferModal(group)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-all" title="Transfer ownership"><UserCheck size={16} /></button>
                            <button onClick={() => handleEdit(group)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit"><Edit2 size={16} /></button>
                            <button onClick={() => setDeleteConfirm(group.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete"><Trash2 size={16} /></button>
                          </>)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-sm flex items-center justify-between">
            <p className="text-sm text-slate-600 font-medium">Page {currentPage} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-200 disabled:opacity-50 transition-all">Previous</button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} className="px-4 py-2 bg-purple-500 text-white rounded-lg font-bold text-sm hover:bg-purple-600 disabled:opacity-50 transition-all">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Group Modal ── */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-purple-500 p-8 text-white flex justify-between items-center">
              <div><h3 className="text-2xl font-black">Edit Group</h3><p className="text-purple-100 text-sm font-bold mt-1">Update group information</p></div>
              <button onClick={() => setEditingGroup(null)} className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-all"><X size={24} /></button>
            </div>
            <div className="p-8 space-y-6 max-h-[600px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Group Name</label>
                  <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Subject</label>
                  <input type="text" value={editForm.subject} onChange={e => setEditForm({...editForm, subject: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Faculty</label>
                  <input type="text" value={editForm.faculty} onChange={e => setEditForm({...editForm, faculty: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Max Members</label>
                  <input type="number" min="2" value={editForm.max_members} onChange={e => setEditForm({...editForm, max_members: parseInt(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Location</label>
                  <input type="text" value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Status</label>
                  <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold">
                    <option value="open">Open</option><option value="closed">Closed</option><option value="archived">Archived</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Description</label>
                  <textarea value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} rows={3} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold resize-none" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleUpdate} disabled={saving} className="flex-1 py-4 bg-purple-500 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-purple-600 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <><Loader2 size={18} className="animate-spin" />Saving...</> : 'Save Changes'}
                </button>
                <button onClick={() => setEditingGroup(null)} className="px-6 py-4 bg-slate-100 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Group Modal ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 p-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle size={32} className="text-red-600" /></div>
            <h3 className="text-xl font-black text-slate-900 text-center mb-2">Delete Group?</h3>
            <p className="text-slate-600 text-center mb-6">This action cannot be undone. All messages and group data will be permanently deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all">Delete</button>
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Approve Group Modal ── */}
      {approvingGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 p-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-emerald-600" /></div>
            <h3 className="text-xl font-black text-slate-900 text-center mb-2">Approve Group?</h3>
            <div className="bg-emerald-50 p-4 rounded-xl mb-6">
              <p className="font-bold text-slate-900">{approvingGroup.name}</p>
              <p className="text-sm text-slate-600">{approvingGroup.subject}</p>
              <p className="text-xs text-slate-500 mt-1">Created by: {approvingGroup.creator.name}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleApproveGroup} disabled={saving} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <><Loader2 size={16} className="animate-spin" />Approving...</> : 'Approve'}
              </button>
              <button onClick={() => setApprovingGroup(null)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Group Modal ── */}
      {rejectingGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-red-500 p-8 text-white flex justify-between items-center">
              <div><h3 className="text-2xl font-black">Reject Group</h3><p className="text-red-100 text-sm font-bold mt-1">Provide a reason for rejection</p></div>
              <button onClick={() => { setRejectingGroup(null); setRejectionReason(''); }} className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-all"><X size={24} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="bg-red-50 p-4 rounded-xl border-2 border-red-200">
                <p className="font-bold text-slate-900">{rejectingGroup.name}</p>
                <p className="text-xs text-slate-500 mt-1">Created by: {rejectingGroup.creator.name}</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Rejection Reason</label>
                <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={4} placeholder="Explain why this group is being rejected..." className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none font-bold resize-none placeholder:text-slate-400" />
              </div>
              <div className="flex gap-3">
                <button onClick={handleRejectGroup} disabled={saving || !rejectionReason.trim()} className="flex-1 py-4 bg-red-500 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <><Loader2 size={18} className="animate-spin" />Rejecting...</> : <><XCircle size={18} />Reject Group</>}
                </button>
                <button onClick={() => { setRejectingGroup(null); setRejectionReason(''); }} className="px-6 py-4 bg-slate-100 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Transfer Ownership Modal ── */}
      {transferringGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-purple-500 p-8 text-white flex justify-between items-center">
              <div><h3 className="text-2xl font-black">Transfer Ownership</h3><p className="text-purple-100 text-sm font-bold mt-1">Assign a new group leader</p></div>
              <button onClick={() => { setTransferringGroup(null); setNewOwnerId(''); setGroupMembers([]); }} className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-all"><X size={24} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="bg-purple-50 p-4 rounded-xl border-2 border-purple-200">
                <p className="font-bold text-slate-900">{transferringGroup.name}</p>
                <p className="text-xs text-slate-500 mt-1">Current leader: {transferringGroup.creator.name}</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">New Owner</label>
                {groupMembers.length > 0 ? (
                  <select value={newOwnerId} onChange={e => setNewOwnerId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold">
                    <option value="">Select a member</option>
                    {groupMembers.map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.email})</option>)}
                  </select>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl"><Loader2 size={16} className="animate-spin text-purple-600" /><span className="text-sm text-slate-600 font-medium">Loading members...</span></div>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={handleTransferOwnership} disabled={saving || !newOwnerId} className="flex-1 py-4 bg-purple-500 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-purple-600 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <><Loader2 size={18} className="animate-spin" />Transferring...</> : <><UserCheck size={18} />Transfer Ownership</>}
                </button>
                <button onClick={() => { setTransferringGroup(null); setNewOwnerId(''); setGroupMembers([]); }} className="px-6 py-4 bg-slate-100 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Chat Logs Modal ── */}
      {viewingChatLogs && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-teal-500 to-blue-500 p-8 text-white flex justify-between items-center">
              <div><h3 className="text-2xl font-black">Chat Logs</h3><p className="text-teal-100 text-sm font-bold mt-1">{viewingChatLogs.name}</p></div>
              <button onClick={() => { setViewingChatLogs(null); setChatLogs([]); }} className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-all"><X size={24} /></button>
            </div>
            <div className="p-8">
              <div className="bg-slate-50 rounded-xl border-2 border-slate-200 p-6 max-h-[500px] overflow-y-auto">
                {loadingLogs ? (
                  <div className="flex flex-col items-center justify-center py-12"><Loader2 size={32} className="animate-spin text-teal-600 mb-4" /><p className="text-slate-600 font-bold">Loading chat logs...</p></div>
                ) : !Array.isArray(chatLogs) || chatLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12"><MessageSquare className="w-16 h-16 text-slate-300 mb-4" /><p className="text-slate-600 font-bold">No messages yet</p></div>
                ) : (
                  <div className="space-y-4">
                    {chatLogs.map((msg: any, i: number) => (
                      <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-blue-500 text-white rounded-lg flex items-center justify-center font-bold text-sm">{msg.user?.name?.[0] || 'U'}</div>
                            <div><p className="font-bold text-slate-900">{msg.user?.name || 'Unknown'}</p><p className="text-xs text-slate-500">{msg.user?.email}</p></div>
                          </div>
                          <span className="text-xs text-slate-400 font-medium">{new Date(msg.created_at).toLocaleString()}</span>
                        </div>
                        {msg.content && <p className="text-slate-700 font-medium">{msg.content}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => { setViewingChatLogs(null); setChatLogs([]); }} className="w-full mt-6 py-4 bg-slate-100 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Group Meetings Modal ── */}
      {viewingGroupMeetings && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-8 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-2xl font-black">Meetings</h3>
                <p className="text-indigo-100 text-sm font-bold mt-1">{viewingGroupMeetings.name}</p>
              </div>
              <button onClick={() => { setViewingGroupMeetings(null); setGroupMeetingsUpcoming([]); setGroupMeetingsPast([]); }} className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-all"><X size={24} /></button>
            </div>
            <div className="p-8 overflow-y-auto flex-1 space-y-8">
              {loadingMeetings ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 size={36} className="animate-spin text-indigo-500 mb-4" />
                  <p className="text-slate-600 font-bold">Loading meetings...</p>
                </div>
              ) : (groupMeetingsUpcoming.length === 0 && groupMeetingsPast.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Calendar className="w-16 h-16 text-slate-300 mb-4" />
                  <p className="text-slate-600 font-bold">No meetings for this group</p>
                </div>
              ) : (
                <>
                  {/* Upcoming */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full"></div>
                      <h4 className="text-base font-black text-slate-900">Upcoming</h4>
                      <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-black">{groupMeetingsUpcoming.length}</span>
                    </div>
                    {groupMeetingsUpcoming.length === 0 ? (
                      <p className="text-sm text-slate-400 font-medium italic pl-5">No upcoming meetings</p>
                    ) : (
                      <div className="space-y-3">
                        {groupMeetingsUpcoming.map(ev => (
                          <MeetingCard key={ev.id} event={ev} isPast={false} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Past */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-2.5 h-2.5 bg-slate-400 rounded-full"></div>
                      <h4 className="text-base font-black text-slate-900">Past</h4>
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-black">{groupMeetingsPast.length}</span>
                    </div>
                    {groupMeetingsPast.length === 0 ? (
                      <p className="text-sm text-slate-400 font-medium italic pl-5">No past meetings</p>
                    ) : (
                      <div className="space-y-3">
                        {groupMeetingsPast.map(ev => (
                          <MeetingCard key={ev.id} event={ev} isPast={true} />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Event Modal ── */}
      {editingEvent && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-purple-600 p-6 text-white flex justify-between items-center sticky top-0">
              <h3 className="text-xl font-black">Edit Meeting</h3>
              <button onClick={() => setEditingEvent(null)} className="hover:bg-purple-700 rounded-lg p-1 transition-all"><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdateEvent} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Title</label>
                <input type="text" required value={editingEvent.title} onChange={e => setEditingEvent({...editingEvent, title: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-purple-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Type</label>
                <select value={editingEvent.type} onChange={e => setEditingEvent({...editingEvent, type: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-purple-500">
                  <option>General</option><option>Project</option><option>Group Meeting</option><option>Exam</option><option>Assignment</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Date & Time</label>
                <input type="datetime-local" required value={editingEvent.start_time.slice(0, 16)} onChange={e => setEditingEvent({...editingEvent, start_time: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-purple-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Location (optional)</label>
                <input type="text" value={editingEvent.location || ''} onChange={e => setEditingEvent({...editingEvent, location: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-purple-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Recurrence</label>
                <select value={editingEvent.recurrence} onChange={e => setEditingEvent({...editingEvent, recurrence: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-purple-500">
                  <option value="none">One-time</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
                </select>
              </div>
              {editingEvent.recurrence !== 'none' && (
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Recurrence Count</label>
                  <input type="number" min="1" max="365" value={editingEvent.recurrence_count || ''} onChange={e => setEditingEvent({...editingEvent, recurrence_count: parseInt(e.target.value) || null})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-purple-500" />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingEvent(null)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">Cancel</button>
                <button type="submit" disabled={evSaving} className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {evSaving ? <><Loader2 size={16} className="animate-spin" />Saving...</> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminGroups;
