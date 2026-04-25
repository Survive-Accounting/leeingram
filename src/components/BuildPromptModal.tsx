import { useEffect, useState } from "react";
import { Loader2, Copy, RefreshCw, Zap, Brain, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export type BuildPromptFeature = {
  title: string;
  description?: string;
  bullet_points?: string[];
  build_steps?: string[];
  testing_steps?: string[];
  status?: string;
};

/**
 * Cards/edit modal store build & testing steps inside bullet_points
 * (appended after a "Build Steps:" / "Testing Steps:" divider, prefixed with "• ").
 * Split them back out so the AI gets clean structured inputs.
 */
export function splitFeatureSections(bullets: string[] = []): {
  bullets: string[];
  build_steps: string[];
  testing_steps: string[];
} {
  const result = { bullets: [] as string[], build_steps: [] as string[], testing_steps: [] as string[] };
  let mode: "bullets" | "build" | "test" = "bullets";
  for (const raw of bullets) {
    const line = (raw ?? "").trim();
    if (!line) continue;
    if (/^build steps:?$/i.test(line)) {
      mode = "build";
      continue;
    }
    if (/^testing steps:?$/i.test(line)) {
      mode = "test";
      continue;
    }
    const cleaned = line.replace(/^[•\-*]\s*/, "");
    if (mode === "bullets") result.bullets.push(cleaned);
    else if (mode === "build") result.build_steps.push(cleaned);
    else result.testing_steps.push(cleaned);
  }
  return result;
}

export function BuildPromptModal({
  open,
  onClose,
  feature,
}: {
  open: boolean;
  onClose: () => void;
  feature: BuildPromptFeature | null;
}) {
  const [mode, setMode] = useState<"build" | "plan">("build");
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");

  const generate = async (m: "build" | "plan") => {
    if (!feature?.title) return;
    setMode(m);
    setLoading(true);
    setPrompt("");
    try {
      const { data, error } = await supabase.functions.invoke("generate-build-prompt", {
        body: { feature, mode: m },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPrompt(data?.prompt ?? "");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate prompt");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && feature?.title) {
      void generate("build");
    } else if (!open) {
      setPrompt("");
      setMode("build");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, feature?.title]);

  const copyPrompt = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt copied");
    } catch {
      toast.error("Couldn't copy — select and copy manually");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "plan" ? (
              <Brain className="h-4 w-4 text-violet-600" />
            ) : (
              <Zap className="h-4 w-4 text-amber-500" />
            )}
            {mode === "plan" ? "Plan Prompt" : "Build Prompt"}
            {feature?.title && (
              <span className="text-sm font-normal text-slate-500 truncate">— {feature.title}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Button
            variant={mode === "build" ? "default" : "outline"}
            size="sm"
            onClick={() => generate("build")}
            disabled={loading}
          >
            <Zap className="h-3.5 w-3.5 mr-1.5" /> Build Prompt
          </Button>
          <Button
            variant={mode === "plan" ? "default" : "outline"}
            size="sm"
            onClick={() => generate("plan")}
            disabled={loading}
          >
            <Brain className="h-3.5 w-3.5 mr-1.5" /> Plan Prompt
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => generate(mode)}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Regenerate
          </Button>
          <Button size="sm" onClick={copyPrompt} disabled={loading || !prompt}>
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Prompt
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="h-full min-h-[400px] flex items-center justify-center text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Generating {mode === "plan" ? "plan" : "build"} prompt…
            </div>
          ) : (
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="font-mono text-xs h-[60vh] min-h-[400px] resize-none"
              placeholder="Prompt will appear here…"
            />
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-1" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
