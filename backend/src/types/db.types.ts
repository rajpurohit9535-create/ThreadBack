export type MissionStatus = 'active' | 'completed' | 'archived';
export type ConversationType = 'main' | 'sidequest';
export type MessageRole = 'user' | 'assistant';
export type TeamRole = 'owner' | 'admin' | 'member';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type DecisionCategory = 'decision' | 'learning' | 'blocker' | 'next_step';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  role?: TeamRole;
  memberCount?: number;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  userName: string;
  userEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  teamName?: string;
  email: string | null;
  token: string;
  role: 'admin' | 'member';
  invitedBy: string;
  inviterName?: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
}

export interface SharedDecision {
  id: string;
  missionId: string;
  decision: string;
  category: DecisionCategory;
  contributedBy: string;
  contributorName: string;
  sourceConversationId?: string | null;
  createdAt: string;
}

export type ProjectStatus = 'active' | 'archived';

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  userId?: string | null;
  userName?: string | null;
  githubRepo?: string | null;
  status: ProjectStatus;
  missionCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Mission {
  id: string;
  objective: string;
  status: MissionStatus;
  projectId?: string | null;
  teamId?: string | null;
  userId?: string | null;
  visibility?: 'personal' | 'team';
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  missionId: string;
  type: ConversationType;
  topic: string | null;
  userId?: string | null;
  isShared?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  userId?: string | null;
  userName?: string | null;
  createdAt: string;
}

export interface MissionMemory {
  id: string;
  missionId: string;
  summary: string;
  progress: string;
  decisions: string[];
  blockers: string[];
  nextStep: string;
  updatedAt: string;
}

export interface SideQuestLearningSummary {
  topic: string;
  keyLearnings: string[];
  decisions: string[];
  usefulExamples: string[];
  unresolvedQuestions: string[];
  missionRelevance: string;
}

export interface SideQuestMemory {
  id: string;
  conversationId: string;
  learningSummary: string;
  unresolvedQuestions: string[];
  isIncorporated?: boolean;
  updatedAt: string;
}

export interface CreateMissionResult {
  mission: Mission;
  mainConversation: Conversation;
}

export interface MissionWithConversations {
  mission: Mission;
  conversations: Conversation[];
  decisions?: SharedDecision[];
}

// === Phase 2 GitHub & Feedback Types ===

export type GitHubAccountType = 'user' | 'app_installation';
export type GitHubConnectionStatus = 'active' | 'revoked' | 'disconnected';

export interface GitHubConnection {
  id: string;
  userId: string;
  accountId: string;
  accountLogin: string;
  accountType: GitHubAccountType;
  encryptedAccessToken: string;
  tokenIv: string;
  tokenTag: string;
  scope: string | null;
  tokenType: string;
  status: GitHubConnectionStatus;
  connectedAt: string;
  updatedAt: string;
}

export interface SanitizedGitHubConnection {
  id: string;
  accountId: string;
  accountLogin: string;
  accountType: GitHubAccountType;
  scope: string | null;
  status: GitHubConnectionStatus;
  connectedAt: string;
  updatedAt: string;
}

export interface GitHubRepo {
  id: string | number;
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  isPrivate: boolean;
  defaultBranch: string;
}

export interface ProjectFeedback {
  id: string;
  projectId?: string | null;
  userId?: string | null;
  userName?: string | null;
  targetType: 'repo_analysis' | 'mission' | 'sidequest';
  targetId?: string | null;
  rating?: number | null;
  comment: string;
  createdAt: string;
}

