import { create } from 'zustand';
import {
  QNode,
  Mission,
  ChatMessage,
  User,
  Team,
  TeamMember,
  TeamInvitation,
  SharedDecision,
  Project,
} from '../types';
import {
  apiClient,
  ConversationDto,
  MessageDto,
  SideQuestLearningSummaryDto,
  setStoredToken,
  getStoredToken,
} from '../api/client';

interface CanvasState {
  // Auth
  currentUser: User | null;
  authToken: string | null;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register';

  // Projects & GitHub Hub (Phase 2)
  projects: Project[];
  currentProject: Project | null;
  activeProject?: Project | null;
  isProjectSetupOpen: boolean;
  isProjectsModalOpen: boolean;
  isNodesDrawerOpen: boolean;
  openProjectSetup: () => void;
  closeProjectSetup: () => void;
  openProjectsModal: () => void;
  closeProjectsModal: () => void;
  toggleNodesDrawer: () => void;
  loadProjects: () => Promise<void>;

  refreshProjects: () => Promise<void>;
  selectProject: (projectId: string | null) => Promise<void>;
  setActiveProject: (project: Project | null) => void;

  // Teams & Workspaces
  currentTeam: Team | null; // null = Personal Workspace
  userTeams: Team[];
  teamMembers: TeamMember[];
  teamInvitations: TeamInvitation[];
  sharedDecisions: SharedDecision[];
  isTeamModalOpen: boolean;
  teamModalTab: 'members' | 'invite' | 'create';
  isDecisionsModalOpen: boolean;

  // Mission & Canvas
  mission: Mission | null;
  mainConversation: ConversationDto | null;
  nodes: QNode[];
  selectedNodeId: string | null;
  contextSnippet: string | null;
  isChatDrawerOpen: boolean;
  isRecoveryOpen: boolean;
  isRecoveryLoading: boolean;
  recoveryNodeId: string | null;
  currentSummary: SideQuestLearningSummaryDto | null;
  activeSidebarItem: 'canvas' | 'history' | 'teams' | 'decisions' | 'guide';
  isSidebarOpen: boolean;
  isMissionModalOpen: boolean;
  historyMissions: { id: string; title: string; createdAt: string; nodeCount: number; visibility?: string }[];
  messagesByConversation: Record<string, ChatMessage[]>;
  isLoadingWorkspace: boolean;
  isAiGenerating: boolean;
  error: string | null;
  lastUnsentInput: string;

  // Actions - Auth
  checkAuthSession: () => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, name: string, pass: string) => Promise<void>;
  switchMockUser: (userId: string) => Promise<void>;
  logout: () => void;
  openAuthModal: (mode?: 'login' | 'register') => void;
  closeAuthModal: () => void;

  // Actions - Teams
  openTeamModal: (tab?: 'members' | 'invite' | 'create') => void;
  closeTeamModal: () => void;
  openDecisionsModal: () => void;
  closeDecisionsModal: () => void;
  switchTeam: (teamId: string | null) => Promise<void>;
  createTeam: (name: string) => Promise<void>;
  inviteMember: (role: 'admin' | 'member', email?: string) => Promise<string>;
  acceptInvitation: (token: string) => Promise<void>;
  leaveTeam: () => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  loadTeamMembers: (teamId: string) => Promise<void>;

  // Actions - Decisions & Context
  addSharedDecision: (decision: string, category?: 'decision' | 'learning' | 'blocker' | 'next_step') => Promise<void>;
  deleteSharedDecision: (decisionId: string) => Promise<void>;
  claimLegacyMission: (missionId: string) => Promise<void>;
  shareMissionWithTeam: (missionId: string, teamId: string) => Promise<void>;
  toggleSideQuestSharing: (sideQuestId: string, isShared: boolean) => Promise<void>;

  // Actions - Workspace & Canvas
  initializeWorkspace: () => Promise<void>;
  loadMission: (missionId: string) => Promise<void>;
  pollMissionUpdates: () => Promise<void>;
  selectNode: (id: string) => void;
  setContextSnippet: (snippet: string | null) => void;
  toggleChatDrawer: (open?: boolean) => void;
  openRecovery: (nodeId?: string) => Promise<void>;
  closeRecovery: () => void;
  openMissionModal: () => void;
  closeMissionModal: () => void;
  setActiveSidebarItem: (item: 'canvas' | 'history' | 'teams' | 'decisions' | 'guide') => void;
  toggleSidebar: () => void;
  updateMission: (mission: Partial<Mission>) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  deleteNode: (id: string) => void;
  clearError: () => void;

  // Mission creation
  startNewChat: (title?: string, objective?: string) => Promise<void>;
  createMissionFromModal: (objective: string, title?: string, teamId?: string | null) => Promise<void>;

  // Chat & Branch creation
  createBranchNode: (query: string, parentId?: string | null, snippet?: string) => Promise<string>;
  sendMessage: (conversationId: string, messageText: string) => Promise<void>;
  executeReturnToMission: (sideQuestConversationId: string) => Promise<void>;
}

