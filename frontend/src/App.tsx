import React, { useEffect } from 'react';
import { ToastProvider } from './components/Toast';
import { TridoNavbar } from './components/trido/TridoNavbar';
import { TridoSidebar } from './components/trido/TridoSidebar';
import { FlowCanvas } from './components/canvas/FlowCanvas';
import { TridoBottomBar } from './components/trido/TridoBottomBar';
import { SideChatDrawer } from './components/SideChatDrawer';
import { RecoveryModal } from './components/RecoveryModal';
import { MissionModal } from './components/MissionModal';
import { AuthModal } from './components/AuthModal';
import { TeamManagementModal } from './components/TeamManagementModal';
import { DecisionsModal } from './components/DecisionsModal';
import { ProjectSetupPage } from './components/binary/ProjectSetupPage';
import { ProjectsModal } from './components/ProjectsModal';
import { GeneratedNodesDrawer } from './components/canvas/GeneratedNodesDrawer';
import { useCanvasStore } from './store/canvasStore';

function ThreadBackBoardApp() {
  const { 
    openRecovery, 
    initializeWorkspace, 
    isLoadingWorkspace, 
    isMissionModalOpen, 
    closeMissionModal,
    createMissionFromModal,
    isProjectSetupOpen,
    isProjectsModalOpen,
    closeProjectsModal,
  } = useCanvasStore();


  useEffect(() => {
    initializeWorkspace();
  }, [initializeWorkspace]);

  return (
    <div className="w-full h-screen bg-[#f1f3f6] flex flex-col font-sans overflow-hidden select-none">
      {/* 1. Trido Styled Top Navbar */}
      <TridoNavbar onOpenRecovery={() => openRecovery()} />

      {/* 2. Main Workspace Body (Sidebar + Board Canvas + Side Drawer) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar (Trido Menu + "+ New Thread" button) */}
        <TridoSidebar />

        {/* Center Board Canvas Area */}
        <main className="flex-1 h-full relative overflow-hidden flex flex-col">
          {isLoadingWorkspace ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#f1f3f6] text-slate-700">
              <span className="w-8 h-8 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></span>
              <p className="text-xs text-slate-500 font-medium">Connecting to ThreadBack Workspace...</p>
            </div>
          ) : (
            <FlowCanvas />
          )}

          {/* Bottom Dock (ChatGPT-style Prompt Window + Trido Controls) */}
          <TridoBottomBar />
        </main>

        {/* Side Chat / Investigation Drawer */}
        <SideChatDrawer />

        {/* Source C Left Explorer Drawer (Generated Nodes) */}
        <GeneratedNodesDrawer />
      </div>

      {/* 3. Signature Context Recovery Modal */}
      <RecoveryModal />

      {/* 4. BinaryBombers 3D Initial Project Setup Page */}
      {isProjectSetupOpen && <ProjectSetupPage />}

      {/* 5. Phase 2 Projects & GitHub Hub Modal */}
      <ProjectsModal
        isOpen={isProjectsModalOpen}
        onClose={closeProjectsModal}
      />

      {/* 6. Mission Creation Modal */}
      <MissionModal
        isOpen={isMissionModalOpen}
        onClose={closeMissionModal}
        onSaveMission={(m) => createMissionFromModal(m.objective, m.title, m.teamId)}
      />

      {/* 7. User Authentication Modal */}
      <AuthModal />

      {/* 8. Multi-User Team Management Modal */}
      <TeamManagementModal />

      {/* 9. Approved Decisions & Memory Modal */}
      <DecisionsModal />
    </div>
  );
}


export default function App() {
  return (
    <ToastProvider>
      <ThreadBackBoardApp />
    </ToastProvider>
  );
}
