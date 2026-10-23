import React, { useState, useRef } from 'react';
import { 
  Plus, 
  Mic, 
  ArrowUp, 
  RotateCcw, 
  RotateCw, 
  Trash2, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Sparkles,
  GitBranch,
  Quote,
  X,
  Bot
} from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { useToast } from '../Toast';

export const TridoBottomBar: React.FC = () => {
  const { showToast } = useToast();
  const [input, setInput] = useState('');
  const [zoomLevel, setZoomLevel] = useState(100);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { 
    nodes, 
    selectedNodeId, 
    mainConversation,
    contextSnippet, 
    setContextSnippet, 
    createBranchNode, 
    sendMessage,
    openMissionModal,
    openRecovery,
    toggleChatDrawer 
  } = useCanvasStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];
  const isRoot = !selectedNode?.parentId || selectedNode?.id === mainConversation?.id || selectedNode?.conversationType === 'main';
  const isGenerating = nodes.some((n) => n.status === 'loading');

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isGenerating) return;

    if (!selectedNode) {
      openMissionModal();
      return;
    }

    const query = input.trim();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    if (contextSnippet) {
      // If quoting text, spawn branch from quote
      await createBranchNode(query, selectedNode.id, contextSnippet);
      showToast('Spawned SideQuest from quote!', 'success');
    } else {
      // Send message to the selected conversation (Main AI or SideQuest AI)
      await sendMessage(selectedNode.id, query);
    }
    toggleChatDrawer(true);
  };

  const handleSpawnSideQuest = async () => {
    if (!selectedNode) {
      openMissionModal();
      return;
    }
    const topic = input.trim() || window.prompt('Enter SideQuest inquiry topic:', 'Clarify technical details');
    if (topic && topic.trim()) {
      setInput('');
      await createBranchNode(topic.trim(), selectedNode?.id);
      showToast('Created new SideQuest branch!', 'success');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleNewMission = () => {
    openMissionModal();
  };

  return (
    <footer className="absolute bottom-5 left-0 right-0 z-30 px-6 flex items-center justify-between select-none pointer-events-none">
      {/* 1. Left: Slide / Board Pill [ 1  + ] */}
      <div className="pointer-events-auto flex items-center gap-1 bg-white border border-slate-200/90 rounded-2xl shadow-md p-1">
        <button 
          onClick={handleNewMission}
          className="w-8 h-8 rounded-xl bg-[#1859c9] text-white flex items-center justify-center font-bold text-xs shadow-xs cursor-pointer"
          title="Create new mission"
        >
          1
        </button>
        <button
          onClick={handleNewMission}
          className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          title="Add new mission thread"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Center: ChatGPT Chat Window + Trido Status Pill */}
      <div className="pointer-events-auto flex flex-col items-center gap-2 max-w-2xl w-full px-2">
        {/* ChatGPT Style Floating Box */}
        <div className="w-full bg-white/95 backdrop-blur-2xl border border-slate-300/80 rounded-3xl shadow-xl p-2.5 transition-all focus-within:border-[#1859c9] focus-within:ring-4 focus-within:ring-[#1859c9]/10">
          {/* Top Status & Context Chips */}
          <div className="flex items-center justify-between px-2 pb-1.5 mb-1 border-b border-slate-100 text-[11px]">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <span className="font-semibold text-slate-700 truncate">
                {isRoot ? 'Main AI Anchor' : `SideQuest: ${selectedNode?.query?.slice(0, 24) || 'Branch'}...`}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 font-mono text-[10px] shrink-0">Gemma</span>
              <span className="text-slate-300">•</span>
              <span className="text-indigo-600 font-medium shrink-0">Context Guard</span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Spawn SideQuest Action Button */}
              <button
                type="button"
                onClick={handleSpawnSideQuest}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-semibold border border-indigo-200 transition-colors cursor-pointer"
                title="Spawn an isolated SideQuest branch"
              >
                <GitBranch className="w-3 h-3 rotate-90" />
                <span>+ SideQuest</span>
              </button>

              {/* Quoting Pill if highlighted */}
              {contextSnippet && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 text-[10px] shrink-0">
                  <Quote className="w-3 h-3 text-violet-500 shrink-0" />
                  <span className="truncate max-w-[120px] italic">"{contextSnippet}"</span>
                  <button
                    onClick={() => setContextSnippet(null)}
                    className="hover:text-violet-900 ml-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ChatGPT Textarea & Actions */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => showToast('Voice inquiry ready', 'info')}
              className="w-8 h-8 rounded-full bg-[#1859c9] text-white flex items-center justify-center hover:bg-blue-700 transition-colors shrink-0 shadow-xs cursor-pointer"
              title="Voice prompt"
            >
              <Mic className="w-4 h-4" />
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isRoot
                  ? 'Ask Main AI anything about this mission...'
                  : `Ask follow-up in "${selectedNode?.query?.slice(0, 26) || 'branch'}..."`
              }
              className="flex-1 bg-transparent border-0 outline-none text-xs text-slate-800 placeholder:text-slate-400 px-2 py-1 resize-none max-h-24 leading-relaxed font-sans"
            />

            <button
              type="submit"
              disabled={!input.trim() || isGenerating}
              className={`w-8 h-8 rounded-2xl flex items-center justify-center text-white transition-all shrink-0 cursor-pointer ${
                input.trim() && !isGenerating
                  ? 'bg-[#1859c9] hover:bg-blue-700 shadow-sm scale-100 active:scale-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed scale-95'
              }`}
              title="Send message"
            >
              {isGenerating ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* 3. Right: Undo/Redo, Zoom Controls, Fullscreen */}
      <div className="pointer-events-auto flex items-center gap-2">
        {/* Undo / Redo / Reset */}
        <div className="flex items-center bg-white border border-slate-200/90 rounded-2xl shadow-md p-1">
          <button
            onClick={() => showToast('Undo action', 'info')}
            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors cursor-pointer"
            title="Undo"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => showToast('Redo action', 'info')}
            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors cursor-pointer"
            title="Redo"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-200 mx-1"></div>
          <button
            onClick={handleNewMission}
            className="p-1.5 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-xl transition-colors cursor-pointer"
            title="New Mission"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls [- 100% +] */}
        <div className="flex items-center bg-white border border-slate-200/90 rounded-2xl shadow-md p-1">
          <button
            onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors cursor-pointer"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-semibold px-2 text-slate-700 min-w-[48px] text-center">
            {zoomLevel}%
          </span>
          <button
            onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors cursor-pointer"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-200 mx-1"></div>
          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
              } else {
                document.exitFullscreen();
              }
            }}
            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors cursor-pointer"
            title="Toggle Fullscreen"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>
    </footer>
  );
};
