export interface AspectRatio {
  label: string;
  w: number;
  h: number;
}

export interface MonitorModel {
  name: string;
  diagonal: number;
  ratio: AspectRatio;
}

export type MountKind = 'single' | 'dual' | 'triple';
export type MountOption = 'stand' | MountKind;

export interface MonitorMount {
  kind: MountKind;
  groupId: string;
}

export interface Monitor {
  id: string;
  diagonal: number;
  ratio: AspectRatio;
  orientation: 'landscape' | 'portrait';
  x: number;
  y: number;
  color: string;
  mount?: MonitorMount; // VESA arm group; no mount means a desk stand
  curve?: number; // Curvature radius in mm (1800 = 1800R); undefined means flat
  depth?: number; // Forward (+) or back (-) from the monitor wall in inches, used by the 3D view
  angle?: number; // Turn around the vertical axis in degrees, used by the 3D view; positive turns it to face right (left edge forward)
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