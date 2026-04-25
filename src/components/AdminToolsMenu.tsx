import { useState, useEffect } from "react";
import { Wrench, ChevronDown } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useIsStaff } from "@/hooks/useIsStaff";
import { useDevToolFlag, setDevToolFlag, type DevToolKey } from "@/lib/devToolFlags";

const ITEMS: { key: DevToolKey; label: string; sub: string }[] = [
  { key: "promptBuilder", label: "Prompt Builder", sub: "Floating draggable prompt tool" },
  { key: "styleExport",   label: "Style Export",   sub: "Export tokens, screenshots, brief" },
  { key: "testBar",       label: "Show Test Bar",  sub: "Student-flow path + reset session" },
];

const HIDDEN_STORAGE_KEY = "devTool.adminBar.hidden";

export function AdminToolsMenu() {
  const isStaff = useIsStaff();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(HIDDEN_STORAGE_KEY) === "1"; } catch { return false; }
  });

  // Ctrl+Alt+A toggles the bar (works even when hidden)
  useEffect(() => {
    if (!isStaff) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey && (e.key === "a" || e.key === "A")) {
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
  }, [isStaff]);

  if (!isStaff) return null;
  if (hidden) return null;

  return (
    <div
      data-export-ignore
      className="fixed top-2 left-1/2 -translate-x-1/2 z-[2147483600]"
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/95 backdrop-blur px-3 py-1 text-xs font-semibold text-foreground shadow-md hover:bg-muted transition-colors"
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
          <div className="mt-2 border-t border-border pt-1.5 px-2 text-[10px] text-muted-foreground">
            Per-browser. Toggle anytime.
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ToggleRow({ item }: { item: { key: DevToolKey; label: string; sub: string } }) {
  const value = useDevToolFlag(item.key);
  return (
    <label className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted cursor-pointer">
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
