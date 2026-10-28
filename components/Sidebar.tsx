import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Trash2, Monitor as MonitorIcon, RotateCcw, Save, Upload, Sun, Moon, GripVertical, Pencil, Check,
  Laptop, Keyboard, Mouse, PcCase, X, LayoutGrid, FolderOpen, Sparkles, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Monitor, AspectRatio, CanvasStats, SavedLayout, DeviceKind, NewItem, MonitorChanges, PeripheralModel } from '../types';
import { ASPECT_RATIOS, COLORS, MONITOR_MODELS, LAPTOP_MODELS, CURVE_OPTIONS, KEYBOARD_MODELS, MOUSE_MODELS, CASE_MODELS } from '../constants';
import { formatDim, getItemLabel, getMonitorSizePx, isDeskItem, isPeripheral } from '../utils';
import { SETUP_PRESETS, PRESET_CATEGORIES, PresetCategory } from '../presets';

const DEFAULT_CURVE = 1800;
const PRESETS_PER_PAGE = 4;

const inputClass = (isDark: boolean) =>
  `w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${isDark ? 'bg-slate-900 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`;

const labelClass = (isDark: boolean) => `block text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

const KIND_OPTIONS: { kind: DeviceKind; label: string; Icon: typeof MonitorIcon }[] = [
  { kind: 'monitor', label: 'Monitor', Icon: MonitorIcon },
  { kind: 'laptop', label: 'Laptop', Icon: Laptop },
  { kind: 'keyboard', label: 'Keyboard', Icon: Keyboard },
  { kind: 'mouse', label: 'Mouse', Icon: Mouse },
  { kind: 'case', label: 'PC Case', Icon: PcCase },
];

const kindIcon = (m: Monitor) => KIND_OPTIONS.find(k => k.kind === (m.kind ?? 'monitor'))!.Icon;

const peripheralModels = (kind: DeviceKind): PeripheralModel[] =>
  kind === 'keyboard' ? KEYBOARD_MODELS : kind === 'case' ? CASE_MODELS : MOUSE_MODELS;

// Cases list all three sizes since height matters; keyboards and mice just the footprint
const formatSize = (m: PeripheralModel) =>
  `${Math.round(m.size.w * 2.54)} × ${Math.round(m.size.d * 2.54)}${CASE_MODELS.includes(m) ? ` × ${Math.round(m.size.h * 2.54)}` : ''} cm`;

// Small front-view picture of a setup: screens in their colours, desk items in grey
const SetupPreview: React.FC<{ items: Monitor[]; isDark: boolean }> = ({ items, isDark }) => {
  const boxes = items.map(m => ({ m, ...getMonitorSizePx(m) }));
  const minX = Math.min(...boxes.map(b => b.m.x));
  const minY = Math.min(...boxes.map(b => b.m.y));
  const maxX = Math.max(...boxes.map(b => b.m.x + b.w));
  const maxY = Math.max(...boxes.map(b => b.m.y + b.h));
  const pad = 12;
  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
    >
      <line x1={minX - pad} x2={maxX + pad} y1={maxY} y2={maxY} strokeWidth={3} className={isDark ? 'stroke-slate-600' : 'stroke-slate-300'} />
      {boxes.map(({ m, w, h }) => (
        <rect
          key={m.id}
          x={m.x} y={m.y} width={w} height={h} rx={isDeskItem(m) ? 4 : 3}
          className={isDeskItem(m) ? (isDark ? 'fill-slate-500' : 'fill-slate-400') : m.color.replace('bg-', 'fill-')}
          strokeWidth={4}
          stroke={isDeskItem(m) ? 'none' : isDark ? '#0f172a' : '#1e293b'}
        />
      ))}
    </svg>
  );
};

// Flat/curved switch plus a curvature picker, shared by the add form and the inline editor
const CurveField: React.FC<{ curve?: number; onChange: (curve?: number) => void; isDark: boolean }> = ({ curve, onChange, isDark }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Curved Screen</span>
      <button
        onClick={() => onChange(curve ? undefined : DEFAULT_CURVE)}
        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${curve ? 'bg-blue-600' : 'bg-slate-400'}`}
        title={curve ? 'Make flat' : 'Make curved'}
      >
        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${curve ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
    {curve !== undefined && (
      <div>
        <label className={labelClass(isDark)}>Curvature (smaller = more curved)</label>
        <select value={curve} onChange={(e) => onChange(parseInt(e.target.value))} className={inputClass(isDark)}>
          {CURVE_OPTIONS.map(r => <option key={r} value={r}>{r}R</option>)}
        </select>
      </div>
    )}
  </div>
);

