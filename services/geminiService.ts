import { API_CONFIG } from '../constants';

const BASE_URL = API_CONFIG.BASE_URL;

const getHeaders = () => {
  let token = '';
  const userStr = localStorage.getItem('auth_user') || localStorage.getItem('admin_auth');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      token = user.token || '';
    } catch (e) {
      console.error('Auth token parse error', e);
    }
  }

  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
};

const postAI = async (path: string, body: Record<string, unknown>) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `AI API Error: ${res.status}`);
  }

  const data = await res.json();
  return data.text || 'No response generated.';
};

export const geminiService = {
  async generateGroupDescription(subject: string, goal: string) {
    try {
      return await postAI('/ai/group-description', { subject, goal });
    } catch {
      return 'Unable to generate description. Please try writing one manually.';
    }
  },

  async summarizeChat(messages: string[]) {
    if (messages.length === 0) {
      return 'No messages to summarize.';
    }

    try {
      return await postAI('/ai/summarize-chat', { messages });
    } catch (error: any) {
      return `Summary unavailable: ${error.message || 'Unknown error'}`;
    }
  },

  async suggestStudyPlan(subject: string) {
    try {
      return await postAI('/ai/study-plan', { subject });
    } catch {
      return 'Study plan generation failed.';
    }
  },
};
