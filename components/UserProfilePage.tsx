
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User } from '../types';
import {
  Book, Users, AlertTriangle, Award, MapPin, Mail, Loader2, ArrowLeft, Ban,
  X, Clock, Calendar, TrendingUp, TrendingDown, Shield, CheckCircle2, Lock, Star
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { apiService } from '../services/apiService';
import { API_CONFIG } from '../constants';

type ModalType = 'groups' | 'meetings' | 'warnings' | 'karma' | null;

function timeLeft(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h left`;
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

const UserProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [details, setDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const [userData, userStats] = await Promise.all([
          apiService.getUserById(parseInt(userId)),
          apiService.getUserStats(parseInt(userId))
        ]);
        setUser(userData);
        setStats(userStats);
      } catch (err) {
        console.error("Failed to load user profile", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUserProfile();
  }, [userId]);

  const openModal = async (type: ModalType) => {
    if (!user?.privacy_stats) return;
    setActiveModal(type);
    if (!details) {
      setLoadingDetails(true);
      try {
        const data = await apiService.getUserDetails(parseInt(userId!));
        setDetails(data);
      } catch (err) {
        console.error("Failed to load user details", err);
      } finally {
        setLoadingDetails(false);
      }
    }
  };

  const closeModal = () => setActiveModal(null);

  const warningStatus = user?.banned
    ? { label: 'Status', value: 'BANNED', icon: <Ban className="text-red-500" />, color: 'text-red-600', modalKey: 'warnings' as ModalType }
    : { label: 'Warnings', value: `${user?.warnings || 0}/3`, icon: <AlertTriangle className="text-amber-500" />, color: (user?.warnings || 0) >= 2 ? 'text-amber-600' : 'text-slate-900', modalKey: 'warnings' as ModalType };

  const statCards = [
    { label: 'Groups', value: stats?.groups_joined || '0', icon: <Users className="text-orange-500" />, color: 'text-slate-900', modalKey: 'groups' as ModalType },
    { label: 'Meetings', value: stats?.study_hours || '0', icon: <Book className="text-blue-500" />, color: 'text-slate-900', modalKey: 'meetings' as ModalType },
    warningStatus,
    { label: 'Karma Points', value: stats?.karma || '0', icon: <Award className="text-emerald-500" />, color: 'text-slate-900', modalKey: 'karma' as ModalType },
  ];

  const activityData = stats?.activity?.map((val: number, i: number) => ({
    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
    'karma pts': val
  })) || [];

  const statsPrivate    = user ? user.privacy_stats === false : false;
  const activityPrivate = stats?.activity_private || (user ? user.privacy_activity === false : false);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="animate-spin text-orange-500" size={40} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-64 flex flex-col items-center justify-center space-y-4">
        <p className="text-slate-600 font-bold">User not found</p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all"
        >
          Go Back
        </button>
      </div>
    );
  }

  const ModalShell = ({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-slate-800 p-8 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">{icon}</div>
            <div>
              <h3 className="text-2xl font-black tracking-tight">{title}</h3>
              <p className="text-slate-300 text-sm font-bold mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button onClick={closeModal} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl transition-all">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-8 space-y-6">
          {loadingDetails ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-orange-500" size={36} />
            </div>
          ) : children}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold transition-colors mb-4"
      >
        <ArrowLeft size={20} />
        Back
      </button>

      <div className="relative">
        <div className="h-48 w-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-[3rem] shadow-xl shadow-orange-100"></div>
        <div className="absolute top-8 left-12 flex flex-col md:flex-row items-start gap-6 w-[calc(100%-6rem)]">
          <div className="w-32 h-32 bg-white rounded-[2.5rem] p-2 shadow-2xl shrink-0 overflow-hidden">
            {user.avatar
              ? <img src={`${API_CONFIG.STORAGE_URL}/${user.avatar}`} alt={user.name} className="w-full h-full rounded-[2rem] object-cover" />
              : <div className="w-full h-full bg-orange-100 rounded-[2rem] flex items-center justify-center text-orange-600 text-4xl font-black border border-orange-200">{user.name[0]}</div>
            }
          </div>
          <div className="mt-12 space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-black text-white tracking-tight">{user.name}</h1>
              {user.role === 'admin' && (
                <span className="px-3 py-1 bg-purple-500 text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-lg">Admin</span>
              )}
              {user.role === 'moderator' && (
                <span className="px-3 py-1 bg-blue-500 text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-lg">Moderator</span>
              )}
              {user.role === 'leader' && (
                <span className="px-3 py-1 bg-amber-500 text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-lg">Leader</span>
              )}
              {user.role === 'member' && (
                <span className="px-3 py-1 bg-slate-500 text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-lg">Member</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-white font-bold text-sm">
              <div className="flex items-center gap-1.5"><MapPin size={14} className="text-white" /> {user.location || 'Location not set'}</div>
              <div className="flex items-center gap-1.5"><Mail size={14} className="text-white" /> {user.email}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-20 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Personal Details</h2>
            <div className="space-y-6">
              <div className="space-y-1 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Major</span>
                <p className="font-bold text-slate-800">{user.major || 'Not specified'}</p>
              </div>
              <div className="space-y-1 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bio</span>
                <p className="text-sm font-medium text-slate-500 leading-relaxed italic">
                  {user.bio ? `"${user.bio}"` : 'No bio available'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {statCards.map((stat, idx) => (
              statsPrivate ? (
                <div
                  key={idx}
                  className={`bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-center ${stat.label === 'Status' && user.banned ? 'border-red-200 bg-red-50' : ''}`}
                >
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                    {stat.icon}
                  </div>
                  <h4 className={`text-2xl font-black ${stat.color || 'text-slate-900'}`}>{stat.value}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
                  <div className="flex items-center justify-center gap-1 mt-1.5">
                    <Lock size={10} className="text-slate-300" />
                    <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider">Private</span>
                  </div>
                </div>
              ) : (
                <button
                  key={idx}
                  onClick={() => openModal(stat.modalKey)}
                  className={`bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-center group hover:border-orange-300 hover:shadow-md transition-all cursor-pointer ${stat.label === 'Status' && user.banned ? 'border-red-200 bg-red-50' : ''}`}
                >
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-orange-50 transition-colors">
                    {stat.icon}
                  </div>
                  <h4 className={`text-2xl font-black ${stat.color || 'text-slate-900'}`}>{stat.value}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
                </button>
              )
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm h-full">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mb-8">Weekly Activity</h2>
            {activityPrivate ? (
              <div className="h-[300px] flex flex-col items-center justify-center gap-3">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                  <Lock size={24} className="text-slate-300" />
                </div>
                <p className="text-slate-500 font-bold text-sm">Activity is private</p>
                <p className="text-slate-300 text-xs font-medium">This user has hidden their weekly activity.</p>
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityData}>
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 700 }}
                    />
                    <Bar dataKey="karma pts" radius={[8, 8, 8, 8]} barSize={40}>
                      {activityData.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={index === 5 || index === 6 ? '#F97316' : '#f1f5f9'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-8 flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                  <Award size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Karma Points</h4>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Community Contributions</p>
                </div>
              </div>
              <span className="text-4xl font-black text-orange-500">{stats?.karma || 0}</span>
            </div>

            {stats?.leader_total_ratings > 0 && (
              <div className="mt-4 flex items-center justify-between p-6 bg-amber-50 rounded-3xl border border-amber-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                    <Star size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Leader Rating</h4>
                    <div className="flex items-center gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star
                          key={s}
                          size={14}
                          className={s <= Math.round(stats.leader_avg_rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-300 fill-slate-300'}
                        />
                      ))}
                      <span className="text-xs font-bold text-slate-400 ml-1 uppercase tracking-widest">{stats.leader_total_ratings} {stats.leader_total_ratings === 1 ? 'review' : 'reviews'}</span>
                    </div>
                  </div>
                </div>
                <span className="text-4xl font-black text-amber-500">{stats.leader_avg_rating?.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Groups Modal */}
      {activeModal === 'groups' && (
        <ModalShell title={`${user.name}'s Groups`} subtitle="Groups created and joined" icon={<Users size={22} />}>
          {details && (
            <div className="space-y-8">
              <section>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Created ({details.created_groups?.length || 0})</h4>
                {details.created_groups?.length === 0 ? (
                  <p className="text-slate-400 text-sm font-medium">No groups created yet.</p>
                ) : (
                  <div className="space-y-3">
                    {details.created_groups?.map((g: any) => (
                      <div key={g.id} className="flex items-center justify-between p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                        <div>
                          <p className="font-black text-slate-900">{g.name}</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">{g.subject} · {g.members_count ?? '–'} members</p>
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-lg ${g.status === 'open' ? 'bg-green-100 text-green-700' : g.status === 'archived' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'}`}>
                          {g.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Joined ({details.joined_groups?.length || 0})</h4>
                {details.joined_groups?.length === 0 ? (
                  <p className="text-slate-400 text-sm font-medium">No groups joined yet.</p>
                ) : (
                  <div className="space-y-3">
                    {details.joined_groups?.map((g: any) => (
                      <div key={g.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                        <div>
                          <p className="font-black text-slate-900">{g.name}</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">{g.subject} · Led by {g.creator?.name}</p>
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-lg ${g.status === 'open' ? 'bg-green-100 text-green-700' : g.status === 'archived' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'}`}>
                          {g.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </ModalShell>
      )}

      {/* Meetings Modal */}
      {activeModal === 'meetings' && (
        <ModalShell title="Meetings" subtitle="Upcoming and past study sessions" icon={<Calendar size={22} />}>
          {details && (
            <div className="space-y-8">
              <section>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Upcoming ({details.upcoming_meetings?.length || 0})</h4>
                {details.upcoming_meetings?.length === 0 ? (
                  <p className="text-slate-400 text-sm font-medium">No upcoming meetings.</p>
                ) : (
                  <div className="space-y-3">
                    {details.upcoming_meetings?.map((e: any) => (
                      <div key={e.id} className="flex items-start justify-between p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                        <div>
                          <p className="font-black text-slate-900">{e.title}</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">{e.group?.name}</p>
                          <div className="flex items-center gap-1 mt-1 text-blue-600">
                            <Clock size={11} />
                            <span className="text-[11px] font-bold">{formatDate(e.start_time)}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-3 py-1 rounded-lg uppercase tracking-wider shrink-0">{timeLeft(e.start_time)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Past Meetings ({details.finished_meetings?.length || 0})</h4>
                {details.finished_meetings?.length === 0 ? (
                  <p className="text-slate-400 text-sm font-medium">No past meetings.</p>
                ) : (
                  <div className="space-y-3">
                    {details.finished_meetings?.map((e: any) => (
                      <div key={e.id} className="flex items-start justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                        <div>
                          <p className="font-black text-slate-700">{e.title}</p>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">{e.group?.name}</p>
                          <div className="flex items-center gap-1 mt-1 text-slate-400">
                            <Clock size={11} />
                            <span className="text-[11px] font-bold">{formatDate(e.start_time)}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-lg uppercase tracking-wider shrink-0">Done</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </ModalShell>
      )}

      {/* Warnings Modal */}
      {activeModal === 'warnings' && (
        <ModalShell title="Warnings & Status" subtitle="Account standing" icon={<Shield size={22} />}>
          {details && (
            <div className="space-y-6">
              {details.suspension && (
                <div className="p-5 bg-red-50 border border-red-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-500" />
                    <span className="text-sm font-black text-red-600 uppercase tracking-widest">Currently Suspended</span>
                  </div>
                  <p className="text-xs text-red-500 font-medium">Reason: {details.suspension.reason || 'No reason provided'}</p>
                  <div className="flex items-center gap-1.5 text-red-600">
                    <Clock size={13} />
                    <span className="text-sm font-black">{timeLeft(details.suspension.suspended_until)} · Expires {formatDate(details.suspension.suspended_until)}</span>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <AlertTriangle size={22} className="text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-black text-amber-600">{user.warnings || 0}<span className="text-slate-400 text-base font-bold">/3</span></p>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active Warnings</p>
                </div>
              </div>
              <section>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Warning History ({details.warnings?.length || 0})</h4>
                {details.warnings?.length === 0 ? (
                  <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-2xl">
                    <CheckCircle2 size={18} className="text-green-500" />
                    <p className="text-sm font-bold text-green-700">No warnings on record.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {details.warnings?.map((w: any, i: number) => (
                      <div key={i} className={`p-4 rounded-2xl border ${w.is_active ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-bold text-slate-800">{w.reason}</p>
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg shrink-0 ${w.is_active ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                            {w.is_active ? 'Active' : 'Expired'}
                          </span>
                        </div>
                        {w.is_active && w.expires_at && (
                          <div className="flex items-center gap-1 mt-2 text-amber-600">
                            <Clock size={11} />
                            <span className="text-[11px] font-bold">{timeLeft(w.expires_at)} · Expires {formatDate(w.expires_at)}</span>
                          </div>
                        )}
                        {!w.is_active && w.expires_at && (
                          <p className="text-[11px] text-slate-400 font-medium mt-1">Expired {formatDate(w.expires_at)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </ModalShell>
      )}

      {/* Karma Modal */}
      {activeModal === 'karma' && (
        <ModalShell title="Karma Points" subtitle="Contribution log" icon={<Award size={22} />}>
          {details && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl mb-2">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Award size={22} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-black text-emerald-600">{stats?.karma || 0}</p>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Karma Points</p>
                </div>
              </div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Activity</h4>
              {details.karma_logs?.length === 0 ? (
                <p className="text-slate-400 text-sm font-medium">No karma activity yet.</p>
              ) : (
                <div className="space-y-2">
                  {details.karma_logs?.map((log: any, i: number) => (
                    <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border ${log.points > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${log.points > 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                          {log.points > 0
                            ? <TrendingUp size={15} className="text-emerald-600" />
                            : <TrendingDown size={15} className="text-red-500" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{log.reason}</p>
                          <p className="text-[11px] text-slate-400 font-medium">{formatDate(log.created_at)}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-black shrink-0 ${log.points > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {log.points > 0 ? '+' : ''}{log.points}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ModalShell>
      )}
    </div>
  );
};

export default UserProfilePage;
