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

export type DeviceKind = 'monitor' | 'laptop' | 'keyboard' | 'mouse' | 'case';

// Physical size of a keyboard, mouse or PC case in inches: width, depth (front to back) and height
export interface PeripheralSize {
  w: number;
  d: number;
  h: number;
}

export interface PeripheralModel {
  name: string;
  size: PeripheralSize;
}

// What the add form hands to the app; screens use diagonal/ratio, peripherals use size
export interface NewItem {
  kind: DeviceKind;
  diagonal?: number;
  ratio?: AspectRatio;
  curve?: number;
  name?: string;
  size?: PeripheralSize;
}

export interface Monitor {
  id: string;
  kind?: DeviceKind; // Undefined means a monitor
  name?: string; // Preset name, shown for keyboards and mice
  size?: PeripheralSize; // Keyboards, mice and PC cases only
  lying?: boolean; // PC cases: lying on their side instead of standing upright
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
  tilt?: number; // Lean in degrees, used by the 3D view; positive leans the top back. For laptops it's the lid's lean back from upright.
}

// Fields the sidebar and 3D view can change on an existing item
export type MonitorChanges = Partial<Pick<Monitor, 'diagonal' | 'ratio' | 'curve' | 'angle' | 'depth' | 'tilt' | 'size' | 'name' | 'x' | 'lying'>>;

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