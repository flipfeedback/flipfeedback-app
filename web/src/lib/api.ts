import type {
  Analytics,
  AuthResponse,
  Feedback,
  FeedbackList,
  FeedbackStatus,
  Label,
  Session,
  Source,
  TeamMember,
} from './types';

// The SPA talks ONLY to the API. Base URL is injected at build time; in dev it
// defaults to the Vite proxy at /api.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

const TOKEN_KEY = 'flipfeedback.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export interface FeedbackQuery {
  status?: FeedbackStatus;
  sourceId?: string;
  sentiment?: string;
  assignedToId?: string;
  q?: string;
  take?: number;
  skip?: number;
}

export const api = {
  // Auth
  register: (data: { name: string; email: string; password: string; organizationName: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request<Session>('/auth/me'),
  requestPasswordReset: (email: string) =>
    request<{ message: string }>('/auth/password-reset', { method: 'POST', body: JSON.stringify({ email }) }),

  // Feedback / inbox / triage
  listFeedback: (query: FeedbackQuery = {}) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.set(k, String(v));
    });
    const qs = params.toString();
    return request<FeedbackList>(`/feedback${qs ? `?${qs}` : ''}`);
  },
  getFeedback: (id: string) => request<Feedback>(`/feedback/${id}`),
  createFeedback: (data: { message: string; author?: string; sourceId: string }) =>
    request<Feedback>('/feedback', { method: 'POST', body: JSON.stringify(data) }),
  updateFeedback: (id: string, data: { status?: FeedbackStatus; assignedToId?: string | null }) =>
    request<Feedback>(`/feedback/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addLabel: (id: string, labelId: string) =>
    request<Feedback>(`/feedback/${id}/labels`, { method: 'POST', body: JSON.stringify({ labelId }) }),
  removeLabel: (id: string, labelId: string) =>
    request<Feedback>(`/feedback/${id}/labels/${labelId}`, { method: 'DELETE' }),

  // Sources
  listSources: () => request<Source[]>('/sources'),
  createSource: (data: { name: string; type: string; campaign?: string }) =>
    request<Source>('/sources', { method: 'POST', body: JSON.stringify(data) }),
  updateSource: (id: string, data: { name?: string; connected?: boolean; campaign?: string | null }) =>
    request<Source>(`/sources/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Labels
  listLabels: () => request<Label[]>('/labels'),
  createLabel: (data: { name: string; color?: string }) =>
    request<Label>('/labels', { method: 'POST', body: JSON.stringify(data) }),
  deleteLabel: (id: string) => request<void>(`/labels/${id}`, { method: 'DELETE' }),

  // Team
  listTeam: () => request<TeamMember[]>('/team'),
  addTeamMember: (data: { name: string; email: string; password: string; role?: 'ADMIN' | 'MEMBER' }) =>
    request<TeamMember>('/team', { method: 'POST', body: JSON.stringify(data) }),

  // Analytics
  analytics: (days = 30) => request<Analytics>(`/analytics?days=${days}`),
};
