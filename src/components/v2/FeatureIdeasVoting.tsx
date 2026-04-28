import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * FeatureIdeasVoting — shared, single source of truth for the feature
 * voting + suggestion experience.
 *
 * Rendered in two places:
 *   1) Inside SurviveExplorePanel ("Vote on new ideas" accordion in the
 *      right helper panel of the modern Solutions Viewer).
 *   2) Inside the Share Feedback chooser modal, when the user picks
 *      "Suggest a new feature".
 *
 * Both surfaces call into this component so vote counts, copy, idea
 * descriptions, and submission logic stay in lockstep — there is no
 * duplicated voting/idea-collection system.
 */

export type PromptKey =
  | "challenge"
  | "similar_problem"
  | "memorize"
  | "journal_entries"
  | "financial_statements"
  | "real_world"
  | "professor_tricks"
  | "the_why";

export const PROMPT_LABELS: Record<PromptKey, string> = {
  challenge: "Challenge me",
  similar_problem: "Try a similar problem",
  memorize: "What to memorize",
  journal_entries: "Journal entries breakdown",
  financial_statements: "Financial statement view",
  real_world: "Real world example",
  professor_tricks: "How your professor will trick you",
  the_why: "The why behind it",
};

export const PROMPT_EMOJIS: Record<PromptKey, string> = {
  challenge: "⚡",
  similar_problem: "🔄",
  memorize: "🧠",
  journal_entries: "📝",
  financial_statements: "📊",
  real_world: "🌍",
  professor_tricks: "🎓",
  the_why: "📖",
};

export const PROMPT_DESCRIPTIONS: Record<PromptKey, string> = {
  challenge:
    "A quick check-yourself prompt. We'd give you a twist on this problem and grade your answer with feedback.",
  similar_problem:
    "Generate a fresh practice problem with the same skill, so you can repeat the rep without re-reading the original.",
  memorize:
    "A short, exam-ready list of the formulas, accounts, and patterns worth committing to memory for this topic.",
  journal_entries:
    "A clean, line-by-line breakdown of every journal entry — what hits which account and why.",
  financial_statements:
    "Show how this transaction flows into the income statement, balance sheet, and cash flow statement.",
  real_world:
    "A plain-English example of where you'd actually see this in a company's books or news.",
  professor_tricks:
    "Common ways professors twist this concept on exams — wording traps, sneaky numbers, and partial-credit pitfalls.",
  the_why:
    "The reasoning behind the rule — why GAAP handles it this way, in one short paragraph.",
};

export const FEATURE_IDEA_KEYS: PromptKey[] = [
  "challenge",
  "similar_problem",
  "memorize",
  "journal_entries",
  "financial_statements",
  "real_world",
  "professor_tricks",
  "the_why",
];

type VoteCounts = Partial<Record<PromptKey, number>>;

interface Props {
  assetId: string;
  assetCode: string;
  /** Show the muted intro paragraph above the grid. Default true. */
  showHeader?: boolean;
}

