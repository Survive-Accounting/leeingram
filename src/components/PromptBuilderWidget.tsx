import { useEffect, useRef, useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Zap, Mic, MicOff, Image as ImageIcon, X, Copy, Loader2, Sparkles,
  Wrench, Plus, TrendingUp, Send, Check, Trash2, EyeOff,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { copyToClipboard } from "@/lib/clipboardFallback";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ALLOWED = ["lee@survivestudios.com", "jking.cim@gmail.com"];
const LOVABLE_URL = "https://lovable.dev/projects/51843e0a-bf2a-4413-bab2-a6c4ea7a1395";

type Mode = "ui_fix" | "new_feature" | "conversion";
type Refinement = "concise" | "modular" | "conversion";
type CardStatus = "generating" | "ready" | "sent" | "error";

interface PromptCard {
  id: string;
  status: CardStatus;
  mode: Mode;
  inputText: string;
  output: string;
  error?: string;
  screenshotDataUrl?: string;
  createdAt: number;
  isNew?: boolean;
}

const MODES: { key: Mode; label: string; icon: typeof Wrench }[] = [
  { key: "ui_fix", label: "UI Fix", icon: Wrench },
  { key: "new_feature", label: "New Feature", icon: Plus },
  { key: "conversion", label: "Conversion", icon: TrendingUp },
];

const STATUS_STYLES: Record<CardStatus, string> = {
  generating: "border-primary/40 bg-primary/5",
  ready: "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20",
  sent: "border-border bg-muted/20 opacity-70",
  error: "border-destructive/50 bg-destructive/5",
};

export function PromptBuilderWidget() {
  const { user } = useAuth();
  const allowed = ALLOWED.includes((user?.email ?? "").trim().toLowerCase());

  const [open, setOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>("new_feature");
  const [recording, setRecording] = useState(false);
  const [screenshot, setScreenshot] = useState<{ dataUrl: string; base64: string; mime: string } | null>(null);
  const [cards, setCards] = useState<PromptCard[]>([]);
  const [refiningId, setRefiningId] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baseTextRef = useRef("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Draggable launcher button — persisted position
  const POS_KEY = "promptBuilder.launcherPos.v1";
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 16, y: 80 };
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Clamp any stale offscreen position
        const x = Math.min(Math.max(8, parsed.x ?? 16), window.innerWidth - 60);
        const y = Math.min(Math.max(8, parsed.y ?? 80), window.innerHeight - 60);
        return { x, y };
      }
    } catch { /* noop */ }
    return { x: 16, y: Math.max(80, window.innerHeight - 140) };
  });
  const dragRef = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  useEffect(() => {
    try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* noop */ }
  }, [pos]);

  // Keep button in viewport on resize
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

  const onLauncherPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, moved: false };
    target.setPointerCapture(e.pointerId);
  };
  const onLauncherPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const nx = e.clientX - d.dx;
    const ny = e.clientY - d.dy;
    if (Math.abs(nx - pos.x) > 3 || Math.abs(ny - pos.y) > 3) d.moved = true;
    const w = e.currentTarget.offsetWidth;
    const h = e.currentTarget.offsetHeight;
    setPos({
      x: Math.min(Math.max(8, nx), window.innerWidth - w - 8),
      y: Math.min(Math.max(8, ny), window.innerHeight - h - 8),
    });
  };
  const onLauncherPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (!d?.moved) setOpen(true);
  };

  // Hotkey: Cmd/Ctrl+K to open widget (global)
  useEffect(() => {
    if (!allowed) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [allowed]);

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop?.(); } catch { /* noop */ }
    };
  }, []);

  // Strip "isNew" highlight after animation settles
  useEffect(() => {
    const newOnes = cards.filter((c) => c.isNew);
    if (newOnes.length === 0) return;
    const t = setTimeout(() => {
      setCards((prev) => prev.map((c) => (c.isNew ? { ...c, isNew: false } : c)));
    }, 600);
    return () => clearTimeout(t);
  }, [cards]);

  const startRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Speech recognition not supported. Try Chrome or Edge.");
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    baseTextRef.current = text ? text + (text.endsWith(" ") || text.endsWith("\n") ? "" : " ") : "";

    rec.onresult = (event: any) => {
      let interim = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalChunk += transcript;
        else interim += transcript;
      }
      if (finalChunk) {
        baseTextRef.current += finalChunk;
        setText(baseTextRef.current);
      } else {
        setText(baseTextRef.current + interim);
      }
    };
    rec.onerror = (e: any) => {
      toast.error(`Mic error: ${e.error || "unknown"}`);
      setRecording(false);
    };
    rec.onend = () => setRecording(false);

    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  };

  const stopRecording = () => {
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    setRecording(false);
  };

  const handleScreenshot = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image too large (max 8MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1] ?? "";
      setScreenshot({ dataUrl, base64, mime: file.type });
    };
    reader.readAsDataURL(file);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (item) {
      const file = item.getAsFile();
      if (file) handleScreenshot(file);
    }
  };

  const updateCard = (id: string, patch: Partial<PromptCard>) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const callAI = async (payload: {
    text: string;
    mode: Mode;
    screenshotBase64?: string;
    screenshotMime?: string;
    refinement?: Refinement;
    priorPrompt?: string;
  }) => {
    const { data, error } = await supabase.functions.invoke("generate-lovable-prompt", { body: payload });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return (data as any)?.prompt ?? "";
  };

  // Non-blocking: enqueue card, fire request, return immediately
  const generate = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("Add a description first.");
      return;
    }
    const id = crypto.randomUUID();
    const snapshot = {
      text: trimmed,
      mode,
      screenshotBase64: screenshot?.base64,
      screenshotMime: screenshot?.mime,
      screenshotDataUrl: screenshot?.dataUrl,
    };
    const card: PromptCard = {
      id,
      status: "generating",
      mode: snapshot.mode,
      inputText: snapshot.text,
      output: "",
      screenshotDataUrl: snapshot.screenshotDataUrl,
      createdAt: Date.now(),
      isNew: true,
    };
    setCards((prev) => [card, ...prev]);

    // Reset input immediately so user can keep typing
    setText("");
    setScreenshot(null);
    baseTextRef.current = "";

    callAI({
      text: snapshot.text,
      mode: snapshot.mode,
      screenshotBase64: snapshot.screenshotBase64,
      screenshotMime: snapshot.screenshotMime,
    })
      .then((prompt) => updateCard(id, { status: "ready", output: prompt, isNew: true }))
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Generation failed";
        updateCard(id, { status: "error", error: msg });
        toast.error(msg);
      });
  }, [text, mode, screenshot]);

  const refine = async (card: PromptCard, refinement: Refinement) => {
    if (!card.output) return;
    setRefiningId(card.id);
    updateCard(card.id, { status: "generating" });
    try {
      const prompt = await callAI({
        text: card.inputText,
        mode: card.mode,
        refinement,
        priorPrompt: card.output,
      });
      updateCard(card.id, { status: "ready", output: prompt, isNew: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Refinement failed";
      updateCard(card.id, { status: "error", error: msg });
      toast.error(msg);
    } finally {
      setRefiningId(null);
    }
  };

  const copyCard = async (card: PromptCard) => {
    const ok = await copyToClipboard(card.output);
    if (ok) toast.success("Prompt copied");
    else toast.error("Copy failed");
  };

  const sendToLovable = async (card: PromptCard) => {
    const ok = await copyToClipboard(card.output);
    if (ok) toast.success("Copied — paste into Lovable");
    window.open(LOVABLE_URL, "_blank", "noopener,noreferrer");
    updateCard(card.id, { status: "sent" });
  };

  const markSent = (card: PromptCard) => updateCard(card.id, { status: "sent" });
  const deleteCard = (id: string) => setCards((prev) => prev.filter((c) => c.id !== id));

  // Cmd/Ctrl+Enter inside textarea → Generate
  const onTextareaKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      generate();
    }
  };

  if (!allowed) return null;

  return (
    <>
      <div
        style={{ left: pos.x, top: pos.y }}
        className="fixed z-[9999] flex items-center gap-1.5"
      >
        <button
          onPointerDown={onLauncherPointerDown}
          onPointerMove={onLauncherPointerMove}
          onPointerUp={onLauncherPointerUp}
          style={{ touchAction: "none" }}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/30 hover:scale-105 transition-transform cursor-grab active:cursor-grabbing select-none ring-2 ring-primary-foreground/20"
          aria-label="Open Prompt Builder (Cmd+K) — drag to move"
          title="Click to open · Drag to move · ⌘K"
        >
          <Zap className="h-4 w-4" />
          Build Prompt
        </button>
        <button
          onClick={() => setAboutOpen(true)}
          className="rounded-full bg-background/90 backdrop-blur px-2.5 py-1 text-[10px] font-medium tracking-wide text-muted-foreground hover:text-foreground border border-border shadow-sm transition-colors"
          aria-label="About HumanSent"
          title="About HumanSent"
        >
          HumanSent
        </button>
      </div>

      <HumanSentModal open={aboutOpen} onOpenChange={setAboutOpen} />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col gap-3 overflow-hidden p-0 relative">
          {/* Subtle brand signature — opens the about modal */}
          <button
            onClick={() => setAboutOpen(true)}
            className="absolute bottom-3 right-3 z-50 rounded-full bg-background/80 backdrop-blur px-2.5 py-1 text-[10px] font-medium tracking-wide text-muted-foreground/80 border border-border/60 shadow-sm hover:text-foreground hover:bg-background transition-colors animate-fade-in select-none"
            aria-label="About HumanSent"
            title="HumanSent.com"
          >
            Built with <span className="text-foreground/90">HumanSent.com</span>
          </button>
          <div className="flex flex-col gap-3 p-6 pb-3 border-b border-border">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Lovable Prompt Builder
                <span className="ml-auto text-[10px] font-normal text-muted-foreground tracking-wide uppercase">
                  ⌘K · ⌘↵ Generate
                </span>
              </SheetTitle>
            </SheetHeader>

            {/* Mode selector */}
            <div className="flex gap-1.5 rounded-lg bg-muted p-1">
              {MODES.map((m) => {
                const Icon = m.icon;
                const active = mode === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                      active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {m.label}
                  </button>
                );
              })}
            </div>

            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={onPaste}
              onKeyDown={onTextareaKey}
              placeholder="Describe what you want to fix or build... (⌘+Enter to generate)"
              className="min-h-[120px] text-sm"
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={recording ? "destructive" : "secondary"}
                onClick={recording ? stopRecording : startRecording}
              >
                {recording ? <MicOff className="h-4 w-4 mr-1.5" /> : <Mic className="h-4 w-4 mr-1.5" />}
                {recording ? "Stop" : "Record"}
              </Button>

              <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                <ImageIcon className="h-4 w-4 mr-1.5" />
                Screenshot
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleScreenshot(f);
                  e.target.value = "";
                }}
              />

              <Button
                size="sm"
                className="ml-auto"
                onClick={generate}
                disabled={!text.trim()}
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                Generate →
              </Button>
            </div>

            {screenshot && (
              <div className="relative inline-block">
                <img src={screenshot.dataUrl} alt="Screenshot preview" className="max-h-24 rounded border border-border" />
                <button
                  onClick={() => setScreenshot(null)}
                  className="absolute -top-2 -right-2 rounded-full bg-background border border-border p-0.5"
                  aria-label="Remove screenshot"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Queue */}
          <div className="flex-1 overflow-y-auto px-6 py-3 space-y-3">
            {cards.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-8">
                Your prompt queue will appear here. Keep typing — generation runs in the background.
              </div>
            ) : (
              cards.map((card) => (
                <PromptCardView
                  key={card.id}
                  card={card}
                  refining={refiningId === card.id}
                  onCopy={() => copyCard(card)}
                  onSend={() => sendToLovable(card)}
                  onMarkSent={() => markSent(card)}
                  onDelete={() => deleteCard(card.id)}
                  onRefine={(r) => refine(card, r)}
                />
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function PromptCardView({
  card, refining, onCopy, onSend, onMarkSent, onDelete, onRefine,
}: {
  card: PromptCard;
  refining: boolean;
  onCopy: () => void;
  onSend: () => void;
  onMarkSent: () => void;
  onDelete: () => void;
  onRefine: (r: Refinement) => void;
}) {
  const modeLabel = MODES.find((m) => m.key === card.mode)?.label ?? "";
  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2 transition-all",
        STATUS_STYLES[card.status],
        card.isNew && "animate-fade-in",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
          {modeLabel}
        </span>
        <StatusBadge status={card.status} />
        <div className="ml-auto flex items-center gap-0.5">
          {card.status === "ready" && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onMarkSent} title="Mark as sent">
              <Check className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={onDelete} title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Original input */}
      <div className="text-xs text-muted-foreground line-clamp-2 italic">
        "{card.inputText}"
      </div>

      {card.screenshotDataUrl && (
        <img src={card.screenshotDataUrl} alt="Context" className="max-h-20 rounded border border-border" />
      )}

      {/* Output / status body */}
      {card.status === "generating" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="animate-pulse">Generating...</span>
        </div>
      )}

      {card.status === "error" && (
        <div className="text-xs text-destructive">{card.error}</div>
      )}

      {(card.status === "ready" || card.status === "sent") && card.output && (
        <pre className="whitespace-pre-wrap text-xs font-mono leading-relaxed text-foreground bg-background/60 rounded p-2 max-h-64 overflow-y-auto">
          {card.output}
        </pre>
      )}

      {(card.status === "ready" || card.status === "sent") && card.output && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="default" className="h-7 text-xs" onClick={onSend}>
            <Send className="h-3 w-3 mr-1" /> Send to Lovable →
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCopy}>
            <Copy className="h-3 w-3 mr-1" /> Copy
          </Button>
          <div className="flex items-center gap-1 ml-auto">
            {([
              { key: "concise" as const, label: "Concise" },
              { key: "modular" as const, label: "Modular" },
              { key: "conversion" as const, label: "↑ Convert" },
            ]).map((r) => (
              <Button
                key={r.key}
                size="sm"
                variant="ghost"
                className="h-7 text-[11px] px-2"
                disabled={refining}
                onClick={() => onRefine(r.key)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: CardStatus }) {
  const map: Record<CardStatus, { label: string; cls: string }> = {
    generating: { label: "Generating", cls: "bg-primary/15 text-primary" },
    ready: { label: "Ready", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    sent: { label: "Sent", cls: "bg-muted text-muted-foreground" },
    error: { label: "Error", cls: "bg-destructive/15 text-destructive" },
  };
  const { label, cls } = map[status];
  return (
    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide", cls)}>
      {label}
    </span>
  );
}
