import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Square, Minus, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Floating recording bar + collapsed bubble for the Prompt Builder.
 *
 * - Always pinned above other UI (z-index max).
 * - Draggable on touch + mouse; clamped to the viewport with a safe inset.
 * - When `collapsed`, renders a tiny round bubble showing the timer.
 *   Tap the bubble to call `onExpand` (parent reopens the full panel).
 * - Per the agreed UX, "Pause" finalises this segment and stops the mic.
 *   The parent treats Resume as a fresh recording append.
 */
export function RecordingBar({
  startedAt,
  paused,
  collapsed,
  onPause,
  onResume,
  onStop,
  onMinimize,
  onExpand,
}: {
  /** ms timestamp when current segment started; null when paused. */
  startedAt: number | null;
  paused: boolean;
  collapsed: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onMinimize: () => void;
  onExpand: () => void;
}) {
  // Live timer (re-render every 250ms while active).
  const [, force] = useState(0);
  useEffect(() => {
    // Tick regardless — cheap, keeps timer accurate in both modes.
    const id = window.setInterval(() => force((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [paused, collapsed]);

  const elapsedMs = startedAt ? Date.now() - startedAt : 0;
  const timer = formatTimer(elapsedMs);

  // ---- Drag (pointer-based; works for touch + mouse) ----
  const SIZE_BAR = { w: 260, h: 48 };
  const SIZE_BUBBLE = { w: 64, h: 64 };
  const size = collapsed ? SIZE_BUBBLE : SIZE_BAR;

  const STORAGE_KEY = "promptBuilder.recordingBarPos.v1";
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 16, y: 16 };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return clampToViewport(p, size);
      }
    } catch { /* noop */ }
    // Default: top-center for the bar; bottom-right for the bubble.
    if (collapsed) {
      return { x: window.innerWidth - SIZE_BUBBLE.w - 16, y: window.innerHeight - SIZE_BUBBLE.h - 90 };
    }
    return { x: Math.max(8, (window.innerWidth - SIZE_BAR.w) / 2), y: 16 };
  });

  // Re-clamp when the layout switches (bar ↔ bubble) so it stays on-screen.
  useEffect(() => {
    setPos((p) => clampToViewport(p, size));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch { /* noop */ }
  }, [pos]);

  const dragRef = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    // Allow buttons inside to handle their own clicks
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, moved: false };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const nx = e.clientX - d.dx;
    const ny = e.clientY - d.dy;
    if (!d.moved && (Math.abs(nx - pos.x) > 3 || Math.abs(ny - pos.y) > 3)) d.moved = true;
    if (!d.moved) return;
    setPos(clampToViewport({ x: nx, y: ny }, size));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    setTimeout(() => { dragRef.current = null; }, 0);
    // Suppress click that comes after a drag
    if (d?.moved) { e.preventDefault(); e.stopPropagation(); }
  };

  // ---- Render: collapsed bubble ----
  if (collapsed) {
    const isRecording = !paused && startedAt !== null;
    return (
      <button
        data-prompt-builder-ui="true"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={(e) => {
          if (dragRef.current?.moved) return;
          e.stopPropagation();
          onExpand();
        }}
        style={{
          left: pos.x, top: pos.y,
          width: SIZE_BUBBLE.w, height: SIZE_BUBBLE.h,
          touchAction: "none",
        }}
        className={cn(
          "fixed z-[2147483646] flex flex-col items-center justify-center gap-0.5 rounded-full shadow-2xl select-none cursor-grab active:cursor-grabbing border-2 transition-colors",
          isRecording
            ? "bg-destructive text-destructive-foreground border-destructive-foreground/20"
            : "bg-primary text-primary-foreground border-primary-foreground/20"
        )}
        title={isRecording ? "Recording — tap to expand" : "Paused — tap to expand"}
      >
        <span
          className={cn(
            "h-2.5 w-2.5 rounded-full bg-current",
            isRecording && "animate-pulse"
          )}
        />
        <span className="text-[11px] font-mono font-semibold leading-none tabular-nums">
          {timer}
        </span>
      </button>
    );
  }

  // ---- Render: full recording bar ----
  const isRecording = !paused && startedAt !== null;
  return (
    <div
      data-prompt-builder-ui="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        left: pos.x, top: pos.y,
        width: SIZE_BAR.w, height: SIZE_BAR.h,
        touchAction: "none",
      }}
      className={cn(
        "fixed z-[2147483646] flex items-center gap-1.5 rounded-full shadow-2xl select-none cursor-grab active:cursor-grabbing border px-2",
        isRecording
          ? "bg-destructive text-destructive-foreground border-destructive-foreground/20"
          : "bg-card text-foreground border-border"
      )}
      role="toolbar"
      aria-label="Recording controls"
    >
      <Mic className={cn("h-4 w-4 shrink-0", isRecording && "animate-pulse")} />
      <span className="text-xs font-medium shrink-0">
        {isRecording ? "Recording" : "Paused"}
      </span>
      <span className="text-xs font-mono tabular-nums opacity-90 shrink-0">
        {timer}
      </span>

      <div className="ml-auto flex items-center gap-0.5" data-no-drag>
        {isRecording ? (
          <button
            onClick={onPause}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-background/20 transition-colors"
            title="Pause"
            aria-label="Pause recording"
          >
            <Pause className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={onResume}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            title="Resume"
            aria-label="Resume recording"
          >
            <Play className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={onStop}
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
            isRecording ? "hover:bg-background/20" : "hover:bg-muted"
          )}
          title="Stop & review"
          aria-label="Stop recording"
        >
          <Square className="h-4 w-4" fill="currentColor" />
        </button>
        <button
          onClick={onMinimize}
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
            isRecording ? "hover:bg-background/20" : "hover:bg-muted"
          )}
          title="Minimize"
          aria-label="Minimize to bubble"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={onExpand}
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
            isRecording ? "hover:bg-background/20" : "hover:bg-muted"
          )}
          title="Open editor"
          aria-label="Open prompt editor"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function formatTimer(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function clampToViewport(p: { x: number; y: number }, size: { w: number; h: number }) {
  if (typeof window === "undefined") return p;
  const pad = 8;
  return {
    x: Math.min(Math.max(pad, p.x), window.innerWidth - size.w - pad),
    y: Math.min(Math.max(pad, p.y), window.innerHeight - size.h - pad),
  };
}
