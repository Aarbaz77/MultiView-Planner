export interface AspectRatio {
  label: string;
  w: number;
  h: number;
}

export interface Monitor {
  id: string;
  diagonal: number;
  ratio: AspectRatio;
  orientation: 'landscape' | 'portrait';
  x: number;
  y: number;
  color: string;
}

export interface DragState {
  type: 'monitor' | 'pan';
  id: string | null;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
}

export interface CanvasStats {
  area: number;
  width: number;
}

export interface SavedLayout {
  id: string;
  name: string;
  timestamp: number;
  monitors: Monitor[];
}