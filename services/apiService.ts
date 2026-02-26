
import { StudyGroup, Message, Feedback, User, AppNotification, PendingJoinRequest, GroupMember, Rating } from '../types';
import { API_CONFIG } from '../constants';

const BASE_URL = API_CONFIG.BASE_URL;

const getHeaders = () => {
  let token = '';
  // Check main site auth first, then admin auth as fallback
  const userStr = localStorage.getItem('auth_user') || localStorage.getItem('admin_auth');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      token = user.token || '';
    } catch (e) {
      console.error("Auth token parse error", e);
    }
  }

  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

const handleResponse = async (res: Response) => {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `API Error: ${res.status}`);
  }
  return res.json();
};

export const apiService = {
  // Authentication
  async login(credentials: any): Promise<{user: User, token: string}> {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(credentials)
    });
    return handleResponse(res);
  },

  async register(data: any): Promise<{user: User, token: string, message?: string}> {
    const res = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ email })
    });
    return handleResponse(res);
  },

  async resetPassword(data: { token: string; email: string; password: string; password_confirmation: string }): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async resendVerification(): Promise<{message: string}> {
    const res = await fetch(`${BASE_URL}/email/resend`, {
      method: 'POST',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async checkVerificationStatus(): Promise<{verified: boolean, email: string}> {
    const res = await fetch(`${BASE_URL}/email/verification-status`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Groups
  async getGroups(): Promise<StudyGroup[]> {
    const res = await fetch(`${BASE_URL}/groups`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async createGroup(data: any): Promise<StudyGroup> {
    const res = await fetch(`${BASE_URL}/groups`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async updateGroup(id: string, data: any): Promise<StudyGroup> {
    const res = await fetch(`${BASE_URL}/groups/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async deleteGroup(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/groups/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    await handleResponse(res);
  },

  async joinGroup(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/groups/${id}/join`, {
      method: 'POST',
      headers: getHeaders()
    });
    await handleResponse(res);
  },

  async leaveGroup(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/groups/${id}/leave`, {
      method: 'POST',
      headers: getHeaders()
    });
    await handleResponse(res);
  },

  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const res = await fetch(`${BASE_URL}/groups/${groupId}/members`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async getPendingRequests(groupId: string): Promise<PendingJoinRequest[]> {
    const res = await fetch(`${BASE_URL}/groups/${groupId}/pending-requests`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async approveJoinRequest(groupId: string, userId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/groups/${groupId}/approve/${userId}`, {
      method: 'POST',
      headers: getHeaders()
    });
    await handleResponse(res);
  },

  async rejectJoinRequest(groupId: string, userId: string, reason?: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/groups/${groupId}/reject/${userId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason: reason || null })
    });
    await handleResponse(res);
  },

  async kickMember(groupId: string, userId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/groups/${groupId}/kick/${userId}`, {
      method: 'POST',
      headers: getHeaders()
    });
    await handleResponse(res);
  },

  // Group invitations
  async inviteUserToGroup(groupId: string, userId: string): Promise<{message: string; invited_user: any; auto_approved?: boolean}> {
    const res = await fetch(`${BASE_URL}/groups/${groupId}/invite`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ user_id: userId })
    });
    return handleResponse(res);
  },

  async acceptInvitation(groupId: string): Promise<{message: string; group: any}> {
    const res = await fetch(`${BASE_URL}/groups/${groupId}/invitation/accept`, {
      method: 'POST',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async declineInvitation(groupId: string): Promise<{message: string}> {
    const res = await fetch(`${BASE_URL}/groups/${groupId}/invitation/decline`, {
      method: 'POST',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async getPendingInvitations(groupId: string): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/groups/${groupId}/invitations`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Ratings
  async submitRating(groupId: string, data: { group_rating: number; leader_rating: number }): Promise<{success: boolean; rating: Rating; edits_remaining: number; message: string}> {
    const res = await fetch(`${BASE_URL}/groups/${groupId}/rate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async getMyRating(groupId: string): Promise<Rating | null> {
    const res = await fetch(`${BASE_URL}/groups/${groupId}/my-rating`, {
      headers: getHeaders()
    });
    const data = await handleResponse(res);
    return data.rating;
  },

  async deleteRating(groupId: string): Promise<{success: boolean; message: string}> {
    const res = await fetch(`${BASE_URL}/groups/${groupId}/rate`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Messages
  async getMessages(groupId: string): Promise<Message[]> {
    const res = await fetch(`${BASE_URL}/groups/${groupId}/messages`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async sendMessage(groupId: string, content: string, file?: File): Promise<Message> {
    const formData = new FormData();
    if (content) formData.append('content', content);
    if (file) formData.append('file', file);

    const userStr = localStorage.getItem('auth_user') || localStorage.getItem('admin_auth');
    let token = '';
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        token = user.token || '';
      } catch (e) {
        console.error("Auth token parse error", e);
      }
    }

    const res = await fetch(`${BASE_URL}/groups/${groupId}/messages`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    return handleResponse(res);
  },

  // Discover
  async getTrendingGroups(): Promise<StudyGroup[]> {
    const res = await fetch(`${BASE_URL}/discover/trending`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async getSubjects(): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/discover/subjects`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async getLeaders(): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/discover/leaders`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async searchUsers(query: string): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/discover/users/search?q=${encodeURIComponent(query)}`, { headers: getHeaders() });
    return handleResponse(res);
  },

  // Reports (uses feedback endpoints for backend compatibility)
  // Note: These endpoints are now used for user reporting system
  async getFeedback(): Promise<Feedback[]> {
    const res = await fetch(`${BASE_URL}/feedback`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async submitFeedback(data: any): Promise<Feedback> {
    const res = await fetch(`${BASE_URL}/feedback`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async submitReport(data: {
    reported_user_id: number;
    reported_group_id?: number;
    reported_message_id?: number;
    reason: string;
    description: string;
    evidence_url?: string;
    priority?: string;
  }): Promise<any> {
    const res = await fetch(`${BASE_URL}/reports`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async getMyReports(): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/reports/my-reports`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Calendar
  async getEvents(): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/calendar/events`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async createEvent(data: any): Promise<any> {
    const res = await fetch(`${BASE_URL}/calendar/events`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async deleteEvent(id: string, reason?: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/calendar/events/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
      body: JSON.stringify({ reason: reason || null })
    });
    await handleResponse(res);
  },

  // Profile
  async getProfile(): Promise<User> {
    const res = await fetch(`${BASE_URL}/profile`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async getUserById(userId: number): Promise<User> {
    const res = await fetch(`${BASE_URL}/users/${userId}`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async getUserStats(userId: number): Promise<any> {
    const res = await fetch(`${BASE_URL}/users/${userId}/stats`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async getProfileStats(): Promise<any> {
    const res = await fetch(`${BASE_URL}/profile/stats`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async getProfileDetails(): Promise<any> {
    const res = await fetch(`${BASE_URL}/profile/details`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async getUserDetails(userId: number): Promise<any> {
    const res = await fetch(`${BASE_URL}/users/${userId}/details`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async updatePrivacy(data: { privacy_stats: boolean; privacy_activity: boolean }): Promise<any> {
    const res = await fetch(`${BASE_URL}/profile/privacy`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async updateProfile(data: any): Promise<User> {
    const res = await fetch(`${BASE_URL}/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async deleteAccount(data: { password: string }): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/profile`, {
      method: 'DELETE',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async changePassword(data: { current_password: string; new_password: string; new_password_confirmation: string }): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/profile/change-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  // Notifications
  async getNotifications(): Promise<AppNotification[]> {
    const res = await fetch(`${BASE_URL}/notifications`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async getUnreadCount(): Promise<{ count: number }> {
    const res = await fetch(`${BASE_URL}/notifications/unread-count`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async markNotificationsAsRead(): Promise<void> {
    const res = await fetch(`${BASE_URL}/notifications/mark-read`, {
      method: 'POST',
      headers: getHeaders()
    });
    await handleResponse(res);
  }
};
