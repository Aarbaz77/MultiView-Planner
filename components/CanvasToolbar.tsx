import React, { useState } from 'react';
import { ZoomIn, ZoomOut, Layers } from 'lucide-react';

interface CanvasToolbarProps {
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  onFit: () => void;
  theme: 'dark' | 'light';
  transparencyEnabled: boolean;
  onToggleTransparency: () => void;
  globalOpacity: number;
  onOpacityChange: (value: number) => void;
}

const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  zoom, setZoom, onFit, theme, transparencyEnabled, onToggleTransparency, globalOpacity, onOpacityChange
}) => {
  const isDark = theme === 'dark';
  const [showLayers, setShowLayers] = useState(false);
  const buttonClass = `p-2 rounded transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-600'}`;

  return (
    <div className="absolute top-3 right-3 md:top-4 md:right-4 z-30" onPointerDown={e => e.stopPropagation()}>
      <div className={`flex gap-1 md:gap-2 backdrop-blur p-1 md:p-2 rounded-lg border shadow-xl transition-colors duration-300 ${isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-white/90 border-slate-200'}`}>
        <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className={buttonClass} title="Zoom out">
          <ZoomOut size={18} />
        </button>
        <button
          onClick={onFit}
          className={`px-1 md:px-2 flex items-center text-xs font-mono w-11 md:w-12 justify-center select-none rounded transition-colors ${isDark ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-800 hover:bg-slate-100'}`}
          title="Fit everything in view"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className={buttonClass} title="Zoom in">
          <ZoomIn size={18} />
        </button>
        <button
          onClick={() => setShowLayers(s => !s)}
          className={`${buttonClass} ${showLayers ? (isDark ? 'bg-slate-700' : 'bg-slate-100') : ''}`}
          title="Transparency"
        >
          <Layers size={18} />
        </button>
      </div>

      {/* Transparency lets overlapping screens show through each other in 2D */}
      {showLayers && (
        <div className={`absolute right-0 mt-2 w-56 p-3 space-y-3 rounded-lg border shadow-xl backdrop-blur ${isDark ? 'bg-slate-800/95 border-slate-700' : 'bg-white/95 border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>See-through screens</span>
            <button
              onClick={onToggleTransparency}
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${transparencyEnabled ? 'bg-blue-600' : 'bg-slate-400'}`}
            >
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${transparencyEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className={`text-[10px] font-bold uppercase tracking-tight ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Opacity</label>
              <span className={`text-[10px] font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{globalOpacity}%</span>
            </div>
            <input
              type="range" min="0" max="100" step="5"
              value={globalOpacity}
              onChange={(e) => onOpacityChange(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
              disabled={!transparencyEnabled}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasToolbar;
