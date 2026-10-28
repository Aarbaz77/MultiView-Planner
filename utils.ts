import { Monitor, NewItem } from './types';
import { PPI_SCALE, COLORS, ASPECT_RATIOS, DESK_ITEM_DEPTH, LAPTOP_DEFAULT_TILT } from './constants';

export const calculateDimensions = (diagonal: number, ratioW: number, ratioH: number) => {
  const angle = Math.atan(ratioH / ratioW);
  const width = diagonal * Math.cos(angle);
  const height = diagonal * Math.sin(angle);
  return { width, height };
};

export const formatDim = (inches: number): string => {
  const cm = inches * 2.54;
  return `${Math.round(cm * 10) / 10} cm (${Math.round(inches * 10) / 10}")`;
};

// Curvature of the panel along its native width, all in inches. Flat panels have no curve.
export const getCurveGeometry = (m: Monitor) => {
  if (!m.curve) return null;
  const { width } = calculateDimensions(m.diagonal, m.ratio.w, m.ratio.h);
  const radius = m.curve / 25.4;
  const angle = Math.min(width / radius, Math.PI * 0.95);
  return {
    radius,
    arcWidth: width,
    angle,
    chordWidth: 2 * radius * Math.sin(angle / 2),
    depth: radius * (1 - Math.cos(angle / 2)),
  };
};

export const isLaptop = (m: Monitor) => m.kind === 'laptop';
// Items sized by width/depth/height rather than a screen diagonal
export const isPeripheral = (m: Monitor) => m.kind === 'keyboard' || m.kind === 'mouse' || m.kind === 'case';
export const isCase = (m: Monitor) => m.kind === 'case';
// Laptops, keyboards, mice and cases sit on the desk rather than on the monitor wall
export const isDeskItem = (m: Monitor) => isLaptop(m) || isPeripheral(m);

// Front-view footprint in inches; a curved panel is narrower than its arc,
// and a keyboard or mouse is seen edge-on
export const getMonitorSizeIn = (m: Monitor) => {
  if (isPeripheral(m) && m.size) {
    // A case lying on its side is as wide as it was tall
    return m.lying ? { w: m.size.h, h: m.size.w } : { w: m.size.w, h: m.size.h };
  }
  let { width, height } = calculateDimensions(m.diagonal, m.ratio.w, m.ratio.h);
  const curve = getCurveGeometry(m);
  if (curve) width = curve.chordWidth;
  if (m.orientation === 'portrait') [width, height] = [height, width];
  return { w: width, h: height };
};

export const getMonitorSizePx = (m: Monitor) => {
  const { w, h } = getMonitorSizeIn(m);
  return { w: w * PPI_SCALE, h: h * PPI_SCALE };
};

// Short name for lists and labels
export const getItemLabel = (m: Monitor) =>
  isPeripheral(m) ? (m.name ?? m.kind ?? '') : `${m.diagonal}" ${m.ratio.label.split(' ')[0]}`;

// Rough laptop body around its screen, in inches: a lid with bezels and a keyboard base
export const getLaptopBody = (m: Monitor) => {
  const { width, height } = calculateDimensions(m.diagonal, m.ratio.w, m.ratio.h);
  return {
    lidW: width + 0.6,
    lidH: height + 0.9,
    lidT: 0.25,
    baseW: width + 0.6,
    baseD: height * 1.15 + 0.8,
    baseT: 0.65,
  };
};

