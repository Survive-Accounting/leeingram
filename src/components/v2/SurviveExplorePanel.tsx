import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import DOMPurify from "isomorphic-dompurify";
import { Loader2, ChevronDown, ChevronUp, ThumbsUp, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SurviveExplorePanel — V2-only augmentation rendered BELOW InlineExplanation.
 * Adds:
 *   - Challenge me button + interactive follow-up loop
 *   - Explore section (collapsed by default) with 8 prompt buttons + vote badges
 *   - "Suggest your own idea" textarea
 *   - HTML-aware sanitized rendering for AI table responses
 *
 * Backend: calls the `survive-this` edge function (already updated with 13
 * prompt types, skip_cache support, and 2000-token ceiling).
 */

type PromptKey =
  | "challenge"
  | "similar_problem"
  | "memorize"
  | "journal_entries"
  | "financial_statements"
  | "real_world"
  | "professor_tricks"
  | "the_why"
  | "request_video";

const PROMPT_LABELS: Record<PromptKey, string> = {
  challenge: "Challenge me",
  similar_problem: "Try a similar problem",
  memorize: "What to memorize",
  journal_entries: "Journal entries breakdown",
  financial_statements: "Financial statement view",
  real_world: "Real world example",
  professor_tricks: "How your professor will trick you",
  the_why: "The why behind it",
  request_video: "Request a video",
};

const PROMPT_EMOJIS: Record<PromptKey, string> = {
  challenge: "⚡",
  similar_problem: "🔄",
  memorize: "🧠",
  journal_entries: "📝",
  financial_statements: "📊",
  real_world: "🌍",
  professor_tricks: "🎓",
  the_why: "📖",
  request_video: "🎥",
};

// One-line pitch for each idea — shown when the student opens an idea card.
// These describe what the feature WOULD do; they are not active tools.
const PROMPT_DESCRIPTIONS: Record<PromptKey, string> = {
  challenge: "A quick check-yourself prompt. We'd give you a twist on this problem and grade your answer with feedback.",
  similar_problem: "Generate a fresh practice problem with the same skill, so you can repeat the rep without re-reading the original.",
  memorize: "A short, exam-ready list of the formulas, accounts, and patterns worth committing to memory for this topic.",
  journal_entries: "A clean, line-by-line breakdown of every journal entry — what hits which account and why.",
  financial_statements: "Show how this transaction flows into the income statement, balance sheet, and cash flow statement.",
  real_world: "A plain-English example of where you'd actually see this in a company's books or news.",
  professor_tricks: "Common ways professors twist this concept on exams — wording traps, sneaky numbers, and partial-credit pitfalls.",
  the_why: "The reasoning behind the rule — why GAAP handles it this way, in one short paragraph.",
  request_video: "Vote for Lee to record a short walkthrough video for this exact problem.",
};

const EXPLORE_KEYS: PromptKey[] = [
  "challenge",
  "similar_problem",
  "memorize",
  "journal_entries",
  "financial_statements",
  "real_world",
  "professor_tricks",
  "the_why",
];

const AI_HTML_STYLE = `<style>
.sa-ai table { width:100%; border-collapse:collapse; font-size:13px; margin:10px 0 14px; }
.sa-ai th { text-align:left; color:#6B7280; font-weight:600; border-bottom:1px solid #E5E7EB; padding:6px 10px; background:#FAFAFA; }
.sa-ai td { padding:6px 10px; border-bottom:1px solid #F3F4F6; color:#14213D; font-size:13px; }
.sa-ai tr.total td { font-weight:700; border-top:1px solid #D1D5DB; border-bottom:none; background:#F8F9FA; }
.sa-ai ul, .sa-ai ol { margin:8px 0 12px 20px; padding:0; }
.sa-ai li { margin:4px 0; line-height:1.55; }
.sa-ai p { margin:8px 0; line-height:1.65; }
.sa-ai strong { color:#14213D; font-weight:700; }
.sa-ai em { color:#6B7280; }
</style>`;

const HTML_DETECT = /<(table|strong|ul|ol|li|br|h[1-6]|div|span|p|em|thead|tbody|tr|th|td)\b/i;

function sanitizeAndStyle(raw: string): string {
  const cleaned = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ["table", "thead", "tbody", "tr", "th", "td", "strong", "em", "b", "i", "ul", "ol", "li", "p", "br", "div", "span", "h1", "h2", "h3", "h4", "h5", "h6"],
    ALLOWED_ATTR: ["class"],
  });
  return AI_HTML_STYLE + `<div class="sa-ai">${cleaned}</div>`;
}

