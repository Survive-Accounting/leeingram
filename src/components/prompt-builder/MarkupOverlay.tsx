import { useEffect, useRef, useState } from "react";
import { Undo2, Trash2, X } from "lucide-react";

interface Circle {
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

type HandlePos = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

type Interaction =
  | { mode: "create"; startX: number; startY: number; id: string }
  | { mode: "move"; startX: number; startY: number; startCircle: Circle; id: string }
  | { mode: "resize"; startX: number; startY: number; startCircle: Circle; id: string; handle: HandlePos };

interface Props {
  onClose: () => void;
}

const STROKE = "#CE1126";
const STROKE_WIDTH = 3;
const HANDLES: HandlePos[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

let _idCounter = 0;
const newId = () => `c_${Date.now()}_${++_idCounter}`;

/**
 * Minimal markup overlay: draggable, resizable red circles only.
 * Drag empty space to create. Click ring to select. Drag body to move,
 * drag handles to resize, ✕ to delete. Esc to close. PrtScn to capture.
 */
export function MarkupOverlay({ onClose }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<Interaction | null>(null);

  // Esc closes overlay; Delete/Backspace removes selected circle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const target = e.target as HTMLElement | null;
        if (target && target.matches("input, textarea, [contenteditable='true']")) return;
        e.preventDefault();
        setCircles((cs) => cs.filter((c) => c.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, selectedId]);

  const getPoint = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onSurfacePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Only handle if user clicked the bare SVG (not a circle/handle/button)
    if (e.target !== svgRef.current) return;
    const p = getPoint(e);
    setSelectedId(null);
    const id = newId();
    const newCircle: Circle = { id, cx: p.x, cy: p.y, rx: 0, ry: 0 };
    setCircles((cs) => [...cs, newCircle]);
    setInteraction({ mode: "create", startX: p.x, startY: p.y, id });
    (svgRef.current as Element).setPointerCapture(e.pointerId);
  };

  const onCirclePointerDown = (e: React.PointerEvent, c: Circle) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const p = getPoint(e);
    setSelectedId(c.id);
    setInteraction({ mode: "move", startX: p.x, startY: p.y, startCircle: c, id: c.id });
    (svgRef.current as Element).setPointerCapture(e.pointerId);
  };

  const onHandlePointerDown = (e: React.PointerEvent, c: Circle, handle: HandlePos) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const p = getPoint(e);
    setSelectedId(c.id);
    setInteraction({ mode: "resize", startX: p.x, startY: p.y, startCircle: c, id: c.id, handle });
    (svgRef.current as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!interaction) return;
    const p = getPoint(e);
    const dx = p.x - interaction.startX;
    const dy = p.y - interaction.startY;