export default function FeatureIdeasVoting({
  assetId,
  assetCode,
  showHeader = true,
}: Props) {
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get("embed") === "1";

  const [previewKey, setPreviewKey] = useState<PromptKey | null>(null);
  const [votes, setVotes] = useState<VoteCounts>({});
  const [hasVoted, setHasVoted] = useState<Partial<Record<PromptKey, boolean>>>({});

  const [ideaOpen, setIdeaOpen] = useState(false);
  const [idea, setIdea] = useState("");
  const [submittingIdea, setSubmittingIdea] = useState(false);

  // Embed-mode silent vote logger — fires on any interaction inside the
  // landing-page laptop preview. Triggers the parent's beta paywall modal.
  const logEmbedVoteAndPaywall = (key: PromptKey | null) => {
    if (key) {
      try {
        (supabase as any)
          .rpc("increment_survive_helpful", {
            p_asset_id: assetId,
            p_prompt_type: key,
          })
          .then(() => {})
          .catch(() => {});
      } catch {
        /* silent */
      }
    }
    try {
      window.parent?.postMessage({ type: "sa-embed-paywall" }, "*");
    } catch {
      /* silent */
    }
  };

  // Load vote counts from cached survive_ai_responses rows
  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("survive_ai_responses")
          .select("prompt_type, helpful_count")
          .eq("asset_id", assetId);
        if (cancelled || !data) return;
        const counts: VoteCounts = {};
        for (const row of data) {
          const k = row.prompt_type as PromptKey;
          counts[k] = (counts[k] || 0) + (row.helpful_count || 0);
        }
        setVotes(counts);
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  const submitVote = async (key: PromptKey) => {
    if (hasVoted[key]) return;
    setHasVoted((p) => ({ ...p, [key]: true }));
    setVotes((p) => ({ ...p, [key]: (p[key] || 0) + 1 }));
    try {
      await (supabase as any).rpc("increment_survive_helpful", {
        p_asset_id: assetId,
        p_prompt_type: key,
      });
    } catch {
      /* silent fallback */
    }
  };

  const submitIdea = async () => {
    const trimmed = idea.trim();
    if (!trimmed) return;
    setSubmittingIdea(true);
    try {
      await (supabase as any).from("activity_log").insert({
        entity_id: assetId,
        entity_type: "teaching_asset",
        event_type: "survive_idea_suggestion",
        message: trimmed.slice(0, 120),
        payload_json: { asset_code: assetCode, idea: trimmed },
      });
      toast.success("Got it — Lee will see this.");
      setIdea("");
      setIdeaOpen(false);
    } catch (e) {
      console.warn("idea log failed", e);
      toast.success("Thanks!");
      setIdea("");
      setIdeaOpen(false);
    } finally {
      setSubmittingIdea(false);
    }
  };

  return (
    <div className="space-y-3">
      {showHeader && (
        <p className="text-[12px] text-muted-foreground">
          Help us decide what to build next. These aren't live yet — tap one to see what it would do, then vote.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {FEATURE_IDEA_KEYS.map((k) => {
          const isOpenCard = previewKey === k;
          const count = votes[k] || 0;
          const voted = !!hasVoted[k];
          return (
            <div
              key={k}
              className={cn(
                "sm:col-span-1 rounded-md border bg-background/40 transition-colors",
                isOpenCard
                  ? "sm:col-span-2 border-[#14213D]/40"
                  : "border-border hover:border-foreground/30"
              )}
            >
              <button
                type="button"
                onClick={() => {
                  if (isEmbed) {
                    logEmbedVoteAndPaywall(k);
                    return;
                  }
                  setPreviewKey(isOpenCard ? null : k);
                }}
                className="w-full flex items-center justify-between gap-2 h-9 px-3 text-xs font-medium text-left"
                aria-expanded={isOpenCard}
                title={PROMPT_LABELS[k]}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span aria-hidden>{PROMPT_EMOJIS[k]}</span>
                  <span className="truncate text-muted-foreground">{PROMPT_LABELS[k]}</span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {count > 0 && (
                    <span
                      className="rounded-full px-1.5 py-0 text-[10px] font-bold"
                      style={{
                        background: "#14213D",
                        color: "#fff",
                        minWidth: 20,
                        textAlign: "center",
                      }}
                    >
                      {count}
                    </span>
                  )}
                  {isOpenCard ? (
                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </span>
              </button>

              {isOpenCard && (
                <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-border/60 animate-in fade-in duration-150">
                  <p className="text-[12.5px] leading-relaxed text-foreground/85">
                    {PROMPT_DESCRIPTIONS[k]}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {count > 0
                        ? `${count} ${count === 1 ? "student wants this" : "students want this"}`
                        : "Be the first to vote"}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => submitVote(k)}
                      disabled={voted}
                      className="h-7 px-2.5 text-[11px] gap-1"
                      variant={voted ? "outline" : "default"}
                    >
                      <ThumbsUp className="h-3 w-3" />
                      {voted ? "Voted" : "Vote for this"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Suggest your own idea */}
        {!ideaOpen ? (
          <button
            type="button"
            onClick={() => {
              if (isEmbed) {
                logEmbedVoteAndPaywall(null);
                return;
              }
              setIdeaOpen(true);
            }}
            className="group h-9 rounded-md border border-dashed border-muted-foreground/40 bg-transparent text-xs font-medium text-muted-foreground hover:border-[#CE1126]/60 hover:text-[#CE1126] hover:bg-[#CE1126]/5 transition-all inline-flex items-center justify-center gap-1.5 px-3"
            title="Suggest your own idea"
          >
            <span aria-hidden className="text-sm leading-none">
              +
            </span>
            <span>Suggest your own idea</span>
          </button>
        ) : (
          <div className="sm:col-span-2 space-y-2 rounded-md border border-dashed border-[#CE1126]/50 bg-[#CE1126]/5 p-3">
            <Textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value.slice(0, 120))}
              placeholder="What would help you study this? (max 120 chars)"
              rows={2}
              className="text-[13px] resize-none"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIdeaOpen(false);
                  setIdea("");
                }}
                disabled={submittingIdea}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={submitIdea}
                disabled={submittingIdea || !idea.trim()}
              >
                {submittingIdea ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Send idea"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
