import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, Trash2, Search, Filter, Loader2, Clock, Repeat, RefreshCw, Edit2, X } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { API_CONFIG } from '../../constants';

interface Event {
  id: string;
  title: string;
  type: string;
  start_time: string;
  location: string | null;
  recurrence: string;
  recurrence_count: number | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
  group: {
    id: string;
    name: string;
  } | null;
  created_at: string;
}

interface PaginatedResponse {
  data: Event[];
  current_page: number;
  last_page: number;
  total: number;
}

const AdminEvents: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('upcoming');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEvents();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchEvents(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [currentPage, searchTerm, typeFilter, statusFilter]);

  const fetchEvents = async (silent = false) => {
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
        per_page: '20',
        ...(searchTerm && { search: searchTerm }),
        ...(typeFilter && { type: typeFilter }),
        ...(statusFilter && { status: statusFilter }),
      });

      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/events?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch events');

      const data: PaginatedResponse = await response.json();
      setEvents(data.data);
      setCurrentPage(data.current_page);
      setTotalPages(data.last_page);
      setTotalEvents(data.total);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    fetchEvents();
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

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this meeting? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(eventId);
      const userStr = localStorage.getItem('admin_auth');
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const token = user.token;

      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to delete meeting');

      alert('Meeting deleted successfully');
      fetchEvents();
    } catch (err) {
      console.error('Failed to delete meeting:', err);
      alert('Failed to delete meeting');
    } finally {
      setDeleting(null);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    try {
      setSaving(true);
      const userStr = localStorage.getItem('admin_auth');
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const token = user.token;

      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/events/${editingEvent.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editingEvent.title,
          type: editingEvent.type,
          start_time: editingEvent.start_time,
          location: editingEvent.location || null,
          recurrence: editingEvent.recurrence,
          recurrence_count: editingEvent.recurrence_count || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to update meeting');

      alert('Meeting updated successfully');
      setEditingEvent(null);
      fetchEvents();
    } catch (err) {
      console.error('Failed to update meeting:', err);
      alert('Failed to update meeting');
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getEventTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      'General': 'bg-slate-100 text-slate-700',
      'Project': 'bg-blue-100 text-blue-700',
      'Group Meeting': 'bg-purple-100 text-purple-700',
      'Exam': 'bg-red-100 text-red-700',
      'Assignment': 'bg-orange-100 text-orange-700',
    };
    return colors[type] || 'bg-slate-100 text-slate-700';
  };

  if (loading && events.length === 0) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-purple-600 animate-spin mx-auto mb-4" />
            <p className="text-slate-600 font-bold">Loading meetings...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Meetings Management</h2>
              <p className="text-sm text-slate-500 font-medium mt-1">
                Manage all calendar meetings ({totalEvents} total)
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

          {/* Search and Filters */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search by title, location, creator, or group..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-purple-400 focus:outline-none font-medium text-sm"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-purple-400 focus:outline-none font-medium text-sm appearance-none bg-white"
              >
                <option value="">All Meeting Types</option>
                <option value="General">General</option>
                <option value="Project">Project</option>
                <option value="Group Meeting">Group Meeting</option>
                <option value="Exam">Exam</option>
                <option value="Assignment">Assignment</option>
              </select>
            </div>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-purple-400 focus:outline-none font-medium text-sm appearance-none bg-white"
              >
                <option value="">All Meetings</option>
                <option value="upcoming">Upcoming</option>
                <option value="past">Past (Done)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Meetings List */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
          {events.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-bold">No meetings found</p>
              <p className="text-sm text-slate-400 mt-1">
                {searchTerm || typeFilter ? 'Try adjusting your filters' : 'Meetings will appear here'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">
                      Meeting Details
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">
                      Creator
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">
                      Group
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-black text-slate-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {events.map((event) => {
                    const isPast = new Date(event.start_time) < new Date();
                    return (
                    <tr key={event.id} className={`hover:bg-slate-50 transition-colors ${isPast ? 'opacity-60' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className={isPast ? 'text-slate-400' : 'text-purple-500'} />
                            <span className="font-bold text-slate-900">{event.title}</span>
                            {isPast && (
                              <span className="px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded text-[10px] font-black uppercase tracking-wider">Done</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${getEventTypeColor(event.type)}`}>
                              {event.type}
                            </span>
                            {event.recurrence !== 'none' && event.recurrence_count && (
                              <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                                <Repeat size={12} />
                                {event.recurrence} ({event.recurrence_count}x)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          <Clock size={14} className="text-slate-400" />
                          {formatDateTime(event.start_time)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {event.location ? (
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-emerald-500" />
                            <span className="text-sm font-medium text-slate-700">{event.location}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">No location</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{event.user.name}</p>
                          <p className="text-xs text-slate-500">{event.user.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {event.group ? (
                          <div className="flex items-center gap-2">
                            <Users size={14} className="text-emerald-500" />
                            <span className="text-sm font-bold text-slate-900">{event.group.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">Personal Event</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditingEvent(event)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all font-bold text-sm"
                          >
                            <Edit2 size={14} />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(event.id)}
                            disabled={deleting === event.id}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all font-bold text-sm disabled:opacity-50"
                          >
                            {deleting === event.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
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
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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

      {/* Edit Event Modal */}
      {editingEvent && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-purple-600 p-6 text-white flex justify-between items-center sticky top-0">
              <h3 className="text-xl font-black">Edit Event</h3>
              <button onClick={() => setEditingEvent(null)} className="hover:bg-purple-700 rounded-lg p-1 transition-all">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Event Title</label>
                <input
                  type="text"
                  required
                  value={editingEvent.title}
                  onChange={e => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Event Type</label>
                <select
                  value={editingEvent.type}
                  onChange={e => setEditingEvent({ ...editingEvent, type: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-purple-500"
                >
                  <option value="General">General</option>
                  <option value="Project">Project</option>
                  <option value="Group Meeting">Group Meeting</option>
                  <option value="Exam">Exam</option>
                  <option value="Assignment">Assignment</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={editingEvent.start_time.slice(0, 16)}
                  onChange={e => setEditingEvent({ ...editingEvent, start_time: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Location (Optional)</label>
                <input
                  type="text"
                  value={editingEvent.location || ''}
                  onChange={e => setEditingEvent({ ...editingEvent, location: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Recurrence</label>
                <select
                  value={editingEvent.recurrence}
                  onChange={e => setEditingEvent({ ...editingEvent, recurrence: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-purple-500"
                >
                  <option value="none">One-time (No repeat)</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {editingEvent.recurrence !== 'none' && (
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Recurrence Count</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={editingEvent.recurrence_count || ''}
                    onChange={e => setEditingEvent({ ...editingEvent, recurrence_count: parseInt(e.target.value) || null })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-purple-500"
                  />
                </div>
              )}

              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Event Info</p>
                <div className="text-sm space-y-1">
                  <p><span className="font-bold">Creator:</span> {editingEvent.user.name}</p>
                  <p><span className="font-bold">Group:</span> {editingEvent.group ? editingEvent.group.name : 'Personal Event'}</p>
                  <p><span className="font-bold">Created:</span> {new Date(editingEvent.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminEvents;
