import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, ArrowRight, ChevronLeft, MessageCircleQuestion, Sparkles, Loader2, AlertTriangle, LayoutList, Wand2, Printer } from "lucide-react";
import { generateSimplifiedPracticePdf } from "@/lib/generateSimplifiedPracticePdf";
import ReactMarkdown from "react-markdown";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Asset = {
  id: string;
  asset_name: string;
  problem_title: string | null;
  source_ref: string | null;
  survive_problem_text: string;
  instruction_1: string | null;
  instruction_2: string | null;
  instruction_3: string | null;
  instruction_4: string | null;
  instruction_5: string | null;
  instruction_list: string | null;
  chapter_id: string;
};

type ChapterMeta = { id: string; chapter_number: number; chapter_name: string };

// Natural sort for source_ref (e.g. BE13.2, BE13.10, EX13.1, P13.3a)
function naturalKey(s: string | null | undefined): (string | number)[] {
  if (!s) return [""];
  return s
    .toLowerCase()
    .split(/(\d+)/)
    .filter(Boolean)
    .map((p) => (/^\d+$/.test(p) ? Number(p) : p));
}
function naturalCompare(a: string | null, b: string | null): number {
  const ka = naturalKey(a);
  const kb = naturalKey(b);
  const len = Math.max(ka.length, kb.length);
  for (let i = 0; i < len; i++) {
    const x = ka[i] ?? "";
    const y = kb[i] ?? "";
    if (typeof x === "number" && typeof y === "number") {
      if (x !== y) return x - y;
    } else {
      const sx = String(x);
      const sy = String(y);
      if (sx !== sy) return sx < sy ? -1 : 1;
    }
  }
  return 0;
}

