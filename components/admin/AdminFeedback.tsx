import React, { useState, useEffect } from 'react';
import { Star, Trash2, Loader2, MessageSquare, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { API_CONFIG } from '../../constants';

interface FeedbackData {
  id: number;
  user_name: string;
  user_email: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface PaginatedResponse {
  data: FeedbackData[];
  current_page: number;
  last_page: number;
  total: number;
}

const AdminFeedback: React.FC = () => {
  const [feedback, setFeedback] = useState<FeedbackData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFeedback, setTotalFeedback] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    fetchFeedback();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchFeedback(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [currentPage]);

  const fetchFeedback = async (silent = false) => {
    try {
      if (!silent) {
        setRefreshing(true);
      }

      const userStr = localStorage.getItem('admin_auth');
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const token = user.token;

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/admin/feedback?page=${currentPage}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch feedback');

      const data: PaginatedResponse = await response.json();
      setFeedback(data.data);
      setCurrentPage(data.current_page);
      setTotalPages(data.last_page);
      setTotalFeedback(data.total);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load feedback:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    fetchFeedback();
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
        `${API_CONFIG.BASE_URL}/admin/feedback/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to delete feedback');

      alert('Feedback deleted successfully!');
      setDeleteConfirm(null);
      fetchFeedback();
    } catch (err: any) {
      alert(err.message || 'Failed to delete feedback');
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            className={star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}
          />
        ))}
      </div>
    );
  };

  const averageRating = feedback.length > 0
    ? (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1)
    : '0.0';

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900">Feedback Management</h1>
              <p className="text-slate-500 font-medium">
                {totalFeedback} total feedback submissions
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

          {/* Stats */}
          <div className="flex gap-4">
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Average Rating</p>
              <div className="flex items-center gap-2">
                <Star size={20} className="text-amber-400 fill-amber-400" />
                <span className="text-2xl font-black text-slate-900">{averageRating}</span>
                <span className="text-sm text-slate-500">/  5.0</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Grid */}
        <div className="grid gap-6">
          {loading ? (
            <div className="bg-white rounded-2xl border-2 border-slate-200 p-12 text-center">
              <Loader2 size={32} className="animate-spin text-purple-600 mx-auto mb-4" />
              <p className="text-slate-600 font-bold">Loading feedback...</p>
            </div>
          ) : feedback.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-slate-200 p-12 text-center">
              <MessageSquare size={48} className="text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-bold">No feedback received yet</p>
            </div>
          ) : (
            <>
              {feedback.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm hover:shadow-lg transition-all overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center font-bold text-lg">
                          {item.user_name[0]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{item.user_name}</p>
                          <p className="text-sm text-slate-500">{item.user_email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setDeleteConfirm(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete feedback"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      {renderStars(item.rating)}
                      <span className="text-sm font-bold text-slate-600">
                        {item.rating} out of 5
                      </span>
                      <span className="text-sm text-slate-400">
                        • {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {item.comment && (
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <p className="text-slate-700 leading-relaxed">{item.comment}</p>
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-red-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900 text-center mb-2">Delete Feedback?</h3>
              <p className="text-slate-600 text-center mb-6">
                This action cannot be undone. This feedback will be permanently removed.
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

export default AdminFeedback;
