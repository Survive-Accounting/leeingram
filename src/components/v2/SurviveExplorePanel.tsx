import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import FeatureIdeasVoting from "./FeatureIdeasVoting";

/**
 * SurviveExplorePanel — V2-only augmentation rendered BELOW InlineExplanation.
 *
 * This now wraps the shared `FeatureIdeasVoting` component inside a
 * collapsible "Vote on new ideas" card. The same `FeatureIdeasVoting`
 * component is also rendered inside the Share Feedback chooser modal,
 * so vote counts, idea descriptions, and submission logic stay in
 * lockstep across both surfaces.
 */

interface Props {
  assetId: string;
  assetCode: string;
  problemText?: string;
  instructions?: string;
  chapterName?: string;
  courseName?: string;
}

export default function SurviveExplorePanel({ assetId, assetCode }: Props) {
  const [exploreOpen, setExploreOpen] = useState(false);

  // Allow external triggers (e.g. "Suggest a new feature" card in the
  // Share Feedback chooser, when used as a "scroll-to" instead of modal)
  // to expand this section and scroll it into view.
  useEffect(() => {
    const handler = () => {
      setExploreOpen(true);
      setTimeout(() => {
        const el = document.getElementById("vote-on-new-ideas");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    };
    window.addEventListener("sa:open-vote-ideas", handler);
    return () => window.removeEventListener("sa:open-vote-ideas", handler);
  }, []);

  return (
    <div
      id="vote-on-new-ideas"
      className="mt-4 rounded-2xl border bg-card p-5 shadow-sm space-y-4 scroll-mt-24"
      data-embed-allow="true"
    >
      <button
        type="button"
        onClick={() => setExploreOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:bg-muted/50 transition-colors"
        aria-expanded={exploreOpen}
      >
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Vote on new ideas
        </span>
        {exploreOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {exploreOpen && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-150">
          <FeatureIdeasVoting assetId={assetId} assetCode={assetCode} />
        </div>
      )}
    </div>
  );
}
