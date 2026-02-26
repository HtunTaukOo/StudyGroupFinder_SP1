import React, { useState, useEffect } from 'react';
import { Star, Users, Trash2, Search, Filter, Loader2, TrendingUp, RefreshCw, Clock } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { API_CONFIG } from '../../constants';

interface Rating {
  id: string;
  group_rating: number;
  leader_rating: number;
  update_count: number;
  user: {
    id: string;
    name: string;
    email: string;
  };
  group: {
    id: string;
    name: string;
  };
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse {
  data: Rating[];
  current_page: number;
  last_page: number;
  total: number;
}

const AdminRatings: React.FC = () => {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRatings, setTotalRatings] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [minRatingFilter, setMinRatingFilter] = useState('');
  const [ratingTypeFilter, setRatingTypeFilter] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchRatings();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchRatings(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [currentPage, searchTerm, minRatingFilter, ratingTypeFilter]);

  const fetchRatings = async (silent = false) => {
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
        ...(minRatingFilter && { min_rating: minRatingFilter }),
        ...(ratingTypeFilter && { rating_type: ratingTypeFilter }),
      });

      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/ratings?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch ratings');

      const data: PaginatedResponse = await response.json();
      setRatings(data.data);
      setCurrentPage(data.current_page);
      setTotalPages(data.last_page);
      setTotalRatings(data.total);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load ratings:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    fetchRatings();
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

  const handleDelete = async (ratingId: string) => {
    if (!confirm('Are you sure you want to delete this rating? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(ratingId);
      const userStr = localStorage.getItem('admin_auth');
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const token = user.token;

      const response = await fetch(`${API_CONFIG.BASE_URL}/admin/ratings/${ratingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to delete rating');

      alert('Rating deleted successfully');
      fetchRatings();
    } catch (err) {
      console.error('Failed to delete rating:', err);
      alert('Failed to delete rating');
    } finally {
      setDeleting(null);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
            className={star <= rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}
          />
        ))}
        <span className="ml-1 text-sm font-bold text-slate-700">{rating.toFixed(1)}</span>
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getAverageRating = (groupRating: number, leaderRating: number) => {
    return ((groupRating + leaderRating) / 2).toFixed(1);
  };

  if (loading && ratings.length === 0) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-purple-600 animate-spin mx-auto mb-4" />
            <p className="text-slate-600 font-bold">Loading ratings...</p>
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
              <h2 className="text-2xl font-black text-slate-900">Ratings Management</h2>
              <p className="text-sm text-slate-500 font-medium mt-1">
                Manage all group and leader ratings ({totalRatings} total)
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
                placeholder="Search by user name or group name..."
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
                value={ratingTypeFilter}
                onChange={(e) => {
                  setRatingTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-purple-400 focus:outline-none font-medium text-sm appearance-none bg-white"
              >
                <option value="">All Types</option>
                <option value="group">Group Ratings Only</option>
                <option value="leader">Leader Ratings Only</option>
              </select>
            </div>
            <div className="relative">
              <Star className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <select
                value={minRatingFilter}
                onChange={(e) => {
                  setMinRatingFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-purple-400 focus:outline-none font-medium text-sm appearance-none bg-white"
              >
                <option value="">All Ratings</option>
                <option value="4">4+ Stars</option>
                <option value="3">3+ Stars</option>
                <option value="2">2+ Stars</option>
                <option value="1">1+ Stars</option>
              </select>
            </div>
          </div>
        </div>

        {/* Ratings List */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
          {ratings.length === 0 ? (
            <div className="p-12 text-center">
              <Star className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-bold">No ratings found</p>
              <p className="text-sm text-slate-400 mt-1">
                {searchTerm || minRatingFilter || ratingTypeFilter ? 'Try adjusting your filters' : 'Ratings will appear here'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">
                      Reviewer
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">
                      Group Rated
                    </th>
                    {(ratingTypeFilter === '' || ratingTypeFilter === 'group') && (
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">
                        Group Rating
                      </th>
                    )}
                    {(ratingTypeFilter === '' || ratingTypeFilter === 'leader') && (
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">
                        Leader Rating
                      </th>
                    )}
                    {ratingTypeFilter === '' && (
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">
                        Average
                      </th>
                    )}
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-black text-slate-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {ratings.map((rating) => (
                    <tr key={rating.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{rating.user.name}</p>
                          <p className="text-xs text-slate-500">{rating.user.email}</p>
                          {rating.update_count > 0 && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold">
                              Updated {rating.update_count}x
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Users size={14} className="text-emerald-500" />
                          <span className="text-sm font-bold text-slate-900">{rating.group.name}</span>
                        </div>
                      </td>
                      {(ratingTypeFilter === '' || ratingTypeFilter === 'group') && (
                        <td className="px-6 py-4">
                          {renderStars(rating.group_rating)}
                        </td>
                      )}
                      {(ratingTypeFilter === '' || ratingTypeFilter === 'leader') && (
                        <td className="px-6 py-4">
                          {renderStars(rating.leader_rating)}
                        </td>
                      )}
                      {ratingTypeFilter === '' && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <TrendingUp size={14} className="text-purple-500" />
                            <span className="text-sm font-black text-purple-600">
                              {getAverageRating(rating.group_rating, rating.leader_rating)}
                            </span>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600 font-medium">
                          <div>{formatDate(rating.created_at)}</div>
                          {rating.updated_at !== rating.created_at && (
                            <div className="text-xs text-slate-400">
                              Updated: {formatDate(rating.updated_at)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(rating.id)}
                          disabled={deleting === rating.id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all font-bold text-sm disabled:opacity-50"
                        >
                          {deleting === rating.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          Delete
                        </button>
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
    </AdminLayout>
  );
};

export default AdminRatings;
