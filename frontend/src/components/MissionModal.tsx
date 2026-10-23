import React, { useState, useEffect } from 'react';
import { X, Plus, ShieldCheck, Target, FolderGit2, Users, GitBranch, Sparkles, Mail, CheckCircle2 } from 'lucide-react';
import { Mission } from '../types';
import { useToast } from './Toast';
import { useCanvasStore } from '../store/canvasStore';

interface MissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveMission: (mission: Mission) => void;
  missionToEdit?: Mission | null;
}

export const MissionModal: React.FC<MissionModalProps> = ({
  isOpen,
  onClose,
  onSaveMission,
  missionToEdit,
}) => {
  const { showToast } = useToast();
  const { currentTeam, userTeams, inviteMember } = useCanvasStore();

  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [constraints, setConstraints] = useState<string[]>([]);
  const [newConstraint, setNewConstraint] = useState('');
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [newStep, setNewStep] = useState('');
  const [currentBlocker, setCurrentBlocker] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [inviteTeammateEmail, setInviteTeammateEmail] = useState('');
  const [errors, setErrors] = useState<{ title?: string; objective?: string }>({});

  useEffect(() => {
    setSelectedTeamId(currentTeam?.id || '');
    if (missionToEdit) {
      setTitle(missionToEdit.title);
      setObjective(missionToEdit.objective);
      setSelectedTeamId(missionToEdit.teamId || '');
      setConstraints(missionToEdit.constraints || []);
      setCompletedSteps(missionToEdit.completedSteps || []);
      setCurrentBlocker(missionToEdit.currentBlocker || '');
      setNextAction(missionToEdit.nextAction || '');
    } else {
      // Empty fresh defaults - NO sample content injection
      setTitle('');
      setObjective('');
      setConstraints([]);
      setCompletedSteps([]);
      setCurrentBlocker('');
      setNextAction('');
      setInviteTeammateEmail('');
    }
    setErrors({});
  }, [missionToEdit, isOpen, currentTeam]);

  if (!isOpen) return null;

  const handleAddConstraint = () => {
    if (newConstraint.trim()) {
      setConstraints([...constraints, newConstraint.trim()]);
      setNewConstraint('');
    }
  };

  const handleRemoveConstraint = (index: number) => {
    setConstraints(constraints.filter((_, i) => i !== index));
  };

  const handleAddStep = () => {
    if (newStep.trim()) {
      setCompletedSteps([...completedSteps, newStep.trim()]);
      setNewStep('');
    }
  };

  const handleRemoveStep = (index: number) => {
    setCompletedSteps(completedSteps.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: typeof errors = {};
    if (!title.trim()) newErrors.title = 'Project / Mission title is required';
    if (!objective.trim()) newErrors.objective = 'Main objective / description is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const mission: Mission = {
      id: missionToEdit ? missionToEdit.id : `mission-${Date.now()}`,
      title: title.trim(),
      objective: objective.trim(),
      constraints,
      completedSteps,
      decisions: missionToEdit ? missionToEdit.decisions : [],
      currentBlocker: currentBlocker.trim(),
      nextAction: nextAction.trim() || 'Formulate inquiry or begin SideQuest exploration',
      teamId: selectedTeamId || null,
      visibility: selectedTeamId ? 'team' : 'personal',
      createdAt: missionToEdit ? missionToEdit.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
    };

    // If an email was provided to invite to the team, trigger mock invite
    if (selectedTeamId && inviteTeammateEmail.trim()) {
      try {
        await inviteMember('member', inviteTeammateEmail.trim());
        showToast(`Simulated invite created for ${inviteTeammateEmail.trim()}`, 'info');
      } catch {
        // Continue mission creation
      }
    }

    onSaveMission(mission);
    showToast(missionToEdit ? 'Project specification updated!' : 'Project created successfully!', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl max-h-[92vh] bg-[#0e1118] rounded-3xl shadow-2xl border border-slate-800 flex flex-col overflow-hidden text-slate-100 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-br from-[#121622] to-[#181d2c] border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                {missionToEdit ? 'Edit Project Specification' : 'Create New Project Mission'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Define the anchor mission context for technical explorations and SideQuests.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {/* Workspace Destination */}
          <div>
            <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Workspace / Scope</span>
            </label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full p-2.5 bg-[#161a23] border border-slate-700/80 rounded-xl outline-hidden focus:border-indigo-500 text-white font-medium"
            >
              <option value="">Personal Workspace (Private to you)</option>
              {userTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  Team: {t.name} (Shared with verified members)
                </option>
              ))}
            </select>
          </div>

          {/* Project Title */}
          <div>
            <label className="block font-bold text-slate-300 mb-1">
              Project Name / Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Distributed Auth Gateway"
              className={`w-full p-2.5 bg-[#161a23] border rounded-xl outline-hidden transition-all text-white placeholder-slate-500 ${
                errors.title
                  ? 'border-rose-500 focus:border-rose-500'
                  : 'border-slate-700/80 focus:border-indigo-500'
              }`}
            />
            {errors.title && <p className="text-[11px] text-rose-400 mt-1">{errors.title}</p>}
          </div>

          {/* Main Objective */}
          <div>
            <label className="block font-bold text-slate-300 mb-1">
              Main Objective / Description *
            </label>
            <textarea
              rows={2}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. Architect an asynchronous event pipeline with context isolation and idempotent consumers."
              className={`w-full p-2.5 bg-[#161a23] border rounded-xl outline-hidden resize-none transition-all text-white placeholder-slate-500 ${
                errors.objective
                  ? 'border-rose-500 focus:border-rose-500'
                  : 'border-slate-700/80 focus:border-indigo-500'
              }`}
            />
            {errors.objective && (
              <p className="text-[11px] text-rose-400 mt-1">{errors.objective}</p>
            )}
          </div>

          {/* Optional: Add Teammate by Email during creation */}
          {selectedTeamId && (
            <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800">
              <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-indigo-400" />
                <span>Invite Teammate to Team (Optional)</span>
              </label>
              <input
                type="email"
                value={inviteTeammateEmail}
                onChange={(e) => setInviteTeammateEmail(e.target.value)}
                placeholder="colleague@team.com"
                className="w-full p-2 bg-[#161a23] border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 outline-hidden font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Simulated mock delivery: generates an invitation record. No real emails are sent.
              </p>
            </div>
          )}

          {/* Preserved Constraints */}
          <div>
            <label className="block font-bold text-slate-300 mb-1">
              Preserved Architecture Constraints (Optional)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newConstraint}
                onChange={(e) => setNewConstraint(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddConstraint();
                  }
                }}
                placeholder="e.g. Strict context isolation, Keep latency under 50ms"
                className="flex-1 p-2 bg-[#161a23] border border-slate-700/80 rounded-xl outline-hidden text-white placeholder-slate-500 focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddConstraint}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl cursor-pointer"
              >
                Add
              </button>
            </div>
            {constraints.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {constraints.map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-950/50 text-indigo-300 border border-indigo-800/60 rounded-lg text-[11px] font-medium"
                  >
                    <ShieldCheck className="w-3 h-3 text-indigo-400" />
                    <span>{c}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveConstraint(i)}
                      className="hover:text-rose-400 ml-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* GitHub Connection Info */}
          <div className="p-3 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 flex items-center justify-between text-slate-400">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-slate-500" />
              <div>
                <p className="font-semibold text-slate-300 text-xs">GitHub Repository Connection</p>
                <p className="text-[10px] text-slate-500">Planned for Phase 2 — No fake connections will be created.</p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full">
              Phase 2
            </span>
          </div>

          {/* Modal Actions */}
          <div className="p-4 bg-[#121622] border-t border-slate-800/80 flex items-center justify-end gap-2 mt-4 -mx-6 -mb-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
            >
              {missionToEdit ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
