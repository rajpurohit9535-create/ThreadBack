import React, { useState } from 'react';
import { 
  Menu, 
  GitBranch, 
  Sparkles, 
  Share2, 
  Users,
  CheckCircle,
  HelpCircle, 
  Bot, 
  ChevronDown,
  LogIn,
  LogOut,
  FolderGit2
} from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { useToast } from '../Toast';
import { DevUserSwitcher } from '../DevUserSwitcher';

interface TridoNavbarProps {
  onOpenRecovery: () => void;
}

export const TridoNavbar: React.FC<TridoNavbarProps> = ({ onOpenRecovery }) => {
  const { showToast } = useToast();
  const {
    toggleSidebar,
    toggleChatDrawer,
    isChatDrawerOpen,
    toggleNodesDrawer,
    isNodesDrawerOpen,
    openProjectsModal,
    nodes,
    mission,
    currentTeam,
    currentUser,
    sharedDecisions,
    teamMembers,
    openTeamModal,
    openDecisionsModal,
    openAuthModal,
    logout,
    currentProject,
    openProjectSetup,
  } = useCanvasStore();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Keyboard Shortcuts: Cmd+1 (Nodes), Cmd+2 (Chat)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault();
        toggleNodesDrawer();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '2') {
        e.preventDefault();
        toggleChatDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleNodesDrawer, toggleChatDrawer]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    showToast('Workspace URL copied to clipboard!', 'info');
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200/80 px-4 flex items-center justify-between select-none shrink-0 z-30">
      {/* Left: Brand, Nodes Explorer Toggle & Project / Team Pills */}
      <div className="flex items-center gap-2.5">
        {/* Hamburger Toggle */}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Toggle Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand Identity with Play Icon angle */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-700 text-white flex items-center justify-center font-bold shadow-xs">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white -rotate-45 -translate-x-[1px]">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <span className="font-extrabold text-sm tracking-tight text-slate-900 hidden sm:inline">
            ThreadBack
          </span>
        </div>

        <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block"></div>

        {/* Generated Nodes Toggle Button (Source C Design) */}
        <button
          onClick={toggleNodesDrawer}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
            isNodesDrawerOpen
              ? 'bg-blue-50 border-blue-300 text-blue-800 ring-1 ring-blue-300'
              : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
          }`}
          title="Toggle Generated Nodes (⌘1)"
        >
          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
          <span className="hidden md:inline">Generated Nodes</span>
          <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 font-mono text-[10px] font-bold">
            {nodes.length}
          </span>
        </button>

        {/* Project Selector & Setup Pill */}
        <button
          onClick={openProjectsModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
          title="Open Projects & GitHub Hub"
        >
          <FolderGit2 className="w-3.5 h-3.5 text-blue-600" />
          <span className="truncate max-w-[130px]">
            {currentProject ? currentProject.name : 'Projects & GitHub'}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>

        {/* Workspace Switcher Pill */}
        <button
          onClick={() => openTeamModal('members')}
          className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-100 bg-indigo-50/70 hover:bg-indigo-100/70 text-indigo-950 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
          title="Switch workspace or manage team members"
        >
          <Users className="w-3.5 h-3.5 text-indigo-600" />
          <span className="truncate max-w-[120px]">
            {currentTeam ? currentTeam.name : 'Personal Workspace'}
          </span>
          {currentTeam && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-200 text-indigo-800">
              {teamMembers.length}
            </span>
          )}
        </button>
      </div>

      {/* Center: Decisions Pill & Context Guard Mode */}
      <div className="hidden lg:flex items-center gap-2">
        <button
          onClick={openDecisionsModal}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-50 hover:bg-violet-100 border border-violet-200 text-xs font-semibold text-violet-800 transition-colors cursor-pointer shadow-2xs"
          title="View approved mission decisions"
        >
          <CheckCircle className="w-3.5 h-3.5 text-violet-600" />
          <span>Decisions ({sharedDecisions.length})</span>
        </button>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50/80 border border-purple-200/80 text-xs font-semibold text-purple-700">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          <span>Mode: Context Guard</span>
        </div>
      </div>

      {/* Right Action Area */}
      <div className="flex items-center gap-2">
        {/* Toggle Chat Panel Button (Source C Design) */}
        <button
          onClick={() => toggleChatDrawer()}
          className={`px-3.5 py-1.5 rounded-full border text-xs font-bold flex items-center gap-1.5 shadow-2xs transition active:scale-95 cursor-pointer ${
            isChatDrawerOpen
              ? 'bg-purple-100 border-purple-300 text-purple-900 ring-2 ring-purple-300'
              : 'bg-purple-50 hover:bg-purple-100/80 border-purple-200 text-purple-700'
          }`}
          title="Toggle Dual-Agent ThreadBack Chat (⌘2)"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          <span className="hidden sm:inline">✦ ThreadBack Chat</span>
        </button>

        {/* Signature Return to Mission Button */}
        <button
          onClick={onOpenRecovery}
          disabled={!mission}
          className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="Synthesize sidequest findings and recover continuation prompt"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
          <span>Return</span>
        </button>

        {/* Developer Mock Account Switcher (Dev Mode Only) */}
        {currentUser && <DevUserSwitcher />}


        {/* User Profile / Auth Button */}
        <div className="relative">
          {currentUser ? (
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full border border-slate-200 hover:border-slate-300 bg-white transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-[#1859c9] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                {currentUser.name.slice(0, 1).toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-slate-800 hidden md:inline truncate max-w-[100px]">
                {currentUser.name}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          ) : (
            <button
              onClick={() => openAuthModal('login')}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}

          {/* User Dropdown */}
          {isUserMenuOpen && currentUser && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 space-y-1 z-50 animate-in fade-in zoom-in-95">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{currentUser.email}</p>
              </div>

              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  openTeamModal('members');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors text-left cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>Team & Workspace Settings</span>
              </button>

              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  logout();
                  showToast('Signed out.', 'info');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 transition-colors text-left cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
