import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Square, Circle, Undo2, Save, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { screenshotStore } from "./screenshotStore";

type Tool = "rect" | "circle";
interface Shape {
  tool: Tool;
  /** Normalized 0..1 coordinates relative to the image. */
  x1: number; y1: number; x2: number; y2: number;
}

interface Props {
  /** Source screenshot (PNG data URL). */
  imageDataUrl: string;
  onClose: () => void;
  /** Called after the marked-up image is added to a slot. */
  onSaved: (slotN: number) => void;
}

const STROKE = "#CE1126"; // brand red
const STROKE_WIDTH = 4;

/**
 * Lightweight markup overlay: renders the captured screenshot, lets the user
 * draw rectangles or circles, and bakes the markup into a fresh PNG.
 */
export function ScreenshotMarkup({ imageDataUrl, onClose, onSaved }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>("rect");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [drawing, setDrawing] = useState<Shape | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [saving, setSaving] = useState(false);

  // Determine image natural size for rendering / export.
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  const getNorm = (e: React.PointerEvent) => {
    const box = overlayRef.current!.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    const y = (e.clientY - box.top) / box.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const { x, y } = getNorm(e);
    setDrawing({ tool, x1: x, y1: y, x2: x, y2: y });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing) return;
    const { x, y } = getNorm(e);
    setDrawing({ ...drawing, x2: x, y2: y });
  };
  const onPointerUp = () => {
    if (!drawing) return;
    // Discard tiny accidental clicks
    if (Math.abs(drawing.x2 - drawing.x1) < 0.005 && Math.abs(drawing.y2 - drawing.y1) < 0.005) {
      setDrawing(null);
      return;
    }
    setShapes((s) => [...s, drawing]);
    setDrawing(null);
  };

  const undo = () => setShapes((s) => s.slice(0, -1));

  const save = async () => {
    if (!imgSize) return;
    setSaving(true);
    try {
      const dataUrl = await bakeMarkup(imageDataUrl, imgSize, shapes);
      const slot = screenshotStore.add(dataUrl);
      if (slot == null) {
        toast.error("All 10 slots are full. Delete one first.");
      } else {
        toast.success(`Saved as #${slot}`);
        onSaved(slot);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to save markup");
    } finally {
      setSaving(false);
    }
  };

  const renderShape = (s: Shape, idx: number, dim: "preview" | "draft") => {
    const left = `${Math.min(s.x1, s.x2) * 100}%`;
    const top = `${Math.min(s.y1, s.y2) * 100}%`;
    const width = `${Math.abs(s.x2 - s.x1) * 100}%`;
    const height = `${Math.abs(s.y2 - s.y1) * 100}%`;
    const isDraft = dim === "draft";
    return (
      <div
        key={idx}
        className="absolute pointer-events-none"
        style={{
          left, top, width, height,
          border: `${STROKE_WIDTH}px solid ${STROKE}`,
          borderRadius: s.tool === "circle" ? "50%" : "4px",
          opacity: isDraft ? 0.85 : 1,
        }}
      />
    );
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/90 backdrop-blur-sm p-4">
      <div className="bg-background rounded-xl border border-border shadow-2xl flex flex-col max-w-5xl w-full max-h-[90vh]">
        {/* Toolbar */}
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <span className="text-sm font-medium mr-2">Markup</span>
          <Button
            size="sm"
            variant={tool === "rect" ? "default" : "outline"}
            onClick={() => setTool("rect")}
          >
            <Square className="h-3.5 w-3.5 mr-1" /> Rectangle
          </Button>
          <Button
            size="sm"
            variant={tool === "circle" ? "default" : "outline"}
            onClick={() => setTool("circle")}
          >
            <Circle className="h-3.5 w-3.5 mr-1" /> Circle
          </Button>
          <Button size="sm" variant="ghost" onClick={undo} disabled={shapes.length === 0}>
            <Undo2 className="h-3.5 w-3.5 mr-1" /> Undo
          </Button>
          <span className="text-xs text-muted-foreground ml-2">
            {shapes.length} mark{shapes.length === 1 ? "" : "s"}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Save to slot
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto p-4 bg-muted/30">
          <div
            ref={overlayRef}
            className="relative inline-block cursor-crosshair select-none mx-auto"
            style={{ touchAction: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <img
              ref={imgRef}
              src={imageDataUrl}
              alt="Capture"
              draggable={false}
              className="block max-w-full h-auto rounded border border-border"
              style={{ maxHeight: "70vh" }}
            />
            {shapes.map((s, i) => renderShape(s, i, "preview"))}
            {drawing && renderShape(drawing, -1, "draft")}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders the source image plus the shape overlays into a single PNG data URL.
 */
async function bakeMarkup(
  imageDataUrl: string,
  size: { w: number; h: number },
  shapes: Shape[],
): Promise<string> {
  const img = await loadImage(imageDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(img, 0, 0, size.w, size.h);
  ctx.strokeStyle = STROKE;
  // Scale stroke so it stays visible relative to image size.
  ctx.lineWidth = Math.max(STROKE_WIDTH, Math.round(size.w / 400));

  for (const s of shapes) {
    const x = Math.min(s.x1, s.x2) * size.w;
    const y = Math.min(s.y1, s.y2) * size.h;
    const w = Math.abs(s.x2 - s.x1) * size.w;
    const h = Math.abs(s.y2 - s.y1) * size.h;
    if (s.tool === "rect") {
      ctx.strokeRect(x, y, w, h);
    } else {
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
