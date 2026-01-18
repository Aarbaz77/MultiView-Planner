import React from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface CanvasToolbarProps {
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  theme: 'dark' | 'light';
}

const CanvasToolbar: React.FC<CanvasToolbarProps> = ({ zoom, setZoom, theme }) => {
  const isDark = theme === 'dark';
  
  return (
    <div className={`absolute top-4 right-4 flex gap-2 backdrop-blur p-2 rounded-lg border shadow-xl z-30 transition-colors duration-300 ${isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-white/90 border-slate-200'}`} onMouseDown={e => e.stopPropagation()}>
      <button 
        onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} 
        className={`p-2 rounded transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-600'}`}
      >
        <ZoomOut size={18} />
      </button>
      <div className={`px-2 flex items-center text-xs font-mono w-12 justify-center select-none transition-colors ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
        {Math.round(zoom * 100)}%
      </div>
      <button 
        onClick={() => setZoom(z => Math.min(3, z + 0.1))} 
        className={`p-2 rounded transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-600'}`}
      >
        <ZoomIn size={18} />
      </button>
    </div>
  );
};

export default CanvasToolbar;