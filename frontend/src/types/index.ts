export type QNode = {
  id: string;
  parentId: string | null;
  query: string;
  contextSnippet?: string; // text selected in the parent's answer that spawned this node
  answer: string;          // markdown response
  status: 'idle' | 'loading' | 'done' | 'error';
  position: { x: number; y: number };
  createdAt?: string;
  learningNotes?: string[];
  conversationType?: 'main' | 'sidequest';
  topic?: string;
  isShared?: boolean;
  authorName?: string;
  messages?: ChatMessage[];
};

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  useful?: boolean;
  userId?: string | null;
  authorName?: string | null;
}

export interface QueryBranch {
  id: string;
  missionId: string;
  parentBranchId: string | null;
  title: string;
  question: string;
  messages: ChatMessage[];
  learningNotes: string[];
  expanded: boolean;
  createdAt: string;
  tags?: string[];
  position?: { x: number; y: number };
}

export interface SideQuestLearningSummary {
  topic: string;
  keyLearnings: string[];
  decisions: string[];
  usefulExamples: string[];
  unresolvedQuestions: string[];
  missionRelevance: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  role?: 'owner' | 'admin' | 'member';
  memberCount?: number;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  userName: string;
  userEmail: string;
  createdAt: string;
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
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface SharedDecision {
  id: string;
  missionId: string;
  decision: string;
  category: 'decision' | 'learning' | 'blocker' | 'next_step';
  contributedBy: string;
  contributorName: string;
  sourceConversationId?: string | null;
  createdAt: string;
}

export interface Mission {
  id: string;
  title: string;
  objective: string;
  constraints: string[];
  completedSteps: string[];
  decisions: string[];
  currentBlocker: string;
  nextAction: string;
  teamId?: string | null;
  userId?: string | null;
  visibility?: 'personal' | 'team';
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'in_progress' | 'completed' | 'archived';
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  userId?: string | null;
  userName?: string | null;
  githubRepo?: string | null;
  status: 'active' | 'archived';
  missionCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubStatus {
  configured: boolean;
  clientId: string | null;
  status: 'ready' | 'unconfigured';
  message: string;
  repositories: Array<{ id: number; name: string; full_name: string; default_branch: string }>;
}

export type ActiveTab = 'landing' | 'workspace';

