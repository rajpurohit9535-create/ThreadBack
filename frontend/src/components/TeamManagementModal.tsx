import React, { useState } from 'react';
import {
  X,
  Users,
  UserPlus,
  Shield,
  Copy,
  Check,
  Trash2,
  LogOut,
  FolderPlus,
  Mail,
  Link as LinkIcon,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';
import { useToast } from './Toast';

export const TeamManagementModal: React.FC = () => {
  const {
    isTeamModalOpen,
    teamModalTab,
    closeTeamModal,
    openTeamModal,
    currentTeam,
    teamMembers,
    teamInvitations,
    createTeam,
    inviteMember,
    leaveTeam,
    removeMember,
    currentUser,
    switchTeam,
    userTeams,
  } = useCanvasStore();

  const { showToast } = useToast();

  const [newTeamName, setNewTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isTeamModalOpen) return null;

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setIsSubmitting(true);
    try {
      await createTeam(newTeamName.trim());
      showToast(`Team "${newTeamName}" created!`, 'success');
      setNewTeamName('');
    } catch {
      // Handled
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const url = await inviteMember(inviteRole, inviteEmail.trim() || undefined);
      setGeneratedLink(url);
      setInviteEmail('');
      showToast('Invite link generated!', 'success');
    } catch {
      // Handled
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast('Copied invite link to clipboard!', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveTeam = async () => {
    if (confirm('Are you sure you want to leave this team?')) {
      await leaveTeam();
      showToast('You have left the team.', 'info');
      closeTeamModal();
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    if (confirm(`Remove ${name} from this team?`)) {
      await removeMember(userId);
      showToast(`${name} was removed from the team.`, 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#0e1118] w-full max-w-lg rounded-3xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[85vh] text-slate-100 select-none">
        {/* Header */}
        <div className="p-6 bg-gradient-to-br from-[#121622] to-[#181d2c] border-b border-slate-800/80 text-white relative shrink-0">
          <button
            onClick={closeTeamModal}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono">
              Workspace Collaboration
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            {currentTeam ? currentTeam.name : 'Team & Workspaces'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {currentTeam
              ? `${teamMembers.length} active member${teamMembers.length === 1 ? '' : 's'} sharing missions & decisions`
              : 'Switch to a shared workspace or create a new team'}
          </p>

          {/* Navigation Tabs */}
          <div className="flex bg-slate-900/90 border border-slate-800 p-1 rounded-xl mt-5 gap-1">
            <button
              onClick={() => openTeamModal('members')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                teamModalTab === 'members'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Members ({teamMembers.length})</span>
            </button>
            <button
              onClick={() => openTeamModal('invite')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                teamModalTab === 'invite'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Invite Teammate</span>
            </button>
            <button
              onClick={() => openTeamModal('create')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                teamModalTab === 'create'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>New Team</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* 1. MEMBERS TAB */}
          {teamModalTab === 'members' && (
            <div className="space-y-4">
              {!currentTeam ? (
                <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-900/60 text-indigo-300 text-xs">
                  <p className="font-bold mb-1">Currently in Personal Workspace</p>
                  <p className="text-slate-400">
                    Your personal missions and private conversations remain strictly isolated. Teammates cannot view your personal workspace.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {teamMembers.map((m) => {
                    const isSelf = currentUser?.id === m.userId;
                    const myRole = teamMembers.find((mem) => mem.userId === currentUser?.id)?.role;
                    const canRemove = !isSelf && (myRole === 'owner' || (myRole === 'admin' && m.role === 'member'));

                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-[#161a23] border border-slate-800 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                            {m.userName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                              <span>{m.userName}</span>
                              {isSelf && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-bold">
                                  You
                                </span>
                              )}
                            </h4>
                            <p className="text-[10px] text-slate-400 font-mono truncate">{m.userEmail}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                              m.role === 'owner'
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : m.role === 'admin'
                                ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {m.role}
                          </span>

                          {canRemove && (
                            <button
                              onClick={() => handleRemoveMember(m.userId, m.userName)}
                              title="Remove member"
                              className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Workspace Switcher */}
              <div className="pt-4 border-t border-slate-800/80 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                  Switch Active Workspace
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => switchTeam(null)}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                      !currentTeam
                        ? 'border-indigo-500 bg-indigo-500/15 text-indigo-200 font-bold'
                        : 'border-slate-800 bg-[#161a23] hover:bg-slate-800/80 text-slate-300'
                    }`}
                  >
                    <p className="text-xs">Personal Workspace</p>
                    <p className="text-[10px] text-slate-500">Private to you only</p>
                  </button>

                  {userTeams.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => switchTeam(t.id)}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all truncate ${
                        currentTeam?.id === t.id
                          ? 'border-indigo-500 bg-indigo-500/15 text-indigo-200 font-bold'
                          : 'border-slate-800 bg-[#161a23] hover:bg-slate-800/80 text-slate-300'
                      }`}
                    >
                      <p className="text-xs truncate">{t.name}</p>
                      <p className="text-[10px] text-slate-500">{t.memberCount || 1} members</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Leave Team Button */}
              {currentTeam && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleLeaveTeam}
                    className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 py-1.5 px-3 rounded-xl hover:bg-red-950/20 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Leave Team</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2. INVITE TAB */}
          {teamModalTab === 'invite' && (
            <div className="space-y-4">
              {!currentTeam ? (
                <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs">
                  Please select or create a team before inviting teammates.
                </div>
              ) : (
                <>
                  <form onSubmit={handleGenerateInvite} className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Invite Member by Email (Optional)
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                        <input
                          type="email"
                          placeholder="teammate@company.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#161a23] border border-slate-700/80 focus:border-indigo-500 text-xs text-white placeholder-slate-500 outline-hidden font-mono"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Simulated Delivery: Invitations stay pending until accepted by registering or signing into that mock account.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Role</label>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#161a23] border border-slate-700/80 text-xs text-white outline-hidden focus:border-indigo-500"
                      >
                        <option value="member">Member (Can view, chat, and propose decisions)</option>
                        <option value="admin">Admin (Can manage invites and members)</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-98 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <LinkIcon className="w-4 h-4" />
                      <span>Generate Secure Invite Link</span>
                    </button>
                  </form>

                  {/* Generated Link Display */}
                  {generatedLink && (
                    <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 space-y-2 text-emerald-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block font-mono">
                        Share this link with your teammate:
                      </span>
                      <div className="flex items-center gap-2 bg-[#161a23] p-2 rounded-xl border border-emerald-700/60">
                        <input
                          type="text"
                          readOnly
                          value={generatedLink}
                          className="flex-1 text-xs text-emerald-300 font-mono outline-hidden select-all bg-transparent"
                        />
                        <button
                          onClick={() => copyToClipboard(generatedLink)}
                          className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors"
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-emerald-400">
                        Anyone with this link can join <strong>{currentTeam.name}</strong>. Valid for 7 days.
                      </p>
                    </div>
                  )}

                  {/* Pending Invitations */}
                  {teamInvitations.length > 0 && (
                    <div className="pt-3 border-t border-slate-800/80 space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                        Pending Invitations ({teamInvitations.length})
                      </span>
                      <div className="space-y-1.5">
                        {teamInvitations.map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-[#161a23] border border-slate-800 text-xs"
                          >
                            <div>
                              <p className="font-semibold text-white">
                                {inv.email || 'Direct Invite Link'}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                                <span>Role: {inv.role}</span>
                                <span className="inline-flex items-center gap-1 text-amber-400">
                                  <Clock className="w-2.5 h-2.5" />
                                  Pending
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => copyToClipboard(`${window.location.origin}?invite=${inv.token}`)}
                              className="p-1.5 text-indigo-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Copy invite link"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 3. CREATE TEAM TAB */}
          {teamModalTab === 'create' && (
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Team Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Core Architecture Team"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#161a23] border border-slate-700/80 focus:border-indigo-500 text-xs text-white placeholder-slate-500 outline-hidden"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-400 text-xs space-y-1.5">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Team Workspace Rules</span>
                </p>
                <p>• You become the <strong>Owner</strong> of the team.</p>
                <p>• Missions created in this team are shared only with verified members.</p>
                <p>• Teammates can view shared SideQuests and contribute approved decisions.</p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !newTeamName.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-98 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <FolderPlus className="w-4 h-4" />
                <span>Create Team & Workspace</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
