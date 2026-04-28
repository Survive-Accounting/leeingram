import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, ArrowRight, ChevronLeft, MessageCircleQuestion, Sparkles, Loader2, AlertTriangle, Menu, Wand2, Printer, BookOpen, Share2, Copy, Check, Search, ChevronDown, ChevronUp, Sheet as SheetIcon, PanelLeftClose, PanelRightClose, Columns2, Rows2, RotateCcw, GripVertical, GripHorizontal, Maximize2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { z } from "zod";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { StructuredJEDisplay } from "@/components/StructuredJEDisplay";
import SmartTextRenderer from "@/components/SmartTextRenderer";
import { generateSimplifiedPracticePdf } from "@/lib/generateSimplifiedPracticePdf";
import ReactMarkdown from "react-markdown";
import SurviveExplorePanel from "@/components/v2/SurviveExplorePanel";
import DOMPurify from "isomorphic-dompurify";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buildShareUrl, captureRefFromUrl, logShareClick, attachReferrerOnConversion } from "@/lib/referralTracking";
import { toYouPerspective } from "@/utils/youPerspective";
import leeHeadshotImg from "@/assets/lee-headshot-original.png";
import { ViewerOnboardingModal } from "@/pages/v2/ViewerOnboardingModal";

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
  base_raw_problem_id: string | null;
  journal_entry_completed_json: any | null;
};

type ChapterMeta = {
  id: string;
  chapter_number: number;
  chapter_name: string;
  course_id?: string;
  course?: { code: string | null; course_name: string | null } | null;
};

// Course label rule lives in src/lib/courseLabel.ts (campus code if known, else course name).
import { getCourseLabel as buildCourseLabel } from "@/lib/courseLabel";

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
/** @deprecated Replaced by StuckSupportModal. Kept for rollback safety. */
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
      // Attribute the referral (no-op if no ?ref= was captured for this visitor).
      void attachReferrerOnConversion(email);
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

// ── Stuck? Support modal ───────────────────────────────────────────────
type StuckIssueType = "question" | "problem_text_issue" | "walkthrough_issue" | "general_feedback";

const STUCK_OPTIONS: { value: StuckIssueType; label: string; description: string }[] = [
  { value: "question",            label: "Question about this problem",      description: "I'm confused and need help understanding it." },
  { value: "problem_text_issue",  label: "Problem text / instructions issue", description: "Something looks wrong, missing, or unclear." },
  { value: "walkthrough_issue",   label: "Walkthrough / solution issue",      description: "The explanation, math, or setup seems off." },
  { value: "general_feedback",    label: "Something else",                    description: "Share general feedback or another issue." },
];

const stuckSchema = z.object({
  issue_type: z.enum(["question", "problem_text_issue", "walkthrough_issue", "general_feedback"]),
  note: z.string().trim().min(3, "Add a quick note (at least 3 characters)").max(2000, "Note is too long"),
  email: z.string().trim().email("Add a valid email").max(255),
});

function StuckSupportModal({
  open,
  onOpenChange,
  asset,
  chapter,
  courseLabel,
  viewMode,
  simplifiedText,
  activeHelper,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset: Asset | null;
  chapter: ChapterMeta | null;
  courseLabel: string | null;
  viewMode: "split" | "split-h" | "problem" | "helper";
  simplifiedText: string | null;
  activeHelper: string | null;
}) {
  const [issueType, setIssueType] = useState<StuckIssueType>("question");
  const [note, setNote] = useState("");
  const [includeProblem, setIncludeProblem] = useState(true);
  const [email, setEmail] = useState("");
  const [hasStoredEmail, setHasStoredEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIssueType("question");
    setNote("");
    setIncludeProblem(true);
    try {
      const stored = localStorage.getItem("v2_student_email");
      if (stored) {
        setEmail(stored);
        setHasStoredEmail(true);
      } else {
        setEmail("");
        setHasStoredEmail(false);
      }
    } catch {
      setHasStoredEmail(false);
    }
  }, [open]);

  const buildContextBlock = (): string => {
    const lines: string[] = [
      "---",
      "Context (auto-captured):",
      `- Course: ${courseLabel || "—"}`,
      chapter ? `- Chapter: Ch ${chapter.chapter_number} · ${chapter.chapter_name}` : "- Chapter: —",
      asset ? `- Problem: ${asset.asset_name}${asset.source_ref ? ` (ref ${asset.source_ref})` : ""}` : "- Problem: —",
      `- View mode: ${viewMode}`,
      `- Active helper: ${activeHelper || "none"}`,
      `- Page URL: ${typeof window !== "undefined" ? window.location.href : "—"}`,
      `- Device: ${typeof navigator !== "undefined" ? navigator.userAgent : "—"}`,
      `- Timestamp: ${new Date().toISOString()}`,
    ];
    if (includeProblem && asset?.survive_problem_text) {
      const snap = asset.survive_problem_text.slice(0, 800);
      lines.push("- Problem text snapshot:");
      lines.push(snap.split("\n").map((l) => `    ${l}`).join("\n"));
    }
    const helperState = simplifiedText
      ? "Simplified text shown"
      : activeHelper
      ? `${activeHelper} open`
      : "—";
    lines.push(`- Helper state: ${helperState}`);
    return lines.join("\n");
  };

  const submit = async () => {
    if (!asset) return;
    const parsed = stuckSchema.safeParse({ issue_type: issueType, note, email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Please check your input");
      return;
    }

    setSubmitting(true);
    try {
      const composedQuestion = includeProblem
        ? `${parsed.data.note.trim()}\n\n${buildContextBlock()}`
        : parsed.data.note.trim();

      const { error } = await supabase.from("chapter_questions").insert({
        chapter_id: asset.chapter_id,
        student_email: parsed.data.email.toLowerCase(),
        question: composedQuestion,
        issue_type: parsed.data.issue_type,
        asset_name: asset.asset_name,
        source_ref: asset.source_ref,
      });
      if (error) throw error;

      try { localStorage.setItem("v2_student_email", parsed.data.email.toLowerCase()); } catch { /* ignore */ }
      void attachReferrerOnConversion(parsed.data.email);

      toast.success("Thanks — we'll review this ASAP.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Could not send");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>What's going on?</DialogTitle>
          <DialogDescription>
            Help us fix it or point you in the right direction.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup
            value={issueType}
            onValueChange={(v) => setIssueType(v as StuckIssueType)}
            className="space-y-2"
          >
            {STUCK_OPTIONS.map((opt) => {
              const selected = issueType === opt.value;
              return (
                <label
                  key={opt.value}
                  htmlFor={`stuck-${opt.value}`}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                    selected
                      ? "border-[#CE1126]/60 bg-[#CE1126]/5"
                      : "border-border hover:bg-accent/50",
                  )}
                >
                  <RadioGroupItem id={`stuck-${opt.value}`} value={opt.value} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold leading-tight">{opt.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{opt.description}</div>
                  </div>
                </label>
              );
            })}
          </RadioGroup>

          {!hasStoredEmail && (
            <div>
              <Label htmlFor="stuck-email" className="text-xs">Your email</Label>
              <Input
                id="stuck-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.edu"
                className="mt-1"
                maxLength={255}
              />
            </div>
          )}

          <div>
            <Label htmlFor="stuck-note" className="text-xs">Tell us what happened.</Label>
            <Textarea
              id="stuck-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What confused you, what looked wrong, or what would make this better?"
              rows={4}
              maxLength={2000}
              className="mt-1 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              checked={includeProblem}
              onCheckedChange={(v) => setIncludeProblem(v === true)}
            />
            Include this problem with my report
          </label>

          <Button
            onClick={submit}
            disabled={submitting || note.trim().length < 3}
            className="w-full"
          >
            {submitting ? "Sending…" : "Send feedback"}
          </Button>
          <p className="text-[11px] text-center text-muted-foreground -mt-1">
            Beta feedback — replies come by email.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}


// ── Explanation panel (Sheet from right, full-screen on mobile) ────────
// (Legacy `ExplanationSections` / `SectionKey` types removed — InlineExplanation
//  now talks to the `survive-this` edge function directly.)

type FeedbackReason = "unclear_steps" | "concept" | "too_long" | "still_confused";

const REASON_OPTIONS: { value: FeedbackReason; label: string }[] = [
  { value: "unclear_steps", label: "Steps were unclear" },
  { value: "concept", label: "Didn't understand the concept" },
  { value: "too_long", label: "Too long / confusing" },
  { value: "still_confused", label: "Still confused overall" },
];

const MAX_REASONS = 2;

