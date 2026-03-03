
export enum GroupStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  ARCHIVED = 'archived'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  major?: string;
  bio?: string;
  avatar?: string;
  token?: string;
  location?: string;
  warnings?: number;
  banned?: boolean;
  privacy_stats?: boolean;
  privacy_activity?: boolean;
}

export interface StudyGroup {
  id: string;
  name: string;
  subject: string;
  faculty: string;
  description: string;
  max_members: number;
  members_count: number;
  location: string;
  creator_id: string;
  creator_name: string;
  status: GroupStatus;
  created_at: string;
  is_member?: boolean;
  has_pending_request?: boolean;
  pending_requests_count?: number;
  avg_group_rating?: number;
  avg_leader_rating?: number;
  total_ratings?: number;
}

export interface Rating {
  id: string;
  user_id: string;
  group_id: string;
  group_rating: number;
  leader_rating: number;
  update_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  group_id: string;
  user_id: string;
  user_name: string;
  content: string;
  type?: string;
  file_path?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  created_at: string;
}

export interface Report {
  id: string;
  reported_user_id: string;
  reported_user_name: string;
  reported_user_email?: string;
  reason: string;
  severity: number; // 1-5, 5 being most severe
  description: string;
  reporter_name: string;
  created_at: string;
  text?: string;
  group_name?: string;
  rating?: number;
}

// Backend feedback format (used for reports)
export interface Feedback {
  id: string;
  group_name: string;
  rating: number;
  text?: string; // Frontend submission field
  comment?: string; // Backend storage field (what we receive)
  user_name: string;
  created_at: string;
}

export interface Event {
  id: string;
  user_id: string;
  group_id?: string;
  title: string;
  type: string;
  start_time: string;
  location?: string;
}

export interface AppNotification {
  id: number;
  user_id: number;
  type: 'message' | 'group_join' | 'event' | 'join_request' | 'join_approved' | 'join_rejected' | 'removed_from_group' | 'user_warned' | 'user_banned' | 'report_submitted' | 'user_suspended' | 'role_changed' | 'group_approved' | 'group_rejected' | 'ownership_transferred' | 'ownership_received' | 'group_leadership_changed' | 'password_reset' | 'report_resolved' | 'new_report' | 'warning_received' | 'group_archived_admin' | 'suspension_lifted' | 'ban_lifted' | 'new_group_pending';
  data: {
    user_id?: number;
    user_name?: string;
    group_id?: string;
    group_name?: string;
    message: string;
    reason?: string;
    creator_name?: string;
  };
  read_at: string | null;
  created_at: string;
}

export interface PendingJoinRequest {
  id: string;
  name: string;
  email: string;
  major?: string;
  requested_at: string;
}

export interface GroupMember {
  id: number;
  name: string;
  email: string;
  major?: string;
  role: string;
  avatar: string | null;
  is_leader: boolean;
  joined_at: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
}