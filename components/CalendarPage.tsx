
import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Share2, Plus, Calendar as CalendarIcon, MapPin, Clock, Loader2, X, Repeat, Users, Bell, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { StudyGroup } from '../types';
import { containsBadWords } from '../utils/badWords';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Get current user
  const currentUser = useMemo(() => {
    try {
      const saved = localStorage.getItem('auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', type: 'General', start_time: '', location: '', recurrence: 'none', recurrence_count: '' });
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [sharingToGroup, setSharingToGroup] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showEventSelector, setShowEventSelector] = useState(false);
  const [selectedEventsToShare, setSelectedEventsToShare] = useState<string[]>([]);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [editEventData, setEditEventData] = useState({ title: '', type: 'General', start_time: '', location: '', recurrence: 'none', recurrence_count: '' });
  const [showCancelReasonModal, setShowCancelReasonModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellingEvent, setCancellingEvent] = useState<any | null>(null);
  const [groupFilter, setGroupFilter] = useState<string>('all');

  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Build group_id → group map
  const groupMap = useMemo(() => {
    const map: Record<string, StudyGroup> = {};
    groups.forEach(g => { map[g.id] = g; });
    return map;
  }, [groups]);

  const getGroupName = (groupId?: string) => groupId && groupMap[groupId] ? groupMap[groupId].name : null;

  // Check if current user can delete an event
  const canDeleteEvent = (event: any) => {
    if (!currentUser) return false;
    const userId = String(currentUser.id);
    // User created this event
    if (String(event.user_id) === userId) return true;
    // User is group leader of the event's group
    if (event.group_id && groupMap[event.group_id] && String(groupMap[event.group_id].creator_id) === userId) return true;
    return false;
  };

  // Calculate calendar grid for the current month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const emptyCells = Array.from({ length: firstDay }, (_, i) => ({ key: `empty-${i}`, day: 0 }));
    const dayCells = Array.from({ length: daysInMonth }, (_, i) => ({ key: `day-${i + 1}`, day: i + 1 }));
    return [...emptyCells, ...dayCells];
  }, [currentMonth, currentYear]);

  // Filter events for the current month
  const monthEvents = useMemo(() => {
    return events.filter(e => {
      const d = new Date(e.start_time);
      if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) return false;
      if (groupFilter === 'all') return true;
      if (groupFilter === 'personal') return !e.group_id;
      return String(e.group_id) === groupFilter;
    });
  }, [events, currentMonth, currentYear, groupFilter]);

  // Upcoming events (from today forward, sorted)
  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return events
      .filter(e => {
        if (new Date(e.start_time) < today) return false;
        if (groupFilter === 'all') return true;
        if (groupFilter === 'personal') return !e.group_id;
        return String(e.group_id) === groupFilter;
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [events, groupFilter]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventsData, groupsData] = await Promise.all([
        apiService.getEvents(),
        apiService.getGroups()
      ]);
      setEvents(eventsData);
      setGroups(groupsData.filter(g => g.is_member));
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (containsBadWords(newEvent.title) || containsBadWords(newEvent.location)) {
      alert('Your event content contains inappropriate language. Please revise and try again.');
      return;
    }
    try {
      await apiService.createEvent(newEvent);
      setIsModalOpen(false);
      const data = await apiService.getEvents();
      setEvents(data);
      setNewEvent({ title: '', type: 'General', start_time: '', location: '', recurrence: 'none', recurrence_count: '' });
    } catch (err) {
      alert("Failed to create event");
    }
  };

  const handleDelete = (event: any) => {
    setCancellingEvent(event);
    setShowCancelReasonModal(true);
    setSelectedEvent(null);
  };

  const handleCancelEventWithReason = async (reason?: string) => {
    if (!cancellingEvent) return;

    setShowCancelReasonModal(false);

    try {
      await apiService.deleteEvent(cancellingEvent.id, reason);
      const data = await apiService.getEvents();
      setEvents(data);
      alert('Event cancelled successfully.');
    } catch (err) {
      alert("Failed to cancel event");
    } finally {
      setCancellingEvent(null);
      setCancellationReason('');
    }
  };

  const handleCancelCancellation = () => {
    setShowCancelReasonModal(false);
    setCancellingEvent(null);
    setCancellationReason('');
  };

  const handleEditEvent = async () => {
    if (!editingEvent || !editEventData.start_time) {
      alert("Please fill in all required fields");
      return;
    }
    try {
      // Delete old event and create a new one with updated data
      await apiService.deleteEvent(editingEvent.id);
      await apiService.createEvent({
        title: editingEvent.title, // Use original title (not editable)
        type: editingEvent.group_id ? editingEvent.type : editEventData.type, // Use original type if group event
        start_time: editEventData.start_time,
        location: editEventData.location,
        recurrence: editEventData.recurrence,
        recurrence_count: editEventData.recurrence_count,
        group_id: editingEvent.group_id
      });
      setEditingEvent(null);
      setEditEventData({ title: '', type: 'General', start_time: '', location: '', recurrence: 'none', recurrence_count: '' });
      const data = await apiService.getEvents();
      setEvents(data);
      alert("Event updated successfully!");
    } catch (err) {
      alert("Failed to update event");
    }
  };

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const formatShareText = (eventIds: string[]) => {
    const eventsToShare = upcomingEvents.filter(e => eventIds.includes(e.id));
    const text = eventsToShare.map(e => {
      const date = new Date(e.start_time).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const loc = e.location ? ` | ${e.location}` : '';
      const group = getGroupName(e.group_id);
      const groupLabel = group ? ` [${group}]` : '';
      return `• ${e.title}${groupLabel} — ${date}${loc}`;
    }).join('\n');
    return `My Upcoming Schedule:\n\n${text || 'No events selected.'}`;
  };

  const handleShareCopy = async () => {
    if (selectedEventsToShare.length === 0) {
      alert('Please select at least one event to share');
      return;
    }
    const shareText = formatShareText(selectedEventsToShare);
    if (navigator.share) {
      try { await navigator.share({ title: 'My Schedule', text: shareText }); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        alert('Schedule copied to clipboard!');
      } catch {
        alert('Could not copy schedule.');
      }
    }
    setShowShareMenu(false);
    setShowEventSelector(false);
    setSelectedEventsToShare([]);
  };

  const handleShareToGroup = async (groupId: string) => {
    if (selectedEventsToShare.length === 0) {
      alert('Please select at least one event to share');
      return;
    }
    setSharingToGroup(true);
    try {
      const shareText = formatShareText(selectedEventsToShare);
      await apiService.sendMessage(groupId, shareText);
      alert('Schedule shared to group chat!');
    } catch {
      alert('Failed to share to group chat.');
    } finally {
      setSharingToGroup(false);
      setShowShareMenu(false);
      setShowEventSelector(false);
      setSelectedEventsToShare([]);
    }
  };

  const handleOpenShareSelector = () => {
    setShowEventSelector(true);
    // Select all events by default
    setSelectedEventsToShare(upcomingEvents.map(e => e.id));
  };

  const toggleEventSelection = (eventId: string) => {
    setSelectedEventsToShare(prev =>
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  const handleShareEventToGroup = async (event: any) => {
    if (!event.group_id) return;
    setSharingToGroup(true);
    try {
      const dateStr = new Date(event.start_time).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const recurrenceLabel = event.recurrence && event.recurrence !== 'none' ? ` (Repeats ${event.recurrence})` : '';
      const locationStr = event.location ? `\nLocation: ${event.location}` : '';
      const msg = `📅 Meeting Reminder!\n\n${event.title}\n${dateStr}${recurrenceLabel}${locationStr}`;
      await apiService.sendMessage(event.group_id, msg);
      alert('Shared to group chat!');
    } catch {
      alert('Failed to share to group chat.');
    } finally {
      setSharingToGroup(false);
    }
  };

  const navigateToGroup = (groupId: string) => {
    setSelectedEvent(null);
    navigate(`/groups?group=${groupId}`);
  };

  const today = new Date();
  const isToday = (day: number) => day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

  // Groups the user is a member of (for share menu)
  const myGroups = groups;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{MONTH_NAMES[currentMonth]} {currentYear}</h1>
              <p className="text-slate-500 font-semibold text-xs uppercase tracking-widest mt-1">{monthEvents.length} meetings this month</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={goToPrevMonth} className="p-2 hover:bg-slate-100 rounded-xl transition-all border border-slate-100"><ChevronLeft size={20} className="text-slate-400" /></button>
              <button
                onClick={() => { setCurrentMonth(now.getMonth()); setCurrentYear(now.getFullYear()); }}
                className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-100 rounded-xl transition-all border border-slate-100"
              >
                Today
              </button>
              <button onClick={goToNextMonth} className="p-2 hover:bg-slate-100 rounded-xl transition-all border border-slate-100"><ChevronRight size={20} className="text-slate-400" /></button>
            </div>
          </div>

          {/* Group filter dropdown */}
          {groups.length > 0 && (
            <div className="mb-6">
              <select
                value={groupFilter}
                onChange={e => setGroupFilter(e.target.value)}
                className="w-full sm:w-56 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-600 uppercase tracking-widest outline-none focus:border-orange-400 transition-all cursor-pointer"
              >
                <option value="all">All Meetings</option>
                <option value="personal">Personal Only</option>
                {groups.map(g => (
                  <option key={g.id} value={String(g.id)}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-3xl overflow-hidden">
            {weekDays.map(day => (
              <div key={day} className="bg-slate-50 p-4 text-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{day}</span>
              </div>
            ))}
            {calendarDays.map(cell => {
              if (cell.day === 0) {
                return <div key={cell.key} className="bg-white h-24 md:h-32 p-2"></div>;
              }
              const dayEvents = monthEvents.filter(e => new Date(e.start_time).getDate() === cell.day);
              return (
                <div key={cell.key} className={`bg-white h-24 md:h-32 p-3 transition-colors hover:bg-slate-50/50 group relative ${isToday(cell.day) ? 'ring-2 ring-inset ring-orange-400' : ''}`}>
                  <span className={`text-sm font-bold ${isToday(cell.day) ? 'text-orange-500' : 'text-slate-400'}`}>{cell.day}</span>
                  <div className="mt-1 space-y-1">
                    {dayEvents.map(e => (
                      <button
                        key={e.id}
                        onClick={() => setSelectedEvent(e)}
                        className={`w-full text-left p-1 text-white text-[8px] font-black uppercase rounded truncate shadow-sm transition-colors ${e.group_id ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-orange-500 hover:bg-orange-600'}`}
                      >
                        {e.title}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="absolute bottom-2 right-2 p-1 bg-slate-50 text-slate-300 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:text-orange-500"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Upcoming</h2>
            <div className="relative">
              <button onClick={handleOpenShareSelector} title="Share schedule">
                <Share2 size={18} className="text-slate-400 hover:text-orange-500 cursor-pointer transition-colors" />
              </button>
              {showShareMenu && (
                <div className="absolute top-8 right-0 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="p-2 border-b border-slate-50">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Share schedule</p>
                  </div>
                  <button
                    onClick={handleShareCopy}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
                  >
                    <Share2 size={14} />
                    Copy / Share
                  </button>
                  {myGroups.length > 0 && (
                    <>
                      <div className="px-4 py-1.5 border-t border-slate-50">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Send to group chat</p>
                      </div>
                      {myGroups.map(g => (
                        <button
                          key={g.id}
                          onClick={() => handleShareToGroup(g.id)}
                          disabled={sharingToGroup}
                          className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-orange-50 hover:text-orange-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                          <Users size={14} />
                          <span className="truncate">{g.name}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-200" /></div>
            ) : (
              <>
                {upcomingEvents.length === 0 && (
                  <p className="text-center text-xs font-bold text-slate-400 uppercase py-10">No upcoming events</p>
                )}
                {upcomingEvents.map((event) => {
                  const groupName = getGroupName(event.group_id);
                  return (
                    <div
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className="w-full text-left p-5 bg-slate-50 rounded-3xl border border-slate-100 hover:border-orange-200 transition-all cursor-pointer group relative"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${event.type === 'Exam' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {event.type}
                          </span>
                          {event.recurrence && event.recurrence !== 'none' && (
                            <span className="flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-blue-100 text-blue-600">
                              <Repeat size={10} />
                              {event.recurrence}
                            </span>
                          )}
                          {groupName && (
                            <button
                              onClick={(e) => { e.stopPropagation(); navigateToGroup(event.group_id); }}
                              className="flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200 transition-colors"
                            >
                              <Users size={10} />
                              {groupName}
                            </button>
                          )}
                        </div>
                      </div>
                      <h4 className="font-bold text-slate-900 text-base mb-3 group-hover:text-orange-500 transition-colors">{event.title}</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Clock size={14} />
                          <span className="text-xs font-bold">
                            {new Date(event.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-2 text-slate-500">
                            <MapPin size={14} />
                            {/^https?:\/\//i.test(event.location)
                              ? <a href={event.location} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1">
                                  {(() => { try { return new URL(event.location).hostname.replace(/^www\./, ''); } catch { return 'Open link'; } })()}
                                  <ExternalLink size={10} />
                                </a>
                              : <span className="text-xs font-bold">{event.location}</span>
                            }
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full py-4 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 text-xs font-black uppercase tracking-widest hover:border-orange-200 hover:text-orange-500 transition-all mt-4 flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Add Event
            </button>
          </div>
        </div>
      </div>

      {/* New Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-orange-500 p-8 text-white flex justify-between items-center">
              <h3 className="text-xl font-bold">New Event</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddEvent} className="p-8 space-y-4">
              <input
                required placeholder="Event Title"
                className="w-full px-5 py-3 bg-slate-50 border rounded-xl font-bold text-sm"
                value={newEvent.title}
                onChange={e => setNewEvent({...newEvent, title: e.target.value})}
              />
              <select
                className="w-full px-5 py-3 bg-slate-50 border rounded-xl font-bold text-sm"
                value={newEvent.type}
                onChange={e => setNewEvent({...newEvent, type: e.target.value})}
              >
                <option value="General">General</option>
                <option value="Project">Project</option>
                <option value="Exam">Exam</option>
                <option value="Assignment">Assignment</option>
              </select>
              <input
                type="datetime-local" required
                className="w-full px-5 py-3 bg-slate-50 border rounded-xl font-bold text-sm"
                value={newEvent.start_time}
                onChange={e => setNewEvent({...newEvent, start_time: e.target.value})}
              />
              <input
                placeholder="Location (Optional)"
                className="w-full px-5 py-3 bg-slate-50 border rounded-xl font-bold text-sm"
                value={newEvent.location}
                onChange={e => setNewEvent({...newEvent, location: e.target.value})}
              />
              <div className="relative">
                <Repeat className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <select
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border rounded-xl font-bold text-sm appearance-none"
                  value={newEvent.recurrence}
                  onChange={e => setNewEvent({...newEvent, recurrence: e.target.value})}
                >
                  <option value="none">One-time (No repeat)</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {newEvent.recurrence !== 'none' && (
                <input
                  type="number"
                  placeholder={`How many ${newEvent.recurrence === 'daily' ? 'days' : newEvent.recurrence === 'weekly' ? 'weeks' : 'months'}?`}
                  className="w-full px-5 py-3 bg-slate-50 border rounded-xl font-bold text-sm"
                  value={newEvent.recurrence_count}
                  onChange={e => setNewEvent({...newEvent, recurrence_count: e.target.value})}
                  min="1"
                  max="365"
                />
              )}
              <button type="submit" className="w-full py-4 bg-orange-500 text-white rounded-xl font-black text-xs uppercase tracking-widest">Create Event</button>
            </form>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className={`p-8 text-white flex justify-between items-center ${selectedEvent.type === 'Exam' ? 'bg-red-500' : selectedEvent.group_id ? 'bg-emerald-500' : 'bg-orange-500'}`}>
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-bold truncate">{selectedEvent.title}</h3>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs font-black uppercase bg-white/20 px-2 py-0.5 rounded-lg">{selectedEvent.type}</span>
                  {selectedEvent.recurrence && selectedEvent.recurrence !== 'none' && (
                    <span className="flex items-center gap-1 text-xs font-black uppercase bg-white/20 px-2 py-0.5 rounded-lg">
                      <Repeat size={10} />
                      {selectedEvent.recurrence}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-all shrink-0 ml-3"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-4">
              {/* Group info */}
              {getGroupName(selectedEvent.group_id) && (
                <button
                  onClick={() => navigateToGroup(selectedEvent.group_id)}
                  className="w-full flex items-center gap-3 p-4 bg-purple-50 rounded-xl border border-purple-200 hover:bg-purple-100 transition-all"
                >
                  <Users size={18} className="text-purple-500 shrink-0" />
                  <div className="text-left">
                    <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Group</p>
                    <p className="text-sm font-bold text-purple-700">{getGroupName(selectedEvent.group_id)}</p>
                  </div>
                  <ChevronRight size={16} className="text-purple-300 ml-auto" />
                </button>
              )}
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <CalendarIcon size={18} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</p>
                  <p className="text-sm font-bold text-slate-900">
                    {new Date(selectedEvent.start_time).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <Clock size={18} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</p>
                  <p className="text-sm font-bold text-slate-900">
                    {new Date(selectedEvent.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              {selectedEvent.location && (
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <MapPin size={18} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</p>
                    {/^https?:\/\//i.test(selectedEvent.location)
                      ? <a href={selectedEvent.location} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1.5 mt-0.5">
                          {(() => { try { return new URL(selectedEvent.location).hostname.replace(/^www\./, ''); } catch { return 'Open link'; } })()}
                          <ExternalLink size={13} />
                        </a>
                      : <p className="text-sm font-bold text-slate-900">{selectedEvent.location}</p>
                    }
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                {selectedEvent.group_id && (
                  <button
                    onClick={() => handleShareEventToGroup(selectedEvent)}
                    disabled={sharingToGroup}
                    className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sharingToGroup ? <Loader2 size={14} className="animate-spin" /> : <><Bell size={14} /> Remind</>}
                  </button>
                )}
                {canDeleteEvent(selectedEvent) && (
                  <>
                    <button
                      onClick={() => {
                        setEditingEvent(selectedEvent);
                        setEditEventData({
                          title: selectedEvent.title,
                          type: selectedEvent.type || 'General',
                          start_time: selectedEvent.start_time?.slice(0, 16) || '',
                          location: selectedEvent.location || '',
                          recurrence: selectedEvent.recurrence || 'none',
                          recurrence_count: selectedEvent.recurrence_count || ''
                        });
                        setSelectedEvent(null);
                      }}
                      className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all"
                    >
                      Reschedule
                    </button>
                    <button
                      onClick={() => handleDelete(selectedEvent)}
                      className="flex-1 py-3 bg-red-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-600 transition-all"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {editingEvent && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-blue-500 p-8 text-white flex justify-between items-center">
              <h3 className="text-xl font-bold">Edit Event</h3>
              <button onClick={() => setEditingEvent(null)} className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Title</label>
                <input
                  type="text"
                  value={editingEvent.title}
                  disabled
                  className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl font-bold text-sm text-slate-500 cursor-not-allowed"
                />
                <p className="text-[9px] text-slate-400 ml-2">Title cannot be edited</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Type</label>
                <select
                  value={editEventData.type}
                  onChange={e => setEditEventData({...editEventData, type: e.target.value})}
                  disabled={!!editingEvent.group_id}
                  className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-bold text-sm outline-none ${
                    editingEvent.group_id
                      ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-50 focus:border-blue-500'
                  }`}
                >
                  <option value="General">General</option>
                  <option value="Project">Project</option>
                  <option value="Group Meeting">Group Meeting</option>
                  <option value="Exam">Exam</option>
                  <option value="Assignment">Assignment</option>
                </select>
                {editingEvent.group_id && (
                  <p className="text-[9px] text-slate-400 ml-2">Type cannot be edited for group events</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Date & Time</label>
                <input
                  type="datetime-local"
                  value={editEventData.start_time}
                  onChange={e => setEditEventData({...editEventData, start_time: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Location</label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={editEventData.location}
                  onChange={e => setEditEventData({...editEventData, location: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Recurrence</label>
                <select
                  value={editEventData.recurrence}
                  onChange={e => setEditEventData({...editEventData, recurrence: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500"
                >
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {editEventData.recurrence !== 'none' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                    How many {editEventData.recurrence === 'daily' ? 'days' : editEventData.recurrence === 'weekly' ? 'weeks' : 'months'}?
                  </label>
                  <input
                    type="number"
                    placeholder="Count"
                    value={editEventData.recurrence_count}
                    onChange={e => setEditEventData({...editEventData, recurrence_count: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500"
                    min="1"
                    max="365"
                  />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingEvent(null)}
                  className="flex-1 py-3 border-2 border-slate-100 rounded-xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditEvent}
                  className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event Selector Modal */}
      {showEventSelector && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-orange-500 p-8 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">Select Events to Share</h3>
                <p className="text-xs text-orange-100 mt-1">{selectedEventsToShare.length} event{selectedEventsToShare.length !== 1 ? 's' : ''} selected</p>
              </div>
              <button
                onClick={() => {
                  setShowEventSelector(false);
                  setSelectedEventsToShare([]);
                }}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto">
              {upcomingEvents.length === 0 ? (
                <p className="text-center text-sm font-bold text-slate-400 py-8">No upcoming events to share</p>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map((event) => {
                    const groupName = getGroupName(event.group_id);
                    const isSelected = selectedEventsToShare.includes(event.id);
                    return (
                      <button
                        key={event.id}
                        onClick={() => toggleEventSelection(event.id)}
                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                          isSelected
                            ? 'bg-orange-50 border-orange-500'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-orange-500 border-orange-500' : 'border-slate-300'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h4 className="font-bold text-sm text-slate-900">{event.title}</h4>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                                event.type === 'Exam' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                              }`}>
                                {event.type}
                              </span>
                              {groupName && (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-600">
                                  {groupName}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Clock size={12} />
                              <span className="font-bold">
                                {new Date(event.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {event.location && (
                              <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                <MapPin size={12} />
                                {/^https?:\/\//i.test(event.location)
                                  ? <a href={event.location} target="_blank" rel="noopener noreferrer" className="font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1">
                                      {(() => { try { return new URL(event.location).hostname.replace(/^www\./, ''); } catch { return 'Open link'; } })()}
                                      <ExternalLink size={10} />
                                    </a>
                                  : <span className="font-bold">{event.location}</span>
                                }
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedEventsToShare(upcomingEvents.map(e => e.id))}
                  className="flex-1 py-2 text-xs font-black uppercase tracking-widest text-orange-500 hover:bg-orange-50 rounded-xl transition-all"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedEventsToShare([])}
                  className="flex-1 py-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 rounded-xl transition-all"
                >
                  Clear
                </button>
              </div>
              <button
                onClick={() => {
                  if (selectedEventsToShare.length > 0) {
                    setShowEventSelector(false);
                    setShowShareMenu(true);
                  } else {
                    alert('Please select at least one event');
                  }
                }}
                disabled={selectedEventsToShare.length === 0}
                className="w-full py-4 bg-orange-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Share2 size={14} />
                Continue to Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Event Reason Modal */}
      {showCancelReasonModal && cancellingEvent && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="bg-red-500 p-8 text-white">
              <h3 className="text-2xl font-black tracking-tight">Cancel Event</h3>
              <p className="text-red-100 text-sm font-bold mt-1">{cancellingEvent.title}</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-slate-700 font-semibold text-sm">
                {cancellingEvent.group_id
                  ? "Would you like to provide a reason for cancelling this meeting? This will be sent to all group members."
                  : "Would you like to provide a reason for cancelling this event?"}
              </p>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                  Cancellation Reason (Optional)
                </label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="e.g., Postponed due to schedule conflict, Will reschedule for next week, etc."
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-red-400 focus:outline-none font-semibold text-sm resize-none"
                  maxLength={500}
                />
                <p className="text-xs text-slate-400 mt-1 font-semibold">
                  {cancellationReason.length}/500 characters
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex gap-3">
              <button
                onClick={handleCancelCancellation}
                className="flex-1 px-6 py-3 bg-slate-300 text-slate-700 rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-slate-400 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCancelEventWithReason()}
                className="flex-1 px-6 py-3 bg-slate-500 text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-slate-600 transition-all"
              >
                Skip & Cancel
              </button>
              <button
                onClick={() => handleCancelEventWithReason(cancellationReason.trim() || undefined)}
                disabled={cancellationReason.trim().length === 0}
                className="flex-1 px-6 py-3 bg-red-500 text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send & Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default CalendarPage;
