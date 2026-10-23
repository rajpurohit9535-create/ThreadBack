import React, { useMemo, useCallback } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  Edge, 
  Node, 
  OnNodesChange, 
  NodeTypes 
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { QNodeCard } from './QNodeCard';
import { useCanvasStore } from '../../store/canvasStore';
import { FloatingCanvasToolbar } from '../trido/FloatingCanvasToolbar';
import { Sparkles, Plus, Layers } from 'lucide-react';

const nodeTypes: NodeTypes = {
  qnode: QNodeCard,
};

export const FlowCanvas: React.FC = () => {
  const { 
    nodes: qNodes, 
    updateNodePosition, 
    selectNode, 
    mission,
    currentProject,
    openMissionModal,
    openProjectSetup 
  } = useCanvasStore();

  const flowNodes: Node[] = useMemo(() => {
    return qNodes.map((n) => ({
      id: n.id,
      type: 'qnode',
      position: n.position,
      data: n as unknown as Record<string, unknown>,
    }));
  }, [qNodes]);

  const flowEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    qNodes.forEach((n) => {
      if (n.parentId) {
        edges.push({
          id: `edge-${n.parentId}-${n.id}`,
          source: n.parentId,
          target: n.id,
          type: 'default',
          animated: n.status === 'loading',
          style: { 
            stroke: n.status === 'loading' ? '#1859c9' : '#cbd5e1', 
            strokeWidth: 2,
          },
        });
      }
    });
    return edges;
  }, [qNodes]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          updateNodePosition(change.id, change.position);
        }
      });
    },
    [updateNodePosition]
  );

  return (
    <div className="w-full h-full p-3 bg-[#f1f3f6] flex flex-col relative select-none">
      {/* The Rounded Canvas Board (Matches exact Trido canvas border and rounded frame) */}
      <div className="w-full h-full rounded-3xl border border-slate-200/90 bg-white shadow-sm overflow-hidden relative">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) => selectNode(node.id)}
          fitView
          fitViewOptions={{ padding: 0.28 }}
          minZoom={0.35}
          maxZoom={1.6}
          defaultEdgeOptions={{
            type: 'default',
          }}
        >
          {/* Trido Styled Grid Dots */}
          <Background gap={28} size={1.25} color="#cbd5e1" />
        </ReactFlow>

        {/* Floating Vertical Toolbar (Inside the board on the left) */}
        <FloatingCanvasToolbar />

        {/* In-Canvas Empty Mission State Overlay */}
        {(!mission || qNodes.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 p-4">
            <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/90 p-8 shadow-xl text-center pointer-events-auto space-y-5 animate-in fade-in zoom-in-95">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto shadow-xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {currentProject ? currentProject.name : 'Canvas Board'}
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  {currentProject?.description ||
                    'Start your first mission thread to initialize the canvas node board, or explore technical tangents using SideQuests.'}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-1">
                <button
                  onClick={openMissionModal}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1859c9] hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Mission Thread</span>
                </button>
                <button
                  onClick={openProjectSetup}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <span>Project Setup Flow</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
