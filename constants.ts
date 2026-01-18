import { AspectRatio } from './types';

export const PPI_SCALE = 15;

export const COLORS = [
  'bg-blue-500', 
  'bg-emerald-500', 
  'bg-violet-500', 
  'bg-rose-500', 
  'bg-amber-500', 
  'bg-cyan-500', 
  'bg-fuchsia-500', 
  'bg-indigo-500'
];

export const ASPECT_RATIOS: AspectRatio[] = [
  { label: '16:9 (Standard)', w: 16, h: 9 },
  { label: '21:9 (Ultrawide)', w: 21, h: 9 },
  { label: '32:9 (Super Ultrawide)', w: 32, h: 9 },
  { label: '16:10 (Productivity)', w: 16, h: 10 },
  { label: '4:3 (Retro/iPad)', w: 4, h: 3 },
  { label: '1:1 (Square)', w: 1, h: 1 },
];