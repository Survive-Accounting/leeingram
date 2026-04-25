import { useEffect, useRef, useState } from "react";
import { Square, Circle, Pencil, Undo2, Trash2, X } from "lucide-react";

type Tool = "rect" | "circle" | "free";
interface Shape {
  tool: Tool;
  /** For rect/circle: bbox; for free: ignored (uses points) */
  x1: number; y1: number; x2: number; y2: number;
  points?: { x: number; y: number }[];
}

interface Props {
  onClose: () => void;
}

const STROKE = "#CE1126";
const STROKE_WIDTH = 3;

/**
 * Full-screen transparent overlay. Lets the user draw red rectangles, circles,
 * or freehand strokes directly on top of the live page (purely visual — used
 * to point at things while talking through a prompt). Click PrtScn to capture.
 */
export function MarkupOverlay({ onClose }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<Tool>("rect");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const point = (e: React.PointerEvent) => ({ x: e.clientX, y: e.clientY });

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = point(e);
    if (tool === "free") {
      setDraft({ tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y, points: [p] });
    } else {
      setDraft({ tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (!draft) return;
    const p = point(e);
    if (draft.tool === "free") {
      setDraft({ ...draft, x2: p.x, y2: p.y, points: [...(draft.points ?? []), p] });
    } else {
      setDraft({ ...draft, x2: p.x, y2: p.y });
    }
  };
  const onUp = () => {
    if (!draft) return;
    const tiny = Math.abs(draft.x2 - draft.x1) < 4 && Math.abs(draft.y2 - draft.y1) < 4 && draft.tool !== "free";
    if (!tiny) setShapes((s) => [...s, draft]);
    setDraft(null);
  };

  const undo = () => setShapes((s) => s.slice(0, -1));
  const clear = () => setShapes([]);

  const renderShape = (s: Shape, key: string | number) => {
    if (s.tool === "free") {
      const d = (s.points ?? []).map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
      return <path key={key} d={d} fill="none" stroke={STROKE} strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />;
    }
    const x = Math.min(s.x1, s.x2);
    const y = Math.min(s.y1, s.y2);
    const w = Math.abs(s.x2 - s.x1);
    const h = Math.abs(s.y2 - s.y1);
    if (s.tool === "rect") {
      return <rect key={key} x={x} y={y} width={w} height={h} fill="none" stroke={STROKE} strokeWidth={STROKE_WIDTH} rx={4} />;
    }
    return <ellipse key={key} cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} fill="none" stroke={STROKE} strokeWidth={STROKE_WIDTH} />;
  };

  return (
    <>
      {/* Drawing surface */}
      <svg
        ref={svgRef}
        data-prompt-builder-ui="true"
        className="fixed inset-0 z-[2147483646]"
        style={{ touchAction: "none", cursor: "crosshair", background: "rgba(0,0,0,0.001)" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        {shapes.map((s, i) => renderShape(s, i))}
        {draft && renderShape(draft, "draft")}
      </svg>

      {/* Toolbar */}
      <div
        data-prompt-builder-ui="true"
        className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-1 rounded-full border border-border bg-background/95 backdrop-blur shadow-lg px-1.5 py-1"
      >
        <ToolButton active={tool === "rect"} onClick={() => setTool("rect")} title="Rectangle">
          <Square className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton active={tool === "circle"} onClick={() => setTool("circle")} title="Circle">
          <Circle className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton active={tool === "free"} onClick={() => setTool("free")} title="Freehand">
          <Pencil className="h-3.5 w-3.5" />
        </ToolButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolButton onClick={undo} disabled={shapes.length === 0} title="Undo">
          <Undo2 className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={clear} disabled={shapes.length === 0} title="Clear all">
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
  children, active, onClick, disabled, title,
}: {
  children: React.ReactNode; active?: boolean; onClick: () => void; disabled?: boolean; title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        "h-7 w-7 inline-flex items-center justify-center rounded-full transition-colors " +
        (active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground")
      }
    >
      {children}
    </button>
  );
}
