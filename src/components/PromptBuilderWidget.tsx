import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Zap, Mic, MicOff, Image as ImageIcon, X, Copy, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { copyToClipboard } from "@/lib/clipboardFallback";
import { toast } from "sonner";

const ALLOWED = ["lee@survivestudios.com", "jking.cim@gmail.com"];

export function PromptBuilderWidget() {
  const { user } = useAuth();
  const allowed = ALLOWED.includes((user?.email ?? "").trim().toLowerCase());

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState("");
  const [screenshot, setScreenshot] = useState<{ dataUrl: string; base64: string; mime: string } | null>(null);

  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baseTextRef = useRef("");

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop?.(); } catch { /* noop */ }
    };
  }, []);

  if (!allowed) return null;

  const startRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Speech recognition not supported in this browser. Try Chrome or Edge.");
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
      console.error("Speech error", e);
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

  const generate = async () => {
    if (!text.trim()) {
      toast.error("Add a description first.");
      return;
    }
    setGenerating(true);
    setOutput("");
    try {
      const { data, error } = await supabase.functions.invoke("generate-lovable-prompt", {
        body: {
          text,
          screenshotBase64: screenshot?.base64,
          screenshotMime: screenshot?.mime,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setOutput((data as any)?.prompt ?? "");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const copy = async () => {
    const ok = await copyToClipboard(output);
    if (ok) toast.success("Prompt copied");
    else toast.error("Copy failed");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-[60] flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/30 hover:scale-105 transition-transform"
        aria-label="Open Prompt Builder"
      >
        <Zap className="h-4 w-4" />
        Build Prompt
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col gap-4 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Lovable Prompt Builder
            </SheetTitle>
          </SheetHeader>

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={onPaste}
            placeholder="Describe what you want to fix or build... (paste screenshots inline)"
            className="min-h-[160px] text-sm"
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
              disabled={generating || !text.trim()}
            >
              {generating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
              Generate Prompt →
            </Button>
          </div>

          {screenshot && (
            <div className="relative inline-block">
              <img src={screenshot.dataUrl} alt="Screenshot preview" className="max-h-32 rounded border border-border" />
              <button
                onClick={() => setScreenshot(null)}
                className="absolute -top-2 -right-2 rounded-full bg-background border border-border p-0.5"
                aria-label="Remove screenshot"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {(output || generating) && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Generated Prompt
                </span>
                {output && (
                  <Button size="sm" variant="ghost" onClick={copy}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                  </Button>
                )}
              </div>
              {generating ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
                </div>
              ) : (
                <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed text-foreground">
                  {output}
                </pre>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
