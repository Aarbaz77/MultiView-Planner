import { RefObject, useEffect, useRef } from 'react';

// Two-finger pinch on `ref`'s element. `onZoom` gets the change in finger spread since the
// last move (>1 spreading apart, <1 pinching in); `onStart` fires as the second finger lands,
// so one-finger drags that were already under way can be cancelled. Change `attachKey`
// whenever the element behind `ref` is swapped out so the listeners move with it.
export const usePinchZoom = (
  ref: RefObject<HTMLElement | null>,
  onZoom: (factor: number) => void,
  onStart?: () => void,
  attachKey?: unknown,
) => {
  const callbacks = useRef({ onZoom, onStart });
  callbacks.current = { onZoom, onStart };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const points = new Map<number, { x: number; y: number }>();
    let lastSpread = 0;

    const spread = () => {
      const pts: { x: number; y: number }[] = [];
      points.forEach(p => pts.push(p));
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };

    const handleDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size === 2) {
        lastSpread = spread();
        callbacks.current.onStart?.();
      }
    };
    const handleMove = (e: PointerEvent) => {
      if (!points.has(e.pointerId)) return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size !== 2 || lastSpread <= 0) return;
      const next = spread();
      callbacks.current.onZoom(next / lastSpread);
      lastSpread = next;
    };
    const handleUp = (e: PointerEvent) => {
      points.delete(e.pointerId);
      if (points.size < 2) lastSpread = 0;
    };

    el.addEventListener('pointerdown', handleDown);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      el.removeEventListener('pointerdown', handleDown);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [ref, attachKey]);
};
