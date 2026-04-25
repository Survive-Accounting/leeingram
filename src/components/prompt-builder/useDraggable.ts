import { useEffect, useRef, useState } from "react";

interface Pos { x: number; y: number; }

/**
 * Draggable hook for a floating panel.
 * - Persists position in localStorage under `storageKey`.
 * - Drag is initiated only from elements with `data-drag-handle="true"`.
 * - Clamps to viewport on resize.
 */
export function useDraggable(storageKey: string, initial: Pos, size: { w: number; h: number }) {
  const [pos, setPos] = useState<Pos>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const p = JSON.parse(raw);
        return clamp(p, size, window);
      }
    } catch { /* noop */ }
    return clamp(initial, size, window);
  });

  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(pos)); } catch { /* noop */ }
  }, [pos, storageKey]);

  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p, size, window));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [size.w, size.h]);

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('[data-drag-handle="true"]')) return;
    if (target.closest("button, input, textarea, [data-no-drag]")) return;
    e.preventDefault();
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setPos(clamp({ x: e.clientX - d.dx, y: e.clientY - d.dy }, size, window));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
      dragRef.current = null;
    }
  };

  return { pos, setPos, dragHandlers: { onPointerDown, onPointerMove, onPointerUp } };
}

function clamp(p: Pos, size: { w: number; h: number }, win: Window): Pos {
  // Keep at least a small portion (header strip) of the element on-screen rather
  // than requiring the full element to fit. This lets users drag freely on the
  // Y axis even when the panel is taller than the viewport.
  const minVisible = 40;
  return {
    x: Math.min(Math.max(8 - (size.w - minVisible), p.x), Math.max(8, win.innerWidth - minVisible)),
    y: Math.min(Math.max(8, p.y), Math.max(8, win.innerHeight - minVisible)),
  };
}