// Diagonal + aspect ratio inputs, shared by the add form and the inline editor
const ScreenSizeFields: React.FC<{
  diagonal: string;
  onDiagonal: (value: string) => void;
  ratioIdx: number;
  onRatioIdx: (idx: number) => void;
  custom: { w: string; h: string };
  onCustom: (next: { w: string; h: string }) => void;
  isDark: boolean;
}> = ({ diagonal, onDiagonal, ratioIdx, onRatioIdx, custom, onCustom, isDark }) => (
  <>
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className={labelClass(isDark)}>Diagonal (in)</label>
        <input type="number" value={diagonal} min="5" max="100" onChange={(e) => onDiagonal(e.target.value)} className={inputClass(isDark)} />
      </div>
      <div>
        <label className={labelClass(isDark)}>Aspect Ratio</label>
        <select value={ratioIdx} onChange={(e) => onRatioIdx(parseInt(e.target.value))} className={inputClass(isDark)}>
          {ASPECT_RATIOS.map((r, idx) => <option key={idx} value={idx}>{r.label.split(' ')[0]}</option>)}
          <option value={-1}>Custom</option>
        </select>
      </div>
    </div>
    {ratioIdx === -1 && (
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass(isDark)}>Width Ratio</label>
          <input type="number" value={custom.w} onChange={(e) => onCustom({ ...custom, w: e.target.value })} className={inputClass(isDark)} placeholder="16" />
        </div>
        <div>
          <label className={labelClass(isDark)}>Height Ratio</label>
          <input type="number" value={custom.h} onChange={(e) => onCustom({ ...custom, h: e.target.value })} className={inputClass(isDark)} placeholder="9" />
        </div>
      </div>
    )}
  </>
);