function ResponseBlock({ text }: { text: string }) {
  const isHtml = HTML_DETECT.test(text);
  if (isHtml) {
    return (
      <div
        className="text-[13px] leading-relaxed"
        dangerouslySetInnerHTML={{ __html: sanitizeAndStyle(text) }}
      />
    );
  }
  return <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{text}</div>;
}

interface Props {
  assetId: string;
  assetCode: string;
  problemText?: string;
  instructions?: string;
  chapterName?: string;
  courseName?: string;
}

type VoteCounts = Partial<Record<PromptKey, number>>;

export default function SurviveExplorePanel({
  assetId,
  assetCode,
  problemText,
  instructions,
  chapterName,
  courseName,
}: Props) {
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get("embed") === "1";

  const [exploreOpen, setExploreOpen] = useState(false);
  // Which idea is currently expanded (showing its description + vote button).
  const [previewKey, setPreviewKey] = useState<PromptKey | null>(null);
  const [activeKey, setActiveKey] = useState<PromptKey | null>(null);
  const [responseText, setResponseText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [votes, setVotes] = useState<VoteCounts>({});
  const [hasVoted, setHasVoted] = useState<Partial<Record<PromptKey, boolean>>>({});

  // Suggest-your-own-idea
  const [ideaOpen, setIdeaOpen] = useState(false);
  const [idea, setIdea] = useState("");
  const [submittingIdea, setSubmittingIdea] = useState(false);

  // Challenge follow-up
  const [challengeAnswer, setChallengeAnswer] = useState("");
  const [challengeFeedback, setChallengeFeedback] = useState<string>("");
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);

  // Embed-mode silent vote logger — fires on any interaction inside the
  // landing-page laptop preview. Logs alongside normal vote counts (loose
  // signal for which prompt students reach for) and triggers the parent's
  // beta paywall modal. The student is never told their click was a vote.
  const logEmbedVoteAndPaywall = (key: PromptKey | null) => {
    if (key) {
      // Best-effort silent vote — same RPC used for "Helpful" thumbs.
      try {
        (supabase as any)
          .rpc("increment_survive_helpful", {
            p_asset_id: assetId,
            p_prompt_type: key,
          })
          .then(() => {})
          .catch(() => {});
      } catch { /* silent */ }
    }
    try {
      window.parent?.postMessage({ type: "sa-embed-paywall" }, "*");
    } catch { /* silent */ }
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
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [assetId]);

  const context = useMemo(
    () => ({
      problem_text: problemText || "",
      instructions: instructions || "",
      chapter_name: chapterName || "",
      course_name: courseName || "",
    }),
    [problemText, instructions, chapterName, courseName]
  );

  const fetchPrompt = async (key: PromptKey) => {
    setActiveKey(key);
    setResponseText("");
    setError(null);
    // Reset challenge follow-up state when picking a new prompt
    if (key === "challenge") {
      setChallengeAnswer("");
      setChallengeFeedback("");
      setChallengeError(null);
    }
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("survive-this", {
        body: {
          asset_id: assetId,
          prompt_type: key,
          context,
        },
      });
      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error || "No response");
      setResponseText(data.response || "");
    } catch (e: any) {
      console.error("[survive-this]", key, e);
      setError("Couldn't load that one — try again in a sec.");
    } finally {
      setLoading(false);
    }
  };

  const submitVote = async (key: PromptKey) => {
    if (hasVoted[key]) return;
    setHasVoted((p) => ({ ...p, [key]: true }));
    setVotes((p) => ({ ...p, [key]: (p[key] || 0) + 1 }));
    try {
      // Optimistic — best-effort RPC; survive_ai_responses has helpful_count column
      await (supabase as any).rpc("increment_survive_helpful", {
        p_asset_id: assetId,
        p_prompt_type: key,
      });
    } catch {
      // If RPC doesn't exist, fall back silently — vote stays in local state
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

  const submitChallengeAnswer = async () => {
    const trimmed = challengeAnswer.trim();
    if (!trimmed) {
      toast.message("Type your answer first.");
      return;
    }
    setChallengeLoading(true);
    setChallengeError(null);
    setChallengeFeedback("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("survive-this", {
        body: {
          asset_id: assetId,
          prompt_type: "challenge_followup",
          skip_cache: true,
          context: {
            ...context,
            student_answer: trimmed,
            original_response: responseText,
          },
        },
      });
      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error || "No response");
      setChallengeFeedback(data.response || "");
    } catch (e: any) {
      console.error("[survive-this] challenge_followup", e);
      setChallengeError("Couldn't grade that right now — try again.");
    } finally {
      setChallengeLoading(false);
    }
  };

  const tryAnotherChallenge = () => {
    setChallengeAnswer("");
    setChallengeFeedback("");
    setChallengeError(null);
    fetchPrompt("challenge");
  };

  return (
    <div
      className="mt-4 rounded-2xl border bg-card p-5 shadow-sm space-y-4"
      data-embed-allow="true"
    >
      {/* "Vote on new ideas" — secondary by default. These are FUTURE feature
          ideas, not active study tools. Clicking an idea reveals a short
          description + a vote button. */}
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
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <p className="text-[12px] text-muted-foreground -mt-1">
            Help us decide what to build next. These aren't live yet — tap one to see what it would do, then vote.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EXPLORE_KEYS.map((k) => {
              const isOpenCard = previewKey === k;
              const count = votes[k] || 0;
              const voted = !!hasVoted[k];
              return (
                <div
                  key={k}
                  className={cn(
                    "sm:col-span-1 rounded-md border bg-background/40 transition-colors",
                    isOpenCard ? "sm:col-span-2 border-[#14213D]/40" : "border-border hover:border-foreground/30"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (isEmbed) { logEmbedVoteAndPaywall(k); return; }
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
                          style={{ background: "#14213D", color: "#fff", minWidth: 20, textAlign: "center" }}
                        >
                          {count}
                        </span>
                      )}
                      {isOpenCard ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                    </span>
                  </button>

                  {isOpenCard && (
                    <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-border/60 animate-in fade-in duration-150">
                      <p className="text-[12.5px] leading-relaxed text-foreground/85">
                        {PROMPT_DESCRIPTIONS[k]}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {count > 0 ? `${count} ${count === 1 ? "student wants this" : "students want this"}` : "Be the first to vote"}
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
                  if (isEmbed) { logEmbedVoteAndPaywall(null); return; }
                  setIdeaOpen(true);
                }}
                className="group h-9 rounded-md border border-dashed border-muted-foreground/40 bg-transparent text-xs font-medium text-muted-foreground hover:border-[#CE1126]/60 hover:text-[#CE1126] hover:bg-[#CE1126]/5 transition-all inline-flex items-center justify-center gap-1.5 px-3"
                title="Suggest your own idea"
              >
                <span aria-hidden className="text-sm leading-none">+</span>
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
                  <Button size="sm" variant="ghost" onClick={() => { setIdeaOpen(false); setIdea(""); }} disabled={submittingIdea}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={submitIdea} disabled={submittingIdea || !idea.trim()}>
                    {submittingIdea ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send idea"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Local Label shim so we don't need an extra import for one usage.
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
