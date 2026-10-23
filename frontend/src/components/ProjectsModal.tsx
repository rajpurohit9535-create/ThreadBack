import React, { useState, useEffect } from 'react';
import {
  X,
  FolderGit2,
  Plus,
  Users,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Unlink,
  Link2,
  RefreshCw,
  Mail,
  Shield,
  Copy,
  ChevronRight,
  GitBranch,
  Cpu,
  Sparkles,
  Star,
  BookOpen,
  MessageSquare,
  Send,
} from 'lucide-react';
import {
  apiClient,
  TeamDto,
  ProjectDto,
  GitHubConnectionDto,
  GitHubRepoDto,
  TeamMemberDto,
  RepoAnalysisReportDto,
  ProjectFeedbackDto,
} from '../api/client';
import { useCanvasStore } from '../store/canvasStore';
import { useToast } from './Toast';

const GithubIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    width="100%"
    height="100%"
    fill="currentColor"
    className={className}
    stroke="none"
  >
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject?: (project: ProjectDto) => void;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  isOpen,
  onClose,
  onSelectProject,
}) => {
  const { showToast } = useToast();
  const { currentUser, activeProject, setActiveProject, refreshProjects, openAuthModal } = useCanvasStore();

  const [activeTab, setActiveTab] = useState<'projects' | 'github' | 'team' | 'analyze'>('projects');
  const [repoToAnalyze, setRepoToAnalyze] = useState(
    activeProject?.githubRepo || 'https://github.com/codecrafters-io/build-your-own-x'
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<RepoAnalysisReportDto | null>(null);

  // Sync repoToAnalyze when activeProject changes
  useEffect(() => {
    if (activeProject?.githubRepo) {
      setRepoToAnalyze(activeProject.githubRepo);
    }
  }, [activeProject?.id, activeProject?.githubRepo]);

  // Feedback State
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackList, setFeedbackList] = useState<ProjectFeedbackDto[]>([]);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Core Data
  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberDto[]>([]);
  const [githubStatus, setGithubStatus] = useState<{
    connected: boolean;
    connection: GitHubConnectionDto | null;
  }>({ connected: false, connection: null });
  const [availableRepos, setAvailableRepos] = useState<GitHubRepoDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // New Project Form State
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [selectedRepoFullName, setSelectedRepoFullName] = useState<string>('');

  // New Team Form State
  const [newTeamName, setNewTeamName] = useState('');
  const [showCreateTeam, setShowCreateTeam] = useState(false);

  // Invite Teammate State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  // GitHub Connect Form State
  const [ghToken, setGhToken] = useState('');
  const [ghLogin, setGhLogin] = useState('');
  const [ghAccountId, setGhAccountId] = useState('');

  const loadData = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      // 1. Fetch Teams
      const teamsRes = await apiClient.listTeams();
      setTeams(teamsRes.teams || []);
      const defaultTeam = teamsRes.teams?.[0]?.id || '';
      setSelectedTeamId(defaultTeam);

      // 2. Fetch Projects
      const projRes = await apiClient.listProjects();
      setProjects(projRes.projects || []);

      // 3. Fetch GitHub Status
      try {
        const ghRes = await apiClient.getGitHubStatus();
        setGithubStatus(ghRes);
        if (ghRes.connected) {
          const reposRes = await apiClient.getGitHubRepos();
          setAvailableRepos(reposRes.repositories || []);
        }
      } catch {
        setGithubStatus({ connected: false, connection: null });
      }

      // 4. Fetch Members for default team if available
      if (defaultTeam) {
        try {
          const teamDetail = await apiClient.getTeam(defaultTeam);
          setTeamMembers(teamDetail.members || []);
        } catch {
          // Ignore
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load projects workspace', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (!currentUser) {
        openAuthModal('login');
        return;
      }
      loadData();
    }
  }, [isOpen, currentUser]);

  async function handleRunAnalysis(targetRepo?: string) {
    const target = (targetRepo || repoToAnalyze).trim();
    if (!target && !activeProject?.githubRepo) {
      showToast('Please specify a GitHub repository URL or link one to the active project', 'error');
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await apiClient.analyzeRepo({
        repo: target || undefined,
        projectId: activeProject?.id,
      });
      setAnalysisReport(res.report);
      showToast(`Analyzed ${res.report.repository.fullName} successfully!`, 'success');

      // Fetch existing feedback for this repository
      try {
        const fbRes = await apiClient.listFeedback({
          targetType: 'repo_analysis',
          targetId: res.report.repository.fullName,
        });
        setFeedbackList(fbRes.feedback || []);
      } catch {
        setFeedbackList([]);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to analyze repository', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleSubmitFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!feedbackComment.trim() || !analysisReport) return;

    setIsSubmittingFeedback(true);
    try {
      const res = await apiClient.submitFeedback({
        projectId: activeProject?.id || null,
        targetType: 'repo_analysis',
        targetId: analysisReport.repository.fullName,
        rating: feedbackRating,
        comment: feedbackComment.trim(),
      });

      setFeedbackList([res.feedback, ...feedbackList]);
      setFeedbackComment('');
      showToast('Feedback submitted successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to submit feedback', 'error');
    } finally {
      setIsSubmittingFeedback(false);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim()) {
      showToast('Project name is required', 'error');
      return;
    }

    try {
      const res = await apiClient.createProject({
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || undefined,
        teamId: selectedTeamId || undefined,
        githubRepo: selectedRepoFullName.trim() || undefined,
      });

      showToast(`Project "${res.project.name}" created!`, 'success');
      setNewProjectName('');
      setNewProjectDesc('');
      setSelectedRepoFullName('');
      refreshProjects();
      loadData();
      if (onSelectProject) {
        onSelectProject(res.project);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create project', 'error');
    }
  }

  async function handleConnectGitHub(e: React.FormEvent) {
    e.preventDefault();
    if (!ghToken.trim()) {
      showToast('Personal access token is required', 'error');
      return;
    }

    try {
      const res = await apiClient.connectGitHub({
        accessToken: ghToken.trim(),
        accountLogin: ghLogin.trim() || 'developer',
        accountId: ghAccountId.trim() || `gh_${Date.now()}`,
      });

      setGithubStatus({ connected: true, connection: res.connection });
      showToast(`GitHub account "${res.connection.accountLogin}" connected!`, 'success');
      setGhToken('');

      // Refresh repos
      const reposRes = await apiClient.getGitHubRepos();
      setAvailableRepos(reposRes.repositories || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to connect GitHub', 'error');
    }
  }

  async function handleDisconnectGitHub() {
    try {
      await apiClient.disconnectGitHub();
      setGithubStatus({ connected: false, connection: null });
      setAvailableRepos([]);
      showToast('GitHub disconnected', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to disconnect GitHub', 'error');
    }
  }

  async function handleSimulateRevoke() {
    try {
      await apiClient.simulateGitHubRevocation();
      setGithubStatus({
        connected: false,
        connection: githubStatus.connection ? { ...githubStatus.connection, status: 'revoked' } : null,
      });
      setAvailableRepos([]);
      showToast('Simulated access token revocation applied', 'warning');
    } catch (err: any) {
      showToast(err.message || 'Failed to trigger revocation', 'error');
    }
  }

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    try {
      const res = await apiClient.createTeam(newTeamName.trim());
      showToast(`Team "${res.team.name}" created!`, 'success');
      setNewTeamName('');
      setShowCreateTeam(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create team', 'error');
    }
  }

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeamId) return;

    try {
      const res = await apiClient.createInvitation(
        selectedTeamId,
        inviteRole,
        inviteEmail.trim() || undefined
      );

      const link = `${window.location.origin}?invite=${res.invitation.token}`;
      setLastInviteLink(link);
      showToast('Invitation generated!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate invitation', 'error');
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold shadow-xs">
              <FolderGit2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Projects & GitHub Hub</h3>
              <p className="text-xs text-slate-500">
                Phase 2 Repository Analysis, GitHub Authorization & Team Projects
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('projects')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'projects'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderGit2 className="w-4 h-4" />
            <span>Projects ({projects.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('github')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'github'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <GithubIcon className="w-4 h-4" />
            <span>GitHub Connection</span>
            {githubStatus.connected && (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('analyze')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'analyze'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>Code Analysis & Reports</span>
          </button>

          <button
            onClick={() => setActiveTab('team')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'team'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Team & Invites</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-xs">Loading project and repository state...</p>
            </div>
          ) : activeTab === 'projects' ? (
            /* PROJECTS TAB */
            <div className="space-y-6">
              {/* Create Project Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span>Create New Project</span>
                </h4>

                <form onSubmit={handleCreateProject} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Project Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. KV Store Engine"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Team Workspace
                      </label>
                      <select
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Personal Workspace (Private)</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            Team: {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Description (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="High-performance LSM-tree storage"
                        value={newProjectDesc}
                        onChange={(e) => setNewProjectDesc(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Link GitHub Repository (Optional)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="https://github.com/owner/repository"
                          value={selectedRepoFullName}
                          onChange={(e) => setSelectedRepoFullName(e.target.value)}
                          className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {availableRepos.length > 0 && (
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                setSelectedRepoFullName(`https://github.com/${e.target.value}`);
                              }
                            }}
                            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Connected repos...</option>
                            {availableRepos.map((r) => (
                              <option key={r.id} value={r.fullName}>
                                {r.fullName}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Enter any public or connected repository URL (e.g. https://github.com/owner/repo).
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      Create Project
                    </button>
                  </div>
                </form>
              </div>

              {/* Projects List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Available Projects ({projects.length})
                </h4>

                {projects.length === 0 ? (
                  <div className="text-center py-10 bg-white border border-slate-200 rounded-2xl p-6">
                    <FolderGit2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-medium">No projects created yet</p>
                    <p className="text-[11px] text-slate-400">
                      Create a project above to link GitHub repositories and organize mission threads.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {projects.map((proj) => (
                      <div
                        key={proj.id}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                          activeProject?.id === proj.id
                            ? 'bg-blue-50/50 border-blue-400 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                        }`}
                        onClick={() => {
                          setActiveProject(proj);
                          if (onSelectProject) onSelectProject(proj);
                          showToast(`Selected project "${proj.name}"`, 'info');
                        }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-sm text-slate-900">{proj.name}</span>
                          {activeProject?.id === proj.id && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                              Active
                            </span>
                          )}
                        </div>

                        {proj.description && (
                          <p className="text-xs text-slate-500 mb-2 leading-relaxed">
                            {proj.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                          {proj.githubRepo ? (
                            <div className="flex items-center gap-1 text-slate-700 font-mono">
                              <GithubIcon className="w-3.5 h-3.5" />
                              <span className="truncate max-w-[180px]">{proj.githubRepo}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">No repository</span>
                          )}
                          {proj.githubRepo && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveProject(proj);
                                setRepoToAnalyze(proj.githubRepo!);
                                setActiveTab('analyze');
                                handleRunAnalysis(proj.githubRepo!);
                              }}
                              className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-[10px] font-semibold cursor-pointer"
                            >
                              Analyze →
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'github' ? (
            /* GITHUB TAB */
            <div className="space-y-6">
              {/* Connection Status Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold">
                      <GithubIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">GitHub Connection Status</h4>
                      <p className="text-xs text-slate-500">
                        {githubStatus.connected
                          ? `Connected as ${githubStatus.connection?.accountLogin}`
                          : 'Not connected. Connect via Personal Access Token (PAT) or OAuth.'}
                      </p>
                    </div>
                  </div>

                  <div>
                    {githubStatus.connected ? (
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Active</span>
                        </span>
                        <button
                          onClick={handleDisconnectGitHub}
                          className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold cursor-pointer"
                        >
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                        Disconnected
                      </span>
                    )}
                  </div>
                </div>

                {/* Connect Form */}
                {!githubStatus.connected && (
                  <form onSubmit={handleConnectGitHub} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          GitHub Personal Access Token (PAT)
                        </label>
                        <input
                          type="password"
                          placeholder="ghp_... or OAuth Bearer token"
                          value={ghToken}
                          onChange={(e) => setGhToken(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Account Username
                        </label>
                        <input
                          type="text"
                          placeholder="octocat"
                          value={ghLogin}
                          onChange={(e) => setGhLogin(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setGhToken('test_gho_valid_token_abc');
                          setGhLogin('octocat');
                          setGhAccountId('acc_demo');
                        }}
                        className="text-xs text-blue-600 font-semibold hover:underline"
                      >
                        Fill Test Mock Token
                      </button>

                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                      >
                        Authorize & Connect
                      </button>
                    </div>
                  </form>
                )}

                {/* Revoke Simulation for Phase 2 Verification */}
                {githubStatus.connected && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>Simulate token revocation by GitHub security:</span>
                    <button
                      onClick={handleSimulateRevoke}
                      className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Simulate 403 Revocation
                    </button>
                  </div>
                )}
              </div>

              {/* Authorized Repositories List */}
              {githubStatus.connected && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
                    <span>Authorized Repositories ({availableRepos.length})</span>
                    <button
                      onClick={async () => {
                        const res = await apiClient.getGitHubRepos();
                        setAvailableRepos(res.repositories || []);
                        showToast('Refreshed repositories', 'info');
                      }}
                      className="text-blue-600 hover:text-blue-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refresh</span>
                    </button>
                  </h4>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {availableRepos.map((repo) => (
                      <div
                        key={repo.id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{repo.fullName}</span>
                          <span className="ml-2 font-mono text-[10px] text-slate-400">
                            ({repo.defaultBranch})
                          </span>
                          {repo.isPrivate && (
                            <span className="ml-2 text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                              Private
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            setRepoToAnalyze(`https://github.com/${repo.fullName}`);
                            setActiveTab('analyze');
                            handleRunAnalysis(`https://github.com/${repo.fullName}`);
                          }}
                          className="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Analyze Repo →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'analyze' ? (
            /* ANALYZE TAB */
            <div className="space-y-6">
              {/* Input Form */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>Repository Code & Architecture Analyzer</span>
                  </h4>

                  {activeProject && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-slate-400">Project:</span>
                      <span className="font-semibold text-slate-800">{activeProject.name}</span>
                      {activeProject.githubRepo ? (
                        <span className="font-mono text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          {activeProject.githubRepo}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">(no repo linked)</span>
                      )}
                    </div>
                  )}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleRunAnalysis();
                  }}
                  className="flex flex-wrap items-center gap-3"
                >
                  <div className="flex-1 min-w-[260px]">
                    <input
                      type="text"
                      placeholder="e.g. https://github.com/codecrafters-io/build-your-own-x"
                      value={repoToAnalyze}
                      onChange={(e) => setRepoToAnalyze(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isAnalyzing}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                        <span>Run Analysis</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRepoToAnalyze('https://github.com/codecrafters-io/build-your-own-x');
                      handleRunAnalysis('https://github.com/codecrafters-io/build-your-own-x');
                    }}
                    className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Load build-your-own-x
                  </button>
                </form>
              </div>

              {/* Analysis Results View */}
              {analysisReport ? (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Repo Header */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-base text-slate-900">
                            {analysisReport.repository.fullName}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 font-mono text-[10px] font-bold">
                            {analysisReport.repository.defaultBranch}
                          </span>
                          {analysisReport.rateLimitStatus === 'rate_limited_cached' && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">
                              Verified Architecture Snapshot
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600">{analysisReport.repository.description}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 px-3 py-1 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                          <span>{analysisReport.repository.stars.toLocaleString()} stars</span>
                        </div>
                        <a
                          href={analysisReport.repository.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>GitHub</span>
                        </a>
                      </div>
                    </div>

                    {/* Commit & File Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Latest Tracked Commit (SHA)
                        </span>
                        <div className="flex items-center gap-2">
                          <GitBranch className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono text-xs font-bold text-slate-800">
                            {analysisReport.latestCommit.sha.slice(0, 10)}
                          </span>
                          <span className="text-slate-500 text-[11px] truncate">
                            by {analysisReport.latestCommit.author}
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Root Components ({analysisReport.fileSummary.topLevelCount})
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {analysisReport.fileSummary.items.slice(0, 6).map((file, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-mono text-[10px]"
                            >
                              {file}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Architectural Overview */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-purple-600" />
                      <span>Architectural Overview</span>
                    </h4>
                    <p className="text-xs text-slate-700 leading-relaxed bg-purple-50/40 p-3 rounded-xl border border-purple-100/60">
                      {analysisReport.architecturalOverview}
                    </p>
                  </div>

                  {/* Identified Modules & Categories */}
                  {analysisReport.keyCategoriesOrModules.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                        <Cpu className="w-4 h-4 text-purple-600" />
                        <span>Identified Technologies & Subsystems ({analysisReport.keyCategoriesOrModules.length})</span>
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {analysisReport.keyCategoriesOrModules.map((item, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ThreadBack Recommendations */}
                  <div className="bg-gradient-to-br from-purple-50/70 to-indigo-50/70 border border-purple-100 rounded-2xl p-5 shadow-xs">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span>ThreadBack Mission & SideQuest Recommendations</span>
                    </h4>
                    <p className="text-xs text-purple-950 mb-3">
                      {analysisReport.threadBackEngineeringInsights.suitabilityForMissions}
                    </p>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block">
                        Recommended SideQuests:
                      </span>
                      {analysisReport.threadBackEngineeringInsights.recommendedSideQuests.map((quest, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 rounded-xl bg-white border border-purple-200/80 text-xs font-medium text-slate-800 shadow-xs"
                        >
                          <ChevronRight className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          <span>{quest}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* User Feedback & Evaluation Card */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-blue-600" />
                      <span>Submit Analysis Feedback</span>
                    </h4>

                    <form onSubmit={handleSubmitFeedback} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-600">Rating:</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setFeedbackRating(star)}
                              className="text-amber-400 hover:scale-110 transition-transform cursor-pointer"
                            >
                              <Star
                                className={`w-4 h-4 ${
                                  star <= feedbackRating
                                    ? 'fill-amber-400 text-amber-500'
                                    : 'text-slate-300'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add comment on this report's accuracy or insights..."
                          value={feedbackComment}
                          onChange={(e) => setFeedbackComment(e.target.value)}
                          className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                        <button
                          type="submit"
                          disabled={isSubmittingFeedback || !feedbackComment.trim()}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Submit</span>
                        </button>
                      </div>
                    </form>

                    {/* Feedback History */}
                    {feedbackList.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Recorded Feedback ({feedbackList.length})
                        </span>
                        {feedbackList.map((fb) => (
                          <div
                            key={fb.id}
                            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs flex items-start justify-between"
                          >
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-slate-800">{fb.userName || 'Engineer'}</span>
                                {fb.rating && (
                                  <span className="flex items-center text-amber-500 font-bold text-[11px]">
                                    ★ {fb.rating}/5
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-600">{fb.comment}</p>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(fb.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                  <Cpu className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-medium">No analysis performed yet</p>
                  <p className="text-[11px] text-slate-400">
                    Enter a repository URL above and click "Run Analysis" to generate the architecture report.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* TEAM TAB */
            <div className="space-y-6">
              {/* Team Selector & Creator */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>Teams Workspace</span>
                  </h4>
                  <button
                    onClick={() => setShowCreateTeam(!showCreateTeam)}
                    className="text-xs text-blue-600 font-semibold hover:underline"
                  >
                    {showCreateTeam ? 'Cancel' : '+ New Team'}
                  </button>
                </div>

                {showCreateTeam && (
                  <form onSubmit={handleCreateTeam} className="mb-4 p-3 bg-blue-50/50 rounded-xl border border-blue-200 flex gap-2">
                    <input
                      type="text"
                      placeholder="Team Name (e.g. Core Architecture Team)"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      className="flex-1 text-xs bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800"
                      required
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Save Team
                    </button>
                  </form>
                )}

                <div className="flex flex-wrap gap-2">
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      onClick={async () => {
                        setSelectedTeamId(t.id);
                        try {
                          const res = await apiClient.getTeam(t.id);
                          setTeamMembers(res.members || []);
                        } catch {
                          setTeamMembers([]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        selectedTeamId === t.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Invite Teammate */}
              {selectedTeamId && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span>Invite Teammate</span>
                  </h4>

                  <form onSubmit={handleCreateInvite} className="flex flex-wrap gap-2 mb-3">
                    <input
                      type="email"
                      placeholder="teammate@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1 min-w-[200px] text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                    />

                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as any)}
                      className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                    >
                      <option value="member">Role: Member</option>
                      <option value="admin">Role: Admin</option>
                    </select>

                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Generate Invite Link
                    </button>
                  </form>

                  {lastInviteLink && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
                      <span className="font-mono truncate mr-2">{lastInviteLink}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(lastInviteLink);
                          showToast('Invite link copied!', 'success');
                        }}
                        className="px-2.5 py-1 bg-white border border-emerald-300 rounded-lg text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </button>
                    </div>
                  )}

                  {/* Members list */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                      Team Members ({teamMembers.length})
                    </span>
                    <div className="space-y-1.5">
                      {teamMembers.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-800">{m.userName || 'Member'}</span>
                            <span className="ml-2 text-slate-400 text-[11px]">{m.userEmail}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono text-[10px] font-bold">
                            {m.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
