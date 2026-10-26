import React from 'react';
import { Box, Square } from 'lucide-react';

interface ViewModeToggleProps {
  mode: '2d' | '3d';
  onChange: (mode: '2d' | '3d') => void;
  theme: 'dark' | 'light';
}

const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ mode, onChange, theme }) => {
  const isDark = theme === 'dark';

  const options: { value: '2d' | '3d'; label: string; icon: React.ReactNode }[] = [
    { value: '2d', label: '2D', icon: <Square size={14} /> },
    { value: '3d', label: '3D', icon: <Box size={14} /> },
  ];

  return (
    <div
      className={`absolute top-4 left-4 flex gap-1 backdrop-blur p-1 rounded-lg border shadow-xl z-40 transition-colors duration-300 ${isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-white/90 border-slate-200'}`}
      onMouseDown={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
    >
      {options.map(opt => {
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
              active
                ? 'bg-blue-500 text-white shadow'
                : isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
            title={`${opt.label} View`}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default ViewModeToggle;
