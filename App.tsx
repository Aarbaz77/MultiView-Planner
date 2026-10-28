import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MousePointer2, Menu, Undo2, X } from 'lucide-react';
import MonitorItem from './components/MonitorItem';
import Sidebar from './components/Sidebar';
import CanvasToolbar from './components/CanvasToolbar';
import Scene3D from './components/Scene3D';
import ViewModeToggle from './components/ViewModeToggle';
import { Monitor, DragState, CanvasStats, MountOption, NewItem, MonitorChanges } from './types';
import { COLORS, PPI_SCALE, MOUNT_CAPACITY } from './constants';
import { calculateDimensions, createItem, getMonitorSizeIn, getMonitorSizePx, isDeskItem, isPeripheral, pickMountMembers, snapMonitorPosition } from './utils';
import { usePinchZoom } from './usePinchZoom';

export default function App() {
  const [monitors, setMonitors] = useState<Monitor[]>([
    { id: '1', diagonal: 27, ratio: { w: 16, h: 9, label: '16:9 (Standard)' }, orientation: 'landscape', x: 0, y: 0, color: COLORS[0] },
    { id: '2', diagonal: 24, ratio: { w: 16, h: 9, label: '16:9 (Standard)' }, orientation: 'portrait', x: 30 * PPI_SCALE, y: 0, color: COLORS[1] }
  ]);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number, y: number }>({ x: 150, y: 150 });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  // Below desktop width the sidebar is a drawer (tablet) or bottom sheet (phone)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // The item picked on the canvas (2D or 3D) or in the sidebar list; both highlight it
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // After loading a preset or saved setup, offer to put back what was there before
  const [undoToast, setUndoToast] = useState<{ label: string; previous: Monitor[] } | null>(null);

  // Transparency Settings
  const [transparencyEnabled, setTransparencyEnabled] = useState<boolean>(true);
  const [globalOpacity, setGlobalOpacity] = useState<number>(65);

  const containerRef = useRef<HTMLDivElement>(null);
  // Ref for snap threshold calculation to avoid stale closures in effects
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Zoom and pan the 2D canvas so every item is in view, leaving room for the top controls
  const fitToView = (items: Monitor[] = monitors) => {
    const el = containerRef.current;
    if (!el || items.length === 0) return;
    const { width, height } = el.getBoundingClientRect();
    const minX = Math.min(...items.map(m => m.x));
    const minY = Math.min(...items.map(m => m.y));
    const maxX = Math.max(...items.map(m => m.x + getMonitorSizePx(m).w));
    const maxY = Math.max(...items.map(m => m.y + getMonitorSizePx(m).h));
    const pad = 48, top = 80;
    const nextZoom = Math.min(1.5, Math.max(0.2, Math.min((width - pad * 2) / (maxX - minX), (height - top - pad) / (maxY - minY))));
    setZoom(nextZoom);
    setPan({
      x: (width - (maxX - minX) * nextZoom) / 2 - minX * nextZoom,
      y: top + (height - top - pad - (maxY - minY) * nextZoom) / 2 - minY * nextZoom,
    });
  };

  // Phones and tablets start fitted; desktop keeps the familiar 100% view
  useEffect(() => {
    if (window.innerWidth < 1024) fitToView();
  }, []);

  usePinchZoom(
    containerRef,
    factor => setZoom(z => Math.min(3, Math.max(0.2, z * factor))),
    () => setDragState(null),
    viewMode
  );

  // --- ACTIONS ---
  const addItem = (item: NewItem) => {
    setMonitors(prev => [createItem(prev, item, Date.now().toString()), ...prev]);
  };

  const removeMonitor = (id: string) => {
    setMonitors(prev => prev.filter(m => m.id !== id));
    setSelectedId(current => (current === id ? null : current));
  };

  // Screens swap landscape/portrait; PC cases lie down on their side or stand back up
  const rotateMonitor = (id: string) => {
    setMonitors(prev => prev.map(m => {
      if (m.id !== id) return m;
      if (m.kind === 'case') return { ...m, lying: !m.lying };
      return { ...m, orientation: m.orientation === 'landscape' ? 'portrait' : 'landscape' };
    }));
  };

  const updateMonitorColor = (id: string, color: string) => {
    setMonitors(prev => prev.map(m => m.id === id ? { ...m, color } : m));
  };

  const updateMonitor = (id: string, changes: MonitorChanges) => {
    setMonitors(prev => prev.map(m => m.id === id ? { ...m, ...changes } : m));
  };

  // Used by the 3D view, which works out positions in canvas units itself
  const moveMonitor = (id: string, x: number, y: number, snapThreshold: number) => {
    setMonitors(prev => {
      const snapped = snapMonitorPosition(prev, id, x, y, snapThreshold);
      return prev.map(m => m.id === id ? { ...m, ...snapped } : m);
    });
  };

  const reorderMonitors = (sourceIndex: number, destIndex: number) => {
    setMonitors(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(sourceIndex, 1);
      result.splice(destIndex, 0, removed);
      return result;
    });
  };

  const applyMount = (targetId: string, option: MountOption) => {
    setMonitors(prev => {
      if (prev.find(m => m.id === targetId && isDeskItem(m))) return prev;
      if (option === 'stand') return prev.map(m => m.id === targetId ? { ...m, mount: undefined } : m);
      const memberIds = pickMountMembers(prev, targetId, MOUNT_CAPACITY[option]);
      const groupId = Date.now().toString();
      return prev.map(m => memberIds.includes(m.id) ? { ...m, mount: { kind: option, groupId } } : m);
    });
  };

  const clearMounts = () => setMonitors(prev => prev.map(m => ({ ...m, mount: undefined })));

  const loadLayout = (loadedMonitors: Monitor[], label: string) => {
    setUndoToast({ label, previous: monitors });
    setMonitors(loadedMonitors);
    setSelectedId(null);
    fitToView(loadedMonitors);
    // On tablets and phones, get the drawer out of the way so the new setup is visible
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const undoLoad = () => {
    if (!undoToast) return;
    setMonitors(undoToast.previous);
    fitToView(undoToast.previous);
    setUndoToast(null);
  };

  useEffect(() => {
    if (!undoToast) return;
    const timer = setTimeout(() => setUndoToast(null), 8000);
    return () => clearTimeout(timer);
  }, [undoToast]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // --- DRAG HANDLERS (pointer events cover mouse, touch and pen) ---
  const handlePointerDown = (e: React.PointerEvent, type: 'monitor' | 'pan', id: string | null = null) => {
    if (e.button !== 0) return; // Primary button / single touch only
    e.preventDefault();
    const targetM = type === 'monitor' ? monitors.find(m => m.id === id) : null;
    if (type === 'monitor') setSelectedId(id);
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

    const handlePointerMove = (e: PointerEvent) => {
      const dx = (e.clientX - dragState.startX) / (dragState.type === 'monitor' ? zoomRef.current : 1);
      const dy = (e.clientY - dragState.startY) / (dragState.type === 'monitor' ? zoomRef.current : 1);

      if (dragState.type === 'monitor' && dragState.id) {
        const id = dragState.id;
        setMonitors(currentMonitors => {
          const snapped = snapMonitorPosition(
            currentMonitors, id, dragState.initialX + dx, dragState.initialY + dy, 15 / zoomRef.current
          );
          return currentMonitors.map(m => m.id === id ? { ...m, ...snapped } : m);
        });
      } else {
        setPan({
          x: dragState.initialX + (e.clientX - dragState.startX),
          y: dragState.initialY + (e.clientY - dragState.startY)
        });
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      // A tap on empty canvas (not a pan) clears the selection
      if (dragState.type === 'pan' && Math.hypot(e.clientX - dragState.startX, e.clientY - dragState.startY) < 4) {
        setSelectedId(null);
      }
      setDragState(null);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [dragState]);

  // Totals cover screens only; keyboards and mice don't count
  const stats: CanvasStats = useMemo(() => {
    let totalArea = 0, minX = Infinity, maxX = -Infinity;
    monitors.filter(m => !isPeripheral(m)).forEach(m => {
      const { width, height } = calculateDimensions(m.diagonal, m.ratio.w, m.ratio.h);
      totalArea += width * height;
      const wPx = getMonitorSizeIn(m).w * PPI_SCALE;
      minX = Math.min(minX, m.x);
      maxX = Math.max(maxX, m.x + wPx);
    });
    return minX === Infinity ? { area: 0, width: 0 } : { area: totalArea, width: (maxX - minX) / PPI_SCALE };
  }, [monitors]);

  const isDark = theme === 'dark';

  return (
    <div className={`relative flex h-[100dvh] w-full transition-colors duration-300 ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'} overflow-hidden font-sans`}>
      {/* Backdrop behind the drawer / bottom sheet on tablets and phones */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Phone: bottom sheet. Tablet: left drawer. Desktop: fixed sidebar. */}
      <aside
        className={`fixed z-50 inset-x-0 bottom-0 h-[80dvh] rounded-t-2xl overflow-hidden shadow-2xl transition-transform duration-300 ease-out
          md:inset-y-0 md:left-0 md:right-auto md:h-auto md:w-80 md:rounded-none
          lg:relative lg:z-20 lg:flex-shrink-0 lg:translate-x-0 lg:translate-y-0 lg:shadow-xl
          ${sidebarOpen ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:-translate-x-full'}`}
      >
        <Sidebar
          monitors={monitors}
          onAdd={addItem}
          onRemove={removeMonitor}
          onRotate={rotateMonitor}
          onUpdateColor={updateMonitorColor}
          onUpdateMonitor={updateMonitor}
          onLoadLayout={loadLayout}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onReorder={reorderMonitors}
          stats={stats}
          theme={theme}
          onToggleTheme={toggleTheme}
          onClose={() => setSidebarOpen(false)}
        />
      </aside>

      <main className="flex-1 relative overflow-hidden min-w-0">
        <div className="absolute top-3 left-3 md:top-4 md:left-4 z-40 flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className={`lg:hidden flex items-center gap-1.5 h-10 px-3 rounded-lg border shadow-xl backdrop-blur text-xs font-bold ${isDark ? 'bg-slate-800/90 border-slate-700 text-slate-200' : 'bg-white/90 border-slate-200 text-slate-700'}`}
            title="Open setup"
          >
            <Menu size={16} /> <span className="hidden sm:inline">Setup</span>
          </button>
          <ViewModeToggle mode={viewMode} onChange={setViewMode} theme={theme} />
        </div>

        {viewMode === '3d' ? (
          <Scene3D
            monitors={monitors}
            theme={theme}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onApplyMount={applyMount}
            onClearMounts={clearMounts}
            onMoveMonitor={moveMonitor}
            onUpdateMonitor={updateMonitor}
          />
        ) : (
          <div
            ref={containerRef}
            className={`absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}
            onPointerDown={(e) => handlePointerDown(e, 'pan')}
            style={{
              touchAction: 'none',
              backgroundImage: `radial-gradient(circle, ${isDark ? '#334155' : '#cbd5e1'} 1px, transparent 1px)`,
              backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
              backgroundPosition: `${pan.x}px ${pan.y}px`
            }}
          >
            <CanvasToolbar
              zoom={zoom}
              setZoom={setZoom}
              onFit={() => fitToView()}
              theme={theme}
              transparencyEnabled={transparencyEnabled}
              onToggleTransparency={() => setTransparencyEnabled(!transparencyEnabled)}
              globalOpacity={globalOpacity}
              onOpacityChange={setGlobalOpacity}
            />

            <div
              className="absolute origin-top-left transition-transform duration-75"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            >
              <div className={`absolute top-0 left-0 w-4 h-4 -translate-x-1/2 -translate-y-1/2 border-l border-t ${isDark ? 'border-slate-600/50' : 'border-slate-400'}`}></div>

              {monitors.map((m, index) => (
                <MonitorItem
                  key={m.id}
                  monitor={m}
                  zoom={zoom}
                  isDragging={dragState?.id === m.id}
                  isSelected={selectedId === m.id}
                  onPointerDown={(e, id) => handlePointerDown(e, 'monitor', id)}
                  onRotate={rotateMonitor}
                  onRemove={removeMonitor}
                  theme={theme}
                  transparencyEnabled={transparencyEnabled}
                  globalOpacity={globalOpacity}
                  zIndex={monitors.length - index}
                />
              ))}
            </div>

            {monitors.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={`text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                  <MousePointer2 className="mx-auto mb-2 opacity-50" size={48} />
                  <p className="text-lg font-semibold">Canvas is empty</p>
                  <p className="text-sm opacity-70">Open the Add tab to add a display</p>
                </div>
              </div>
            )}
          </div>
        )}
        {undoToast && (
          <div
            className={`absolute left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 z-40 flex items-center gap-3 pl-4 pr-2 py-2 rounded-xl border shadow-2xl backdrop-blur text-sm max-w-[calc(100%-1.5rem)] ${isDark ? 'bg-slate-800/95 border-slate-700 text-slate-200' : 'bg-white/95 border-slate-200 text-slate-700'}`}
            onPointerDown={e => e.stopPropagation()}
          >
            <span className="truncate">Loaded <b>{undoToast.label}</b></span>
            <button onClick={undoLoad} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex-shrink-0">
              <Undo2 size={14} /> Undo
            </button>
            <button onClick={() => setUndoToast(null)} className={`p-1 rounded flex-shrink-0 ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`} title="Dismiss">
              <X size={14} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
