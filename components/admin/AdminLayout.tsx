import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, UsersIcon, AlertTriangle, BarChart3, LogOut, Shield, Menu, X, Bell, FileText, Sun, Moon } from 'lucide-react';
import NotificationDropdown from '../NotificationDropdown';
import { AppNotification } from '../../types';
import { API_CONFIG } from '../../constants';
import { apiService } from '../../services/apiService';
import { useTheme } from '../../contexts/ThemeContext';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [adminUser, setAdminUser] = useState<{ name: string; role: string } | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    // Get admin user info from localStorage
    const adminAuth = localStorage.getItem('admin_auth');
    if (adminAuth) {
      const authData = JSON.parse(adminAuth);
      setAdminUser({ name: authData.name, role: authData.role });
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      // Get auth token
      const authData = localStorage.getItem('admin_auth');
      const token = authData ? JSON.parse(authData).token : null;

      if (!token) {
        console.error('No admin auth token found');
        return;
      }

      // Use admin-specific notification endpoints
      const [listResponse, countResponse] = await Promise.all([
        fetch('${API_CONFIG.BASE_URL}/admin/notifications', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        }),
        fetch('${API_CONFIG.BASE_URL}/admin/notifications/unread-count', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        })
      ]);

      if (!listResponse.ok || !countResponse.ok) {
        console.error('Failed to fetch notifications:', listResponse.status, countResponse.status);
        return;
      }

      const list = await listResponse.json();
      const countData = await countResponse.json();

      // Ensure list is an array
      if (!Array.isArray(list)) {
        console.error('Notifications response is not an array:', list);
        return;
      }

      setNotifications(prev => {
        const newIds = new Set(list.map((n: AppNotification) => n.id));
        const existingRead = prev.filter(n => n.read_at && !newIds.has(n.id));
        return [...list, ...existingRead].sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
      setUnreadCount(countData.count);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  };

  const markAllRead = async () => {
    try {
      // Get auth token
      const authData = localStorage.getItem('admin_auth');
      const token = authData ? JSON.parse(authData).token : null;

      if (!token) {
        console.error('No admin auth token found');
        return;
      }

      // Use admin-specific mark-read endpoint
      await fetch('${API_CONFIG.BASE_URL}/admin/notifications/mark-read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_auth');
    navigate('/admin/login');
  };

  const navItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/users', icon: Users, label: 'User Management' },
    { path: '/admin/groups', icon: UsersIcon, label: 'Group Management' },
    { path: '/admin/reports', icon: AlertTriangle, label: 'User Reports' },
    { path: '/admin/moderation', icon: FileText, label: 'Activity Log' },
    { path: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-purple-900 to-purple-950 text-white flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-purple-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center shadow-lg">
              <Shield size={24} />
            </div>
            <div>
              <h1 className="font-black text-lg leading-none">Admin Panel</h1>
              <p className="text-xs text-purple-300 font-bold mt-1">StudyHub Management</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-purple-500 text-white shadow-lg'
                    : 'text-purple-200 hover:bg-purple-800/50 hover:text-white'
                }`}
              >
                <item.icon size={20} />
                <span className="font-bold">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-purple-800/50">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-purple-200 hover:bg-purple-800/50 hover:text-white rounded-xl transition-all font-bold"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-20 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-6 h-6 text-slate-600" />
            </button>
            <div>
              <h2 className="text-xl font-black text-slate-900">
                {navItems.find(item => item.path === location.pathname)?.label || 'Admin Panel'}
              </h2>
              <p className="text-sm text-slate-500 font-medium">
                Manage and monitor your StudyHub platform
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-700"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
            </button>
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!isNotifOpen)}
                className={`p-2 hover:bg-slate-100 rounded-xl relative transition-all ${isNotifOpen ? 'bg-slate-50 text-slate-900' : 'text-slate-400'}`}
              >
                <Bell size={22} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-purple-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-black text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {isNotifOpen && (
                <NotificationDropdown
                  notifications={notifications}
                  onMarkRead={markAllRead}
                  onClose={() => setNotifOpen(false)}
                  onRefresh={fetchNotifications}
                />
              )}
            </div>
            <div className="h-10 w-[1px] bg-slate-200 mx-2 hidden sm:block"></div>
            <div className="px-4 py-2 bg-purple-50 border border-purple-200 rounded-xl">
              {adminUser && (
                <div className="flex flex-col items-end">
                  <p className="text-xs font-black text-purple-900 leading-tight">{adminUser.name}</p>
                  <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest">
                    {adminUser.role}
                  </p>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
