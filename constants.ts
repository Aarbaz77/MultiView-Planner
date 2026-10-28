import { AspectRatio, DeviceKind, MonitorModel, MountKind, PeripheralModel } from './types';

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
  { label: '3:2 (Surface/Laptop)', w: 3, h: 2 },
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

export const MOUNT_CAPACITY: Record<MountKind, number> = {
  single: 1,
  dual: 2,
  triple: 3,
};

// Common curvature radii in mm, tightest first
export const CURVE_OPTIONS = [800, 1000, 1500, 1800, 2300, 3000, 3800];

const R16_9: AspectRatio = { label: '16:9 (Standard)', w: 16, h: 9 };
const R16_10: AspectRatio = { label: '16:10 (Productivity)', w: 16, h: 10 };

export const LAPTOP_MODELS: MonitorModel[] = [
  { name: '13.3" Laptop (16:9)', diagonal: 13.3, ratio: R16_9 },
  { name: 'MacBook Air 13" (13.6")', diagonal: 13.6, ratio: R16_10 },
  { name: 'Surface Laptop 13.5" (3:2)', diagonal: 13.5, ratio: { label: '3:2 (Surface/Laptop)', w: 3, h: 2 } },
  { name: '14" Laptop (16:10)', diagonal: 14, ratio: R16_10 },
  { name: 'MacBook Pro 14" (14.2")', diagonal: 14.2, ratio: R16_10 },
  { name: 'MacBook Air 15" (15.3")', diagonal: 15.3, ratio: R16_10 },
  { name: '15.6" Laptop (16:9)', diagonal: 15.6, ratio: R16_9 },
  { name: '16" Laptop (16:10)', diagonal: 16, ratio: R16_10 },
  { name: 'MacBook Pro 16" (16.2")', diagonal: 16.2, ratio: R16_10 },
  { name: '17.3" Laptop (16:9)', diagonal: 17.3, ratio: R16_9 },
];

// How far (inches) in front of the monitor wall new desk items start in 3D
export const DESK_ITEM_DEPTH: Record<DeviceKind, number> = {
  monitor: 0,
  laptop: 10,
  keyboard: 14,
  mouse: 14,
  // Cases stand with their back on the monitor line, beside the monitors
  case: 0,
};

// A laptop lid leans back this far from upright unless changed
export const LAPTOP_DEFAULT_TILT = 18;

export const KEYBOARD_MODELS: PeripheralModel[] = [
  { name: 'Full-size', size: { w: 17.4, d: 5.5, h: 1.3 } },
  { name: 'TKL (tenkeyless)', size: { w: 14.2, d: 5.3, h: 1.3 } },
  { name: '75%', size: { w: 12.7, d: 5.3, h: 1.3 } },
  { name: '65%', size: { w: 12.4, d: 4.3, h: 1.3 } },
  { name: '60%', size: { w: 11.6, d: 4.1, h: 1.3 } },
  { name: 'Low-profile (Magic Keyboard)', size: { w: 11, d: 4.5, h: 0.4 } },
];

// Width × depth × height of typical cases, in inches
export const CASE_MODELS: PeripheralModel[] = [
  { name: 'Mini-ITX (small form factor)', size: { w: 7.4, d: 14.5, h: 11.2 } },
  { name: 'Micro-ATX tower', size: { w: 8.3, d: 15.7, h: 16.5 } },
  { name: 'Mid tower (ATX)', size: { w: 8.7, d: 17.7, h: 18.5 } },
  { name: 'Dual-chamber (O11-style)', size: { w: 10.8, d: 17.9, h: 18.1 } },
  { name: 'Full tower (E-ATX)', size: { w: 9.5, d: 21, h: 23 } },
  { name: 'Mac mini', size: { w: 5, d: 5, h: 2 } },
  { name: 'Mac Studio', size: { w: 7.7, d: 7.7, h: 3.7 } },
];

export const MOUSE_MODELS: PeripheralModel[] = [
  { name: 'Standard mouse', size: { w: 2.6, d: 4.9, h: 1.6 } },
  { name: 'Compact mouse', size: { w: 2.3, d: 4.2, h: 1.4 } },
  { name: 'Ergonomic mouse (large)', size: { w: 3.4, d: 5.1, h: 1.8 } },
  { name: 'Trackpad', size: { w: 6.3, d: 4.5, h: 0.4 } },
];