function ExplanationFeedback({ asset, onShareClick }: { asset: Asset; onShareClick: () => void }) {
  const [helpful, setHelpful] = useState<boolean | null>(null);
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

  const submit = async (isHelpful: boolean, rs: FeedbackReason[] = [], n: string = "") => {
    setSubmitting(true);
    try {
      await supabase.from("explanation_feedback").insert({
        asset_id: asset.id,
        asset_name: asset.asset_name,
        user_email: getEmail(),
        helpful: isHelpful,
        reason: rs.length ? rs : null,
        note: n.trim() || null,
      });
      setHelpful(isHelpful);
      setStage("done");
    } catch (e: any) {
      toast.error("Could not send feedback");
    } finally {
      setSubmitting(false);
    }
  };

  if (stage === "done") {
    if (helpful) {
      return (
        <div className="space-y-3 py-1">
          <div className="text-sm font-medium text-foreground leading-snug">
            🔥 Awesome — glad that clicked.
          </div>
          <div className="text-sm text-muted-foreground">
            Want to help a friend before their exam?
          </div>
          <Button size="sm" className="w-full" onClick={onShareClick}>
            <Share2 className="h-3.5 w-3.5 mr-1.5" />
            Send this to a friend
          </Button>
        </div>
      );
    }
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

// Primary toolbox keys map directly to `survive-this` edge function prompt types.
type ToolboxKey = "walk_through" | "hint" | "setup" | "full_solution";

const TOOLBOX_META: Record<ToolboxKey, { label: string; emoji: string; subtitle: string }> = {
  walk_through:  { label: "Walk me through it", emoji: "🚀", subtitle: "Full step-by-step solution" },
  hint:          { label: "Give me a hint",     emoji: "💡", subtitle: "One nudge — no spoilers" },
  setup:         { label: "Show the setup",     emoji: "📄", subtitle: "Tables, formulas, structure" },
  full_solution: { label: "Full solution",      emoji: "✅", subtitle: "Just the answer" },
};

// Inline HTML detection + sanitizer — mirrors SurviveExplorePanel's renderer
// so survive-this responses with tables/lists render cleanly here too.
const INLINE_AI_HTML_STYLE = `<style>
.sa-inline-ai table { width:100%; border-collapse:collapse; font-size:13px; margin:10px 0 14px; }
.sa-inline-ai th { text-align:left; color:#6B7280; font-weight:600; border-bottom:1px solid #E5E7EB; padding:6px 10px; background:#FAFAFA; }
.sa-inline-ai td { padding:6px 10px; border-bottom:1px solid #F3F4F6; color:#14213D; font-size:13px; }
.sa-inline-ai tr.total td { font-weight:700; border-top:1px solid #D1D5DB; border-bottom:none; background:#F8F9FA; }
.sa-inline-ai ul, .sa-inline-ai ol { margin:8px 0 12px 20px; padding:0; }
.sa-inline-ai li { margin:4px 0; line-height:1.55; }
.sa-inline-ai p { margin:8px 0; line-height:1.65; }
.sa-inline-ai strong { color:#14213D; font-weight:700; }
.sa-inline-ai em { color:#6B7280; }
</style>`;
const INLINE_HTML_DETECT = /<(table|strong|ul|ol|li|br|h[1-6]|div|span|p|em|thead|tbody|tr|th|td)\b/i;

/**
 * Renders a multi-step walkthrough one step at a time.
 * The AI returns all steps separated by `<!--STEP-->` (case-insensitive, optional whitespace).
 * If no delimiter is present, falls back to rendering the full text as a single step.
 */
function WalkthroughStepper({
  text,
  onReviewFullSolution,
}: {
  text: string;
  onReviewFullSolution: () => void;
}) {
  const steps = useMemo(() => {
    const parts = text
      .split(/<!--\s*STEP\s*-->/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return parts.length > 0 ? parts : [text];
  }, [text]);

  const total = steps.length;
  const [current, setCurrent] = useState(0);
  const [showAll, setShowAll] = useState(false);

  // Reset when text changes (new asset / refetch)
  useEffect(() => {
    setCurrent(0);
    setShowAll(false);
  }, [text]);

  const isLast = current >= total - 1;
  const stepLabel = total > 1 ? `Step ${current + 1} of ${total}` : "Walkthrough";

  // Single-step (or fallback) — render plain
  if (total <= 1) {
    return <InlineResponseBlock text={steps[0]} />;
  }

  if (showAll) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            All {total} steps
          </span>
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
          >
            Show one at a time
          </button>
        </div>
        {steps.map((s, i) => (
          <div key={i} className={i > 0 ? "pt-4 border-t border-border/50" : ""}>
            <InlineResponseBlock text={s} />
          </div>
        ))}
        <div className="pt-3 border-t border-border/50 flex justify-end">
          <button
            type="button"
            onClick={onReviewFullSolution}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-semibold bg-[#CE1126] text-white hover:bg-[#b50f22] transition-colors shadow-sm"
          >
            Review full solution →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Progress header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap">
            {stepLabel}
          </span>
          <div className="flex items-center gap-1" aria-hidden>
            {steps.map((_, i) => (
              <span
                key={i}
                className="block h-1.5 rounded-full transition-all duration-200"
                style={{
                  width: i === current ? 16 : 6,
                  background:
                    i < current
                      ? "rgba(206,17,38,0.85)"
                      : i === current
                      ? "#CE1126"
                      : "rgba(255,255,255,0.18)",
                }}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors whitespace-nowrap"
        >
          Show all steps
        </button>
      </div>

      {/* Step body — keyed so React replaces it cleanly with a subtle fade */}
      <div
        key={current}
        className="animate-in fade-in duration-200"
      >
        <InlineResponseBlock text={steps[current]} />
      </div>

      {/* Footer controls */}
      <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-3">
        {current > 0 ? (
          <button
            type="button"
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            className="inline-flex items-center gap-1 h-8 px-2 -ml-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Step {current}
          </button>
        ) : (
          <span aria-hidden />
        )}

        {isLast ? (
          <button
            type="button"
            onClick={onReviewFullSolution}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-semibold bg-[#CE1126] text-white hover:bg-[#b50f22] transition-colors shadow-sm"
          >
            Review full solution →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-semibold bg-[#CE1126] text-white hover:bg-[#b50f22] transition-colors shadow-sm"
          >
            Continue to Step {current + 2} →
          </button>
        )}
      </div>
    </div>
  );
}

function InlineResponseBlock({ text }: { text: string }) {
  const isHtml = INLINE_HTML_DETECT.test(text);
  if (isHtml) {
    const cleaned = DOMPurify.sanitize(text, {
      ALLOWED_TAGS: ["table", "thead", "tbody", "tr", "th", "td", "strong", "em", "b", "i", "ul", "ol", "li", "p", "br", "div", "span", "h1", "h2", "h3", "h4", "h5", "h6"],
      ALLOWED_ATTR: ["class"],
    });
    return (
      <div
        className="text-[14px] leading-relaxed"
        dangerouslySetInnerHTML={{ __html: INLINE_AI_HTML_STYLE + `<div class="sa-inline-ai">${cleaned}</div>` }}
      />
    );
  }
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 text-[14px] leading-relaxed">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}

function InlineExplanation({
  asset,
  chapter,
  simplifiedText,
  setSimplifiedText,
  onShareClick,
  onAdvanceTask,
  onActiveHelperChange,
}: {
  asset: Asset;
  chapter: ChapterMeta | null;
  simplifiedText: string | null;
  setSimplifiedText: (t: string | null) => void;
  onShareClick: () => void;
  onAdvanceTask?: (taskIndex: number) => void;
  onActiveHelperChange?: (key: string | null) => void;
}) {
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get("embed") === "1";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<Partial<Record<ToolboxKey, string>>>({});
  const [activeSection, setActiveSection] = useState<ToolboxKey | null>(null);
  const [printing, setPrinting] = useState(false);
  const [exportingSheet, setExportingSheet] = useState(false);
  const [jeOpen, setJeOpen] = useState(false);

  const hasJE = Array.isArray(asset.journal_entry_completed_json?.scenario_sections)
    && asset.journal_entry_completed_json.scenario_sections.length > 0;

  // Mirror activeSection up to parent for support modal context
  useEffect(() => {
    onActiveHelperChange?.(activeSection);
  }, [activeSection, onActiveHelperChange]);

  // Reset on asset change
  useEffect(() => {
    setResponses({});
    setActiveSection(null);
    setError(null);
  }, [asset.asset_name]);

  const buildContext = () => ({
    problem_text: asset.survive_problem_text || "",
    instructions: [asset.instruction_1, asset.instruction_2, asset.instruction_3, asset.instruction_4, asset.instruction_5, asset.instruction_list]
      .filter(Boolean)
      .join("\n"),
    chapter_name: chapter ? `Ch ${chapter.chapter_number}: ${chapter.chapter_name}` : "",
    course_name: chapter?.course?.course_name || "",
  });

  // Background prefetch for "Walk me through it" — survive-this caches in
  // survive_ai_responses by (asset_id, prompt_type) so a later click is instant.
  useEffect(() => {
    if (responses.walk_through || loading || isEmbed) return;
    let cancelled = false;
    const prefetch = () => {
      if (cancelled || responses.walk_through) return;
      supabase.functions
        .invoke("survive-this", {
          body: { asset_id: asset.id, prompt_type: "walk_through", context: buildContext() },
        })
        .then(({ data, error }) => {
          if (cancelled || error || !data?.success) return;
          const text = data.response_text || data.response || "";
          if (!text) return;
          setResponses((p) => ({ ...p, walk_through: text }));
        })
        .catch(() => { /* silent */ });
    };
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    let idleId: number | undefined;
    let timeoutId: number | undefined;
    if (ric) {
      idleId = ric(prefetch, { timeout: 2500 });
    } else {
      timeoutId = window.setTimeout(prefetch, 1500);
    }
    return () => {
      cancelled = true;
      if (idleId !== undefined && (window as any).cancelIdleCallback) {
        (window as any).cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.asset_name]);

  // Embed mode: silently log a vote and trigger the parent's beta paywall.
  const logEmbedVoteAndPaywall = (key: ToolboxKey) => {
    try {
      (supabase as any)
        .rpc("increment_survive_helpful", { p_asset_id: asset.id, p_prompt_type: key })
        .then(() => {})
        .catch(() => {});
    } catch { /* silent */ }
    try { window.parent?.postMessage({ type: "sa-embed-paywall" }, "*"); } catch { /* silent */ }
  };

  const handleToolboxClick = async (key: ToolboxKey) => {
    bumpWandCounter(WAND_KEY_HELP_CLICKS);
    if (isEmbed) {
      logEmbedVoteAndPaywall(key);
      return;
    }
    if (activeSection === key) {
      setActiveSection(null);
      return;
    }
    setActiveSection(key);
    if (responses[key]) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("survive-this", {
        body: { asset_id: asset.id, prompt_type: key, context: buildContext() },
      });
      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error || "No response");
      const text = data.response_text || data.response || "";
      if (!text) throw new Error("Empty response from helper");
      setResponses((p) => ({ ...p, [key]: text }));
    } catch (e: any) {
      console.error("[survive-this]", key, e);
      setError("Lee's tools are taking a breather. Try again in a moment — if it keeps happening, hit \"Need help?\" and we'll get on it.");
    } finally {
      setLoading(false);
    }
  };

  // Print PDF — reuses simplify-problem cache + generateSimplifiedPracticePdf
  const handlePrintPdf = async () => {
    setError(null);
    const buildPdf = (md: string) => {
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

    if (simplifiedText) { buildPdf(simplifiedText); return; }
    setPrinting(true);
    try {
      const { data, error } = await supabase.functions.invoke("simplify-problem", {
        body: { asset_id: asset.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to prepare PDF");
      setSimplifiedText(data.simplified_text);
      buildPdf(data.simplified_text);
    } catch (e: any) {
      console.error("[simplify-problem] failed:", e);
      setError("Couldn't build the PDF right now.");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
      {/* Toolbox — opens directly to buttons, no heading */}
      <div className="space-y-3 pt-1">
        {/* Row 1 — Walk me through it (full width, red) */}
        <button
          type="button"
          onClick={() => handleToolboxClick("walk_through")}
          className={cn(
            "w-full inline-flex items-center justify-center gap-2 rounded-lg h-12 px-4 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99]",
            activeSection === "walk_through" && "ring-2 ring-offset-2 ring-[#CE1126]/40"
          )}
          style={{
            background: "linear-gradient(180deg, #E63950 0%, #CE1126 50%, #A30E1F 100%)",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 16px -6px rgba(206,17,38,0.5), 0 2px 4px rgba(0,0,0,0.2)",
          }}
        >
          <span aria-hidden>{TOOLBOX_META.walk_through.emoji}</span>
          {TOOLBOX_META.walk_through.label}
        </button>

        {/* Row 2 — Hint + Setup (two equal columns) */}
        <div className="grid grid-cols-2 gap-2">
          {(["hint", "setup"] as ToolboxKey[]).map((k) => {
            const isActive = activeSection === k;
            return (
              <Button
                key={k}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => handleToolboxClick(k)}
                className="justify-start gap-2 h-9 text-xs sm:text-sm font-medium"
                title={TOOLBOX_META[k].subtitle}
              >
                <span aria-hidden>{TOOLBOX_META[k].emoji}</span>
                {TOOLBOX_META[k].label}
              </Button>
            );
          })}
        </div>

        {/* Row 3 — Full solution (full width, secondary) */}
        <Button
          variant={activeSection === "full_solution" ? "default" : "outline"}
          size="sm"
          onClick={() => handleToolboxClick("full_solution")}
          className="w-full justify-start gap-2 h-9 text-xs sm:text-sm font-medium"
          title={TOOLBOX_META.full_solution.subtitle}
        >
          <span aria-hidden>{TOOLBOX_META.full_solution.emoji}</span>
          {TOOLBOX_META.full_solution.label}
        </Button>
      </div>

      {hasJE && (
        <Dialog open={jeOpen} onOpenChange={setJeOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Journal Entries</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto pr-1 -mr-1">
              <StructuredJEDisplay
                data={asset.journal_entry_completed_json}
                showHeading={false}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {activeSection && (
        <section
          key={activeSection}
          className="rounded-lg border border-border bg-muted/30 p-4 animate-in fade-in slide-in-from-top-1 duration-200"
        >
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <span aria-hidden>{TOOLBOX_META[activeSection].emoji}</span>
            {TOOLBOX_META[activeSection].label}
          </h3>
          {loading && !responses[activeSection] ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              We're working on it…
            </div>
          ) : responses[activeSection] ? (
            activeSection === "walk_through" ? (
              <WalkthroughStepper
                text={responses.walk_through!}
                onReviewFullSolution={() => handleToolboxClick("full_solution")}
              />
            ) : (
              <InlineResponseBlock text={responses[activeSection]!} />
            )
          ) : null}
        </section>
      )}

      {activeSection && responses[activeSection] && (
        <div className="pt-3 border-t border-border">
          <ExplanationFeedback asset={asset} onShareClick={onShareClick} />
        </div>
      )}
    </div>
  );
}

// ── Magic Wand feedback widget (slide-up, once per browser) ───────────
const WAND_KEY_SHOWN = "sa_wand_shown";
const WAND_KEY_DISMISSED = "sa_wand_dismissed";
const WAND_KEY_VIEWS = "sa_problem_views";
const WAND_KEY_HELP_CLICKS = "sa_help_clicks";
const WAND_KEY_FIRST_TS = "sa_first_visit_ts";

function bumpWandCounter(key: string) {
  try {
    const cur = parseInt(localStorage.getItem(key) || "0", 10) || 0;
    localStorage.setItem(key, String(cur + 1));
    window.dispatchEvent(new Event("sa-wand-tick"));
  } catch {}
}

const WAND_KEY_OPTOUT = "sa_wand_optout";
const WAND_INTERVAL = 15;

function MagicWandFeedback({ onTriggerShare }: { onTriggerShare: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"rate" | "wish" | "thanks">("rate");
  const [rating, setRating] = useState<number | null>(null);
  const [wish, setWish] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Trigger every 15th interaction (problem view), unless opted out.
  useEffect(() => {
    try {
      if (localStorage.getItem(WAND_KEY_OPTOUT) === "1") return;
      const v = parseInt(localStorage.getItem(WAND_KEY_VIEWS) || "0", 10) || 0;
      const next = v + 1;
      localStorage.setItem(WAND_KEY_VIEWS, String(next));
      if (next > 0 && next % WAND_INTERVAL === 0) {
        setStep("rate");
        setRating(null);
        setWish("");
        setOpen(true);
      }
    } catch {}
  }, []);

  const getEmail = () => {
    try {
      return (
        localStorage.getItem("v2_student_email") ||
        localStorage.getItem("sa_free_user_email") ||
        null
      );
    } catch {
      return null;
    }
  };

  const writeFeedback = async (r: number, note: string | null) => {
    try {
      await supabase.from("explanation_feedback").insert({
        asset_id: "00000000-0000-0000-0000-000000000001",
        asset_name: "__magic_wand__",
        user_email: getEmail(),
        helpful: r >= 4 ? true : r <= 3 ? false : null,
        reason: ["wand_prompt", `rating:${r}`],
        note: note && note.trim() ? note.trim() : null,
      });
    } catch (e) {
      console.warn("wand feedback insert failed", e);
    }
  };

  const closeAll = () => {
    setOpen(false);
    setTimeout(() => {
      setStep("rate");
      setRating(null);
      setWish("");
    }, 200);
  };

  const skip = () => closeAll();

  const optOut = () => {
    try { localStorage.setItem(WAND_KEY_OPTOUT, "1"); } catch {}
    closeAll();
  };

  const handleRate = async (r: number) => {
    setRating(r);
    if (r <= 3) {
      setSubmitting(true);
      await writeFeedback(r, null);
      setSubmitting(false);
      setStep("thanks");
      setTimeout(() => closeAll(), 1400);
    } else {
      setStep("wish");
    }
  };

  const handleWishSkip = async () => {
    if (rating != null) {
      setSubmitting(true);
      await writeFeedback(rating, null);
      setSubmitting(false);
    }
    closeAll();
  };

  const handleWishSend = async () => {
    if (!wish.trim()) {
      toast.message("Add a quick note first 🙂");
      return;
    }
    if (rating == null) return;
    setSubmitting(true);
    await writeFeedback(rating, wish);
    setSubmitting(false);
    toast.success("Thanks — that's exactly what we needed 🙏");
    closeAll();
    // Defer briefly so the wand modal is fully closed before share opens.
    setTimeout(() => onTriggerShare(), 220);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) skip(); }}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col items-center text-center gap-3 pt-2">
          <img
            src={leeHeadshotImg}
            alt="Lee Ingram"
            className="h-20 w-20 rounded-full object-cover ring-2 ring-primary/20 shadow-md"
          />
          <DialogHeader className="space-y-1.5">
            {step === "rate" && (
              <>
                <DialogTitle className="text-center">Quick favor?</DialogTitle>
                <DialogDescription className="text-center">
                  How's Survive Accounting working for you so far?
                </DialogDescription>
              </>
            )}
            {step === "wish" && (
              <>
                <DialogTitle className="text-center">Awesome — one wish?</DialogTitle>
                <DialogDescription className="text-center">
                  If you could wave a magic wand, what would make this perfect?
                </DialogDescription>
              </>
            )}
            {step === "thanks" && (
              <>
                <DialogTitle className="text-center">Thanks 🙏</DialogTitle>
                <DialogDescription className="text-center">
                  We'll keep making it better.
                </DialogDescription>
              </>
            )}
          </DialogHeader>
        </div>

        {step === "rate" && (
          <>
            <div className="flex items-center justify-center gap-2 mt-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleRate(n)}
                  disabled={submitting}
                  className="h-12 w-12 rounded-lg text-base font-semibold transition-all border"
                  style={{
                    background: rating === n ? "#CE1126" : "rgba(20,33,61,0.04)",
                    color: rating === n ? "#fff" : "#14213D",
                    borderColor: rating === n ? "#CE1126" : "rgba(20,33,61,0.15)",
                  }}
                  onMouseEnter={(e) => {
                    if (rating !== n) e.currentTarget.style.background = "rgba(20,33,61,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    if (rating !== n) e.currentTarget.style.background = "rgba(20,33,61,0.04)";
                  }}
                  aria-label={`Rate ${n} out of 5`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground px-1 mt-1">
              <span>Worst</span>
              <span>Best</span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-3">
              <button
                type="button"
                onClick={optOut}
                disabled={submitting}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Don't show again
              </button>
              <Button size="sm" variant="ghost" onClick={skip} disabled={submitting}>
                Skip
              </Button>
            </div>
          </>
        )}

        {step === "wish" && (
          <>
            <Textarea
              value={wish}
              onChange={(e) => setWish(e.target.value)}
              placeholder="One thing you'd change…"
              rows={3}
              className="text-sm resize-none mt-2"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={handleWishSkip} disabled={submitting}>
                Skip
              </Button>
              <Button size="sm" onClick={handleWishSend} disabled={submitting}>
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send to Lee"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ShareModal({
  open,
  onOpenChange,
  onCopy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCopy: () => void;
}) {
  const [copied, setCopied] = useState(false);
  // Recompute every time the modal opens so we always include the latest ?ref=<referrer_id>.
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (open) {
      setUrl(buildShareUrl());
      setCopied(false);
    }
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      onCopy();
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — long-press the link to copy manually");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this problem</DialogTitle>
          <DialogDescription>
            Copy this link and send it to a friend:
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input
            value={url}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
            className="text-xs font-mono"
          />
          <Button onClick={handleCopy} className="shrink-0" size="sm">
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copy link
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Navigate panel ────────────────────────────────────────────────────
function getRefPrefix(ref: string | null): "BE" | "EX" | "PR" | "OTHER" {
  if (!ref) return "OTHER";
  const u = ref.toUpperCase();
  if (u.startsWith("BE") || u.startsWith("QS")) return "BE";
  if (u.startsWith("EX") || u.startsWith("E")) return "EX";
  if (u.startsWith("P")) return "PR";
  return "OTHER";
}

type NavChapter = { id: string; chapter_number: number; chapter_name: string };
type NavProblem = { asset_name: string; source_ref: string | null; chapter_id: string };

function NavigatePanel({
  open,
  onOpenChange,
  courseId,
  currentChapterId,
  currentAssetName,
  courseLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  courseId: string | undefined;
  currentChapterId: string | undefined;
  currentAssetName: string | undefined;
  courseLabel?: string | null;
}) {
  const navigate = useNavigate();

  const [chapters, setChapters] = useState<NavChapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");
  const [problemsByChapter, setProblemsByChapter] = useState<Record<string, NavProblem[]>>({});
  const [activeCat, setActiveCat] = useState<"BE" | "EX" | "PR">("BE");
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [loadingProblems, setLoadingProblems] = useState(false);
  const [isIntro, setIsIntro] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // Sync selection to current chapter when panel opens or current changes.
  useEffect(() => {
    if (open && currentChapterId) setSelectedChapterId(currentChapterId);
  }, [open, currentChapterId]);

  // Detect intro vs intermediate from current asset name.
  useEffect(() => {
    setIsIntro(/^INTRO/i.test(currentAssetName || ""));
  }, [currentAssetName]);

  // Load chapters for the current course (only when panel opens).
  useEffect(() => {
    if (!open || !courseId) return;
    let cancelled = false;
    setLoadingChapters(true);
    (async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name")
        .eq("course_id", courseId)
        .order("chapter_number");
      if (cancelled) return;
      setChapters((data || []) as NavChapter[]);
      setLoadingChapters(false);
    })();
    return () => { cancelled = true; };
  }, [open, courseId]);

  // Load total problem count for the course (cached after first open).
  useEffect(() => {
    if (!open || !courseId || totalCount !== null) return;
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("teaching_assets")
        .select("id", { count: "exact", head: true })
        .eq("course_id", courseId);
      if (cancelled) return;
      setTotalCount(count || 0);
    })();
    return () => { cancelled = true; };
  }, [open, courseId, totalCount]);

  // Load problems for selected chapter (cached per chapter).
  useEffect(() => {
    if (!open || !selectedChapterId) return;
    if (problemsByChapter[selectedChapterId]) return;
    let cancelled = false;
    setLoadingProblems(true);
    (async () => {
      const { data } = await supabase
        .from("teaching_assets")
        .select("asset_name, source_ref, chapter_id")
        .eq("chapter_id", selectedChapterId);
      if (cancelled) return;
      const sorted = [...(data || [])].sort((x: any, y: any) => naturalCompare(x.source_ref, y.source_ref));
      setProblemsByChapter((prev) => ({ ...prev, [selectedChapterId]: sorted as NavProblem[] }));
      setLoadingProblems(false);
    })();
    return () => { cancelled = true; };
  }, [open, selectedChapterId, problemsByChapter]);

  const problems = problemsByChapter[selectedChapterId] || [];

  const groups = useMemo(() => {
    const g: Record<"BE" | "EX" | "PR" | "OTHER", NavProblem[]> = { BE: [], EX: [], PR: [], OTHER: [] };
    problems.forEach((p) => g[getRefPrefix(p.source_ref)].push(p));
    return g;
  }, [problems]);

  const categories = useMemo(() => {
    return [
      { key: "BE" as const, label: isIntro ? "Quick Studies" : "Brief Exercises", count: groups.BE.length },
      { key: "EX" as const, label: "Exercises", count: groups.EX.length },
      { key: "PR" as const, label: "Problems", count: groups.PR.length },
    ];
  }, [groups, isIntro]);

  // When chapter or category changes, default to first non-empty category if current is empty.
  useEffect(() => {
    if (!open) return;
    if (groups[activeCat]?.length) return;
    const first = categories.find((c) => c.count > 0);
    if (first) setActiveCat(first.key);
  }, [open, selectedChapterId, groups, activeCat, categories]);

  const visibleItems = groups[activeCat] || [];

  const go = (assetName: string) => {
    navigate(`/v2/solutions/${assetName}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {courseLabel ? `Jump anywhere in ${courseLabel}` : "Jump anywhere in the course"}
          </DialogTitle>
          <DialogDescription>
            {totalCount && totalCount > 0
              ? `${Math.floor(totalCount / 50) * 50}+ practice problems ready for you to cram.`
              : "Pick a chapter and problem."}
          </DialogDescription>
        </DialogHeader>

        {/* 1. Chapter dropdown */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Chapter</div>
          {loadingChapters && chapters.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">Loading chapters…</div>
          ) : (
            <Select value={selectedChapterId} onValueChange={setSelectedChapterId}>
              <SelectTrigger className="w-full h-10">
                <SelectValue placeholder="Select a chapter" />
              </SelectTrigger>
              <SelectContent className="max-h-[50vh]">
                {chapters.map((ch) => {
                  const isAssetChapter = ch.id === currentChapterId;
                  return (
                    <SelectItem key={ch.id} value={ch.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="font-semibold">Ch {ch.chapter_number}</span>
                        <span className="text-muted-foreground">— {ch.chapter_name}</span>
                        {isAssetChapter && (
                          <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-primary align-middle" />
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* 2. Problem type pills */}
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => {
            const isActive = c.key === activeCat;
            const disabled = c.count === 0;
            return (
              <button
                key={c.key}
                disabled={disabled}
                onClick={() => setActiveCat(c.key)}
                className={cn(
                  "h-8 px-3 rounded-md text-xs font-semibold transition-all border inline-flex items-center gap-1.5",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:bg-accent border-border text-foreground",
                  disabled && "opacity-40 cursor-not-allowed hover:bg-card",
                )}
              >
                {c.label}
                <span
                  className={cn(
                    "inline-flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 min-w-[18px] h-[18px]",
                    isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {c.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 3. Problem grid */}
        <div className="flex-1 overflow-y-auto -mr-1 pr-1 mt-1">
          {loadingProblems && problems.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Loading problems…</div>
          ) : visibleItems.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No problems in this category.</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
              {visibleItems.map((p) => {
                const isCurrent = p.asset_name === currentAssetName;
                return (
                  <button
                    key={p.asset_name}
                    onClick={() => go(p.asset_name)}
                    className={cn(
                      "font-mono text-xs h-8 rounded-md border transition-all px-2 truncate",
                      isCurrent
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card hover:bg-accent border-border text-foreground",
                    )}
                  >
                    {p.source_ref || p.asset_name}
                  </button>
                );
              })}
            </div>
          )}
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



// ── Main page ──────────────────────────────────────────────────────────
export default function SolutionsViewerV2() {
  const { assetCode } = useParams<{ assetCode: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get("mode") === "preview";
  const isEmbed = searchParams.get("embed") === "1";

  // In embed mode, intercept ALL clicks except those explicitly allowed,
  // and notify the parent window to open the Beta paywall.
  const handleEmbedClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isEmbed) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    // Allow text selection and scrolling — only block actual interactive intent.
    const interactive = target.closest(
      'button, a, [role="button"], input, select, textarea, [data-embed-block="true"]',
    ) as HTMLElement | null;
    if (!interactive) return;
    if (interactive.closest('[data-embed-allow="true"]')) return;
    // Allow all interactions inside any open Radix dialog (Share, Help, etc.)
    // so the user can close them without triggering the paywall.
    if (interactive.closest('[role="dialog"], [data-radix-popper-content-wrapper]')) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      window.parent?.postMessage({ type: "sa-embed-paywall" }, "*");
    } catch {
      /* ignore */
    }
  };

  const [asset, setAsset] = useState<Asset | null>(null);
  const [chapter, setChapter] = useState<ChapterMeta | null>(null);
  const [siblings, setSiblings] = useState<{ asset_name: string; source_ref: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Campus context for the active user (if any). Drives whether we show the
  // campus course code (e.g. "ACCY 201") vs the generic course name.
  const [campusSlug, setCampusSlug] = useState<string | null>(null);
  const [localCourseCode, setLocalCourseCode] = useState<string | null>(null);

  const [helpOpen, setHelpOpen] = useState(false);
  const [feedbackChooserOpen, setFeedbackChooserOpen] = useState(false);

  const openReportIssue = () => {
    setFeedbackChooserOpen(false);
    // Defer slightly so the chooser unmount doesn't race the second dialog.
    setTimeout(() => setHelpOpen(true), 80);
  };
  const openSuggestFeature = () => {
    setFeedbackChooserOpen(false);
    setTimeout(() => {
      try { window.dispatchEvent(new Event("sa:open-vote-ideas")); } catch { /* ignore */ }
    }, 80);
  };
  const [activeHelper, setActiveHelper] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // Track generic share funnel (asset_share_events) — used for both anonymous + identified shares.
  const trackShareEvent = async (eventType: "share_click" | "copy_link") => {
    if (!asset) return;
    try {
      await supabase.from("asset_share_events").insert({
        teaching_asset_id: asset.id,
        asset_name: asset.asset_name,
        event_type: eventType,
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });
    } catch {
      // non-blocking
    }
  };

  const openShareModal = () => {
    trackShareEvent("share_click");
    // Referral attribution row (only writes when we have a referrer_id / signed-in student email).
    if (asset) {
      void logShareClick({ problemId: asset.id, problemCode: asset.asset_name });
    }
    setShareOpen(true);
  };

  // On every asset load, check for ?ref= and capture it (persists in localStorage + logs visit).
  useEffect(() => {
    if (!asset) return;
    void captureRefFromUrl({ problemId: asset.id, problemCode: asset.asset_name });
  }, [asset?.id]);

  // Simplify-this-problem state (keeps simplified text per asset)
  const [simplifiedText, setSimplifiedText] = useState<string | null>(null);
  const [simplifyLoading, setSimplifyLoading] = useState(false);
  const [simplifyError, setSimplifyError] = useState<string | null>(null);

  // Original textbook screenshot
  const [originalImages, setOriginalImages] = useState<string[]>([]);
  const [originalLoading, setOriginalLoading] = useState(true);
  const [originalImagesLoaded, setOriginalImagesLoaded] = useState<Record<number, boolean>>({});
  const [originalOpen, setOriginalOpen] = useState(false);

  // "Your Tasks" accordion — open by default so students see what to do.
  const [instructionsOpen, setInstructionsOpen] = useState(true);
  // Per-task checked state, persisted to localStorage per asset.
  const [checkedTasks, setCheckedTasks] = useState<boolean[]>([]);

  // Reading controls for the problem body — helps students digest long word problems.
  const [problemBodyOpen, setProblemBodyOpen] = useState(true);
  const [readingMode, setReadingMode] = useState<"chunks" | "all">("chunks");
  const [chunkIndex, setChunkIndex] = useState(0);

  // ── Split-view controls ──────────────────────────────────────────────
  const isMobileViewport = useIsMobile();
  type ViewMode = "split" | "split-h" | "problem" | "helper";
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [mobileTab, setMobileTab] = useState<"problem" | "helper">("problem");
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    try {
      const v = Number(sessionStorage.getItem("sa.viewer.splitRatio"));
      if (Number.isFinite(v) && v >= 0.25 && v <= 0.75) return v;
    } catch { /* ignore */ }
    return 0.5;
  });
  const [isDragging, setIsDragging] = useState(false);
  const splitContainerRef = React.useRef<HTMLDivElement>(null);

  // Current user (for onboarding modal + share strip)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setCurrentUserId(data.user?.id ?? null);
      setCurrentUserEmail(data.user?.email ?? null);
    });
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    if (!isDragging) return;
    const handleMove = (clientX: number) => {
      const el = splitContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      let ratio = (clientX - rect.left) / rect.width;
      ratio = Math.max(0.25, Math.min(0.75, ratio));
      setSplitRatio(ratio);
    };
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX);
    };
    const stop = () => {
      setIsDragging(false);
      try { sessionStorage.setItem("sa.viewer.splitRatio", String(splitRatio)); } catch { /* ignore */ }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", stop);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", stop);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, splitRatio]);

  React.useEffect(() => {
    if (isMobileViewport) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "[") setViewMode("problem");
      else if (e.key === "]") setViewMode("helper");
      else if (e.key === "\\") setViewMode("split");
      else if (e.key === "-" || e.key === "_") setViewMode("split-h");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobileViewport]);

  // Reset on asset change
  useEffect(() => {
    setSimplifiedText(null);
    setSimplifyError(null);
    setOriginalImages([]);
    setOriginalImagesLoaded({});
    setOriginalLoading(true);
    setOriginalOpen(false);
    setInstructionsOpen(true);
    setProblemBodyOpen(true);
    setChunkIndex(0);
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
            "id, asset_name, problem_title, source_ref, survive_problem_text, instruction_1, instruction_2, instruction_3, instruction_4, instruction_5, instruction_list, chapter_id, base_raw_problem_id, journal_entry_completed_json",
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
        bumpWandCounter(WAND_KEY_VIEWS);

        const [{ data: ch }, { data: sibs }] = await Promise.all([
          supabase
            .from("chapters")
            .select("id, chapter_number, chapter_name, course_id, course:courses(code, course_name)")
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

  // Resolve the active student's campus + the local course code for the
  // current course. We only do this when the chapter (and therefore course_id)
  // is known. Best-effort: silently no-ops for anonymous viewers.
  useEffect(() => {
    if (!chapter?.course_id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        // Find this user's campus via student_onboarding (preferred) or student_purchases.
        const { data: onb } = await supabase
          .from("student_onboarding")
          .select("campus_id")
          .eq("user_id", user.id)
          .maybeSingle();
        let cId: string | null = onb?.campus_id ?? null;

        if (!cId) {
          const { data: sp } = await supabase
            .from("student_purchases")
            .select("campus_id")
            .eq("email", (user.email || "").toLowerCase())
            .not("campus_id", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          cId = (sp as any)?.campus_id ?? null;
        }
        if (!cId || cancelled) return;

        const [{ data: c }, { data: cc }] = await Promise.all([
          supabase.from("campuses").select("slug").eq("id", cId).maybeSingle(),
          supabase
            .from("campus_courses")
            .select("local_course_code")
            .eq("campus_id", cId)
            .eq("course_id", chapter.course_id)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        setCampusSlug((c as any)?.slug ?? null);
        setLocalCourseCode(cc?.local_course_code ?? null);
      } catch {
        /* best-effort */
      }
    })();
    return () => { cancelled = true; };
  }, [chapter?.course_id]);

  // Simplify-on-load is paused. Show original problem text as-is.
  // (PDF print path still calls simplify-problem on demand.)

  // Fetch original textbook screenshot from chapter_problems via base_raw_problem_id
  useEffect(() => {
    if (!asset?.base_raw_problem_id) {
      setOriginalImages([]);
      setOriginalLoading(false);
      return;
    }
    let cancelled = false;
    setOriginalLoading(true);
    setOriginalImagesLoaded({});
    (async () => {
      try {
        const { data } = await supabase
          .from("chapter_problems")
          .select("problem_screenshot_url, problem_screenshot_urls")
          .eq("id", asset.base_raw_problem_id)
          .maybeSingle();
        if (cancelled || !data) return;
        const urls: string[] = Array.isArray(data.problem_screenshot_urls) && data.problem_screenshot_urls.length > 0
          ? data.problem_screenshot_urls.filter(Boolean)
          : data.problem_screenshot_url
            ? [data.problem_screenshot_url]
            : [];
        setOriginalImages(urls);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setOriginalLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [asset?.base_raw_problem_id]);

  const { prev, next } = useMemo(() => {
    if (!asset || siblings.length === 0) return { prev: null, next: null };
    const idx = siblings.findIndex((s) => s.asset_name === asset.asset_name);
    return {
      prev: idx > 0 ? siblings[idx - 1] : null,
      next: idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null,
    };
  }, [asset, siblings]);

  const instructions = asset ? getInstructions(asset) : [];
  const courseLabel = buildCourseLabel({
    courseName: chapter?.course?.course_name,
    campusSlug,
    localCourseCode,
  });
  const headerLabel = chapter
    ? `Ch ${chapter.chapter_number}${asset?.source_ref ? ` — ${asset.source_ref}` : ""}`
    : asset?.source_ref || "";

  // ── Reading chunks: split long problem text into Scenario / Facts / Requirements ──
  // Heuristic: paragraph-level split, then group adjacent paragraphs by signal.
  const problemChunks = useMemo<{ label: string; text: string }[]>(() => {
    const raw = asset?.survive_problem_text ? toYouPerspective(asset.survive_problem_text) : "";
    if (!raw.trim()) return [];
    const paragraphs = raw
      .split(/\n\s*\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (paragraphs.length <= 1) return [{ label: "Problem", text: raw }];

    const numericRe = /[\$\d]|\d+%|\b\d{4}\b/;
    const requirementRe = /\b(required|requirement|instruction|prepare|compute|calculate|determine|journalize|record|what\s+(is|are|amount)|how\s+much|find\b)/i;
    const tableRe = /\|.*\|/;

    type Bucket = "scenario" | "facts" | "requirements";
    const classify = (p: string): Bucket => {
      if (requirementRe.test(p)) return "requirements";
      if (tableRe.test(p)) return "facts";
      // Heuristic: short paragraphs heavy with numbers/$ are facts.
      const numericHits = (p.match(/\$|\d{2,}/g) || []).length;
      if (numericHits >= 2) return "facts";
      return "scenario";
    };

    const groups: { bucket: Bucket; paras: string[] }[] = [];
    paragraphs.forEach((p) => {
      const b = classify(p);
      const last = groups[groups.length - 1];
      if (last && last.bucket === b) last.paras.push(p);
      else groups.push({ bucket: b, paras: [p] });
    });

    const labelMap: Record<Bucket, string> = {
      scenario: "Scenario",
      facts: "Facts & numbers",
      requirements: "What you need to do",
    };
    return groups.map((g) => ({ label: labelMap[g.bucket], text: g.paras.join("\n\n") }));
  }, [asset?.survive_problem_text]);

  // Clamp chunkIndex if chunks shrink (e.g. asset switched to a short problem).
  useEffect(() => {
    if (chunkIndex > Math.max(0, problemChunks.length - 1)) setChunkIndex(0);
  }, [problemChunks.length, chunkIndex]);

  // Load persisted task-check state when asset/instructions change.
  const tasksStorageKey = asset ? `sa_tasks_${asset.asset_name}` : null;
  useEffect(() => {
    if (!tasksStorageKey || instructions.length === 0) {
      setCheckedTasks([]);
      return;
    }
    try {
      const raw = localStorage.getItem(tasksStorageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length === instructions.length) {
        setCheckedTasks(parsed.map(Boolean));
        return;
      }
    } catch {/* ignore */}
    setCheckedTasks(new Array(instructions.length).fill(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasksStorageKey, instructions.length]);

  const toggleTask = (i: number) => {
    setCheckedTasks((prev) => {
      const next = prev.length === instructions.length ? [...prev] : new Array(instructions.length).fill(false);
      next[i] = !next[i];
      if (tasksStorageKey) {
        try { localStorage.setItem(tasksStorageKey, JSON.stringify(next)); } catch {/* ignore */}
      }
      return next;
    });
  };

  // Idempotent setter — used by the bite-sized walkthrough's Continue button.
  // Marks a task as done without toggling it back off.
  const markTaskDone = (i: number) => {
    setCheckedTasks((prev) => {
      const base = prev.length === instructions.length ? [...prev] : new Array(instructions.length).fill(false);
      if (base[i]) return prev; // already done — no-op
      base[i] = true;
      if (tasksStorageKey) {
        try { localStorage.setItem(tasksStorageKey, JSON.stringify(base)); } catch {/* ignore */}
      }
      return base;
    });
  };

  const resetTasks = () => {
    if (!tasksStorageKey) return;
    try { localStorage.removeItem(tasksStorageKey); } catch {/* ignore */}
    setCheckedTasks(new Array(instructions.length).fill(false));
  };

  const currentTaskIndex = checkedTasks.findIndex((c) => !c);
  const allTasksDone = instructions.length > 0 && currentTaskIndex === -1 && checkedTasks.length === instructions.length;
  const anyChecked = checkedTasks.some(Boolean);

  return (
    <div className="min-h-screen bg-background text-foreground" onClickCapture={handleEmbedClickCapture}>
      <Helmet>
        <title>{asset?.source_ref ? `Practice based on ${asset.source_ref}` : "Problem"} · Survive Accounting</title>
      </Helmet>

      {isPreview && (
        <div className="fixed top-2 right-2 z-50 bg-destructive text-destructive-foreground text-[10px] font-mono px-2 py-1 rounded shadow-lg">
          PREVIEW · {asset?.asset_name || assetCode}
        </div>
      )}

      {/* Top bar */}
      <header
        className="sticky top-0 z-20 backdrop-blur-xl"
        style={{
          background: "rgba(20,33,61,0.72)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 20px -8px rgba(0,0,0,0.4)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 grid grid-cols-3 items-center gap-4">
          {/* LEFT — Current course name (contextual, replaces brand logo) */}
          <div className="flex items-center justify-start min-w-0">
            <Link
              to="/my-dashboard"
              className="group inline-flex items-center min-w-0 max-w-full"
              data-embed-allow="true"
              aria-label={courseLabel ? `${courseLabel} — back to dashboard` : "Back to dashboard"}
              title={courseLabel || "Back to dashboard"}
            >
              <span
                className="truncate text-[13px] sm:text-sm font-semibold tracking-tight transition-colors group-hover:text-white"
                style={{ color: "rgba(255,255,255,0.88)" }}
              >
                {courseLabel || "Survive Accounting"}
              </span>
            </Link>
          </div>

          {/* CENTER — Switch Problem (primary nav) */}
          <div className="flex items-center justify-center min-w-0">
            <button
              type="button"
              onClick={() => setJumpOpen(true)}
              data-embed-allow="true"
              aria-label="Switch to a different problem"
              title={chapter ? `Ch ${chapter.chapter_number} · ${chapter.chapter_name}` : "Switch problem"}
              className="group inline-flex items-center gap-2 h-9 pl-2.5 pr-3.5 rounded-md text-sm font-semibold transition-colors hover:border-[#CE1126]/60 hover:bg-white/[0.07] max-w-full"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.95)",
              }}
            >
              <span
                className="inline-flex items-center justify-center h-5 w-5 rounded shrink-0"
                style={{ background: "rgba(206,17,38,0.2)", color: "#FF8A95" }}
              >
                <Menu className="h-3 w-3" />
              </span>
              <span className="leading-tight whitespace-nowrap">Switch Problem</span>
              {chapter && (
                <span
                  className="hidden md:inline text-[11px] font-medium truncate max-w-[160px] pl-0.5"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  · Ch {chapter.chapter_number}
                </span>
              )}
            </button>
          </div>

          {/* RIGHT — Share Feedback */}
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setFeedbackChooserOpen(true)}
              data-embed-allow="true"
              aria-label="Share feedback about this problem"
              className="group relative inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-semibold transition-all hover:brightness-110 hover:-translate-y-px"
              style={{
                background:
                  "linear-gradient(180deg, rgba(251,191,36,0.18) 0%, rgba(245,158,11,0.12) 100%)",
                border: "1px solid rgba(251,191,36,0.55)",
                color: "#FDE68A",
                boxShadow:
                  "0 0 0 1px rgba(251,191,36,0.08), 0 6px 18px -8px rgba(251,191,36,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <Sparkles className="h-3.5 w-3.5" style={{ color: "#FCD34D" }} />
              <span className="hidden sm:inline">Share Feedback</span>
            </button>
          </div>
        </div>
      </header>

      <main
        className="relative max-w-6xl mx-auto px-4 pt-6 pb-32"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 40% at 30% 15%, rgba(99,52,180,0.035) 0%, transparent 65%), radial-gradient(ellipse 50% 35% at 75% 60%, rgba(80,130,255,0.03) 0%, transparent 70%)",
        }}>
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
          <>
            {/* Mobile Problem/Helper toggle removed for cleaner UI */}

            {/* Desktop: floating view-mode toolbar */}
            <div className="hidden md:flex justify-end mb-3">
              <TooltipProvider delayDuration={200}>
                <div
                  className="inline-flex items-center gap-0.5 rounded-md p-0.5"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                  role="toolbar"
                  aria-label="View mode"
                >
                  {([
                    { mode: "problem" as const, Icon: PanelLeftClose, label: "Problem only", hint: "[" },
                    { mode: "split" as const,   Icon: Columns2,        label: "Split view",   hint: "\\" },
                    { mode: "split-h" as const, Icon: Rows2,           label: "Stacked view", hint: "-" },
                    { mode: "helper" as const,  Icon: PanelRightClose, label: "Helper only",  hint: "]" },
                  ]).map(({ mode, Icon, label, hint }) => {
                    const active = viewMode === mode;
                    return (
                      <Tooltip key={mode}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setViewMode(mode)}
                            aria-label={label}
                            aria-pressed={active}
                            className="h-8 w-8 rounded inline-flex items-center justify-center transition-colors"
                            style={{
                              background: active ? "#14213D" : "transparent",
                              color: active ? "#fff" : "rgba(255,255,255,0.55)",
                              boxShadow: active ? "0 0 0 1px rgba(255,255,255,0.06) inset" : "none",
                            }}
                            onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={6} className="text-xs">
                          {label} <span className="opacity-50 ml-1">{hint}</span>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  <div className="w-px h-5 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          setSplitRatio(0.5);
                          try { sessionStorage.setItem("sa.viewer.splitRatio", "0.5"); } catch { /* ignore */ }
                          setViewMode("split");
                        }}
                        disabled={viewMode !== "split"}
                        aria-label="Reset split to 50/50"
                        className="h-8 w-8 rounded inline-flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ color: "rgba(255,255,255,0.55)" }}
                        onMouseEnter={(e) => { if (viewMode === "split") e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6} className="text-xs">Reset split (double-click divider)</TooltipContent>
                  </Tooltip>

                  {/* Open in full screen — escapes embedded iframe constraints */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          const url = window.location.pathname + window.location.search;
                          if (window.top && window.top !== window.self) {
                            window.open(url, "_blank", "noopener,noreferrer");
                          } else {
                            window.open(url, "_blank", "noopener,noreferrer");
                          }
                        }}
                        aria-label="Open in full screen"
                        className="h-8 w-8 rounded inline-flex items-center justify-center transition-colors"
                        style={{ color: "rgba(255,255,255,0.55)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6} className="text-xs">Open in full screen</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>

            <div
              ref={splitContainerRef}
              className={`flex ${viewMode === "split-h" ? "flex-col gap-6" : "flex-col md:flex-row md:items-stretch gap-6 md:gap-0"} relative`}
            >
            {/* LEFT (or TOP in split-h): Problem + What you need to solve */}
            <div
              className="space-y-4 min-w-0"
              style={
                isMobileViewport
                  ? { display: mobileTab === "problem" ? "block" : "none", width: "100%" }
                  : viewMode === "split-h"
                  ? { display: "block", width: "100%" }
                  : {
                      display: viewMode === "helper" ? "none" : "block",
                      flexBasis: viewMode === "problem" ? "100%" : `${splitRatio * 100}%`,
                      flexShrink: 0,
                      minWidth: viewMode === "problem" ? undefined : 320,
                      paddingRight: viewMode === "split" ? 12 : 0,
                    }
              }
            >
              {/* Card 1: Problem */}
              <section
                className="rounded-[10px] p-8"
                style={{
                  background: "#1A2B5C",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow:
                    "0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 28px -16px rgba(0,0,0,0.55)",
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                {/* Course label removed — already shown in header (left of "Switch Problem") */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {/* Chapter pill removed — already shown in header "Switch Problem · Ch N" */}
                  {asset.source_ref && (
                    <button
                      type="button"
                      onClick={() => {
                        if (originalImages.length > 0) setOriginalOpen(true);
                      }}
                      disabled={originalImages.length === 0}
                      title={
                        originalImages.length === 0
                          ? "Original textbook image not available"
                          : "View the original textbook problem"
                      }
                      className="group inline-flex items-center gap-1.5 -ml-1 px-1 py-0.5 rounded-md transition-colors hover:bg-white/5 disabled:hover:bg-transparent disabled:cursor-default"
                    >
                      <span
                        className="text-[11px] font-medium uppercase tracking-[0.12em]"
                        style={{ color: "rgba(255,255,255,0.55)" }}
                      >
                        Example based on{" "}
                        <span className="font-mono normal-case tracking-normal text-white/85">
                          {asset.source_ref}
                        </span>
                      </span>
                      {originalImages.length > 0 && (
                        <Search
                          className="h-3 w-3 transition-colors"
                          style={{ color: "rgba(255,255,255,0.4)" }}
                        />
                      )}
                    </button>
                  )}
                </div>

                {/* Problem section — with reading controls (Show/Hide + One at a time / All at once) */}
                {asset.survive_problem_text && (
                  <div className="mt-4">
                    {/* Compact reading control bar */}
                    <div
                      className="flex flex-wrap items-center gap-2 mb-3 text-[11px] font-medium"
                      style={{ color: "rgba(255,255,255,0.55)" }}
                    >
                      <button
                        type="button"
                        onClick={() => setProblemBodyOpen((v) => !v)}
                        className="inline-flex items-center gap-1 h-6 px-1.5 rounded transition-colors hover:text-white hover:bg-white/5"
                        aria-expanded={problemBodyOpen}
                      >
                        {problemBodyOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {problemBodyOpen ? "Hide instructions" : "Show instructions"}
                      </button>

                      {problemBodyOpen && problemChunks.length > 1 && (
                        <>
                          <span className="text-white/15">·</span>
                          <span className="uppercase tracking-[0.1em] text-[10px] text-white/40">Reading</span>
                          <div
                            className="inline-flex items-center rounded-md p-0.5"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                            role="tablist"
                            aria-label="Reading mode"
                          >
                            {([
                              { id: "chunks", label: "One at a time" },
                              { id: "all", label: "All at once" },
                            ] as const).map((opt) => {
                              const active = readingMode === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  role="tab"
                                  aria-selected={active}
                                  onClick={() => {
                                    setReadingMode(opt.id);
                                    if (opt.id === "chunks") setChunkIndex(0);
                                  }}
                                  className="h-6 px-2 rounded text-[11px] font-medium transition-colors"
                                  style={{
                                    background: active ? "rgba(206,17,38,0.18)" : "transparent",
                                    color: active ? "#FFD3D8" : "rgba(255,255,255,0.6)",
                                    border: active ? "1px solid rgba(206,17,38,0.4)" : "1px solid transparent",
                                  }}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>

                    {problemBodyOpen && (
                      <>
                        {readingMode === "all" || problemChunks.length <= 1 ? (
                          <div
                            className="text-[15px] max-w-[68ch] space-y-3 [&_p]:whitespace-pre-wrap [&_p]:text-[15px] [&_*]:!text-white/95 [&_strong]:!text-white [&_th]:!text-white [&_td]:!text-white/90 [&_.font-semibold]:!text-amber-300"
                            style={{ color: "rgba(255,255,255,0.95)", lineHeight: 1.7 }}
                          >
                            <SmartTextRenderer text={toYouPerspective(asset.survive_problem_text)} />
                          </div>
                        ) : (
                          <div className="max-w-[68ch]">
                            {/* Show chunks 0..chunkIndex stacked, with the active one labeled */}
                            <div className="space-y-5">
                              {problemChunks.slice(0, chunkIndex + 1).map((c, i) => {
                                const isActive = i === chunkIndex;
                                return (
                                  <div
                                    key={i}
                                    className="rounded-md transition-opacity"
                                    style={{
                                      opacity: isActive ? 1 : 0.7,
                                    }}
                                  >
                                    <div
                                      className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-1.5"
                                      style={{ color: isActive ? "#FFB8C0" : "rgba(255,255,255,0.4)" }}
                                    >
                                      {c.label}
                                      <span className="ml-2 text-white/30 normal-case tracking-normal">
                                        {i + 1} of {problemChunks.length}
                                      </span>
                                    </div>
                                    <div
                                      className="text-[15px] space-y-3 [&_p]:whitespace-pre-wrap [&_p]:text-[15px] [&_*]:!text-white/95 [&_strong]:!text-white [&_th]:!text-white [&_td]:!text-white/90 [&_.font-semibold]:!text-amber-300"
                                      style={{ color: "rgba(255,255,255,0.95)", lineHeight: 1.7 }}
                                    >
                                      <SmartTextRenderer text={c.text} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Next / Show all */}
                            <div className="mt-4 flex items-center gap-3">
                              {chunkIndex < problemChunks.length - 1 ? (
                                <button
                                  type="button"
                                  onClick={() => setChunkIndex((i) => Math.min(i + 1, problemChunks.length - 1))}
                                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-semibold transition-colors hover:brightness-110"
                                  style={{
                                    background: "rgba(206,17,38,0.16)",
                                    border: "1px solid rgba(206,17,38,0.45)",
                                    color: "#FFD3D8",
                                  }}
                                >
                                  Next
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </button>
                              ) : (
                                <span className="text-[11px] text-white/40">All sections shown</span>
                              )}
                              {chunkIndex > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setChunkIndex(0)}
                                  className="text-[11px] font-medium text-white/50 hover:text-white/80 transition-colors"
                                >
                                  Restart
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Your Tasks — open by default */}
                {instructions.length > 0 && (
                  <div
                    className="mt-6 pt-5 border-t"
                    style={{ borderColor: "rgba(255,255,255,0.08)" }}
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div
                        className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{ color: "rgba(255,255,255,0.55)" }}
                      >
                        Your Tasks
                      </div>
                      <button
                        type="button"
                        onClick={() => setInstructionsOpen((v) => !v)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium transition-colors hover:text-white"
                        style={{ color: "rgba(255,255,255,0.55)" }}
                      >
                        {instructionsOpen ? (
                          <>
                            <ChevronUp className="h-3 w-3" />
                            Hide
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3" />
                            Show
                          </>
                        )}
                      </button>
                    </div>
                    {instructionsOpen && (
                      <>
                        <ul
                          className="space-y-1.5 text-[13px] animate-in fade-in slide-in-from-top-1 duration-150"
                          style={{ lineHeight: 1.55 }}
                        >
                          {instructions.map((ins, i) => {
                            const checked = !!checkedTasks[i];
                            const isCurrent = !checked && i === currentTaskIndex;
                            return (
                              <li
                                key={i}
                                className="flex gap-2.5 items-start rounded-md transition-all"
                                style={{
                                  padding: "8px 10px",
                                  marginLeft: "-10px",
                                  marginRight: "-10px",
                                  background: isCurrent ? "rgba(250,204,21,0.08)" : "transparent",
                                  borderLeft: isCurrent
                                    ? "2px solid #FACC15"
                                    : "2px solid transparent",
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleTask(i)}
                                  aria-pressed={checked}
                                  aria-label={`Mark task ${String.fromCharCode(97 + i).toUpperCase()} as ${checked ? "incomplete" : "complete"}`}
                                  className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border text-[10px] font-bold transition-all hover:scale-105"
                                  style={{
                                    borderColor: checked
                                      ? "#CE1126"
                                      : isCurrent
                                        ? "rgba(250,204,21,0.7)"
                                        : "rgba(255,255,255,0.35)",
                                    background: checked
                                      ? "#CE1126"
                                      : isCurrent
                                        ? "rgba(250,204,21,0.12)"
                                        : "rgba(255,255,255,0.04)",
                                    color: checked
                                      ? "#fff"
                                      : isCurrent
                                        ? "#FACC15"
                                        : "rgba(255,255,255,0.7)",
                                  }}
                                >
                                  {checked ? (
                                    <Check className="h-3 w-3" />
                                  ) : (
                                    String.fromCharCode(97 + i).toUpperCase()
                                  )}
                                </button>
                                <span
                                  className="whitespace-pre-wrap flex-1 cursor-pointer transition-all"
                                  onClick={() => toggleTask(i)}
                                  style={{
                                    color: checked
                                      ? "rgba(255,255,255,0.4)"
                                      : isCurrent
                                        ? "#FFF8DC"
                                        : "rgba(255,255,255,0.92)",
                                    textDecoration: checked ? "line-through" : "none",
                                    fontWeight: isCurrent ? 500 : 400,
                                  }}
                                >
                                  {highlightTerms(toYouPerspective(ins))}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                        {(anyChecked || allTasksDone) && (
                          <div className="mt-3 flex items-center justify-between gap-3">
                            {allTasksDone ? (
                              <div
                                className="text-[12px] flex items-center gap-1.5"
                                style={{ color: "#FACC15" }}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Nice — all parts done. Hit <span className="font-semibold">Walk me through it</span> to compare.
                              </div>
                            ) : (
                              <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                                {checkedTasks.filter(Boolean).length} of {instructions.length} done
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={resetTasks}
                              className="text-[11px] underline-offset-2 hover:underline transition-colors"
                              style={{ color: "rgba(255,255,255,0.45)" }}
                            >
                              Reset
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </section>

            </div>

            {/* Draggable divider — desktop split mode only */}
            {!isMobileViewport && viewMode === "split" && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize panels (double-click to reset)"
                tabIndex={0}
                onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); }}
                onTouchStart={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDoubleClick={() => {
                  setSplitRatio(0.5);
                  try { sessionStorage.setItem("sa.viewer.splitRatio", "0.5"); } catch { /* ignore */ }
                }}
                className="hidden lg:flex items-center justify-center group relative shrink-0"
                style={{ width: 12, cursor: "col-resize", marginLeft: -6, marginRight: -6 }}
              >
                <div
                  className="h-full w-px transition-colors"
                  style={{ background: isDragging ? "rgba(206,17,38,0.6)" : "rgba(255,255,255,0.08)" }}
                />
                <div
                  className="absolute inline-flex items-center justify-center rounded-md transition-all"
                  style={{
                    width: 22, height: 36,
                    background: isDragging ? "rgba(206,17,38,0.18)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${isDragging ? "rgba(206,17,38,0.5)" : "rgba(255,255,255,0.1)"}`,
                    color: isDragging ? "#FFB8C0" : "rgba(255,255,255,0.5)",
                  }}
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </div>
              </div>
            )}

            {/* RIGHT (or BOTTOM in split-h): Get unstuck fast toolbox */}
            <div
              className="min-w-0"
              style={
                isMobileViewport
                  ? { display: mobileTab === "helper" ? "block" : "none", width: "100%" }
                  : viewMode === "split-h"
                  ? { display: "block", width: "100%" }
                  : {
                      display: viewMode === "problem" ? "none" : "block",
                      flexBasis: viewMode === "helper" ? "100%" : `${(1 - splitRatio) * 100}%`,
                      flexShrink: 0,
                      minWidth: viewMode === "helper" ? undefined : 320,
                      paddingLeft: viewMode === "split" ? 12 : 0,
                      position: viewMode === "split" ? "sticky" : "static",
                      top: viewMode === "split" ? 80 : undefined,
                      alignSelf: viewMode === "split" ? "flex-start" : undefined,
                    }
              }
            >
              <InlineExplanation
                asset={asset}
                chapter={chapter}
                simplifiedText={simplifiedText}
                setSimplifiedText={setSimplifiedText}
                onShareClick={openShareModal}
                onAdvanceTask={markTaskDone}
                onActiveHelperChange={setActiveHelper}
              />
              <SurviveExplorePanel
                assetId={asset.id}
                assetCode={asset.asset_name}
                problemText={asset.survive_problem_text}
                instructions={getInstructions(asset).join("\n")}
                chapterName={chapter ? `Ch ${chapter.chapter_number}: ${chapter.chapter_name}` : ""}
                courseName={courseLabel}
              />
            </div>
            </div>
          </>
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

            <button
              type="button"
              disabled={!next}
              onClick={() => next && navigate(`/v2/solutions/${next.asset_name}`)}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 h-9 text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.99] disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(180deg, #E63950 0%, #CE1126 50%, #A30E1F 100%)",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 16px -6px rgba(206,17,38,0.5), 0 2px 4px rgba(0,0,0,0.2)",
              }}
            >
              {next?.source_ref && <span className="font-mono text-xs hidden md:inline opacity-90">{next.source_ref}</span>}
              <span className="hidden sm:inline">Next</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </nav>
      )}

      {/* Floating help button */}
      {!loading && asset && !isEmbed && (
        <button
          onClick={() => setFeedbackChooserOpen(true)}
          className={cn(
            "fixed right-4 bottom-20 z-30 rounded-full shadow-md backdrop-blur",
            "bg-card/80 border hover:bg-accent transition-colors",
            "h-9 px-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium",
          )}
          aria-label="Share feedback about this problem"
        >
          <MessageCircleQuestion className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Share Feedback</span>
        </button>
      )}

      <StuckSupportModal
        open={helpOpen}
        onOpenChange={setHelpOpen}
        asset={asset}
        chapter={chapter}
        courseLabel={courseLabel}
        viewMode={viewMode}
        simplifiedText={simplifiedText}
        activeHelper={activeHelper}
      />
      <MagicWandFeedback onTriggerShare={openShareModal} />
      <ReportIssueModal open={reportOpen} onOpenChange={setReportOpen} asset={asset} />
      <NavigatePanel
        open={jumpOpen}
        onOpenChange={setJumpOpen}
        courseId={chapter?.course_id}
        currentChapterId={chapter?.id}
        currentAssetName={asset?.asset_name}
        courseLabel={courseLabel}
      />

      {/* Blocking modal while we generate the practice version on first open */}
      <Dialog
        open={!!asset && simplifyLoading && !simplifiedText && !simplifyError}
        // Non-dismissable: no onOpenChange, no close X is rendered because we don't allow it to close
      >
        <DialogContent
          className="sm:max-w-sm"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          // Hide the default close button while generating
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-base">Getting this problem ready…</DialogTitle>
            <DialogDescription>
              We're putting together a clean, scannable version. Just a sec.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={originalOpen} onOpenChange={setOriginalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Original textbook problem</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto -mr-1 pr-1 space-y-3">
            {originalLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 animate-fade-in">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <div className="text-xs text-muted-foreground">Loading textbook problem…</div>
              </div>
            ) : originalImages.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Original textbook image isn't available for this problem yet.
              </div>
            ) : (
              originalImages.map((url, i) => {
                const loaded = !!originalImagesLoaded[i];
                return (
                  <div key={i} className="relative">
                    {!loaded && (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted/30 rounded-md min-h-[200px]">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    <img
                      src={url}
                      alt={`Original textbook problem${originalImages.length > 1 ? ` (page ${i + 1})` : ""}`}
                      className={`w-full h-auto rounded-md border border-border bg-white transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
                      onLoad={() => setOriginalImagesLoaded((s) => ({ ...s, [i]: true }))}
                      onError={() => setOriginalImagesLoaded((s) => ({ ...s, [i]: true }))}
                    />
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        onCopy={() => trackShareEvent("copy_link")}
      />

      <ViewerOnboardingModal
        assetCode={assetCode ?? null}
        userId={currentUserId}
        userEmail={currentUserEmail}
      />
    </div>
  );
}
