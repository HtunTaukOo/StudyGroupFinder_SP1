import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Calendar as CalendarIcon, MessageSquare, Info, MoreHorizontal, Sparkles, Loader2, BookOpen, Mic, X, Users as UsersIcon, Clock, MapPin, Search, Archive, Unlock, Lock as LockIcon, Edit2, Trash2, Bell, UserX, Paperclip, File as FileIcon, Video, LogOut, Repeat, Plus, UserPlus, Check, ChevronDown, ChevronLeft, ExternalLink } from 'lucide-react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { StudyGroup, Message, User, GroupStatus, GroupMember } from '../types';
import { geminiService } from '../services/geminiService';
import { apiService } from '../services/apiService';
import LiveStudySession from './LiveStudySession';
import PendingRequestsModal from './PendingRequestsModal';
import StudyPlanModal from './StudyPlanModal';
// FIX: Import API_CONFIG from constants to resolve reference error in handleDeleteGroup
import { API_CONFIG } from '../constants';
import { containsBadWords } from '../utils/badWords';

const GroupsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [myGroups, setMyGroups] = useState<StudyGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(searchParams.get('group'));
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [studyPlan, setStudyPlan] = useState<string | null>(null);
  const [showStudyPlanModal, setShowStudyPlanModal] = useState(false);
  const [showLiveSession, setShowLiveSession] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showPendingRequestsModal, setShowPendingRequestsModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [kickingMemberId, setKickingMemberId] = useState<number | null>(null);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [showArchivedGroups, setShowArchivedGroups] = useState(false);
  const [activeSection, setActiveSection] = useState<'created' | 'joined'>('created');

  const [newMeeting, setNewMeeting] = useState({ title: '', start_time: '', location: '', recurrence: 'none', recurrence_count: '' });
  const [scheduling, setScheduling] = useState(false);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Invite members state
  const [showInviteSection, setShowInviteSection] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [inviteSearchResults, setInviteSearchResults] = useState<any[]>([]);
  const [invitingUserId, setInvitingUserId] = useState<number | null>(null);

  // Unread message counts per group (persisted in localStorage)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const getStoredCounts = (): Record<string, number> => {
    try {
      const stored = localStorage.getItem('lastSeenMessageCounts');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  };
  const saveStoredCounts = (counts: Record<string, number>) => {
    localStorage.setItem('lastSeenMessageCounts', JSON.stringify(counts));
  };

  // Track last activity time per group for sorting
  const [lastActivity, setLastActivity] = useState<Record<string, number>>({});
  const updateLastActivity = (groupId: string) => {
    setLastActivity(prev => ({ ...prev, [groupId]: Date.now() }));
  };

  // Meetings management state
  const [showMeetingsModal, setShowMeetingsModal] = useState(false);
  const [groupEvents, setGroupEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [rescheduleEvent, setRescheduleEvent] = useState<any | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleRecurrence, setRescheduleRecurrence] = useState('none');
  const [rescheduleRecurrenceCount, setRescheduleRecurrenceCount] = useState('');
  const [rescheduleLocation, setRescheduleLocation] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showCancelReasonModal, setShowCancelReasonModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellingEvent, setCancellingEvent] = useState<any | null>(null);

  // Edit Group State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editGroupData, setEditGroupData] = useState({
    name: '',
    description: '',
    max_members: 5,
    location: '',
    subject: '',
    faculty: '',
    status: 'open'
  });

  const [currentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  const searchQuery = (searchParams.get('q') || '').toLowerCase();

  const filteredMyGroups = useMemo(() => {
    let filtered = myGroups;

    // Filter by archived status
    if (showArchivedGroups) {
      // Show only archived groups
      filtered = filtered.filter(g => g.status === GroupStatus.ARCHIVED);
    } else {
      // Exclude archived groups from normal view
      filtered = filtered.filter(g => g.status !== GroupStatus.ARCHIVED);
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(g =>
        g.name.toLowerCase().includes(searchQuery) ||
        g.subject.toLowerCase().includes(searchQuery)
      );
    }

    return filtered;
  }, [myGroups, searchQuery, showArchivedGroups]);

  // Split into created vs joined, each sorted A–Z by name
  const createdGroups = useMemo(() => {
    return filteredMyGroups
      .filter(g => g.creator_id === currentUser?.id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredMyGroups, currentUser]);

  const joinedGroups = useMemo(() => {
    return filteredMyGroups
      .filter(g => g.creator_id !== currentUser?.id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredMyGroups, currentUser]);


  const createdTabBadge = useMemo(() =>
    createdGroups.reduce((sum, g) => sum + (g.pending_requests_count || 0) + (unreadCounts[g.id] || 0), 0),
  [createdGroups, unreadCounts]);

  const joinedTabBadge = useMemo(() =>
    joinedGroups.reduce((sum, g) => sum + (unreadCounts[g.id] || 0), 0),
  [joinedGroups, unreadCounts]);

  const activeGroup = myGroups.find(g => String(g.id) === String(activeGroupId));
  const isLeader = activeGroup?.creator_id === currentUser?.id;
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const justSwitchedGroup = useRef(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMyGroups();
    // Request browser notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
        setIsStatusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync URL parameter to active group state
  useEffect(() => {
    const groupIdFromUrl = searchParams.get('group');
    if (groupIdFromUrl && groupIdFromUrl !== activeGroupId) {
      setActiveGroupId(groupIdFromUrl);
    }
  }, [searchParams]);

  // When a group is opened (e.g. via Open Chat), switch to the correct tab
  useEffect(() => {
    if (!activeGroupId || myGroups.length === 0 || !currentUser) return;
    const group = myGroups.find(g => String(g.id) === String(activeGroupId));
    if (!group) return;
    setActiveSection(group.creator_id === currentUser.id ? 'created' : 'joined');
  }, [activeGroupId, myGroups]);

  const fetchMyGroups = async () => {
    try {
      const allGroups = await apiService.getGroups();
      const joined = allGroups.filter(g => g.is_member);
      setMyGroups(joined);
    } catch (err) {
      console.error("Failed to fetch groups", err);
    } finally {
      setLoadingGroups(false);
    }
  };

  const fetchGroupMembers = async (groupId: string) => {
    try {
      setLoadingMembers(true);
      const members = await apiService.getGroupMembers(groupId);
      setGroupMembers(members);
    } catch (err: any) {
      console.error("Failed to fetch members", err);
      alert(err.message || 'Failed to load members');
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (activeGroupId) {
      const activeGroupName = myGroups.find(g => String(g.id) === String(activeGroupId))?.name;
      console.log(`[Group Switch] Switching to group: ${activeGroupName} (${activeGroupId})`);

      const fetchMessages = async () => {
        setLoadingMessages(true);
        try {
          const data = await apiService.getMessages(activeGroupId);
          console.log(`[Group Switch] Fetched ${data.length} messages for ${activeGroupName}`);
          // Set messages directly when group changes (don't merge with other groups)
          setMessages(data);
          // Mark this group as seen with current message count
          const stored = getStoredCounts();
          stored[activeGroupId] = data.length;
          saveStoredCounts(stored);
          console.log(`[Group Switch] Updated stored count for ${activeGroupName}: ${data.length}`);
        } catch (err) {
          console.error("Failed to fetch messages", err);
        } finally {
          setLoadingMessages(false);
        }
      };
      fetchMessages();
      justSwitchedGroup.current = true;
      setIsAtBottom(true);
      setSummary(null);
      setStudyPlan(null);
      setShowStudyPlanModal(false);

      // Clear unread badge for this group immediately
      setUnreadCounts(prev => {
        const next = { ...prev };
        delete next[activeGroupId];
        console.log(`[Group Switch] Cleared badge for ${activeGroupName}`);
        return next;
      });
    }
  }, [activeGroupId]);

  useEffect(() => {
    if (justSwitchedGroup.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'instant' });
      justSwitchedGroup.current = false;
    } else if (isAtBottom) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleChatScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-scroll to summary when it's generated
  useEffect(() => {
    if (summary) {
      setTimeout(() => {
        summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [summary]);

  // Poll for new messages in the active group (real-time feel)
  useEffect(() => {
    if (!activeGroupId) return;
    const activeGroupName = myGroups.find(g => String(g.id) === String(activeGroupId))?.name;
    const interval = setInterval(async () => {
      try {
        const data = await apiService.getMessages(activeGroupId);
        setMessages(data);
        // Update stored count to prevent badge from reappearing after switching groups
        const stored = getStoredCounts();
        stored[activeGroupId] = data.length;
        saveStoredCounts(stored);
        console.log(`[Active Poll] Updated ${activeGroupName}: ${data.length} messages, stored count: ${data.length}`);
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, [activeGroupId, myGroups]);

  // Poll all groups for unread message counts using localStorage
  useEffect(() => {
    if (myGroups.length === 0) return;

    const pollUnread = async () => {
      const storedAtStart = getStoredCounts();
      const newBaselines: Record<string, number> = {};
      const counts: Record<string, number> = {};
      console.log('[Polling] Starting unread poll. Active group:', activeGroupId);
      console.log('[Polling] Stored counts:', storedAtStart);

      await Promise.all(
        myGroups.map(async (group) => {
          if (String(group.id) === String(activeGroupId)) {
            console.log(`[Polling] Skipping active group: ${group.name} (${group.id})`);
            return;
          }
          try {
            const msgs = await apiService.getMessages(group.id);
            const currentCount = msgs.length;
            const lastSeen = storedAtStart[group.id];
            console.log(`[Polling] Group "${group.name}" (${group.id}): current=${currentCount}, lastSeen=${lastSeen}`);

            if (lastSeen === undefined) {
              // First time seeing this group - record baseline, no badge
              newBaselines[group.id] = currentCount;
              console.log(`[Polling] First time seeing "${group.name}", setting baseline to ${currentCount}`);
            } else if (currentCount > lastSeen) {
              const newCount = currentCount - lastSeen;
              counts[group.id] = newCount;
              console.log(`[Polling] NEW MESSAGES in "${group.name}": ${newCount} new (${lastSeen} → ${currentCount})`);

              // Update last activity for this group to float it to top
              updateLastActivity(group.id);

              // Send browser push notification for new messages
              if ('Notification' in window && Notification.permission === 'granted') {
                const lastMsg = msgs[msgs.length - 1];
                new Notification(`${group.name}`, {
                  body: `${lastMsg?.user_name || 'Someone'}: ${lastMsg?.content || 'sent a message'}`,
                  tag: `group-${group.id}`,
                });
              }
            } else {
              console.log(`[Polling] No new messages in "${group.name}"`);
            }
          } catch (err) {
            console.error(`[Polling] Error fetching messages for "${group.name}":`, err);
          }
        })
      );

      // Merge new baselines with current stored counts (don't overwrite existing values)
      if (Object.keys(newBaselines).length > 0) {
        const currentStored = getStoredCounts(); // Re-fetch to get latest
        const merged = { ...currentStored, ...newBaselines };
        saveStoredCounts(merged);
        console.log('[Polling] Saved new baselines:', newBaselines);
      }

      console.log('[Polling] Setting unread badges:', counts);
      console.log('[Polling] Groups with unread counts:', Object.keys(counts).map(id => `${myGroups.find(g => g.id === id)?.name}(${id}): ${counts[id]}`));
      setUnreadCounts(counts);
    };

    pollUnread();
    const interval = setInterval(pollUnread, 15000);
    return () => clearInterval(interval);
  }, [myGroups, activeGroupId]);

  useEffect(() => {
    if (showMembersModal && activeGroupId) {
      fetchGroupMembers(activeGroupId);
    }
  }, [showMembersModal, activeGroupId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedFile) || !activeGroupId || activeGroup?.status === GroupStatus.ARCHIVED) return;

    try {
      const sentMsg = await apiService.sendMessage(activeGroupId, inputText, selectedFile || undefined);
      setMessages(prev => {
        const updated = [...prev, sentMsg];
        // Update stored count immediately to prevent badge reappearing after switching groups
        const stored = getStoredCounts();
        stored[activeGroupId] = updated.length;
        saveStoredCounts(stored);
        console.log(`[Send Message] Sent message in ${activeGroup?.name}. Updated stored count to ${updated.length}`);
        return updated;
      });
      // Update last activity when sending a message
      updateLastActivity(activeGroupId);
      setInputText('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      alert("Failed to send message.");
    }
  };

  const handleSummarize = async () => {
    if (messages.length === 0) {
      alert('No messages to summarize yet.');
      return;
    }

    setIsSummarizing(true);
    setSummary(null); // Clear previous summary

    try {
      // Filter out messages that only have files and no text content
      const textMessages = messages
        .filter(m => m.content && m.content.trim().length > 0)
        .map(m => `${m.user_name}: ${m.content}`);

      if (textMessages.length === 0) {
        setSummary('No text messages to summarize. The chat only contains files.');
        setIsSummarizing(false);
        return;
      }

      console.log('[GroupsPage] Summarizing', textMessages.length, 'messages');
      const res = await geminiService.summarizeChat(textMessages);
      setSummary(res || 'No summary available.');
    } catch (error: any) {
      console.error('[GroupsPage] Summary error:', error);
      setSummary(`Failed to generate summary: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleGeneratePlan = async () => {
    if (!activeGroup) return;
    setIsGeneratingPlan(true);
    const plan = await geminiService.suggestStudyPlan(activeGroup.subject);
    setStudyPlan(plan);
    setShowStudyPlanModal(true);
    setIsGeneratingPlan(false);
  };

  const handleScheduleMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroupId) return;
    if (containsBadWords(newMeeting.title) || containsBadWords(newMeeting.location)) {
      alert('Your meeting content contains inappropriate language. Please revise and try again.');
      return;
    }
    setScheduling(true);
    try {
      await apiService.createEvent({
        title: newMeeting.title,
        start_time: newMeeting.start_time,
        location: newMeeting.location,
        recurrence: newMeeting.recurrence,
        recurrence_count: newMeeting.recurrence_count,
        type: 'Group Meeting',
        group_id: activeGroupId
      });

      // Share meeting details to group chat
      const dateStr = new Date(newMeeting.start_time).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const recurrenceLabel = newMeeting.recurrence !== 'none' && newMeeting.recurrence_count ? ` (Repeats ${newMeeting.recurrence} for ${newMeeting.recurrence_count} occurrences)` : '';
      const locationStr = newMeeting.location ? `\nLocation: ${newMeeting.location}` : '';
      const chatMsg = `📅 New Meeting Scheduled!\n\n${newMeeting.title}\n${dateStr}${recurrenceLabel}${locationStr}\n\nAll members have been notified.`;
      try {
        const sentMsg = await apiService.sendMessage(activeGroupId, chatMsg);
        setMessages(prev => [...prev, sentMsg]);
      } catch {}

      setNewMeeting({ title: '', start_time: '', location: '', recurrence: 'none', recurrence_count: '' });
      setShowScheduleForm(false);
      await fetchGroupEvents(activeGroupId);
    } catch (err) {
      alert("Scheduling failed.");
    } finally {
      setScheduling(false);
    }
  };

  const handleOpenEditModal = () => {
    if (!activeGroup) return;
    setEditGroupData({
      name: activeGroup.name,
      description: activeGroup.description,
      max_members: activeGroup.max_members,
      location: activeGroup.location,
      subject: activeGroup.subject,
      faculty: activeGroup.faculty,
      status: activeGroup.status || 'open'
    });
    setShowMembersModal(false);
    setIsEditModalOpen(true);
    setIsStatusMenuOpen(false);
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroupId) return;
    setIsUpdatingStatus(true);
    try {
      await apiService.updateGroup(activeGroupId, editGroupData);
      await fetchMyGroups();
      setIsEditModalOpen(false);
    } catch (err) {
      alert("Failed to update group");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!activeGroupId || !activeGroup) return;
    if (!confirm(`Are you absolutely sure you want to delete "${activeGroup.name}"? This action cannot be undone and all data will be lost.`)) return;

    try {
      // Assuming apiService.deleteGroup exists or we add it (it should call DELETE /api/groups/:id)
      const res = await fetch(`${API_CONFIG.BASE_URL}/groups/${activeGroupId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${currentUser?.token}`
        }
      });
      if (!res.ok) throw new Error("Failed to delete group");
      
      alert("Group dissolved successfully.");
      setActiveGroupId(null);
      fetchMyGroups();
    } catch (err) {
      alert("Failed to delete group.");
    }
  };

  const handleKickMember = async (userId: number, userName: string) => {
    if (!activeGroupId) return;
    if (!confirm(`Remove ${userName} from ${activeGroup?.name}? This member will lose access to all group resources.`)) return;

    setKickingMemberId(userId);
    try {
      await apiService.kickMember(activeGroupId, String(userId));
      alert(`${userName} has been removed from the group.`);
      await fetchGroupMembers(activeGroupId);
      await fetchMyGroups();
    } catch (err: any) {
      alert(err.message || 'Failed to remove member.');
    } finally {
      setKickingMemberId(null);
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeGroupId || !activeGroup) return;
    if (!confirm(`Are you sure you want to leave "${activeGroup.name}"?`)) return;

    setLeavingGroup(true);
    try {
      await apiService.leaveGroup(activeGroupId);
      setShowMembersModal(false);
      setActiveGroupId(null);
      await fetchMyGroups();
    } catch (err: any) {
      alert(err.message || 'Failed to leave group.');
    } finally {
      setLeavingGroup(false);
    }
  };

  const handleInviteSearch = async (query: string) => {
    setInviteSearchQuery(query);
    if (!query.trim() || !activeGroupId) {
      setInviteSearchResults([]);
      return;
    }

    try {
      const users = await apiService.searchUsers(query);
      // Filter out users who are already members
      const nonMembers = users.filter((user: any) =>
        !groupMembers.some(member => member.id === user.id)
      );
      setInviteSearchResults(nonMembers);
    } catch (err) {
      console.error('Failed to search users:', err);
    }
  };

  const handleSendInvitation = async (userId: number) => {
    if (!activeGroupId) return;

    setInvitingUserId(userId);
    try {
      await apiService.inviteUserToGroup(activeGroupId, userId.toString());
      // Remove from search results or mark as invited
      setInviteSearchResults(prev =>
        prev.map(user => user.id === userId ? { ...user, invited: true } : user)
      );
    } catch (err: any) {
      alert(err.message || 'Failed to send invitation');
    } finally {
      setInvitingUserId(null);
    }
  };

  const fetchGroupEvents = async (groupId: string) => {
    setLoadingEvents(true);
    try {
      const allEvents = await apiService.getEvents();
      setGroupEvents(allEvents.filter((e: any) => String(e.group_id) === String(groupId)));
    } catch (err) {
      console.error("Failed to fetch events", err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleDeleteMeeting = (event: any) => {
    setCancellingEvent(event);
    setShowCancelReasonModal(true);
  };

  const handleCancelMeetingWithReason = async (reason?: string) => {
    if (!cancellingEvent) return;

    setActionLoading(cancellingEvent.id);
    setShowCancelReasonModal(false);

    try {
      await apiService.deleteEvent(cancellingEvent.id, reason);
      if (activeGroupId) await fetchGroupEvents(activeGroupId);
      alert('Meeting cancelled successfully.');
    } catch (err) {
      alert('Failed to cancel meeting.');
    } finally {
      setActionLoading(null);
      setCancellingEvent(null);
      setCancellationReason('');
    }
  };

  const handleCancelCancellation = () => {
    setShowCancelReasonModal(false);
    setCancellingEvent(null);
    setCancellationReason('');
  };

  const handleRescheduleMeeting = async () => {
    if (!rescheduleEvent || !rescheduleTime) return;
    setActionLoading(rescheduleEvent.id);
    try {
      // Delete old event then create a new one with updated time and recurrence
      await apiService.deleteEvent(rescheduleEvent.id);
      await apiService.createEvent({
        title: rescheduleEvent.title,
        type: rescheduleEvent.type || 'Group Meeting',
        start_time: rescheduleTime,
        location: rescheduleLocation,
        recurrence: rescheduleRecurrence,
        recurrence_count: rescheduleRecurrenceCount,
        group_id: rescheduleEvent.group_id || activeGroupId,
      });
      setRescheduleEvent(null);
      setRescheduleTime('');
      setRescheduleRecurrence('none');
      setRescheduleRecurrenceCount('');
      setRescheduleLocation('');
      if (activeGroupId) await fetchGroupEvents(activeGroupId);
    } catch (err) {
      alert('Failed to reschedule meeting.');
    } finally {
      setActionLoading(null);
    }
  };


  const getStatusBadge = (status: GroupStatus) => {
    switch (status) {
      case GroupStatus.OPEN:
        return <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-wider"><Unlock size={12}/> Open</span>;
      case GroupStatus.CLOSED:
        return <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-wider"><LockIcon size={12}/> Closed</span>;
      case GroupStatus.ARCHIVED:
        return <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider"><Archive size={12}/> Archived</span>;
      default:
        return null;
    }
  };

  if (loadingGroups) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <Loader2 size={48} className="animate-spin text-orange-500" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading your workspace...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500">
      <div className={`${activeGroupId ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 flex-col gap-4`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Your Study Groups</h2>
          <button
            onClick={() => setShowArchivedGroups(!showArchivedGroups)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              showArchivedGroups
                ? 'bg-slate-500 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Archive size={14} />
            {showArchivedGroups ? 'Active' : 'Archived'}
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto pr-2 pb-4">
          {myGroups.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-8 text-center space-y-4">
              <UsersIcon size={32} className="mx-auto text-slate-200" />
              <p className="text-sm font-medium text-slate-400">You haven't joined any groups yet.</p>
              <Link to="/home" className="inline-block text-xs font-black text-orange-500 uppercase tracking-widest hover:text-orange-600">Browse Feed</Link>
            </div>
          ) : (
            <>
              {/* Section tabs */}
              <div className="flex p-1 bg-slate-100 rounded-2xl mb-3">
                <button
                  onClick={() => { setActiveSection('created'); setActiveGroupId(null); }}
                  className={`relative flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSection === 'created' ? 'bg-white text-orange-500 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Created
                  {createdGroups.length > 0 && <span className="ml-1 opacity-60">({createdGroups.length})</span>}
                  {createdTabBadge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow">
                      {createdTabBadge}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { setActiveSection('joined'); setActiveGroupId(null); }}
                  className={`relative flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSection === 'joined' ? 'bg-white text-orange-500 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Joined
                  {joinedGroups.length > 0 && <span className="ml-1 opacity-60">({joinedGroups.length})</span>}
                  {joinedTabBadge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow">
                      {joinedTabBadge}
                    </span>
                  )}
                </button>
              </div>

              {/* Group list for active tab */}
              {(() => {
                const list = activeSection === 'created' ? createdGroups : joinedGroups;
                if (list.length === 0) return (
                  <div className="p-8 text-center opacity-40">
                    {searchQuery ? (
                      <>
                        <Search size={24} className="mx-auto mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest">No matching groups</p>
                      </>
                    ) : showArchivedGroups ? (
                      <>
                        <Archive size={24} className="mx-auto mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest">No archived groups</p>
                      </>
                    ) : (
                      <p className="text-xs font-bold uppercase tracking-widest">No groups here</p>
                    )}
                  </div>
                );
                return (
                  <div className="space-y-3">
                    {list.map(group => {
                      const unread = unreadCounts[group.id] || 0;
                      return (
                        <button
                          key={group.id}
                          onClick={() => setActiveGroupId(String(group.id))}
                          className={`w-full text-left p-5 rounded-[2rem] border transition-all relative ${
                            String(activeGroupId) === String(group.id)
                              ? 'bg-orange-500 border-orange-500 text-white shadow-xl shadow-orange-100 scale-[1.02]'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          } ${group.status === GroupStatus.ARCHIVED ? 'grayscale opacity-80' : ''}`}
                        >
                          {unread > 0 && String(activeGroupId) !== String(group.id) && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg shadow-red-200 animate-in zoom-in duration-200">
                              {unread}
                            </span>
                          )}
                          {(group.pending_requests_count || 0) > 0 && group.creator_id === currentUser?.id && String(activeGroupId) !== String(group.id) && (
                            <span className="absolute -top-1.5 -left-1.5 min-w-[22px] h-[22px] px-1.5 bg-amber-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg shadow-amber-200 animate-in zoom-in duration-200">
                              {group.pending_requests_count}
                            </span>
                          )}
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${String(activeGroupId) === String(group.id) ? 'bg-white/20' : 'bg-orange-100 text-orange-600'}`}>
                              {group.name[0]}
                            </div>
                            <div className="flex-1 flex items-center justify-between">
                              <span className={`text-[10px] font-black uppercase tracking-widest ${String(activeGroupId) === String(group.id) ? 'text-orange-100' : 'text-slate-400'}`}>
                                {group.subject}
                              </span>
                              {group.status !== GroupStatus.OPEN && (
                                <span className={`${String(activeGroupId) === String(group.id) ? 'text-white/60' : 'text-slate-300'}`}>
                                  {group.status === GroupStatus.ARCHIVED ? <Archive size={10} /> : <LockIcon size={10} />}
                                </span>
                              )}
                            </div>
                          </div>
                          <h3 className="font-bold truncate">{group.name}</h3>
                          <p className={`text-[10px] font-bold mt-1 ${String(activeGroupId) === String(group.id) ? 'text-orange-50' : 'text-slate-400'}`}>
                            {group.members_count} Members • {group.status}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {activeGroup && (
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Workspace Tools</h4>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={handleGeneratePlan}
                disabled={isGeneratingPlan || activeGroup.status === GroupStatus.ARCHIVED}
                className="flex flex-col items-center justify-center p-4 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition-all gap-2 disabled:opacity-50"
              >
                {isGeneratingPlan ? <Loader2 size={18} className="animate-spin" /> : <BookOpen size={18} />}
                <span className="text-[10px] font-black uppercase">Study Plan</span>
              </button>
              <button
                onClick={() => setShowLiveSession(true)}
                disabled={activeGroup.status === GroupStatus.ARCHIVED}
                className="flex flex-col items-center justify-center p-4 bg-orange-50 text-orange-600 rounded-2xl hover:bg-orange-100 transition-all gap-2 disabled:opacity-50"
              >
                <Mic size={18} />
                <span className="text-[10px] font-black uppercase">Live Room</span>
              </button>
              {(activeGroup.is_member || isLeader) && (
                <button
                  onClick={() => setShowMembersModal(true)}
                  className="flex flex-col items-center justify-center p-4 bg-purple-50 text-purple-600 rounded-2xl hover:bg-purple-100 transition-all gap-2"
                >
                  <UsersIcon size={18} />
                  <span className="text-[10px] font-black uppercase">Details</span>
                </button>
              )}
              {isLeader && (
                <button
                  onClick={() => { setShowMeetingsModal(true); setShowScheduleForm(false); if (activeGroupId) fetchGroupEvents(activeGroupId); }}
                  disabled={activeGroup.status === GroupStatus.ARCHIVED}
                  className="flex flex-col items-center justify-center p-4 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 transition-all gap-2 col-span-2 disabled:opacity-50"
                >
                  <CalendarIcon size={18} />
                  <span className="text-[10px] font-black uppercase">Meetings</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className={`flex-1 bg-white border border-slate-200 rounded-[2.5rem] flex flex-col overflow-hidden shadow-sm relative ${activeGroup?.status === GroupStatus.ARCHIVED ? 'bg-slate-50/50' : ''}`}>
        {activeGroup ? (
          <>
            <div className="p-3 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur-md sticky top-0 z-10 gap-2">
              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <button
                  onClick={() => setActiveGroupId(null)}
                  className="lg:hidden p-2 -ml-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all shrink-0"
                  aria-label="Back to groups"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-lg shrink-0 ${activeGroup.status === GroupStatus.ARCHIVED ? 'bg-slate-400 shadow-slate-100' : 'bg-orange-500 shadow-orange-100'}`}>
                  {activeGroup.name[0]}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-bold text-slate-900 text-base sm:text-lg leading-none truncate">{activeGroup.name}</h3>
                    {getStatusBadge(activeGroup.status)}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    {activeGroup.status === GroupStatus.OPEN ? (
                       <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    ) : (
                       <span className="w-2 h-2 bg-slate-300 rounded-full"></span>
                    )}
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {activeGroup.members_count} members enrolled • Led by{' '}
                      <Link
                        to={`/profile/${activeGroup.creator_id}`}
                        className="hover:text-orange-500 transition-colors cursor-pointer"
                      >
                        {activeGroup.creator_name}
                      </Link>
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                {isLeader && activeGroup.pending_requests_count > 0 && (
                  <button
                    onClick={() => setShowPendingRequestsModal(true)}
                    className="relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-amber-100 transition-all"
                  >
                    <Bell size={14} />
                    <span className="hidden sm:inline">{activeGroup.pending_requests_count} Request{activeGroup.pending_requests_count !== 1 ? 's' : ''}</span>
                    <span className="sm:hidden font-black">{activeGroup.pending_requests_count}</span>
                  </button>
                )}
                <button
                  onClick={handleSummarize}
                  disabled={isSummarizing || activeGroup.status === GroupStatus.ARCHIVED}
                  className="p-2.5 text-orange-500 hover:bg-orange-50 rounded-xl transition-all relative group disabled:opacity-30"
                >
                  {isSummarizing ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                </button>
                
                <div className="relative" ref={statusMenuRef}>
                   <button 
                     onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                     className={`p-2.5 rounded-xl transition-all ${isStatusMenuOpen ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:bg-slate-50'}`}
                   >
                     <MoreHorizontal size={20} />
                   </button>
                   {isStatusMenuOpen && (
                      <div className="absolute top-12 right-0 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2">
                        {isLeader ? (
                          <>
                            <button
                              onClick={() => { handleOpenEditModal(); setIsStatusMenuOpen(false); }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-left text-slate-600 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                            >
                              <Edit2 size={14} />
                              <span className="text-xs font-bold flex-1">Edit Group</span>
                            </button>
                            <button
                              onClick={() => { handleDeleteGroup(); setIsStatusMenuOpen(false); }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={14} />
                              <span className="text-xs font-bold flex-1">Delete Group</span>
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => { handleLeaveGroup(); setIsStatusMenuOpen(false); }}
                            disabled={leavingGroup}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            {leavingGroup ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                            <span className="text-xs font-bold flex-1">Leave Group</span>
                          </button>
                        )}
                      </div>
                   )}
                </div>
              </div>
            </div>

            {/* Mobile Workspace Tools - shown only when left panel is hidden */}
            <div className="lg:hidden flex gap-2 px-3 py-2 border-b border-slate-100 overflow-x-auto shrink-0">
              <button
                onClick={handleGeneratePlan}
                disabled={isGeneratingPlan || activeGroup.status === GroupStatus.ARCHIVED}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 rounded-xl shrink-0 disabled:opacity-50"
              >
                {isGeneratingPlan ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
                <span className="text-[10px] font-black uppercase">Study Plan</span>
              </button>
              <button
                onClick={() => setShowLiveSession(true)}
                disabled={activeGroup.status === GroupStatus.ARCHIVED}
                className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 text-orange-600 rounded-xl shrink-0 disabled:opacity-50"
              >
                <Mic size={14} />
                <span className="text-[10px] font-black uppercase">Live Room</span>
              </button>
              {(activeGroup.is_member || isLeader) && (
                <button
                  onClick={() => setShowMembersModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-600 rounded-xl shrink-0"
                >
                  <UsersIcon size={14} />
                  <span className="text-[10px] font-black uppercase">Details</span>
                </button>
              )}
              {isLeader && (
                <button
                  onClick={() => { setShowMeetingsModal(true); setShowScheduleForm(false); if (activeGroupId) fetchGroupEvents(activeGroupId); }}
                  disabled={activeGroup.status === GroupStatus.ARCHIVED}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0 disabled:opacity-50"
                >
                  <CalendarIcon size={14} />
                  <span className="text-[10px] font-black uppercase">Meetings</span>
                </button>
              )}
            </div>

            <div ref={chatContainerRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50/30 relative">
              {activeGroup.status === GroupStatus.ARCHIVED && (
                 <div className="bg-slate-100 border border-slate-200 p-6 rounded-[2rem] text-center space-y-2 mb-4 animate-in slide-in-from-top-2">
                    <Archive size={32} className="mx-auto text-slate-400" />
                    <h4 className="font-bold text-slate-700">This hub is archived</h4>
                    <p className="text-xs text-slate-500 font-medium">Messages are read-only. Leaders can reactivate the hub at any time.</p>
                 </div>
              )}

              {loadingMessages ? (
                <div className="flex justify-center py-10">
                  <Loader2 size={24} className="animate-spin text-slate-300" />
                </div>
              ) : (
                <>
                  {summary && (
                    <div ref={summaryRef} className="bg-orange-50 border border-orange-100 p-5 rounded-3xl shadow-sm">
                      <div className="flex items-center gap-2 text-orange-600 mb-2">
                        <Sparkles size={16} />
                        <span className="text-xs font-bold uppercase tracking-widest">AI Catch-up</span>
                      </div>
                      <p className="text-sm text-orange-800 leading-relaxed font-medium">{summary}</p>
                      <button onClick={() => setSummary(null)} className="text-[10px] font-black text-orange-400 uppercase mt-4 hover:text-orange-600 transition-colors">Dismiss</button>
                    </div>
                  )}

                  {messages.length === 0 && (
                    <div className="text-center py-10 space-y-2 opacity-30">
                      <MessageSquare size={32} className="mx-auto" />
                      <p className="text-xs font-bold uppercase tracking-widest">No messages yet</p>
                    </div>
                  )}

                  {messages.map((msg, idx) => {
                    if (msg.type === 'system') {
                      return (
                        <div key={msg.id} className="flex items-center gap-3 py-1 px-2">
                          <div className="flex-1 h-px bg-slate-200" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                            {msg.user_name} joined the group
                          </span>
                          <div className="flex-1 h-px bg-slate-200" />
                        </div>
                      );
                    }

                    const isMe = msg.user_id === currentUser?.id;
                    const isGroupLeader = msg.user_id === activeGroup.creator_id;
                    const isImage = msg.file_type?.startsWith('image/');
                    const isVideo = msg.file_type?.startsWith('video/');
                    const fileUrl = msg.file_path ? `${API_CONFIG.STORAGE_URL}/${msg.file_path}` : null;
                    const fileSizeLabel = msg.file_size
                      ? msg.file_size >= 1024 * 1024
                        ? `${(msg.file_size / (1024 * 1024)).toFixed(1)} MB`
                        : `${(msg.file_size / 1024).toFixed(1)} KB`
                      : 'File';

                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 mb-1.5 px-2">
                          <Link
                            to={`/profile/${msg.user_id}`}
                            className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:text-orange-500 transition-colors cursor-pointer"
                          >
                            {msg.user_name}
                            {isGroupLeader && <span className="ml-1.5 text-[8px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded border border-orange-200">LEADER</span>}
                          </Link>
                          <span className="text-[10px] font-medium text-slate-300">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className={`max-w-[85%] px-5 py-3.5 rounded-3xl text-sm font-medium leading-relaxed shadow-sm ${
                          isMe ? 'bg-orange-500 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                        }`}>
                          {msg.content && <div className="mb-2">{msg.content}</div>}
                          {msg.file_path && (
                            <div className="space-y-2">
                              {isImage && fileUrl ? (
                                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block">
                                  <img
                                    src={fileUrl}
                                    alt={msg.file_name || 'Uploaded image'}
                                    className="max-w-full max-h-64 rounded-xl border-2 border-white/20 hover:border-white/40 transition-all cursor-pointer"
                                  />
                                  <div className={`flex items-center gap-2 mt-2 text-xs ${isMe ? 'text-orange-100' : 'text-slate-500'}`}>
                                    <FileIcon size={14} />
                                    <span className="truncate">{msg.file_name}</span>
                                  </div>
                                </a>
                              ) : isVideo && fileUrl ? (
                                <div>
                                  <video
                                    src={fileUrl}
                                    controls
                                    className="max-w-full max-h-64 rounded-xl border-2 border-white/20"
                                    preload="metadata"
                                  />
                                  <div className={`flex items-center gap-2 mt-2 text-xs ${isMe ? 'text-orange-100' : 'text-slate-500'}`}>
                                    <Video size={14} />
                                    <span className="truncate">{msg.file_name}</span>
                                    <span className="shrink-0">· {fileSizeLabel}</span>
                                  </div>
                                </div>
                              ) : (
                                <a
                                  href={fileUrl || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                                    isMe ? 'bg-orange-600 hover:bg-orange-700' : 'bg-slate-100 hover:bg-slate-200'
                                  }`}
                                >
                                  <div className={`p-2 rounded-lg ${isMe ? 'bg-orange-700' : 'bg-white'}`}>
                                    <FileIcon size={20} className={isMe ? 'text-white' : 'text-slate-600'} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-bold truncate ${isMe ? 'text-white' : 'text-slate-900'}`}>
                                      {msg.file_name}
                                    </div>
                                    <div className={`text-xs ${isMe ? 'text-orange-100' : 'text-slate-500'}`}>
                                      {fileSizeLabel}
                                    </div>
                                  </div>
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              {!isAtBottom && (
                <button
                  onClick={scrollToBottom}
                  className="sticky bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center w-9 h-9 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg transition-all z-10"
                  aria-label="Scroll to bottom"
                >
                  <ChevronDown size={18} />
                </button>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className={`p-3 sm:p-6 bg-white border-t border-slate-100 ${activeGroup.status === GroupStatus.ARCHIVED ? 'pointer-events-none opacity-50 grayscale' : ''}`}>
              {selectedFile && (
                <div className="mb-3 flex items-center gap-2 bg-orange-50 border border-orange-200 px-4 py-2 rounded-xl">
                  {selectedFile.type.startsWith('video/') ? <Video size={16} className="text-orange-600" /> : <FileIcon size={16} className="text-orange-600" />}
                  <span className="text-sm font-semibold text-orange-900 flex-1 truncate">{selectedFile.name}</span>
                  <span className="text-xs text-orange-600">
                    {selectedFile.size >= 1024 * 1024
                      ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
                      : `${(selectedFile.size / 1024).toFixed(1)} KB`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-orange-600 hover:text-orange-800 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-[2rem] border border-slate-200 focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:bg-white transition-all">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setSelectedFile(file);
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={activeGroup.status === GroupStatus.ARCHIVED}
                  className="w-10 h-10 bg-white hover:bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center transition-all disabled:opacity-50 border border-slate-200"
                  title="Attach file"
                >
                  <Paperclip size={18} />
                </button>
                <input
                  type="text"
                  disabled={activeGroup.status === GroupStatus.ARCHIVED}
                  placeholder={activeGroup.status === GroupStatus.ARCHIVED ? "Hub is archived" : "Share a thought or question..."}
                  className="flex-1 bg-transparent border-none outline-none px-4 text-sm font-medium text-slate-700"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={(!inputText.trim() && !selectedFile) || activeGroup.status === GroupStatus.ARCHIVED}
                  className="w-10 h-10 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl flex items-center justify-center transition-all disabled:opacity-50 disabled:scale-95 shadow-lg shadow-orange-100"
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
            <MessageSquare size={64} className="mb-6 opacity-20" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No group selected</h3>
            <p className="max-w-xs">Pick a study group from the left to start collaborating with your classmates.</p>
          </div>
        )}
      </div>

      {/* Edit Group Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
           <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-orange-500 p-10 flex justify-between items-center text-white">
              <div>
                <h3 className="text-3xl font-black tracking-tight">Edit Hub</h3>
                <p className="text-orange-100 text-sm font-bold mt-1">Update your session details</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-all">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateGroup} className="p-10 space-y-6">
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Hub Name</label>
                  <input 
                    required 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none text-sm font-bold"
                    value={editGroupData.name}
                    onChange={e => setEditGroupData({...editGroupData, name: e.target.value})}
                  />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Subject Area</label>
                  <input 
                    required 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none text-sm font-bold"
                    value={editGroupData.subject}
                    onChange={e => setEditGroupData({...editGroupData, subject: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Faculty</label>
                  <input 
                    required 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none text-sm font-bold"
                    value={editGroupData.faculty}
                    onChange={e => setEditGroupData({...editGroupData, faculty: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Description</label>
                <textarea 
                  required 
                  rows={3}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none text-sm font-bold resize-none"
                  value={editGroupData.description}
                  onChange={e => setEditGroupData({...editGroupData, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Max Students</label>
                  <input
                    type="number"
                    min={2}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none text-sm font-bold"
                    value={editGroupData.max_members}
                    onChange={e => setEditGroupData({...editGroupData, max_members: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Location</label>
                  <input
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none text-sm font-bold"
                    value={editGroupData.location}
                    onChange={e => setEditGroupData({...editGroupData, location: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Group Status</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['open', 'closed', 'archived'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditGroupData({...editGroupData, status: s})}
                      className={`py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border-2 ${
                        editGroupData.status === s
                          ? s === 'open'
                            ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-100'
                            : s === 'closed'
                            ? 'bg-slate-700 border-slate-700 text-white shadow-lg shadow-slate-100'
                            : 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-100'
                          : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 px-8 py-4 border-2 border-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isUpdatingStatus}
                  className="flex-1 px-8 py-4 bg-orange-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-600 shadow-xl shadow-orange-100 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isUpdatingStatus ? <Loader2 className="animate-spin mx-auto" size={18} /> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLiveSession && activeGroup && (
        <LiveStudySession
          subject={activeGroup.subject}
          onClose={() => setShowLiveSession(false)}
        />
      )}

      {showStudyPlanModal && studyPlan && activeGroup && (
        <StudyPlanModal
          studyPlan={studyPlan}
          subject={activeGroup.subject}
          onClose={() => setShowStudyPlanModal(false)}
        />
      )}

      {showPendingRequestsModal && activeGroup && (
        <PendingRequestsModal
          groupId={activeGroup.id}
          groupName={activeGroup.name}
          onClose={() => setShowPendingRequestsModal(false)}
          onRequestProcessed={() => {
            fetchMyGroups();
          }}
        />
      )}

      {showMembersModal && activeGroup && (activeGroup.is_member || isLeader) && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-purple-500 p-10 flex justify-between items-center text-white">
              <div>
                <h3 className="text-3xl font-black tracking-tight">Group Details</h3>
                <p className="text-purple-100 text-sm font-bold mt-1">{activeGroup.name}</p>
              </div>
              <button
                onClick={() => setShowMembersModal(false)}
                className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 max-h-[600px] overflow-y-auto space-y-6">
              {/* Group Info */}
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center font-black text-2xl border border-purple-200 shrink-0">
                    {activeGroup.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 text-xl mb-2">{activeGroup.name}</h4>
                    <p className="text-sm text-slate-600 mb-3">{activeGroup.description}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">
                        {activeGroup.subject}
                      </span>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                        {activeGroup.faculty}
                      </span>
                      {getStatusBadge(activeGroup.status)}
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Leader</p>
                    <p className="text-sm font-bold text-slate-900">{activeGroup.creator_name}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Members</p>
                    <p className="text-sm font-bold text-slate-900">{activeGroup.members_count} / {activeGroup.max_members}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Location</p>
                    <p className="text-sm font-bold text-slate-900">{activeGroup.location}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Created</p>
                    <p className="text-sm font-bold text-slate-900">
                      {new Date(activeGroup.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Member List */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <UsersIcon className="text-purple-600" size={24} />
                  <h4 className="text-lg font-bold text-slate-900">Members ({activeGroup.members_count})</h4>
                </div>

                {loadingMembers ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 size={32} className="animate-spin text-purple-600" />
                  </div>
                ) : groupMembers.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-xl text-center">
                    <p className="text-sm text-slate-600">No members found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {groupMembers.map((member) => (
                      <div key={member.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100 transition-all">
                        <Link
                          to={`/profile/${member.id}`}
                          className={`w-12 h-12 ${member.is_leader ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'} rounded-xl flex items-center justify-center font-bold text-lg cursor-pointer hover:scale-105 transition-transform overflow-hidden`}
                        >
                          {member.avatar
                            ? <img src={`${API_CONFIG.STORAGE_URL}/${member.avatar}`} alt={member.name} className="w-full h-full object-cover" />
                            : member.name[0]
                          }
                        </Link>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Link
                              to={`/profile/${member.id}`}
                              className="font-bold text-slate-900 hover:text-orange-500 transition-colors cursor-pointer"
                            >
                              {member.name}
                            </Link>
                            {member.is_leader && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
                                Leader
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{member.email}</p>
                          {member.major && (
                            <p className="text-xs text-slate-600 mt-1">
                              <span className="font-bold">Major:</span> {member.major}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-xs text-slate-400">
                              Joined {new Date(member.joined_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                          {isLeader && !member.is_leader && (
                            <button
                              onClick={() => handleKickMember(member.id, member.name)}
                              disabled={kickingMemberId === member.id}
                              className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Remove member from group"
                            >
                              {kickingMemberId === member.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <UserX size={14} />
                              )}
                              Kick
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Invite Members Section (Leader Only) */}
                {isLeader && (
                  <div className="mt-6 border-t border-slate-200 pt-6">
                    <button
                      onClick={() => setShowInviteSection(!showInviteSection)}
                      className="flex items-center gap-2 text-sm font-bold text-purple-600 hover:text-purple-700 transition-colors mb-4"
                    >
                      <UserPlus size={16} />
                      {showInviteSection ? 'Hide' : 'Invite Members'}
                    </button>

                    {showInviteSection && (
                      <div className="space-y-4">
                        <div className="relative">
                          <input
                            type="text"
                            value={inviteSearchQuery}
                            onChange={(e) => handleInviteSearch(e.target.value)}
                            placeholder="Search users by name or major..."
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none"
                          />
                        </div>

                        {inviteSearchResults.length > 0 && (
                          <div className="max-h-60 overflow-y-auto space-y-2 bg-slate-50 rounded-xl p-3">
                            {inviteSearchResults.map((user: any) => (
                              <div
                                key={user.id}
                                className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-bold">
                                    {user.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900 text-sm">{user.name}</div>
                                    <div className="text-xs text-slate-500">{user.email}</div>
                                    {user.major && (
                                      <div className="text-xs text-slate-400">{user.major}</div>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleSendInvitation(user.id)}
                                  disabled={invitingUserId === user.id || user.invited}
                                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                    user.invited
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-purple-500 text-white hover:bg-purple-600'
                                  }`}
                                >
                                  {invitingUserId === user.id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : user.invited ? (
                                    <>
                                      <Check size={14} />
                                      Invited
                                    </>
                                  ) : (
                                    <>
                                      <UserPlus size={14} />
                                      Invite
                                    </>
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {inviteSearchQuery && inviteSearchResults.length === 0 && (
                          <div className="text-center text-slate-400 text-sm py-4">
                            No users found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
      {/* Meetings Management Modal */}
      {showMeetingsModal && activeGroup && isLeader && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-500 p-10 flex justify-between items-center text-white">
              <div>
                <h3 className="text-3xl font-black tracking-tight">Meetings</h3>
                <p className="text-emerald-100 text-sm font-bold mt-1">{activeGroup.name}</p>
              </div>
              <button
                onClick={() => { setShowMeetingsModal(false); setShowScheduleForm(false); }}
                className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 max-h-[500px] overflow-y-auto space-y-4">
              {/* Inline Schedule Form */}
              {showScheduleForm && (
                <form onSubmit={handleScheduleMeeting} className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3 animate-in slide-in-from-top-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-black text-emerald-700 uppercase tracking-widest">New Meeting</p>
                    <button type="button" onClick={() => setShowScheduleForm(false)} className="text-emerald-400 hover:text-emerald-600"><X size={16} /></button>
                  </div>
                  <div className="relative">
                    <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input
                      required placeholder="Meeting title"
                      className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-emerald-500"
                      value={newMeeting.title}
                      onChange={e => setNewMeeting({...newMeeting, title: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                      <input
                        type="datetime-local" required
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-emerald-500"
                        value={newMeeting.start_time}
                        onChange={e => setNewMeeting({...newMeeting, start_time: e.target.value})}
                      />
                    </div>
                    <div className="relative">
                      <Repeat className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                      <select
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-emerald-500 appearance-none"
                        value={newMeeting.recurrence}
                        onChange={e => setNewMeeting({...newMeeting, recurrence: e.target.value})}
                      >
                        <option value="none">One-time</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    {newMeeting.recurrence !== 'none' && (
                      <input
                        type="number"
                        placeholder={`How many ${newMeeting.recurrence === 'daily' ? 'days' : newMeeting.recurrence === 'weekly' ? 'weeks' : 'months'}?`}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-emerald-500"
                        value={newMeeting.recurrence_count}
                        onChange={e => setNewMeeting({...newMeeting, recurrence_count: e.target.value})}
                        min="1"
                        max="365"
                      />
                    )}
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input
                      placeholder="Location or link (optional)"
                      className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-emerald-500"
                      value={newMeeting.location}
                      onChange={e => setNewMeeting({...newMeeting, location: e.target.value})}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={scheduling}
                    className="w-full py-3 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                  >
                    {scheduling ? <Loader2 size={16} className="animate-spin" /> : <><Send size={14} /> Schedule & Share to Chat</>}
                  </button>
                </form>
              )}

              {/* Meetings List */}
              {loadingEvents ? (
                <div className="flex items-center justify-center p-10">
                  <Loader2 size={32} className="animate-spin text-emerald-500" />
                </div>
              ) : groupEvents.length === 0 && !showScheduleForm ? (
                <div className="p-10 text-center space-y-3">
                  <CalendarIcon size={40} className="mx-auto text-slate-200" />
                  <p className="text-sm font-bold text-slate-400">No meetings scheduled yet</p>
                  <button
                    onClick={() => setShowScheduleForm(true)}
                    className="text-xs font-black text-emerald-500 uppercase tracking-widest hover:text-emerald-600"
                  >
                    Schedule one now
                  </button>
                </div>
              ) : (
                groupEvents
                  .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                  .map((event) => {
                    const isPast = new Date(event.start_time) < new Date();
                    return (
                      <div key={event.id} className={`p-5 rounded-2xl border transition-all ${isPast ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 hover:border-emerald-200'}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-bold text-slate-900 truncate">{event.title}</h4>
                              {event.recurrence && event.recurrence !== 'none' && (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase shrink-0">
                                  <Repeat size={10} />
                                  {event.recurrence}
                                </span>
                              )}
                              {isPast && (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-black uppercase shrink-0">Past</span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-500">
                              <span className="flex items-center gap-1.5">
                                <Clock size={14} />
                                <span className="font-bold">
                                  {new Date(event.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </span>
                              {event.location && (
                                <span className="flex items-center gap-1.5">
                                  <MapPin size={14} />
                                  {/^https?:\/\//i.test(event.location) ? (
                                    <a href={event.location} target="_blank" rel="noopener noreferrer" className="font-medium text-orange-500 hover:text-orange-600 flex items-center gap-1">
                                      {(() => { try { return new URL(event.location).hostname.replace(/^www\./, ''); } catch { return 'Open link'; } })()}
                                      <ExternalLink size={11} />
                                    </a>
                                  ) : (
                                    <span className="font-medium truncate">{event.location}</span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Reschedule */}
                            <button
                              onClick={() => {
                                setRescheduleEvent(event);
                                setRescheduleTime(event.start_time?.slice(0, 16) || '');
                                setRescheduleRecurrence(event.recurrence || 'none');
                                setRescheduleRecurrenceCount(event.recurrence_count || '');
                                setRescheduleLocation(event.location || '');
                              }}
                              disabled={actionLoading === event.id}
                              className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                              title="Reschedule"
                            >
                              <CalendarIcon size={16} />
                            </button>

                            {/* Cancel */}
                            <button
                              onClick={() => handleDeleteMeeting(event)}
                              disabled={actionLoading === event.id}
                              className="p-2 text-red-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all"
                              title="Cancel"
                            >
                              {actionLoading === event.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => { setShowMeetingsModal(false); setShowScheduleForm(false); }}
                className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
              >
                Close
              </button>
              {!showScheduleForm && (
                <button
                  onClick={() => setShowScheduleForm(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-600 transition-all"
                >
                  <Plus size={14} />
                  New Meeting
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleEvent && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-blue-500 p-8 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">Reschedule Meeting</h3>
                <p className="text-blue-100 text-xs font-bold mt-1 truncate">{rescheduleEvent.title}</p>
              </div>
              <button onClick={() => {
                setRescheduleEvent(null);
                setRescheduleRecurrence('none');
                setRescheduleRecurrenceCount('');
                setRescheduleLocation('');
              }}><X size={20} /></button>
            </div>
            <div className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Current Date & Time</label>
                <p className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-500">
                  {new Date(rescheduleEvent.start_time).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">New Date & Time</label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input
                    type="datetime-local"
                    required
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500"
                    value={rescheduleTime}
                    onChange={e => setRescheduleTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Recurrence</label>
                <select
                  value={rescheduleRecurrence}
                  onChange={e => setRescheduleRecurrence(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500"
                >
                  <option value="none">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {rescheduleRecurrence !== 'none' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                    How many {rescheduleRecurrence === 'daily' ? 'days' : rescheduleRecurrence === 'weekly' ? 'weeks' : 'months'}?
                  </label>
                  <input
                    type="number"
                    placeholder="Count"
                    value={rescheduleRecurrenceCount}
                    onChange={e => setRescheduleRecurrenceCount(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500"
                    min="1"
                    max="365"
                  />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input
                    placeholder="Location or link (optional)"
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500"
                    value={rescheduleLocation}
                    onChange={e => setRescheduleLocation(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setRescheduleEvent(null);
                    setRescheduleRecurrence('none');
                    setRescheduleRecurrenceCount('');
                    setRescheduleLocation('');
                  }}
                  className="flex-1 py-3 border-2 border-slate-100 rounded-xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRescheduleMeeting}
                  disabled={!rescheduleTime || actionLoading === rescheduleEvent.id}
                  className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading === rescheduleEvent.id ? <Loader2 size={14} className="animate-spin" /> : 'Reschedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Meeting Reason Modal */}
      {showCancelReasonModal && cancellingEvent && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="bg-red-500 p-8 text-white">
              <h3 className="text-2xl font-black tracking-tight">Cancel Meeting</h3>
              <p className="text-red-100 text-sm font-bold mt-1">{cancellingEvent.title}</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-slate-700 font-semibold text-sm">
                Would you like to provide a reason for cancelling this meeting? This will be sent to all group members.
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
                onClick={() => handleCancelMeetingWithReason()}
                className="flex-1 px-6 py-3 bg-slate-500 text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-slate-600 transition-all"
              >
                Skip & Cancel
              </button>
              <button
                onClick={() => handleCancelMeetingWithReason(cancellationReason.trim() || undefined)}
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
  );
};

export default GroupsPage;
