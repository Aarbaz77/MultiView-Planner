import { Monitor } from './types';
import { PPI_SCALE } from './constants';

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
  const { width } = calculateDimensions(m.diagonal, m.ratio.w, m.ratio.h);
  if (!m.curve) return null;
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

// Front-view footprint in inches; a curved panel is narrower than its arc
export const getMonitorSizeIn = (m: Monitor) => {
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
    .filter(m => m.id !== targetId)
    .map(m => { const c = center(m); return { id: m.id, dist: Math.hypot(c.x - tc.x, c.y - tc.y) }; })
    .sort((a, b) => a.dist - b.dist)
    .slice(0, count - 1)
    .map(n => n.id);
  return [targetId, ...neighbours];
};
