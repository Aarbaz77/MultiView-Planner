import React, { useState, useRef, useEffect, useMemo } from 'react';
import { usePinchZoom } from '../usePinchZoom';
import { RotateCcw, ZoomIn, ZoomOut, Eraser, X, Magnet } from 'lucide-react';
import { Monitor, MonitorChanges, MountKind, MountOption } from '../types';
import { getCurveGeometry, getItemLabel, getLaptopBody, getMonitorSizePx, isCase, isDeskItem, isLaptop, isPeripheral, pickMountMembers } from '../utils';
import { PPI_SCALE, MOUNT_CAPACITY, DESK_ITEM_DEPTH, LAPTOP_DEFAULT_TILT } from '../constants';

interface Scene3DProps {
  monitors: Monitor[];
  theme: 'dark' | 'light';
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onApplyMount: (monitorId: string, option: MountOption) => void;
  onClearMounts: () => void;
  onMoveMonitor: (id: string, x: number, y: number, snapThreshold: number) => void;
  onUpdateMonitor: (id: string, changes: MonitorChanges) => void;
}

interface Framing {
  centerX: number;
  centerY: number;
  fitScale: number;
}

interface Camera {
  yaw: number;
  pitch: number;
  zoom: number;
}

// Physical sizes in inches, converted to px with PPI_SCALE
const BODY_DEPTH = 1.2 * PPI_SCALE;
const BEZEL = 4;
const LAYER_GAP = 2 * PPI_SCALE;
const STAND_CLEARANCE = 4 * PPI_SCALE;
const NECK_WIDTH = 2.5 * PPI_SCALE;
const NECK_DEPTH = 1 * PPI_SCALE;
const BASE_WIDTH = 9 * PPI_SCALE;
const BASE_DEPTH = 7 * PPI_SCALE;
const POLE_SIZE = 1.5 * PPI_SCALE;
const POLE_OFFSET = 5 * PPI_SCALE;
const POLE_HEADROOM = 4 * PPI_SCALE;
const CLAMP_WIDTH = 4 * PPI_SCALE;
const ARM_THICKNESS = 1 * PPI_SCALE;
const ELBOW_SETBACK = 3 * PPI_SCALE;
const VESA_PLATE = 4 * PPI_SCALE;
const VESA_DEPTH = 0.4 * PPI_SCALE;

const DEFAULT_CAMERA: Camera = { yaw: -28, pitch: -14, zoom: 1 };

// Turning monitors around the vertical axis
const EDGE_TOLERANCE = 2;
const ANGLE_SNAP = 15;
const ANGLE_MAGNET = 4;
const WRAP_STEP = 30;
const ANGLE_PRESETS = [-45, -30, -15, 0, 15, 30, 45];

// Leaning monitors forward/back, and opening laptop lids, in degrees
const TILT_MIN = -15;
const TILT_MAX = 25;
const TILT_PRESETS = [-10, -5, 0, 5, 10, 15, 20];
const LID_MAX = 60;
const LID_PRESETS = [100, 110, 120, 135];

const snapTilt = (deg: number) => {
  const rounded = Math.round(deg);
  return Math.abs(deg) < 1.5 ? 0 : rounded;
};

// Moving monitors forward and back, in inches
const DEPTH_LIMIT = 36;
const DEPTH_MAGNET = 0.75;

// Clamp, pull towards the wall line or another monitor's depth when close, otherwise round to half inches
const snapDepth = (inches: number, others: number[]) => {
  const clamped = Math.max(-DEPTH_LIMIT, Math.min(DEPTH_LIMIT, inches));
  const target = [0, ...others].find(t => Math.abs(clamped - t) <= DEPTH_MAGNET);
  return target ?? Math.round(clamped * 2) / 2;
};

const formatDepth = (inches: number) =>
  `${inches > 0 ? '+' : ''}${inches}" (${Math.round(inches * 2.54)} cm)`;

// Clamp to ±90°, pull towards the nearest 15° step when close, otherwise round to `step`
const snapAngle = (deg: number, step = 1) => {
  const clamped = Math.max(-90, Math.min(90, deg));
  const nearest = Math.round(clamped / ANGLE_SNAP) * ANGLE_SNAP;
  if (Math.abs(clamped - nearest) <= ANGLE_MAGNET) return nearest;
  return Math.round(clamped / step) * step;
};

const MOUNT_OPTIONS: { value: MountOption; label: string; hint: string }[] = [
  { value: 'stand', label: 'Stand', hint: 'Desk stand' },
  { value: 'single', label: 'Single', hint: '1-monitor arm' },
  { value: 'dual', label: 'Dual', hint: '2-monitor arm' },
  { value: 'triple', label: 'Triple', hint: '3-monitor arm' },
];

interface Box {
  monitor: Monitor;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  curve: ReturnType<typeof getCurveGeometry>;
  curveDepth: number; // How far the curved panel's edges come forward of its centre, in px
  backZ: number; // Back of the panel's centre, where the stand or VESA plate attaches
}

interface ArmGroup {
  id: string;
  kind: MountKind;
  members: Box[];
}

// Where a monitor ends up in 3D: its centre on the desk plane, its turn, and how many
// hinges separate it from the monitor nearest the middle of the setup
interface Placement {
  cx: number;
  cz: number;
  yaw: number;
  hops: number;
}

// A point given relative to the monitor's centre, turned with it, in world x/z
const toWorld = (p: Placement, lx: number, lz: number) => {
  const t = p.yaw * Math.PI / 180;
  return { x: p.cx + lx * Math.cos(t) + lz * Math.sin(t), z: p.cz - lx * Math.sin(t) + lz * Math.cos(t) };
};

// Monitors whose side edges touch in the layout stay joined at their front edges when turned.
// Each one hinges onto the touching neighbour that sits closer to the middle, so a turned
// outer monitor swings around its inner edge instead of drifting away.
const computePlacements = (boxes: Box[], middleX: number, joinEdges: boolean) => {
  const placements = new Map<string, Placement>();
  const centreDist = (b: Box) => Math.abs(b.x + b.w / 2 - middleX);
  const frontEdgeZ = (b: Box) => BODY_DEPTH / 2 + b.curveDepth / 2;

  const innerNeighbour = (b: Box) => {
    let best: { box: Box; onLeft: boolean; overlap: number } | null = null;
    boxes.forEach(o => {
      if (o === b || isDeskItem(o.monitor)) return;
      // Hinge onto a neighbour nearer the middle; when two are equally near (a centred pair),
      // the right one hinges onto the left so the pair stays joined
      const nearer = centreDist(o) < centreDist(b) - 0.5;
      const tiedOnLeft = Math.abs(centreDist(o) - centreDist(b)) <= 0.5 && o.x < b.x;
      if (!nearer && !tiedOnLeft) return;
      const overlap = Math.min(b.y + b.h, o.y + o.h) - Math.max(b.y, o.y);
      if (overlap <= 0) return;
      const onLeft = Math.abs(o.x + o.w - b.x) < EDGE_TOLERANCE;
      const onRight = Math.abs(b.x + b.w - o.x) < EDGE_TOLERANCE;
      if ((onLeft || onRight) && (!best || overlap > best.overlap)) best = { box: o, onLeft, overlap };
    });
    return best as { box: Box; onLeft: boolean; overlap: number } | null;
  };

  const place = (b: Box): Placement => {
    const known = placements.get(b.monitor.id);
    if (known) return known;
    const yaw = b.monitor.angle ?? 0;
    const depth = (b.monitor.depth ?? 0) * PPI_SCALE;
    const hinge = joinEdges && !isDeskItem(b.monitor) ? innerNeighbour(b) : null;
    let placement: Placement;
    if (hinge) {
      const parent = place(hinge.box);
      // The neighbour's touching edge, and this monitor's matching edge in its own frame
      const joint = toWorld(parent, (hinge.onLeft ? 1 : -1) * hinge.box.w / 2, frontEdgeZ(hinge.box));
      const own = toWorld({ cx: 0, cz: 0, yaw, hops: 0 }, (hinge.onLeft ? -1 : 1) * b.w / 2, frontEdgeZ(b));
      placement = { cx: joint.x - own.x, cz: joint.z - own.z + depth, yaw, hops: parent.hops + 1 };
    } else {
      placement = { cx: b.x + b.w / 2, cz: b.z + depth, yaw, hops: 0 };
    }
    placements.set(b.monitor.id, placement);
    return placement;
  };

  boxes.forEach(place);
  return placements;
};

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// A face of a cuboid of size (w, h, d), centred on the cuboid's centre
const Face: React.FC<{
  fw: number; fh: number; boxW: number; boxH: number; transform: string;
  className?: string; children?: React.ReactNode;
}> = ({ fw, fh, boxW, boxH, transform, className = '', children }) => (
  <div
    className={`absolute ${className}`}
    style={{
      width: fw,
      height: fh,
      left: (boxW - fw) / 2,
      top: (boxH - fh) / 2,
      transform,
    }}
  >
    {children}
  </div>
);

