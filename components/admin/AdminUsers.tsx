import React, { useState, useEffect } from 'react';
import { Search, Edit2, Trash2, X, Mail, User, BookOpen, MapPin, Loader2, UserCircle, AlertCircle, RefreshCw, Clock, Eye, Shield, Ban, Key, Users, Calendar, AlertTriangle, UserCheck, Award, Crown, CheckCircle, XCircle } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { API_CONFIG } from '../../constants';

interface UserData {
  id: number;
  name: string;
  email: string;
  role: string;
  major: string;
  bio: string;
  location: string;
  created_at: string;
  created_groups_count: number;
  joined_groups_count: number;
  suspended_until?: string | null;
  warnings?: number;
  banned?: boolean;
  warning_expires_at?: string | null;
  karma_points?: number;
}

interface UserProfile {
  user: UserData;
  created_groups: any[];
  joined_groups: any[];
  reports_made: any[];
  reports_received: any[];
  moderation_history: any[];
}

interface PaginatedResponse {
  data: UserData[];
  current_page: number;
  last_page: number;
  total: number;
}

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [karmaSort, setKarmaSort] = useState<'' | 'most' | 'least'>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: '',
    major: '',
    bio: '',
    location: ''
  });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // New state for profile, suspend, and role modals
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [suspendingUser, setSuspendingUser] = useState<UserData | null>(null);
  const [suspendForm, setSuspendForm] = useState({
    duration: '7',
    reason: ''
  });
  const [assigningRole, setAssigningRole] = useState<UserData | null>(null);
  const [newRole, setNewRole] = useState('');
  const [resettingPassword, setResettingPassword] = useState<number | null>(null);

  // Warn, Ban, Unban state
  const [warningUser, setWarningUser] = useState<UserData | null>(null);
  const [warnReason, setWarnReason] = useState('');
  const [banningUser, setBanningUser] = useState<UserData | null>(null);
  const [banReason, setBanReason] = useState('');

  // Leader requests tab
  const [activeTab, setActiveTab] = useState<'users' | 'requests'>('users');
  const [leaderRequests, setLeaderRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestStatusFilter, setRequestStatusFilter] = useState('pending');
  const [rejectingRequest, setRejectingRequest] = useState<any | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  // Helper function to calculate days remaining
  const getDaysRemaining = (dateStr: string | null | undefined): number | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : null;
  };

  // Helper function to check if current user is admin
  const isAdmin = (): boolean => {
    const authData = localStorage.getItem('admin_auth');
    if (!authData) return false;
    const { role } = JSON.parse(authData);
    return role === 'admin';
  };

  // Helper function to check if user can be moderated (not admin/moderator)
  const canModerate = (user: UserData): boolean => {
    return !['admin', 'moderator'].includes(user.role);
  };

  useEffect(() => {
    fetchUsers();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchUsers(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [currentPage, searchQuery, roleFilter, statusFilter]);

  useEffect(() => {
    if (activeTab === 'requests') {
      fetchLeaderRequests();
    }
  }, [activeTab, requestStatusFilter]);

  const fetchUsers = async (silent = false) => {
    try {
      if (!silent) {
        setRefreshing(true);
      }

      const userStr = localStorage.getItem('admin_auth');
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const token = user.token;

      const params = new URLSearchParams({
        page: currentPage.toString(),
        ...(searchQuery && { search: searchQuery }),
        ...(roleFilter && { role: roleFilter }),
        ...(statusFilter && { status: statusFilter }),
      });

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/admin/users?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch users');

      const data: PaginatedResponse = await response.json();
      setUsers(data.data);
      setCurrentPage(data.current_page);
      setTotalPages(data.last_page);
      setTotalUsers(data.total);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    fetchUsers();
  };

  const getTimeAgo = (date: Date | null) => {
    if (!date) return 'Never';
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const handleEdit = (user: UserData) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      major: user.major || '',
      bio: user.bio || '',
      location: user.location || ''
    });
  };

  const handleUpdate = async () => {
    if (!editingUser) return;

    setSaving(true);
    try {
      const userStr = localStorage.getItem('admin_auth');
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const token = user.token;

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/admin/users/${editingUser.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(editForm)
        }
      );

      if (!response.ok) throw new Error('Failed to update user');

      alert('User updated successfully!');
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const userStr = localStorage.getItem('admin_auth');
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const token = user.token;

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/admin/users/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete user');
      }

      alert('User deleted successfully!');
      setDeleteConfirm(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    }
  };

  const handleViewProfile = async (userId: number) => {
    setLoadingProfile(true);
    try {
      const userStr = localStorage.getItem('admin_auth');
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const token = user.token;

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/admin/users/${userId}/profile`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch user profile');

      const data = await response.json();
      setViewingProfile(data);
    } catch (err) {
      console.error('Failed to load user profile:', err);
      alert('Failed to load user profile');
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleSuspendUser = async () => {
    if (!suspendingUser) return;

    setSaving(true);
    try {
      const userStr = localStorage.getItem('admin_auth');
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const token = user.token;

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/admin/users/${suspendingUser.id}/suspend`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            duration_days: parseInt(suspendForm.duration),
            reason: suspendForm.reason
          })
        }
      );

      if (!response.ok) throw new Error('Failed to suspend user');

      alert('User suspended successfully!');
      setSuspendingUser(null);
      setSuspendForm({ duration: '7', reason: '' });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to suspend user');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignRole = async () => {
    if (!assigningRole) return;

    setSaving(true);
    try {
      const userStr = localStorage.getItem('admin_auth');
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const token = user.token;

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/admin/users/${assigningRole.id}/assign-role`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ role: newRole })
        }
      );

      if (!response.ok) throw new Error('Failed to assign role');

      alert('Role assigned successfully!');
      setAssigningRole(null);
      setNewRole('');
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to assign role');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (userId: number) => {
    if (!confirm('Are you sure you want to reset this user\'s password? A new password will be generated and sent to their email.')) {
      return;
    }

    try {
      const userStr = localStorage.getItem('admin_auth');
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const token = user.token;

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/admin/users/${userId}/reset-password`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to reset password');

      const data = await response.json();
      alert(`Password reset successfully! New password: ${data.new_password}\n\nPlease share this with the user securely.`);
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
    }
  };

  const handleWarnUser = async () => {
    if (!warningUser) return;

    setSaving(true);
    try {
      const userStr = localStorage.getItem('admin_auth');
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const token = user.token;

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/admin/users/${warningUser.id}/warn`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: warnReason })
        }
      );

      if (!response.ok) throw new Error('Failed to warn user');

      const data = await response.json();
      alert(data.auto_banned
        ? 'User has been automatically banned after receiving 3 warnings!'
        : 'User warned successfully!');
      setWarningUser(null);
      setWarnReason('');
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to warn user');
    } finally {
      setSaving(false);
    }
  };

  const handleBanUser = async () => {
    if (!banningUser) return;

    setSaving(true);
    try {
      const userStr = localStorage.getItem('admin_auth');
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const token = user.token;

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/admin/users/${banningUser.id}/ban`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: banReason })
        }
      );

      if (!response.ok) throw new Error('Failed to ban user');

      alert('User banned successfully!');
      setBanningUser(null);
      setBanReason('');
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to ban user');
    } finally {
      setSaving(false);
    }
  };

  const handleUnbanUser = async (userId: number) => {
    if (!confirm('Are you sure you want to unban this user? This will also reset their warnings.')) {
      return;
    }

    try {
      const userStr = localStorage.getItem('admin_auth');
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const token = user.token;

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/admin/users/${userId}/unban`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to unban user');

      alert('User unbanned successfully!');
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to unban user');
    }
  };

  const handleUnsuspendUser = async (userId: number) => {
    if (!confirm('Are you sure you want to lift this user\'s suspension?')) {
      return;
    }

    try {
      const userStr = localStorage.getItem('admin_auth');
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const token = user.token;

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/admin/users/${userId}/unsuspend`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to unsuspend user');

      alert('User suspension lifted successfully!');
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to unsuspend user');
    }
  };

  const getToken = (): string => {
    const s = localStorage.getItem('admin_auth');
    return s ? JSON.parse(s).token : '';
  };

  const fetchLeaderRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await fetch(
        `${API_CONFIG.BASE_URL}/admin/leader-requests?status=${requestStatusFilter}`,
        { headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' } }
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setLeaderRequests(data.data || []);
    } catch (err) {
      console.error('Failed to fetch leader requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleApproveRequest = async (id: number) => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/admin/leader-requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('Failed to approve');
      fetchLeaderRequests();
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to approve request');
    }
  };

  const handleRejectRequest = async () => {
    if (!rejectingRequest) return;
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/admin/leader-requests/${rejectingRequest.id}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: rejectNote })
      });
      if (!res.ok) throw new Error('Failed to reject');
      setRejectingRequest(null);
      setRejectNote('');
      fetchLeaderRequests();
    } catch (err: any) {
      alert(err.message || 'Failed to reject request');
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900">User Management</h1>
              <p className="text-slate-500 font-medium">
                {totalUsers} total users registered
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                <Clock size={16} />
                <span>Updated {getTimeAgo(lastUpdated)}</span>
              </div>
              <button
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {/* Tab Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${activeTab === 'users' ? 'bg-purple-600 text-white shadow-md' : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-purple-300'}`}
            >
              <Users size={16} />
              Users
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${activeTab === 'requests' ? 'bg-purple-600 text-white shadow-md' : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-purple-300'}`}
            >
              <Crown size={16} />
              Leader Requests
            </button>
          </div>

          {/* Search */}
          {activeTab === 'users' && <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search users by name, email, major..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none font-bold text-slate-900 placeholder:text-slate-400"
            />
          </div>}

          {/* Filters */}
          {activeTab === 'users' && <div className="flex flex-col md:flex-row gap-4">
            {/* Role Filter */}
            <div className="relative flex-1">
              <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-12 pr-10 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none font-bold text-slate-900 appearance-none cursor-pointer"
              >
                <option value="">All Roles</option>
                <option value="member">Members</option>
                <option value="leader">Leaders</option>
                <option value="moderator">Moderators</option>
                <option value="admin">Admins</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative flex-1">
              <AlertTriangle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-12 pr-10 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none font-bold text-slate-900 appearance-none cursor-pointer"
              >
                <option value="">All Status</option>
                <option value="warned">Warned Users</option>
                <option value="suspended">Suspended Users</option>
                <option value="banned">Banned Users</option>
              </select>
            </div>

            {/* Karma Sort */}
            <div className="relative flex-1">
              <Award className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <select
                value={karmaSort}
                onChange={(e) => setKarmaSort(e.target.value as '' | 'most' | 'least')}
                className="w-full pl-12 pr-10 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none font-bold text-slate-900 appearance-none cursor-pointer"
              >
                <option value="">Sort by Karma</option>
                <option value="most">Most Karma ↓</option>
                <option value="least">Least Karma ↑</option>
              </select>
            </div>
          </div>}
        </div>

        {/* Leader Requests Panel */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-3">
              {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setRequestStatusFilter(s)}
                  className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${requestStatusFilter === s ? 'bg-purple-600 text-white shadow-md' : 'bg-white border-2 border-slate-200 text-slate-500 hover:border-purple-300'}`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
              {loadingRequests ? (
                <div className="p-12 text-center">
                  <Loader2 size={32} className="animate-spin text-purple-600 mx-auto mb-4" />
                  <p className="text-slate-600 font-bold">Loading requests...</p>
                </div>
              ) : leaderRequests.length === 0 ? (
                <div className="p-12 text-center">
                  <Crown className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold">No {requestStatusFilter !== 'all' ? requestStatusFilter : ''} leader requests</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {leaderRequests.map((req: any) => (
                    <div key={req.id} className="p-5 flex items-start gap-4">
                      <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {req.user?.name?.[0] ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900">{req.user?.name}</span>
                          <span className="text-slate-400 text-xs">{req.user?.email}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-red-100 text-red-700'
                          }`}>{req.status}</span>
                          {req.user?.karma_points !== undefined && (
                            <span className="text-[10px] font-bold text-slate-400">{req.user.karma_points} karma</span>
                          )}
                        </div>
                        {req.reason && (
                          <p className="text-sm text-slate-600 mt-1 font-medium">"{req.reason}"</p>
                        )}
                        {req.admin_note && (
                          <p className="text-xs text-red-500 font-bold mt-1">Admin note: {req.admin_note}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">{new Date(req.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                      {req.status === 'pending' && isAdmin() && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleApproveRequest(req.id)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-xs transition-all"
                          >
                            <CheckCircle size={14} />
                            Approve
                          </button>
                          <button
                            onClick={() => { setRejectingRequest(req); setRejectNote(''); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-xs transition-all"
                          >
                            <XCircle size={14} />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Users Table */}
        {activeTab === 'users' && <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 size={32} className="animate-spin text-purple-600 mx-auto mb-4" />
              <p className="text-slate-600 font-bold">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center">
              <UserCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-bold">No users found</p>
              <p className="text-sm text-slate-400 mt-1">Users will appear here</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b-2 border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest">User</th>
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest">Role</th>
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest">Major</th>
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest">Groups</th>
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest">Joined</th>
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(karmaSort
                      ? [...users].sort((a, b) => {
                          const ka = a.karma_points ?? 0;
                          const kb = b.karma_points ?? 0;
                          return karmaSort === 'most' ? kb - ka : ka - kb;
                        })
                      : users
                    ).map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center font-bold">
                              {user.name[0]}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-900">{user.name}</p>
                                {user.karma_points !== undefined && (
                                  <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-black">
                                    <Award size={11} /> {user.karma_points}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              user.role === 'admin'
                                ? 'bg-purple-100 text-purple-700'
                                : user.role === 'moderator'
                                ? 'bg-orange-100 text-orange-700'
                                : user.role === 'leader'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {user.role}
                            </span>
                            {!!user.banned && (
                              <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                Banned
                              </span>
                            )}
                            {user.suspended_until && new Date(user.suspended_until) > new Date() && (
                              <span className="px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                                Suspended ({getDaysRemaining(user.suspended_until)}d left)
                              </span>
                            )}
                            {!!user.warnings && user.warnings > 0 && (
                              <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                {user.warnings} ⚠️
                                {user.warning_expires_at && getDaysRemaining(user.warning_expires_at) !== null && (
                                  <> ({getDaysRemaining(user.warning_expires_at)}d left)</>
                                )}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-slate-700">{user.major || 'N/A'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-purple-600">{user.created_groups_count}</span>
                              <span className="text-xs text-slate-400">created</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-blue-600">{user.joined_groups_count}</span>
                              <span className="text-xs text-slate-400">joined</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-500 font-medium">
                            {new Date(user.created_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewProfile(user.id)}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                              title="View profile"
                            >
                              <Eye size={16} />
                            </button>
                            {isAdmin() && (
                              <>
                                <button
                                  onClick={() => handleEdit(user)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                  title="Edit user"
                                >
                                  <Edit2 size={16} />
                                </button>
                                {user.email !== 'admin@au.edu' && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setAssigningRole(user);
                                        setNewRole(user.role);
                                      }}
                                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                      title="Assign role"
                                    >
                                      <Shield size={16} />
                                    </button>

                                    {canModerate(user) && (
                                      <>
                                        {user.banned ? (
                                          <button
                                            onClick={() => handleUnbanUser(user.id)}
                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                                            title="Unban user"
                                          >
                                            <UserCheck size={16} />
                                          </button>
                                        ) : user.suspended_until && new Date(user.suspended_until) > new Date() ? (
                                          <button
                                            onClick={() => handleUnsuspendUser(user.id)}
                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                                            title="Lift suspension"
                                          >
                                            <UserCheck size={16} />
                                          </button>
                                        ) : (
                                          <>
                                            <button
                                              onClick={() => setWarningUser(user)}
                                              className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                              title="Warn user"
                                            >
                                              <AlertTriangle size={16} />
                                            </button>
                                            <button
                                              onClick={() => setSuspendingUser(user)}
                                              className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                                              title="Suspend user"
                                            >
                                              <Ban size={16} />
                                            </button>
                                            <button
                                              onClick={() => setBanningUser(user)}
                                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                              title="Ban user permanently"
                                            >
                                              <Ban size={16} className="fill-current" />
                                            </button>
                                          </>
                                        )}
                                        <button
                                          onClick={() => handleResetPassword(user.id)}
                                          className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                                          title="Reset password"
                                        >
                                          <Key size={16} />
                                        </button>
                                      </>
                                    )}

                                    <button
                                      onClick={() => setDeleteConfirm(user.id)}
                                      className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                                      title="Delete user"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </>
          )}
        </div>}

        {/* Pagination */}
        {activeTab === 'users' && totalPages > 1 && (
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600 font-medium">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg font-bold text-sm hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reject Leader Request Modal */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-red-500 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black">Reject Leader Request</h3>
                <p className="text-red-100 text-sm font-bold mt-0.5">{rejectingRequest.user?.name}</p>
              </div>
              <button onClick={() => setRejectingRequest(null)} className="bg-white/20 hover:bg-white/30 p-2 rounded-xl"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason for rejection (optional)</label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none font-bold text-sm resize-none focus:border-red-400"
                  placeholder="Provide a reason to help the user understand..."
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <button onClick={handleRejectRequest} className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all">
                  <XCircle size={16} /> Reject
                </button>
                <button onClick={() => setRejectingRequest(null)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-purple-500 p-8 text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black">Edit User</h3>
                <p className="text-purple-100 text-sm font-bold mt-1">Update user information</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6 max-h-[600px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none font-bold"
                  >
                    <option value="member">Member</option>
                    <option value="leader">Leader</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Major</label>
                  <input
                    type="text"
                    value={editForm.major}
                    onChange={(e) => setEditForm({ ...editForm, major: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Location</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Bio</label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none font-bold resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleUpdate}
                  disabled={saving}
                  className="flex-1 py-4 bg-purple-500 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-purple-600 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-6 py-4 bg-slate-100 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-red-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900 text-center mb-2">Delete User?</h3>
              <p className="text-slate-600 text-center mb-6">
                This action cannot be undone. All user data and created groups will be permanently deleted.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all"
                >
                  Delete
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {viewingProfile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-8 text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black">User Profile</h3>
                <p className="text-purple-100 text-sm font-bold mt-1">{viewingProfile.user.name}</p>
              </div>
              <button
                onClick={() => setViewingProfile(null)}
                className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6 max-h-[600px] overflow-y-auto">
              {/* User Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Email</p>
                  <p className="font-bold text-slate-900">{viewingProfile.user.email}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Role</p>
                  <p className="font-bold text-slate-900 capitalize">{viewingProfile.user.role}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Major</p>
                  <p className="font-bold text-slate-900">{viewingProfile.user.major || 'N/A'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Location</p>
                  <p className="font-bold text-slate-900">{viewingProfile.user.location || 'N/A'}</p>
                </div>
              </div>

              {/* Groups */}
              <div>
                <h4 className="text-lg font-black text-slate-900 mb-3 flex items-center gap-2">
                  <Users size={20} className="text-purple-600" />
                  Groups ({(viewingProfile.created_groups?.length || 0) + (viewingProfile.joined_groups?.length || 0)})
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-purple-50 p-4 rounded-xl border-2 border-purple-200">
                    <p className="text-sm font-black text-purple-600 mb-2">Created</p>
                    <p className="text-2xl font-black text-slate-900">{viewingProfile.created_groups?.length || 0}</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-xl border-2 border-blue-200">
                    <p className="text-sm font-black text-blue-600 mb-2">Joined</p>
                    <p className="text-2xl font-black text-slate-900">{viewingProfile.joined_groups?.length || 0}</p>
                  </div>
                </div>
              </div>

              {/* Reports */}
              <div>
                <h4 className="text-lg font-black text-slate-900 mb-3 flex items-center gap-2">
                  <AlertCircle size={20} className="text-orange-600" />
                  Reports
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-orange-50 p-4 rounded-xl border-2 border-orange-200">
                    <p className="text-sm font-black text-orange-600 mb-2">Reports Made</p>
                    <p className="text-2xl font-black text-slate-900">{viewingProfile.reports_made?.length || 0}</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-xl border-2 border-red-200">
                    <p className="text-sm font-black text-red-600 mb-2">Reports Received</p>
                    <p className="text-2xl font-black text-slate-900">{viewingProfile.reports_received?.length || 0}</p>
                  </div>
                </div>
              </div>

              {/* Moderation History */}
              {(viewingProfile.moderation_history?.length || 0) > 0 && (
                <div>
                  <h4 className="text-lg font-black text-slate-900 mb-3 flex items-center gap-2">
                    <Shield size={20} className="text-slate-600" />
                    Moderation History
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {viewingProfile.moderation_history.map((log: any, index: number) => (
                      <div key={index} className="bg-slate-50 p-3 rounded-xl text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-black text-slate-900">{log.action_type}</span>
                          <span className="text-xs text-slate-500 font-medium">
                            {new Date(log.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {log.reason && (
                          <p className="text-slate-600 font-medium">{log.reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setViewingProfile(null)}
                className="w-full py-4 bg-slate-100 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend User Modal */}
      {suspendingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-orange-500 p-8 text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black">Suspend User</h3>
                <p className="text-orange-100 text-sm font-bold mt-1">Temporarily restrict access</p>
              </div>
              <button
                onClick={() => {
                  setSuspendingUser(null);
                  setSuspendForm({ duration: '7', reason: '' });
                }}
                className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-orange-50 p-4 rounded-xl border-2 border-orange-200">
                <p className="font-bold text-slate-900">{suspendingUser.name}</p>
                <p className="text-sm text-slate-600">{suspendingUser.email}</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Duration (Days)</label>
                <select
                  value={suspendForm.duration}
                  onChange={(e) => setSuspendForm({ ...suspendForm, duration: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none font-bold"
                >
                  <option value="1">1 Day</option>
                  <option value="3">3 Days</option>
                  <option value="7">7 Days</option>
                  <option value="14">14 Days</option>
                  <option value="30">30 Days</option>
                  <option value="90">90 Days</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Reason</label>
                <textarea
                  value={suspendForm.reason}
                  onChange={(e) => setSuspendForm({ ...suspendForm, reason: e.target.value })}
                  rows={4}
                  placeholder="Explain why this user is being suspended..."
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none font-bold resize-none placeholder:text-slate-400"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSuspendUser}
                  disabled={saving || !suspendForm.reason.trim()}
                  className="flex-1 py-4 bg-orange-500 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-orange-600 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Suspending...
                    </>
                  ) : (
                    <>
                      <Ban size={18} />
                      Suspend User
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setSuspendingUser(null);
                    setSuspendForm({ duration: '7', reason: '' });
                  }}
                  className="px-6 py-4 bg-slate-100 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Role Modal */}
      {assigningRole && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-500 p-8 text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black">Assign Role</h3>
                <p className="text-emerald-100 text-sm font-bold mt-1">Change user permissions</p>
              </div>
              <button
                onClick={() => {
                  setAssigningRole(null);
                  setNewRole('');
                }}
                className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-emerald-50 p-4 rounded-xl border-2 border-emerald-200">
                <p className="font-bold text-slate-900">{assigningRole.name}</p>
                <p className="text-sm text-slate-600">{assigningRole.email}</p>
                <p className="text-xs text-slate-500 mt-2">
                  Current role: <span className="font-bold capitalize">{assigningRole.role}</span>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">New Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none font-bold"
                >
                  <option value="member">Member</option>
                  <option value="leader">Leader</option>
                  <option value="moderator">Moderator</option>
                </select>
              </div>

              <div className="bg-blue-50 p-4 rounded-xl border-2 border-blue-200">
                <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2">Role Permissions</p>
                <ul className="text-sm text-slate-700 space-y-1 font-medium">
                  {newRole === 'member' && (
                    <>
                      <li>• Can join and create groups</li>
                      <li>• Basic platform access</li>
                    </>
                  )}
                  {newRole === 'leader' && (
                    <>
                      <li>• Can manage own groups</li>
                      <li>• Can organize meetings</li>
                      <li>• Standard user privileges</li>
                    </>
                  )}
                  {newRole === 'moderator' && (
                    <>
                      <li>• Can view all admin pages</li>
                      <li>• Can resolve user reports</li>
                    </>
                  )}
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleAssignRole}
                  disabled={saving || newRole === assigningRole.role}
                  className="flex-1 py-4 bg-emerald-500 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <Shield size={18} />
                      Assign Role
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setAssigningRole(null);
                    setNewRole('');
                  }}
                  className="px-6 py-4 bg-slate-100 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warn User Modal */}
      {warningUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-amber-500 p-8 text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black">Warn User</h3>
                <p className="text-amber-100 text-sm font-bold mt-1">Issue a warning (3 warnings = auto-ban)</p>
              </div>
              <button
                onClick={() => {
                  setWarningUser(null);
                  setWarnReason('');
                }}
                className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-amber-50 p-4 rounded-xl border-2 border-amber-200">
                <p className="font-bold text-slate-900">{warningUser.name}</p>
                <p className="text-sm text-slate-600">{warningUser.email}</p>
                <p className="text-xs text-slate-500 mt-2">
                  Current warnings: <span className="font-bold">{warningUser.warnings || 0}</span>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Reason</label>
                <textarea
                  value={warnReason}
                  onChange={(e) => setWarnReason(e.target.value)}
                  rows={4}
                  placeholder="Explain why this user is being warned..."
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-none font-bold resize-none placeholder:text-slate-400"
                />
              </div>

              {(warningUser.warnings || 0) >= 2 && (
                <div className="bg-red-50 p-4 rounded-xl border-2 border-red-200">
                  <p className="text-sm font-black text-red-600">⚠️ WARNING</p>
                  <p className="text-sm text-slate-700 mt-1">
                    This will be the user's 3rd warning. They will be automatically banned!
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleWarnUser}
                  disabled={saving || !warnReason.trim()}
                  className="flex-1 py-4 bg-amber-500 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Warning...
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={18} />
                      Issue Warning
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setWarningUser(null);
                    setWarnReason('');
                  }}
                  className="px-6 py-4 bg-slate-100 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ban User Modal */}
      {banningUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-red-500 p-8 text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black">Ban User</h3>
                <p className="text-red-100 text-sm font-bold mt-1">Permanently ban user from platform</p>
              </div>
              <button
                onClick={() => {
                  setBanningUser(null);
                  setBanReason('');
                }}
                className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-red-50 p-4 rounded-xl border-2 border-red-200">
                <p className="font-bold text-slate-900">{banningUser.name}</p>
                <p className="text-sm text-slate-600">{banningUser.email}</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Reason</label>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  rows={4}
                  placeholder="Explain why this user is being permanently banned..."
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all outline-none font-bold resize-none placeholder:text-slate-400"
                />
              </div>

              <div className="bg-red-50 p-4 rounded-xl border-2 border-red-200">
                <p className="text-sm font-black text-red-600">⚠️ PERMANENT ACTION</p>
                <p className="text-sm text-slate-700 mt-1">
                  This user will lose all access to the platform. Use unban to restore access.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleBanUser}
                  disabled={saving || !banReason.trim()}
                  className="flex-1 py-4 bg-red-500 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Banning...
                    </>
                  ) : (
                    <>
                      <Ban size={18} />
                      Ban User
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setBanningUser(null);
                    setBanReason('');
                  }}
                  className="px-6 py-4 bg-slate-100 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminUsers;
