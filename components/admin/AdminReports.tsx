import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, Loader2, Shield, RefreshCw, Clock, User as UserIcon, AlertOctagon, Ban, Search, CheckCircle, XCircle, Eye, FileText, UserCheck } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { API_CONFIG } from '../../constants';

interface ModerationLog {
  id: number;
  moderator_id: number;
  target_user_id: number;
  report_id: number;
  action_type: 'warn' | 'suspend' | 'ban' | 'unban' | 'delete_content' | 'dismiss_report';
  duration_days?: number;
  reason: string;
  created_at: string;
  moderator: {
    id: number;
    name: string;
  };
}

interface ReportData {
  id: number;
  reporter_id: number;
  reported_user_id: number;
  reported_group_id?: number;
  reported_message_id?: number;
  reason: string;
  description: string;
  evidence_url?: string;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  resolution_action?: string;
  resolution_notes?: string;
  resolved_by?: number;
  resolved_at?: string;
  created_at: string;
  reporter: {
    id: number;
    name: string;
    email: string;
  };
  reported_user: {
    id: number;
    name: string;
    email: string;
    banned?: boolean;
    suspended_until?: string | null;
  };
  reported_group?: {
    id: string;
    name: string;
  };
  resolver?: {
    id: number;
    name: string;
  };
  moderation_logs?: ModerationLog[];
}

interface PaginatedResponse {
  data: ReportData[];
  current_page: number;
  last_page: number;
  total: number;
}

