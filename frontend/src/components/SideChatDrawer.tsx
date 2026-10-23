import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  GitBranch, 
  Send, 
  ArrowUp, 
  AlertCircle,
  RefreshCw,
  Plus
} from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';
import { useToast } from './Toast';

export const SideChatDrawer: React.FC = () => {
  const { showToast } = useToast();
  const { 
    nodes, 
    selectedNodeId, 
    mainConversation,
    isChatDrawerOpen, 
    toggleChatDrawer, 
    openRecovery, 
    sendMessage,
    createBranchNode, 
    setContextSnippet,
    messagesByConversation,
    error,
    clearError,
    lastUnsentInput
  } = useCanvasStore();

  const [inputText, setInputText] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];
  const isRoot = !selectedNode?.parentId || selectedNode?.id === mainConversation?.id || selectedNode?.conversationType === 'main';
  const isGenerating = selectedNode?.status === 'loading';
  const messages = (selectedNode ? messagesByConversation[selectedNode.id] : []) || [];

  // Restore unsent text on failure if available
  useEffect(() => {
    if (lastUnsentInput && !inputText) {
      setInputText(lastUnsentInput);
    }
  }, [lastUnsentInput]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  // Handle text selection in answer to branch from quote
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 5) {
      const selected = selection.toString().trim();
      setContextSnippet(selected);
      showToast(`Selected text quote saved for next branch!`, 'info');
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isGenerating) return;

    const text = inputText.trim();
    setInputText('');
    await sendMessage(selectedNode.id, text);
  };

  const handleSpawnChild = async () => {
    const topic = window.prompt('Enter SideQuest topic:', 'Explore technical details');
    if (topic && topic.trim()) {
      await createBranchNode(topic.trim(), selectedNode.id);
      showToast('Created new SideQuest branch!', 'success');
    }
  };

  if (!isChatDrawerOpen || !selectedNode) return null;

  return (
    <aside className="w-80 md:w-96 lg:w-[440px] h-full bg-white/95 backdrop-blur-xl border-l border-slate-200/90 shadow-2xl flex flex-col z-30 select-none animate-in slide-in-from-right duration-200">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
            <GitBranch className="w-4 h-4 rotate-90" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
              {isRoot ? 'Main AI Mission Anchor' : 'SideQuest Thread'}
            </span>
            <h3 className="text-xs font-bold text-slate-900 truncate" title={selectedNode.query}>
              {selectedNode.query}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isRoot && (
            <button
              onClick={() => openRecovery(selectedNode.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[10px] font-semibold shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="Return to Mission"
            >
              <Sparkles className="w-3 h-3 text-indigo-200" />
              <span>Return</span>
            </button>
          )}

          <button
            onClick={handleSpawnChild}
            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
            title="Spawn new SideQuest branch from here"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            onClick={() => toggleChatDrawer(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Source C: Active Workspace Collaborators & Model Badge */}
      <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700 flex items-center gap-1.5 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Decision Intelligence Ready</span>
        </span>
        <div className="flex items-center gap-1 text-[10px] font-mono">
          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">Gemma 4</span>
          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">Active</span>
        </div>
      </div>

      {/* Main Conversation Stream */}
      <div 
        ref={contentRef} 
        onMouseUp={handleMouseUp}
        className="flex-1 overflow-y-auto p-4 space-y-4 text-xs"
      >
        {/* If no messages yet, show introductory hero banner */}
        {messages.length === 0 && (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/70 to-indigo-50/70 border border-purple-200/80 text-slate-700 space-y-3">
            <div className="flex items-center gap-2 text-purple-700 font-bold">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>{isRoot ? 'Main AI Mission Anchor' : 'Isolated SideQuest Explorer'}</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isRoot
                ? 'Ask architectural questions here. Approved decisions and synthesized findings from any SideQuest tangent will safely incorporate into this root mission.'
                : `Investigate "${selectedNode.query}" freely. Your tangential exploration will remain strictly isolated until you click Return to Mission.`}
            </p>

            {/* Suggested Actions */}
            <div className="pt-2 border-t border-purple-100 space-y-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-600 block">
                Suggested Actions
              </span>
              <button
                type="button"
                onClick={() => setInputText('Summarize active RFC node contracts and constraints')}
                className="w-full text-left p-2 rounded-xl bg-white/80 hover:bg-white border border-purple-200/60 transition text-xs font-medium text-slate-700 flex items-center justify-between cursor-pointer"
              >
                <span>Summarize active node contracts</span>
                <span className="text-slate-400 font-mono text-[10px]">⌘1</span>
              </button>
              <button
                type="button"
                onClick={() => setInputText('Inspect architectural diffs and drift risks')}
                className="w-full text-left p-2 rounded-xl bg-white/80 hover:bg-white border border-purple-200/60 transition text-xs font-medium text-slate-700 flex items-center justify-between cursor-pointer"
              >
                <span>Inspect architecture diffs</span>
                <span className="text-slate-400 font-mono text-[10px]">⌘2</span>
              </button>
            </div>
          </div>
        )}

        {/* Render persistent conversation messages */}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400">
                <span>{isUser ? (msg.authorName || 'You') : isRoot ? 'Main AI (Gemma)' : 'SideQuest AI (Gemma)'}</span>
                {msg.createdAt && (
                  <>
                    <span>•</span>
                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </>
                )}
              </div>

              <div
                className={`p-3.5 rounded-2xl max-w-[92%] leading-relaxed shadow-xs whitespace-pre-wrap font-sans ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-tr-xs'
                    : 'bg-slate-50 border border-slate-200/90 text-slate-800 rounded-tl-xs'
                }`}
              >
                {msg.content}
              </div>

              {!isUser && (
                <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-400">
                  <button
                    type="button"
                    onClick={() => showToast('Feedback recorded: useful response', 'info')}
                    className="hover:text-blue-600 cursor-pointer transition-colors"
                    title="Mark helpful"
                  >
                    👍 Helpful
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(msg.content);
                      showToast('Copied message to clipboard', 'info');
                    }}
                    className="hover:text-slate-600 cursor-pointer transition-colors"
                  >
                    Copy
                  </button>
                </div>
              )}
            </div>
          );
        })}


        {/* Live Loading / Thinking Bubble */}
        {isGenerating && (
          <div className="flex flex-col items-start">
            <span className="text-[10px] text-indigo-600 font-semibold mb-1 px-1">
              {isRoot ? 'Main AI is reasoning...' : 'SideQuest AI is synthesizing...'}
            </span>
            <div className="p-3.5 rounded-2xl rounded-tl-xs bg-indigo-50 border border-indigo-200 text-slate-700 flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></span>
              <span className="text-xs text-indigo-900 font-medium">Generating Gemma response...</span>
            </div>
          </div>
        )}

        {/* Preserved Learning Notes */}
        {selectedNode.learningNotes && selectedNode.learningNotes.length > 0 && (
          <div className="p-3 bg-violet-50/80 border border-violet-200 rounded-xl space-y-1 mt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 block">
              Synthesized SideQuest Learnings
            </span>
            {selectedNode.learningNotes.map((note, idx) => (
              <p key={idx} className="text-[11px] text-violet-950 font-medium leading-relaxed">
                • {note}
              </p>
            ))}
          </div>
        )}

        {/* Error Alert with Retry */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start justify-between gap-2 text-rose-700">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <p className="text-xs font-semibold">Request failed</p>
                <p className="text-[11px] text-rose-600 leading-snug">{error}</p>
              </div>
            </div>
            <button
              onClick={() => {
                clearError();
                if (inputText.trim()) handleSend();
              }}
              className="p-1 hover:bg-rose-100 rounded text-rose-700 font-medium text-xs flex items-center gap-1 cursor-pointer"
              title="Retry sending"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div className="p-3 border-t border-slate-200/80 bg-white">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isGenerating}
            placeholder={
              isRoot
                ? 'Send message to Main AI...'
                : `Ask question in "${selectedNode.query.slice(0, 24)}..."`
            }
            className="flex-1 text-xs p-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white text-slate-800"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isGenerating}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-all cursor-pointer shadow-xs"
            title="Send message"
          >
            {isGenerating ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <ArrowUp className="w-4 h-4" />
            )}
          </button>
        </form>
        <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] text-slate-400">
          <span>{isRoot ? 'Main AI conversation' : 'Independent SideQuest history'}</span>
          <span>SQLite persisted</span>
        </div>
      </div>
    </aside>
  );
};