// Snap a monitor's proposed position to the edges of the others
export const snapMonitorPosition = (monitors: Monitor[], id: string, x: number, y: number, threshold: number) => {
  const current = monitors.find(m => m.id === id);
  if (!current) return { x, y };
  const { w: curW, h: curH } = getMonitorSizePx(current);
  let snappedX = false;
  let snappedY = false;

  monitors.forEach(other => {
    if (other.id === id) return;
    const { w: ow, h: oh } = getMonitorSizePx(other);
    const otherL = other.x, otherR = other.x + ow;
    const otherT = other.y, otherB = other.y + oh;

    // X Snap
    if (!snappedX) {
      if (Math.abs(x - otherR) < threshold) { x = otherR; snappedX = true; }
      else if (Math.abs((x + curW) - otherL) < threshold) { x = otherL - curW; snappedX = true; }
      else if (Math.abs(x - otherL) < threshold) { x = otherL; snappedX = true; }
      else if (Math.abs((x + curW) - otherR) < threshold) { x = otherR - curW; snappedX = true; }
    }
    // Y Snap
    if (!snappedY) {
      if (Math.abs(y - otherB) < threshold) { y = otherB; snappedY = true; }
      else if (Math.abs((y + curH) - otherT) < threshold) { y = otherT - curH; snappedY = true; }
      else if (Math.abs(y - otherT) < threshold) { y = otherT; snappedY = true; }
      else if (Math.abs((y + curH) - otherB) < threshold) { y = otherB - curH; snappedY = true; }
    }
  });

  return { x, y };
};

// The target monitor plus its nearest neighbours, up to `count` monitors in total
export const pickMountMembers = (monitors: Monitor[], targetId: string, count: number): string[] => {
  const center = (m: Monitor) => {
    const { w, h } = getMonitorSizePx(m);
    return { x: m.x + w / 2, y: m.y + h / 2 };
  };
  const target = monitors.find(m => m.id === targetId);
  if (!target) return [];
  const tc = center(target);
  const neighbours = monitors
    .filter(m => m.id !== targetId && !isDeskItem(m))
    .map(m => { const c = center(m); return { id: m.id, dist: Math.hypot(c.x - tc.x, c.y - tc.y) }; })
    .sort((a, b) => a.dist - b.dist)
    .slice(0, count - 1)
    .map(n => n.id);
  return [targetId, ...neighbours];
};

// A new item placed the way the Add tab places it. Screens start at a fixed spot; in 2D,
// desk items line up left to right on a "desk line" below the monitors and cases go to
// the right of the monitors.
export const createItem = (prev: Monitor[], item: NewItem, id: string): Monitor => {
  const onDesk = item.kind !== 'monitor';
  const created: Monitor = {
    id,
    kind: item.kind === 'monitor' ? undefined : item.kind,
    name: item.name,
    size: item.size,
    diagonal: item.diagonal ?? 0,
    ratio: item.ratio ?? ASPECT_RATIOS[0],
    curve: item.kind === 'monitor' ? item.curve : undefined,
    orientation: 'landscape',
    x: 100, y: 100,
    depth: onDesk ? DESK_ITEM_DEPTH[item.kind] : undefined,
    tilt: item.kind === 'laptop' ? LAPTOP_DEFAULT_TILT : undefined,
    color: isPeripheral({ kind: item.kind } as Monitor) ? 'bg-slate-500' : COLORS[prev.length % COLORS.length],
  };
  if (onDesk) {
    const wall = prev.filter(m => !isDeskItem(m));
    const deskItems = prev.filter(m => isDeskItem(m) && !isCase(m));
    const cases = prev.filter(isCase);
    const { w, h } = getMonitorSizePx(created);
    const wallBottom = wall.length ? Math.max(...wall.map(m => m.y + getMonitorSizePx(m).h)) : 0;
    const wallMid = wall.length
      ? (Math.min(...wall.map(m => m.x)) + Math.max(...wall.map(m => m.x + getMonitorSizePx(m).w))) / 2
      : 100;
    const wallRight = wall.length ? Math.max(...wall.map(m => m.x + getMonitorSizePx(m).w)) : 100;
    if (item.kind === 'case') {
      // Cases line up to the right of the monitors
      created.x = cases.length
        ? Math.max(...cases.map(m => m.x + getMonitorSizePx(m).w)) + 2 * PPI_SCALE
        : wallRight + 3 * PPI_SCALE;
    } else {
      created.x = deskItems.length
        ? Math.max(...deskItems.map(m => m.x + getMonitorSizePx(m).w)) + 2 * PPI_SCALE
        : wallMid - w / 2;
    }
    created.y = wallBottom + 12 * PPI_SCALE - h - (item.kind === 'laptop' ? 0.65 * PPI_SCALE : 0);
  }
  return created;
};