const AdminReports: React.FC = () => {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReports, setTotalReports] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [resolvingReport, setResolvingReport] = useState<ReportData | null>(null);
  const [resolutionAction, setResolutionAction] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [viewingReport, setViewingReport] = useState<ReportData | null>(null);

  useEffect(() => {
    fetchReports();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchReports(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [currentPage, statusFilter, priorityFilter]);

  const fetchReports = async (silent = false) => {
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
        status: statusFilter,
        priority: priorityFilter
      });

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/admin/reports?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch reports');

      const data: PaginatedResponse = await response.json();
      setReports(data.data);
      setCurrentPage(data.current_page);
      setTotalPages(data.last_page);
      setTotalReports(data.total);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    fetchReports();
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

  const handleDelete = async (id: number) => {
    try {
      const userStr = localStorage.getItem('admin_auth');
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const token = user.token;

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/admin/reports/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to delete report');

      alert('Report deleted successfully!');
      setDeleteConfirm(null);
      fetchReports();
    } catch (err: any) {
      alert(err.message || 'Failed to delete report');
    }
  };

  const handleResolveReport = async () => {
    if (!resolvingReport || !resolutionAction) {
      alert('Please select a resolution action');
      return;
    }

    try {
      const userStr = localStorage.getItem('admin_auth');
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const token = user.token;

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/admin/reports/${resolvingReport.id}/resolve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resolution_action: resolutionAction,
            resolution_notes: resolutionNotes
          })
        }
      );

      if (!response.ok) throw new Error('Failed to resolve report');

      alert('Report resolved successfully!');
      setResolvingReport(null);
      setResolutionAction('');
      setResolutionNotes('');
      fetchReports();
    } catch (err: any) {
      alert(err.message || 'Failed to resolve report');
    }
  };

  const getReasonLabel = (reason: string) => {
    const reasons: Record<string, string> = {
      spam: 'Spam',
      harassment: 'Harassment',
      inappropriate_content: 'Inappropriate Content',
      fake_profile: 'Fake Profile',
      other: 'Other'
    };
    return reasons[reason] || reason;
  };

  const getPriorityBadge = (priority: string) => {
    const configs: Record<string, { bg: string; text: string }> = {
      low: { bg: 'bg-blue-100', text: 'text-blue-700' },
      medium: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
      high: { bg: 'bg-orange-100', text: 'text-orange-700' },
      urgent: { bg: 'bg-red-100', text: 'text-red-700' }
    };
    const config = configs[priority] || configs.medium;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${config.bg} ${config.text} uppercase`}>
        {priority}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { bg: string; text: string; icon: any }> = {
      pending: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
      investigating: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Eye },
      resolved: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle },
      dismissed: { bg: 'bg-slate-100', text: 'text-slate-700', icon: XCircle }
    };
    const config = configs[status] || configs.pending;
    const Icon = config.icon;
    return (
      <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${config.bg} ${config.text}`}>
        <Icon size={12} />
        {status}
      </span>
    );
  };

  // Filter reports based on search term
  const filteredReports = reports.filter(report => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      report.reported_user.name.toLowerCase().includes(search) ||
      report.reported_user.email.toLowerCase().includes(search) ||
      report.reporter.name.toLowerCase().includes(search) ||
      report.reporter.email.toLowerCase().includes(search) ||
      report.reason.toLowerCase().includes(search) ||
      report.description.toLowerCase().includes(search)
    );
  }).sort((a, b) => {
    // Sort priority: pending first, dismissed middle, resolved last
    const statusPriority: Record<string, number> = {
      pending: 1,
      dismissed: 2,
      resolved: 3
    };
    return (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99);
  });

  const pendingReports = reports.filter(r => r.status === 'pending').length;
  const urgentReports = reports.filter(r => r.priority === 'urgent').length;

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900">User Reports Management</h1>
              <p className="text-slate-500 font-medium">
                {totalReports} total reports {searchTerm && `(${filteredReports.length} matching)`}
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

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative md:col-span-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 transition-all"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-purple-500 transition-all"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-purple-500 transition-all"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Pending Review</p>
              <div className="flex items-center gap-2">
                <Clock size={20} className="text-amber-400" />
                <span className="text-2xl font-black text-slate-900">{pendingReports}</span>
                <span className="text-sm text-slate-500">awaiting action</span>
              </div>
            </div>
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Urgent Reports</p>
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-400" />
                <span className="text-2xl font-black text-slate-900">{urgentReports}</span>
                <span className="text-sm text-slate-500">high priority</span>
              </div>
            </div>
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Reports</p>
              <div className="flex items-center gap-2">
                <Shield size={20} className="text-blue-400" />
                <span className="text-2xl font-black text-slate-900">{totalReports}</span>
                <span className="text-sm text-slate-500">all time</span>
              </div>
            </div>
          </div>
        </div>

        {/* Reports Grid */}
        <div className="grid gap-6">
          {loading ? (
            <div className="bg-white rounded-2xl border-2 border-slate-200 p-12 text-center">
              <Loader2 size={32} className="animate-spin text-purple-600 mx-auto mb-4" />
              <p className="text-slate-600 font-bold">Loading reports...</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-slate-200 p-12 text-center">
              <Shield size={48} className="text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-bold">
                {reports.length === 0 ? 'No reports received yet' : 'No reports match your filters'}
              </p>
              {(searchTerm || statusFilter !== 'all' || priorityFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setPriorityFilter('all');
                  }}
                  className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm transition-all"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {filteredReports.map((report) => (
                <div key={report.id} className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm hover:shadow-lg transition-all overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                            <UserIcon size={24} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <p className="font-black text-slate-900 text-lg">{report.reported_user.name}</p>
                              {getPriorityBadge(report.priority)}
                              {getStatusBadge(report.status)}
                            </div>
                            <p className="text-sm text-slate-500">{report.reported_user.email}</p>
                            <div className="mt-2 inline-block px-3 py-1 bg-slate-100 rounded-full">
                              <p className="text-xs font-bold text-slate-600">{getReasonLabel(report.reason)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 pt-4 mb-4">
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Reporter Information</p>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center font-bold">
                              {report.reporter.name[0]}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{report.reporter.name}</p>
                              <p className="text-xs text-slate-500">{report.reporter.email}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setViewingReport(report)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="View details"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(report.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete report"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-sm text-slate-400">
                        Reported on {new Date(report.created_at).toLocaleString()}
                      </span>
                      {report.reported_group && (
                        <span className="text-sm text-slate-500">
                          · Group: <span className="font-bold">{report.reported_group.name}</span>
                        </span>
                      )}
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-4">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Description</p>
                      <p className="text-slate-700 leading-relaxed">{report.description}</p>
                      {report.evidence_url && (
                        <a
                          href={report.evidence_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold text-sm"
                        >
                          <FileText size={14} />
                          View Evidence
                        </a>
                      )}
                    </div>

                    {(report.status === 'resolved' || report.status === 'dismissed') && Array.isArray(report.moderation_logs) && report.moderation_logs.length > 0 && (
                      <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 mb-4">
                        <p className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-2">Moderation Action</p>
                        {report.moderation_logs.map((log) => (
                          <div key={log.id} className="mb-2">
                            <p className="text-sm font-bold text-emerald-900">
                              Action: {log.action_type === 'warn' ? '⚠️ Warned' : log.action_type === 'suspend' ? '🚫 Suspended' : log.action_type === 'ban' ? '🔨 Banned' : log.action_type === 'dismiss_report' ? '✓ Dismissed' : log.action_type}
                              {log.duration_days && ` (${log.duration_days} days)`}
                            </p>
                            <p className="text-sm text-emerald-700 mt-1">{log.reason}</p>
                            <p className="text-xs text-emerald-600 mt-1">
                              By {log.moderator.name} on {new Date(log.created_at).toLocaleString()}
                            </p>
                          </div>
                        ))}
                        {report.resolution_notes && (
                          <p className="text-sm text-emerald-700 mt-2 pt-2 border-t border-emerald-200">
                            Notes: {report.resolution_notes}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Unsuspend/Unban Actions for Resolved Reports */}
                    {(report.status === 'resolved' || report.status === 'dismissed') && (
                      (report.reported_user.banned === true || (report.reported_user.suspended_until && new Date(report.reported_user.suspended_until) > new Date())) && (
                        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200 mb-4">
                          {report.reported_user.banned === true && (
                            <button
                              onClick={async () => {
                                if (confirm('Are you sure you want to unban this user?')) {
                                  const userStr = localStorage.getItem('admin_auth');
                                  if (!userStr) return;
                                  const user = JSON.parse(userStr);
                                  const token = user.token;
                                  try {
                                    const response = await fetch(
                                      `${API_CONFIG.BASE_URL}/admin/users/${report.reported_user_id}/unban`,
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
                                    fetchReports();
                                  } catch (err: any) {
                                    alert(err.message || 'Failed to unban user');
                                  }
                                }
                              }}
                              className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-all"
                            >
                              <UserCheck size={18} />
                              Unban User
                            </button>
                          )}
                          {report.reported_user.suspended_until && new Date(report.reported_user.suspended_until) > new Date() && (
                            <button
                              onClick={async () => {
                                if (confirm('Are you sure you want to lift this user\'s suspension?')) {
                                  const userStr = localStorage.getItem('admin_auth');
                                  if (!userStr) return;
                                  const user = JSON.parse(userStr);
                                  const token = user.token;
                                  try {
                                    const response = await fetch(
                                      `${API_CONFIG.BASE_URL}/admin/users/${report.reported_user_id}/unsuspend`,
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
                                    fetchReports();
                                  } catch (err: any) {
                                    alert(err.message || 'Failed to unsuspend user');
                                  }
                                }
                              }}
                              className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-all"
                            >
                              <UserCheck size={18} />
                              Lift Suspension
                            </button>
                          )}
                        </div>
                      )
                    )}

                    {/* Action Buttons */}
                    {report.status === 'pending' && (
                      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200">
                        <button
                          onClick={() => setResolvingReport(report)}
                          className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold transition-all"
                        >
                          <CheckCircle size={18} />
                          Resolve Report
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('Are you sure you want to dismiss this report?')) {
                              const userStr = localStorage.getItem('admin_auth');
                              if (!userStr) return;
                              const user = JSON.parse(userStr);
                              const token = user.token;
                              try {
                                const response = await fetch(
                                  `${API_CONFIG.BASE_URL}/admin/reports/${report.id}/resolve`,
                                  {
                                    method: 'POST',
                                    headers: {
                                      'Authorization': `Bearer ${token}`,
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                      resolution_action: 'dismissed',
                                      resolution_notes: 'Report dismissed - no action needed'
                                    })
                                  }
                                );
                                if (!response.ok) throw new Error('Failed to dismiss report');
                                alert('Report dismissed');
                                fetchReports();
                              } catch (err: any) {
                                alert(err.message || 'Failed to dismiss report');
                              }
                            }
                          }}
                          className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-500 hover:bg-slate-600 text-white rounded-xl font-bold transition-all"
                        >
                          <XCircle size={18} />
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-white rounded-xl border-2 border-slate-200 px-6 py-4 flex items-center justify-between">
                  <p className="text-sm text-slate-600 font-medium">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-lg font-bold text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-lg font-bold text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Resolve Report Modal */}
      {resolvingReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-purple-600 p-8 text-white">
              <h3 className="text-2xl font-black">Resolve Report</h3>
              <p className="text-purple-100 font-medium mt-1">
                Report against {resolvingReport.reported_user.name}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                  Resolution Action
                </label>
                <select
                  value={resolutionAction}
                  onChange={(e) => setResolutionAction(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-purple-500 transition-all"
                >
                  <option value="">Select an action...</option>
                  <option value="warning">Issue Warning</option>
                  <option value="suspension_3d">Suspend for 3 Days</option>
                  <option value="suspension_7d">Suspend for 7 Days</option>
                  <option value="suspension_30d">Suspend for 30 Days</option>
                  <option value="ban">Permanent Ban</option>
                  <option value="no_action">No Action Required</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                  Resolution Notes (Optional)
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={4}
                  placeholder="Add any notes about this resolution..."
                  className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-purple-500 transition-all resize-none"
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => {
                  setResolvingReport(null);
                  setResolutionAction('');
                  setResolutionNotes('');
                }}
                className="flex-1 px-6 py-3 bg-slate-300 text-slate-700 rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-slate-400 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveReport}
                disabled={!resolutionAction}
                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Resolve Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Report Details Modal */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-blue-600 p-8 text-white">
              <h3 className="text-2xl font-black">Report Details</h3>
              <p className="text-blue-100 font-medium mt-1">ID: {viewingReport.id}</p>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Reported User</p>
                  <p className="font-bold text-slate-900">{viewingReport.reported_user.name}</p>
                  <p className="text-sm text-slate-500">{viewingReport.reported_user.email}</p>
                </div>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Reporter</p>
                  <p className="font-bold text-slate-900">{viewingReport.reporter.name}</p>
                  <p className="text-sm text-slate-500">{viewingReport.reporter.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Priority</p>
                  {getPriorityBadge(viewingReport.priority)}
                </div>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                  {getStatusBadge(viewingReport.status)}
                </div>
              </div>

              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Reason</p>
                <p className="font-bold text-slate-900">{getReasonLabel(viewingReport.reason)}</p>
              </div>

              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Description</p>
                <p className="text-slate-700 leading-relaxed">{viewingReport.description}</p>
              </div>

              {viewingReport.evidence_url && (
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Evidence</p>
                  <a
                    href={viewingReport.evidence_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-bold"
                  >
                    <FileText size={16} />
                    View Evidence Link
                  </a>
                </div>
              )}

              {viewingReport.reported_group && (
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Related Group</p>
                  <p className="font-bold text-slate-900">{viewingReport.reported_group.name}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Created</p>
                <p className="text-slate-700">{new Date(viewingReport.created_at).toLocaleString()}</p>
              </div>

              {viewingReport.status === 'resolved' && (
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                  <p className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-2">Resolution</p>
                  <p className="font-bold text-emerald-900 mb-1">Action: {viewingReport.resolution_action}</p>
                  {viewingReport.resolution_notes && (
                    <p className="text-sm text-emerald-700 mb-2">{viewingReport.resolution_notes}</p>
                  )}
                  {viewingReport.resolver && (
                    <p className="text-xs text-emerald-600">
                      Resolved by {viewingReport.resolver.name} on {new Date(viewingReport.resolved_at!).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-200">
              <button
                onClick={() => setViewingReport(null)}
                className="w-full px-6 py-3 bg-slate-700 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-slate-800 transition-all"
              >
                Close
              </button>
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
                <AlertTriangle size={32} className="text-red-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900 text-center mb-2">Delete Report?</h3>
              <p className="text-slate-600 text-center mb-6">
                This action cannot be undone. This report will be permanently removed from the system.
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
    </AdminLayout>
  );
};

export default AdminReports;