const Cuboid: React.FC<{
  w: number; h: number; d: number; style?: React.CSSProperties;
  front?: React.ReactNode; frontClass: string; sideClass: string; topClass: string;
  side?: React.ReactNode; sideFaceClass?: string; top?: React.ReactNode;
  events?: React.DOMAttributes<HTMLDivElement>;
}> = ({ w, h, d, style, front, frontClass, sideClass, topClass, side, sideFaceClass, top, events }) => (
  <div className="absolute" style={{ width: w, height: h, transformStyle: 'preserve-3d', ...style }} {...events}>
    <Face fw={w} fh={h} boxW={w} boxH={h} transform={`translateZ(${d / 2}px)`} className={frontClass}>{front}</Face>
    <Face fw={w} fh={h} boxW={w} boxH={h} transform={`rotateY(180deg) translateZ(${d / 2}px)`} className={sideClass} />
    <Face fw={d} fh={h} boxW={w} boxH={h} transform={`rotateY(90deg) translateZ(${w / 2}px)`} className={sideFaceClass ?? sideClass}>{side}</Face>
    <Face fw={d} fh={h} boxW={w} boxH={h} transform={`rotateY(-90deg) translateZ(${w / 2}px)`} className={sideFaceClass ?? sideClass}>{side}</Face>
    <Face fw={w} fh={d} boxW={w} boxH={h} transform={`rotateX(90deg) translateZ(${h / 2}px)`} className={topClass}>{top}</Face>
    <Face fw={w} fh={d} boxW={w} boxH={h} transform={`rotateX(-90deg) translateZ(${h / 2}px)`} className={sideClass} />
  </div>
);

// A horizontal square bar from (x1, y, z1) to (x2, y, z2)
const Beam: React.FC<{
  x1: number; z1: number; x2: number; z2: number; y: number; t: number;
  sideClass: string; topClass: string;
}> = ({ x1, z1, x2, z2, y, t, sideClass, topClass }) => {
  const length = Math.hypot(x2 - x1, z2 - z1);
  if (length < 1) return null;
  const angle = Math.atan2(-(z2 - z1), x2 - x1) * 180 / Math.PI;
  return (
    <Cuboid
      w={length} h={t} d={t}
      style={{ left: x1, top: y - t / 2, transformOrigin: '0 50%', transform: `translateZ(${z1}px) rotateY(${angle}deg)` }}
      frontClass={sideClass} sideClass={sideClass} topClass={topClass}
    />
  );
};

// Small top-down glyphs for the mount palette
const MountGlyph: React.FC<{ option: MountOption }> = ({ option }) => {
  if (option === 'stand') {
    return (
      <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="5" width="22" height="13" rx="1.5" />
        <path d="M16 18v6M10 27h12" />
      </svg>
    );
  }
  const screens = MOUNT_CAPACITY[option];
  const xs = screens === 1 ? [16] : screens === 2 ? [9, 23] : [5, 16, 27];
  return (
    <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {xs.map(x => <rect key={x} x={x - (screens === 3 ? 4 : 6)} y="4" width={screens === 3 ? 8 : 12} height="9" rx="1" />)}
      <path d="M16 15v13M12 28h8" />
      {xs.map(x => <path key={`arm-${x}`} d={`M16 17 L${x} 13`} />)}
    </svg>
  );
};

