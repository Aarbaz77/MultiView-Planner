import React from 'react';
import { Monitor } from '../types';
import { calculateDimensions, formatDim } from '../utils';
import { PPI_SCALE } from '../constants';

interface MonitorItemProps {
  monitor: Monitor;
  zoom: number;
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  theme: 'dark' | 'light';
}

const MonitorItem: React.FC<MonitorItemProps> = ({ monitor, isDragging, onMouseDown, theme }) => {
  const { width, height } = calculateDimensions(monitor.diagonal, monitor.ratio.w, monitor.ratio.h);
  
  // Swap dimensions if portrait
  const widthIn = monitor.orientation === 'landscape' ? width : height;
  const heightIn = monitor.orientation === 'landscape' ? height : width;

  const widthPx = widthIn * PPI_SCALE;
  const heightPx = heightIn * PPI_SCALE;

  const isDark = theme === 'dark';

  return (
    <div
      onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, monitor.id); }}
      className="absolute group"
      style={{
        transform: `translate(${monitor.x}px, ${monitor.y}px)`,
        width: widthPx,
        height: heightPx,
        cursor: 'move',
        zIndex: isDragging ? 50 : 10
      }}
    >
      {/* Monitor Bezel & Screen */}
      <div 
        className={`w-full h-full rounded-sm border-2 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 ${
          isDark 
            ? 'bg-slate-800 border-slate-600' 
            : 'bg-slate-900 border-slate-700'
        } ${isDragging ? 'shadow-blue-500/20 ring-2 ring-blue-500' : ''}`}
      >
        {/* Screen Content */}
        <div className={`w-[calc(100%-8px)] h-[calc(100%-8px)] ${monitor.color} opacity-30 absolute inset-0 m-auto`}></div>
        <div className={`w-[calc(100%-8px)] h-[calc(100%-8px)] absolute inset-0 m-auto flex flex-col items-center justify-center p-2 text-center pointer-events-none`}>
          <span className="text-3xl font-bold text-white drop-shadow-lg leading-none select-none">{monitor.diagonal}"</span>
          <span className="text-[10px] text-white/90 drop-shadow-md font-mono mt-1 select-none uppercase tracking-tighter">{monitor.ratio.label.split(' ')[0]}</span>
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-xs text-white pointer-events-none p-2 text-center">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-left">
            <span className="text-slate-400">Width:</span> <span>{formatDim(widthIn)}</span>
            <span className="text-slate-400">Height:</span> <span>{formatDim(heightIn)}</span>
            <span className="text-slate-400">Area:</span> <span>{Math.round(widthIn * heightIn)} in²</span>
          </div>
        </div>
      </div>

      {/* External Dimensions (Engineering lines) */}
      <div className={`absolute -top-6 left-0 w-full text-center text-[10px] font-mono opacity-50 group-hover:opacity-100 select-none transition-colors ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        {formatDim(widthIn)}
      </div>
      <div className={`absolute top-0 -left-6 h-full flex items-center text-[10px] font-mono opacity-50 group-hover:opacity-100 [writing-mode:vertical-lr] rotate-180 select-none transition-colors ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        {formatDim(heightIn)}
      </div>
    </div>
  );
};

export default MonitorItem;