import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MousePointer2 } from 'lucide-react';
import MonitorItem from './components/MonitorItem';
import Sidebar from './components/Sidebar';
import CanvasToolbar from './components/CanvasToolbar';
import { Monitor, DragState, AspectRatio, CanvasStats } from './types';
import { COLORS, PPI_SCALE } from './constants';
import { calculateDimensions } from './utils';

export default function App() {
  const [monitors, setMonitors] = useState<Monitor[]>([
    { id: '1', diagonal: 27, ratio: { w: 16, h: 9, label: '16:9 (Standard)' }, orientation: 'landscape', x: 0, y: 0, color: COLORS[0] },
    { id: '2', diagonal: 24, ratio: { w: 16, h: 9, label: '16:9 (Standard)' }, orientation: 'portrait', x: -28 * PPI_SCALE, y: 0, color: COLORS[1] }
  ]);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const containerRef = useRef<HTMLDivElement>(null);

  // --- ACTIONS ---
  const addMonitor = (diagonal: number, ratio: AspectRatio) => {
    setMonitors(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        diagonal: diagonal,
        ratio,
        orientation: 'landscape',
        x: 50, y: 50,
        color: COLORS[prev.length % COLORS.length]
      }
    ]);
  };

  const removeMonitor = (id: string) => setMonitors(prev => prev.filter(m => m.id !== id));
  
  const rotateMonitor = (id: string) => {
    setMonitors(prev => prev.map(m => 
      m.id === id ? { ...m, orientation: m.orientation === 'landscape' ? 'portrait' : 'landscape' } : m
    ));
  };

  const updateMonitorColor = (id: string, color: string) => {
    setMonitors(prev => prev.map(m => m.id === id ? { ...m, color } : m));
  };
  
  const loadLayout = (loadedMonitors: Monitor[]) => {
    setMonitors(loadedMonitors);
  };

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // --- DRAG HANDLERS ---
  const handleMouseDown = (e: React.MouseEvent, type: 'monitor' | 'pan', id: string | null = null) => {
    e.preventDefault();
    const targetM = type === 'monitor' ? monitors.find(m => m.id === id) : null;
    setDragState({
      type, id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: type === 'monitor' && targetM ? targetM.x : pan.x,
      initialY: type === 'monitor' && targetM ? targetM.y : pan.y
    });
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragState.startX) / (dragState.type === 'monitor' ? zoom : 1);
      const dy = (e.clientY - dragState.startY) / (dragState.type === 'monitor' ? zoom : 1);

      if (dragState.type === 'monitor' && dragState.id) {
        let newX = dragState.initialX + dx;
        let newY = dragState.initialY + dy;
        
        const SNAP_THRESHOLD = 15 / zoom;
        let snappedX = false;
        let snappedY = false;
        
        const currentM = monitors.find(m => m.id === dragState.id);
        if (currentM) {
          let { width: wIn, height: hIn } = calculateDimensions(currentM.diagonal, currentM.ratio.w, currentM.ratio.h);
          if (currentM.orientation === 'portrait') [wIn, hIn] = [hIn, wIn];
          const curW = wIn * PPI_SCALE;
          const curH = hIn * PPI_SCALE;

          monitors.forEach(other => {
            if (other.id === dragState.id) return;
            let { width: owIn, height: ohIn } = calculateDimensions(other.diagonal, other.ratio.w, other.ratio.h);
            if (other.orientation === 'portrait') [owIn, ohIn] = [ohIn, owIn];
            const otherL = other.x, otherR = other.x + (owIn * PPI_SCALE);
            const otherT = other.y, otherB = other.y + (ohIn * PPI_SCALE);
            
            if (!snappedX) {
              if (Math.abs(newX - otherR) < SNAP_THRESHOLD) { newX = otherR; snappedX = true; }
              else if (Math.abs((newX + curW) - otherL) < SNAP_THRESHOLD) { newX = otherL - curW; snappedX = true; }
              else if (Math.abs(newX - otherL) < SNAP_THRESHOLD) { newX = otherL; snappedX = true; }
              else if (Math.abs((newX + curW) - otherR) < SNAP_THRESHOLD) { newX = otherR - curW; snappedX = true; }
            }
            if (!snappedY) {
              if (Math.abs(newY - otherB) < SNAP_THRESHOLD) { newY = otherB; snappedY = true; }
              else if (Math.abs((newY + curH) - otherT) < SNAP_THRESHOLD) { newY = otherT - curH; snappedY = true; }
              else if (Math.abs(newY - otherT) < SNAP_THRESHOLD) { newY = otherT; snappedY = true; }
              else if (Math.abs((newY + curH) - otherB) < SNAP_THRESHOLD) { newY = otherB - curH; snappedY = true; }
            }
          });
        }
        setMonitors(prev => prev.map(m => m.id === dragState.id ? { ...m, x: newX, y: newY } : m));
      } else {
        setPan({ x: dragState.initialX + (e.clientX - dragState.startX), y: dragState.initialY + (e.clientY - dragState.startY) });
      }
    };

    const handleMouseUp = () => setDragState(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, monitors, zoom, pan]);

  const stats: CanvasStats = useMemo(() => {
    let totalArea = 0, minX = Infinity, maxX = -Infinity;
    monitors.forEach(m => {
      const { width, height } = calculateDimensions(m.diagonal, m.ratio.w, m.ratio.h);
      totalArea += width * height;
      const wPx = (m.orientation === 'landscape' ? width : height) * PPI_SCALE;
      minX = Math.min(minX, m.x);
      maxX = Math.max(maxX, m.x + wPx);
    });
    return minX === Infinity ? { area: 0, width: 0 } : { area: totalArea, width: (maxX - minX) / PPI_SCALE };
  }, [monitors]);

  const isDark = theme === 'dark';

  return (
    <div className={`flex h-screen w-full transition-colors duration-300 ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'} overflow-hidden font-sans`}>
      <Sidebar 
        monitors={monitors} 
        onAdd={addMonitor} 
        onRemove={removeMonitor} 
        onRotate={rotateMonitor}
        onUpdateColor={updateMonitorColor}
        onLoadLayout={loadLayout}
        stats={stats}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      
      <div 
        ref={containerRef}
        className={`flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}
        onMouseDown={(e) => handleMouseDown(e, 'pan')}
        style={{ 
          backgroundImage: `radial-gradient(circle, ${isDark ? '#334155' : '#cbd5e1'} 1px, transparent 1px)`, 
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`
        }}
      >
        <CanvasToolbar zoom={zoom} setZoom={setZoom} theme={theme} />

        <div 
          className="absolute origin-top-left transition-transform duration-75"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <div className={`absolute top-0 left-0 w-4 h-4 -translate-x-1/2 -translate-y-1/2 border-l border-t ${isDark ? 'border-slate-600/50' : 'border-slate-400'}`}></div>

          {monitors.map(m => (
            <MonitorItem 
              key={m.id} 
              monitor={m} 
              zoom={zoom} 
              isDragging={dragState?.id === m.id} 
              onMouseDown={(e, id) => handleMouseDown(e, 'monitor', id)} 
              theme={theme}
            />
          ))}
        </div>

        {monitors.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              <MousePointer2 className="mx-auto mb-2 opacity-50" size={48} />
              <p className="text-lg">Canvas is empty</p>
              <p className="text-sm">Use the sidebar to add a display</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}