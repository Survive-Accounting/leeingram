import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Trash2, Loader2, Highlighter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { type Highlight, HIGHLIGHT_GENERATION_PROMPT, validateHighlights } from "@/lib/highlightTypes";
import { HighlightLegend } from "./HighlightedText";

interface HighlightControlsProps {
  variantId: string;
  problemText: string;
  solutionText: string;
  highlights: Highlight[];
  showHighlights: boolean;
  onShowHighlightsChange: (show: boolean) => void;
  onHighlightsChange: (highlights: Highlight[]) => void;
  sourceProblemId: string;
}

export function HighlightControls({
  variantId,
  problemText,
  solutionText,
  highlights,
  showHighlights,
  onShowHighlightsChange,
  onHighlightsChange,
  sourceProblemId,
}: HighlightControlsProps) {
  const [generating, setGenerating] = useState(false);

  const handleRegenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ai-output", {
        body: {
          provider: "lovable",
          model: "google/gemini-2.5-flash",
          temperature: 0.1,
          max_output_tokens: 1500,
          source_problem_id: sourceProblemId,
          messages: [
            { role: "system", content: HIGHLIGHT_GENERATION_PROMPT },
            {
              role: "user",
              content: `Problem Text:\n${problemText}\n\nSolution Steps:\n${solutionText || "(not provided)"}`,
            },
          ],
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const raw = data?.parsed;
      const arr = Array.isArray(raw) ? raw : raw?.highlights || [];
      const valid = validateHighlights(arr, problemText);

      if (valid.length === 0) {
        toast.warning("AI returned no valid highlights for this problem text.");
        return;
      }

      // Persist
      await supabase
        .from("problem_variants")
        .update({ highlight_key_json: valid as any } as any)
        .eq("id", variantId);

      onHighlightsChange(valid);
      onShowHighlightsChange(true);
      toast.success(`${valid.length} highlights generated`);
    } catch (err: any) {
      toast.error(err?.message || "Highlight generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleClear = async () => {
    await supabase
      .from("problem_variants")
      .update({ highlight_key_json: null } as any)
      .eq("id", variantId);
    onHighlightsChange([]);
    toast.info("Highlights cleared");
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5">
        <Highlighter className="h-3 w-3 text-yellow-500" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Highlights</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Switch
          checked={showHighlights}
          onCheckedChange={onShowHighlightsChange}
          className="h-4 w-8 [&>span]:h-3 [&>span]:w-3"
        />
        <span className="text-[10px] text-muted-foreground">{showHighlights ? "On" : "Off"}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-[10px] px-2"
        onClick={handleRegenerate}
        disabled={generating}
      >
        {generating ? (
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        ) : (
          <Sparkles className="h-3 w-3 mr-1" />
        )}
        {highlights.length > 0 ? "Regenerate" : "Generate"}
      </Button>
      {highlights.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] px-2 text-muted-foreground hover:text-destructive"
          onClick={handleClear}
        >
          <Trash2 className="h-3 w-3 mr-1" /> Clear
        </Button>
      )}
      {showHighlights && highlights.length > 0 && (
        <HighlightLegend highlights={highlights} />
      )}
    </div>
  );
}