function getInstructions(a: Asset): string[] {
  const list = [a.instruction_1, a.instruction_2, a.instruction_3, a.instruction_4, a.instruction_5].filter(
    (x): x is string => !!x && x.trim().length > 0,
  );
  if (list.length) return list;
  if (a.instruction_list?.trim()) {
    return a.instruction_list
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

// ── Report Issue modal ────────────────────────────────────────────────
type IssueType = "hard_to_read" | "formatting" | "incorrect_data" | "other";

const ISSUE_OPTIONS: { value: IssueType; label: string }[] = [
  { value: "hard_to_read", label: "Problem text is hard to read" },
  { value: "formatting", label: "Formatting is broken" },
  { value: "incorrect_data", label: "Data looks incorrect" },
  { value: "other", label: "Something else" },
];

const MAX_ISSUE_TYPES = 2;

function ReportIssueModal({
  open,
  onOpenChange,
  asset,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset: Asset | null;
}) {
  const [selected, setSelected] = useState<IssueType[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelected([]);
      setNote("");
    }
  }, [open]);

  const toggle = (value: IssueType) => {
    setSelected((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      if (prev.length >= MAX_ISSUE_TYPES) {
        toast.message(`Select up to ${MAX_ISSUE_TYPES}`);
        return prev;
      }
      return [...prev, value];
    });
  };

  const submit = async () => {
    if (!asset || selected.length === 0) return;
    setSubmitting(true);
    try {
      let email: string | null = null;
      try {
        email = localStorage.getItem("v2_student_email");
      } catch {}
      const { error } = await supabase.from("problem_issue_reports").insert({
        asset_id: asset.id,
        asset_name: asset.asset_name,
        user_email: email,
        issue_types: selected,
        note: note.trim() || null,
      });
      if (error) throw error;
      toast.success("Thanks — issue logged.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Could not submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>What's wrong?</DialogTitle>
          <DialogDescription>Select up to {MAX_ISSUE_TYPES}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {ISSUE_OPTIONS.map((opt) => {
              const isSel = selected.includes(opt.value);
              const atMax = !isSel && selected.length >= MAX_ISSUE_TYPES;
              return (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={isSel ? "default" : "outline"}
                  className="text-xs h-8"
                  disabled={atMax}
                  onClick={() => toggle(opt.value)}
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional)"
            rows={3}
            className="text-sm"
          />
          <Button
            onClick={submit}
            disabled={selected.length === 0 || submitting}
            className="w-full"
          >
            {submitting ? "Sending…" : "Submit issue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


// ── Need Help modal ────────────────────────────────────────────────────
function NeedHelpModal({
  open,
  onOpenChange,
  asset,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset: Asset | null;
}) {
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("v2_student_email");
      if (stored) setEmail(stored);
    } catch {}
  }, [open]);

  const submit = async () => {
    if (!email.trim() || !question.trim() || !asset) {
      toast.error("Please add your email and a question.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("chapter_questions").insert({
        chapter_id: asset.chapter_id,
        student_email: email.trim().toLowerCase(),
        question: question.trim(),
        issue_type: "question",
        asset_name: asset.asset_name,
        source_ref: asset.source_ref,
      });
      if (error) throw error;
      try {
        localStorage.setItem("v2_student_email", email.trim().toLowerCase());
      } catch {}
      toast.success("Sent. Lee will reply by email.");
      setQuestion("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Could not send");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Need help with this problem?</DialogTitle>
          <DialogDescription>Send Lee a question. He'll reply by email.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="v2-email">Your email</Label>
            <Input
              id="v2-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="v2-q">Your question</Label>
            <Textarea
              id="v2-q"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What's confusing you?"
              rows={4}
              className="mt-1"
            />
          </div>
          <Button onClick={submit} disabled={submitting} className="w-full">
            {submitting ? "Sending…" : "Send question"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Explanation panel (Sheet from right, full-screen on mobile) ────────
type ExplanationSections = {
  lees_approach: string;
  how_to_solve: string;
  why_it_works: string;
  lock_it_in: string;
};

type SectionKey = "how_to_solve" | "why_it_works" | "lock_it_in";

const SECTION_META: Record<SectionKey, { label: string; emoji: string }> = {
  how_to_solve: { label: "How to solve", emoji: "📌" },
  why_it_works: { label: "Why it works", emoji: "⚖️" },
  lock_it_in: { label: "Lock it in", emoji: "🔒" },
};

type FeedbackReason = "unclear_steps" | "concept" | "too_long" | "still_confused";

const REASON_OPTIONS: { value: FeedbackReason; label: string }[] = [
  { value: "unclear_steps", label: "Steps were unclear" },
  { value: "concept", label: "Didn't understand the concept" },
  { value: "too_long", label: "Too long / confusing" },
  { value: "still_confused", label: "Still confused overall" },
];

const MAX_REASONS = 2;

function ExplanationFeedback({ asset }: { asset: Asset }) {
  const [stage, setStage] = useState<"ask" | "negative" | "done">("ask");
  const [reasons, setReasons] = useState<FeedbackReason[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const noteRef = React.useRef<HTMLTextAreaElement>(null);

  const getEmail = () => {
    try {
      return localStorage.getItem("v2_student_email") || null;
    } catch {
      return null;
    }
  };

  const toggleReason = (value: FeedbackReason) => {
    setReasons((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      if (prev.length >= MAX_REASONS) {
        toast.message(`Select up to ${MAX_REASONS}`);
        return prev;
      }
      const next = [...prev, value];
      if (value === "still_confused") {
        setTimeout(() => noteRef.current?.focus(), 50);
      }
      return next;
    });
  };

  const submit = async (helpful: boolean, rs: FeedbackReason[] = [], n: string = "") => {
    setSubmitting(true);
    try {
      await supabase.from("explanation_feedback").insert({
        asset_id: asset.id,
        asset_name: asset.asset_name,
        user_email: getEmail(),
        helpful,
        reason: rs.length ? rs : null,
        note: n.trim() || null,
      });
      setStage("done");
    } catch (e: any) {
      toast.error("Could not send feedback");
    } finally {
      setSubmitting(false);
    }
  };

  if (stage === "done") {
    return (
      <div className="text-center text-sm text-muted-foreground py-2">
        Got it 👍 Thanks for the feedback.
      </div>
    );
  }

  if (stage === "negative") {
    return (
      <div className="space-y-3">
        <div>
          <div className="text-sm font-medium">What didn't click?</div>
          <div className="text-xs text-muted-foreground mt-0.5">Select up to {MAX_REASONS}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {REASON_OPTIONS.map((opt) => {
            const selected = reasons.includes(opt.value);
            const atMax = !selected && reasons.length >= MAX_REASONS;
            return (
              <Button
                key={opt.value}
                size="sm"
                variant={selected ? "default" : "outline"}
                className="text-xs h-8"
                disabled={atMax}
                onClick={() => toggleReason(opt.value)}
              >
                {opt.label}
              </Button>
            );
          })}
        </div>
        <Textarea
          ref={noteRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)"
          rows={2}
          className="text-sm"
        />
        <Button
          size="sm"
          className="w-full"
          disabled={reasons.length === 0 || submitting}
          onClick={() => submit(false, reasons, note)}
        >
          {submitting ? "Sending…" : "Send feedback"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium">Did this help?</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={submitting} onClick={() => submit(true)}>
          👍 Yes
        </Button>
        <Button size="sm" variant="outline" disabled={submitting} onClick={() => setStage("negative")}>
          👎 Not really
        </Button>
      </div>
    </div>
  );
}

function InlineExplanation({ asset }: { asset: Asset }) {
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<ExplanationSections | null>(null);
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(new Set());

  // Reset on asset change
  useEffect(() => {
    setStarted(false);
    setSections(null);
    setError(null);
    setOpenSections(new Set());
  }, [asset.asset_name]);

  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.functions.invoke("explain-this-solution", {
          body: { asset_code: asset.asset_name },
        });
        if (cancelled) return;
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Failed to load explanation");
        setSections(data.sections);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [started, asset.asset_name]);

  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!started) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground mb-4">
          Try it first. When you're ready, get a quick walkthrough.
        </p>
        <Button size="lg" onClick={() => setStarted(true)} className="gap-2">
          <Sparkles className="h-4 w-4" />
          Explain this
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-primary" />
        Explanation
      </div>

      {loading && !sections && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Lee is thinking…
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {sections && (
        <>
          <section className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <span aria-hidden>🧭</span> Lee's approach
            </h3>
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 text-[14px] leading-relaxed">
              <ReactMarkdown>{sections.lees_approach}</ReactMarkdown>
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(SECTION_META) as SectionKey[]).map((k) => {
              const isOpen = openSections.has(k);
              return (
                <Button
                  key={k}
                  size="sm"
                  variant={isOpen ? "default" : "outline"}
                  className="text-xs h-8"
                  onClick={() => toggleSection(k)}
                >
                  <span className="mr-1.5" aria-hidden>{SECTION_META[k].emoji}</span>
                  {SECTION_META[k].label}
                </Button>
              );
            })}
          </div>

          <div className="space-y-3">
            {(Object.keys(SECTION_META) as SectionKey[]).map((k) => {
              if (!openSections.has(k)) return null;
              return (
                <section
                  key={k}
                  className="rounded-lg border border-border bg-muted/30 p-4 animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <span aria-hidden>{SECTION_META[k].emoji}</span> {SECTION_META[k].label}
                  </h3>
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 text-[14px] leading-relaxed">
                    <ReactMarkdown>{sections[k]}</ReactMarkdown>
                  </div>
                </section>
              );
            })}
          </div>

          <div className="pt-4 border-t border-border">
            <ExplanationFeedback asset={asset} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Jump modal ────────────────────────────────────────────────────────
function getRefPrefix(ref: string | null): "BE" | "EX" | "PR" | "OTHER" {
  if (!ref) return "OTHER";
  const u = ref.toUpperCase();
  if (u.startsWith("BE") || u.startsWith("QS")) return "BE";
  if (u.startsWith("EX") || u.startsWith("E")) return "EX";
  if (u.startsWith("P")) return "PR";
  return "OTHER";
}

function JumpModal({
  open,
  onOpenChange,
  siblings,
  currentAssetName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  siblings: { asset_name: string; source_ref: string | null }[];
  currentAssetName: string | undefined;
}) {
  const navigate = useNavigate();
  const groups = useMemo(() => {
    const g: Record<"BE" | "EX" | "PR" | "OTHER", typeof siblings> = {
      BE: [], EX: [], PR: [], OTHER: [],
    };
    siblings.forEach((s) => g[getRefPrefix(s.source_ref)].push(s));
    return g;
  }, [siblings]);

  const groupLabels: Record<"BE" | "EX" | "PR" | "OTHER", string> = {
    BE: "Brief Exercises / Quick Studies",
    EX: "Exercises",
    PR: "Problems",
    OTHER: "Other",
  };

  const go = (assetName: string) => {
    navigate(`/v2/solutions/${assetName}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Jump to problem</DialogTitle>
          <DialogDescription>{siblings.length} problems in this chapter</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {(["BE", "EX", "PR", "OTHER"] as const).map((key) => {
            const items = groups[key];
            if (items.length === 0) return null;
            return (
              <div key={key}>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {groupLabels[key]} ({items.length})
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {items.map((s) => {
                    const isCurrent = s.asset_name === currentAssetName;
                    return (
                      <Button
                        key={s.asset_name}
                        size="sm"
                        variant={isCurrent ? "default" : "outline"}
                        className="font-mono text-xs h-8"
                        onClick={() => go(s.asset_name)}
                      >
                        {s.source_ref || s.asset_name}
                      </Button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Key term highlighter ──────────────────────────────────────────────
const KEY_TERMS = [
  "Total Assets", "Total Liabilities", "Total Equity", "Stockholders' Equity",
  "Net Income", "Net Loss", "Gross Profit", "Operating Income",
  "Retained Earnings", "Cash Flow", "Cost of Goods Sold", "COGS",
  "Revenue", "Expenses", "Dividends", "Earnings per Share", "EPS",
  "Depreciation", "Amortization", "Accounts Receivable", "Accounts Payable",
  "Journal Entry", "Journal Entries", "Adjusting Entry", "Trial Balance",
  "Balance Sheet", "Income Statement",
];

function highlightTerms(text: string): React.ReactNode {
  if (!text) return text;
  const pattern = new RegExp(
    `\\b(${KEY_TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
    "gi",
  );
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    if (KEY_TERMS.some((t) => t.toLowerCase() === part.toLowerCase())) {
      return (
        <span key={i} className="font-semibold text-primary">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}


// ── Simplified problem (AI-generated cleaner version) ─────────────────
type SimplifyView = "original" | "simplified";

function SimplifiedProblem({
  asset,
  chapter,
  view,
  onViewChange,
  simplifiedText,
  setSimplifiedText,
}: {
  asset: Asset;
  chapter: ChapterMeta | null;
  view: SimplifyView;
  onViewChange: (v: SimplifyView) => void;
  simplifiedText: string | null;
  setSimplifiedText: (t: string | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedCache, setCheckedCache] = useState(false);

  // Build the practice PDF from a simplified-markdown string
  const buildAndDownloadPdf = (md: string) => {
    const chapterLabel = chapter
      ? `Ch ${chapter.chapter_number}: ${chapter.chapter_name}`
      : null;
    const doc = generateSimplifiedPracticePdf({
      sourceRef: asset.source_ref,
      problemTitle: asset.problem_title,
      chapterLabel,
      courseName: null,
      simplifiedMarkdown: md,
    });
    const safeRef = (asset.source_ref || asset.asset_name).replace(/[^A-Za-z0-9._-]/g, "_");
    doc.save(`${safeRef}-practice.pdf`);
  };

  // Print handler: ensure simplified text exists, then download PDF
  const handlePrint = async () => {
    setError(null);
    if (simplifiedText) {
      buildAndDownloadPdf(simplifiedText);
      return;
    }
    setPrinting(true);
    try {
      const { data, error } = await supabase.functions.invoke("simplify-problem", {
        body: { asset_id: asset.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to prepare PDF");
      setSimplifiedText(data.simplified_text);
      buildAndDownloadPdf(data.simplified_text);
    } catch (e: any) {
      setError(e?.message || "Could not generate PDF");
    } finally {
      setPrinting(false);
    }
  };

  // Check cache on asset load
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setCheckedCache(false);
    (async () => {
      try {
        const { data } = await supabase
          .from("simplified_problem_cache")
          .select("simplified_text")
          .eq("asset_id", asset.id)
          .maybeSingle();
        if (cancelled) return;
        if (data?.simplified_text) {
          setSimplifiedText(data.simplified_text);
        } else {
          setSimplifiedText(null);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setCheckedCache(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.id]);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("simplify-problem", {
        body: { asset_id: asset.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to simplify");
      setSimplifiedText(data.simplified_text);
      onViewChange("simplified");
    } catch (e: any) {
      setError(e?.message || "Could not simplify");
    } finally {
      setLoading(false);
    }
  };

  // No simplified version yet → show CTA + Print
  if (!simplifiedText) {
    return (
      <div className="mt-4 space-y-2">
        {error && <div className="text-xs text-destructive">{error}</div>}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-3 flex-wrap">
          <div className="text-xs text-muted-foreground min-w-0">
            Dense textbook wording? Get a cleaner, scannable version — or print it for offline practice.
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={generate}
              disabled={loading || printing || !checkedCache}
              className="gap-1.5 h-8"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Simplifying…
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" />
                  Simplify this problem
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              disabled={loading || printing || !checkedCache}
              className="gap-1.5 h-8"
              title="Download a clean, printable version for offline practice"
            >
              {printing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Preparing…
                </>
              ) : (
                <>
                  <Printer className="h-3.5 w-3.5" />
                  Print this problem
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Has simplified version → toggle UI + Print
  return (
    <div className="mt-4 space-y-2">
      {error && (
        <div className="text-xs text-destructive">{error}</div>
      )}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <span aria-hidden>✨</span>
          {view === "simplified"
            ? "Simplified version (for clarity only)"
            : "Original textbook version"}
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/40">
            <button
              type="button"
              onClick={() => onViewChange("original")}
              className={cn(
                "px-2.5 py-1 text-xs rounded transition-colors",
                view === "original"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Original
            </button>
            <button
              type="button"
              onClick={() => onViewChange("simplified")}
              className={cn(
                "px-2.5 py-1 text-xs rounded transition-colors",
                view === "simplified"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Simplified
            </button>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrint}
            disabled={printing}
            className="gap-1.5 h-7 px-2.5 text-xs"
            title="Download a clean, printable version for offline practice"
          >
            {printing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Printer className="h-3.5 w-3.5" />
            )}
            Print
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────
export default function SolutionsViewerV2() {
  const { assetCode } = useParams<{ assetCode: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get("mode") === "preview";

  const [asset, setAsset] = useState<Asset | null>(null);
  const [chapter, setChapter] = useState<ChapterMeta | null>(null);
  const [siblings, setSiblings] = useState<{ asset_name: string; source_ref: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [helpOpen, setHelpOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);

  // Simplify-this-problem state (keeps simplified text + active view per asset)
  const [simplifiedText, setSimplifiedText] = useState<string | null>(null);
  const [simplifyView, setSimplifyView] = useState<SimplifyView>("original");

  // Reset simplify view when asset changes
  useEffect(() => {
    setSimplifyView("original");
    setSimplifiedText(null);
  }, [assetCode]);

  useEffect(() => {
    if (!assetCode) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      setAsset(null);
      setChapter(null);
      setSiblings([]);
      try {
        const { data: a, error: aErr } = await supabase
          .from("teaching_assets")
          .select(
            "id, asset_name, problem_title, source_ref, survive_problem_text, instruction_1, instruction_2, instruction_3, instruction_4, instruction_5, instruction_list, chapter_id",
          )
          .eq("asset_name", assetCode)
          .maybeSingle();

        if (cancelled) return;
        if (aErr) throw aErr;
        if (!a) {
          setNotFound(true);
          return;
        }
        setAsset(a as Asset);

        const [{ data: ch }, { data: sibs }] = await Promise.all([
          supabase
            .from("chapters")
            .select("id, chapter_number, chapter_name")
            .eq("id", a.chapter_id)
            .maybeSingle(),
          supabase
            .from("teaching_assets")
            .select("asset_name, source_ref")
            .eq("chapter_id", a.chapter_id),
        ]);

        if (cancelled) return;
        if (ch) setChapter(ch as ChapterMeta);
        if (sibs) {
          const sorted = [...sibs].sort((x, y) => naturalCompare(x.source_ref, y.source_ref));
          setSiblings(sorted);
        }
      } catch (e) {
        console.error("Failed to load asset", e);
        setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assetCode]);

  const { prev, next } = useMemo(() => {
    if (!asset || siblings.length === 0) return { prev: null, next: null };
    const idx = siblings.findIndex((s) => s.asset_name === asset.asset_name);
    return {
      prev: idx > 0 ? siblings[idx - 1] : null,
      next: idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null,
    };
  }, [asset, siblings]);

  const instructions = asset ? getInstructions(asset) : [];
  const headerLabel = chapter
    ? `Ch ${chapter.chapter_number}${asset?.source_ref ? ` — ${asset.source_ref}` : ""}`
    : asset?.source_ref || "";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{asset?.problem_title || asset?.source_ref || "Problem"} · Survive Accounting</title>
      </Helmet>

      {isPreview && (
        <div className="fixed top-2 right-2 z-50 bg-destructive text-destructive-foreground text-[10px] font-mono px-2 py-1 rounded shadow-lg">
          PREVIEW · {asset?.asset_name || assetCode}
        </div>
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <div className="text-sm font-medium tracking-tight truncate">{headerLabel}</div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setJumpOpen(true)}
            disabled={siblings.length === 0}
            className="gap-1.5 h-8"
          >
            <LayoutList className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Jump</span>
          </Button>
        </div>
      </header>

      {/* Improvement banner */}
      <div className="border-b bg-muted/40">
        <div className="max-w-6xl mx-auto px-4 py-2 text-center text-xs text-muted-foreground">
          ✨ We're improving this in real-time — your feedback helps
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 pt-6 pb-32">
        {loading && (
          <div className="space-y-3 max-w-3xl">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-32 w-full mt-6" />
          </div>
        )}

        {!loading && notFound && (
          <div className="text-center py-20">
            <p className="text-lg font-medium">Problem not found</p>
            <p className="text-sm text-muted-foreground mt-1">
              We couldn't find <code className="font-mono">{assetCode}</code>.
            </p>
          </div>
        )}

        {!loading && asset && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* LEFT: Problem + What you need to solve */}
            <div className="space-y-4 min-w-0">
              {/* Card 1: Problem */}
              <section className="rounded-2xl border bg-card p-6 shadow-sm">
                {asset.source_ref && (
                  <div className="text-xs text-muted-foreground">
                    Practice based on <span className="font-mono">{asset.source_ref}</span>
                  </div>
                )}

                {/* Original view: problem text + (separate) instructions card below */}
                {simplifyView === "original" && asset.survive_problem_text && (
                  <div className="mt-4 whitespace-pre-wrap text-[0.95rem] leading-[1.7] text-foreground/90 max-w-prose">
                    {asset.survive_problem_text}
                  </div>
                )}

                {/* Simplified view: combined block of cleaned-up problem + instructions */}
                {simplifyView === "simplified" && simplifiedText && (
                  <div className="mt-4 prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-1 prose-headings:mt-4 prose-headings:mb-2 prose-headings:text-base text-[0.95rem] leading-relaxed">
                    <ReactMarkdown>{simplifiedText}</ReactMarkdown>
                  </div>
                )}

                {/* Simplify trigger / toggle */}
                <SimplifiedProblem
                  asset={asset}
                  chapter={chapter}
                  view={simplifyView}
                  onViewChange={setSimplifyView}
                  simplifiedText={simplifiedText}
                  setSimplifiedText={setSimplifiedText}
                />
              </section>

              {/* Card 2: What you need to solve — only in Original view */}
              {simplifyView === "original" && instructions.length > 0 && (
                <section className="rounded-2xl border bg-card p-6 shadow-sm">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    What you need to solve
                  </h2>
                  <ul className="space-y-2.5 text-[0.95rem] leading-relaxed">
                    {instructions.map((ins, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span className="font-semibold text-primary shrink-0 mt-0.5">
                          {String.fromCharCode(97 + i)}.
                        </span>
                        <span className="whitespace-pre-wrap">{highlightTerms(ins)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Report issue link */}
              <div className="flex justify-end">
                <button
                  onClick={() => setReportOpen(true)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <AlertTriangle className="h-3 w-3" />
                  Report issue
                </button>
              </div>
            </div>

            {/* RIGHT: Explain */}
            <div className="lg:sticky lg:top-20 lg:self-start min-w-0">
              <InlineExplanation asset={asset} />
            </div>
          </div>
        )}
      </main>

      {/* Sticky bottom nav */}
      {!loading && asset && (
        <nav className="fixed bottom-0 inset-x-0 z-20 bg-background/95 backdrop-blur border-t">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!prev}
              onClick={() => prev && navigate(`/v2/solutions/${prev.asset_name}`)}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Previous</span>
              {prev?.source_ref && <span className="font-mono text-xs text-muted-foreground hidden md:inline">{prev.source_ref}</span>}
            </Button>

            <div className="text-xs text-muted-foreground font-mono">
              {siblings.length > 0 && asset
                ? `${siblings.findIndex((s) => s.asset_name === asset.asset_name) + 1} / ${siblings.length}`
                : ""}
            </div>

            <Button
              variant="default"
              size="sm"
              disabled={!next}
              onClick={() => next && navigate(`/v2/solutions/${next.asset_name}`)}
              className="gap-1"
            >
              {next?.source_ref && <span className="font-mono text-xs hidden md:inline">{next.source_ref}</span>}
              <span className="hidden sm:inline">Next</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </nav>
      )}

      {/* Floating help button */}
      {!loading && asset && (
        <button
          onClick={() => setHelpOpen(true)}
          className={cn(
            "fixed right-4 bottom-20 z-30 rounded-full shadow-lg",
            "bg-card border hover:bg-accent transition-colors",
            "h-11 px-4 inline-flex items-center gap-2 text-sm font-medium",
          )}
          aria-label="Need help?"
        >
          <MessageCircleQuestion className="h-4 w-4" />
          <span className="hidden sm:inline">Need help?</span>
        </button>
      )}

      <NeedHelpModal open={helpOpen} onOpenChange={setHelpOpen} asset={asset} />
      <ReportIssueModal open={reportOpen} onOpenChange={setReportOpen} asset={asset} />
      <JumpModal
        open={jumpOpen}
        onOpenChange={setJumpOpen}
        siblings={siblings}
        currentAssetName={asset?.asset_name}
      />
    </div>
  );
}
