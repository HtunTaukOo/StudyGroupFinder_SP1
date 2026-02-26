import React, { useState, useEffect } from 'react';
import { Trophy, Loader2, Award, TrendingUp, Info, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/apiService';

interface Leader {
  id: number;
  name: string;
  email: string;
  major: string;
  role: string;
  karma_points: number;
  weekly_active_hours: number;
}

const LeadersPage: React.FC = () => {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showKarmaModal, setShowKarmaModal] = useState(false);

  useEffect(() => {
    loadLeaders();
  }, []);

  const loadLeaders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getLeaders();
      setLeaders(data);
    } catch (err: any) {
      console.error("Failed to load contributors:", err);
      setError("Could not load leaderboard data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-[2.5rem] p-6 sm:p-12 text-white shadow-xl shadow-orange-200">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center shrink-0">
              <Trophy size={24} className="text-white sm:hidden" />
              <Trophy size={32} className="text-white hidden sm:block" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">Top Contributors</h1>
              <p className="text-orange-100 font-medium text-sm sm:text-lg mt-1">
                Most active members in our community
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowKarmaModal(true)}
            className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors shrink-0"
            title="How Karma Points Work"
          >
            <Info size={20} className="text-white" />
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 p-6 rounded-2xl text-red-800">
          <p className="font-bold">{error}</p>
          <button onClick={loadLeaders} className="mt-3 text-xs font-black uppercase tracking-widest underline decoration-2 underline-offset-4">
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 size={48} className="animate-spin text-orange-500" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading Leaderboard...</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[560px]">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-slate-200">
                <th className="px-4 sm:px-8 py-4 sm:py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Rank</th>
                <th className="px-4 sm:px-8 py-4 sm:py-5 text-xs font-black text-slate-400 uppercase tracking-widest">User</th>
                <th className="px-4 sm:px-8 py-4 sm:py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Major</th>
                <th className="px-4 sm:px-8 py-4 sm:py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Role</th>
                <th className="px-4 sm:px-8 py-4 sm:py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Karma</th>
              </tr>
            </thead>
            <tbody>
              {leaders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center">
                    <Trophy size={48} className="mx-auto mb-4 text-slate-200" />
                    <p className="font-bold text-slate-400">No contributors yet.</p>
                    <p className="text-sm text-slate-400 mt-2">Be the first to earn karma points!</p>
                  </td>
                </tr>
              ) : (
                leaders.map((user, idx) => {
                  const medal = getMedalIcon(idx + 1);
                  const isTopThree = idx < 3;

                  return (
                    <tr
                      key={user.id}
                      className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                        isTopThree ? 'bg-orange-50/30' : ''
                      }`}
                    >
                      <td className="px-4 sm:px-8 py-4 sm:py-6">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-10 h-10 flex items-center justify-center rounded-xl font-bold text-sm ${
                              idx === 0
                                ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg shadow-orange-200'
                                : idx === 1
                                ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-lg shadow-slate-200'
                                : idx === 2
                                ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-lg shadow-amber-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          {medal && <span className="text-2xl">{medal}</span>}
                        </div>
                      </td>
                      <td className="px-4 sm:px-8 py-4 sm:py-6">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <Link
                            to={`/profile/${user.id}`}
                            className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center font-bold text-orange-600 border border-orange-100 cursor-pointer hover:scale-105 transition-transform"
                          >
                            {user.name[0]}
                          </Link>
                          <div>
                            <Link
                              to={`/profile/${user.id}`}
                              className="font-bold text-slate-900 hover:text-orange-500 transition-colors cursor-pointer text-lg"
                            >
                              {user.name}
                            </Link>
                            <p className="text-xs text-slate-400 font-semibold">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-8 py-4 sm:py-6">
                        <span className="text-sm font-semibold text-slate-600">
                          {user.major || 'Student'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-8 py-4 sm:py-6">
                        <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : user.role === 'moderator'
                            ? 'bg-blue-100 text-blue-700'
                            : user.role === 'leader'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {user.role || 'member'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-8 py-4 sm:py-6 text-right">
                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-100 rounded-xl">
                          <Award className="text-orange-500" size={16} />
                          <span className="font-black text-slate-900">
                            {user.karma_points.toLocaleString()}
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Karma System Modal */}
      {showKarmaModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg sm:max-w-4xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-5 sm:p-8 flex justify-between items-center text-white gap-4">
              <div className="min-w-0">
                <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight">How Karma Points Work</h2>
                <p className="text-orange-100 font-medium mt-1 text-sm sm:text-base hidden sm:block">Earn karma by being an active and positive member of the community</p>
              </div>
              <button
                onClick={() => setShowKarmaModal(false)}
                className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors shrink-0"
              >
                <X size={20} className="text-white" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-8 overflow-y-auto max-h-[calc(90vh-100px)] space-y-6">
              {/* Earning Karma Section */}
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-emerald-700 flex items-center gap-2">
                  <span className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-black text-sm">+</span>
                  Earning Karma (Positive Actions)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Create Group</p>
                      <span className="text-emerald-600 font-black">+20</span>
                    </div>
                    <p className="text-sm text-slate-600">Start a new study group</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Join Group</p>
                      <span className="text-emerald-600 font-black">+10</span>
                    </div>
                    <p className="text-sm text-slate-600">Join an existing study group</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Gain Member</p>
                      <span className="text-emerald-600 font-black">+15</span>
                    </div>
                    <p className="text-sm text-slate-600">Leader gains a new member</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Create Event</p>
                      <span className="text-emerald-600 font-black">+15</span>
                    </div>
                    <p className="text-sm text-slate-600">Schedule a study meeting</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Upload File</p>
                      <span className="text-emerald-600 font-black">+10</span>
                    </div>
                    <p className="text-sm text-slate-600">Share study materials</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Send Message</p>
                      <span className="text-emerald-600 font-black">+5</span>
                    </div>
                    <p className="text-sm text-slate-600">Participate in group chat</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Good Rating</p>
                      <span className="text-emerald-600 font-black">+10</span>
                    </div>
                    <p className="text-sm text-slate-600">Receive 4-5 star rating</p>
                  </div>
                </div>
              </div>

              {/* Losing Karma Section */}
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-red-700 flex items-center gap-2">
                  <span className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center text-white font-black text-sm">−</span>
                  Losing Karma (Negative Actions)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-red-600 uppercase tracking-widest">Banned</p>
                      <span className="text-red-600 font-black">-50</span>
                    </div>
                    <p className="text-sm text-slate-600">Permanent account ban</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-red-600 uppercase tracking-widest">30-Day Suspension</p>
                      <span className="text-red-600 font-black">-30</span>
                    </div>
                    <p className="text-sm text-slate-600">Long suspension period</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-red-600 uppercase tracking-widest">7-Day Suspension</p>
                      <span className="text-red-600 font-black">-20</span>
                    </div>
                    <p className="text-sm text-slate-600">Week suspension period</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-red-600 uppercase tracking-widest">Kicked from Group</p>
                      <span className="text-red-600 font-black">-20</span>
                    </div>
                    <p className="text-sm text-slate-600">Removed by group leader</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-red-600 uppercase tracking-widest">Warning</p>
                      <span className="text-red-600 font-black">-15</span>
                    </div>
                    <p className="text-sm text-slate-600">Receive moderator warning</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-red-600 uppercase tracking-widest">3-Day Suspension</p>
                      <span className="text-red-600 font-black">-10</span>
                    </div>
                    <p className="text-sm text-slate-600">Short suspension period</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-red-600 uppercase tracking-widest">Lose Member</p>
                      <span className="text-red-600 font-black">-10</span>
                    </div>
                    <p className="text-sm text-slate-600">Leader loses a member</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-red-600 uppercase tracking-widest">Leave Group</p>
                      <span className="text-red-600 font-black">-5</span>
                    </div>
                    <p className="text-sm text-slate-600">Voluntarily exit a group</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-red-600 uppercase tracking-widest">Bad Rating</p>
                      <span className="text-red-600 font-black">-5</span>
                    </div>
                    <p className="text-sm text-slate-600">Receive 1-2 star rating</p>
                  </div>
                </div>
              </div>

              {/* Info Note */}
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <p className="text-sm text-orange-800 font-semibold text-center">
                  💡 <strong>Pro Tip:</strong> Stay active, be helpful, maintain good conduct, and lead quality study groups to maximize your karma points!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadersPage;
