import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { 
  Sparkles, 
  GitBranch, 
  MessageSquare, 
  Trash2, 
  ChevronRight, 
  CheckCircle2, 
  Quote, 
  Layers 
} from 'lucide-react';
import { QNode } from '../../types';
import { useCanvasStore } from '../../store/canvasStore';

export const QNodeCard: React.FC<NodeProps> = ({ id, data, selected }) => {
  const nodeData = data as unknown as QNode;
  const isRoot = !nodeData.parentId || nodeData.id === 'root' || nodeData.conversationType === 'main';
  const { 
    selectedNodeId, 
    selectNode, 
    openRecovery, 
    deleteNode, 
    toggleChatDrawer 
  } = useCanvasStore();

  const isCurrentSelected = selectedNodeId === id;

  const handleReturnToMission = (e: React.MouseEvent) => {
    e.stopPropagation();
    openRecovery(id);
  };

  const handleOpenThread = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(id);
    toggleChatDrawer(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNode(id);
  };

  return (
    <div
      onClick={() => selectNode(id)}
      className={`w-[340px] rounded-2xl bg-white border-2 p-4 transition-all duration-200 select-none shadow-sm relative group cursor-pointer ${
        isCurrentSelected
          ? isRoot
            ? 'border-indigo-600 shadow-indigo-500/20 ring-4 ring-indigo-50 scale-[1.01]'
            : 'border-indigo-600 shadow-indigo-500/20 ring-4 ring-indigo-50 scale-[1.01]'
          : isRoot
          ? 'border-indigo-300 hover:border-indigo-400'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* React Flow Connection Handles */}
      {!isRoot && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-slate-300 !border-2 !border-white hover:!bg-indigo-500 transition-colors"
        />
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white hover:!bg-indigo-700 transition-colors"
      />

      {/* Top Header Pill */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {isRoot ? (
            <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
              Original Mission Root
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              <GitBranch className="w-3 h-3 text-indigo-600 rotate-90" />
              SideQuest Node
            </span>
          )}

          {nodeData.status === 'loading' && (
            <span className="text-[10px] font-semibold text-indigo-600 animate-pulse bg-indigo-50 px-1.5 py-0.2 rounded-full">
              Thinking...
            </span>
          )}
        </div>

        {!isRoot && (
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded transition-opacity"
            title="Delete this branch"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Context Snippet Quote (if spawned from highlighting) */}
      {nodeData.contextSnippet && (
        <div className="mb-2 p-1.5 bg-violet-50/70 border border-violet-200/60 rounded-lg text-[10px] text-violet-800 flex items-start gap-1">
          <Quote className="w-3 h-3 text-violet-500 shrink-0 mt-0.5" />
          <span className="italic line-clamp-1">"{nodeData.contextSnippet}"</span>
        </div>
      )}

      {/* Query Title */}
      <h4 className="text-xs font-bold text-slate-900 leading-snug mb-1.5 line-clamp-2">
        {nodeData.query}
      </h4>

      {/* Answer Preview / Body */}
      <div className="text-[11px] text-slate-600 leading-relaxed line-clamp-3 mb-3 font-sans whitespace-pre-wrap">
        {nodeData.answer || (
          <span className="text-slate-400 italic">Synthesizing response...</span>
        )}
      </div>

      {/* Bottom Action Row */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1">
        {/* Return to Mission Signature Button (On every node!) */}
        <button
          onClick={handleReturnToMission}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-[10px] font-semibold shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title="Return to Mission: Synthesize learnings and copy continuation prompt"
        >
          <Sparkles className="w-3 h-3 text-indigo-200" />
          <span>Return</span>
          <ChevronRight className="w-3 h-3 opacity-75" />
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={handleOpenThread}
            className="flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-indigo-600 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors"
            title="Open full conversation thread"
          >
            <MessageSquare className="w-3 h-3" />
            <span>Thread</span>
          </button>
        </div>
      </div>
    </div>
  );
};
