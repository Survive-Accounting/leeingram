import { useNavigate } from "react-router-dom";
import { CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StageCompletePanelProps {
  stage: "import" | "generate" | "review" | "assets";
  statLine: string;
}

const STAGE_CONFIG = {
  import: {
    headline: "Import Complete!",
    ctaLabel: "Go to Generate",
    ctaRoute: "/workspace",
  },
  generate: {
    headline: "Generation Complete!",
    ctaLabel: "Go to Review",
    ctaRoute: "/review",
  },
  review: {
    headline: "Review Complete!",
    ctaLabel: "Go to Teaching Assets",
    ctaRoute: "/assets-library",
  },
  assets: {
    headline: "Chapter Complete!",
    ctaLabel: "Chapter Complete — View Summary",
    ctaRoute: "/chapter-complete",
  },
};

export function StageCompletePanel({ stage, statLine }: StageCompletePanelProps) {
  const navigate = useNavigate();
  const config = STAGE_CONFIG[stage];

  return (
    <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 flex items-center gap-4 mb-4">
      <CheckCircle className="h-8 w-8 text-green-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-foreground">{config.headline}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{statLine}</p>
      </div>
      {config.ctaRoute && (
        <Button size="sm" onClick={() => navigate(config.ctaRoute)} className="shrink-0">
          {config.ctaLabel} <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      )}
    </div>
  );
}
