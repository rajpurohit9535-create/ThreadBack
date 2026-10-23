import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  GitFork, 
  Plus, 
  X, 
  Users, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Sparkles, 
  AlertCircle, 
  LayoutDashboard,
  ShieldAlert,
  Terminal,
  Zap
} from 'lucide-react';
import Background3D from './Background3D';
import ThreeCanvas from './ThreeCanvas';
import { useCanvasStore } from '../../store/canvasStore';
import { apiClient } from '../../api/client';
import { GitHubStatus } from '../../types';

interface PendingInvite {
  email: string;
  role: 'admin' | 'member';
}

export const ProjectSetupPage: React.FC = () => {
  const { 
    closeProjectSetup, 
    userTeams, 
    currentUser, 
    createTeam, 
    projects,
    selectProject,
    loadProjects
  } = useCanvasStore();

  // Step management: 1 = Details, 2 = Team Members, 3 = Connect GitHub, 4 = Review & Create
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Form states
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [isCreatingNewTeam, setIsCreatingNewTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  // Team member invitations
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);

  // GitHub state
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [repoUrlError, setRepoUrlError] = useState<string | null>(null);
  const [isCheckingGithub, setIsCheckingGithub] = useState(false);

  // Validation function for GitHub repository URL
  const validateGitHubUrl = (input: string): { isValid: boolean; normalized?: string; error?: string } => {
    const trimmed = input.trim();
    if (!trimmed) {
      return { isValid: true, normalized: '' };
    }

    let cleaned = trimmed.replace(/\.git$/i, '');
    cleaned = cleaned.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '');
    cleaned = cleaned.replace(/^\/+|\/+$/g, '');

    const parts = cleaned.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return {
        isValid: false,
        error: 'Invalid GitHub repository format. Expected: https://github.com/owner/repository or owner/repository',
      };
    }

    const [owner, repo] = parts;
    const validPart = /^[a-zA-Z0-9_.-]+$/;
    if (!validPart.test(owner) || !validPart.test(repo)) {
      return {
        isValid: false,
        error: 'Repository URL contains invalid characters. Expected alphanumeric names with hyphens/underscores.',
      };
    }

    return {
      isValid: true,
      normalized: `https://github.com/${owner}/${repo}`,
    };
  };

  const handleRepoUrlChange = (value: string) => {
    setSelectedRepo(value);
    if (!value.trim()) {
      setRepoUrlError(null);
      return;
    }
    const result = validateGitHubUrl(value);
    if (!result.isValid) {
      setRepoUrlError(result.error || 'Invalid GitHub repository URL');
    } else {
      setRepoUrlError(null);
    }
  };

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch honest GitHub status on mount
    const checkGh = async () => {
      setIsCheckingGithub(true);
      try {
        const status = await apiClient.getProjectGitHubConfigStatus();
        setGithubStatus(status);
      } catch {
        setGithubStatus({
          configured: false,
          clientId: null,
          status: 'unconfigured',
          message: 'GitHub OAuth integration requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in backend/.env. Phase 2 planned.',
          repositories: [],
        });
      } finally {
        setIsCheckingGithub(false);
      }
    };
    checkGh();
  }, []);

  const handleAddInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (pendingInvites.some((i) => i.email.toLowerCase() === inviteEmail.trim().toLowerCase())) {
      setError('This email has already been added.');
      return;
    }

    setPendingInvites([...pendingInvites, { email: inviteEmail.trim(), role: inviteRole }]);
    setInviteEmail('');
    setError(null);
  };

  const handleRemoveInvite = (email: string) => {
    setPendingInvites(pendingInvites.filter((i) => i.email !== email));
  };

  const handleCreateNewTeamInline = async () => {
    if (!newTeamName.trim()) {
      setError('Please enter a team name.');
      return;
    }
    try {
      await createTeam(newTeamName.trim());
      setIsCreatingNewTeam(false);
      setNewTeamName('');
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    }
  };

  const handleFinalSubmit = async () => {
    if (!projectName.trim()) {
      setCurrentStep(1);
      setError('Project name is required.');
      return;
    }

    if (selectedRepo.trim()) {
      const validation = validateGitHubUrl(selectedRepo);
      if (!validation.isValid) {
        setRepoUrlError(validation.error || 'Invalid GitHub repository URL');
        setCurrentStep(3);
        setError('Please enter a valid GitHub repository URL or clear the field before creating the project.');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let teamIdToUse = selectedTeamId || null;

      // If user had invites but no team selected, create a team named after project
      if (!teamIdToUse && pendingInvites.length > 0 && currentUser) {
        try {
          const res = await apiClient.createTeam(`${projectName.trim()} Team`);
          teamIdToUse = res.team.id;
        } catch {
          // Continue if team creation fails
        }
      }

      const finalRepo = selectedRepo.trim() ? validateGitHubUrl(selectedRepo).normalized : undefined;

      const res = await apiClient.createProject({
        name: projectName.trim(),
        description: projectDescription.trim() || undefined,
        teamId: teamIdToUse,
        githubRepo: finalRepo,
        invitations: pendingInvites.length > 0 ? pendingInvites : undefined,
      });

      await loadProjects();
      await selectProject(res.project.id);
      closeProjectSetup();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="binary-setup-page fixed inset-0 z-50 flex flex-col overflow-y-auto selection:bg-cyan-500/30">
      {/* Real BinaryBombers 3D Backgrounds */}
      <Background3D />
      <ThreeCanvas />

      {/* Top Navbar */}
      <header className="w-full border-b border-white/10 bg-black/40 backdrop-blur-xl px-6 py-4 flex items-center justify-between relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-black text-black text-xs shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            TB
          </div>
          <div>
            <span className="font-extrabold tracking-tight text-white text-base">ThreadBack</span>
            <span className="text-xs text-cyan-400 font-mono ml-2 border-l border-white/20 pl-2">Setup Engine</span>
          </div>
        </div>

        {projects.length > 0 && (
          <button
            onClick={closeProjectSetup}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-all cursor-pointer"
          >
            <LayoutDashboard className="w-4 h-4 text-cyan-400" />
            <span>Open Canvas Board</span>
          </button>
        )}
      </header>

      {/* Main Setup Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-10 flex flex-col items-center relative z-20">
        {/* Hero Header */}
        <div className="text-center mb-8 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Project Initialization Flow</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-3">
            Initialize Your Project
          </h1>
          <p className="text-sm sm:text-base text-gray-400 font-medium">
            Configure your project context, invite collaborative teammates, and connect external version control.
          </p>
        </div>

        {/* Stepper Progress Bar */}
        <div className="flex items-center justify-center gap-3 mb-8 w-full max-w-md">
          <button
            onClick={() => setCurrentStep(1)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              currentStep === 1
                ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center text-[10px]">1</span>
            <span>Details</span>
          </button>

          <div className="w-6 h-[1px] bg-white/20"></div>

          <button
            onClick={() => setCurrentStep(2)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              currentStep === 2
                ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center text-[10px]">2</span>
            <span>Team Members</span>
          </button>

          <div className="w-6 h-[1px] bg-white/20"></div>

          <button
            onClick={() => setCurrentStep(3)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              currentStep === 3
                ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center text-[10px]">3</span>
            <span>GitHub</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="w-full max-w-2xl mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-3">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <p className="flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step Cards Container */}
        <div className="w-full max-w-2xl bg-black/50 backdrop-blur-2xl rounded-3xl border border-white/10 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>

          {/* STEP 1: Project Details */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Step 1 — Project Details</h3>
                <p className="text-xs text-gray-400">Name your engineering project and choose its target workspace.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                    Project Name <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Auth Service Migration to Go"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-hidden focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/50 text-sm font-medium transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                    Description <span className="text-gray-500 font-normal lowercase">(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Briefly describe the project goals, architecture constraints, and key deliverables..."
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-hidden focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/50 text-sm font-medium transition-all"
                  />
                </div>

                {/* Team / Workspace Selector */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                    Team Workspace
                  </label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#121622] border border-white/10 text-white focus:outline-hidden focus:border-cyan-500/60 text-sm font-medium cursor-pointer"
                  >
                    <option value="">Personal Workspace (Private to you)</option>
                    {userTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        Team: {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Create New Team Inline */}
                <div className="pt-2">
                  {!isCreatingNewTeam ? (
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewTeam(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create a new team for this project</span>
                    </button>
                  ) : (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                      <p className="text-xs font-semibold text-gray-300">Create New Team</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. Platform Core Team"
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-white text-xs font-medium focus:border-cyan-500/60"
                        />
                        <button
                          type="button"
                          onClick={handleCreateNewTeamInline}
                          className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-all cursor-pointer"
                        >
                          Create
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCreatingNewTeam(false)}
                          className="px-3 py-2 rounded-lg text-gray-400 hover:text-white text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-6 border-t border-white/10">
                <span className="text-xs text-gray-500 font-mono">Step 1 of 3</span>
                <button
                  type="button"
                  onClick={() => {
                    if (!projectName.trim()) {
                      setError('Project name is required.');
                      return;
                    }
                    setError(null);
                    setCurrentStep(2);
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer"
                >
                  <span>Next: Add Team Members</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Add Team Members */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Step 2 — Add Team Members</h3>
                <p className="text-xs text-gray-400">Invite engineers to collaborate on this project context.</p>
              </div>

              <form onSubmit={handleAddInvite} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    placeholder="teammate@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:border-cyan-500/60 text-sm font-medium"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                    className="px-3 py-2.5 rounded-xl bg-[#121622] border border-white/10 text-white text-xs font-semibold"
                  >
                    <option value="member">Role: Member</option>
                    <option value="admin">Role: Admin</option>
                  </select>
                  <button
                    type="submit"
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                </div>
              </form>

              {/* Pending Invites List */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
                  Pending Invitations ({pendingInvites.length})
                </span>

                {pendingInvites.length === 0 ? (
                  <div className="p-6 rounded-2xl border border-white/5 bg-white/2 text-center text-xs text-gray-500">
                    No teammates added yet. You can invite teammates now or share invite links later.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {pendingInvites.map((inv) => (
                      <div
                        key={inv.email}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <Users className="w-4 h-4 text-cyan-400" />
                          <span className="font-semibold text-white">{inv.email}</span>
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] uppercase font-mono">
                            {inv.role}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveInvite(inv.email)}
                          className="text-gray-400 hover:text-red-400 transition-colors p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Simulated notice as required */}
              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300">
                <span className="font-bold">Simulated Delivery Notice:</span> In this prototype, secure 24-byte invite tokens are generated and stored in SQLite. Teammates can join once registered using the generated link.
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Skip for now
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer"
                  >
                    <span>Next: Connect GitHub</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Connect GitHub */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Step 3 — Connect GitHub</h3>
                <p className="text-xs text-gray-400">Link your repository to monitor commits and technical context.</p>
              </div>

              {/* Primary GitHub Repository URL Field */}
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-200">
                      GitHub Repository URL
                    </label>
                    <span className="text-[10px] text-gray-400 font-medium">Optional</span>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={selectedRepo}
                      onChange={(e) => handleRepoUrlChange(e.target.value)}
                      placeholder="https://github.com/owner/repository"
                      className={`w-full px-4 py-3 rounded-xl bg-[#121622] border text-white text-xs font-mono transition-colors focus:outline-none ${
                        repoUrlError
                          ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                          : 'border-white/10 focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500'
                      }`}
                    />
                    {selectedRepo && (
                      <button
                        type="button"
                        onClick={() => handleRepoUrlChange('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {repoUrlError ? (
                    <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1.5 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{repoUrlError}</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-400">
                      Enter the repository you want to associate with this project.
                    </p>
                  )}
                </div>

                {githubStatus?.configured && githubStatus.repositories.length > 0 && (
                  <div className="pt-3 border-t border-white/5 space-y-2">
                    <label className="block text-[11px] font-semibold text-gray-300">
                      Or select from your authorized GitHub account:
                    </label>
                    <select
                      value={selectedRepo}
                      onChange={(e) => handleRepoUrlChange(e.target.value ? `https://github.com/${e.target.value}` : '')}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#121622] border border-white/10 text-white text-xs font-medium"
                    >
                      <option value="">Choose a repository...</option>
                      {githubStatus.repositories.map((repo) => (
                        <option key={repo.id} value={repo.full_name}>
                          {repo.full_name} ({repo.default_branch})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* GitHub OAuth Status Panel */}
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-black border border-white/20 flex items-center justify-center text-white">
                      <GitFork className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">GitHub OAuth & Private Access</h4>
                      <p className="text-xs text-gray-400">Public repositories work directly; OAuth is required for private repositories</p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase ${
                    githubStatus?.configured ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {githubStatus?.configured ? 'Configured' : 'Unconfigured (Phase 2)'}
                  </span>
                </div>

                {isCheckingGithub ? (
                  <p className="text-xs text-gray-400 animate-pulse">Checking GitHub OAuth configuration...</p>
                ) : (
                  <div className="p-4 rounded-xl bg-white/2 border border-white/5 space-y-2 text-xs text-gray-400">
                    <p className="font-semibold text-gray-300">OAuth Credentials Status</p>
                    <p className="leading-relaxed">
                      {githubStatus?.configured
                        ? 'GitHub OAuth integration is active on the server.'
                        : 'Public GitHub repositories can be analyzed directly without OAuth credentials. Server-side GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET or Personal Access Tokens are only required when accessing private repositories.'}
                    </p>
                    {!githubStatus?.configured && (
                      <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-cyan-400">
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Optional: GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET in backend/.env</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Navigation & Final Create Action */}
              <div className="flex items-center justify-between pt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleFinalSubmit}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-98 text-black font-black text-sm shadow-[0_0_30px_rgba(6,182,212,0.5)] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                        <span>Initializing Workspace...</span>
                      </>
                    ) : (
                      <>
                        <span>CREATE PROJECT & OPEN CANVAS</span>
                        <ArrowRight className="w-4 h-4 stroke-[3px]" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feature Grid directly matching BinaryBombers layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mt-16 text-left">
          <div className="p-6 rounded-2xl bg-white/2 border border-white/5 hover:border-cyan-500/30 transition-all">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-4">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white mb-2">Context Isolation</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Main conversations and technical SideQuest tangents are strictly bounded so you never pollute primary engineering focus.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/2 border border-white/5 hover:border-cyan-500/30 transition-all">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4">
              <GitBranch className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white mb-2">SideQuest Branches</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Branch out freely to evaluate libraries, architecture trade-offs, and prototypes without derailing the main task.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/2 border border-white/5 hover:border-cyan-500/30 transition-all">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-4">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white mb-2">Decision Synthesis</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Return to Mission synthesizes technical findings and injects approved decisions into shared team memory.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-8 relative z-20 text-center text-xs text-gray-500">
        ThreadBack AI Engineering Workspace · Preserving Developer Focus and Context
      </footer>
    </div>
  );
};
