import React from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Monitor } from '../types';
import { calculateDimensions, formatDim } from '../utils';
import { PPI_SCALE } from '../constants';

interface MonitorItemProps {
  monitor: Monitor;
  zoom: number;
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onRotate: (id: string) => void;
  onRemove: (id: string) => void;
  theme: 'dark' | 'light';
  transparencyEnabled: boolean;
  globalOpacity: number;
  zIndex?: number;
}

const MonitorItem: React.FC<MonitorItemProps> = ({ 
  monitor, isDragging, onMouseDown, onRotate, onRemove, theme, transparencyEnabled, globalOpacity, zIndex
}) => {
  const { width, height } = calculateDimensions(monitor.diagonal, monitor.ratio.w, monitor.ratio.h);
  
  // Swap dimensions if portrait
  const widthIn = monitor.orientation === 'landscape' ? width : height;
  const heightIn = monitor.orientation === 'landscape' ? height : width;

  const widthPx = widthIn * PPI_SCALE;
  const heightPx = heightIn * PPI_SCALE;

  const isDark = theme === 'dark';

  // Opacity logic: Apply to the entire monitor body for stacking effect
  const opacityValue = transparencyEnabled ? globalOpacity / 100 : 1;

  return (
    <div
      onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, monitor.id); }}
      className="absolute group transition-shadow duration-200"
      style={{
        transform: `translate(${monitor.x}px, ${monitor.y}px)`,
        width: widthPx,
        height: heightPx,
        cursor: 'move',
        zIndex: isDragging ? 999 : (zIndex || 10)
      }}
    >
      {/* Monitor Body (Bezel + Screen) */}
      <div 
        className={`w-full h-full rounded-sm border-2 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 ${
          isDark 
            ? 'bg-slate-800 border-slate-600' 
            : 'bg-slate-900 border-slate-700'
        } ${isDragging ? 'shadow-blue-500/40 ring-2 ring-blue-500' : ''}`}
        style={{ opacity: opacityValue }}
      >
        {/* Screen Color Layer */}
        <div 
          className={`w-[calc(100%-8px)] h-[calc(100%-8px)] ${monitor.color} absolute inset-0 m-auto brightness-110 saturate-125`}
        ></div>
        
        {/* Label Content */}
        <div className="w-full h-full absolute inset-0 flex flex-col items-center justify-center p-2 text-center pointer-events-none z-10">
          <span className="text-3xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-none select-none">
            {monitor.diagonal}"
          </span>
          <span className="text-[10px] text-white font-bold drop-shadow-md font-mono mt-1 select-none uppercase tracking-widest bg-black/20 px-1 rounded">
            {monitor.ratio.label.split(' ')[0]}
          </span>
        </div>

        {/* Hover Action Layer */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center z-20">
          {/* Action Buttons */}
          <div className="absolute top-2 right-2 flex gap-1 pointer-events-auto">
            <button 
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onRotate(monitor.id); }}
              className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
              title="Rotate Screen"
            >
              <RotateCcw size={14} />
            </button>
            <button 
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onRemove(monitor.id); }}
              className="p-1.5 rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-colors"
              title="Delete Screen"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {/* Stats Info */}
          <div className="pointer-events-none text-xs text-white text-center p-2">
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-left font-medium">
              <span className="text-white/60">W:</span> <span>{formatDim(widthIn).split(' ')[0]} cm</span>
              <span className="text-white/60">H:</span> <span>{formatDim(heightIn).split(' ')[0]} cm</span>
              <span className="text-white/60">Area:</span> <span>{Math.round(widthIn * heightIn)} in²</span>
            </div>
          </div>
        </div>
      </div>

      {/* External Dimensions (Engineering lines) */}
      <div className={`absolute -top-6 left-0 w-full text-center text-[10px] font-mono font-bold opacity-60 group-hover:opacity-100 select-none transition-colors ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        {formatDim(widthIn)}
      </div>
      <div className={`absolute top-0 -left-6 h-full flex items-center text-[10px] font-mono font-bold opacity-60 group-hover:opacity-100 [writing-mode:vertical-lr] rotate-180 select-none transition-colors ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        {formatDim(heightIn)}
      </div>
    </div>
  );
};

export default MonitorItem;