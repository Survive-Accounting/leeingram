import { useState, useEffect } from "react";
import { Wrench, ChevronDown, GripVertical } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useIsStaff } from "@/hooks/useIsStaff";
import { useDevToolFlag, setDevToolFlag, type DevToolKey } from "@/lib/devToolFlags";
import { useDraggable } from "@/components/prompt-builder/useDraggable";

const ITEMS: { key: DevToolKey; label: string; sub: string }[] = [
  { key: "promptBuilder", label: "Prompt Builder", sub: "Floating draggable prompt tool" },
  { key: "styleExport",   label: "Style Export",   sub: "Export tokens, screenshots, brief" },
  { key: "testBar",       label: "Show Test Bar",  sub: "Student-flow path + reset session" },
];

const HIDDEN_STORAGE_KEY = "devTool.adminBar.hidden";
const POS_STORAGE_KEY = "devTool.adminBar.pos";
const SIZE = { w: 180, h: 32 };

function defaultPos() {
  if (typeof window === "undefined") return { x: 600, y: 8 };
  return { x: Math.max(8, window.innerWidth / 2 - SIZE.w / 2), y: 8 };
}

export function AdminToolsMenu() {
  const isStaff = useIsStaff();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    // One-time migration: clear stale hidden flag so the bar reappears for staff
    // after the shortcut change. Safe to remove later.
    try {
      if (!localStorage.getItem("devTool.adminBar.migrated.v2")) {
        localStorage.removeItem(HIDDEN_STORAGE_KEY);
        localStorage.setItem("devTool.adminBar.migrated.v2", "1");
        return false;
      }
      return localStorage.getItem(HIDDEN_STORAGE_KEY) === "1";
    } catch { return false; }
  });

  const { pos, dragHandlers } = useDraggable(POS_STORAGE_KEY, defaultPos(), SIZE);

  // Ctrl+Shift+A or Ctrl+Alt+A toggles the bar (works even when hidden).
  // Register regardless of staff status — auth may load late, and we want the
  // shortcut to be reliable across every page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isToggle =
        e.ctrlKey &&
        !e.metaKey &&
        (e.shiftKey || e.altKey) &&
        (e.key === "a" || e.key === "A");
      if (isToggle) {
        e.preventDefault();
        setHidden((prev) => {
          const next = !prev;
          try { localStorage.setItem(HIDDEN_STORAGE_KEY, next ? "1" : "0"); } catch { /* noop */ }
          if (next) setOpen(false);
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!isStaff) return null;
  if (hidden) return null;

  return (
    <div
      data-export-ignore
      className="fixed z-[2147483600]"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={dragHandlers.onPointerDown}
      onPointerMove={dragHandlers.onPointerMove}
      onPointerUp={dragHandlers.onPointerUp}
    >
      <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background/95 backdrop-blur shadow-md">
        <span
          data-drag-handle="true"
          className="pl-2 pr-0.5 py-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          title="Drag to move"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-no-drag
              className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-3 py-1 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
              title="Admin tools"
            >
              <Wrench className="h-3.5 w-3.5" />
              Admin Tools
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="center"
            side="bottom"
            className="w-72 p-2"
            data-export-ignore
          >
            <div className="px-2 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Show / Hide Dev Tools
            </div>
            <div className="space-y-1">
              {ITEMS.map((item) => (
                <ToggleRow key={item.key} item={item} />
              ))}
            </div>
            <div className="mt-2 border-t border-border pt-1.5 px-2 text-[10px] text-muted-foreground space-y-0.5">
              <div>Per-browser. Toggle anytime. Drag the handle to move.</div>
              <div>
                Hide / show this bar:{" "}
                <kbd className="inline-flex items-center rounded border border-border bg-muted px-1 py-[1px] font-mono text-[9px] text-foreground">
                  Ctrl + Shift + A
                </kbd>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function ToggleRow({ item }: { item: { key: DevToolKey; label: string; sub: string } }) {
  const value = useDevToolFlag(item.key);
  return (
    <label className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted cursor-pointer" data-no-drag>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-medium text-foreground truncate">{item.label}</span>
        <span className="block text-[10px] text-muted-foreground truncate">{item.sub}</span>
      </span>
      <Switch
        checked={value}
        onCheckedChange={(v) => setDevToolFlag(item.key, v)}
      />
    </label>
  );
}
