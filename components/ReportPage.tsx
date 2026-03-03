
import React, { useState, useEffect } from 'react';
import { AlertTriangle, Send, Search, Loader2, Shield, User as UserIcon } from 'lucide-react';
import { Report } from '../types';
import { apiService } from '../services/apiService';
import { API_CONFIG } from '../constants';

const ReportPage: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newReport, setNewReport] = useState({ severity: 3, description: '', reason: '' });
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem('auth_user');
    if (saved) setCurrentUser(JSON.parse(saved));
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const response = await apiService.getMyReports();
      console.log("Raw reports data from backend:", response);

      // Handle paginated response
      const reportsData = (response as any).data || response;

      if (Array.isArray(reportsData) && reportsData.length > 0) {
        console.log("First report structure:", reportsData[0]);
      }

      setReports(reportsData as any);
    } catch (err) {
      console.error("Failed to load reports", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const users = await apiService.searchUsers(query);
      // Filter out current user from search results
      setSearchResults(users.filter((u: any) => u.id !== currentUser?.id));
    } catch (err) {
      console.error("Failed to search users", err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleUserSelect = (user: any) => {
    setSelectedUser(user);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newReport.reason || !newReport.description) {
      alert("Please select a user, choose a reason, and provide details");
      return;
    }

    setSubmitting(true);
    try {
      // Map frontend reason to backend reason format
      const reasonMap: Record<string, string> = {
        'Harassment': 'harassment',
        'Inappropriate Content': 'inappropriate_content',
        'Spam': 'spam',
        'Impersonation': 'fake_profile',
        'Hate Speech': 'harassment',
        'Violence': 'harassment',
        'Privacy Violation': 'inappropriate_content',
        'Other': 'other'
      };

      // Map severity (1-5) to priority
      const priorityMap: Record<number, string> = {
        1: 'low',
        2: 'low',
        3: 'medium',
        4: 'high',
        5: 'urgent'
      };

      await apiService.submitReport({
        reported_user_id: selectedUser.id,
        reason: reasonMap[newReport.reason] || 'other',
        description: newReport.description,
        priority: priorityMap[newReport.severity] || 'medium'
      });

      setNewReport({ severity: 3, description: '', reason: '' });
      setSelectedUser(null);
      alert("Report submitted successfully. Admin will review it shortly.");
      await loadReports();
    } catch (err: any) {
      alert("Error submitting report: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityBadge = (severity: number) => {
    const colors = [
      'bg-slate-100 text-slate-600',
      'bg-blue-100 text-blue-600',
      'bg-yellow-100 text-yellow-600',
      'bg-orange-100 text-orange-600',
      'bg-red-100 text-red-600'
    ];
    const labels = ['Minor', 'Low', 'Medium', 'High', 'Critical'];
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${colors[severity - 1] || colors[2]}`}>
        {labels[severity - 1] || 'Medium'}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Submit Report Form - Fixed on left */}
        <div className="lg:col-span-2">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-lg sticky top-20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <Shield className="text-red-600" size={20} />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Submit Report</h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* User Search & Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                  Select User to Report
                </label>

                {selectedUser ? (
                  <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center font-bold shrink-0 overflow-hidden">
                        {selectedUser.avatar
                          ? <img src={`${API_CONFIG.STORAGE_URL}/${selectedUser.avatar}`} alt={selectedUser.name} className="w-full h-full object-cover" />
                          : selectedUser.name[0]
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate">{selectedUser.name}</p>
                        <p className="text-xs text-slate-500 truncate">{selectedUser.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="text-xs font-bold text-red-600 hover:text-red-700 uppercase tracking-widest shrink-0"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-500">
                      <Search size={18} className="text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by name or email..."
                        className="bg-transparent border-none outline-none ml-3 w-full text-sm font-bold"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                      />
                    </div>
                    {searching && (
                      <div className="absolute top-full mt-2 w-full bg-white border border-slate-200 rounded-2xl p-4 shadow-xl z-10">
                        <div className="flex items-center justify-center gap-2 text-slate-400">
                          <Loader2 size={16} className="animate-spin" />
                          <span className="text-sm font-medium">Searching...</span>
                        </div>
                      </div>
                    )}
                    {searchResults.length > 0 && (
                      <div className="absolute top-full mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-xl z-10 max-h-64 overflow-y-auto">
                        {searchResults.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => handleUserSelect(user)}
                            className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-all border-b border-slate-100 last:border-0"
                          >
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-bold shrink-0 overflow-hidden">
                              {user.avatar
                                ? <img src={`${API_CONFIG.STORAGE_URL}/${user.avatar}`} alt={user.name} className="w-full h-full object-cover" />
                                : user.name[0]
                              }
                            </div>
                            <div className="text-left flex-1 min-w-0">
                              <p className="font-bold text-slate-900 text-sm truncate">{user.name}</p>
                              <p className="text-xs text-slate-500 truncate">{user.email}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Reason Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Report Reason</label>
                <select
                  required
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all outline-none text-sm font-bold appearance-none cursor-pointer"
                  value={newReport.reason}
                  onChange={(e) => setNewReport({...newReport, reason: e.target.value})}
                >
                  <option value="">Select a reason...</option>
                  <option value="Harassment">Harassment or Bullying</option>
                  <option value="Inappropriate Content">Inappropriate Content</option>
                  <option value="Spam">Spam or Advertising</option>
                  <option value="Impersonation">Impersonation</option>
                  <option value="Hate Speech">Hate Speech</option>
                  <option value="Violence">Threats or Violence</option>
                  <option value="Privacy Violation">Privacy Violation</option>
                  <option value="Other">Other Violation</option>
                </select>
              </div>

              {/* Severity Level */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Severity Level</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(level => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setNewReport({...newReport, severity: level})}
                      className={`flex-1 h-12 rounded-2xl flex items-center justify-center transition-all font-bold text-xs ${
                        newReport.severity >= level
                          ? level <= 2
                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-100'
                            : level === 3
                            ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-100'
                            : 'bg-red-500 text-white shadow-lg shadow-red-100'
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 font-medium ml-2">
                  1 = Minor issue • 5 = Critical violation
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Detailed Description</label>
                <textarea
                  required
                  rows={4}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all outline-none text-sm font-bold resize-none"
                  placeholder="Please provide specific details about the incident..."
                  value={newReport.description}
                  onChange={(e) => setNewReport({...newReport, description: e.target.value})}
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !selectedUser}
                className="w-full bg-red-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-100 hover:bg-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <><Send size={16} /> Submit Report</>}
              </button>
            </form>
          </div>
        </div>

        {/* Previous Reports - Scrollable on right */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm h-[calc(100vh-8rem)] flex flex-col">
            <div className="p-6 border-b border-slate-200 shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Your Previous Reports</h2>
                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                  <AlertTriangle size={16} />
                  <span>Admin Review</span>
                </div>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 size={32} className="animate-spin text-red-200" />
            </div>
          ) : (
            <div className="space-y-6">
              {reports.length === 0 && (
                <div className="text-center py-20 opacity-30">
                  <Shield size={48} className="mx-auto mb-4" />
                  <p className="font-bold uppercase tracking-widest text-xs">No reports submitted yet</p>
                </div>
              )}
                {reports.map((r: any) => {
                  // Map reason to display text
                  const reasonMap: Record<string, string> = {
                    'spam': 'Spam or Advertising',
                    'harassment': 'Harassment or Bullying',
                    'inappropriate_content': 'Inappropriate Content',
                    'fake_profile': 'Impersonation',
                    'other': 'Other Violation'
                  };

                  // Map priority to severity for badge
                  const priorityToSeverity: Record<string, number> = {
                    'low': 2,
                    'medium': 3,
                    'high': 4,
                    'urgent': 5
                  };

                  // Map status to badge color
                  const getStatusBadge = (status: string) => {
                    const configs: Record<string, { bg: string; text: string }> = {
                      'pending': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
                      'investigating': { bg: 'bg-blue-100', text: 'text-blue-700' },
                      'resolved': { bg: 'bg-green-100', text: 'text-green-700' },
                      'dismissed': { bg: 'bg-gray-100', text: 'text-gray-700' }
                    };
                    const config = configs[status] || configs.pending;
                    return (
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${config.bg} ${config.text} uppercase`}>
                        {status}
                      </span>
                    );
                  };

                  return (
                    <div key={r.id} className="p-6 bg-slate-50 border border-slate-200 rounded-2xl hover:shadow-lg hover:border-slate-300 transition-all relative">
                      <div className="absolute top-4 right-4 flex gap-2">
                        {getSeverityBadge(priorityToSeverity[r.priority] || 3)}
                        {getStatusBadge(r.status)}
                      </div>
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center shrink-0">
                          <UserIcon size={20} />
                        </div>
                        <div className="flex-1 min-w-0 pr-32">
                          <h4 className="font-bold text-slate-900 text-base mb-1">
                            {r.reported_user?.name || 'Unknown User'}
                          </h4>
                          <p className="text-xs text-slate-500 mb-1">{r.reported_user?.email || ''}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {new Date(r.created_at).toLocaleDateString()}
                          </p>
                          <div className="mt-2 inline-block px-2 py-1 bg-white rounded-lg border border-slate-200">
                            <p className="text-xs font-bold text-slate-600">{reasonMap[r.reason] || r.reason}</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-slate-200">
                        <p className="text-slate-700 text-sm leading-relaxed">{r.description}</p>
                      </div>
                      {r.resolution_notes && (
                        <div className="mt-3 bg-green-50 rounded-xl p-4 border border-green-200">
                          <p className="text-xs font-bold text-green-700 uppercase mb-1">Resolution</p>
                          <p className="text-sm text-green-900">{r.resolution_notes}</p>
                        </div>
                      )}
                    </div>
                  );
              })}
            </div>
          )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportPage;
