import React from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Monitor } from '../types';
import { getMonitorSizeIn, formatDim, getItemLabel, isCase, isPeripheral } from '../utils';
import { PPI_SCALE } from '../constants';

interface MonitorItemProps {
  monitor: Monitor;
  zoom: number;
  isDragging: boolean;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onRotate: (id: string) => void;
  onRemove: (id: string) => void;
  theme: 'dark' | 'light';
  transparencyEnabled: boolean;
  globalOpacity: number;
  zIndex?: number;
}

const MonitorItem: React.FC<MonitorItemProps> = ({
  monitor, isDragging, isSelected, onPointerDown, onRotate, onRemove, theme, transparencyEnabled, globalOpacity, zIndex
}) => {
  // Front-view footprint, already swapped for portrait and narrowed for curved panels
  const { w: widthIn, h: heightIn } = getMonitorSizeIn(monitor);

  const widthPx = widthIn * PPI_SCALE;
  const heightPx = heightIn * PPI_SCALE;

  const isDark = theme === 'dark';

  // Opacity logic: Apply to the entire monitor body for stacking effect
  const opacityValue = transparencyEnabled ? globalOpacity / 100 : 1;

  const stopDrag = (e: React.PointerEvent) => e.stopPropagation();

  const wrapperProps = {
    onPointerDown: (e: React.PointerEvent) => { e.stopPropagation(); onPointerDown(e, monitor.id); },
    className: 'absolute group transition-shadow duration-200',
    style: {
      transform: `translate(${monitor.x}px, ${monitor.y}px)`,
      width: widthPx,
      height: heightPx,
      cursor: 'move',
      touchAction: 'none' as const,
      zIndex: isDragging ? 999 : (zIndex || 10)
    },
  };

  // Keyboards and mice are seen edge-on from the front: a low slab on the desk line
  if (isPeripheral(monitor)) {
    return (
      <div {...wrapperProps}>
        <div
          className={`relative w-full h-full rounded-md border flex items-center justify-center overflow-hidden ${monitor.color} ${
            isDark ? 'border-slate-500' : 'border-slate-700'
          } ${isDragging ? 'ring-2 ring-blue-500' : isSelected ? 'ring-[3px] ring-amber-400' : ''}`}
          style={{ opacity: opacityValue }}
        >
          {isCase(monitor) && (
            <div
              className="absolute inset-[12%] rounded-sm bg-black/40"
              style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0 2px, transparent 2px 6px)' }}
            />
          )}
          {isCase(monitor) && <div className="absolute top-[5%] right-[8%] w-2 h-2 rounded-full bg-white/80" />}
          <span className={`relative text-[9px] font-bold text-white drop-shadow uppercase tracking-wider select-none px-1 ${isCase(monitor) ? 'text-center leading-tight' : 'whitespace-nowrap truncate'}`}>
            {getItemLabel(monitor)}
          </span>
        </div>
        <div className="absolute -right-8 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isCase(monitor) && (
            <button
              onPointerDown={stopDrag}
              onClick={(e) => { e.stopPropagation(); onRotate(monitor.id); }}
              className="p-1.5 rounded-full bg-slate-600/90 hover:bg-slate-500 text-white"
              title={monitor.lying ? 'Stand upright' : 'Lay on its side'}
            >
              <RotateCcw size={12} />
            </button>
          )}
          <button
            onPointerDown={stopDrag}
            onClick={(e) => { e.stopPropagation(); onRemove(monitor.id); }}
            className="p-1.5 rounded-full bg-red-500/80 hover:bg-red-500 text-white"
            title="Remove"
          >
            <Trash2 size={12} />
          </button>
        </div>
        <div className={`absolute -top-5 left-0 w-full text-center text-[10px] font-mono font-bold opacity-60 group-hover:opacity-100 select-none whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {formatDim(widthIn)}
        </div>
      </div>
    );
  }

  return (
    <div {...wrapperProps}>
      {/* Monitor Body (Bezel + Screen) */}
      <div
        className={`w-full h-full rounded-sm border-2 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 ${
          isDark
            ? 'bg-slate-800 border-slate-600'
            : 'bg-slate-900 border-slate-700'
        } ${isDragging ? 'shadow-blue-500/40 ring-2 ring-blue-500' : isSelected ? 'ring-[3px] ring-amber-400' : ''}`}
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
            {monitor.ratio.label.split(' ')[0]}{monitor.kind === 'laptop' ? ' · Laptop' : ''}{monitor.curve ? ` · ${monitor.curve}R` : ''}{monitor.angle ? ` · ${monitor.angle}°` : ''}
          </span>
        </div>

        {/* Hover Action Layer */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center z-20">
          {/* Action Buttons */}
          <div className="absolute top-2 right-2 flex gap-1 pointer-events-auto">
            {monitor.kind !== 'laptop' && (
              <button
                onPointerDown={stopDrag}
                onClick={(e) => { e.stopPropagation(); onRotate(monitor.id); }}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
                title="Rotate Screen"
              >
                <RotateCcw size={14} />
              </button>
            )}
            <button
              onPointerDown={stopDrag}
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

      {/* Laptop keyboard base, seen edge-on from the front */}
      {monitor.kind === 'laptop' && (
        <div
          className={`absolute rounded-b-md border-t ${isDark ? 'bg-slate-600 border-slate-500' : 'bg-slate-400 border-slate-300'}`}
          style={{ top: heightPx, left: -0.3 * PPI_SCALE, width: widthPx + 0.6 * PPI_SCALE, height: 0.65 * PPI_SCALE, opacity: opacityValue }}
        />
      )}

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
