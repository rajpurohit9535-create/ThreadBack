import React, { useState } from 'react';
import { X, Search, GitBranch, Shapes, ChevronRight, Plus, CheckCircle, ExternalLink } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { useToast } from '../Toast';

export const GeneratedNodesDrawer: React.FC = () => {
  const { showToast } = useToast();
  const {
    nodes,
    selectedNodeId,
    selectNode,
    isNodesDrawerOpen,
    toggleNodesDrawer,
    createBranchNode,
    toggleChatDrawer,
    currentProject,
  } = useCanvasStore();

  const [filterQuery, setFilterQuery] = useState('');

  if (!isNodesDrawerOpen) return null;

  const filteredNodes = nodes.filter((n) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      n.query.toLowerCase().includes(q) ||
      (n.answer && n.answer.toLowerCase().includes(q)) ||
      (n.authorName && n.authorName.toLowerCase().includes(q))
    );
  });

  return (
    <aside
      className="fixed top-14 left-0 h-[calc(100vh-3.5rem)] w-84 md:w-96 bg-white shadow-2xl border-r border-slate-200 z-40 flex flex-col justify-between p-5 text-slate-800 animate-in slide-in-from-left duration-200 select-none"
      data-purpose="nodes-explorer-sidebar"
    >
      <div className="flex flex-col gap-4 min-h-0 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Shapes className="w-4 h-4" />
            </div>
            <span className="font-sans text-sm font-bold text-slate-900">Generated Nodes</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
              {nodes.length} Active
            </span>
          </div>

          <button
            onClick={toggleNodesDrawer}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            title="Close Panel (⌘1)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filter nodes, RFCs, services..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-sans text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Nodes List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs select-text">
          {filteredNodes.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Shapes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-medium text-xs text-slate-500">No matching nodes</p>
              <p className="text-[11px] text-slate-400">
                {nodes.length === 0
                  ? 'Create your first Mission Anchor to generate nodes.'
                  : 'Try a different search term.'}
              </p>
            </div>
          ) : (
            filteredNodes.map((node, idx) => {
              const isSelected = selectedNodeId === node.id;
              const isRoot = !node.parentId || node.conversationType === 'main';
              const rfcTag = isRoot ? 'ROOT-MISSION' : `RFC-${100 + idx}`;
              const author = node.authorName || (isRoot ? 'Mission Anchor' : 'SideQuest');

              return (
                <div
                  key={node.id}
                  onClick={() => selectNode(node.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/40 shadow-sm ring-1 ring-blue-300'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                          isRoot ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {rfcTag}
                      </span>
                      <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                        {author}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      {node.status === 'done' ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Ready
                        </span>
                      ) : (
                        node.status
                      )}
                    </span>
                  </div>

                  <h5 className="font-bold text-slate-900 text-sm tracking-tight mb-1">
                    {node.query}
                  </h5>

                  {node.answer && (
                    <p className="text-slate-500 text-xs leading-relaxed line-clamp-2">
                      {node.answer.replace(/[#*`]/g, '')}
                    </p>
                  )}

                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between font-mono text-[11px] text-slate-500">
                    <span className="truncate max-w-[150px]">
                      {isRoot ? 'Branch: main' : `Parent: ${node.parentId?.slice(0, 8)}...`}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        selectNode(node.id);
                        toggleChatDrawer();
                      }}
                      className="text-blue-600 font-medium hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>Open Thread</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
        <span>Auto-synced with Git</span>
        <span className="font-mono text-emerald-600 font-medium flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{currentProject?.githubRepo ? 'Connected to GitHub' : 'Local Persistence'}</span>
        </span>
      </div>
    </aside>
  );
};
