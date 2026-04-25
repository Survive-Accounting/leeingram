import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Palette, Download, FileText, Image as ImageIcon, Layers, Loader2, ChevronDown, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  buildMarkdownBrief, buildZipBundle, captureElementToPng, captureFullPage,
  downloadBlob, downloadText, findExportableSections, type ExportableSection,
} from "@/lib/styleExport";

const ALLOWED = ["lee@survivestudios.com", "jking.cim@gmail.com"];
const HIDDEN_KEY = "styleExport.hidden.v1";

export function StyleExportToolbar() {
  const { user } = useAuth();
  const allowed = ALLOWED.includes((user?.email ?? "").trim().toLowerCase());
  const POS_KEY = "styleExport.launcherPos.v1";

  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(HIDDEN_KEY) === "1"; } catch { return false; }
  });
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 16, y: 152 };
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          x: Math.min(Math.max(8, parsed.x ?? 16), window.innerWidth - 60),
          y: Math.min(Math.max(8, parsed.y ?? 152), window.innerHeight - 60),
        };
      }
    } catch { /* noop */ }
    return { x: 16, y: Math.max(152, window.innerHeight - 84) };
  });
  const dragRef = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sections, setSections] = useState<ExportableSection[]>([]);

  useEffect(() => {
    try { localStorage.setItem(HIDDEN_KEY, hidden ? "1" : "0"); } catch { /* noop */ }
  }, [hidden]);

  useEffect(() => {
    try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* noop */ }
  }, [pos]);

  useEffect(() => {
    const onResize = () => {
      setPos((p) => ({
        x: Math.min(Math.max(8, p.x), window.innerWidth - 60),
        y: Math.min(Math.max(8, p.y), window.innerHeight - 60),
      }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Refresh detected sections every time the popover opens
  const refreshSections = () => setSections(findExportableSections());

  const onLauncherPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, moved: false };
  };

  const onLauncherPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const nx = e.clientX - d.dx;
    const ny = e.clientY - d.dy;
    const movedNow = Math.abs(nx - pos.x) > 3 || Math.abs(ny - pos.y) > 3;
    if (movedNow && !d.moved) {
      d.moved = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    }
    if (!d.moved) return;
    const w = e.currentTarget.offsetWidth;
    const h = e.currentTarget.offsetHeight;
    setPos({
      x: Math.min(Math.max(8, nx), window.innerWidth - w - 8),
      y: Math.min(Math.max(8, ny), window.innerHeight - h - 8),
    });
  };

  const onLauncherPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (d?.moved) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    }
    setTimeout(() => { dragRef.current = null; }, 0);
  };

  const onLauncherClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (dragRef.current?.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  if (!allowed) return null;

  const wrap = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally { setBusy(null); }
  };

  if (hidden) {
    return (
      <button
        data-export-ignore
        onClick={() => setHidden(false)}
        className="fixed bottom-3 left-16 z-[9998] rounded-full bg-background/80 backdrop-blur px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground border border-border shadow-sm transition-colors"
        title="Show Style Export toolbar"
        aria-label="Show Style Export toolbar"
      >
        🎨
      </button>
    );
  }

  return (
    <div
      data-export-ignore
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-[9998] flex items-center gap-1.5 group"
    >
      <Popover open={open} onOpenChange={(o) => {
        setOpen(o);
        if (o) refreshSections();
      }}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="secondary"
            onPointerDown={onLauncherPointerDown}
            onPointerMove={onLauncherPointerMove}
            onPointerUp={onLauncherPointerUp}
            onClick={onLauncherClick}
            style={{ touchAction: "none" }}
            className="rounded-full shadow-lg gap-2 px-4 py-2.5 h-auto cursor-grab active:cursor-grabbing select-none ring-2 ring-primary-foreground/20 hover:scale-105 transition-transform"
            aria-label="Open Style Export — drag to move"
            title="Click to open · Drag to move"
          >
            <Palette className="h-4 w-4" />
            Style Export
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="right"
          className="w-72 p-2 space-y-1"
          data-export-ignore
        >
          <div className="px-2 pt-1 pb-1 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
            Style Pack
          </div>
          <ToolbarItem
            icon={<Download className="h-3.5 w-3.5" />}
            label="Download bundle (.zip)"
            sub="Tokens + landing components + page"
            busy={busy === "zip"}
            onClick={() => wrap("zip", async () => {
              const blob = await buildZipBundle();
              downloadBlob(blob, "survive-landing-style-pack.zip");
              toast.success("Style pack downloaded");
            })}
          />
          <ToolbarItem
            icon={<FileText className="h-3.5 w-3.5" />}
            label="Download brief (.md)"
            sub="Single Markdown file for ChatGPT"
            busy={busy === "md"}
            onClick={() => wrap("md", async () => {
              const md = await buildMarkdownBrief();
              downloadText(md, "survive-landing-style-pack.md", "text/markdown");
              toast.success("Markdown brief downloaded");
            })}
          />

          <div className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
            Page PNG
          </div>
          <ToolbarItem
            icon={<ImageIcon className="h-3.5 w-3.5" />}
            label="Export full page (.png)"
            sub="Entire landing — high-DPR snapshot"
            busy={busy === "page"}
            onClick={() => wrap("page", async () => {
              await captureFullPage(`landing-full-${Date.now()}.png`);
              toast.success("Page PNG saved");
            })}
          />

          <div className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground flex items-center gap-1.5">
            <Layers className="h-3 w-3" /> Section PNGs
          </div>
          {sections.length === 0 ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              No sections detected on this page.
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto">
              {sections.map((s) => (
                <ToolbarItem
                  key={s.id}
                  icon={<ImageIcon className="h-3.5 w-3.5" />}
                  label={s.label}
                  sub={`#${s.id}`}
                  busy={busy === `section-${s.id}`}
                  onClick={() => wrap(`section-${s.id}`, async () => {
                    await captureElementToPng(
                      s.element,
                      `landing-${s.id}-${Date.now()}.png`,
                    );
                    toast.success(`${s.label} PNG saved`);
                  })}
                />
              ))}
            </div>
          )}

          <div className="border-t border-border mt-2 pt-1.5 px-1 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              Lee-only · landing routes
            </span>
            <button
              onClick={() => {
                setOpen(false);
                setHidden(true);
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <EyeOff className="h-3 w-3" /> Hide
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ToolbarItem({
  icon, label, sub, busy, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="w-full flex items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50 transition-colors"
    >
      <span className="mt-0.5 text-muted-foreground">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-medium text-foreground truncate">{label}</span>
        {sub && (
          <span className="block text-[10px] text-muted-foreground truncate">{sub}</span>
        )}
      </span>
    </button>
  );
}
