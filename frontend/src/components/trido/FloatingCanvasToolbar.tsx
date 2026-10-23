import React, { useState } from 'react';
import { 
  MousePointer, 
  PenTool, 
  Square, 
  Type, 
  Image as ImageIcon, 
  MoreHorizontal,
  GitBranch,
  Sparkles
} from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { useToast } from '../Toast';

export const FloatingCanvasToolbar: React.FC = () => {
  const [activeTool, setActiveTool] = useState<'select' | 'pen' | 'box' | 'text' | 'image'>('select');
  const { showToast } = useToast();
  const { createBranchNode, selectedNodeId } = useCanvasStore();

  const handleToolClick = (tool: typeof activeTool) => {
    setActiveTool(tool);
    if (tool === 'box') {
      createBranchNode('New SideQuest Inquiry', selectedNodeId);
      showToast('Created new branch node on board', 'success');
      setActiveTool('select');
    }
  };

  return (
    <div className="absolute left-6 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center bg-white border border-slate-200/90 rounded-2xl shadow-lg p-1.5 space-y-1 select-none">
      {/* 1. Selection Pointer (Active styled like Trido with blue background circle) */}
      <button
        onClick={() => handleToolClick('select')}
        className={`p-2.5 rounded-xl transition-all cursor-pointer ${
          activeTool === 'select'
            ? 'bg-[#1859c9] text-white shadow-xs'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
        }`}
        title="Select & Move Nodes"
      >
        <MousePointer className="w-4 h-4" />
      </button>

      {/* 2. Pen / Connect Tool */}
      <button
        onClick={() => handleToolClick('pen')}
        className={`p-2.5 rounded-xl transition-all cursor-pointer ${
          activeTool === 'pen'
            ? 'bg-[#1859c9] text-white'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
        }`}
        title="Connect Nodes"
      >
        <PenTool className="w-4 h-4" />
      </button>

      {/* 3. Box / Add Node Tool */}
      <button
        onClick={() => handleToolClick('box')}
        className={`p-2.5 rounded-xl transition-all cursor-pointer ${
          activeTool === 'box'
            ? 'bg-[#1859c9] text-white'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
        }`}
        title="Add SideQuest Node"
      >
        <Square className="w-4 h-4" />
      </button>

      {/* 4. Text Tool */}
      <button
        onClick={() => handleToolClick('text')}
        className={`p-2.5 rounded-xl transition-all cursor-pointer ${
          activeTool === 'text'
            ? 'bg-[#1859c9] text-white'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
        }`}
        title="Add Text"
      >
        <Type className="w-4 h-4" />
      </button>

      {/* 5. Image Tool */}
      <button
        onClick={() => handleToolClick('image')}
        className={`p-2.5 rounded-xl transition-all cursor-pointer ${
          activeTool === 'image'
            ? 'bg-[#1859c9] text-white'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
        }`}
        title="Attachments"
      >
        <ImageIcon className="w-4 h-4" />
      </button>

      <div className="w-4 h-px bg-slate-200 my-0.5"></div>

      {/* 6. More Options */}
      <button
        onClick={() => showToast('More canvas options available', 'info')}
        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
        title="More Options"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
    </div>
  );
};