const Scene3D: React.FC<Scene3DProps> = ({ monitors, theme, selectedId, onSelect, onApplyMount, onClearMounts, onMoveMonitor, onUpdateMonitor }) => {
  const isDark = theme === 'dark';
  const containerRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [fitScale, setFitScale] = useState(1);
  const dragRef = useRef<{ startX: number; startY: number; yaw: number; pitch: number; moved: boolean } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Moving a monitor; the framing is frozen meanwhile so the scene doesn't re-centre under the cursor
  const moveRef = useRef<{
    id: string; mode: 'move' | 'rotate' | 'depth' | 'slide'; startX: number; startY: number;
    // Slide mode: everything carried along (a monitor on its stand, or every monitor on an arm)
    group: { id: string; x: number; depth: number }[];
    initX: number; initY: number; initAngle: number; initDepth: number; unitsZ: number; deskItem: boolean; unitsX: number; unitsY: number; scale: number;
  } | null>(null);
  const frozenFrameRef = useRef<Framing | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  // Rotation
  const [joinEdges, setJoinEdges] = useState(true);

  // Mount drag-and-drop
  const [draggedMount, setDraggedMount] = useState<MountOption | null>(null);
  // Touch-friendly alternative to dragging: tap a mount, then tap a monitor
  const [armedMount, setArmedMount] = useState<MountOption | null>(null);
  // On phones only one of the bottom panels shows at a time
  const [mobilePanel, setMobilePanel] = useState<'mounts' | 'position' | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // --- GEOMETRY ---
  const { boxes, bounds, deskY } = useMemo(() => {
    const boxes: Box[] = monitors.map(m => {
      const { w, h } = getMonitorSizePx(m);
      const curve = getCurveGeometry(m);
      return { monitor: m, x: m.x, y: m.y, w, h, z: 0, curve, curveDepth: curve ? curve.depth * PPI_SCALE : 0, backZ: 0 };
    });

    // Earlier monitors are drawn on top in 2D, so push overlapped later ones further back
    boxes.forEach((box, i) => {
      if (isDeskItem(box.monitor)) {
        box.backZ = box.z;
        return;
      }
      let layer = 0;
      for (let j = 0; j < i; j++) {
        if (!isDeskItem(boxes[j].monitor) && overlaps(box, boxes[j])) layer = Math.max(layer, Math.round(-boxes[j].z / (BODY_DEPTH + LAYER_GAP)) + 1);
      }
      box.z = -layer * (BODY_DEPTH + LAYER_GAP);
      box.backZ = box.z - box.curveDepth / 2 - BODY_DEPTH / 2;
    });

    if (boxes.length === 0) return { boxes, bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 }, deskY: 0 };

    const minX = Math.min(...boxes.map(b => b.x));
    const maxX = Math.max(...boxes.map(b => b.x + b.w));
    const wall = boxes.filter(b => !isDeskItem(b.monitor));
    if (wall.length === 0) {
      // Only desk items: the desk is the floor and the tallest item sets the height
      const tallest = Math.max(...boxes.map(b =>
        (isLaptop(b.monitor) ? getLaptopBody(b.monitor).lidH : Math.max(b.monitor.size?.h ?? 2, 6)) * PPI_SCALE
      ));
      return { boxes, bounds: { minX, maxX, minY: -tallest, maxY: 0 }, deskY: 0 };
    }
    const minY = Math.min(...wall.map(b => b.y));
    const maxY = Math.max(...wall.map(b => b.y + b.h));
    return { boxes, bounds: { minX, maxX, minY, maxY }, deskY: maxY + STAND_CLEARANCE };
  }, [monitors]);

  const armGroups = useMemo(() => {
    const groups = new Map<string, ArmGroup>();
    boxes.forEach(b => {
      const mount = b.monitor.mount;
      if (!mount) return;
      const group = groups.get(mount.groupId) ?? { id: mount.groupId, kind: mount.kind, members: [] };
      group.members.push(b);
      groups.set(mount.groupId, group);
    });
    return Array.from(groups.values());
  }, [boxes]);

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + deskY) / 2;
  const sceneW = Math.max(bounds.maxX - bounds.minX, 1);
  const sceneH = Math.max(deskY - bounds.minY, 1);

  const placements = useMemo(() => computePlacements(boxes, centerX, joinEdges), [boxes, centerX, joinEdges]);
  const selected = monitors.find(m => m.id === selectedId) ?? null;

  // Fit the whole setup into the viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setFitScale(Math.min(3, (width * 0.6) / sceneW, (height * 0.55) / sceneH));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sceneW, sceneH]);

  // --- ORBIT HANDLERS ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, yaw: camera.yaw, pitch: camera.pitch, moved: false };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;
    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) > 3) drag.moved = true;
      setCamera(c => ({
        ...c,
        yaw: drag.yaw + (e.clientX - drag.startX) * 0.3,
        // Keep the camera above the desk so it never looks at its underside
        pitch: Math.max(-80, Math.min(-2, drag.pitch - (e.clientY - drag.startY) * 0.3)),
      }));
    };
    const handlePointerUp = () => {
      if (dragRef.current && !dragRef.current.moved) onSelect(null);
      dragRef.current = null;
      setIsDragging(false);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDragging]);

  // Two-finger pinch zooms the camera and cancels whatever one-finger drag had started
  usePinchZoom(
    containerRef,
    factor => setCamera(c => ({ ...c, zoom: Math.max(0.3, Math.min(4, c.zoom * factor)) })),
    () => {
      dragRef.current = null;
      setIsDragging(false);
      moveRef.current = null;
      frozenFrameRef.current = null;
      setMovingId(null);
    }
  );

  // Non-passive wheel listener so the page doesn't scroll while zooming
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setCamera(c => ({ ...c, zoom: Math.max(0.3, Math.min(4, c.zoom * (e.deltaY > 0 ? 0.92 : 1.08))) }));
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // --- MOUNT DRAG & DROP ---
  const endMountDrag = () => { setDraggedMount(null); setDropTargetId(null); };

  // Monitors that would join the mount if it were dropped on the hovered monitor
  const previewIds = useMemo(() => {
    if (!draggedMount || !dropTargetId) return new Set<string>();
    const count = draggedMount === 'stand' ? 1 : MOUNT_CAPACITY[draggedMount];
    return new Set(pickMountMembers(monitors, dropTargetId, count));
  }, [draggedMount, dropTargetId, monitors]);

  // --- MONITOR MOVE ---
  const frame: Framing = (movingId && frozenFrameRef.current) || { centerX, centerY, fitScale };
  const scale = frame.fitScale * camera.zoom;

  // `slideIds` set: dragging a stand or arm pole, which carries its monitors across the desk
  const handleMonitorPointerDown = (e: React.PointerEvent, id: string, slideIds?: string[]) => {
    if (e.button !== 0) return;
    const monitor = monitors.find(m => m.id === id);
    if (!monitor) return;
    e.preventDefault();
    e.stopPropagation();
    if (armedMount) {
      if (!isDeskItem(monitor)) onApplyMount(id, armedMount);
      setArmedMount(null);
      return;
    }
    onSelect(id);
    // Screen pixels per canvas unit along x and y, allowing for how far the wall is turned away
    const yaw = camera.yaw * Math.PI / 180;
    const pitch = camera.pitch * Math.PI / 180;
    const cosYaw = Math.cos(yaw);
    moveRef.current = {
      id,
      mode: slideIds ? 'slide' : e.shiftKey ? 'rotate' : e.altKey ? 'depth' : 'move',
      group: (slideIds ?? []).map(gid => {
        const m = monitors.find(other => other.id === gid)!;
        return { id: gid, x: m.x, depth: m.depth ?? 0 };
      }),
      initAngle: monitor.angle ?? 0,
      initDepth: monitor.depth ?? 0,
      deskItem: isDeskItem(monitor),
      // Screen pixels per inch of depth. The desk is heavily foreshortened from the usual camera
      // angle, so a true projection makes depth jumpy; a fixed rate feels steadier.
      unitsZ: scale * PPI_SCALE * 0.8,
      startX: e.clientX,
      startY: e.clientY,
      initX: monitor.x,
      initY: monitor.y,
      unitsX: scale * Math.sign(cosYaw || 1) * Math.max(0.35, Math.abs(cosYaw)),
      unitsY: scale * Math.max(0.35, Math.cos(pitch)),
      scale,
    };
    frozenFrameRef.current = { centerX, centerY, fitScale };
    setMovingId(id);
  };

  useEffect(() => {
    if (!movingId) return;
    const handlePointerMove = (e: PointerEvent) => {
      const move = moveRef.current;
      if (!move) return;
      if (move.mode === 'rotate') {
        // Dragging right turns the monitor to face right
        onUpdateMonitor(move.id, { angle: snapAngle(move.initAngle + (e.clientX - move.startX) * 0.4, 5) });
        return;
      }
      if (move.mode === 'slide') {
        const dx = (e.clientX - move.startX) / move.unitsX;
        const dz = (e.clientY - move.startY) / move.unitsZ;
        if (move.group.length === 1) {
          // One monitor on its stand: snap sideways to neighbours and in depth like Alt-drag
          const [only] = move.group;
          onMoveMonitor(only.id, only.x + dx, move.initY, 15 / move.scale);
          onUpdateMonitor(only.id, { depth: snapDepth(only.depth + dz, otherDepths(only.id)) });
        } else {
          // A whole arm: every monitor moves by the same amount so the group keeps its shape
          move.group.forEach(g => onUpdateMonitor(g.id, { x: g.x + dx, depth: Math.round((g.depth + dz) * 2) / 2 }));
        }
        return;
      }
      if (move.mode === 'depth') {
        // Dragging up pushes the monitor back, dragging down pulls it towards you
        onUpdateMonitor(move.id, { depth: snapDepth(move.initDepth + (e.clientY - move.startY) / move.unitsZ, otherDepths(move.id)) });
        return;
      }
      if (move.deskItem) {
        onMoveMonitor(move.id, move.initX + (e.clientX - move.startX) / move.unitsX, move.initY, 15 / move.scale);
        onUpdateMonitor(move.id, { depth: snapDepth(move.initDepth + (e.clientY - move.startY) / move.unitsZ, otherDepths(move.id)) });
        return;
      }
      onMoveMonitor(
        move.id,
        move.initX + (e.clientX - move.startX) / move.unitsX,
        move.initY + (e.clientY - move.startY) / move.unitsY,
        15 / move.scale
      );
    };
    const handlePointerUp = () => { moveRef.current = null; frozenFrameRef.current = null; setMovingId(null); };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [movingId, onMoveMonitor, onUpdateMonitor, monitors]);

  const setAngle = (id: string, angle: number) => onUpdateMonitor(id, { angle: snapAngle(angle) });

  const otherDepths = (id: string) => monitors.filter(m => m.id !== id && m.depth).map(m => m.depth as number);
  const setDepth = (id: string, depth: number) => onUpdateMonitor(id, { depth: snapDepth(depth, otherDepths(id)) });
  const setTilt = (id: string, tilt: number) => onUpdateMonitor(id, { tilt: snapTilt(tilt) });

  // Turn every monitor towards the middle, 30° more for each hinge away from it
  const wrapAround = () => {
    const hinged = computePlacements(boxes, centerX, true);
    boxes.forEach(b => {
      if (isDeskItem(b.monitor)) return;
      const hops = hinged.get(b.monitor.id)?.hops ?? 0;
      const side = b.x + b.w / 2 < centerX ? 1 : -1;
      onUpdateMonitor(b.monitor.id, { angle: hops === 0 ? 0 : side * Math.min(90, hops * WRAP_STEP) });
    });
    setJoinEdges(true);
  };

  const flattenAll = () => boxes.forEach(b =>
    onUpdateMonitor(b.monitor.id, { angle: 0, depth: DESK_ITEM_DEPTH[b.monitor.kind ?? 'monitor'] })
  );

  // Stands and arm poles: drag to carry the attached monitor(s) across the desk
  const supportEvents = (ids: string[]): React.DOMAttributes<HTMLDivElement> => ({
    onPointerDown: e => handleMonitorPointerDown(e, ids[0], ids),
    onDoubleClick: e => e.stopPropagation(),
  });
  const supportStyle = (ids: string[]): React.CSSProperties => ({
    cursor: ids.includes(movingId ?? '') ? 'grabbing' : 'grab',
  });

  const monitorEvents = (id: string): React.DOMAttributes<HTMLDivElement> => ({
    onPointerDown: e => handleMonitorPointerDown(e, id),
    onDoubleClick: e => e.stopPropagation(),
    onDragOver: e => {
      if (!draggedMount || isDeskItem(monitors.find(m => m.id === id)!)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      if (dropTargetId !== id) setDropTargetId(id);
    },
    onDrop: e => {
      e.preventDefault();
      e.stopPropagation();
      if (draggedMount) onApplyMount(id, draggedMount);
      endMountDrag();
    },
  });

  const deskW = sceneW + 40 * PPI_SCALE;
  const placedZ = boxes.map(b => placements.get(b.monitor.id)?.cz ?? b.z);
  const placedFront = boxes.map((b, i) =>
    placedZ[i] + (isLaptop(b.monitor) ? (getLaptopBody(b.monitor).baseD + 4) * PPI_SCALE
      : isPeripheral(b.monitor) ? ((b.monitor.size?.d ?? 5) + 4) * PPI_SCALE
      : 10 * PPI_SCALE)
  );
  const deskFront = Math.max(18 * PPI_SCALE, ...placedFront);
  const deskBack = Math.min(-12 * PPI_SCALE, Math.min(0, ...placedZ) - 14 * PPI_SCALE);
  const deskD = deskFront - deskBack;
  // A monitor on a stand gets one unless another monitor sits directly beneath its centre
  const standing = boxes.filter(b => {
    if (b.monitor.mount || isDeskItem(b.monitor)) return false;
    const cx = b.x + b.w / 2;
    return !boxes.some(o => o !== b && !isDeskItem(o.monitor) && o.y >= b.y + b.h - 1 && cx > o.x && cx < o.x + o.w);
  });

  const bodySide = isDark ? 'bg-slate-700' : 'bg-slate-600';
  const bodyTop = isDark ? 'bg-slate-600' : 'bg-slate-500';
  const bodyBack = isDark ? 'bg-slate-800' : 'bg-slate-700';
  const metalSide = isDark ? 'bg-zinc-500' : 'bg-zinc-500';
  const metalTop = isDark ? 'bg-zinc-400' : 'bg-zinc-400';

  const screenLabel = (m: Monitor) => (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
      <span className="text-3xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-none">
        {m.diagonal}"
      </span>
      <span className="text-[10px] text-white font-bold drop-shadow-md font-mono mt-1 uppercase tracking-widest bg-black/20 px-1 rounded">
        {m.ratio.label.split(' ')[0]}{m.curve ? ` · ${m.curve}R` : ''}
      </span>
    </div>
  );

  // A laptop on the desk: keyboard base with the lid hinged at its back edge, leaning back
  const renderLaptop = (b: Box) => {
    const id = b.monitor.id;
    const body = getLaptopBody(b.monitor);
    const lidW = body.lidW * PPI_SCALE, lidH = body.lidH * PPI_SCALE, lidT = body.lidT * PPI_SCALE;
    const baseW = body.baseW * PPI_SCALE, baseD = body.baseD * PPI_SCALE, baseT = body.baseT * PPI_SCALE;
    const cx = b.x + b.w / 2;
    const hingeY = deskY - baseT;
    const keysW = baseW * 0.86, keysD = baseD * 0.42;
    const padW = baseW * 0.36, padD = baseD * 0.28;
    const keysZ = b.z + 0.6 * PPI_SCALE + keysD / 2;
    const padZ = b.z + 0.6 * PPI_SCALE + keysD + 0.5 * PPI_SCALE + padD / 2;
    const selectedClass = selectedId === id ? 'outline outline-[5px] outline-amber-400' : '';
    const shell = isDark ? 'bg-zinc-600' : 'bg-zinc-400';
    const shellTop = isDark ? 'bg-zinc-500' : 'bg-zinc-300';
    const moveStyle: React.CSSProperties = { cursor: movingId === id ? 'move' : 'grab' };

    return (
      <React.Fragment key={id}>
        <Cuboid
          w={lidW} h={lidH} d={lidT}
          style={{ left: cx - lidW / 2, top: hingeY - lidH, transformOrigin: '50% 100%', transform: `translateZ(${b.z + lidT / 2}px) rotateX(${b.monitor.tilt ?? LAPTOP_DEFAULT_TILT}deg)`, ...moveStyle }}
          frontClass={`bg-slate-900 rounded-t-md ${selectedClass}`}
          sideClass={shell}
          topClass={shellTop}
          events={monitorEvents(id)}
          front={
            <div
              className="absolute rounded-[1px] overflow-hidden"
              style={{ left: 0.3 * PPI_SCALE, right: 0.3 * PPI_SCALE, top: 0.3 * PPI_SCALE, bottom: 0.6 * PPI_SCALE }}
            >
              <div className={`absolute inset-0 ${b.monitor.color} brightness-110 saturate-125`} />
              <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/30" />
              {screenLabel(b.monitor)}
            </div>
          }
        />
        <Cuboid
          w={baseW} h={baseT} d={baseD}
          style={{ left: cx - baseW / 2, top: hingeY, transform: `translateZ(${b.z + baseD / 2}px)`, ...moveStyle }}
          frontClass={shell}
          sideClass={shell}
          topClass={shellTop}
          events={monitorEvents(id)}
        />
        {/* Keyboard and trackpad, lying just above the base */}
        <div
          className="absolute pointer-events-none rounded-sm"
          style={{
            width: keysW, height: keysD, left: cx - keysW / 2, top: hingeY - keysD / 2 - 0.5,
            transform: `translateZ(${keysZ}px) rotateX(90deg)`,
            background: isDark ? '#27272a' : '#3f3f46',
            backgroundImage: `repeating-linear-gradient(90deg, transparent 0 ${keysW / 15 - 2}px, ${isDark ? '#52525b' : '#71717a'} ${keysW / 15 - 2}px ${keysW / 15}px), repeating-linear-gradient(0deg, transparent 0 ${keysD / 6 - 2}px, ${isDark ? '#52525b' : '#71717a'} ${keysD / 6 - 2}px ${keysD / 6}px)`,
          }}
        />
        <div
          className={`absolute pointer-events-none rounded ${isDark ? 'bg-zinc-500' : 'bg-zinc-300'}`}
          style={{ width: padW, height: padD, left: cx - padW / 2, top: hingeY - padD / 2 - 0.5, transform: `translateZ(${padZ}px) rotateX(90deg)` }}
        />
      </React.Fragment>
    );
  };

  // Keyboards and mice lie on the desk, back edge at the item's depth line
  const renderPeripheral = (b: Box) => {
    const id = b.monitor.id;
    const size = b.monitor.size ?? { w: 4, d: 4, h: 1 };
    const W = size.w * PPI_SCALE, D = size.d * PPI_SCALE, H = size.h * PPI_SCALE;
    const cx = b.x + b.w / 2;
    const isKeyboard = b.monitor.kind === 'keyboard';
    const isPad = b.monitor.name === 'Trackpad';
    const bodyH = isKeyboard ? H * 0.7 : isPad ? H : H * 0.6;
    const topY = deskY - bodyH;
    const moveStyle: React.CSSProperties = { cursor: movingId === id ? 'move' : 'grab' };
    const selectedClass = selectedId === id ? 'outline outline-[3px] outline-amber-400' : '';
    const shell = isDark ? 'bg-zinc-800' : 'bg-zinc-400';
    const shellTop = isDark ? 'bg-zinc-700' : 'bg-zinc-300';
    const rounded = isKeyboard ? 'rounded-md' : isPad ? 'rounded-lg' : 'rounded-[45%]';

    return (
      <React.Fragment key={id}>
        <Cuboid
          w={W} h={bodyH} d={D}
          style={{ left: cx - W / 2, top: topY, transform: `translateZ(${b.z + D / 2}px)`, ...moveStyle }}
          frontClass={`${shell} ${isKeyboard ? 'rounded-sm' : 'rounded-md'}`}
          sideClass={`${shell} ${isKeyboard ? 'rounded-sm' : 'rounded-md'}`}
          topClass={`${shellTop} ${rounded}`}
          events={monitorEvents(id)}
        />
        {/* Top surface: keycaps for keyboards, buttons and a wheel for mice */}
        <div
          className={`absolute pointer-events-none ${rounded} ${b.monitor.color} ${selectedClass}`}
          style={{
            width: isKeyboard ? W * 0.95 : W,
            height: isKeyboard ? D * 0.88 : D,
            left: cx - (isKeyboard ? W * 0.95 : W) / 2,
            top: topY - (isKeyboard ? D * 0.88 : D) / 2 - 0.5,
            transform: `translateZ(${b.z + D / 2}px) rotateX(90deg)`,
            backgroundImage: isKeyboard
              ? 'linear-gradient(90deg, rgba(0,0,0,0.45) 1.5px, transparent 1.5px), linear-gradient(rgba(0,0,0,0.45) 1.5px, transparent 1.5px)'
              : isPad ? 'linear-gradient(135deg, rgba(255,255,255,0.15), transparent 60%)'
              : 'linear-gradient(90deg, transparent calc(50% - 1px), rgba(0,0,0,0.5) calc(50% - 1px), rgba(0,0,0,0.5) calc(50% + 1px), transparent calc(50% + 1px))',
            backgroundSize: isKeyboard ? `${0.75 * PPI_SCALE}px ${(D * 0.88) / 6}px` : isPad ? undefined : '100% 40%',
            backgroundRepeat: isKeyboard || isPad ? undefined : 'no-repeat',
            filter: 'brightness(0.85)',
          }}
        >
          {!isKeyboard && !isPad && (
            <div className="absolute left-1/2 -translate-x-1/2 rounded-full bg-black/60" style={{ top: D * 0.14, width: W * 0.12, height: D * 0.16 }} />
          )}
        </div>
      </React.Fragment>
    );
  };

  // A PC case: mesh front with a power button, glass side panels glowing in the item's colour
  const renderCase = (b: Box) => {
    const id = b.monitor.id;
    const size = b.monitor.size ?? { w: 8, d: 16, h: 18 };
    const lying = !!b.monitor.lying;
    // On its side the case is as wide as it was tall, and as tall as it was wide
    const W = (lying ? size.h : size.w) * PPI_SCALE, D = size.d * PPI_SCALE, H = (lying ? size.w : size.h) * PPI_SCALE;
    const cx = b.x + b.w / 2;
    const small = size.h < 6; // Mac mini / Mac Studio style boxes: plain aluminium, no glass
    const moveStyle: React.CSSProperties = { cursor: movingId === id ? 'move' : 'grab' };
    const shell = isDark ? 'bg-zinc-900' : 'bg-zinc-700';
    const shellTop = isDark ? 'bg-zinc-800' : 'bg-zinc-600';
    const selectedClass = selectedId === id ? 'outline outline-[4px] outline-amber-400' : '';

    if (small) {
      return (
        <Cuboid
          key={id}
          w={W} h={H} d={D}
          style={{ left: cx - W / 2, top: deskY - H, transform: `translateZ(${b.z + D / 2}px)`, ...moveStyle }}
          frontClass={`bg-zinc-300 rounded-sm ${selectedClass}`}
          sideClass="bg-zinc-400 rounded-sm"
          topClass="bg-zinc-200 rounded-lg"
          events={monitorEvents(id)}
          front={<div className="absolute rounded-full bg-emerald-400" style={{ width: 3, height: 3, right: W * 0.1, bottom: H * 0.3 }} />}
        />
      );
    }

    // Tempered glass panel: on the sides when upright, facing up when lying down
    const glass = (
      <div className="absolute inset-[6%] rounded-sm overflow-hidden bg-black/50 border border-white/10">
        {/* Tempered glass: interior glow, motherboard and graphics card silhouettes */}
        <div className={`absolute inset-0 ${b.monitor.color} opacity-25`} />
        <div className="absolute bg-zinc-800/90 rounded-sm" style={{ left: '10%', right: '35%', top: '8%', bottom: '42%' }} />
        <div className={`absolute rounded-sm ${b.monitor.color} opacity-70`} style={{ left: '8%', right: '20%', top: '60%', height: '9%' }} />
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent" />
      </div>
    );

    return (
      <Cuboid
        key={id}
        w={W} h={H} d={D}
        style={{ left: cx - W / 2, top: deskY - H, transform: `translateZ(${b.z + D / 2}px)`, ...moveStyle }}
        frontClass={`${shell} rounded-sm ${selectedClass}`}
        sideClass={shell}
        topClass={shellTop}
        sideFaceClass={`${shell} rounded-sm`}
        events={monitorEvents(id)}
        front={
          <>
            {/* Intake mesh with fans glowing through it */}
            <div
              className="absolute rounded-sm overflow-hidden"
              style={{
                left: '10%', right: '10%', top: '12%', bottom: '8%',
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1.5px)',
                backgroundSize: '5px 5px',
              }}
            >
              {[0.2, 0.5, 0.8].map(t => (
                <div
                  key={t}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 opacity-60 ${b.monitor.color.replace('bg-', 'border-')}`}
                  style={lying
                    ? { left: `${t * 100}%`, top: '50%', width: H * 0.55, height: H * 0.55 }
                    : { left: '50%', top: `${t * 100}%`, width: W * 0.55, height: W * 0.55 }}
                />
              ))}
            </div>
            <div className="absolute rounded-full bg-white/80" style={{ width: 4, height: 4, top: H * 0.04, right: W * 0.12 }} />
          </>
        }
        side={lying ? undefined : glass}
        top={lying ? glass : undefined}
      />
    );
  };

  const renderMonitor = (b: Box) => {
    if (isCase(b.monitor)) return renderCase(b);
    if (isPeripheral(b.monitor)) return renderPeripheral(b);
    if (isLaptop(b.monitor)) return renderLaptop(b);
    const id = b.monitor.id;
    const highlighted = previewIds.has(id);
    const isSelected = selectedId === id && !highlighted;
    const moveStyle: React.CSSProperties = { cursor: movingId === id ? 'move' : 'grab' };

    if (!b.curve) {
      return (
        <Cuboid
          key={id}
          w={b.w} h={b.h} d={BODY_DEPTH}
          style={{ left: b.x, top: b.y, transform: `translateZ(${b.z}px)`, ...moveStyle }}
          frontClass={`bg-slate-900 transition-[outline-color] ${highlighted ? 'outline outline-[6px] outline-sky-400' : isSelected ? 'outline outline-[6px] outline-amber-400' : ''}`}
          sideClass={bodySide}
          topClass={bodyTop}
          events={monitorEvents(id)}
          front={
            <div className="absolute rounded-[1px] overflow-hidden" style={{ inset: BEZEL }}>
              <div className={`absolute inset-0 ${b.monitor.color} brightness-110 saturate-125`} />
              <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/30" />
              {screenLabel(b.monitor)}
            </div>
          }
        />
      );
    }

    // Curved panel: thin strips laid around the curvature radius, concave towards the viewer.
    // Landscape panels curve left to right; rotated (portrait) panels curve top to bottom.
    const vertical = b.monitor.orientation === 'portrait';
    const radius = b.curve.radius * PPI_SCALE;
    const arc = b.curve.arcWidth * PPI_SCALE;
    const angle = b.curve.angle;
    let count = Math.min(41, Math.max(9, Math.ceil(angle / 0.05)));
    if (count % 2 === 0) count++;
    const stripLen = arc / count + 1; // 1px overlap hides seams between strips
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const centerZ = b.z - b.curveDepth / 2;

    return (
      <React.Fragment key={id}>
        {Array.from({ length: count }, (_, i) => {
          const phi = -angle / 2 + (i + 0.5) * angle / count;
          const offset = radius * Math.sin(phi);
          const z = centerZ + radius * (1 - Math.cos(phi));
          const first = i === 0, last = i === count - 1;
          const inset = vertical
            ? { left: BEZEL, right: BEZEL, top: first ? BEZEL : 0, bottom: last ? BEZEL : 0 }
            : { top: BEZEL, bottom: BEZEL, left: first ? BEZEL : 0, right: last ? BEZEL : 0 };
          // Shade strips by angle so the curve reads clearly
          const shade = 0.28 * Math.abs(phi) / (angle / 2);
          return (
            <Cuboid
              key={`${id}-${i}`}
              w={vertical ? b.w : stripLen}
              h={vertical ? stripLen : b.h}
              d={BODY_DEPTH}
              style={{
                left: vertical ? b.x : cx + offset - stripLen / 2,
                top: vertical ? cy + offset - stripLen / 2 : b.y,
                transform: vertical ? `translateZ(${z}px) rotateX(${phi}rad)` : `translateZ(${z}px) rotateY(${-phi}rad)`,
                ...moveStyle,
              }}
              frontClass="bg-slate-900"
              sideClass={bodySide}
              topClass={bodyTop}
              events={monitorEvents(id)}
              front={
                <div className="absolute" style={inset}>
                  <div className={`absolute inset-0 ${b.monitor.color} brightness-110 saturate-125`} />
                  <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${shade})` }} />
                  {highlighted && <div className="absolute inset-0 bg-sky-300/40" />}
                  {isSelected && <div className="absolute inset-0 bg-amber-300/30" />}
                </div>
              }
            />
          );
        })}
        {/* Label floats just in front of the deepest (centre) strip */}
        <div
          className="absolute pointer-events-none"
          style={{ left: b.x, top: b.y, width: b.w, height: b.h, transform: `translateZ(${centerZ + BODY_DEPTH / 2 + 4}px)` }}
        >
          {screenLabel(b.monitor)}
        </div>
      </React.Fragment>
    );
  };

  const renderStand = (b: Box) => {
    const neckTop = b.y + b.h * 0.4;
    const neckH = deskY - neckTop;
    const neckZ = b.backZ - NECK_DEPTH / 2;
    return (
      <React.Fragment key="stand">
        <Cuboid
          w={NECK_WIDTH} h={neckH} d={NECK_DEPTH}
          style={{ left: b.x + b.w / 2 - NECK_WIDTH / 2, top: neckTop, transform: `translateZ(${neckZ}px)`, ...supportStyle([b.monitor.id]) }}
          frontClass={bodyBack} sideClass={bodySide} topClass={bodyTop}
          events={supportEvents([b.monitor.id])}
        />
        <Cuboid
          w={BASE_WIDTH} h={6} d={BASE_DEPTH}
          style={{ left: b.x + b.w / 2 - BASE_WIDTH / 2, top: deskY - 6, transform: `translateZ(${neckZ + BASE_DEPTH / 2 - NECK_DEPTH}px)`, ...supportStyle([b.monitor.id]) }}
          frontClass={bodySide} sideClass={bodySide} topClass={bodyTop}
          events={supportEvents([b.monitor.id])}
        />
      </React.Fragment>
    );
  };

  const renderVesaPlate = (b: Box) => (
    <Cuboid
      key="vesa"
      w={VESA_PLATE} h={VESA_PLATE} d={VESA_DEPTH}
      style={{ left: b.x + b.w / 2 - VESA_PLATE / 2, top: b.y + b.h / 2 - VESA_PLATE / 2, transform: `translateZ(${b.backZ - VESA_DEPTH / 2}px)` }}
      frontClass={bodyBack} sideClass={metalSide} topClass={metalTop}
    />
  );

  // Moves and turns a monitor (with its stand or plate) from its layout spot to its placement
  const placementStyle = (b: Box): React.CSSProperties => {
    const p = placements.get(b.monitor.id);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const dx = p ? p.cx - cx : 0;
    const dz = p ? p.cz - b.z : 0;
    return {
      position: 'absolute',
      left: 0,
      top: 0,
      transformStyle: 'preserve-3d',
      // Keyboards and mice turn about their middle; screens about their back
      transformOrigin: `${cx}px ${cy}px ${isPeripheral(b.monitor) ? b.z + (b.monitor.size?.d ?? 0) * PPI_SCALE / 2 : b.z}px`,
      transform: `translate3d(${dx}px, 0, ${dz}px) rotateY(${p?.yaw ?? 0}deg)`,
    };
  };

  const standingIds = new Set(standing.map(b => b.monitor.id));

  // Leans a monitor (and its VESA plate) about where the stand neck or arm meets it
  const tiltStyle = (b: Box): React.CSSProperties => {
    const tilt = isDeskItem(b.monitor) ? 0 : b.monitor.tilt ?? 0;
    const pivotY = b.monitor.mount ? b.y + b.h / 2 : b.y + b.h * 0.4;
    return {
      position: 'absolute',
      left: 0,
      top: 0,
      transformStyle: 'preserve-3d',
      transformOrigin: `${b.x + b.w / 2}px ${pivotY}px ${b.backZ}px`,
      transform: tilt ? `rotateX(${tilt}deg)` : undefined,
    };
  };

  const hasWallMonitors = monitors.some(m => !isDeskItem(m));

  const panelClass = `backdrop-blur rounded-lg border shadow-xl z-30 transition-colors duration-300 ${isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-white/90 border-slate-200'}`;
  const buttonClass = `p-2 rounded transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-600'}`;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden select-none ${movingId ? 'cursor-move' : isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${isDark ? 'bg-gradient-to-b from-slate-950 to-slate-900' : 'bg-gradient-to-b from-slate-200 to-slate-100'}`}
      style={{ perspective: 2000, touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onDoubleClick={() => setCamera(DEFAULT_CAMERA)}
      onDragOver={e => { if (draggedMount) { e.preventDefault(); e.dataTransfer.dropEffect = 'none'; setDropTargetId(null); } }}
      onDrop={e => { e.preventDefault(); endMountDrag(); }}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          transformStyle: 'preserve-3d',
          transform: `scale3d(${scale}, ${scale}, ${scale}) rotateX(${camera.pitch}deg) rotateY(${camera.yaw}deg)`,
          transition: isDragging ? 'none' : 'transform 120ms ease-out',
        }}
      >
        <div
          style={{
            transformStyle: 'preserve-3d',
            transform: `translate3d(${-frame.centerX}px, ${-frame.centerY}px, 0)`,
            transition: movingId ? 'none' : 'transform 200ms ease-out',
          }}
        >
          {boxes.length > 0 && (
            <>
              {/* Desk surface */}
              <div
                className={`absolute rounded-xl ${isDark ? 'bg-slate-800' : 'bg-stone-300'}`}
                style={{
                  width: deskW,
                  height: deskD,
                  left: centerX - deskW / 2,
                  top: deskY - deskD / 2,
                  transform: `rotateX(90deg) translateY(${(deskFront + deskBack) / 2}px)`,
                  backgroundImage: `linear-gradient(${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(71,85,105,0.15)'} 1px, transparent 1px), linear-gradient(90deg, ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(71,85,105,0.15)'} 1px, transparent 1px)`,
                  backgroundSize: `${6 * PPI_SCALE}px ${6 * PPI_SCALE}px`,
                  boxShadow: isDark ? '0 0 120px rgba(0,0,0,0.6)' : '0 0 120px rgba(0,0,0,0.15)',
                }}
              />

              {/* VESA arms: a desk-clamped pole with one arm per monitor, reaching each turned monitor's plate */}
              {armGroups.map(group => {
                const plates = group.members.map(b => {
                  const p = placements.get(b.monitor.id)!;
                  const plate = toWorld(p, 0, b.backZ - VESA_DEPTH / 2 - b.z);
                  return { b, x: plate.x, z: plate.z, cy: b.y + b.h / 2 };
                });
                const poleX = plates.reduce((sum, c) => sum + c.x, 0) / plates.length;
                const poleZ = Math.min(...plates.map(c => c.z)) - POLE_OFFSET;
                const poleTop = Math.min(...plates.map(c => c.cy)) - POLE_HEADROOM;
                const groupIds = group.members.map(b => b.monitor.id);
                return (
                  <React.Fragment key={`arm-${group.id}`}>
                    <Cuboid
                      w={POLE_SIZE} h={deskY - poleTop} d={POLE_SIZE}
                      style={{ left: poleX - POLE_SIZE / 2, top: poleTop, transform: `translateZ(${poleZ}px)`, ...supportStyle(groupIds) }}
                      frontClass={metalSide} sideClass={metalSide} topClass={metalTop}
                      events={supportEvents(groupIds)}
                    />
                    <Cuboid
                      w={CLAMP_WIDTH} h={8} d={CLAMP_WIDTH}
                      style={{ left: poleX - CLAMP_WIDTH / 2, top: deskY - 8, transform: `translateZ(${poleZ}px)`, ...supportStyle(groupIds) }}
                      frontClass={bodySide} sideClass={bodySide} topClass={bodyTop}
                      events={supportEvents(groupIds)}
                    />
                    {plates.map(({ b, x, z, cy }) => {
                      const elbowX = (poleX + x) / 2;
                      const elbowZ = Math.min(poleZ, z) - ELBOW_SETBACK;
                      return (
                        <React.Fragment key={`arm-${group.id}-${b.monitor.id}`}>
                          <Beam x1={poleX} z1={poleZ} x2={elbowX} z2={elbowZ} y={cy} t={ARM_THICKNESS} sideClass={metalSide} topClass={metalTop} />
                          <Beam x1={elbowX} z1={elbowZ} x2={x} z2={z} y={cy} t={ARM_THICKNESS} sideClass={metalSide} topClass={metalTop} />
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              {/* Monitors, each turned with its stand or VESA plate */}
              {boxes.map(b => (
                <div key={b.monitor.id} style={placementStyle(b)}>
                  {standingIds.has(b.monitor.id) && renderStand(b)}
                  <div style={tiltStyle(b)}>
                    {b.monitor.mount && renderVesaPlate(b)}
                    {renderMonitor(b)}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Camera controls */}
      <div
        className={`absolute top-3 right-3 md:top-4 md:right-4 flex gap-1 md:gap-2 p-1 md:p-2 ${panelClass}`}
        onPointerDown={e => e.stopPropagation()}
        onDoubleClick={e => e.stopPropagation()}
      >
        <button onClick={() => setCamera(c => ({ ...c, zoom: Math.max(0.3, c.zoom - 0.1) }))} className={buttonClass}>
          <ZoomOut size={18} />
        </button>
        <div className={`px-2 flex items-center text-xs font-mono w-12 justify-center select-none transition-colors ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
          {Math.round(camera.zoom * 100)}%
        </div>
        <button onClick={() => setCamera(c => ({ ...c, zoom: Math.min(4, c.zoom + 0.1) }))} className={buttonClass}>
          <ZoomIn size={18} />
        </button>
        <button onClick={() => setCamera(DEFAULT_CAMERA)} className={buttonClass} title="Reset View">
          <RotateCcw size={18} />
        </button>
      </div>

      {/* Mount palette (phones: shown from the bottom bar) */}
      {hasWallMonitors && (
        <div
          className={`absolute inset-x-3 bottom-16 md:inset-x-auto md:left-4 md:bottom-4 md:w-60 p-3 cursor-default ${panelClass} ${mobilePanel === 'mounts' ? '' : 'hidden'} md:block`}
          onPointerDown={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Mounts</span>
            <button
              onClick={onClearMounts}
              className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-100'}`}
              title="Put every monitor back on a stand"
            >
              <Eraser size={12} /> Reset
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {MOUNT_OPTIONS.map(opt => (
              <div
                key={opt.value}
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('text/plain', opt.value);
                  e.dataTransfer.effectAllowed = 'copy';
                  setDraggedMount(opt.value);
                }}
                onDragEnd={endMountDrag}
                onClick={() => setArmedMount(a => (a === opt.value ? null : opt.value))}
                className={`flex flex-col items-center gap-1 py-2 rounded-md border cursor-grab active:cursor-grabbing transition-colors ${
                  draggedMount === opt.value || armedMount === opt.value
                    ? 'border-sky-400 bg-sky-500/20 text-sky-400'
                    : isDark ? 'border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-700/60' : 'border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-100'
                }`}
                title={`${opt.hint}: drag onto a monitor, or tap it and then a monitor`}
              >
                <MountGlyph option={opt.value} />
                <span className="text-[10px] font-bold">{opt.label}</span>
              </div>
            ))}
          </div>
          <p className={`text-[10px] mt-2 leading-snug ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            {armedMount
              ? `Now tap a monitor to give it the ${MOUNT_OPTIONS.find(o => o.value === armedMount)!.label.toLowerCase()} mount.`
              : 'Drag onto a monitor, or tap one here and then a monitor. Dual and triple arms also take the nearest monitors.'}
          </p>
        </div>
      )}

      <div className={`hidden xl:block absolute top-6 left-1/2 -translate-x-1/2 text-xs font-medium pointer-events-none text-center ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
        Drag a screen to move it · Drag its stand to slide it across the desk · Shift-drag to turn · Drag empty space to orbit
      </div>

      {/* Position panel (phones: shown from the bottom bar) */}
      {monitors.length > 0 && (
        <div
          className={`absolute inset-x-3 bottom-16 md:inset-x-auto md:right-4 md:bottom-4 md:w-64 p-3 cursor-default max-h-[60dvh] overflow-y-auto ${panelClass} ${mobilePanel === 'position' ? '' : 'hidden'} md:block`}
          onPointerDown={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Position{selected ? ` · ${getItemLabel(selected)}` : ''}
            </span>
            {selected && (
              <button onClick={() => onSelect(null)} className={`p-0.5 rounded ${isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-100'}`} title="Deselect">
                <X size={14} />
              </button>
            )}
          </div>

          {selected ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`} title="Face left">L</span>
                <input
                  type="range" min={-90} max={90} step={1}
                  value={selected.angle ?? 0}
                  onChange={(e) => setAngle(selected.id, parseInt(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <span className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`} title="Face right">R</span>
                <span className={`w-10 text-right text-xs font-mono ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{selected.angle ?? 0}°</span>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {ANGLE_PRESETS.map(a => (
                  <button
                    key={a}
                    onClick={() => setAngle(selected.id, a)}
                    className={`py-1 rounded text-[10px] font-bold transition-colors ${
                      (selected.angle ?? 0) === a
                        ? 'bg-amber-500 text-white'
                        : isDark ? 'bg-slate-700/60 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {a > 0 ? `+${a}` : a}
                  </button>
                ))}
              </div>

              <div className={`pt-2 mt-1 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-tight ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Depth</span>
                  <span className={`text-xs font-mono ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{formatDepth(selected.depth ?? 0)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`} title="Push back">Back</span>
                  <input
                    type="range" min={-DEPTH_LIMIT} max={DEPTH_LIMIT} step={0.5}
                    value={selected.depth ?? 0}
                    onChange={(e) => setDepth(selected.id, parseFloat(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <span className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`} title="Pull forward">Front</span>
                </div>
                <div className="grid grid-cols-3 gap-1 mt-1.5">
                  {[
                    { label: '−1" back', value: (selected.depth ?? 0) - 1 },
                    { label: 'Wall line', value: 0 },
                    { label: '+1" front', value: (selected.depth ?? 0) + 1 },
                  ].map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => setDepth(selected.id, opt.value)}
                      className={`py-1 rounded text-[10px] font-bold transition-colors ${isDark ? 'bg-slate-700/60 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Monitors tilt up/down; laptops open their lid; keyboards and mice don't tilt */}
              {!isPeripheral(selected) && (
                <div className={`pt-2 mt-1 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  {isLaptop(selected) ? (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-tight ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Lid angle</span>
                        <span className={`text-xs font-mono ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{90 + (selected.tilt ?? LAPTOP_DEFAULT_TILT)}°</span>
                      </div>
                      <input
                        type="range" min={0} max={LID_MAX} step={1}
                        value={selected.tilt ?? LAPTOP_DEFAULT_TILT}
                        onChange={(e) => onUpdateMonitor(selected.id, { tilt: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                      <div className="grid grid-cols-4 gap-1 mt-1.5">
                        {LID_PRESETS.map(a => (
                          <button
                            key={a}
                            onClick={() => onUpdateMonitor(selected.id, { tilt: a - 90 })}
                            className={`py-1 rounded text-[10px] font-bold transition-colors ${
                              90 + (selected.tilt ?? LAPTOP_DEFAULT_TILT) === a
                                ? 'bg-amber-500 text-white'
                                : isDark ? 'bg-slate-700/60 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {a}°
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-tight ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Tilt</span>
                        <span className={`text-xs font-mono ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{(selected.tilt ?? 0) > 0 ? '+' : ''}{selected.tilt ?? 0}°</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`} title="Screen faces down">Down</span>
                        <input
                          type="range" min={TILT_MIN} max={TILT_MAX} step={1}
                          value={selected.tilt ?? 0}
                          onChange={(e) => setTilt(selected.id, parseInt(e.target.value))}
                          className="flex-1 h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                        <span className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`} title="Screen faces up">Up</span>
                      </div>
                      <div className="grid grid-cols-7 gap-1 mt-1.5">
                        {TILT_PRESETS.map(a => (
                          <button
                            key={a}
                            onClick={() => setTilt(selected.id, a)}
                            className={`py-1 rounded text-[10px] font-bold transition-colors ${
                              (selected.tilt ?? 0) === a
                                ? 'bg-amber-500 text-white'
                                : isDark ? 'bg-slate-700/60 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {a > 0 ? `+${a}` : a}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className={`text-[10px] leading-snug ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              Tap or click an item to turn it, tilt it, or move it forward and back. Drag a stand or arm pole to slide its monitors across the desk. With a mouse, Shift-drag turns and Alt-drag moves depth. Angles snap to 15° steps, depth to the wall line and to other items.
            </p>
          )}

          <div className={`flex items-center justify-between mt-3 pt-2 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <button
              onClick={() => setJoinEdges(j => !j)}
              className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-1 rounded transition-colors ${
                joinEdges ? 'bg-amber-500/20 text-amber-500' : isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-100'
              }`}
              title="Keep touching monitors joined at their edges when turned"
            >
              <Magnet size={12} /> Join edges
            </button>
            <div className="flex gap-1">
              <button
                onClick={wrapAround}
                className={`text-[10px] font-semibold px-1.5 py-1 rounded transition-colors ${isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'}`}
                title="Turn the side monitors in to wrap around you"
              >
                Wrap around
              </button>
              <button
                onClick={flattenAll}
                className={`text-[10px] font-semibold px-1.5 py-1 rounded transition-colors ${isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'}`}
                title="Face every monitor straight ahead and line them back up on the wall"
              >
                Flatten
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phones: one bottom panel at a time */}
      {monitors.length > 0 && (
        <div className="md:hidden absolute bottom-3 inset-x-3 flex justify-center gap-2 z-30" onPointerDown={e => e.stopPropagation()}>
          {(hasWallMonitors ? (['mounts', 'position'] as const) : (['position'] as const)).map(panel => (
            <button
              key={panel}
              onClick={() => setMobilePanel(p => (p === panel ? null : panel))}
              className={`flex-1 max-w-[11rem] h-11 rounded-xl border shadow-xl backdrop-blur text-xs font-bold capitalize transition-colors ${
                mobilePanel === panel
                  ? 'bg-amber-500 border-amber-500 text-white'
                  : isDark ? 'bg-slate-800/90 border-slate-700 text-slate-200' : 'bg-white/90 border-slate-200 text-slate-700'
              }`}
            >
              {panel}{panel === 'position' && selected ? ` · ${getItemLabel(selected)}` : ''}
            </button>
          ))}
        </div>
      )}

      {monitors.length === 0 && (
        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          <div>
            <p className="text-lg font-semibold">Nothing to show in 3D</p>
            <p className="text-sm opacity-70">Open the Add tab to add a display</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scene3D;
