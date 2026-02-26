
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Users, MapPin, Sparkles, Loader2, X, AlertCircle, Search, Eraser, Filter, ChevronDown, Lock, Archive, Unlock, TrendingUp, Flame, ChevronLeft, ChevronRight, Pencil, Crown, Clock } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { StudyGroup, User, GroupStatus } from '../types';
import { geminiService } from '../services/geminiService';
import { apiService } from '../services/apiService';
import GroupDetailModal from './GroupDetailModal';
import StarRating from './StarRating';
import { containsBadWords } from '../utils/badWords';
import { API_CONFIG } from '../constants';

const HomePage: React.FC = () => {
  // All groups state
  const [groups, setGroups] = useState<StudyGroup[]>([]);

  // Discover data state
  const [trendingGroups, setTrendingGroups] = useState<StudyGroup[]>([]);
  const [searchedUsers, setSearchedUsers] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [facultyFilter, setFacultyFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [contentFilter, setContentFilter] = useState<'all' | 'groups' | 'users'>('all');
  const [sortBy, setSortBy] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [leaderFilter, setLeaderFilter] = useState('');

  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const isFullSearchMode = searchParams.get('searchMode') === 'full';

  const [currentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [newGroup, setNewGroup] = useState({
    subject: '',
    goal: '',
    description: '',
    max_members: 5,
    location: '',
    faculty: '',
    status: 'open'
  });

  // Edit group state
  const [editingGroup, setEditingGroup] = useState<StudyGroup | null>(null);
  const [editGroupData, setEditGroupData] = useState({
    name: '',
    subject: '',
    description: '',
    status: 'open',
    max_members: 5,
    location: '',
    faculty: ''
  });
  const [editSaving, setEditSaving] = useState(false);

  // Leader request state
  const [showLeaderRequestModal, setShowLeaderRequestModal] = useState(false);
  const [leaderRequestReason, setLeaderRequestReason] = useState('');
  const [leaderRequestStatus, setLeaderRequestStatus] = useState<{status: string; reason?: string; admin_note?: string} | null>(null);
  const [submittingLeaderRequest, setSubmittingLeaderRequest] = useState(false);

  // Group detail modal state
  const [selectedGroupForDetail, setSelectedGroupForDetail] = useState<StudyGroup | null>(null);

  // Scroll refs for horizontal sections
  const joinedScrollRef = useRef<HTMLDivElement>(null);
  const createdScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAllData();
    if (currentUser?.role === 'member') {
      fetchLeaderRequestStatus();
    }
    // Sync role from server in case it was updated (e.g. leader request approved)
    syncUserRole();
  }, []);

  useEffect(() => {
    // Fetch users when there's a search query (min 2 chars)
    const fetchUsers = async () => {
      if (searchQuery && searchQuery.length >= 2) {
        try {
          const users = await apiService.searchUsers(searchQuery);
          setSearchedUsers(Array.isArray(users) ? users : []);
        } catch (err: any) {
          console.error('Failed to search users:', err?.message || err);
          setSearchedUsers([]);
        }
      } else {
        setSearchedUsers([]);
      }
    };
    fetchUsers();
  }, [searchQuery]);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [allGroups, trending] = await Promise.all([
        apiService.getGroups(),
        apiService.getTrendingGroups()
      ]);
      setGroups(allGroups);
      setTrendingGroups(trending);
    } catch (err: any) {
      console.error("Failed to load data:", err);
      setError("Could not connect to the campus server. Make sure your backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const syncUserRole = async () => {
    try {
      const profile = await apiService.getProfile();
      const userStr = localStorage.getItem('auth_user');
      if (userStr && profile?.role) {
        const user = JSON.parse(userStr);
        if (user.role !== profile.role) {
          user.role = profile.role;
          localStorage.setItem('auth_user', JSON.stringify(user));
          window.location.reload();
        }
      }
    } catch {}
  };

  const fetchLeaderRequestStatus = async () => {
    try {
      const userStr = localStorage.getItem('auth_user');
      const token = userStr ? JSON.parse(userStr).token : null;
      if (!token) return;
      const res = await fetch(`${API_CONFIG.BASE_URL}/leader-requests/my-status`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        setLeaderRequestStatus(data);
      }
    } catch {}
  };

  const handleLeaderRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingLeaderRequest(true);
    try {
      const userStr = localStorage.getItem('auth_user');
      const token = userStr ? JSON.parse(userStr).token : null;
      const res = await fetch(`${API_CONFIG.BASE_URL}/leader-requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ reason: leaderRequestReason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit request');
      setLeaderRequestStatus(data.request);
      setShowLeaderRequestModal(false);
      setLeaderRequestReason('');
      alert('Leader request submitted! You will be notified once the admin reviews it.');
    } catch (err: any) {
      alert(err.message || 'Failed to submit request');
    } finally {
      setSubmittingLeaderRequest(false);
    }
  };

  const faculties = useMemo(() => Array.from(new Set(groups.map(g => g.faculty))).sort(), [groups]);
  const subjects = useMemo(() => Array.from(new Set(groups.map(g => g.subject))).sort(), [groups]);
  const locations = useMemo(() => Array.from(new Set(groups.map(g => g.location))).sort(), [groups]);
  const leaders = useMemo(() => Array.from(new Set(groups.map(g => g.creator_name))).sort(), [groups]);

  // Separate groups by user relationship (excluding archived)
  const joinedGroups = useMemo(() =>
    groups.filter(g => g.is_member && g.creator_id !== currentUser?.id && g.status !== GroupStatus.ARCHIVED),
    [groups, currentUser]
  );

  const createdGroups = useMemo(() =>
    groups.filter(g => g.creator_id === currentUser?.id && g.status !== GroupStatus.ARCHIVED),
    [groups, currentUser]
  );

  // Recent groups - always show 5 most recently created groups (not affected by search/filters)
  const recentGroups = useMemo(() =>
    groups
      .filter(g => g.status !== GroupStatus.ARCHIVED)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5),
    [groups]
  );

  const filteredGroups = useMemo(() => {
    const results = groups.filter(g => {
      // Exclude archived groups from main view
      if (g.status === GroupStatus.ARCHIVED) return false;

      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || (
        g.name.toLowerCase().includes(q) ||
        g.subject.toLowerCase().includes(q) ||
        g.faculty.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.creator_name.toLowerCase().includes(q) ||
        g.location.toLowerCase().includes(q)
      );

      const matchesFaculty = !facultyFilter || g.faculty === facultyFilter;
      const matchesSubject = !subjectFilter || g.subject === subjectFilter;
      const matchesLocation = !locationFilter || g.location === locationFilter;
      const matchesStatus = !statusFilter || g.status === statusFilter;

      // Date filter: filter by creation date
      let matchesDate = true;
      if (dateFilter) {
        const now = new Date();
        const createdDate = new Date(g.created_at);
        const daysDiff = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

        if (dateFilter === '7days') matchesDate = daysDiff <= 7;
        else if (dateFilter === '30days') matchesDate = daysDiff <= 30;
        else if (dateFilter === '90days') matchesDate = daysDiff <= 90;
      }

      // Leader filter: filter by group creator
      const matchesLeader = !leaderFilter || g.creator_name === leaderFilter;

      return matchesSearch && matchesFaculty && matchesSubject && matchesLocation && matchesStatus && matchesDate && matchesLeader;
    });

    // Sort results
    if (sortBy === 'most_rated') {
      return results.sort((a, b) => (b.total_ratings || 0) - (a.total_ratings || 0));
    }
    if (sortBy === 'most_popular') {
      return results.sort((a, b) => (b.members_count || 0) - (a.members_count || 0));
    }

    // Default: sort by creation date (most recent first); when filters active, sort by members count
    const hasActiveFilters = searchQuery || facultyFilter || subjectFilter || locationFilter || statusFilter || dateFilter || leaderFilter;
    return results.sort((a, b) => {
      if (hasActiveFilters && b.members_count !== a.members_count) {
        return b.members_count - a.members_count;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [groups, searchQuery, facultyFilter, subjectFilter, locationFilter, statusFilter, sortBy, dateFilter, leaderFilter]);

  const handleJoinLeave = async (id: string, currentlyMember: boolean, hasPendingRequest: boolean, groupStatus: GroupStatus) => {
    try {
      if (currentlyMember) {
        await apiService.leaveGroup(id);
        alert('You have left the group.');
      } else if (hasPendingRequest) {
        // User clicked again while request is pending - show status
        alert('Your join request is pending. The leader will review it soon!');
        return;
      } else {
        const response = await apiService.joinGroup(id);
        // Show different message based on group status
        if (groupStatus === GroupStatus.OPEN) {
          alert('Successfully joined the group!');
        } else {
          alert('Join request sent! You will be notified when the leader reviews your request.');
        }
      }
      await loadAllData();
    } catch (err: any) {
      alert(err.message || "Action failed.");
    }
  };

  // Handler for group detail modal actions
  const handleJoinFromModal = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) throw new Error('Group not found');

    const response = await apiService.joinGroup(groupId);
    if (group.status === GroupStatus.OPEN) {
      alert('Successfully joined the group!');
    } else {
      alert('Join request sent! You will be notified when the leader reviews your request.');
    }
  };

  const handleLeaveFromModal = async (groupId: string) => {
    await apiService.leaveGroup(groupId);
    alert('You have left the group.');
  };

  const handleDeleteFromModal = async (groupId: string) => {
    await apiService.deleteGroup(groupId);
    alert('Group deleted successfully.');
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

  const handleAIDescription = async () => {
    if (!newGroup.subject || !newGroup.goal) {
      alert("Please fill in the Subject and Goal first!");
      return;
    }
    setIsGenerating(true);
    const desc = await geminiService.generateGroupDescription(newGroup.subject, newGroup.goal);
    setNewGroup(prev => ({ ...prev, description: desc || '' }));
    setIsGenerating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fieldsToCheck = [newGroup.subject, newGroup.faculty, newGroup.goal, newGroup.description, newGroup.location];
    if (fieldsToCheck.some(f => containsBadWords(f))) {
      alert('Your group content contains inappropriate language. Please revise and try again.');
      return;
    }
    try {
      await apiService.createGroup({
        name: newGroup.subject,
        ...newGroup
      });
      setIsModalOpen(false);
      loadAllData();
      setNewGroup({ subject: '', goal: '', description: '', max_members: 5, location: '', faculty: '', status: 'open' });
    } catch (err: any) {
      alert("Failed to create group: " + err.message);
    }
  };

  const clearAllFilters = () => {
    setSearchParams({});
    setFacultyFilter('');
    setSubjectFilter('');
    setLocationFilter('');
    setStatusFilter('');
    setContentFilter('all');
    setSortBy('');
    setDateFilter('');
    setLeaderFilter('');
  };

  const openEditModal = (group: StudyGroup) => {
    setEditingGroup(group);
    setEditGroupData({
      name: group.name,
      subject: group.subject,
      description: group.description,
      max_members: group.max_members,
      location: group.location,
      faculty: group.faculty,
      status: group.status || 'open'
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;
    setEditSaving(true);
    try {
      await apiService.updateGroup(editingGroup.id, editGroupData);
      setEditingGroup(null);
      loadAllData();
    } catch (err: any) {
      alert("Failed to update group: " + err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const scroll = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = 400;
      ref.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const activeFilterCount = [
    facultyFilter,
    subjectFilter,
    locationFilter,
    statusFilter,
    searchQuery,
    contentFilter !== 'all' ? 'content' : '',
    sortBy,
    dateFilter,
    leaderFilter
  ].filter(Boolean).length;

  // Render horizontal group card (for joined/created sections)
  const renderCompactGroupCard = (group: StudyGroup) => {
    const isCreator = group.creator_id === currentUser?.id;

    return (
      <div
        key={group.id}
        className="flex-shrink-0 w-[min(22rem,calc(100vw-2rem))] bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-orange-200 transition-all"
      >
        <div className="flex items-center gap-3 mb-4">
          <Link
            to={`/profile/${group.creator_id}`}
            className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center font-bold text-sm border border-orange-200 cursor-pointer hover:scale-105 transition-transform"
          >
            {group.creator_name[0]}
          </Link>
          <div className="flex-1 min-w-0">
            <button
              onClick={() => setSelectedGroupForDetail(group)}
              className="block group/title text-left w-full"
            >
              <h3 className="font-bold text-slate-900 line-clamp-2 group-hover/title:text-orange-500 transition-colors cursor-pointer">{group.name}</h3>
            </button>
            <p className="text-xs font-semibold text-slate-400">{group.subject}</p>
            <p className="text-[10px] font-semibold text-slate-500">Led by {group.creator_name}</p>
            {(group.total_ratings ?? 0) > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <StarRating
                  value={
                    group.avg_group_rating !== undefined && group.avg_leader_rating !== undefined
                      ? (group.avg_group_rating + group.avg_leader_rating) / 2
                      : group.avg_group_rating || 0
                  }
                  readonly
                  size="sm"
                />
                <span className="text-[10px] text-slate-400 font-bold">
                  {group.avg_group_rating !== undefined && group.avg_leader_rating !== undefined
                    ? `(${((group.avg_group_rating + group.avg_leader_rating) / 2).toFixed(1)} • ${group.total_ratings})`
                    : `(${group.total_ratings})`
                  }
                </span>
              </div>
            )}
          </div>
          {getStatusBadge(group.status)}
        </div>
        <p className="text-sm text-slate-500 line-clamp-2 mb-4">{group.description}</p>
        <div className="flex items-center justify-between text-xs mb-4">
          <span className="flex items-center gap-1 text-slate-400 font-semibold">
            <Users size={14} />
            {group.members_count}/{group.max_members}
          </span>
          <span className="flex items-center gap-1 text-slate-400 font-semibold">
            <MapPin size={14} />
            {group.location}
          </span>
        </div>

        {/* Edit Button - Only show for creator */}
        {isCreator && (
          <button
            onClick={() => openEditModal(group)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-orange-50 border-2 border-orange-200 text-orange-600 hover:bg-orange-100"
          >
            <Pencil size={14} />
            Edit Group
          </button>
        )}

        {/* Leave Button - Only show if not the creator */}
        {!isCreator && (
          <button
            onClick={() => handleJoinLeave(group.id, true, false, group.status)}
            className="w-full px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-white border-2 border-red-100 text-red-500 hover:bg-red-50"
          >
            Leave Group
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {isFullSearchMode ? 'Search Results' : 'StudyHub'}
          </h1>
          <p className="text-slate-500 font-medium">
            {searchQuery
              ? `Showing results for "${searchQuery}"`
              : "Your complete study companion"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isFullSearchMode && (
            <button
              onClick={() => {
                const { searchMode, ...rest } = Object.fromEntries(searchParams.entries());
                setSearchParams(rest);
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold transition-all bg-slate-100 text-slate-600 hover:bg-slate-200"
            >
              <X size={18} />
              <span>Exit Search</span>
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold transition-all border ${
              activeFilterCount > 0 || showFilters
                ? 'bg-orange-50 border-orange-200 text-orange-600 shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter size={18} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 w-5 h-5 bg-orange-500 text-white rounded-full flex items-center justify-center text-[10px] font-black">
                {activeFilterCount}
              </span>
            )}
          </button>
          {currentUser?.role === 'member' ? (
            leaderRequestStatus?.status === 'pending' ? (
              <button
                disabled
                className="flex items-center justify-center gap-2 bg-amber-100 text-amber-600 border-2 border-amber-200 px-6 py-3 rounded-2xl font-bold cursor-not-allowed"
                title="Your leader request is pending admin review"
              >
                <Clock size={20} />
                <span>Request Pending</span>
              </button>
            ) : leaderRequestStatus?.status === 'rejected' ? (
              <button
                onClick={() => setShowLeaderRequestModal(true)}
                className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold transition-all"
                title={leaderRequestStatus.admin_note ? `Rejected: ${leaderRequestStatus.admin_note}` : 'Previous request was rejected'}
              >
                <Crown size={20} />
                <span>Re-request Leader</span>
              </button>
            ) : (
              <button
                onClick={() => setShowLeaderRequestModal(true)}
                className="flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-purple-200 transition-all hover:-translate-y-0.5"
              >
                <Crown size={20} />
                <span>Request Leader Role</span>
              </button>
            )
          ) : (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-orange-200 transition-all hover:-translate-y-0.5"
            >
              <Plus size={20} />
              <span>Create Group</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-xl shadow-slate-200/50 space-y-6 animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Content Type</label>
              <div className="relative">
                <select
                  className="w-full appearance-none px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-orange-500 transition-all cursor-pointer pr-10"
                  value={contentFilter}
                  onChange={e => setContentFilter(e.target.value as 'all' | 'groups' | 'users')}
                >
                  <option value="all">All</option>
                  <option value="groups">Groups Only</option>
                  <option value="users">Users Only</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Faculty</label>
              <div className="relative">
                <select
                  className="w-full appearance-none px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-orange-500 transition-all cursor-pointer pr-10"
                  value={facultyFilter}
                  onChange={e => setFacultyFilter(e.target.value)}
                >
                  <option value="">All Faculties</option>
                  {faculties.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Subject</label>
              <div className="relative">
                <select
                  className="w-full appearance-none px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-orange-500 transition-all cursor-pointer pr-10"
                  value={subjectFilter}
                  onChange={e => setSubjectFilter(e.target.value)}
                >
                  <option value="">All Subjects</option>
                  {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Location</label>
              <div className="relative">
                <select
                  className="w-full appearance-none px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-orange-500 transition-all cursor-pointer pr-10"
                  value={locationFilter}
                  onChange={e => setLocationFilter(e.target.value)}
                >
                  <option value="">Any Location</option>
                  {locations.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Status</label>
              <div className="relative">
                <select
                  className="w-full appearance-none px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-orange-500 transition-all cursor-pointer pr-10"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value={GroupStatus.OPEN}>Open</option>
                  <option value={GroupStatus.CLOSED}>Closed</option>
                  <option value={GroupStatus.ARCHIVED}>Archived</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Sort By</label>
              <div className="relative">
                <select
                  className="w-full appearance-none px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-orange-500 transition-all cursor-pointer pr-10"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                >
                  <option value="">Default</option>
                  <option value="most_rated">Most Rated</option>
                  <option value="most_popular">Most Popular</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Created</label>
              <div className="relative">
                <select
                  className="w-full appearance-none px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-orange-500 transition-all cursor-pointer pr-10"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                >
                  <option value="">All Time</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="90days">Last 90 Days</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Leader</label>
              <div className="relative">
                <select
                  className="w-full appearance-none px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-orange-500 transition-all cursor-pointer pr-10"
                  value={leaderFilter}
                  onChange={e => setLeaderFilter(e.target.value)}
                >
                  <option value="">All Leaders</option>
                  {leaders.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={clearAllFilters}
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-orange-500 transition-colors flex items-center gap-1.5"
            >
              <Eraser size={14} />
              Reset All Filters
            </button>
            <button
              onClick={() => {
                const currentParams = Object.fromEntries(searchParams.entries());
                setSearchParams({ ...currentParams, searchMode: 'full' });
                setShowFilters(false);
              }}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-orange-200 transition-all flex items-center gap-2"
            >
              <Search size={14} />
              Search
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-[2rem] flex items-start gap-4 text-amber-800">
          <AlertCircle className="shrink-0 mt-1" size={20} />
          <div>
            <p className="font-bold">Connection Issue</p>
            <p className="text-sm opacity-80">{error}</p>
            <button onClick={loadAllData} className="mt-3 text-xs font-black uppercase tracking-widest underline decoration-2 underline-offset-4">Retry Connection</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 size={48} className="animate-spin text-orange-500" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Syncing with AU Servers...</p>
        </div>
      ) : (
        <>
          {/* Hide all sections except search results when in full search mode */}
          {!isFullSearchMode && (
            <>
              {/* Joined Groups Section */}
              {joinedGroups.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="text-orange-500" size={24} />
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">My Joined Groups</h2>
                    <p className="text-sm text-slate-500">Groups you're participating in</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => scroll(joinedScrollRef, 'left')}
                    className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
                  >
                    <ChevronLeft size={20} className="text-slate-600" />
                  </button>
                  <button
                    onClick={() => scroll(joinedScrollRef, 'right')}
                    className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
                  >
                    <ChevronRight size={20} className="text-slate-600" />
                  </button>
                </div>
              </div>
              <div
                ref={joinedScrollRef}
                className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {joinedGroups.map(renderCompactGroupCard)}
              </div>
            </div>
          )}

          {/* Created Groups Section */}
          {createdGroups.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="text-orange-500" size={24} />
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">My Created Groups</h2>
                    <p className="text-sm text-slate-500">Groups you've organized</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => scroll(createdScrollRef, 'left')}
                    className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
                  >
                    <ChevronLeft size={20} className="text-slate-600" />
                  </button>
                  <button
                    onClick={() => scroll(createdScrollRef, 'right')}
                    className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
                  >
                    <ChevronRight size={20} className="text-slate-600" />
                  </button>
                </div>
              </div>
              <div
                ref={createdScrollRef}
                className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {createdGroups.map(renderCompactGroupCard)}
              </div>
            </div>
          )}

          {/* Trending Groups Section */}
          {trendingGroups.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Flame className="text-orange-500" size={24} />
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Trending Groups</h2>
                  <p className="text-sm text-slate-500">Most popular study groups right now</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trendingGroups.slice(0, 6).map((group, idx) => {
                  const isFull = group.members_count >= group.max_members;
                  const isClosed = group.status === GroupStatus.CLOSED;
                  const isArchived = group.status === GroupStatus.ARCHIVED;
                  const canJoin = !group.is_member && !group.has_pending_request && !isFull && !isArchived;

                  return (
                    <div
                      key={group.id}
                      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full -mr-12 -mt-12 transition-all group-hover:bg-orange-500/10"></div>
                      <div className="flex justify-between items-start mb-4 relative">
                        <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center font-bold">
                          #{idx + 1}
                        </div>
                        {getStatusBadge(group.status)}
                      </div>
                      <button
                        onClick={() => setSelectedGroupForDetail(group)}
                        className="block group/title text-left w-full"
                      >
                        <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover/title:text-orange-500 transition-colors cursor-pointer">{group.name}</h3>
                      </button>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{group.subject}</p>
                      <p className="text-xs font-semibold text-slate-500 mb-3">Led by {group.creator_name}</p>
                      {(group.total_ratings ?? 0) > 0 && (
                        <div className="flex items-center gap-2 mb-3">
                          <StarRating value={group.avg_group_rating || 0} readonly size="sm" />
                          <span className="text-[10px] text-slate-400 font-bold">({group.total_ratings})</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-4">
                        <Users size={14} className="text-slate-300" />
                        <span className="text-xs font-bold text-slate-500">{group.members_count} students enrolled</span>
                      </div>

                      {/* Join/Leave Button */}
                      <button
                        onClick={() => handleJoinLeave(group.id, !!group.is_member, !!group.has_pending_request, group.status)}
                        disabled={(!canJoin && !group.is_member && !group.has_pending_request)}
                        className={`w-full px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                          group.is_member
                            ? 'bg-white border-2 border-red-100 text-red-500 hover:bg-red-50'
                            : group.has_pending_request
                              ? 'bg-amber-50 border-2 border-amber-200 text-amber-600 cursor-default'
                            : isArchived ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : isClosed ? 'bg-amber-500 text-white hover:bg-amber-600'
                            : 'bg-orange-500 text-white hover:bg-orange-600'
                        } disabled:opacity-80`}
                      >
                        {group.is_member
                          ? 'Leave Group'
                          : group.has_pending_request
                            ? 'Request Pending...'
                          : isArchived
                            ? 'Hub Archived'
                          : isClosed
                            ? 'Request to Join'
                          : isFull
                            ? 'Hub Full'
                          : 'Join Group'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

            </>
          )}

          {/* All Groups & Users Section - Always shown in search mode */}
          <div className="space-y-4" data-section="all-groups">
            <div className="flex items-center gap-3">
              <TrendingUp className="text-orange-500" size={24} />
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {isFullSearchMode ? `Search Results (${filteredGroups.length})` : 'Recent Groups'}
                  {subjectFilter && !isFullSearchMode && (
                    <span className="ml-2 text-sm font-normal text-orange-500">
                      (Filtered by: {subjectFilter})
                    </span>
                  )}
                </h2>
                <p className="text-sm text-slate-500">
                  {isFullSearchMode
                    ? `Groups and users matching "${searchQuery}"`
                    : 'Recently created study groups'}
                </p>
              </div>
            </div>

            {/* User Results Section */}
            {searchQuery && searchedUsers.length > 0 && (contentFilter === 'all' || contentFilter === 'users') && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Users className="text-orange-500" size={24} />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Users ({searchedUsers.length})</h3>
                    <p className="text-sm text-slate-500">Found users matching "{searchQuery}"</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {searchedUsers.map(user => (
                    <Link
                      key={user.id}
                      to={`/profile/${user.id}`}
                      className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-orange-200 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center font-black text-xl border border-orange-200/50 group-hover:scale-105 transition-transform">
                          {user.avatar || user.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 truncate group-hover:text-orange-500 transition-colors">{user.name}</h4>
                          <p className="text-xs font-semibold text-slate-400">{user.major || 'Student'}</p>
                        </div>
                      </div>
                      {user.bio && (
                        <p className="text-sm text-slate-500 line-clamp-2 mb-3">{user.bio}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-slate-400 font-semibold">
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          {user.location || 'Location not set'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Groups Results */}
            {(contentFilter === 'all' || contentFilter === 'groups') && (
              <div className="grid gap-6">
                {(isFullSearchMode ? filteredGroups.length === 0 : recentGroups.length === 0) && !error && (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] p-16 text-center">
                  {isFullSearchMode ? (
                    <>
                      <Search size={48} className="mx-auto mb-4 text-slate-200" />
                      <p className="font-bold text-slate-400 mb-4">No groups match your current criteria.</p>
                      <button
                        onClick={clearAllFilters}
                        className="flex items-center gap-2 mx-auto bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-3 rounded-xl font-bold transition-all"
                      >
                        <Eraser size={18} />
                        Reset Search & Filters
                      </button>
                    </>
                  ) : (
                    <>
                      <Users size={48} className="mx-auto mb-4 text-slate-200" />
                      <p className="font-bold text-slate-400">No active groups right now.</p>
                      <button onClick={() => setIsModalOpen(true)} className="mt-4 text-orange-500 font-black text-xs uppercase tracking-widest">Start the first one</button>
                    </>
                  )}
                </div>
              )}

                {(isFullSearchMode ? filteredGroups : recentGroups).map(group => {
                const isFull = group.members_count >= group.max_members;
                const isClosed = group.status === GroupStatus.CLOSED;
                const isArchived = group.status === GroupStatus.ARCHIVED;
                const canJoin = !group.is_member && !group.has_pending_request && !isFull && !isArchived;

                return (
                  <div key={group.id} className={`bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl hover:shadow-slate-100 transition-all group relative overflow-hidden ${isArchived ? 'opacity-75 grayscale-[0.5]' : ''}`}>
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <Link
                          to={`/profile/${group.creator_id}`}
                          className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center font-black text-xl border border-orange-200/50 cursor-pointer hover:scale-105 transition-transform"
                        >
                          {group.creator_name ? group.creator_name[0] : 'U'}
                        </Link>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/profile/${group.creator_id}`}
                              className="font-bold text-slate-900 text-lg leading-tight hover:text-orange-500 transition-colors cursor-pointer"
                            >
                              {group.creator_name}
                            </Link>
                            {getStatusBadge(group.status)}
                          </div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{new Date(group.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      </div>
                      <div className="px-4 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {group.subject}
                      </div>
                    </div>

                    <div className="mb-8">
                      <button
                        onClick={() => setSelectedGroupForDetail(group)}
                        className="block group/title inline-block text-left"
                      >
                        <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight group-hover/title:text-orange-500 transition-colors cursor-pointer">{group.name}</h2>
                      </button>
                      <p className="text-slate-500 leading-relaxed font-medium line-clamp-2">{group.description}</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6 p-6 bg-slate-50/50 rounded-3xl border border-slate-100/50 mb-8">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Users size={12}/> Capacity</p>
                        <p className={`text-sm font-bold ${isFull ? 'text-amber-600' : 'text-slate-700'}`}>{group.members_count} / {group.max_members}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><MapPin size={12}/> Location</p>
                        <p className="text-sm font-bold text-slate-700 truncate">{group.location}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">Faculty</p>
                        <p className="text-sm font-bold text-slate-700 truncate">{group.faculty}</p>
                      </div>
                      {(group.total_ratings ?? 0) > 0 && (
                        <>
                          <div className="space-y-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Group Rating</p>
                            <div className="flex items-center gap-2">
                              <StarRating value={group.avg_group_rating || 0} readonly size="sm" />
                              <span className="text-xs font-bold text-slate-500">({group.avg_group_rating?.toFixed(1)})</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Leader Rating</p>
                            <div className="flex items-center gap-2">
                              <StarRating value={group.avg_leader_rating || 0} readonly size="sm" />
                              <span className="text-xs font-bold text-slate-500">({group.avg_leader_rating?.toFixed(1)})</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Ratings</p>
                            <p className="text-sm font-bold text-slate-700">{group.total_ratings} rating{group.total_ratings !== 1 ? 's' : ''}</p>
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      onClick={() => handleJoinLeave(group.id, !!group.is_member, !!group.has_pending_request, group.status)}
                      disabled={(!canJoin && !group.is_member && !group.has_pending_request)}
                      className={`px-10 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                        group.is_member
                          ? 'bg-white border-2 border-red-100 text-red-500 hover:bg-red-50'
                          : group.has_pending_request
                            ? 'bg-amber-50 border-2 border-amber-200 text-amber-600'
                          : isArchived ? 'bg-slate-200 text-slate-400'
                          : isClosed ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-xl shadow-amber-100'
                          : 'bg-orange-500 text-white hover:bg-orange-600 shadow-xl shadow-orange-100'
                      } disabled:opacity-80`}
                    >
                      {group.is_member
                        ? 'Leave Group'
                        : group.has_pending_request
                          ? 'Request Pending...'
                        : isArchived
                          ? 'Hub Archived'
                        : isClosed
                          ? 'Request to Join'
                        : isFull
                          ? 'Hub Full'
                        : 'Join Group'}
                    </button>
                  </div>
                );
                })}
              </div>
            )}
          </div>

        </>
      )}

      {/* Create Group Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-orange-500 p-10 flex justify-between items-center text-white">
              <div>
                <h3 className="text-3xl font-black tracking-tight">New Group</h3>
                <p className="text-orange-100 text-sm font-bold mt-1">Create a new study group</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Subject Area</label>
                  <input
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none text-sm font-bold"
                    placeholder="e.g. Physics"
                    value={newGroup.subject}
                    onChange={e => setNewGroup({...newGroup, subject: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Faculty</label>
                  <input
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none text-sm font-bold"
                    placeholder="e.g. Science"
                    value={newGroup.faculty}
                    onChange={e => setNewGroup({...newGroup, faculty: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Main Goal</label>
                <div className="relative">
                  <input
                    className="w-full pl-6 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none text-sm font-bold"
                    placeholder="What are you studying for?"
                    value={newGroup.goal}
                    onChange={e => setNewGroup({...newGroup, goal: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={handleAIDescription}
                    disabled={isGenerating}
                    className="absolute right-3 top-2 w-10 h-10 bg-orange-100 text-orange-600 rounded-xl hover:bg-orange-200 transition-all flex items-center justify-center disabled:opacity-50"
                  >
                    {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">About the group</label>
                <textarea
                  required
                  rows={3}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none text-sm font-bold resize-none"
                  placeholder="Share details about materials..."
                  value={newGroup.description}
                  onChange={e => setNewGroup({...newGroup, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Max Students</label>
                  <input
                    type="number"
                    min={2}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none text-sm font-bold"
                    value={newGroup.max_members}
                    onChange={e => setNewGroup({...newGroup, max_members: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Default Meeting Location</label>
                  <input
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none text-sm font-bold"
                    placeholder="e.g. Library"
                    value={newGroup.location}
                    onChange={e => setNewGroup({...newGroup, location: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Group Status</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['open', 'closed'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setNewGroup({...newGroup, status: s})}
                      className={`py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border-2 ${
                        newGroup.status === s
                          ? s === 'open'
                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100'
                            : 'bg-slate-700 border-slate-700 text-white shadow-lg shadow-slate-100'
                          : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {s === 'open' ? 'Open' : 'Closed'}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 ml-2">
                  {newGroup.status === 'open' ? 'Anyone can join immediately' : 'Members must request to join'}
                </p>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-8 py-4 border-2 border-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-8 py-4 bg-orange-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-600 shadow-xl shadow-orange-100 transition-all active:scale-95"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {editingGroup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-800 p-10 flex justify-between items-center text-white">
              <div>
                <h3 className="text-3xl font-black tracking-tight">Edit Group</h3>
                <p className="text-slate-300 text-sm font-bold mt-1">Modify your study group details</p>
              </div>
              <button onClick={() => setEditingGroup(null)} className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Group Name</label>
                <input
                  required
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none text-sm font-bold"
                  value={editGroupData.name}
                  onChange={e => setEditGroupData({...editGroupData, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Subject Area</label>
                  <input
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none text-sm font-bold"
                    value={editGroupData.subject}
                    onChange={e => setEditGroupData({...editGroupData, subject: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Faculty</label>
                  <input
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none text-sm font-bold"
                    value={editGroupData.faculty}
                    onChange={e => setEditGroupData({...editGroupData, faculty: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Description</label>
                <textarea
                  required
                  rows={3}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none text-sm font-bold resize-none"
                  value={editGroupData.description}
                  onChange={e => setEditGroupData({...editGroupData, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Max Students</label>
                  <input
                    type="number"
                    min={2}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none text-sm font-bold"
                    value={editGroupData.max_members}
                    onChange={e => setEditGroupData({...editGroupData, max_members: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Location</label>
                  <input
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none text-sm font-bold"
                    value={editGroupData.location}
                    onChange={e => setEditGroupData({...editGroupData, location: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Group Status</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['open', 'closed', 'archived'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditGroupData({...editGroupData, status: s})}
                      className={`py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border-2 ${
                        editGroupData.status === s
                          ? s === 'open'
                            ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-100'
                            : s === 'closed'
                            ? 'bg-slate-700 border-slate-700 text-white shadow-lg shadow-slate-100'
                            : 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-100'
                          : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="flex-1 px-8 py-4 border-2 border-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 px-8 py-4 bg-orange-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-600 shadow-xl shadow-orange-100 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {editSaving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Detail Modal */}
      {selectedGroupForDetail && (
        <GroupDetailModal
          group={selectedGroupForDetail}
          currentUser={currentUser}
          onClose={() => setSelectedGroupForDetail(null)}
          onJoin={handleJoinFromModal}
          onLeave={handleLeaveFromModal}
          onDelete={handleDeleteFromModal}
          onRefresh={loadAllData}
        />
      )}

      {/* Leader Request Modal */}
      {showLeaderRequestModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-purple-500 p-8 flex justify-between items-center text-white">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <Crown size={24} />
                  <h3 className="text-2xl font-black tracking-tight">Request Leader Role</h3>
                </div>
                <p className="text-purple-100 text-sm font-bold">Ask admin to grant you group leader access</p>
              </div>
              <button onClick={() => setShowLeaderRequestModal(false)} className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleLeaderRequestSubmit} className="p-8 space-y-6">
              <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 text-sm text-purple-800 font-medium">
                As a <strong>Group Leader</strong> you can create and manage study groups, invite members, schedule meetings, and more.
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Why do you want to be a leader? (optional)</label>
                <textarea
                  rows={3}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none text-sm font-bold resize-none"
                  placeholder="Describe your interest in leading a study group..."
                  value={leaderRequestReason}
                  onChange={e => setLeaderRequestReason(e.target.value)}
                  maxLength={500}
                />
                <p className="text-[10px] text-slate-400 text-right">{leaderRequestReason.length}/500</p>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowLeaderRequestModal(false)}
                  className="flex-1 px-6 py-4 border-2 border-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLeaderRequest}
                  className="flex-1 px-6 py-4 bg-purple-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-purple-600 shadow-xl shadow-purple-100 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submittingLeaderRequest ? <Loader2 size={16} className="animate-spin" /> : <Crown size={16} />}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
