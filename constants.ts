import { AspectRatio, MonitorModel } from './types';

export const PPI_SCALE = 15;

export const COLORS = [
  'bg-blue-500', 
  'bg-emerald-500', 
  'bg-violet-500', 
  'bg-rose-500', 
  'bg-amber-500', 
  'bg-cyan-500', 
  'bg-fuchsia-500', 
  'bg-indigo-500',
  'bg-red-500',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-lime-500',
  'bg-green-500',
  'bg-teal-500',
  'bg-sky-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-slate-500'
];

export const ASPECT_RATIOS: AspectRatio[] = [
  { label: '16:9 (Standard)', w: 16, h: 9 },
  { label: '21:9 (Ultrawide)', w: 21, h: 9 },
  { label: '32:9 (Super Ultrawide)', w: 32, h: 9 },
  { label: '16:10 (Productivity)', w: 16, h: 10 },
  { label: '16:18 (DualUp)', w: 16, h: 18 },
  { label: '4:3 (Retro/iPad)', w: 4, h: 3 },
  { label: '1:1 (Square)', w: 1, h: 1 },
];

export const MONITOR_MODELS: MonitorModel[] = [
  { name: 'Dell UltraSharp 27" (U2723QE)', diagonal: 27, ratio: { label: '16:9 (Standard)', w: 16, h: 9 } },
  { name: 'LG 27" UltraGear (27GL850-B)', diagonal: 27, ratio: { label: '16:9 (Standard)', w: 16, h: 9 } },
  { name: 'Samsung Odyssey G9 49"', diagonal: 49, ratio: { label: '32:9 (Super Ultrawide)', w: 32, h: 9 } },
  { name: 'LG 34" Curved Ultrawide (34WN80C-B)', diagonal: 34, ratio: { label: '21:9 (Ultrawide)', w: 21, h: 9 } },
  { name: 'Apple Studio Display 27"', diagonal: 27, ratio: { label: '16:9 (Standard)', w: 16, h: 9 } },
  { name: 'Apple Pro Display XDR 32"', diagonal: 32, ratio: { label: '16:9 (Standard)', w: 16, h: 9 } },
  { name: 'ASUS ProArt 32" (PA329CV)', diagonal: 32, ratio: { label: '16:9 (Standard)', w: 16, h: 9 } },
  { name: 'Dell UltraSharp 32" (U3223QE)', diagonal: 32, ratio: { label: '16:9 (Standard)', w: 16, h: 9 } },
  { name: 'LG DualUp 28" (28MQ780-B)', diagonal: 27.6, ratio: { label: '16:18 (DualUp)', w: 16, h: 18 } },
  { name: 'Alienware 34" QD-OLED (AW3423DW)', diagonal: 34, ratio: { label: '21:9 (Ultrawide)', w: 21, h: 9 } },
  { name: 'Samsung Odyssey Neo G8 32"', diagonal: 32, ratio: { label: '16:9 (Standard)', w: 16, h: 9 } },
  { name: 'BenQ PD2700U 27"', diagonal: 27, ratio: { label: '16:9 (Standard)', w: 16, h: 9 } },
];