    setCircles((cs) =>
      cs.map((c) => {
        if (c.id !== interaction.id) return c;

        if (interaction.mode === "create") {
          // Build a bbox from start point to current point
          const x1 = interaction.startX, y1 = interaction.startY, x2 = p.x, y2 = p.y;
          return {
            ...c,
            cx: (x1 + x2) / 2,
            cy: (y1 + y2) / 2,
            rx: Math.abs(x2 - x1) / 2,
            ry: Math.abs(y2 - y1) / 2,
          };
        }

        if (interaction.mode === "move") {
          return {
            ...c,
            cx: interaction.startCircle.cx + dx,
            cy: interaction.startCircle.cy + dy,
          };
        }

        // resize: compute new bbox from original bbox + handle offset
        const sc = interaction.startCircle;
        let x1 = sc.cx - sc.rx;
        let y1 = sc.cy - sc.ry;
        let x2 = sc.cx + sc.rx;
        let y2 = sc.cy + sc.ry;
        const h = interaction.handle;
        if (h.includes("w")) x1 += dx;
        if (h.includes("e")) x2 += dx;
        if (h.includes("n")) y1 += dy;
        if (h.includes("s")) y2 += dy;
        const nx1 = Math.min(x1, x2);
        const nx2 = Math.max(x1, x2);
        const ny1 = Math.min(y1, y2);
        const ny2 = Math.max(y1, y2);
        return {
          ...c,
          cx: (nx1 + nx2) / 2,
          cy: (ny1 + ny2) / 2,
          rx: (nx2 - nx1) / 2,
          ry: (ny2 - ny1) / 2,
        };
      })
    );
  };

  const onPointerUp = () => {
    if (!interaction) return;
    if (interaction.mode === "create") {
      // Drop tiny accidental circles
      setCircles((cs) => {
        const c = cs.find((x) => x.id === interaction.id);
        if (c && (c.rx < 6 || c.ry < 6)) {
          return cs.filter((x) => x.id !== interaction.id);
        }
        // Auto-select the freshly created circle
        if (c) setSelectedId(c.id);
        return cs;
      });
    }
    setInteraction(null);
  };

  const undo = () => {
    setCircles((cs) => {
      const next = cs.slice(0, -1);
      if (selectedId && !next.some((c) => c.id === selectedId)) setSelectedId(null);
      return next;
    });
  };
  const clearAll = () => {
    setCircles([]);
    setSelectedId(null);
  };
  const deleteCircle = (id: string) => {
    setCircles((cs) => cs.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleCursor = (h: HandlePos): string => {
    switch (h) {
      case "n": case "s": return "ns-resize";
      case "e": case "w": return "ew-resize";
      case "ne": case "sw": return "nesw-resize";
      case "nw": case "se": return "nwse-resize";
    }
  };

  const handlePoint = (c: Circle, h: HandlePos) => {
    const x1 = c.cx - c.rx, y1 = c.cy - c.ry, x2 = c.cx + c.rx, y2 = c.cy + c.ry;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    switch (h) {
      case "nw": return { x: x1, y: y1 };
      case "n":  return { x: mx, y: y1 };
      case "ne": return { x: x2, y: y1 };
      case "e":  return { x: x2, y: my };
      case "se": return { x: x2, y: y2 };
      case "s":  return { x: mx, y: y2 };
      case "sw": return { x: x1, y: y2 };
      case "w":  return { x: x1, y: my };
    }
  };

  return (
    <>
      <svg
        ref={svgRef}
        data-prompt-builder-ui="true"
        className="fixed inset-0 z-[2147483646]"
        style={{ touchAction: "none", cursor: "crosshair", background: "rgba(0,0,0,0.001)" }}
        onPointerDown={onSurfacePointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {circles.map((c) => {
          const isSelected = c.id === selectedId;
          return (
            <g key={c.id}>
              {/* The visible ring — only the stroke is grabbable */}
              <ellipse
                cx={c.cx}
                cy={c.cy}
                rx={Math.max(c.rx, 0.1)}
                ry={Math.max(c.ry, 0.1)}
                fill="none"
                stroke={STROKE}
                strokeWidth={STROKE_WIDTH}
                style={{ pointerEvents: "stroke", cursor: "move" }}
                onPointerDown={(e) => onCirclePointerDown(e, c)}
              />
              {isSelected && (
                <>
                  {/* Selection bbox */}
                  <rect
                    x={c.cx - c.rx}
                    y={c.cy - c.ry}
                    width={c.rx * 2}
                    height={c.ry * 2}
                    fill="none"
                    stroke={STROKE}
                    strokeOpacity={0.5}
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    style={{ pointerEvents: "none" }}
                  />
                  {/* Resize handles */}
                  {HANDLES.map((h) => {
                    const p = handlePoint(c, h);
                    return (
                      <rect
                        key={h}
                        x={p.x - 5}
                        y={p.y - 5}
                        width={10}
                        height={10}
                        fill="#fff"
                        stroke={STROKE}
                        strokeWidth={1.5}
                        style={{ cursor: handleCursor(h) }}
                        onPointerDown={(e) => onHandlePointerDown(e, c, h)}
                      />
                    );
                  })}
                  {/* Delete button — small red ✕ at top-right of bbox */}
                  <g
                    style={{ cursor: "pointer" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      deleteCircle(c.id);
                    }}
                  >
                    <circle
                      cx={c.cx + c.rx + 12}
                      cy={c.cy - c.ry - 12}
                      r={9}
                      fill={STROKE}
                      stroke="#fff"
                      strokeWidth={1.5}
                    />
                    <line
                      x1={c.cx + c.rx + 12 - 4}
                      y1={c.cy - c.ry - 12 - 4}
                      x2={c.cx + c.rx + 12 + 4}
                      y2={c.cy - c.ry - 12 + 4}
                      stroke="#fff"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                    <line
                      x1={c.cx + c.rx + 12 + 4}
                      y1={c.cy - c.ry - 12 - 4}
                      x2={c.cx + c.rx + 12 - 4}
                      y2={c.cy - c.ry - 12 + 4}
                      stroke="#fff"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                  </g>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Toolbar */}
      <div
        data-prompt-builder-ui="true"
        className="fixed top-3 left-1/2 -translate-x-1/2 z-[2147483647] flex items-center gap-1 rounded-full border border-border bg-background/95 backdrop-blur shadow-lg px-2 py-1"
      >
        <span className="text-[10px] text-muted-foreground px-1.5">Drag to draw a circle</span>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolButton onClick={undo} disabled={circles.length === 0} title="Undo">
          <Undo2 className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={clearAll} disabled={circles.length === 0} title="Clear all">
          <Trash2 className="h-3.5 w-3.5" />
        </ToolButton>
        <div className="w-px h-5 bg-border mx-1" />
        <span className="text-[10px] text-muted-foreground px-1.5">PrtScn to capture</span>
        <ToolButton onClick={onClose} title="Close markup (Esc)">
          <X className="h-3.5 w-3.5" />
        </ToolButton>
      </div>
    </>
  );
}

function ToolButton({
  children, onClick, disabled, title,
}: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-7 w-7 inline-flex items-center justify-center rounded-full transition-colors text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
    >
      {children}
    </button>
  );
}
