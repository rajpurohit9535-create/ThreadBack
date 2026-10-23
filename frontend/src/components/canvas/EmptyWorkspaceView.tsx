import React from 'react';
import { 
  Sparkles, 
  Plus, 
  GitBranch, 
  ShieldCheck, 
  FolderGit2, 
  Layers, 
  LogIn, 
  Users 
} from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';

export const EmptyWorkspaceView: React.FC = () => {
  const { openMissionModal, openAuthModal, currentUser, currentTeam } = useCanvasStore();

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[#090c14] text-slate-100 overflow-y-auto select-none relative">
      {/* Background ambient glow inspired by BinaryBombers */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-2xl w-full flex flex-col items-center text-center space-y-6 relative z-10">
        {/* Glowing Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-mono font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>ThreadBack Context Workspace</span>
        </div>

        {/* Oversized Heading */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
          No projects yet in this{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400">
            {currentTeam ? currentTeam.name : 'workspace'}
          </span>
        </h1>

        {/* Description */}
        <p className="text-sm md:text-base text-slate-400 max-w-xl">
          Explore technical tangents without losing your core focus. SideQuests keep your context safe, isolated, and synthesizable back to the mission root.
        </p>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={openMissionModal}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-98 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Project</span>
          </button>

          {!currentUser && (
            <button
              onClick={() => openAuthModal('login')}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-200 font-semibold text-sm transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In / Register</span>
            </button>
          )}
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full pt-8 text-left">
          <div className="p-4 rounded-2xl bg-[#121622]/80 border border-slate-800/80 hover:border-slate-700 transition-colors">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-2.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white mb-1">Context Isolation</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Main conversations and technical tangents are strictly bounded so you never pollute team focus.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#121622]/80 border border-slate-800/80 hover:border-slate-700 transition-colors">
            <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 mb-2.5">
              <GitBranch className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white mb-1">SideQuest Branches</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Investigate libraries, bugs, or tradeoffs in separate threads, then synthesize findings back in one click.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#121622]/80 border border-slate-800/80 hover:border-slate-700 transition-colors">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-2.5">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white mb-1">Approved Decisions</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Only explicitly approved decisions enter shared mission memory with full contributor attribution.
            </p>
          </div>
        </div>

        {/* GitHub Integration Notice */}
        <div className="w-full p-3 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 flex items-center justify-between text-left">
          <div className="flex items-center gap-2.5">
            <FolderGit2 className="w-4 h-4 text-slate-500" />
            <div>
              <p className="text-xs font-semibold text-slate-300">GitHub Repository Integration</p>
              <p className="text-[10px] text-slate-500">Planned for Phase 2 — Real Git branch alignment and pull-request monitoring.</p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700">
            Phase 2
          </span>
        </div>
      </div>
    </div>
  );
};