const mapMessageDtoToChatMessage = (m: MessageDto): ChatMessage => ({
  id: m.id,
  role: m.role,
  content: m.content,
  createdAt: m.createdAt,
  userId: m.userId,
  authorName: m.userName || (m.role === 'assistant' ? 'Main AI' : 'User'),
});

let pollingTimer: ReturnType<typeof setInterval> | null = null;

export const useCanvasStore = create<CanvasState>((set, get) => ({
  currentUser: null,
  authToken: getStoredToken(),
  isAuthModalOpen: false,
  authModalMode: 'login',

  currentTeam: null,
  userTeams: [],
  teamMembers: [],
  teamInvitations: [],
  sharedDecisions: [],
  isTeamModalOpen: false,
  teamModalTab: 'members',
  isDecisionsModalOpen: false,

  projects: [],
  currentProject: null,
  activeProject: null,
  isProjectSetupOpen: false,
  isProjectsModalOpen: false,
  isNodesDrawerOpen: false,

  openProjectSetup: () => set({ isProjectSetupOpen: true }),
  closeProjectSetup: () => set({ isProjectSetupOpen: false }),
  openProjectsModal: () => set({ isProjectsModalOpen: true }),
  closeProjectsModal: () => set({ isProjectsModalOpen: false }),
  toggleNodesDrawer: () => set((state) => ({ isNodesDrawerOpen: !state.isNodesDrawerOpen })),

  loadProjects: async () => {
    try {
      const activeTeam = get().currentTeam;
      const { projects } = await apiClient.listProjects(activeTeam?.id || null);
      set({ projects });
      const savedProjectId = localStorage.getItem('threadback_active_project_id');
      if (savedProjectId) {
        const found = projects.find((p) => p.id === savedProjectId);
        if (found) {
          set({ currentProject: found, activeProject: found });
        }
      }
    } catch {
      // Ignored
    }
  },

  refreshProjects: async () => {
    await get().loadProjects();
  },

  setActiveProject: (project: Project | null) => {
    set({ currentProject: project, activeProject: project });
  },

  selectProject: async (projectId: string | null) => {
    if (!projectId) {
      localStorage.removeItem('threadback_active_project_id');
      set({ currentProject: null, activeProject: null });
      return;
    }
    const found = get().projects.find((p) => p.id === projectId);
    if (found) {
      localStorage.setItem('threadback_active_project_id', found.id);
      set({ currentProject: found, activeProject: found, isLoadingWorkspace: true });
      try {
        const { missions } = await apiClient.listMissions({ projectId: found.id });
        const historyList = missions.map((m) => ({
          id: m.id,
          title: m.objective.length > 32 ? m.objective.slice(0, 30) + '...' : m.objective,
          createdAt: new Date(m.createdAt).toLocaleDateString(),
          nodeCount: 1,
          visibility: m.visibility,
        }));
        set({ historyMissions: historyList });
        if (missions.length > 0) {
          await get().loadMission(missions[0].id);
        } else {
          set({
            mission: null,
            nodes: [],
            selectedNodeId: null,
            mainConversation: null,
            isLoadingWorkspace: false,
          });
        }
      } catch (err: unknown) {
        set({ error: err instanceof Error ? err.message : 'Failed to load project missions', isLoadingWorkspace: false });
      }
    }
  },

  mission: null,
  mainConversation: null,
  nodes: [],
  selectedNodeId: null,
  contextSnippet: null,
  isChatDrawerOpen: false,
  isRecoveryOpen: false,
  isRecoveryLoading: false,
  recoveryNodeId: null,
  currentSummary: null,
  activeSidebarItem: 'canvas',
  isSidebarOpen: true,
  isMissionModalOpen: false,
  historyMissions: [],
  messagesByConversation: {},
  isLoadingWorkspace: true,
  isAiGenerating: false,
  error: null,
  lastUnsentInput: '',

  clearError: () => set({ error: null }),

  openAuthModal: (mode = 'login') => set({ isAuthModalOpen: true, authModalMode: mode }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),

  openTeamModal: (tab = 'members') => set({ isTeamModalOpen: true, teamModalTab: tab }),
  closeTeamModal: () => set({ isTeamModalOpen: false }),

  openDecisionsModal: () => set({ isDecisionsModalOpen: true }),
  closeDecisionsModal: () => set({ isDecisionsModalOpen: false }),

  openMissionModal: () => set({ isMissionModalOpen: true }),
  closeMissionModal: () => set({ isMissionModalOpen: false }),

  selectNode: (id: string) => {
    set({ selectedNodeId: id });
  },

  setContextSnippet: (snippet: string | null) => {
    set({ contextSnippet: snippet });
  },

  toggleChatDrawer: (open?: boolean) => {
    set((state) => ({
      isChatDrawerOpen: open !== undefined ? open : !state.isChatDrawerOpen,
    }));
  },

  setActiveSidebarItem: (item) => {
    set({ activeSidebarItem: item });
  },

  toggleSidebar: () => {
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen }));
  },

  updateMission: (updated: Partial<Mission>) => {
    set((state) => ({
      mission: state.mission
        ? { ...state.mission, ...updated, updatedAt: new Date().toISOString() }
        : null,
    }));
  },

  updateNodePosition: (id: string, position: { x: number; y: number }) => {
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, position } : n)),
    }));
  },

  deleteNode: (id: string) => {
    const { nodes, selectedNodeId, mainConversation } = get();
    if (id === 'root' || (mainConversation && id === mainConversation.id)) {
      return;
    }

    const toDelete = new Set<string>([id]);
    let added = true;
    while (added) {
      added = false;
      nodes.forEach((n) => {
        if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
          toDelete.add(n.id);
          added = true;
        }
      });
    }

    const nextNodes = nodes.filter((n) => !toDelete.has(n.id));
    set({
      nodes: nextNodes,
      selectedNodeId: toDelete.has(selectedNodeId || '') ? mainConversation?.id || 'root' : selectedNodeId,
    });
  },

  // Auth actions
  checkAuthSession: async () => {
    const token = getStoredToken();
    if (!token) {
      set({ currentUser: null, authToken: null });
      return;
    }

    try {
      const res = await apiClient.getMe();
      set({
        currentUser: res.user,
        authToken: token,
        userTeams: res.teams,
      });

      // Restore active team preference
      const savedTeamId = localStorage.getItem('threadback_active_team_id');
      if (savedTeamId) {
        const found = res.teams.find((t) => t.id === savedTeamId);
        if (found) {
          set({ currentTeam: found });
          await get().loadTeamMembers(found.id);
        }
      }
    } catch {
      // Token invalid/expired
      setStoredToken(null);
      set({ currentUser: null, authToken: null });
    }
  },

  login: async (email: string, pass: string) => {
    set({ error: null });
    try {
      const res = await apiClient.login(email, pass);
      setStoredToken(res.token);
      set({
        currentUser: res.user,
        authToken: res.token,
        isAuthModalOpen: false,
      });
      await get().checkAuthSession();
      await get().initializeWorkspace();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      set({ error: msg });
      throw err;
    }
  },

  register: async (email: string, name: string, pass: string) => {
    set({ error: null });
    try {
      const res = await apiClient.register(email, name, pass);
      setStoredToken(res.token);
      set({
        currentUser: res.user,
        authToken: res.token,
        isAuthModalOpen: false,
      });
      await get().checkAuthSession();
      await get().initializeWorkspace();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      set({ error: msg });
      throw err;
    }
  },

  switchMockUser: async (userId: string) => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }

    // Immediately clear all user-specific state to prevent any brief flash of previous data
    set({
      mission: null,
      mainConversation: null,
      nodes: [],
      selectedNodeId: null,
      contextSnippet: null,
      isChatDrawerOpen: false,
      isRecoveryOpen: false,
      historyMissions: [],
      messagesByConversation: {},
      sharedDecisions: [],
      currentTeam: null,
      userTeams: [],
      teamMembers: [],
      teamInvitations: [],
      projects: [],
      currentProject: null,
      isProjectSetupOpen: false,
      isLoadingWorkspace: true,
      error: null,
    });

    localStorage.removeItem('threadback_active_mission_id');
    localStorage.removeItem('threadback_active_team_id');
    localStorage.removeItem('threadback_active_project_id');

    try {
      const res = await apiClient.devSwitch(userId);
      setStoredToken(res.token);
      set({
        currentUser: res.user,
        authToken: res.token,
      });
      await get().checkAuthSession();
      await get().initializeWorkspace();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to switch user';
      set({ error: msg, isLoadingWorkspace: false });
      throw err;
    }
  },

  logout: () => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
    setStoredToken(null);
    localStorage.removeItem('threadback_active_mission_id');
    localStorage.removeItem('threadback_active_team_id');
    localStorage.removeItem('threadback_active_project_id');
    set({
      currentUser: null,
      authToken: null,
      currentTeam: null,
      userTeams: [],
      teamMembers: [],
      teamInvitations: [],
      sharedDecisions: [],
      projects: [],
      currentProject: null,
      isProjectSetupOpen: false,
      mission: null,
      mainConversation: null,
      nodes: [],
      selectedNodeId: null,
      contextSnippet: null,
      historyMissions: [],
      messagesByConversation: {},
      isChatDrawerOpen: false,
      isRecoveryOpen: false,
      isLoadingWorkspace: false,
    });
    get().initializeWorkspace();
  },

  // Team actions
  switchTeam: async (teamId: string | null) => {
    if (!teamId) {
      localStorage.removeItem('threadback_active_team_id');
      set({ currentTeam: null, teamMembers: [], sharedDecisions: [] });
    } else {
      const { userTeams } = get();
      const targetTeam = userTeams.find((t) => t.id === teamId) || null;
      localStorage.setItem('threadback_active_team_id', teamId);
      set({ currentTeam: targetTeam });
      if (targetTeam) {
        await get().loadTeamMembers(targetTeam.id);
      }
    }
    await get().initializeWorkspace();
  },

  createTeam: async (name: string) => {
    set({ error: null });
    try {
      const { team } = await apiClient.createTeam(name);
      set((state) => ({
        userTeams: [team, ...state.userTeams],
        currentTeam: team,
        isTeamModalOpen: false,
      }));
      localStorage.setItem('threadback_active_team_id', team.id);
      await get().loadTeamMembers(team.id);
      await get().initializeWorkspace();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create team';
      set({ error: msg });
      throw err;
    }
  },

  loadTeamMembers: async (teamId: string) => {
    try {
      const res = await apiClient.getTeam(teamId);
      set({
        teamMembers: res.members,
        teamInvitations: res.pendingInvites || [],
      });
    } catch {
      // Ignored
    }
  },

  inviteMember: async (role: 'admin' | 'member', email?: string) => {
    const { currentTeam } = get();
    if (!currentTeam) throw new Error('No team selected');

    try {
      const res = await apiClient.createInvitation(currentTeam.id, role, email);
      await get().loadTeamMembers(currentTeam.id);
      // Return invite token / link
      const inviteUrl = `${window.location.origin}?invite=${res.inviteToken}`;
      return inviteUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invitation failed';
      set({ error: msg });
      throw err;
    }
  },

  acceptInvitation: async (token: string) => {
    try {
      const res = await apiClient.acceptInvitation(token);
      await get().checkAuthSession();
      await get().switchTeam(res.team.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to accept invitation';
      set({ error: msg });
      throw err;
    }
  },

  leaveTeam: async () => {
    const { currentTeam } = get();
    if (!currentTeam) return;

    try {
      await apiClient.leaveTeam(currentTeam.id);
      await get().switchTeam(null);
      await get().checkAuthSession();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to leave team';
      set({ error: msg });
      throw err;
    }
  },

  removeMember: async (userId: string) => {
    const { currentTeam } = get();
    if (!currentTeam) return;

    try {
      await apiClient.removeMember(currentTeam.id, userId);
      await get().loadTeamMembers(currentTeam.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove member';
      set({ error: msg });
      throw err;
    }
  },

  // Decisions actions
  addSharedDecision: async (decision: string, category = 'decision') => {
    const { mission } = get();
    if (!mission?.id) return;

    try {
      const { decision: newDec } = await apiClient.addDecision(mission.id, decision, category);
      set((state) => ({
        sharedDecisions: [...state.sharedDecisions, newDec],
        mission: state.mission
          ? {
              ...state.mission,
              decisions: [...state.mission.decisions, newDec.decision],
            }
          : null,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record decision';
      set({ error: msg });
      throw err;
    }
  },

  deleteSharedDecision: async (decisionId: string) => {
    const { mission } = get();
    if (!mission?.id) return;

    try {
      await apiClient.deleteDecision(mission.id, decisionId);
      set((state) => ({
        sharedDecisions: state.sharedDecisions.filter((d) => d.id !== decisionId),
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove decision';
      set({ error: msg });
    }
  },

  claimLegacyMission: async (missionId: string) => {
    try {
      await apiClient.claimMission(missionId);
      await get().loadMission(missionId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to claim mission';
      set({ error: msg });
    }
  },

  shareMissionWithTeam: async (missionId: string, teamId: string) => {
    try {
      await apiClient.shareMissionWithTeam(missionId, teamId);
      await get().loadMission(missionId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to share mission';
      set({ error: msg });
      throw err;
    }
  },

  toggleSideQuestSharing: async (sideQuestId: string, isShared: boolean) => {
    try {
      await apiClient.toggleShareConversation(sideQuestId, isShared);
      set((state) => ({
        nodes: state.nodes.map((n) => (n.id === sideQuestId ? { ...n, isShared } : n)),
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle sharing';
      set({ error: msg });
    }
  },

  // Polling for collaboration
  pollMissionUpdates: async () => {
    const { mission, isAiGenerating } = get();
    if (!mission || mission.id === 'mission-loading' || isAiGenerating) return;

    try {
      const [missionData, decisionsData] = await Promise.all([
        apiClient.getMission(mission.id),
        apiClient.listDecisions(mission.id).catch(() => ({ decisions: [] })),
      ]);

      set((state) => {
        // Compare decisions
        const decisionsChanged =
          decisionsData.decisions.length !== state.sharedDecisions.length ||
          decisionsData.decisions.some((d, idx) => d.id !== state.sharedDecisions[idx]?.id);

        return decisionsChanged ? { sharedDecisions: decisionsData.decisions } : state;
      });

      // Update conversations if new sidequests were added by a teammate
      const currentConvIds = new Set(get().nodes.map((n) => n.id));
      const newSideQuests = missionData.conversations.filter(
        (c) => c.type === 'sidequest' && !currentConvIds.has(c.id)
      );

      if (newSideQuests.length > 0) {
        // Fetch new messages and append nodes
        for (const sq of newSideQuests) {
          const msgRes = await apiClient.getConversationMessages(sq.id);
          const msgs = msgRes.messages.map(mapMessageDtoToChatMessage);
          const latestAsst = [...msgs].reverse().find((m) => m.role === 'assistant');

          const newX = 500;
          const newY = 100 + get().nodes.length * 150;

          const newNode: QNode = {
            id: sq.id,
            parentId: get().mainConversation?.id || 'root',
            query: sq.topic || 'Exploration',
            answer: latestAsst?.content || 'Exploration node created by teammate.',
            status: 'done',
            position: { x: newX, y: newY },
            createdAt: sq.createdAt,
            learningNotes: [],
            conversationType: 'sidequest',
            topic: sq.topic || undefined,
            isShared: sq.isShared,
            messages: msgs,
          };

          set((state) => ({
            nodes: [...state.nodes, newNode],
            messagesByConversation: {
              ...state.messagesByConversation,
              [sq.id]: msgs,
            },
          }));
        }
      }
    } catch {
      // Quiet background polling error
    }
  },

  initializeWorkspace: async () => {
    set({ isLoadingWorkspace: true, error: null });

    // Check URL for invite token param: ?invite=TOKEN
    const searchParams = new URLSearchParams(window.location.search);
    const inviteParam = searchParams.get('invite');

    await get().checkAuthSession();

    if (inviteParam) {
      try {
        if (!get().currentUser) {
          set({
            isAuthModalOpen: true,
            authModalMode: 'register',
            error: 'Please sign up or log in to accept the team invitation.',
          });
        } else {
          await get().acceptInvitation(inviteParam);
          // Remove param from URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch {
        // Ignored
      }
    }

    try {
      await get().loadProjects();
      const { projects } = get();
      const savedProjectId = localStorage.getItem('threadback_active_project_id');
      const targetProject = projects.find((p) => p.id === savedProjectId) || projects[0] || null;

      if (targetProject) {
        set({ currentProject: targetProject });
      }

      const activeTeam = get().currentTeam;
      const { missions } = await apiClient.listMissions({
        teamId: activeTeam?.id || null,
        projectId: targetProject?.id || null,
      });

      const historyList = missions.map((m) => ({
        id: m.id,
        title: m.objective.length > 32 ? m.objective.slice(0, 30) + '...' : m.objective,
        createdAt: new Date(m.createdAt).toLocaleDateString(),
        nodeCount: 1,
        visibility: m.visibility,
      }));

      set({ historyMissions: historyList });

      // Determine target mission to load
      const savedActiveMissionId = localStorage.getItem('threadback_active_mission_id');
      const targetMission =
        missions.find((m) => m.id === savedActiveMissionId) || missions[0];

      if (targetMission) {
        await get().loadMission(targetMission.id);
      } else {
        // Workspace is empty: do not automatically seed demo missions
        localStorage.removeItem('threadback_active_mission_id');
        set({
          mission: null,
          mainConversation: null,
          nodes: [],
          selectedNodeId: null,
          contextSnippet: null,
          isLoadingWorkspace: false,
        });
        if (pollingTimer) {
          clearInterval(pollingTimer);
          pollingTimer = null;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to backend';
      set({ error: msg, isLoadingWorkspace: false });
    }
  },

  loadMission: async (missionId: string) => {
    set({ isLoadingWorkspace: true, error: null });
    try {
      const [{ mission: missionDto, conversations, decisions }, decisionsRes] = await Promise.all([
        apiClient.getMission(missionId),
        apiClient.listDecisions(missionId).catch(() => ({ decisions: [] })),
      ]);

      localStorage.setItem('threadback_active_mission_id', missionId);

      const mainConv = conversations.find((c) => c.type === 'main') || null;
      const sideQuests = conversations.filter((c) => c.type === 'sidequest');

      // Fetch messages for each conversation in parallel
      const messagesMap: Record<string, ChatMessage[]> = {};
      await Promise.all(
        conversations.map(async (conv) => {
          try {
            const res = await apiClient.getConversationMessages(conv.id);
            messagesMap[conv.id] = res.messages.map(mapMessageDtoToChatMessage);
          } catch {
            messagesMap[conv.id] = [];
          }
        })
      );

      // Reconstruct ReactFlow Nodes
      const rootId = mainConv ? mainConv.id : 'root';
      const rootMessages = (mainConv && messagesMap[mainConv.id]) || [];
      const latestRootAssistant = [...rootMessages].reverse().find((m) => m.role === 'assistant');

      const rootNode: QNode = {
        id: rootId,
        parentId: null,
        query: missionDto.objective,
        answer:
          latestRootAssistant?.content ||
          `**Welcome to ThreadBack.**\n\nThis is your immutable **Original Context Root** for: "${missionDto.objective}".\n\n- Ask follow-up questions to interact with **Main AI**.\n- Spawn **SideQuests** to investigate topics without losing context.\n- Click **Return to Mission** on any SideQuest to synthesize key findings.`,
        status: 'done',
        position: { x: 80, y: 180 },
        createdAt: missionDto.createdAt,
        learningNotes: [],
        conversationType: 'main',
        isShared: true,
        messages: rootMessages,
      };

      const sideQuestNodes: QNode[] = sideQuests.map((sq, index) => {
        const sqMessages = messagesMap[sq.id] || [];
        const latestSqAssistant = [...sqMessages].reverse().find((m) => m.role === 'assistant');

        return {
          id: sq.id,
          parentId: rootId,
          query: sq.topic || 'Technical Exploration',
          answer:
            latestSqAssistant?.content ||
            'Explore this topic in isolation. Messages in this SideQuest are preserved independently.',
          status: 'done',
          position: { x: 500, y: 100 + index * 210 },
          createdAt: sq.createdAt,
          learningNotes: [],
          conversationType: 'sidequest',
          topic: sq.topic || undefined,
          isShared: sq.isShared,
          messages: sqMessages,
        };
      });

      const allNodes = [rootNode, ...sideQuestNodes];
      const allDecisions = decisionsRes.decisions || decisions || [];

      const fullMission: Mission = {
        id: missionDto.id,
        title: missionDto.objective.length > 32 ? missionDto.objective.slice(0, 30) + '...' : missionDto.objective,
        objective: missionDto.objective,
        constraints: ['Maintain modular architecture', 'Preserve established constraints'],
        completedSteps: ['Initialized project space'],
        decisions: allDecisions.map((d) => d.decision),
        currentBlocker: '',
        nextAction: 'Ask your inquiry or approve a decision to update team memory',
        teamId: missionDto.teamId,
        userId: missionDto.userId,
        visibility: missionDto.visibility,
        createdAt: missionDto.createdAt,
        updatedAt: missionDto.updatedAt,
        status: missionDto.status as 'active',
      };

      set({
        mission: fullMission,
        mainConversation: mainConv,
        nodes: allNodes,
        messagesByConversation: messagesMap,
        sharedDecisions: allDecisions,
        selectedNodeId: rootId,
        isLoadingWorkspace: false,
      });

      // Start periodic polling for collaboration on active mission
      if (pollingTimer) clearInterval(pollingTimer);
      pollingTimer = setInterval(() => {
        get().pollMissionUpdates();
      }, 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load mission';
      set({ error: msg, isLoadingWorkspace: false });
    }
  },

  startNewChat: async (title?: string, objective?: string) => {
    const promptText = objective || title || 'New Task Mission';
    await get().createMissionFromModal(promptText, title);
  },

  createMissionFromModal: async (objective: string, title?: string, teamId?: string | null) => {
    set({ isLoadingWorkspace: true, error: null, isMissionModalOpen: false });
    const targetTeamId = teamId !== undefined ? teamId : get().currentTeam?.id || null;
    const visibility = targetTeamId ? 'team' : 'personal';
    const projectId = get().currentProject?.id || null;

    try {
      const res = await apiClient.createMission(objective.trim(), targetTeamId, visibility, projectId);
      const { missions } = await apiClient.listMissions({ projectId, teamId: targetTeamId });

      set({
        historyMissions: missions.map((m) => ({
          id: m.id,
          title: m.objective.length > 32 ? m.objective.slice(0, 30) + '...' : m.objective,
          createdAt: new Date(m.createdAt).toLocaleDateString(),
          nodeCount: 1,
          visibility: m.visibility,
        })),
      });

      await get().loadMission(res.mission.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create mission';
      set({ error: msg, isLoadingWorkspace: false });
    }
  },

  createBranchNode: async (query: string, parentId?: string | null, snippet?: string) => {
    const { mission, mainConversation, nodes } = get();
    if (!mission) {
      throw new Error('Cannot create branch without an active mission.');
    }
    const effectiveParentId = parentId || mainConversation?.id || 'root';
    const parentNode = nodes.find((n) => n.id === effectiveParentId) || nodes[0];

    set({ isAiGenerating: true, error: null });

    try {
      // 1. Create SideQuest conversation in backend SQLite (shared by default)
      const { sideQuest } = await apiClient.createSideQuest(mission.id, query.trim(), true);

      // Position calculation
      const siblings = nodes.filter((n) => n.parentId === parentNode?.id);
      const newX = (parentNode?.position?.x || 80) + 420;
      const newY = (parentNode?.position?.y || 180) + siblings.length * 210;

      const newSideQuestNode: QNode = {
        id: sideQuest.id,
        parentId: parentNode?.id || rootIdSafe(mainConversation),
        query,
        contextSnippet: snippet || undefined,
        answer: '',
        status: 'loading',
        position: { x: newX, y: Math.max(50, newY) },
        createdAt: sideQuest.createdAt,
        learningNotes: [],
        conversationType: 'sidequest',
        topic: query,
        isShared: true,
        messages: [{
          id: `tmp-${Date.now()}`,
          role: 'user',
          content: query,
          createdAt: new Date().toISOString(),
          authorName: get().currentUser?.name || 'You',
        }],
      };

      set((state) => ({
        nodes: [...state.nodes, newSideQuestNode],
        selectedNodeId: sideQuest.id,
        contextSnippet: null,
        isChatDrawerOpen: true,
        messagesByConversation: {
          ...state.messagesByConversation,
          [sideQuest.id]: newSideQuestNode.messages || [],
        },
      }));

      // 2. Call real SideQuest AI inference via backend
      const aiRes = await apiClient.sendSideQuestChat({
        conversationId: sideQuest.id,
        message: query,
        missionId: mission.id,
        sideQuestTopic: query,
      });

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: aiRes.reply,
        createdAt: new Date().toISOString(),
        authorName: 'Main AI',
      };

      set((state) => {
        const existingMessages = state.messagesByConversation[sideQuest.id] || [];
        const updatedMsgs = [...existingMessages, assistantMsg];
        return {
          isAiGenerating: false,
          nodes: state.nodes.map((n) =>
            n.id === sideQuest.id
              ? { ...n, answer: aiRes.reply, status: 'done', messages: updatedMsgs }
              : n
          ),
          messagesByConversation: {
            ...state.messagesByConversation,
            [sideQuest.id]: updatedMsgs,
          },
        };
      });

      return sideQuest.id;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create branch';
      set((state) => ({
        isAiGenerating: false,
        error: msg,
        lastUnsentInput: query,
        nodes: state.nodes.map((n) => (n.status === 'loading' ? { ...n, status: 'error' } : n)),
      }));
      throw err;
    }
  },

  sendMessage: async (conversationId: string, messageText: string) => {
    const text = messageText.trim();
    if (!text) return;

    const { nodes, mission, mainConversation, messagesByConversation, currentUser } = get();
    const targetNode = nodes.find((n) => n.id === conversationId);
    const isMain =
      conversationId === 'root' ||
      (mainConversation && conversationId === mainConversation.id) ||
      targetNode?.conversationType === 'main';

    const actualConvId = isMain && mainConversation ? mainConversation.id : conversationId;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
      authorName: currentUser?.name || 'You',
      userId: currentUser?.id,
    };

    // Optimistically append user message
    const prevMessages = messagesByConversation[actualConvId] || [];
    const optimisticMessages = [...prevMessages, userMessage];

    set((state) => ({
      isAiGenerating: true,
      error: null,
      messagesByConversation: {
        ...state.messagesByConversation,
        [actualConvId]: optimisticMessages,
      },
      nodes: state.nodes.map((n) =>
        n.id === conversationId || n.id === actualConvId
          ? { ...n, status: 'loading' }
          : n
      ),
    }));

    try {
      let reply = '';
      if (isMain) {
        // Send to Main AI
        const res = await apiClient.sendMainAiChat({
          conversationId: actualConvId,
          message: text,
          missionId: mission?.id,
        });
        reply = res.reply;
      } else {
        // Send to SideQuest AI
        const res = await apiClient.sendSideQuestChat({
          conversationId: actualConvId,
          message: text,
          missionId: mission?.id,
          sideQuestTopic: targetNode?.query,
        });
        reply = res.reply;
      }

      const assistantMessage: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: reply,
        createdAt: new Date().toISOString(),
        authorName: 'Main AI',
      };

      const finalMessages = [...optimisticMessages, assistantMessage];

      set((state) => ({
        isAiGenerating: false,
        lastUnsentInput: '',
        messagesByConversation: {
          ...state.messagesByConversation,
          [actualConvId]: finalMessages,
        },
        nodes: state.nodes.map((n) =>
          n.id === conversationId || n.id === actualConvId
            ? { ...n, answer: reply, status: 'done', messages: finalMessages }
            : n
        ),
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Message generation failed';
      set((state) => ({
        isAiGenerating: false,
        error: msg,
        lastUnsentInput: text,
        nodes: state.nodes.map((n) =>
          n.id === conversationId || n.id === actualConvId
            ? { ...n, status: 'error' }
            : n
        ),
      }));
    }
  },

  openRecovery: async (nodeId?: string) => {
    const { nodes, selectedNodeId, mainConversation } = get();
    const effectiveNodeId = nodeId || selectedNodeId || mainConversation?.id || 'root';
    const targetNode = nodes.find((n) => n.id === effectiveNodeId);

    set({
      isRecoveryOpen: true,
      recoveryNodeId: effectiveNodeId,
    });

    if (targetNode && targetNode.conversationType === 'sidequest') {
      await get().executeReturnToMission(effectiveNodeId);
    }
  },

  closeRecovery: () => {
    set({ isRecoveryOpen: false, isRecoveryLoading: false });
  },

  executeReturnToMission: async (sideQuestConversationId: string) => {
    const { nodes, mainConversation } = get();
    let targetId = sideQuestConversationId;
    if (targetId === 'root' || targetId === mainConversation?.id) {
      const firstSq = nodes.find((n) => n.conversationType === 'sidequest');
      if (firstSq) {
        targetId = firstSq.id;
      } else {
        return;
      }
    }

    set({ isRecoveryLoading: true, error: null });

    try {
      const res = await apiClient.returnToMission(targetId);
      const summary = res.summary;

      // Also reload decisions to fetch the new approved shared decisions
      const decisionsRes = await apiClient.listDecisions(res.missionId).catch(() => ({ decisions: [] }));

      set((state) => ({
        currentSummary: summary,
        isRecoveryLoading: false,
        sharedDecisions: decisionsRes.decisions,
        nodes: state.nodes.map((n) =>
          n.id === targetId
            ? {
                ...n,
                learningNotes: summary.keyLearnings || [],
              }
            : n
        ),
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Return to Mission synthesis failed';
      set({ error: msg, isRecoveryLoading: false });
    }
  },
}));

function rootIdSafe(mainConv: ConversationDto | null): string {
  return mainConv?.id || 'root';
}
