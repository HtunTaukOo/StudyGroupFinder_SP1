
import React, { useState, useEffect, useRef } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { HashRouter, Routes, Route, Navigate, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Home,
  Users,
  AlertTriangle,
  Calendar as CalendarIcon,
  User as UserIcon,
  Settings,
  LogOut,
  Search,
  Bell,
  Menu,
  X,
  Trophy
} from 'lucide-react';

import HomePage from './components/HomePage';
import GroupsPage from './components/GroupsPage';
import ReportPage from './components/ReportPage';
import CalendarPage from './components/CalendarPage';
import ProfilePage from './components/ProfilePage';
import UserProfilePage from './components/UserProfilePage';
import SettingsPage from './components/SettingsPage';
import LeadersPage from './components/LeadersPage';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import EmailVerifyPage from './components/EmailVerifyPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import NotificationDropdown from './components/NotificationDropdown';
import EmailVerificationBanner from './components/EmailVerificationBanner';
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './components/admin/AdminDashboard';
import AdminUsers from './components/admin/AdminUsers';
import AdminGroups from './components/admin/AdminGroups';
import AdminReports from './components/admin/AdminReports';
import AdminAnalytics from './components/admin/AdminAnalytics';
import AdminModerationActivity from './components/admin/AdminModerationActivity';

import { User, AppNotification } from './types';
import { apiService } from './services/apiService';
import { API_CONFIG } from './constants';

const SidebarLink: React.FC<{ to: string; icon: React.ReactNode; label: string }> = ({ to, icon, label }) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isActive = location.pathname === to;

  // Preserve search query across sidebar navigation
  const q = searchParams.get('q');
  const destination = q ? `${to}?q=${encodeURIComponent(q)}` : to;

  return (
    <Link
      to={destination}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        isActive
          ? 'bg-orange-500 text-white shadow-lg shadow-orange-200'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {icon}
      <span className="font-semibold">{label}</span>
    </Link>
  );
};

// Shared AudioContext — must be created/resumed during a user gesture
// to satisfy browser autoplay policy. We create it once on first click.
let sharedAudioCtx: AudioContext | null = null;

export const initAudioContext = () => {
  try {
    if (!sharedAudioCtx) {
      sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }
  } catch {
    // Ignore if AudioContext is unavailable
  }
};

