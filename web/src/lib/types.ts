export type SourceType = 'CAMPAIGN' | 'CHANNEL' | 'CUSTOMER';
export type FeedbackStatus = 'NEW' | 'IN_REVIEW' | 'RESOLVED';
export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
export type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface Session {
  user: User;
  organization: Organization;
}

export interface AuthResponse extends Session {
  token: string;
}

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  campaign: string | null;
  connected: boolean;
  feedbackCount?: number;
  createdAt: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface Feedback {
  id: string;
  message: string;
  author: string | null;
  status: FeedbackStatus;
  sentiment: Sentiment;
  createdAt: string;
  updatedAt: string;
  source: { id: string; name: string; type: SourceType; campaign: string | null } | null;
  assignedTo: { id: string; name: string } | null;
  labels: Label[];
}

export interface FeedbackList {
  items: Feedback[];
  total: number;
}

export interface Analytics {
  windowDays: number;
  total: number;
  volumeOverTime: { date: string; count: number }[];
  bySource: { sourceId: string; name: string; type: string; count: number }[];
  byCampaign: { campaign: string; count: number }[];
  sentiment: Record<Sentiment, number>;
  byStatus: Record<FeedbackStatus, number>;
  trend: { firstHalf: number; secondHalf: number; changePct: number | null; direction: 'up' | 'down' | 'flat' };
}
