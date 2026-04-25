import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Zap, Mic, MicOff, X, Copy, Loader2, Sparkles,
  Wrench, Plus, TrendingUp, Send, Trash2, EyeOff, Minus, GripHorizontal,
  Pencil, ListTodo, Hammer, Image as ImageIcon, ClipboardCopy,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { copyToClipboard } from "@/lib/clipboardFallback";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDraggable } from "./prompt-builder/useDraggable";
import { MarkupOverlay } from "./prompt-builder/MarkupOverlay";

const ALLOWED = ["lee@survivestudios.com", "jking.cim@gmail.com"];
const LOVABLE_URL = "https://lovable.dev/projects/51843e0a-bf2a-4413-bab2-a6c4ea7a1395";

type Mode = "ui_fix" | "new_feature" | "conversion";
type PromptKind = "build" | "plan";
type CardStatus = "generating" | "ready" | "sent" | "error";

interface PromptCard {
  id: string;
  status: CardStatus;
  mode: Mode;
  kind: PromptKind;
  inputText: string;
  output: string;
  /** Screenshots pasted into the input — preserved on the card for re-paste into Lovable. */
  screenshots: string[];
  error?: string;
  createdAt: number;
}

const MAX_SCREENSHOTS = 10;

const MODES: { key: Mode; label: string; icon: typeof Wrench }[] = [
  { key: "ui_fix", label: "UI Fix", icon: Wrench },
  { key: "new_feature", label: "Feature", icon: Plus },
  { key: "conversion", label: "Convert", icon: TrendingUp },
];

const STATUS_STYLES: Record<CardStatus, string> = {
  generating: "border-primary/40 bg-primary/5",
  ready: "border-emerald-500/50 bg-emerald-500/5",
  sent: "border-border bg-muted/20 opacity-70",
  error: "border-destructive/50 bg-destructive/5",
};

const HIDDEN_KEY = "promptBuilder.hidden.v1";
const POS_KEY = "promptBuilder.launcherPos.v1";
const WINDOW_SIZE = { w: 380, h: 520 };