// Inline editor for an existing item; every valid change applies straight away
const MonitorEditor: React.FC<{
  monitor: Monitor;
  isDark: boolean;
  onChange: (changes: MonitorChanges) => void;
}> = ({ monitor, isDark, onChange }) => {
  const presetIdx = ASPECT_RATIOS.findIndex(r => r.w === monitor.ratio.w && r.h === monitor.ratio.h);
  const [diag, setDiag] = useState(monitor.diagonal.toString());
  const [ratioIdx, setRatioIdx] = useState(presetIdx);
  const [custom, setCustom] = useState({ w: monitor.ratio.w.toString(), h: monitor.ratio.h.toString() });

  const applyCustom = (next: { w: string; h: string }) => {
    setCustom(next);
    const w = parseFloat(next.w), h = parseFloat(next.h);
    if (w > 0 && h > 0) onChange({ ratio: { w, h, label: `${w}:${h}` } });
  };

  const boxClass = `p-3 rounded space-y-3 border cursor-default ${isDark ? 'bg-slate-800/70 border-slate-600' : 'bg-white border-slate-200'}`;

  if (isPeripheral(monitor)) {
    const models = peripheralModels(monitor.kind!);
    return (
      <div className={boxClass}>
        <div>
          <label className={labelClass(isDark)}>Model</label>
          <select
            value={models.findIndex(m => m.name === monitor.name)}
            onChange={(e) => { const m = models[parseInt(e.target.value)]; onChange({ name: m.name, size: m.size }); }}
            className={inputClass(isDark)}
          >
            {models.map((m, idx) => <option key={m.name} value={idx}>{m.name} · {formatSize(m)}</option>)}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className={boxClass}>
      <ScreenSizeFields
        diagonal={diag}
        onDiagonal={(value) => {
          setDiag(value);
          const parsed = parseFloat(value);
          if (parsed > 0 && parsed <= 150) onChange({ diagonal: parsed });
        }}
        ratioIdx={ratioIdx}
        onRatioIdx={(idx) => {
          setRatioIdx(idx);
          if (idx === -1) applyCustom(custom);
          else onChange({ ratio: ASPECT_RATIOS[idx] });
        }}
        custom={custom}
        onCustom={applyCustom}
        isDark={isDark}
      />
      {monitor.kind !== 'laptop' && <CurveField curve={monitor.curve} onChange={(curve) => onChange({ curve })} isDark={isDark} />}
    </div>
  );
};

interface SidebarProps {
  monitors: Monitor[];
  onAdd: (item: NewItem) => void;
  onRemove: (id: string) => void;
  onRotate: (id: string) => void;
  onUpdateColor: (id: string, color: string) => void;
  onUpdateMonitor: (id: string, changes: MonitorChanges) => void;
  onLoadLayout: (monitors: Monitor[], label: string) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onReorder: (startIndex: number, endIndex: number) => void;
  stats: CanvasStats;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onClose: () => void;
}

type Tab = 'setup' | 'add' | 'layouts';

const Sidebar: React.FC<SidebarProps> = ({
  monitors, onAdd, onRemove, onRotate, onUpdateColor, onUpdateMonitor, onLoadLayout, selectedId, onSelect, onReorder, stats, theme, onToggleTheme, onClose
}) => {
  const [tab, setTab] = useState<Tab>('setup');
  const [presetFilter, setPresetFilter] = useState<PresetCategory | 'all'>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Built once so the preview pictures don't change on every render
  const presets = useMemo(() => SETUP_PRESETS.map(p => ({ preset: p, items: p.build() })), []);
  const matchingPresets = presets.filter(({ preset }) => presetFilter === 'all' || preset.categories.includes(presetFilter));
  // Presets show a page at a time with a Next button, instead of one long list
  const [presetPage, setPresetPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(matchingPresets.length / PRESETS_PER_PAGE));
  const visiblePresets = matchingPresets.slice(presetPage * PRESETS_PER_PAGE, (presetPage + 1) * PRESETS_PER_PAGE);
  useEffect(() => setPresetPage(0), [presetFilter]);

  // Arrow buttons for the category chips when they run past the edge
  const chipsRef = useRef<HTMLDivElement>(null);
  const [chipScroll, setChipScroll] = useState({ left: false, right: false });
  const updateChipScroll = () => {
    const el = chipsRef.current;
    if (!el) return;
    setChipScroll({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  const scrollChips = (direction: 1 | -1) => chipsRef.current?.scrollBy({ left: direction * 160, behavior: 'smooth' });
  useEffect(updateChipScroll, [tab]);

  // Picking something on the canvas shows it in the Setup list
  useEffect(() => {
    if (!selectedId) return;
    setTab('setup');
    requestAnimationFrame(() => {
      const box = scrollRef.current;
      const row = box?.querySelector<HTMLElement>(`[data-item-id="${selectedId}"]`);
      if (!box || !row) return;
      // Scroll only the list, never the page or the drawer around it
      const top = row.offsetTop;
      const bottom = top + row.offsetHeight;
      if (top < box.scrollTop) box.scrollTo({ top: top - 8, behavior: 'smooth' });
      else if (bottom > box.scrollTop + box.clientHeight) box.scrollTo({ top: bottom - box.clientHeight + 8, behavior: 'smooth' });
    });
  }, [selectedId]);

  // Add form
  const [newKind, setNewKind] = useState<DeviceKind>('monitor');
  const [newDiag, setNewDiag] = useState<string>("27");
  const [ratioIdx, setRatioIdx] = useState<number>(0);
  const [customRatio, setCustomRatio] = useState<{ w: string, h: string }>({ w: "16", h: "9" });
  const [newCurve, setNewCurve] = useState<number | undefined>(undefined);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);

  // Reordering State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Storage State
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([]);
  const [layoutName, setLayoutName] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem('mvp_saved_layouts');
    if (saved) {
      try {
        setSavedLayouts(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved layouts", e);
      }
    }
  }, []);

  // A short "Added …" note under the add form
  useEffect(() => {
    if (!lastAdded) return;
    const timer = setTimeout(() => setLastAdded(null), 2000);
    return () => clearTimeout(timer);
  }, [lastAdded]);

  const add = (item: NewItem, label: string) => {
    onAdd(item);
    setLastAdded(label);
  };

  const handleAddScreen = () => {
    let finalRatio: AspectRatio;
    if (ratioIdx === -1) {
      finalRatio = {
        w: parseFloat(customRatio.w) || 16,
        h: parseFloat(customRatio.h) || 9,
        label: `${customRatio.w}:${customRatio.h}`
      };
    } else {
      finalRatio = ASPECT_RATIOS[ratioIdx];
    }
    const diag = parseFloat(newDiag);
    if (!isNaN(diag) && diag > 0) {
      add(
        { kind: newKind, diagonal: diag, ratio: finalRatio, curve: newKind === 'monitor' ? newCurve : undefined },
        `${diag}" ${newKind}`
      );
    }
  };

  const chooseKind = (kind: DeviceKind) => {
    setNewKind(kind);
    // Start each screen type from its most common size
    if (kind === 'monitor') { setNewDiag('27'); setRatioIdx(0); }
    if (kind === 'laptop') { setNewDiag('15.6'); setRatioIdx(0); }
  };

  const applyPreset = (model: { diagonal: number; ratio: AspectRatio }) => {
    setNewDiag(model.diagonal.toString());
    const rIdx = ASPECT_RATIOS.findIndex(r => r.w === model.ratio.w && r.h === model.ratio.h);
    setRatioIdx(rIdx);
    if (rIdx === -1) setCustomRatio({ w: model.ratio.w.toString(), h: model.ratio.h.toString() });
  };

  const handleSaveLayout = () => {
    if (!layoutName.trim()) return;
    const newLayout: SavedLayout = {
        id: Date.now().toString(),
        name: layoutName.trim(),
        timestamp: Date.now(),
        monitors: monitors
    };
    const updated = [...savedLayouts, newLayout];
    setSavedLayouts(updated);
    localStorage.setItem('mvp_saved_layouts', JSON.stringify(updated));
    setLayoutName("");
  };

  const handleDeleteLayout = (id: string) => {
    const updated = savedLayouts.filter(l => l.id !== id);
    setSavedLayouts(updated);
    localStorage.setItem('mvp_saved_layouts', JSON.stringify(updated));
  };

  // Native Drag and Drop Logic
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    onReorder(draggedIndex, index);
    setDraggedIndex(index);
  };

  const isDark = theme === 'dark';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const heading = `text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  // Row actions are always visible on touch screens, and appear on hover with a mouse
  const rowActions = 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100';

  const renderRow = (m: Monitor) => {
    const index = monitors.indexOf(m);
    const editing = editingId === m.id;
    const Icon = kindIcon(m);
    const sublabel = m.kind === 'laptop' ? 'Laptop'
      : isPeripheral(m) ? (m.kind === 'keyboard' ? 'Keyboard' : m.kind === 'case' ? (m.lying ? 'PC case · on its side' : 'PC case') : 'Mouse')
      : `${m.orientation}${m.curve ? ` · ${m.curve}R` : ''}`;
    return (
      <div
        key={m.id}
        data-item-id={m.id}
        onClick={() => onSelect(m.id)}
        draggable={!editing}
        onDragStart={() => handleDragStart(index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDragEnd={() => setDraggedIndex(null)}
        className={`p-2.5 rounded-lg flex flex-col gap-2 border transition-all group ${
          draggedIndex === index ? 'opacity-40 scale-95' : 'opacity-100'
        } ${selectedId === m.id
          ? isDark ? 'bg-amber-500/10 border-amber-400 ring-1 ring-amber-400' : 'bg-amber-50 border-amber-400 ring-1 ring-amber-400'
          : isDark ? 'bg-slate-700/60 border-transparent hover:border-slate-500' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
        } ${editing ? '' : 'lg:cursor-grab lg:active:cursor-grabbing'}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <GripVertical size={14} className={`hidden lg:block flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <button
              onClick={() => setShowColorPicker(showColorPicker === m.id ? null : m.id)}
              className={`w-4 h-4 flex-shrink-0 rounded-full ${m.color} ring-2 ring-offset-1 transition-all ${isDark ? 'ring-offset-slate-700 ring-white/20 hover:ring-white/50' : 'ring-offset-slate-50 ring-black/10 hover:ring-black/30'}`}
              title="Change color"
            ></button>
            <Icon size={15} className={`flex-shrink-0 ${muted}`} />
            <div className="min-w-0">
              <div className={`text-sm font-medium truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{getItemLabel(m)}</div>
              <div className={`text-[10px] uppercase tracking-wide font-semibold truncate ${muted}`}>{sublabel}</div>
            </div>
          </div>
          <div className={`flex items-center gap-0.5 flex-shrink-0 transition-opacity ${editing ? 'opacity-100' : rowActions}`}>
            <button
              onClick={() => setEditingId(editing ? null : m.id)}
              className={`p-1.5 rounded transition-colors ${editing ? (isDark ? 'bg-blue-600/30 text-blue-300' : 'bg-blue-100 text-blue-600') : (isDark ? 'hover:bg-slate-600 text-slate-300' : 'hover:bg-slate-200 text-slate-600')}`}
              title={editing ? 'Done editing' : 'Edit'}
            >
              {editing ? <Check size={14} /> : <Pencil size={14} />}
            </button>
            {(!isDeskItem(m) || m.kind === 'case') && (
              <button
                onClick={() => onRotate(m.id)}
                className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-slate-600 text-slate-300' : 'hover:bg-slate-200 text-slate-600'}`}
                title={m.kind === 'case' ? (m.lying ? 'Stand upright' : 'Lay on its side') : 'Rotate'}
              >
                <RotateCcw size={14} />
              </button>
            )}
            <button onClick={() => onRemove(m.id)} className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-red-900/50 text-red-400' : 'hover:bg-red-100 text-red-600'}`} title="Remove">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {editing && (
          <MonitorEditor monitor={m} isDark={isDark} onChange={(changes) => onUpdateMonitor(m.id, changes)} />
        )}

        {showColorPicker === m.id && (
          <div className="flex gap-1.5 flex-wrap p-2 rounded bg-black/10">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { onUpdateColor(m.id, c); setShowColorPicker(null); }}
                className={`w-6 h-6 lg:w-5 lg:h-5 rounded-full ${c} ${m.color === c ? 'ring-2 ring-white' : 'hover:scale-110'} transition-all`}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const screens = monitors.filter(m => !isDeskItem(m));
  const deskItems = monitors.filter(isDeskItem);

  const tabs: { id: Tab; label: string; Icon: typeof MonitorIcon; badge?: number }[] = [
    { id: 'setup', label: 'Setup', Icon: LayoutGrid, badge: monitors.length },
    { id: 'add', label: 'Add', Icon: Plus },
    { id: 'layouts', label: 'Layouts', Icon: FolderOpen },
  ];

  return (
    <div className={`h-full w-full flex flex-col lg:border-r transition-colors duration-300 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
      {/* Grab handle on the phone bottom sheet */}
      <div className="md:hidden flex justify-center pt-2">
        <div className={`w-10 h-1.5 rounded-full ${isDark ? 'bg-slate-600' : 'bg-slate-300'}`} />
      </div>

      <div className="px-4 pt-3 pb-3 flex items-center justify-between gap-2">
        <h1 className={`text-lg font-bold flex items-center gap-2 select-none ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
          <MonitorIcon size={20} />
          MultiView Planner
        </h1>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-slate-700 text-yellow-400' : 'hover:bg-slate-100 text-slate-600'}`}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={onClose}
            className={`lg:hidden p-2 rounded-full transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pb-3">
        <div className={`grid grid-cols-3 gap-1 p-1 rounded-lg ${isDark ? 'bg-slate-900/60' : 'bg-slate-100'}`}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-bold transition-colors ${
                tab === t.id
                  ? isDark ? 'bg-slate-700 text-white shadow' : 'bg-white text-slate-900 shadow'
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <t.Icon size={14} />
              {t.label}
              {t.badge ? (
                <span className={`text-[10px] px-1.5 rounded-full ${tab === t.id ? 'bg-blue-600 text-white' : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>{t.badge}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="relative px-4 pb-4 overflow-y-auto flex-1 custom-scrollbar">
        {/* SETUP */}
        {tab === 'setup' && (
          <div className="space-y-4">
            {monitors.length === 0 && (
              <div className={`text-center py-8 ${muted}`}>
                <p className="text-sm mb-3">Nothing in your setup yet.</p>
                <button onClick={() => setTab('add')} className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium inline-flex items-center gap-1.5">
                  <Plus size={16} /> Add your first display
                </button>
              </div>
            )}

            {screens.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h2 className={heading}>Screens</h2>
                  <span className={`text-[10px] ${muted}`}>Top of list = front layer</span>
                </div>
                {screens.map(renderRow)}
              </div>
            )}

            {deskItems.length > 0 && (
              <div className="space-y-2">
                <h2 className={heading}>On the desk</h2>
                {deskItems.map(renderRow)}
              </div>
            )}
          </div>
        )}

        {/* ADD */}
        {tab === 'add' && (
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-1">
              {KIND_OPTIONS.map(({ kind, label, Icon }) => (
                <button
                  key={kind}
                  onClick={() => chooseKind(kind)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-[10px] font-bold leading-tight transition-colors ${
                    newKind === kind
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>

            {(newKind === 'monitor' || newKind === 'laptop') ? (
              <div className="space-y-3">
                <div>
                  <label className={labelClass(isDark)}>Preset</label>
                  <select
                    key={newKind}
                    onChange={(e) => {
                      if (e.target.value === '') return;
                      applyPreset((newKind === 'laptop' ? LAPTOP_MODELS : MONITOR_MODELS)[parseInt(e.target.value)]);
                      e.target.value = '';
                    }}
                    className={inputClass(isDark)}
                    defaultValue=""
                  >
                    <option value="" disabled>{newKind === 'laptop' ? 'Choose a laptop...' : 'Choose a model...'}</option>
                    {(newKind === 'laptop' ? LAPTOP_MODELS : MONITOR_MODELS).map((m, idx) => (
                      <option key={idx} value={idx}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <ScreenSizeFields
                  diagonal={newDiag}
                  onDiagonal={setNewDiag}
                  ratioIdx={ratioIdx}
                  onRatioIdx={setRatioIdx}
                  custom={customRatio}
                  onCustom={setCustomRatio}
                  isDark={isDark}
                />

                {newKind === 'monitor' && <CurveField curve={newCurve} onChange={setNewCurve} isDark={isDark} />}

                <button
                  onClick={handleAddScreen}
                  className="w-full py-2.5 rounded-md flex items-center justify-center gap-2 text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-500 text-white"
                >
                  <Plus size={16} /> {newKind === 'laptop' ? 'Add Laptop' : 'Add Monitor'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className={`text-xs ${muted}`}>Tap a {newKind === 'case' ? 'case' : newKind} to put it on the desk.</p>
                {peripheralModels(newKind).map(model => (
                  <button
                    key={model.name}
                    onClick={() => add({ kind: newKind, name: model.name, size: model.size }, model.name)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors ${isDark ? 'border-slate-700 hover:bg-slate-700' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <div>
                      <div className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{model.name}</div>
                      <div className={`text-[11px] ${muted}`}>{formatSize(model)}</div>
                    </div>
                    <Plus size={16} className="text-blue-500 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {lastAdded && (
              <p className="text-xs font-medium text-emerald-500 flex items-center gap-1"><Check size={14} /> Added {lastAdded}</p>
            )}
          </div>
        )}

        {/* LAYOUTS */}
        {tab === 'layouts' && (
          <div className="space-y-5">
            <div className="space-y-3">
              <h2 className={`${heading} flex items-center gap-1.5`}><Sparkles size={13} /> Presets</h2>
              {/* Category filter; scrolls sideways, with arrows when it doesn't fit */}
              <div className="relative -mx-4">
                <div ref={chipsRef} onScroll={updateChipScroll} className="flex gap-1.5 overflow-x-auto pb-1 px-4 no-scrollbar">
                  {PRESET_CATEGORIES.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setPresetFilter(c.id)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border transition-colors ${
                        presetFilter === c.id
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                {chipScroll.left && (
                  <button
                    onClick={() => scrollChips(-1)}
                    className={`absolute left-0 top-0 bottom-1 w-9 flex items-center justify-start pl-1 bg-gradient-to-r ${isDark ? 'from-slate-800 via-slate-800/90 text-slate-200' : 'from-white via-white/90 text-slate-600'} to-transparent`}
                    title="More categories"
                  >
                    <ChevronLeft size={16} />
                  </button>
                )}
                {chipScroll.right && (
                  <button
                    onClick={() => scrollChips(1)}
                    className={`absolute right-0 top-0 bottom-1 w-9 flex items-center justify-end pr-1 bg-gradient-to-l ${isDark ? 'from-slate-800 via-slate-800/90 text-slate-200' : 'from-white via-white/90 text-slate-600'} to-transparent`}
                    title="More categories"
                  >
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {visiblePresets.map(({ preset, items }) => (
                  <button
                    key={preset.id}
                    onClick={() => onLoadLayout(preset.build(), preset.name)}
                    className={`flex items-stretch gap-3 p-2 rounded-lg border text-left transition-colors ${isDark ? 'border-slate-700 hover:border-blue-500 hover:bg-slate-700/50' : 'border-slate-200 hover:border-blue-500 hover:bg-blue-50/50'}`}
                    title="Replace the current setup with this one"
                  >
                    <div className={`w-24 h-16 flex-shrink-0 rounded-md p-1 ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
                      <SetupPreview items={items} isDark={isDark} />
                    </div>
                    <div className="min-w-0 py-0.5">
                      <div className={`text-sm font-semibold leading-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{preset.name}</div>
                      <div className={`text-[11px] leading-snug mt-0.5 ${muted}`}>{preset.description}</div>
                    </div>
                  </button>
                ))}
              </div>
              {pageCount > 1 && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setPresetPage(p => Math.max(0, p - 1))}
                    disabled={presetPage === 0}
                    className={`flex items-center gap-0.5 px-2 py-1 rounded-md text-xs font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <span className={`text-[11px] font-mono ${muted}`}>{presetPage + 1} / {pageCount}</span>
                  <button
                    onClick={() => setPresetPage(p => Math.min(pageCount - 1, p + 1))}
                    disabled={presetPage === pageCount - 1}
                    className="flex items-center gap-0.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              )}
              <p className={`text-[11px] ${muted}`}>Loading a preset replaces your current setup. You can undo it right after.</p>
            </div>

            <div className="space-y-3">
              <h2 className={`${heading} flex items-center gap-1.5`}><Save size={13} /> Your saved setups</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={layoutName}
                  onChange={(e) => setLayoutName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLayout(); }}
                  placeholder="Name this setup..."
                  className={inputClass(isDark)}
                />
                <button
                  onClick={handleSaveLayout}
                  disabled={!layoutName.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 rounded flex items-center justify-center transition-colors"
                  title="Save current setup"
                >
                  <Save size={16} />
                </button>
              </div>

              <div className="space-y-2">
                {savedLayouts.length === 0 && <p className={`text-xs italic ${muted}`}>No saved setups yet.</p>}
                {savedLayouts.map((layout) => (
                  <div key={layout.id} className={`p-2.5 rounded-lg flex items-center justify-between border transition-colors group ${isDark ? 'bg-slate-700/50 border-slate-700 hover:border-slate-500' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                    <div className="overflow-hidden">
                      <div className={`text-sm font-medium truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{layout.name}</div>
                      <div className={`text-[10px] ${muted}`}>{layout.monitors.length} items • {new Date(layout.timestamp).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onLoadLayout(layout.monitors, layout.name)}
                        className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-blue-600/20 text-blue-400' : 'hover:bg-blue-100 text-blue-600'}`}
                        title="Load this setup"
                      >
                        <Upload size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteLayout(layout.id)}
                        className={`p-1.5 rounded transition-colors ${rowActions} ${isDark ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-100 text-red-600'}`}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Totals for the screens in the setup */}
      <div className={`px-4 py-3 border-t grid grid-cols-2 gap-2 text-xs ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
        <div>
          <div className={`text-[10px] uppercase font-bold tracking-wide ${muted}`}>Total width</div>
          <div className={`font-mono ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{monitors.length ? formatDim(stats.width) : '—'}</div>
        </div>
        <div>
          <div className={`text-[10px] uppercase font-bold tracking-wide ${muted}`}>Screen area</div>
          <div className={`font-mono ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{monitors.length ? `${Math.round(stats.area)} sq in` : '—'}</div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
