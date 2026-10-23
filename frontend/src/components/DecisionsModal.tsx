import React, { useState } from 'react';
import { X, CheckCircle, Shield, Plus, Trash2, Calendar, User, Sparkles } from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';
import { useToast } from './Toast';

export const DecisionsModal: React.FC = () => {
  const {
    isDecisionsModalOpen,
    closeDecisionsModal,
    sharedDecisions,
    addSharedDecision,
    deleteSharedDecision,
    mission,
    currentUser,
  } = useCanvasStore();

  const { showToast } = useToast();
  const [newDecision, setNewDecision] = useState('');
  const [category, setCategory] = useState<'decision' | 'learning' | 'blocker' | 'next_step'>('decision');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isDecisionsModalOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDecision.trim()) return;

    if (!mission?.id) {
      showToast('Please create or select an active project first.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await addSharedDecision(newDecision.trim(), category);
      showToast('Decision approved into team memory!', 'success');
      setNewDecision('');
    } catch {
      // Handled
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Remove this decision from shared memory?')) {
      await deleteSharedDecision(id);
      showToast('Decision removed.', 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 bg-gradient-to-br from-violet-950 to-indigo-900 text-white relative shrink-0">
          <button
            onClick={closeDecisionsModal}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-8 h-8 rounded-xl bg-violet-500/30 border border-violet-400/40 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-violet-300" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-violet-300">
              Team Context Guard
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            Approved Mission Decisions & Memory
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Only explicitly approved decisions enter team memory and Main AI prompt. Private chats remain isolated.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {/* Add Decision Form */}
          <form onSubmit={handleAdd} className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-3">
            <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Approve New Decision / Finding</span>
            </h4>
            <textarea
              required
              rows={2}
              placeholder="e.g. Use PostgreSQL connection pool size of 20 with 5s timeout."
              value={newDecision}
              onChange={(e) => setNewDecision(e.target.value)}
              className="w-full p-3 rounded-xl bg-white border border-indigo-200 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 outline-hidden resize-none"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-600">Category:</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-hidden"
                >
                  <option value="decision">Decision</option>
                  <option value="learning">Technical Learning</option>
                  <option value="blocker">Blocker</option>
                  <option value="next_step">Next Step</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !newDecision.trim()}
                className="py-1.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold text-xs shadow-sm shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Approve into Memory</span>
              </button>
            </div>
          </form>

          {/* Decisions List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Current Approved Decisions ({sharedDecisions.length})
              </span>
              <span className="text-[10px] text-slate-400">
                Mission: {mission?.title}
              </span>
            </div>

            {sharedDecisions.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No decisions approved yet. Use <strong>Return to Mission</strong> or the form above to record key findings.
              </div>
            ) : (
              <div className="space-y-2">
                {sharedDecisions.map((d) => (
                  <div
                    key={d.id}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all space-y-2 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900 leading-relaxed">
                        {d.decision}
                      </p>
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded-md transition-colors cursor-pointer shrink-0"
                        title="Remove decision"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold uppercase tracking-wider">
                        {d.category}
                      </span>
                      <span className="flex items-center gap-1 font-medium text-slate-600">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{d.contributorName}</span>
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(d.createdAt).toLocaleDateString()}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