export function PromptBuilderWidget() {
  const { user } = useAuth();
  const allowed = ALLOWED.includes((user?.email ?? "").trim().toLowerCase());

  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(HIDDEN_KEY) === "1"; } catch { return false; }
  });
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [mode, setMode] = useState<Mode>("new_feature");
  const [recording, setRecording] = useState(false);
  const [cards, setCards] = useState<PromptCard[]>([]);
  const [markupOn, setMarkupOn] = useState(false);
  const [screenshots, setScreenshots] = useState<string[]>([]);

  const { pos: winPos, dragHandlers } = useDraggable(
    "promptBuilder.windowPos.v2",
    { x: typeof window !== "undefined" ? Math.max(24, window.innerWidth - WINDOW_SIZE.w - 24) : 24, y: 80 },
    WINDOW_SIZE,
  );

  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Draggable launcher
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 16, y: 80 };
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return {
          x: Math.min(Math.max(8, p.x ?? 16), window.innerWidth - 60),
          y: Math.min(Math.max(8, p.y ?? 80), window.innerHeight - 60),
        };
      }
    } catch { /* noop */ }
    return { x: 16, y: Math.max(80, window.innerHeight - 140) };
  });
  const dragRef = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  useEffect(() => {
    try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* noop */ }
  }, [pos]);

  useEffect(() => {
    try { localStorage.setItem(HIDDEN_KEY, hidden ? "1" : "0"); } catch { /* noop */ }
  }, [hidden]);

  useEffect(() => {
    const onShow = () => setHidden(false);
    window.addEventListener("promptBuilder:show", onShow);
    return () => window.removeEventListener("promptBuilder:show", onShow);
  }, []);

  // Hotkey: Cmd/Ctrl+K to open. Shift to toggle visibility.
  useEffect(() => {
    if (!allowed) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (e.shiftKey) {
          setHidden((h) => !h);
        } else {
          if (hidden) setHidden(false);
          setOpen((v) => !v);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [allowed, hidden]);

  useEffect(() => () => { try { recognitionRef.current?.stop?.(); } catch { /* noop */ } }, []);

  useEffect(() => {
    if (!open || minimized) return;
    const t = window.setTimeout(() => textareaRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open, minimized]);

  // Auto-scroll textarea as transcription streams in
  useEffect(() => {
    if (recording && textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [text, interim, recording]);

  // ---- Launcher drag ----
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
    if (!d.moved && (Math.abs(nx - pos.x) > 3 || Math.abs(ny - pos.y) > 3)) {
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
    if (d?.moved) { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ } }
    setTimeout(() => { dragRef.current = null; }, 0);
  };
  const onLauncherClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (dragRef.current?.moved) { e.preventDefault(); e.stopPropagation(); return; }
    setOpen(true);
  };

  // ---- Speech ----
  const startRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Speech recognition not supported. Try Chrome or Edge."); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    baseTextRef.current = text ? text + (text.endsWith(" ") || text.endsWith("\n") ? "" : " ") : "";

    rec.onresult = (event: any) => {
      let interimText = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalChunk += transcript;
        else interimText += transcript;
      }
      if (finalChunk) {
        baseTextRef.current += finalChunk;
        setText(baseTextRef.current);
        setInterim("");
      } else {
        setInterim(interimText);
      }
    };
    rec.onerror = (e: any) => { toast.error(`Mic error: ${e.error || "unknown"}`); setRecording(false); setInterim(""); };
    rec.onend = () => { setRecording(false); setInterim(""); };

    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  };

  const stopRecording = () => {
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    setRecording(false);
    setInterim("");
  };

  // ---- Screenshots: paste / accumulate / copy back to clipboard ----
  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  /** Capture pasted images from anywhere in the widget. */
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageItems = items.filter((it) => it.type.startsWith("image/"));
    if (imageItems.length === 0) return; // let normal text paste through
    e.preventDefault();
    const remaining = MAX_SCREENSHOTS - screenshots.length;
    if (remaining <= 0) {
      toast.error(`Max ${MAX_SCREENSHOTS} screenshots — delete one first.`);
      return;
    }
    const toAdd = imageItems.slice(0, remaining);
    const urls: string[] = [];
    for (const it of toAdd) {
      const f = it.getAsFile();
      if (!f) continue;
      try { urls.push(await fileToDataUrl(f)); } catch { /* skip */ }
    }
    if (urls.length === 0) return;
    setScreenshots((s) => [...s, ...urls]);
    toast.success(`Added ${urls.length} screenshot${urls.length > 1 ? "s" : ""}`);
  }, [screenshots.length]);

  const removeScreenshot = (idx: number) =>
    setScreenshots((s) => s.filter((_, i) => i !== idx));

  /** Convert data URL → Blob and write to clipboard so user can paste into Lovable. */
  const copyImageToClipboard = async (dataUrl: string, label: string) => {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      // Some browsers only accept image/png in clipboard.
      const item = new ClipboardItem({ [blob.type || "image/png"]: blob });
      await navigator.clipboard.write([item]);
      toast.success(`${label} copied — paste into Lovable`);
    } catch (err) {
      toast.error("Image copy not supported in this browser");
      // eslint-disable-next-line no-console
      console.warn("clipboard image write failed", err);
    }
  };

  // ---- AI ----
  const callAI = async (payload: { text: string; mode: Mode; promptKind: PromptKind }) => {
    const { data, error } = await supabase.functions.invoke("generate-lovable-prompt", { body: payload });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return (data as any)?.prompt ?? "";
  };

  const generate = useCallback((kind: PromptKind) => {
    const trimmed = (text + (interim ? " " + interim : "")).trim();
    if (!trimmed) { toast.error("Add a description first."); return; }
    if (recording) stopRecording();

    const id = crypto.randomUUID();
    const card: PromptCard = {
      id, status: "generating", mode, kind,
      inputText: trimmed, output: "",
      screenshots: [...screenshots],
      createdAt: Date.now(),
    };
    setCards((prev) => [card, ...prev]);
    setText("");
    setInterim("");
    baseTextRef.current = "";
    setScreenshots([]);

    callAI({ text: trimmed, mode, promptKind: kind })
      .then((prompt) => setCards((prev) => prev.map((c) => c.id === id ? { ...c, status: "ready", output: prompt } : c)))
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Generation failed";
        setCards((prev) => prev.map((c) => c.id === id ? { ...c, status: "error", error: msg } : c));
        toast.error(msg);
      });
  }, [text, interim, mode, recording, screenshots]);

  const copyCard = async (card: PromptCard) => {
    const ok = await copyToClipboard(card.output);
    if (ok) toast.success("Prompt copied");
    else toast.error("Copy failed");
  };
  const sendToLovable = async (card: PromptCard) => {
    const ok = await copyToClipboard(card.output);
    if (ok) toast.success("Copied — paste into Lovable");
    window.open(LOVABLE_URL, "_blank", "noopener,noreferrer");
    setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, status: "sent" } : c));
  };
  const deleteCard = (id: string) => setCards((prev) => prev.filter((c) => c.id !== id));

  if (!allowed) return null;

  if (hidden) {
    return (
      <button
        data-prompt-builder-ui="true"
        onClick={() => setHidden(false)}
        className="fixed bottom-10 left-2 z-[9999] rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 border border-primary shadow-md transition-colors"
        title="Show Prompt Builder (Shift+⌘K)"
      >
        ⚡ Prompt Builder
      </button>
    );
  }

  return (
    <>
      {/* Launcher pill */}
      <div data-prompt-builder-ui="true" style={{ left: pos.x, top: pos.y }} className="fixed z-[9999] flex items-center gap-1.5 group">
        <button
          onPointerDown={onLauncherPointerDown}
          onPointerMove={onLauncherPointerMove}
          onPointerUp={onLauncherPointerUp}
          onClick={onLauncherClick}
          style={{ touchAction: "none" }}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/30 hover:scale-105 transition-transform cursor-grab active:cursor-grabbing select-none ring-2 ring-primary-foreground/20"
          title="Click to open · Drag to move · ⌘K"
        >
          <Zap className="h-4 w-4" />
          Build Prompt
        </button>
        <button
          onClick={() => setHidden(true)}
          className="opacity-0 group-hover:opacity-100 rounded-full bg-background/90 backdrop-blur p-1.5 text-muted-foreground hover:text-foreground border border-border shadow-sm transition-opacity"
          title="Hide (Shift+⌘K to toggle)"
        >
          <EyeOff className="h-3 w-3" />
        </button>
      </div>

      {/* Minimized pill */}
      {open && minimized && (
        <button
          data-prompt-builder-ui="true"
          onClick={() => setMinimized(false)}
          className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-lg hover:scale-105 transition-transform"
        >
          <Sparkles className="h-3.5 w-3.5" /> Prompt Builder
          {recording && <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />}
        </button>
      )}

      {/* Compact floating window */}
      {open && !minimized && (
        <div
          data-prompt-builder-ui="true"
          role="dialog"
          aria-modal="false"
          style={{
            left: winPos.x,
            top: winPos.y,
            width: WINDOW_SIZE.w,
            maxHeight: "calc(100vh - 32px)",
          }}
          className="fixed z-[9999] flex flex-col rounded-xl border border-border bg-background shadow-2xl overflow-hidden"
          {...dragHandlers}
        >
          {/* Title bar */}
          <div data-drag-handle="true" className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border bg-muted/40 cursor-grab active:cursor-grabbing select-none">
            <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            <Sparkles className="h-3 w-3 text-foreground" />
            <h2 className="text-xs font-semibold text-foreground">Prompt Builder</h2>
            <div className="ml-auto flex items-center gap-0.5" data-no-drag>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setMinimized(true)} title="Minimize">
                <Minus className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setOpen(false)} title="Close">
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Input section */}
          <div className="flex flex-col gap-2 p-2.5 border-b border-border">
            {/* Mode + markup row */}
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5 rounded-md bg-muted p-0.5 flex-1">
                {MODES.map((m) => {
                  const Icon = m.icon;
                  const active = mode === m.key;
                  return (
                    <button
                      key={m.key}
                      onClick={() => setMode(m.key)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium transition-colors",
                        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <Button
                size="sm"
                variant={markupOn ? "default" : "outline"}
                className="h-7 px-2 text-[11px]"
                onClick={() => setMarkupOn((v) => !v)}
                title="Toggle on-page markup overlay"
              >
                <Pencil className="h-3 w-3 mr-1" />
                Markup
              </Button>
            </div>

            {/* Live transcription textarea */}
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={text + (interim ? (text && !text.endsWith(" ") ? " " : "") + interim : "")}
                onChange={(e) => { setText(e.target.value); setInterim(""); baseTextRef.current = e.target.value; }}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    generate("build");
                  }
                }}
                placeholder={recording ? "Listening… speak naturally" : "Describe the change. Paste screenshots here (⌘V). ⌘↵ to build."}
                className="min-h-[90px] max-h-[200px] text-xs resize-none pr-7"
              />
              {recording && (
                <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-destructive font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                  REC
                </span>
              )}
            </div>

            {/* Screenshot tray */}
            <div
              className={cn(
                "rounded-md border border-dashed transition-colors",
                screenshots.length > 0 ? "border-border bg-muted/30 p-1.5" : "border-border/60 bg-muted/10 px-2 py-1.5"
              )}
            >
              {screenshots.length === 0 ? (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <ImageIcon className="h-3 w-3" />
                  <span>Paste screenshots (⌘V) — up to {MAX_SCREENSHOTS}. They'll travel with this prompt.</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-1 px-0.5">
                    <span className="text-[10px] font-semibold text-foreground">
                      {screenshots.length}/{MAX_SCREENSHOTS} screenshot{screenshots.length > 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={() => setScreenshots([])}
                      className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                      title="Clear all"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {screenshots.map((url, i) => (
                      <div key={i} className="relative group">
                        <img
                          src={url}
                          alt={`Screenshot ${i + 1}`}
                          className="h-12 w-16 object-cover rounded border border-border"
                        />
                        <button
                          onClick={() => removeScreenshot(i)}
                          className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          title="Remove"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                        <span className="absolute bottom-0.5 left-0.5 text-[9px] font-bold text-white bg-black/60 rounded px-1 leading-tight">
                          {i + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Action row */}
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={recording ? "destructive" : "secondary"}
                className="h-7 px-2 text-[11px]"
                onClick={recording ? stopRecording : startRecording}
              >
                {recording ? <MicOff className="h-3 w-3 mr-1" /> : <Mic className="h-3 w-3 mr-1" />}
                {recording ? "Stop" : "Talk"}
              </Button>

              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => generate("plan")}
                  disabled={!(text + interim).trim()}
                  title="Generate a planning prompt (Lovable will share a plan, not build)"
                >
                  <ListTodo className="h-3 w-3 mr-1" />
                  Plan
                </Button>
                <Button
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => generate("build")}
                  disabled={!(text + interim).trim()}
                  title="Generate a build prompt (⌘↵)"
                >
                  <Hammer className="h-3 w-3 mr-1" />
                  Build →
                </Button>
              </div>
            </div>
          </div>

          {/* Queue */}
          <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-2 min-h-[80px] max-h-[280px]">
            {cards.length === 0 ? (
              <div className="text-center text-[11px] text-muted-foreground py-4">
                Hit Plan or Build to generate a prompt.
              </div>
            ) : (
              cards.map((card) => (
                <PromptCardView
                  key={card.id}
                  card={card}
                  onCopy={() => copyCard(card)}
                  onSend={() => sendToLovable(card)}
                  onDelete={() => deleteCard(card.id)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Markup overlay — independent of window state so it stays on while user PrtScn's */}
      {markupOn && <MarkupOverlay onClose={() => setMarkupOn(false)} />}
    </>
  );
}

function PromptCardView({
  card, onCopy, onSend, onDelete,
}: {
  card: PromptCard;
  onCopy: () => void;
  onSend: () => void;
  onDelete: () => void;
}) {
  const modeLabel = MODES.find((m) => m.key === card.mode)?.label ?? "";
  const kindLabel = card.kind === "plan" ? "Plan" : "Build";
  const KindIcon = card.kind === "plan" ? ListTodo : Hammer;

  return (
    <div className={cn("rounded-md border p-2 space-y-1.5", STATUS_STYLES[card.status])}>
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-foreground bg-background/60 rounded px-1.5 py-0.5">
          <KindIcon className="h-2.5 w-2.5" />
          {kindLabel}
        </span>
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium">
          {modeLabel}
        </span>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 ml-auto text-muted-foreground hover:text-destructive" onClick={onDelete} title="Delete">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="text-[10px] text-muted-foreground line-clamp-1 italic">"{card.inputText}"</div>

      {card.status === "generating" && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground py-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="animate-pulse">Generating {kindLabel.toLowerCase()} prompt…</span>
        </div>
      )}

      {card.status === "error" && <div className="text-[11px] text-destructive">{card.error}</div>}

      {(card.status === "ready" || card.status === "sent") && card.output && (
        <>
          <pre className="whitespace-pre-wrap text-[11px] font-mono leading-snug text-foreground bg-background/60 rounded p-1.5 max-h-44 overflow-y-auto">
            {card.output}
          </pre>
          <div className="flex items-center gap-1">
            <Button size="sm" className="h-6 text-[10px] px-2" onClick={onSend}>
              <Send className="h-2.5 w-2.5 mr-1" /> Send to Lovable
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={onCopy}>
              <Copy className="h-2.5 w-2.5 mr-1" /> Copy
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
