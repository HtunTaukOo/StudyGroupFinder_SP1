import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, UsersIcon, MessageSquare, BarChart3, Loader2, RefreshCw, Clock, Star, Calendar, Activity, Percent, AlertTriangle, BookOpen } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import AdminLayout from './AdminLayout';
import { API_CONFIG } from '../../constants';

interface AnalyticsData {
  user_growth: Array<{ date: string; count: number }>;
  group_growth: Array<{ date: string; count: number }>;
  message_activity: Array<{ date: string; count: number }>;
  rating_activity: Array<{ date: string; count: number }>;
  event_activity: Array<{ date: string; count: number }>;
  top_groups: Array<{ id: string; name: string; members_count: number }>;
  top_subjects: Array<{ subject: string; count: number }>;
  most_reported_users: Array<{ user_id: number; name: string; email: string; report_count: number }>;
  report_severity_distribution: Array<{ priority: string; count: number }>;
  groups_by_faculty?: Array<{ faculty: string; count: number; percent: number }>;
  user_retention_rate: number;
  peak_activity_hours: Array<{ hour: number; count: number }>;
  peak_activity_days: Array<{ day: number; day_name: string; count: number }>;
  most_active_day_for_events: Array<{ day: number; day_name: string; count: number }>;
  most_active_time_for_events: Array<{ hour: number; count: number }>;
  average_group_size: number;
  time_range: string;
  karma_over_time: Array<{ date: string; earned: number; deducted: number }>;
  karma_by_reason: Array<{ reason: string; occurrences: number; total_points: number }>;
  top_karma_users: Array<{ id: number; name: string; karma_points: number }>;
  users_by_major?: Array<{ major: string; count: number }>;
}

const AdminAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeRange, setTimeRange] = useState('monthly');

  useEffect(() => {
    fetchAnalytics();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchAnalytics(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchAnalytics = async (silent = false) => {
    try {
      if (!silent) {
        setRefreshing(true);
      }

      const userStr = localStorage.getItem('admin_auth');
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const token = user.token;

      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/analytics?range=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch analytics');

      const data = await response.json();
      setAnalytics(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    fetchAnalytics();
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

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 size={48} className="text-purple-600 animate-spin mx-auto mb-4" />
            <p className="text-slate-600 font-bold">Loading analytics...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-slate-200">
          <p className="font-bold text-slate-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Merge user and group growth data
  const mergeGrowthData = () => {
    if (!analytics) return [];

    const dateMap = new Map<string, { date: string; users: number; groups: number }>();

    // Add user data
    analytics.user_growth.forEach(item => {
      dateMap.set(item.date, { date: item.date, users: item.count, groups: 0 });
    });

    // Add group data
    analytics.group_growth.forEach(item => {
      const existing = dateMap.get(item.date);
      if (existing) {
        existing.groups = item.count;
      } else {
        dateMap.set(item.date, { date: item.date, users: 0, groups: item.count });
      }
    });

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  };

  // Merge activity data (messages, ratings, events)
  const mergeActivityData = () => {
    if (!analytics) return [];

    const dateMap = new Map<string, { date: string; messages: number; ratings: number; events: number }>();

    // Add message data
    analytics.message_activity.forEach(item => {
      dateMap.set(item.date, { date: item.date, messages: item.count, ratings: 0, events: 0 });
    });

    // Add rating data
    analytics.rating_activity.forEach(item => {
      const existing = dateMap.get(item.date);
      if (existing) {
        existing.ratings = item.count;
      } else {
        dateMap.set(item.date, { date: item.date, messages: 0, ratings: item.count, events: 0 });
      }
    });

    // Add event data
    analytics.event_activity.forEach(item => {
      const existing = dateMap.get(item.date);
      if (existing) {
        existing.events = item.count;
      } else {
        dateMap.set(item.date, { date: item.date, messages: 0, ratings: 0, events: item.count });
      }
    });

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Analytics & Insights</h1>
            <p className="text-slate-500 font-medium">Platform performance metrics and trends</p>
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

        {/* Time Range Filter */}
        <div className="flex items-center gap-3 bg-white rounded-2xl border-2 border-slate-200 p-2 shadow-sm w-fit">
          {[
            { value: 'daily', label: 'Daily (24h)' },
            { value: 'weekly', label: 'Weekly (7d)' },
            { value: 'monthly', label: 'Monthly (30d)' }
          ].map((range) => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                timeRange === range.value
                  ? 'bg-purple-500 text-white shadow-lg'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>

        {/* Key Metrics */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {analytics.user_retention_rate !== undefined && (
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Percent size={24} />
                  <h3 className="font-black">Retention Rate</h3>
                </div>
                <p className="text-4xl font-black mb-1">{analytics.user_retention_rate.toFixed(1)}%</p>
                <p className="text-purple-100 text-sm font-medium">
                  Users active in last {timeRange === 'daily' ? '24 hours' : timeRange === 'weekly' ? '7 days' : '30 days'}
                </p>
              </div>
            )}
            {analytics.average_group_size !== undefined && (
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Users size={24} />
                  <h3 className="font-black">Average Group Size</h3>
                </div>
                <p className="text-4xl font-black mb-1">{analytics.average_group_size.toFixed(1)}</p>
                <p className="text-blue-100 text-sm font-medium">Members per study group</p>
              </div>
            )}
          </div>
        )}

        {/* Growth Trends - Line Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User & Group Growth Line Chart */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <TrendingUp className="text-purple-600" size={24} />
                <div>
                  <h3 className="font-black text-slate-900">Platform Growth</h3>
                  <p className="text-sm text-slate-500">Users and groups over time</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mergeGrowthData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    stroke="#64748b"
                    style={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <YAxis stroke="#64748b" style={{ fontSize: '12px', fontWeight: 'bold' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '14px', fontWeight: 'bold' }} />
                  <Line type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={3} name="Users" dot={{ fill: '#3b82f6', r: 4 }} />
                  <Line type="monotone" dataKey="groups" stroke="#8b5cf6" strokeWidth={3} name="Groups" dot={{ fill: '#8b5cf6', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Activity Trends Area Chart */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <Activity className="text-purple-600" size={24} />
                <div>
                  <h3 className="font-black text-slate-900">Activity Trends</h3>
                  <p className="text-sm text-slate-500">Messages, ratings, and events</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={mergeActivityData()}>
                  <defs>
                    <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRatings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    stroke="#64748b"
                    style={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <YAxis stroke="#64748b" style={{ fontSize: '12px', fontWeight: 'bold' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '14px', fontWeight: 'bold' }} />
                  <Area type="monotone" dataKey="messages" stroke="#f97316" fillOpacity={1} fill="url(#colorMessages)" name="Messages" />
                  <Area type="monotone" dataKey="ratings" stroke="#10b981" fillOpacity={1} fill="url(#colorRatings)" name="Ratings" />
                  <Area type="monotone" dataKey="events" stroke="#3b82f6" fillOpacity={1} fill="url(#colorEvents)" name="Events" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Peak Activity Times & Groups by Faculty */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Peak Activity Times */}
          {analytics?.peak_activity_hours && analytics.peak_activity_hours.length > 0 && (
            <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm">
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <Clock className="text-purple-600" size={24} />
                  <div>
                    <h3 className="font-black text-slate-900">Peak Activity Hours</h3>
                    <p className="text-sm text-slate-500">Most active hours of the day</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.peak_activity_hours}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(value) => `${value}:00`}
                      stroke="#64748b"
                      style={{ fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <YAxis stroke="#64748b" style={{ fontSize: '12px', fontWeight: 'bold' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} name="Activity" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Groups by Faculty Pie Chart */}
          {analytics?.groups_by_faculty && analytics.groups_by_faculty.length > 0 && (
            <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm">
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <UsersIcon className="text-purple-600" size={24} />
                  <div>
                    <h3 className="font-black text-slate-900">Groups by Faculty</h3>
                    <p className="text-sm text-slate-500">Distribution across faculties</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.groups_by_faculty}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) => `${entry.faculty}: ${(entry.percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="faculty"
                    >
                      {analytics.groups_by_faculty.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Top Subjects Bar Chart */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <BarChart3 className="text-purple-600" size={24} />
              <div>
                <h3 className="font-black text-slate-900">Top Subjects</h3>
                <p className="text-sm text-slate-500">Most popular study subjects</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            {analytics?.top_subjects && analytics.top_subjects.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.top_subjects} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" style={{ fontSize: '12px', fontWeight: 'bold' }} />
                  <YAxis
                    type="category"
                    dataKey="subject"
                    stroke="#64748b"
                    style={{ fontSize: '12px', fontWeight: 'bold' }}
                    width={100}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 8, 8, 0]} name="Groups" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-slate-400 font-medium">No groups yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Peak Meeting Times & Report Severity Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Peak Meeting Times */}
          {analytics?.most_active_time_for_events && analytics.most_active_time_for_events.length > 0 && (
            <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm">
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <Clock className="text-purple-600" size={24} />
                  <div>
                    <h3 className="font-black text-slate-900">Peak Meeting Times</h3>
                    <p className="text-sm text-slate-500">Most common hours for scheduled meetings</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.most_active_time_for_events}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(value) => `${value}:00`}
                      stroke="#64748b"
                      style={{ fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <YAxis stroke="#64748b" style={{ fontSize: '12px', fontWeight: 'bold' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="#10b981" radius={[8, 8, 0, 0]} name="Meetings" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Report Severity Distribution */}
          {analytics?.report_severity_distribution && analytics.report_severity_distribution.length > 0 && (
            <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm">
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="text-purple-600" size={24} />
                  <div>
                    <h3 className="font-black text-slate-900">Report Severity Distribution</h3>
                    <p className="text-sm text-slate-500">Reports by priority level</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.report_severity_distribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) => `${entry.priority}: ${entry.count}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="priority"
                    >
                      {analytics.report_severity_distribution.map((entry, index) => {
                        const priorityColors: Record<string, string> = {
                          urgent: '#ef4444',
                          high: '#f97316',
                          medium: '#f59e0b',
                          low: '#3b82f6'
                        };
                        return (
                          <Cell key={`cell-${index}`} fill={priorityColors[entry.priority] || COLORS[index % COLORS.length]} />
                        );
                      })}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* ── Users by Major ── */}
        {analytics?.users_by_major && analytics.users_by_major.length > 0 && (
          <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <BookOpen className="text-teal-600" size={24} />
                <div>
                  <h3 className="font-black text-slate-900">Users by Major</h3>
                  <p className="text-sm text-slate-500">Top 10 most common student majors</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.users_by_major} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" style={{ fontSize: '12px', fontWeight: 'bold' }} />
                  <YAxis
                    type="category"
                    dataKey="major"
                    stroke="#64748b"
                    style={{ fontSize: '12px', fontWeight: 'bold' }}
                    width={120}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#14b8a6" radius={[0, 8, 8, 0]} name="Students" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Karma Over Time ── */}
        {analytics?.karma_over_time && (
          <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <TrendingUp className="text-emerald-600" size={24} />
                <div>
                  <h3 className="font-black text-slate-900">Karma Over Time</h3>
                  <p className="text-sm text-slate-500">Points earned vs deducted per day</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {analytics.karma_over_time.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.karma_over_time}>
                    <defs>
                      <linearGradient id="colorEarned" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDeducted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      stroke="#64748b"
                      style={{ fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <YAxis stroke="#64748b" style={{ fontSize: '12px', fontWeight: 'bold' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '14px', fontWeight: 'bold' }} />
                    <Area type="monotone" dataKey="earned" stroke="#10b981" fillOpacity={1} fill="url(#colorEarned)" name="Earned" />
                    <Area type="monotone" dataKey="deducted" stroke="#ef4444" fillOpacity={1} fill="url(#colorDeducted)" name="Deducted" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px]">
                  <p className="text-slate-400 font-medium">No karma activity in this period</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminAnalytics;
