import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Monitor as MonitorIcon, RotateCcw, Save, FolderOpen, Upload, Sun, Moon, Palette, Settings2, GripVertical } from 'lucide-react';
import { Monitor, AspectRatio, CanvasStats, SavedLayout } from '../types';
import { ASPECT_RATIOS, COLORS } from '../constants';
import { formatDim } from '../utils';

interface SidebarProps {
  monitors: Monitor[];
  onAdd: (diagonal: number, ratio: AspectRatio) => void;
  onRemove: (id: string) => void;
  onRotate: (id: string) => void;
  onUpdateColor: (id: string, color: string) => void;
  onLoadLayout: (monitors: Monitor[]) => void;
  onReorder: (startIndex: number, endIndex: number) => void;
  stats: CanvasStats;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  transparencyEnabled: boolean;
  onToggleTransparency: () => void;
  globalOpacity: number;
  onOpacityChange: (value: number) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  monitors, onAdd, onRemove, onRotate, onUpdateColor, onLoadLayout, onReorder, stats, theme, onToggleTheme,
  transparencyEnabled, onToggleTransparency, globalOpacity, onOpacityChange
}) => {
  const [newDiag, setNewDiag] = useState<string>("27");
  const [ratioIdx, setRatioIdx] = useState<number>(0);
  const [customRatio, setCustomRatio] = useState<{ w: string, h: string }>({ w: "16", h: "9" });
  
  // Reordering State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Storage State
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([]);
  const [layoutName, setLayoutName] = useState("");
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);

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

  const handleAddClick = () => {
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
        onAdd(diag, finalRatio);
    }
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

  return (
    <div className={`w-80 flex-shrink-0 border-r transition-colors duration-300 flex flex-col shadow-xl z-20 h-full ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
      <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 select-none ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            <MonitorIcon size={24} />
            MultiView Planner
          </h1>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Compare screen sizes & plan layouts.</p>
        </div>
        <button 
          onClick={onToggleTheme}
          className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-slate-700 text-yellow-400' : 'hover:bg-slate-100 text-slate-600'}`}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
        {/* UNIVERSAL DISPLAY SETTINGS */}
        <div className={`p-4 rounded-lg space-y-4 border transition-colors ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-blue-50/50 border-blue-100'}`}>
          <h2 className={`text-sm font-semibold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            <Settings2 size={14} /> Universal Settings
          </h2>
          
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Enable Transparency</span>
            <button 
              onClick={onToggleTransparency}
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${transparencyEnabled ? 'bg-blue-600' : 'bg-slate-400'}`}
            >
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${transparencyEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className={`text-[10px] font-bold uppercase tracking-tight ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Opacity Level</label>
              <span className={`text-[10px] font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{globalOpacity}%</span>
            </div>
            <input 
              type="range"
              min="0"
              max="100"
              step="5"
              value={globalOpacity}
              onChange={(e) => onOpacityChange(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
              disabled={!transparencyEnabled}
            />
          </div>
        </div>

        {/* LIST - Now Draggable */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Displays & Layers</h2>
            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>Top Layer at Start</span>
          </div>
          {monitors.length === 0 && <p className={`text-sm italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No displays added.</p>}
          
          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
            {monitors.map((m, index) => (
              <div 
                key={m.id} 
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={() => setDraggedIndex(null)}
                className={`p-3 rounded flex flex-col gap-2 border transition-all group ${
                  draggedIndex === index ? 'opacity-40 scale-95' : 'opacity-100'
                } ${isDark ? 'bg-slate-700 border-transparent hover:border-slate-500' : 'bg-slate-50 border-slate-200 hover:border-slate-300'} cursor-grab active:cursor-grabbing`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical size={14} className={`flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <button 
                      onClick={() => setShowColorPicker(showColorPicker === m.id ? null : m.id)}
                      className={`w-4 h-4 rounded-full ${m.color} ring-2 ring-offset-1 transition-all ${isDark ? 'ring-offset-slate-700 ring-white/20 hover:ring-white/50' : 'ring-offset-slate-50 ring-black/10 hover:ring-black/30'}`}
                      title="Change color"
                    ></button>
                    <div>
                      <div className={`text-sm font-medium transition-colors ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{m.diagonal}" {m.ratio.label.split(' ')[0]}</div>
                      <div className={`text-[10px] uppercase tracking-wide font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{m.orientation}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onRotate(m.id)} className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-slate-600 text-slate-300' : 'hover:bg-slate-200 text-slate-600'}`} title="Rotate">
                      <RotateCcw size={14} />
                    </button>
                    <button onClick={() => onRemove(m.id)} className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-red-900/50 text-red-400' : 'hover:bg-red-100 text-red-600'}`} title="Remove">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {showColorPicker === m.id && (
                  <div className="flex gap-1.5 flex-wrap p-2 rounded bg-black/10 animate-in fade-in zoom-in-95 duration-150">
                    {COLORS.map((c) => (
                      <button 
                        key={c} 
                        onClick={() => { onUpdateColor(m.id, c); setShowColorPicker(null); }}
                        className={`w-5 h-5 rounded-full ${c} ${m.color === c ? 'ring-2 ring-white' : 'hover:scale-110'} transition-all`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ADD FORM */}
        <div className={`p-4 rounded-lg space-y-3 border transition-colors ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
          <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Add Display</h2>
          
          <div>
            <label className={`block text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Diagonal Size (inches)</label>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                value={newDiag} 
                onChange={(e) => setNewDiag(e.target.value)}
                className={`w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${isDark ? 'bg-slate-900 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                min="5" max="100"
              />
              <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>"</span>
            </div>
          </div>

          <div>
            <label className={`block text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Aspect Ratio</label>
            <select 
              value={ratioIdx}
              onChange={(e) => setRatioIdx(parseInt(e.target.value))}
              className={`w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${isDark ? 'bg-slate-900 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
            >
              {ASPECT_RATIOS.map((r, idx) => (
                <option key={idx} value={idx}>{r.label}</option>
              ))}
              <option value={-1}>Custom...</option>
            </select>
          </div>

          {ratioIdx === -1 && (
            <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <div>
                <label className={`block text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Width Ratio</label>
                <input 
                  type="number"
                  value={customRatio.w}
                  onChange={(e) => setCustomRatio(p => ({ ...p, w: e.target.value }))}
                  className={`w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${isDark ? 'bg-slate-900 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                  placeholder="16"
                />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Height Ratio</label>
                <input 
                  type="number"
                  value={customRatio.h}
                  onChange={(e) => setCustomRatio(p => ({ ...p, h: e.target.value }))}
                  className={`w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${isDark ? 'bg-slate-900 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                  placeholder="9"
                />
              </div>
            </div>
          )}

          <button 
            onClick={handleAddClick}
            className={`w-full py-2 rounded-md flex items-center justify-center gap-2 text-sm font-medium transition-colors ${isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          >
            <Plus size={16} /> Add Display
          </button>
        </div>
        
        {/* SAVED LAYOUTS SECTION */}
        <div className={`space-y-2 pt-2 border-t transition-colors ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <h2 className={`text-sm font-semibold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                <FolderOpen size={14} /> Saved Setups
            </h2>
            
            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={layoutName}
                    onChange={(e) => setLayoutName(e.target.value)}
                    placeholder="Layout name..."
                    className={`flex-1 border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${isDark ? 'bg-slate-900 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
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

            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                {savedLayouts.length === 0 && <p className={`text-xs italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No saved layouts.</p>}
                {savedLayouts.map((layout) => (
                    <div key={layout.id} className={`p-2 rounded flex items-center justify-between border transition-colors group ${isDark ? 'bg-slate-700/50 border-slate-700 hover:border-slate-500' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                        <div className="overflow-hidden">
                            <div className={`text-sm font-medium truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{layout.name}</div>
                            <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{layout.monitors.length} displays • {new Date(layout.timestamp).toLocaleDateString()}</div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={() => onLoadLayout(layout.monitors)}
                                className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-blue-600/20 text-blue-400' : 'hover:bg-blue-100 text-blue-600'}`}
                                title="Load this setup"
                            >
                                <Upload size={14} />
                            </button>
                            <button 
                                onClick={() => handleDeleteLayout(layout.id)}
                                className={`p-1.5 rounded transition-colors opacity-0 group-hover:opacity-100 ${isDark ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-100 text-red-600'}`}
                                title="Delete"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* STATS */}
        {monitors.length > 0 && (
          <div className={`p-3 rounded border space-y-2 text-sm transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
            <div className="flex justify-between">
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Total Width:</span>
              <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>{formatDim(stats.width)}</span>
            </div>
            <div className="flex justify-between">
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Total Area:</span>
              <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>{Math.round(stats.area)} sq in</span>
            </div>
          </div>
        )}
      </div>
      
      <div className={`p-4 border-t text-xs text-center select-none transition-colors ${isDark ? 'bg-slate-900 border-slate-700 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
        Drag to move • Snap enabled
      </div>
    </div>
  );
};

export default Sidebar;