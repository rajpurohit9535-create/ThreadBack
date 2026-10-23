export interface UserDto {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface TeamDto {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  role?: 'owner' | 'admin' | 'member';
  memberCount?: number;
}

export interface TeamMemberDto {
  id: string;
  teamId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  userName: string;
  userEmail: string;
  createdAt: string;
}

export interface TeamInvitationDto {
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

export interface SharedDecisionDto {
  id: string;
  missionId: string;
  decision: string;
  category: 'decision' | 'learning' | 'blocker' | 'next_step';
  contributedBy: string;
  contributorName: string;
  sourceConversationId?: string | null;
  createdAt: string;
}

export interface MissionDto {
  id: string;
  objective: string;
  status: 'active' | 'completed' | 'archived';
  projectId?: string | null;
  teamId?: string | null;
  userId?: string | null;
  visibility?: 'personal' | 'team';
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDto {
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

export interface GitHubStatusDto {
  configured: boolean;
  clientId: string | null;
  status: 'ready' | 'unconfigured';
  message: string;
  repositories: Array<{ id: number; name: string; full_name: string; default_branch: string }>;
}

export interface ConversationDto {
  id: string;
  missionId: string;
  type: 'main' | 'sidequest';
  topic: string | null;
  userId?: string | null;
  isShared?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  userId?: string | null;
  userName?: string | null;
  createdAt: string;
}

export interface SideQuestLearningSummaryDto {
  topic: string;
  keyLearnings: string[];
  decisions: string[];
  usefulExamples: string[];
  unresolvedQuestions: string[];
  missionRelevance: string;
}

export interface ReturnToMissionResponseDto {
  summary: SideQuestLearningSummaryDto;
  missionId: string;
  mainConversationId: string;
  sideQuestConversationId: string;
}

export interface AiChatResponseDto {
  reply: string;
  conversationId: string;
  missionId?: string;
  sideQuestTopic?: string;
}

export interface AiStatusDto {
  configured: boolean;
  model: string;
}

export interface HealthDto {
  status: string;
  timestamp: string;
}

// === Phase 2 GitHub & Analysis DTOs ===

export interface GitHubConnectionDto {
  id: string;
  accountId: string;
  accountLogin: string;
  accountType: 'user' | 'app_installation';
  scope: string | null;
  status: 'active' | 'revoked' | 'disconnected';
  connectedAt: string;
  updatedAt: string;
}

export interface GitHubRepoDto {
  id: string | number;
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  isPrivate: boolean;
  defaultBranch: string;
}

export interface RepoAnalysisReportDto {
  repository: {
    name: string;
    fullName: string;
    url: string;
    description: string;
    stars: number;
    defaultBranch: string;
    language: string;
    topics: string[];
  };
  latestCommit: {
    sha: string;
    author: string;
    message: string;
  };
  fileSummary: {
    topLevelCount: number;
    items: string[];
    languages: Record<string, number>;
  };
  architecturalOverview: string;
  keyCategoriesOrModules: string[];
  codeQualityAndPractices: {
    hasDocumentation: boolean;
    hasContributionGuide: boolean;
    hasIssueTemplate: boolean;
    observations: string[];
  };
  threadBackEngineeringInsights: {
    suitabilityForMissions: string;
    recommendedSideQuests: string[];
    driftRisks: string[];
  };
  rateLimitStatus?: 'live' | 'rate_limited_cached';
  analyzedAt: string;
}

export interface ProjectFeedbackDto {
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


const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  'http://localhost:4000/api';

const TOKEN_KEY = 'threadback_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors in private mode
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;
  const token = getStoredToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorMsg = `API request failed with status ${res.status}`;
      let errorData: unknown;
      try {
        const body = await res.json();
        errorData = body;
        if (body?.error) {
          errorMsg = typeof body.error === 'string' ? body.error : body.error.message || errorMsg;
        } else if (body?.message) {
          errorMsg = body.message;
        }
      } catch {
        // Response was not JSON
      }
      throw new ApiError(res.status, errorMsg, errorData);
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    const msg = err instanceof Error ? err.message : 'Network request failed';
    throw new ApiError(0, `Cannot connect to backend (${url}): ${msg}`);
  }
}

export const apiClient = {
  // Health & AI status
  getHealth: () => request<HealthDto>('health'),
  getAiStatus: () => request<AiStatusDto>('ai/status'),

  // Auth
  register: (email: string, name: string, password: string) =>
    request<{ user: UserDto; token: string }>('auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, name, password }),
    }),

  login: (email: string, password: string) =>
    request<{ user: UserDto; token: string }>('auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => request<{ user: UserDto; teams: TeamDto[] }>('auth/me'),

  listDevUsers: () => request<{ users: UserDto[] }>('auth/dev-users'),

  devSwitch: (userId: string) =>
    request<{ user: UserDto; token: string }>('auth/dev-switch', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  // Teams
  createTeam: (name: string) =>
    request<{ team: TeamDto; membership: TeamMemberDto }>('teams', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  listTeams: () => request<{ teams: TeamDto[] }>('teams'),

  getTeam: (teamId: string) =>
    request<{ team: TeamDto; members: TeamMemberDto[]; pendingInvites: TeamInvitationDto[] }>(`teams/${teamId}`),

  createInvitation: (teamId: string, role: 'admin' | 'member' = 'member', email?: string) =>
    request<{ invitation: TeamInvitationDto; inviteToken: string }>(`teams/${teamId}/invites`, {
      method: 'POST',
      body: JSON.stringify({ role, email: email || undefined }),
    }),

  listInvitations: (teamId: string) =>
    request<{ invitations: TeamInvitationDto[] }>(`teams/${teamId}/invites`),

  revokeInvitation: (teamId: string, inviteId: string) =>
    request<{ success: boolean; message: string }>(`teams/${teamId}/invites/${inviteId}`, {
      method: 'DELETE',
    }),

  getPublicInvitation: (token: string) =>
    request<{ invitation: TeamInvitationDto }>(`invites/${token}`),

  acceptInvitation: (token: string) =>
    request<{ message: string; team: TeamDto; membership: TeamMemberDto }>(`invites/${token}/accept`, {
      method: 'POST',
    }),

  leaveTeam: (teamId: string) =>
    request<{ success: boolean; message: string }>(`teams/${teamId}/leave`, {
      method: 'POST',
    }),

  removeMember: (teamId: string, userId: string) =>
    request<{ success: boolean; message: string }>(`teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
    }),

  // Projects
  listProjects: (teamId?: string | null) =>
    request<{ projects: ProjectDto[] }>(teamId ? `projects?teamId=${encodeURIComponent(teamId)}` : 'projects'),

  getProject: (id: string) =>
    request<{ project: ProjectDto }>(`projects/${id}`),

  createProject: (data: {
    name: string;
    description?: string;
    teamId?: string | null;
    githubRepo?: string | null;
    invitations?: Array<{ email: string; role: 'admin' | 'member' }>;
  }) =>
    request<{ project: ProjectDto; invitations: Array<{ email: string; token: string; role: string }>; message: string }>(
      'projects',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  updateProject: (id: string, data: { name?: string; description?: string; status?: 'active' | 'archived'; githubRepo?: string }) =>
    request<{ project: ProjectDto }>(`projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteProject: (id: string) =>
    request<{ success: boolean; message: string }>(`projects/${id}`, {
      method: 'DELETE',
    }),

  getProjectGitHubConfigStatus: () =>
    request<GitHubStatusDto>('projects/github/status'),

  // Missions
  listMissions: (params?: { teamId?: string | null; projectId?: string | null } | string | null) => {
    let query = '';
    if (typeof params === 'string') {
      query = `?teamId=${encodeURIComponent(params)}`;
    } else if (params) {
      const parts: string[] = [];
      if (params.projectId) parts.push(`projectId=${encodeURIComponent(params.projectId)}`);
      if (params.teamId) parts.push(`teamId=${encodeURIComponent(params.teamId)}`);
      if (parts.length > 0) query = `?${parts.join('&')}`;
    }
    return request<{ missions: MissionDto[] }>(`missions${query}`);
  },

  getMission: (id: string) =>
    request<{ mission: MissionDto; conversations: ConversationDto[]; decisions?: SharedDecisionDto[] }>(`missions/${id}`),

  createMission: (
    objective: string,
    teamId?: string | null,
    visibility?: 'personal' | 'team',
    projectId?: string | null
  ) =>
    request<{ mission: MissionDto; mainConversation: ConversationDto }>('missions', {
      method: 'POST',
      body: JSON.stringify({ objective, teamId: teamId || undefined, visibility, projectId: projectId || undefined }),
    }),

  claimMission: (id: string) =>
    request<{ success: boolean; message: string }>(`missions/${id}/claim`, {
      method: 'POST',
    }),

  shareMissionWithTeam: (id: string, teamId: string) =>
    request<{ success: boolean; message: string }>(`missions/${id}/share-with-team`, {
      method: 'POST',
      body: JSON.stringify({ teamId }),
    }),

  createSideQuest: (missionId: string, topic: string, isShared: boolean = true) =>
    request<{ sideQuest: ConversationDto }>(`missions/${missionId}/sidequests`, {
      method: 'POST',
      body: JSON.stringify({ topic, isShared }),
    }),

  getConversationMessages: (conversationId: string) =>
    request<{
      conversationId: string;
      type: 'main' | 'sidequest';
      topic: string | null;
      isShared?: boolean;
      userId?: string | null;
      messages: MessageDto[];
    }>(`conversations/${conversationId}/messages`),

  toggleShareConversation: (conversationId: string, isShared: boolean) =>
    request<{ success: boolean; conversationId: string; isShared: boolean }>(`conversations/${conversationId}/share`, {
      method: 'POST',
      body: JSON.stringify({ isShared }),
    }),

  // Shared Decisions
  listDecisions: (missionId: string) =>
    request<{ decisions: SharedDecisionDto[] }>(`missions/${missionId}/decisions`),

  addDecision: (missionId: string, decision: string, category: 'decision' | 'learning' | 'blocker' | 'next_step' = 'decision') =>
    request<{ decision: SharedDecisionDto }>(`missions/${missionId}/decisions`, {
      method: 'POST',
      body: JSON.stringify({ decision, category }),
    }),

  deleteDecision: (missionId: string, decisionId: string) =>
    request<{ success: boolean; message: string }>(`missions/${missionId}/decisions/${decisionId}`, {
      method: 'DELETE',
    }),

  // AI Chat
  sendMainAiChat: (payload: {
    conversationId: string;
    message: string;
    missionId?: string;
  }) =>
    request<AiChatResponseDto>('ai/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  sendSideQuestChat: (payload: {
    conversationId: string;
    message: string;
    missionId?: string;
    sideQuestTopic?: string;
  }) =>
    request<AiChatResponseDto>('ai/sidequest/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  returnToMission: (sideQuestConversationId: string) =>
    request<ReturnToMissionResponseDto>(
      `conversations/${sideQuestConversationId}/return-to-mission`,
      {
        method: 'POST',
      }
    ),

  // === Phase 2 GitHub & Analysis API ===
  getGitHubStatus: () =>
    request<{ connected: boolean; connection: GitHubConnectionDto | null }>('github/status'),

  connectGitHub: (payload: {
    accessToken: string;
    accountId: string;
    accountLogin: string;
    accountType?: 'user' | 'app_installation';
    scope?: string;
  }) =>
    request<{ connection: GitHubConnectionDto }>('github/connect', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getGitHubRepos: () =>
    request<{ repositories: GitHubRepoDto[] }>('github/repos'),

  disconnectGitHub: () =>
    request<{ success: boolean; message: string }>('github/disconnect', {
      method: 'POST',
    }),

  simulateGitHubRevocation: () =>
    request<{ success: boolean; message: string }>('github/simulate-revocation', {
      method: 'POST',
    }),

  analyzeRepo: (repoOrParams: string | { repo?: string; projectId?: string }) => {
    const payload = typeof repoOrParams === 'string' ? { repo: repoOrParams } : repoOrParams;
    return request<{ report: RepoAnalysisReportDto }>('github/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  evaluateDrift: (repoOrParams: string | { repo?: string; projectId?: string }, context?: unknown) => {
    const payload = typeof repoOrParams === 'string' ? { repo: repoOrParams, context } : { ...repoOrParams, context };
    return request<{ driftReport: any }>('github/drift-analysis', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  submitFeedback: (payload: {
    projectId?: string | null;
    targetType: 'repo_analysis' | 'mission' | 'sidequest';
    targetId?: string | null;
    rating?: number | null;
    comment: string;
  }) =>
    request<{ feedback: ProjectFeedbackDto }>('github/feedback', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listFeedback: (params: { projectId?: string; targetType?: string; targetId?: string }) => {
    const query = new URLSearchParams();
    if (params.projectId) query.set('projectId', params.projectId);
    if (params.targetType) query.set('targetType', params.targetType);
    if (params.targetId) query.set('targetId', params.targetId);
    return request<{ feedback: ProjectFeedbackDto[] }>(`github/feedback?${query.toString()}`);
  },
};