export const playNotificationSound = () => {
  const ctx = sharedAudioCtx;
  if (!ctx || ctx.state !== 'running') return;
  try {
    const playTone = (freq: number, startTime: number, duration: number, volume: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    // Two-tone chime: A5 then C#6
    playTone(880, ctx.currentTime, 0.35, 0.18);
    playTone(1108.73, ctx.currentTime + 0.12, 0.45, 0.14);
  } catch {
    // Ignore audio errors
  }
};

const Layout: React.FC<{ children: React.ReactNode; user: User; onLogout: () => void; showSearch?: boolean; pageTitle?: string; pageSubtitle?: string }> = ({ children, user, onLogout, showSearch = false, pageTitle, pageSubtitle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isNotifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevUnreadCount = useRef<number | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';

  // Live search state
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchedUsers, setSearchedUsers] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const handleNotificationClick = (notification: AppNotification) => {
    // Navigate to the relevant group chat for message/group-related notifications
    if (notification.data.group_id) {
      setNotifOpen(false);
      navigate(`/groups?group=${notification.data.group_id}`);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  // Unlock AudioContext on first user interaction (browser autoplay policy)
  useEffect(() => {
    const unlock = () => {
      initAudioContext();
      document.removeEventListener('click', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };
    document.addEventListener('click', unlock, true);
    document.addEventListener('keydown', unlock, true);
    return () => {
      document.removeEventListener('click', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch live search results as user types
  useEffect(() => {
    const fetchLiveResults = async () => {
      if (!searchQuery || searchQuery.length < 2) {
        setSearchResults([]);
        setSearchedUsers([]);
        setShowSearchDropdown(false);
        return;
      }

      setSearchLoading(true);
      try {
        const [groupsResult, usersResult] = await Promise.allSettled([
          apiService.getGroups(),
          apiService.searchUsers(searchQuery)
        ]);

        const groups = groupsResult.status === 'fulfilled' ? groupsResult.value : [];
        const users = usersResult.status === 'fulfilled' && Array.isArray(usersResult.value) ? usersResult.value : [];

        if (usersResult.status === 'rejected') {
          console.error('User search failed:', usersResult.reason);
        }

        const filteredGroups = groups.filter(g => {
          const q = searchQuery.toLowerCase();
          return (
            g.name.toLowerCase().includes(q) ||
            g.subject.toLowerCase().includes(q) ||
            g.faculty.toLowerCase().includes(q) ||
            g.description.toLowerCase().includes(q) ||
            g.creator_name.toLowerCase().includes(q) ||
            g.location.toLowerCase().includes(q)
          );
        }).slice(0, 5);

        const filteredUsers = users.slice(0, 5);

        setSearchResults(filteredGroups);
        setSearchedUsers(filteredUsers);
        setShowSearchDropdown(filteredGroups.length > 0 || filteredUsers.length > 0);
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
        setSearchedUsers([]);
      } finally {
        setSearchLoading(false);
      }
    };

    // Only fetch for live dropdown, not when in full search mode
    const isInSearchMode = searchParams.get('searchMode') === 'full';
    if (!isInSearchMode) {
      const debounce = setTimeout(fetchLiveResults, 300);
      return () => clearTimeout(debounce);
    }
  }, [searchQuery, searchParams]);

  const fetchNotifications = async () => {
    try {
      const [list, countData] = await Promise.all([
        apiService.getNotifications(),
        apiService.getUnreadCount()
      ]);

      // Merge new notifications with existing read ones to persist read messages
      setNotifications(prev => {
        const newIds = new Set(list.map(n => n.id));
        const existingRead = prev.filter(n => n.read_at && !newIds.has(n.id));
        return [...list, ...existingRead].sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });

      const newCount = countData.count;
      // Play sound only when unread count increases (skip on first load)
      if (prevUnreadCount.current !== null && newCount > prevUnreadCount.current) {
        if (localStorage.getItem('notification_sound') !== 'false') {
          playNotificationSound();
        }
      }
      prevUnreadCount.current = newCount;
      setUnreadCount(newCount);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  };

  const markAllRead = async () => {
    try {
      await apiService.markNotificationsAsRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const currentParams = Object.fromEntries(searchParams.entries());

    if (val) {
      // Remove searchMode when typing (back to live dropdown)
      const { searchMode, ...rest } = currentParams;
      setSearchParams({ ...rest, q: val });
    } else {
      const { q, searchMode, ...rest } = currentParams;
      setSearchParams(rest);
      setShowSearchDropdown(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery) {
      // Enter key: trigger full search mode
      const currentParams = Object.fromEntries(searchParams.entries());
      setSearchParams({ ...currentParams, searchMode: 'full' });
      setShowSearchDropdown(false);

      // Navigate to home page if not already there
      if (location.pathname !== '/home') {
        navigate(`/home?q=${encodeURIComponent(searchQuery)}&searchMode=full`);
      }
    }
  };

  const handleResultClick = (group: any) => {
    setShowSearchDropdown(false);

    // Search for the clicked group and enter full search mode
    const searchTerm = group.name;
    setSearchParams({ q: searchTerm, searchMode: 'full' });

    // Navigate to home page if not already there
    if (location.pathname !== '/home') {
      navigate(`/home?q=${encodeURIComponent(searchTerm)}&searchMode=full`);
    }
  };

  const handleUserClick = (user: any) => {
    setShowSearchDropdown(false);
    navigate(`/profile/${user.id}`);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-orange-200">AU</div>
            <div className="flex flex-col">
              <span className="font-extrabold text-slate-900 leading-none">StudyHub</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Study Group Finder</span>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <SidebarLink to="/home" icon={<Home size={20} />} label="Home" />
          <SidebarLink to="/groups" icon={<Users size={20} />} label="My Groups" />
          <SidebarLink to="/report" icon={<AlertTriangle size={20} />} label="Report User" />
          <SidebarLink to="/calendar" icon={<CalendarIcon size={20} />} label="Calendar" />
          <SidebarLink to="/leaders" icon={<Trophy size={20} />} label="Contributors" />
          <SidebarLink to="/profile" icon={<UserIcon size={20} />} label="Profile" />
          <SidebarLink to="/settings" icon={<Settings size={20} />} label="Settings" />
        </nav>

        <div className="p-4 mt-auto">
          <button
            onClick={onLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors font-semibold"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg">
              <Menu className="w-6 h-6 text-slate-600" />
            </button>
            {showSearch && (
              <div className="relative w-full max-w-md" ref={searchRef}>
                <div className="flex items-center bg-slate-100 px-4 py-2 rounded-xl w-full border border-slate-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
                  <Search className={`w-5 h-5 transition-colors ${searchQuery ? 'text-orange-500' : 'text-slate-400'}`} />
                  <input
                    type="text"
                    placeholder="Search groups and users..."
                    className="bg-transparent border-none outline-none ml-3 w-full text-slate-600 placeholder:text-slate-400 font-medium"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onKeyDown={handleSearchKeyDown}
                  />
                </div>

                {/* Live Search Dropdown */}
                {showSearchDropdown && searchQuery && location.pathname !== '/groups' && (
                  <div className="absolute top-full mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-3 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Quick Results
                      </p>
                    </div>

                    {searchLoading ? (
                      <div className="p-8 text-center">
                        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                      </div>
                    ) : (searchResults.length > 0 || searchedUsers.length > 0) ? (
                      <div className="max-h-80 overflow-y-auto">
                        {/* Groups Section */}
                        {searchResults.length > 0 && (
                          <div>
                            <div className="px-4 py-2 bg-slate-50/50">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Groups</p>
                            </div>
                            {searchResults.map((group) => (
                              <button
                                key={group.id}
                                onClick={() => handleResultClick(group)}
                                className="w-full px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center font-bold text-sm shrink-0">
                                    {group.name[0]}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-slate-900 truncate text-sm">{group.name}</h4>
                                    <p className="text-xs text-slate-500 truncate">{group.subject} • {group.faculty}</p>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Users Section */}
                        {searchedUsers.length > 0 && (
                          <div>
                            <div className="px-4 py-2 bg-slate-50/50">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Users</p>
                            </div>
                            {searchedUsers.map((user) => (
                              <button
                                key={user.id}
                                onClick={() => handleUserClick(user)}
                                className="w-full px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-b-0"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center font-bold text-sm shrink-0">
                                    {user.name[0]}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-slate-900 truncate text-sm">{user.name}</h4>
                                    <p className="text-xs text-slate-500 truncate">{user.major || 'Student'}</p>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-6 text-center">
                        <p className="text-sm text-slate-400">No results found</p>
                      </div>
                    )}

                    <div className="p-3 bg-slate-50 border-t border-slate-100">
                      <p className="text-xs text-slate-500">
                        Press <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold">Enter</kbd> to see all results
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {pageTitle && (
              <div className="ml-4">
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{pageTitle}</h1>
                {pageSubtitle && <p className="text-xs text-slate-500 font-medium">{pageSubtitle}</p>}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!isNotifOpen)}
                className={`p-2 hover:bg-slate-100 rounded-xl relative transition-all ${isNotifOpen ? 'bg-slate-50 text-slate-900' : 'text-slate-400'}`}
              >
                <Bell size={22} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-orange-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-black text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {isNotifOpen && (
                <NotificationDropdown
                  notifications={notifications}
                  onMarkRead={markAllRead}
                  onClose={() => setNotifOpen(false)}
                  onNotificationClick={handleNotificationClick}
                  onRefresh={fetchNotifications}
                />
              )}
            </div>
            <div className="h-10 w-[1px] bg-slate-200 mx-2 hidden sm:block"></div>
            <Link to="/profile" className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-xl transition-all">
              <div className="w-9 h-9 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center font-bold text-sm border border-orange-200 overflow-hidden">
                {user.avatar
                  ? <img src={`${API_CONFIG.STORAGE_URL}/${user.avatar}`} alt={user.name} className="w-full h-full object-cover" />
                  : user.name[0]
                }
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-sm font-bold text-slate-900 leading-none">{user.name}</span>
                <span className="text-[10px] font-semibold text-slate-400 mt-1">{user.major || 'Student'}</span>
              </div>
            </Link>
          </div>
        </header>

        <EmailVerificationBanner />

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

const isAdminAuth = (): boolean => {
  try {
    const saved = localStorage.getItem('admin_auth');
    if (!saved) return false;
    const u = JSON.parse(saved);
    return ['admin', 'moderator'].includes(u?.role);
  } catch { return false; }
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Force re-render when admin logs in (without changing main site user)
  const [, setAdminTrigger] = useState(0);
  useEffect(() => {
    const handleAdminAuth = () => setAdminTrigger(c => c + 1);
    window.addEventListener('admin_auth_change', handleAdminAuth);
    return () => window.removeEventListener('admin_auth_change', handleAdminAuth);
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('auth_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('auth_user');
  };

  const handleUserUpdate = (updatedUser: User) => {
    const newUser = { ...user, ...updatedUser };
    setUser(newUser);
    localStorage.setItem('auth_user', JSON.stringify(newUser));
  };

  return (
    <ThemeProvider>
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={user ? <Navigate to="/home" /> : <LoginPage onLogin={handleLogin} />} />
        <Route path="/signup" element={user ? <Navigate to="/home" /> : <SignupPage onSignup={handleLogin} />} />
        <Route path="/email/verify/:id/:hash" element={<EmailVerifyPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route path="/home" element={
          user ? <Layout user={user} onLogout={handleLogout} showSearch={true}><HomePage /></Layout> : <Navigate to="/login" />
        } />
        <Route path="/groups" element={
          user ? <Layout user={user} onLogout={handleLogout} showSearch={true}><GroupsPage /></Layout> : <Navigate to="/login" />
        } />
        <Route path="/report" element={
          user ? <Layout user={user} onLogout={handleLogout} pageTitle="Report User" pageSubtitle="Help us maintain a safe community"><ReportPage /></Layout> : <Navigate to="/login" />
        } />
        <Route path="/calendar" element={
          user ? <Layout user={user} onLogout={handleLogout} pageTitle="Calendar" pageSubtitle="Manage your study schedule"><CalendarPage /></Layout> : <Navigate to="/login" />
        } />
        <Route path="/leaders" element={
          user ? <Layout user={user} onLogout={handleLogout}><LeadersPage /></Layout> : <Navigate to="/login" />
        } />
        <Route path="/profile" element={
          user ? <Layout user={user} onLogout={handleLogout} pageTitle="Profile" pageSubtitle="View and edit your information"><ProfilePage user={user} onUserUpdate={handleUserUpdate} /></Layout> : <Navigate to="/login" />
        } />
        <Route path="/profile/:userId" element={
          user ? <Layout user={user} onLogout={handleLogout}><UserProfilePage /></Layout> : <Navigate to="/login" />
        } />
        <Route path="/settings" element={
          user ? <Layout user={user} onLogout={handleLogout} pageTitle="Settings" pageSubtitle="Manage your experience and data"><SettingsPage /></Layout> : <Navigate to="/login" />
        } />

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={
          isAdminAuth() ? <AdminDashboard /> : <Navigate to="/admin/login" />
        } />
        <Route path="/admin/users" element={
          isAdminAuth() ? <AdminUsers /> : <Navigate to="/admin/login" />
        } />
        <Route path="/admin/groups" element={
          isAdminAuth() ? <AdminGroups /> : <Navigate to="/admin/login" />
        } />
        <Route path="/admin/reports" element={
          isAdminAuth() ? <AdminReports /> : <Navigate to="/admin/login" />
        } />
        <Route path="/admin/analytics" element={
          isAdminAuth() ? <AdminAnalytics /> : <Navigate to="/admin/login" />
        } />
        <Route path="/admin/moderation" element={
          isAdminAuth() ? <AdminModerationActivity /> : <Navigate to="/admin/login" />
        } />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" />} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
    </ThemeProvider>
  );
};

export default App;
