import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Ban, UserCheck, UserX, Clock, Loader2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { API_CONFIG } from '../../constants';

interface ModerationLog {
  id: number;
  moderator_id: number;
  target_user_id: number;
  action_type: string;
  duration_days: number | null;
  reason: string;
  metadata: any;
  created_at: string;
  moderator: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  target_user: {
    id: number;
    name: string;
    email: string;
  };
}

interface PaginatedResponse {
  data: ModerationLog[];
  current_page: number;
  last_page: number;
  total: number;
}

const AdminModerationActivity: React.FC = () => {
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  useEffect(() => {
    fetchLogs();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchLogs(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [currentPage]);

  const fetchLogs = async (silent = false) => {
    try {
      if (!silent) {
        setRefreshing(true);
      }

      const userStr = localStorage.getItem('admin_auth');
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const token = user.token;

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/admin/moderation-activity?page=${currentPage}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch moderation logs');

      const data: PaginatedResponse = await response.json();
      setLogs(data.data);
      setCurrentPage(data.current_page);
      setTotalPages(data.last_page);
      setTotalLogs(data.total);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load moderation logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    fetchLogs();
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

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'warn':
        return <AlertTriangle size={20} className="text-amber-600" />;
      case 'ban':
        return <Ban size={20} className="text-red-600" />;
      case 'unban':
        return <UserCheck size={20} className="text-green-600" />;
      case 'suspend':
        return <UserX size={20} className="text-orange-600" />;
      case 'unsuspend':
        return <UserCheck size={20} className="text-blue-600" />;
      case 'role_change':
        return <Shield size={20} className="text-purple-600" />;
      case 'password_reset':
        return <RefreshCw size={20} className="text-indigo-600" />;
      case 'group_approved':
        return <UserCheck size={20} className="text-teal-600" />;
      case 'group_rejected':
        return <Ban size={20} className="text-pink-600" />;
      default:
        return <Shield size={20} className="text-slate-600" />;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'warn':
        return 'bg-amber-50 border-amber-200';
      case 'ban':
        return 'bg-red-50 border-red-200';
      case 'unban':
        return 'bg-green-50 border-green-200';
      case 'suspend':
        return 'bg-orange-50 border-orange-200';
      case 'unsuspend':
        return 'bg-blue-50 border-blue-200';
      case 'role_change':
        return 'bg-purple-50 border-purple-200';
      case 'password_reset':
        return 'bg-indigo-50 border-indigo-200';
      case 'group_approved':
        return 'bg-teal-50 border-teal-200';
      case 'group_rejected':
        return 'bg-pink-50 border-pink-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'warn':
        return 'Warning Issued';
      case 'ban':
        return 'User Banned';
      case 'unban':
        return 'User Unbanned';
      case 'suspend':
        return 'User Suspended';
      case 'unsuspend':
        return 'Suspension Lifted';
      case 'role_change':
        return 'Role Changed';
      case 'password_reset':
        return 'Password Reset';
      case 'group_approved':
        return 'Group Approved';
      case 'group_rejected':
        return 'Group Rejected';
      default:
        return actionType;
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900">Activity Log</h1>
              <p className="text-slate-500 font-medium">
                {totalLogs} total moderation actions logged
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
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 size={32} className="animate-spin text-purple-600 mx-auto mb-4" />
              <p className="text-slate-600 font-bold">Loading activity...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center">
              <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-bold">No moderation activity yet</p>
              <p className="text-sm text-slate-400 mt-1">Actions will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-6 border-l-4 ${getActionColor(log.action_type)} hover:brightness-95 dark:hover:brightness-125 transition-all`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-white dark:bg-slate-200 rounded-lg flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-300">
                      {getActionIcon(log.action_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-black text-slate-900">{getActionLabel(log.action_type)}</span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-sm text-slate-500 font-medium">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-bold text-slate-600">Moderator:</span>
                          <span className="text-slate-900 font-medium">{log.moderator.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            log.moderator.role === 'admin'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {log.moderator.role}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-bold text-slate-600">Target:</span>
                          <span className="text-slate-900 font-medium">{log.target_user.name}</span>
                          <span className="text-xs text-slate-400">({log.target_user.email})</span>
                        </div>

                        {log.duration_days && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-bold text-slate-600">Duration:</span>
                            <span className="text-slate-900 font-medium">{log.duration_days} days</span>
                          </div>
                        )}

                        {log.reason && (
                          <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-200 rounded-xl border border-slate-200 dark:border-slate-300">
                            <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Reason</p>
                            <p className="text-sm text-slate-700 font-medium">{log.reason}</p>
                          </div>
                        )}

                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div className="mt-2">
                            <details className="text-xs text-slate-500">
                              <summary className="cursor-pointer font-bold hover:text-slate-700">Additional Details</summary>
                              <pre className="mt-2 p-2 bg-slate-50 rounded text-xs overflow-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </details>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600 font-medium">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg font-bold text-sm hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminModerationActivity;
