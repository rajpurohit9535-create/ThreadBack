import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Copy, 
  Check, 
  X, 
  ArrowLeft, 
  CheckCircle2, 
  ShieldCheck, 
  Terminal, 
  BookOpen, 
  Target,
  ArrowRight,
  ListChecks,
  HelpCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useCanvasStore } from '../store/canvasStore';
import { useToast } from './Toast';

export const RecoveryModal: React.FC = () => {
  const { showToast } = useToast();
  const { 
    isRecoveryOpen, 
    isRecoveryLoading,
    closeRecovery, 
    mission, 
    nodes, 
    recoveryNodeId, 
    selectedNodeId,
    currentSummary,
    mainConversation,
    selectNode,
    toggleChatDrawer
  } = useCanvasStore();

  const [copied, setCopied] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');

  const targetNode = nodes.find((n) => n.id === (recoveryNodeId || selectedNodeId)) || nodes[0];

  useEffect(() => {
    if (mission) {
      if (currentSummary) {
        // Structured prompt built from real Gemma synthesis
        const promptLines = [
          `Mission Objective: ${mission.objective}`,
          `Preserved Constraints: ${mission.constraints?.join(', ') || 'Standard best practices'}`,
          '',
          `[RELEVANT SIDEQUEST FINDINGS - ${currentSummary.topic}]`,
          ...(currentSummary.keyLearnings || []).map((l) => `- Learning: ${l}`),
          ...(currentSummary.decisions || []).map((d) => `- Decision: ${d}`),
          ...(currentSummary.usefulExamples || []).map((e) => `- Example/Code: ${e}`),
          ...(currentSummary.unresolvedQuestions || []).map((q) => `- Open Question: ${q}`),
          `Relevance: ${currentSummary.missionRelevance}`,
          '',
          `Next Action: ${mission.nextAction || 'Continue main task implementation'}`,
        ];
        setCustomPrompt(promptLines.join('\n'));
      } else if (targetNode) {
        const prompt = `Mission: ${mission.objective}\nSideQuest: ${targetNode.query}\nTakeaways: ${(targetNode.learningNotes || []).join(', ') || targetNode.answer.slice(0, 200)}\nNext Action: ${mission.nextAction}`;
        setCustomPrompt(prompt);
      }
    }
  }, [mission, targetNode, currentSummary, isRecoveryOpen]);

  if (!isRecoveryOpen || !mission) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(customPrompt).then(() => {
      setCopied(true);
      showToast('Continuation prompt copied to clipboard!', 'success');

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#6366f1', '#a855f7', '#3b82f6', '#10b981'],
      });

      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      showToast('Could not copy automatically.', 'warning');
    });
  };

  const handleResumeMainAi = () => {
    const rootId = mainConversation?.id || 'root';
    selectNode(rootId);
    toggleChatDrawer(true);
    closeRecovery();
    showToast('Resumed Main AI. Your transferred context is ready!', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-3xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient Banner */}
        <div className="relative p-6 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-white/10 text-indigo-300">
                <Sparkles className="w-5 h-5 text-indigo-300 animate-spin [animation-duration:8s]" />
              </span>
              <div>
                <span className="text-[10px] font-bold tracking-widest text-indigo-300 uppercase block">
                  Context Recovery Engine
                </span>
                <h2 className="text-xl font-extrabold tracking-tight">
                  Return to Mission
                </h2>
              </div>
            </div>

            <button
              onClick={closeRecovery}
              className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-indigo-200/80 max-w-xl leading-relaxed">
            Your original mission context is preserved. SideQuest findings from{' '}
            <span className="font-semibold text-white">
              "{currentSummary?.topic || targetNode?.query.slice(0, 45)}..."
            </span>{' '}
            have been structured by Gemma and prepared for seamless continuation.
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Loading Indicator */}
          {isRecoveryLoading && (
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center gap-3 text-indigo-800">
              <span className="w-5 h-5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin shrink-0"></span>
              <span className="text-xs font-semibold">
                Synthesizing structured learning summary with Gemma in real time...
              </span>
            </div>
          )}

          {/* Mission & Constraints Overview Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mission Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                Original Mission
              </span>
              <h4 className="text-sm font-bold text-slate-900 mb-1">
                {mission.title}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                {mission.objective}
              </p>

              <div className="space-y-1.5 pt-2 border-t border-slate-200/60 text-xs">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    <strong>Completed:</strong> {mission.completedSteps?.join(', ') || 'In progress'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-amber-700">
                  <Target className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    <strong>Next Step:</strong> {mission.nextAction || 'Proceed with implementation'}
                  </span>
                </div>
              </div>
            </div>

            {/* Preserved Constraints */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                  Preserved Constraints
                </span>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {mission.constraints?.map((c, i) => (
                    <span
                      key={i}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/60 flex items-center gap-1"
                    >
                      <ShieldCheck className="w-3 h-3 text-indigo-500" />
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {mission.currentBlocker && (
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-200/80 text-[11px] text-amber-800">
                  <span className="font-bold">Prior Blocker: </span>
                  {mission.currentBlocker}
                </div>
              )}
            </div>
          </div>

          {/* Structured Learnings from Return to Mission */}
          {currentSummary && (
            <div className="p-4 rounded-2xl bg-violet-50/90 border border-violet-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-violet-800 font-bold text-xs uppercase tracking-wider">
                  <BookOpen className="w-4 h-4 text-violet-600" />
                  <span>Structured Learning Summary: {currentSummary.topic}</span>
                </div>
                <span className="text-[10px] bg-violet-200/70 text-violet-800 px-2 py-0.5 rounded-full font-semibold">
                  Gemma Synthesized
                </span>
              </div>

              {/* Key Learnings List */}
              {currentSummary.keyLearnings?.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 block">
                    Key Learnings:
                  </span>
                  {currentSummary.keyLearnings.map((k, i) => (
                    <p key={i} className="text-xs text-violet-950 font-medium leading-relaxed">
                      • {k}
                    </p>
                  ))}
                </div>
              )}

              {/* Decisions if any */}
              {currentSummary.decisions?.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 block">
                    Technical Decisions:
                  </span>
                  {currentSummary.decisions.map((d, i) => (
                    <p key={i} className="text-xs text-violet-950 font-medium leading-relaxed">
                      ✓ {d}
                    </p>
                  ))}
                </div>
              )}

              {/* Mission Relevance */}
              {currentSummary.missionRelevance && (
                <div className="p-2.5 rounded-xl bg-white/70 border border-violet-200/70 text-xs text-violet-900 leading-relaxed">
                  <strong>Mission Relevance:</strong> {currentSummary.missionRelevance}
                </div>
              )}
            </div>
          )}

          {/* Continuation Prompt Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Generated Continuation Prompt
                </h4>
              </div>
              <span className="text-[10px] text-slate-400">
                Editable • Ready to paste into Copilot, Claude, or IDE
              </span>
            </div>

            <div className="relative">
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={5}
                className="w-full text-xs font-mono p-3.5 bg-slate-900 text-slate-100 rounded-2xl border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-none selection:bg-indigo-600"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-3">
          <button
            onClick={closeRecovery}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 text-xs font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Keep Exploring</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-md cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Prompt Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Prompt</span>
                </>
              )}
            </button>

            <button
              onClick={handleResumeMainAi}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <span>Resume Main AI</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
