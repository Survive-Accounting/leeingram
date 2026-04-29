import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, ArrowRight, ChevronLeft, MessageCircleQuestion, Sparkles, Loader2, AlertTriangle, Menu, Wand2, Printer, BookOpen, Share2, Copy, Check, Search, ChevronDown, ChevronUp, Sheet as SheetIcon, PanelLeftClose, PanelRightClose, Columns2, Rows2, RotateCcw, GripVertical, GripHorizontal, Maximize2, ThumbsUp, ThumbsDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { z } from "zod";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { StructuredJEDisplay } from "@/components/StructuredJEDisplay";
import SmartTextRenderer from "@/components/SmartTextRenderer";
import { generateSimplifiedPracticePdf } from "@/lib/generateSimplifiedPracticePdf";
import ReactMarkdown from "react-markdown";

import FeatureIdeasVoting from "@/components/v2/FeatureIdeasVoting";
import DOMPurify from "isomorphic-dompurify";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buildShareUrl, captureRefFromUrl, logShareClick, attachReferrerOnConversion } from "@/lib/referralTracking";
import { toYouPerspective } from "@/utils/youPerspective";
import leeHeadshotImg from "@/assets/lee-headshot-original.png";
import { ViewerOnboardingModal } from "@/pages/v2/ViewerOnboardingModal";
import { RetroBreadcrumbs } from "@/components/study-previewer/RetroBreadcrumbs";
import { BrandedLoader } from "@/components/study-previewer/BrandedLoader";
import { FileText, Brain, Eye, ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

/**
 * Detects and strips a leading instruction marker so we don't render it
 * twice (the UI provides its own letter/number badge).
 *
 * Handles common variants used across our content:
 *   "(a) ..."   "(A) ..."   "a. ..."   "a) ..."   "A) ..."
 *   "1. ..."    "1) ..."    "#1 ..."   "#1. ..."
 *
 * Returns the cleaned text plus the detected prefix style ("letter" |
 * "number" | "none") so the caller can pick a consistent badge style.
 */
function parseInstructionPrefix(raw: string): {
  text: string;
  kind: "letter" | "number" | "none";
  marker: string | null;
} {
  const trimmed = raw.trim();
  // (a)  (A)
  let m = trimmed.match(/^\(\s*([a-zA-Z])\s*\)\s*[.:)\-]?\s*/);
  if (m) return { text: trimmed.slice(m[0].length), kind: "letter", marker: m[1].toUpperCase() };
  // a.   a)   A.
  m = trimmed.match(/^([a-zA-Z])\s*[.)]\s+/);
  if (m) return { text: trimmed.slice(m[0].length), kind: "letter", marker: m[1].toUpperCase() };
  // #1   #1.   #1)
  m = trimmed.match(/^#\s*(\d+)\s*[.)]?\s+/);
  if (m) return { text: trimmed.slice(m[0].length), kind: "number", marker: m[1] };
  // 1.   1)
  m = trimmed.match(/^(\d+)\s*[.)]\s+/);
  if (m) return { text: trimmed.slice(m[0].length), kind: "number", marker: m[1] };
  return { text: trimmed, kind: "none", marker: null };
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

// ── Share Feedback chooser modal ───────────────────────────────────────
// Lightweight two-card chooser shown when the student clicks "Share
// Feedback". Routes them to either the existing issue-report flow or to
// the "Vote on new ideas" section of the right panel.
function FeedbackChooserModal({
  open,
  onOpenChange,
  onReportIssue,
  onSuggestFeature,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onReportIssue: () => void;
  onSuggestFeature: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share feedback</DialogTitle>
          <DialogDescription>
            What would you like to share with us?
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 pt-1">
          <button
            type="button"
            onClick={onReportIssue}
            className="group text-left rounded-xl border p-4 transition-all hover:-translate-y-px hover:shadow-md hover:border-[#CE1126]/50 focus:outline-none focus:ring-2 focus:ring-[#CE1126]/40"
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                style={{
                  background: "rgba(206,17,38,0.10)",
                  border: "1px solid rgba(206,17,38,0.35)",
                  color: "#FCA5A5",
                }}
              >
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold leading-tight">Report an issue</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Something is confusing, incorrect, unclear, or not working.
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onSuggestFeature}
            className="group text-left rounded-xl border p-4 transition-all hover:-translate-y-px hover:shadow-md hover:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                style={{
                  background: "rgba(251,191,36,0.12)",
                  border: "1px solid rgba(251,191,36,0.45)",
                  color: "#FCD34D",
                }}
              >
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold leading-tight">Suggest a new feature</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Vote on or suggest tools and features that would make this better.
                </div>
              </div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Feature ideas voting modal ─────────────────────────────────────────
// Hosts the SHARED `FeatureIdeasVoting` component (also rendered inline by
// SurviveExplorePanel). Opened from the "Suggest a new feature" card in
// the Share Feedback chooser. Same component, same vote counts, same
// "Suggest your own idea" flow — no duplicated voting system.
function FeatureIdeasModal({
  open,
  onOpenChange,
  asset,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset: Asset | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" style={{ color: "#FCD34D" }} />
            Suggest a new feature
          </DialogTitle>
          <DialogDescription className="text-xs">
            Help us decide what to build next. Tap an idea to see what it would do, then vote — or suggest your own.
          </DialogDescription>
        </DialogHeader>

        <div className="pt-1">
          {asset ? (
            <FeatureIdeasVoting
              assetId={asset.id}
              assetCode={asset.asset_name}
              showHeader={false}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Loading…</p>
          )}
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
  // Auto-captured user_id (best effort — null if not signed in).
  const [userId, setUserId] = useState<string | null>(null);

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
    // Best-effort capture of authenticated user id for the report context.
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setUserId(data.user?.id ?? null);
      } catch {
        setUserId(null);
      }
    })();
  }, [open]);

  const buildContextBlock = (): string => {
    const lines: string[] = [
      "---",
      "Context (auto-captured):",
      `- User: ${userId || "anonymous"}`,
      `- Issue type: ${issueType}`,
      `- Course: ${courseLabel || "—"}`,
      chapter ? `- Chapter: Ch ${chapter.chapter_number} · ${chapter.chapter_name}` : "- Chapter: —",
      asset ? `- Problem: ${asset.asset_name}${asset.source_ref ? ` (ref ${asset.source_ref})` : ""}` : "- Problem: —",
      asset ? `- Problem ID: ${asset.id}` : "- Problem ID: —",
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base">Report an issue</DialogTitle>
          <DialogDescription className="text-xs">
            Takes ~30 seconds. We'll review and reply by email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <RadioGroup
            value={issueType}
            onValueChange={(v) => setIssueType(v as StuckIssueType)}
            className="space-y-1.5"
          >
            {STUCK_OPTIONS.map((opt) => {
              const selected = issueType === opt.value;
              return (
                <label
                  key={opt.value}
                  htmlFor={`stuck-${opt.value}`}
                  className={cn(
                    "flex items-start gap-2.5 rounded-md border p-2.5 cursor-pointer transition-all",
                    selected
                      ? "border-[#CE1126]/60 bg-[#CE1126]/5"
                      : "border-border hover:bg-accent/50",
                  )}
                >
                  <RadioGroupItem id={`stuck-${opt.value}`} value={opt.value} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold leading-tight">{opt.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{opt.description}</div>
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
                className="mt-1 h-9"
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
              rows={3}
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
            className="w-full h-9"
          >
            {submitting ? "Sending…" : "Send report"}
          </Button>
          <p className="text-[11px] text-center text-muted-foreground -mt-1">
            We'll review and reply by email.
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

// ── Lightweight thumbs feedback for a single helper response ─────────
// Lives at the bottom-right of the helper response window. Subtle by
// default, expands to a thin row of reason chips on a thumbs-down so
// students can optionally tell us why — but the click alone is already
// saved, so chip selection is never required.
type ThumbsReason =
  | "confusing"
  | "incorrect"
  | "too_long"
  | "too_short"
  | "didnt_answer"
  | "other";

const THUMBS_REASONS: { value: ThumbsReason; label: string }[] = [
  { value: "confusing", label: "Confusing" },
  { value: "incorrect", label: "Incorrect" },
  { value: "too_long", label: "Too long" },
  { value: "too_short", label: "Too short" },
  { value: "didnt_answer", label: "Didn't answer my question" },
  { value: "other", label: "Other" },
];

function HelperResponseThumbs({
  asset,
  chapter,
  section,
}: {
  asset: Asset;
  chapter: ChapterMeta | null;
  section: ToolboxKey;
}) {
  // Reset when the user switches to a different helper section so each
  // response gets its own clean thumb state.
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const [reasonSent, setReasonSent] = useState(false);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setVote(null);
    setReasonsOpen(false);
    setReasonSent(false);
    setFeedbackId(null);
  }, [section, asset.asset_name]);

  const buildContext = async () => {
    let userId: string | null = null;
    try {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    } catch {}
    let email: string | null = null;
    try {
      email =
        localStorage.getItem("v2_student_email") ||
        localStorage.getItem("sa_free_user_email") ||
        null;
    } catch {}
    return {
      email,
      context: {
        user_id: userId,
        problem_id: asset.id,
        asset_name: asset.asset_name,
        source_ref: asset.source_ref ?? null,
        chapter_number: chapter?.chapter_number ?? null,
        chapter_name: chapter?.chapter_name ?? null,
        course_name: chapter?.course?.course_name ?? null,
        page_url: typeof window !== "undefined" ? window.location.href : null,
      },
    };
  };

  const cast = async (helpful: boolean) => {
    if (vote || submitting) return;
    setSubmitting(true);
    try {
      const { email, context } = await buildContext();
      const { data, error } = await supabase
        .from("explanation_feedback")
        .insert({
          asset_id: asset.id,
          asset_name: asset.asset_name,
          user_email: email,
          helpful,
          section,
          context,
        })
        .select("id")
        .single();
      if (error) throw error;
      setFeedbackId(data?.id ?? null);
      setVote(helpful ? "up" : "down");

      // Dual-write to dedicated student-beta feedback table (new). Non-blocking.
      try {
        let userId: string | null = null;
        try {
          const { data: u } = await supabase.auth.getUser();
          userId = u.user?.id ?? null;
        } catch {}
        await (supabase as any).from("student_helper_feedback").insert({
          asset_id: asset.id,
          chapter_id: chapter?.id ?? null,
          course_id: (chapter as any)?.course_id ?? null,
          tool_type: "survive_this",
          action_type: section,
          rating: helpful ? 1 : -1,
          user_id: userId,
          email,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
        });
      } catch { /* non-blocking */ }

      if (!helpful) setReasonsOpen(true);
      else toast.success("Thanks for the feedback.");
    } catch {
      toast.error("Couldn't save that — try again?");
    } finally {
      setSubmitting(false);
    }
  };

  const sendReason = async (value: ThumbsReason) => {
    if (reasonSent || !feedbackId) return;
    setReasonSent(true);
    try {
      await supabase
        .from("explanation_feedback")
        .update({ reason: [value] })
        .eq("id", feedbackId);
      toast.success("Thanks for the feedback.");
      setReasonsOpen(false);
    } catch {
      // Silent — the original thumb is already saved, so we don't want
      // to pester the student with a retry toast.
      setReasonSent(false);
    }
  };

  // Confirmed view — quiet acknowledgment, no action.
  if (vote && !reasonsOpen) {
    return (
      <div
        className="flex items-center justify-end gap-1.5 text-[11px]"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        <Check className="h-3 w-3" />
        Thanks for the feedback.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <span
          className="text-[11px] font-medium"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          Was this helpful?
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => cast(true)}
            disabled={!!vote || submitting}
            aria-label="Mark response as helpful"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/10 disabled:opacity-50 disabled:cursor-default"
            style={{
              background: vote === "up" ? "rgba(34,197,94,0.18)" : "transparent",
              border: vote === "up"
                ? "1px solid rgba(34,197,94,0.5)"
                : "1px solid rgba(255,255,255,0.10)",
              color: vote === "up" ? "#86EFAC" : "rgba(255,255,255,0.7)",
            }}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => cast(false)}
            disabled={!!vote || submitting}
            aria-label="Mark response as not helpful"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/10 disabled:opacity-50 disabled:cursor-default"
            style={{
              background: vote === "down" ? "rgba(206,17,38,0.18)" : "transparent",
              border: vote === "down"
                ? "1px solid rgba(206,17,38,0.5)"
                : "1px solid rgba(255,255,255,0.10)",
              color: vote === "down" ? "#FFD3D8" : "rgba(255,255,255,0.7)",
            }}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Reason chips — only after thumbs-down. Optional; clicking
          isn't required because the thumb itself is already saved. */}
      {reasonsOpen && (
        <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-[320px] animate-fade-in">
          <span
            className="text-[10px] font-medium uppercase tracking-[0.1em] mr-1"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            Why?
          </span>
          {THUMBS_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => sendReason(r.value)}
              disabled={reasonSent}
              className="inline-flex items-center h-6 px-2 rounded-full text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-default"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.8)",
              }}
            >
              {r.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setReasonsOpen(false)}
            className="text-[10px] underline-offset-2 hover:underline ml-1"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}


// ── Lightweight feedback for the problem text + instructions ─────────
// Lives at the bottom of the left problem card. Subtle by default;
// expands to a thin row of optional reason chips on a thumbs-down. The
// thumb click itself is already saved, so chips are never required.
type ClarityReason =
  | "too_long"
  | "confusing_wording"
  | "missing_info"
  | "formatting"
  | "wrong_problem"
  | "other";

const CLARITY_REASONS: { value: ClarityReason; label: string }[] = [
  { value: "too_long", label: "Too long" },
  { value: "confusing_wording", label: "Confusing wording" },
  { value: "missing_info", label: "Missing info" },
  { value: "formatting", label: "Formatting issue" },
  { value: "wrong_problem", label: "Wrong problem" },
  { value: "other", label: "Other" },
];

function ProblemClarityFeedback({
  asset,
  chapter,
  viewMode,
  instructionsOpen,
}: {
  asset: Asset;
  chapter: ChapterMeta | null;
  viewMode: "split" | "split-h" | "problem" | "helper";
  instructionsOpen: boolean;
}) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const [reasonSent, setReasonSent] = useState(false);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setVote(null);
    setReasonsOpen(false);
    setReasonSent(false);
    setFeedbackId(null);
  }, [asset.asset_name]);

  const cast = async (helpful: boolean) => {
    if (vote || submitting) return;
    setSubmitting(true);
    try {
      let userId: string | null = null;
      try {
        const { data } = await supabase.auth.getUser();
        userId = data.user?.id ?? null;
      } catch {}
      let email: string | null = null;
      try {
        email =
          localStorage.getItem("v2_student_email") ||
          localStorage.getItem("sa_free_user_email") ||
          null;
      } catch {}
      const { data, error } = await supabase
        .from("explanation_feedback")
        .insert({
          asset_id: asset.id,
          asset_name: asset.asset_name,
          user_email: email,
          helpful,
          section: "problem_clarity",
          context: {
            user_id: userId,
            problem_id: asset.id,
            asset_name: asset.asset_name,
            source_ref: asset.source_ref ?? null,
            chapter_number: chapter?.chapter_number ?? null,
            chapter_name: chapter?.chapter_name ?? null,
            course_name: chapter?.course?.course_name ?? null,
            reading_mode: viewMode,
            instructions_open: instructionsOpen,
            page_url: typeof window !== "undefined" ? window.location.href : null,
          },
        })
        .select("id")
        .single();
      if (error) throw error;
      setFeedbackId(data?.id ?? null);
      setVote(helpful ? "up" : "down");
      if (!helpful) setReasonsOpen(true);
      else toast.success("Thanks for the feedback.");
    } catch {
      toast.error("Couldn't save that — try again?");
    } finally {
      setSubmitting(false);
    }
  };

  const sendReason = async (value: ClarityReason) => {
    if (reasonSent || !feedbackId) return;
    setReasonSent(true);
    try {
      await supabase
        .from("explanation_feedback")
        .update({ reason: [value] })
        .eq("id", feedbackId);
      toast.success("Thanks for the feedback.");
      setReasonsOpen(false);
    } catch {
      setReasonSent(false);
    }
  };

  if (vote && !reasonsOpen) {
    return (
      <div
        className="mt-6 pt-4 border-t flex items-center justify-end gap-1.5 text-[11px]"
        style={{
          borderColor: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.4)",
        }}
      >
        <Check className="h-3 w-3" />
        Thanks for the feedback.
      </div>
    );
  }

  return (
    <div
      className="mt-6 pt-4 border-t flex flex-col items-end gap-2"
      style={{ borderColor: "rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-[11px] font-medium"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          Problem clear?
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => cast(true)}
            disabled={!!vote || submitting}
            aria-label="Mark problem text as clear"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/10 disabled:opacity-50 disabled:cursor-default"
            style={{
              background: vote === "up" ? "rgba(34,197,94,0.18)" : "transparent",
              border: vote === "up"
                ? "1px solid rgba(34,197,94,0.5)"
                : "1px solid rgba(255,255,255,0.10)",
              color: vote === "up" ? "#86EFAC" : "rgba(255,255,255,0.6)",
            }}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => cast(false)}
            disabled={!!vote || submitting}
            aria-label="Mark problem text as confusing"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/10 disabled:opacity-50 disabled:cursor-default"
            style={{
              background: vote === "down" ? "rgba(206,17,38,0.18)" : "transparent",
              border: vote === "down"
                ? "1px solid rgba(206,17,38,0.5)"
                : "1px solid rgba(255,255,255,0.10)",
              color: vote === "down" ? "#FFD3D8" : "rgba(255,255,255,0.6)",
            }}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {reasonsOpen && (
        <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-[340px] animate-fade-in">
          <span
            className="text-[10px] font-medium uppercase tracking-[0.1em] mr-1"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            Why?
          </span>
          {CLARITY_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => sendReason(r.value)}
              disabled={reasonSent}
              className="inline-flex items-center h-6 px-2 rounded-full text-[11px] font-medium transition-colors hover:bg-white/10 disabled:opacity-40 disabled:cursor-default"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.8)",
              }}
            >
              {r.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setReasonsOpen(false)}
            className="text-[10px] underline-offset-2 hover:underline ml-1"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}


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

// Toolbox keys map directly to `survive-this` edge function prompt types.
// Two are surfaced as primary CTAs; the rest live behind the "Try new beta
// tools" disclosure so the helper feels focused rather than overwhelming.
type ToolboxKey =
  | "walk_through"
  | "full_solution"
  | "hint"
  | "setup"
  | "challenge"
  | "similar_problem"
  | "memorize"
  | "journal_entries"
  | "real_world"
  | "professor_tricks"
  | "the_why";

const TOOLBOX_META: Record<ToolboxKey, { label: string; emoji: string; subtitle: string }> = {
  walk_through:     { label: "Walk me through it",            emoji: "🚀", subtitle: "Full step-by-step solution" },
  full_solution:    { label: "Full solution",                 emoji: "✅", subtitle: "Just the answer" },
  hint:             { label: "Give me a hint",                emoji: "💡", subtitle: "One nudge — no spoilers" },
  setup:            { label: "Show the setup",                emoji: "📄", subtitle: "Tables, formulas, structure" },
  challenge:        { label: "Challenge me",                  emoji: "🧠", subtitle: "A thinking question" },
  similar_problem:  { label: "Try a similar problem",         emoji: "🔁", subtitle: "Same structure, new numbers" },
  memorize:         { label: "What to memorize",              emoji: "📌", subtitle: "Cheat sheet for the exam" },
  journal_entries:  { label: "Journal entries breakdown",     emoji: "📒", subtitle: "Account-by-account walk" },
  real_world:       { label: "Real world example",            emoji: "🌎", subtitle: "Where this shows up in business" },
  professor_tricks: { label: "How your professor will trick you", emoji: "🎯", subtitle: "Common exam traps" },
  the_why:          { label: "The why behind it",             emoji: "🤔", subtitle: "Why this rule exists" },
};

// Order of buttons inside the "Try new beta tools" disclosure.
const BETA_TOOLBOX_KEYS: ToolboxKey[] = [
  "hint",
  "setup",
  "challenge",
  "similar_problem",
  "memorize",
  "journal_entries",
  "real_world",
  "professor_tricks",
  "the_why",
];

// Inline HTML detection + sanitizer — mirrors SurviveExplorePanel's renderer
// so survive-this responses with tables/lists render cleanly here too.
// Tutor response panel is on a dark navy background — table palette must
// be dark-native so headers and totals don't disappear into a light strip.
const INLINE_AI_HTML_STYLE = `<style>
.sa-inline-ai table { width:100%; border-collapse:collapse; font-size:13px; margin:10px 0 14px; }
.sa-inline-ai th { text-align:left; color:rgba(255,255,255,0.95); font-weight:600; border-bottom:1px solid rgba(255,255,255,0.18); padding:6px 10px; background:rgba(255,255,255,0.08); }
.sa-inline-ai td { padding:6px 10px; border-bottom:1px solid rgba(255,255,255,0.08); color:rgba(255,255,255,0.92); font-size:13px; }
.sa-inline-ai tr.total td { font-weight:700; border-top:1px solid rgba(255,255,255,0.25); border-bottom:none; background:rgba(255,255,255,0.06); color:#FFFFFF; }
.sa-inline-ai ul, .sa-inline-ai ol { margin:8px 0 12px 20px; padding:0; color:rgba(255,255,255,0.92); }
.sa-inline-ai li { margin:4px 0; line-height:1.55; }
.sa-inline-ai p { margin:8px 0; line-height:1.65; color:rgba(255,255,255,0.92); }
.sa-inline-ai strong { color:#FFFFFF; font-weight:700; }
.sa-inline-ai em { color:rgba(255,255,255,0.7); }
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
  const focusJE = searchParams.get("focus") === "je";

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

  // Auto-open the Journal Entries dialog when launched as the JE Helper
  // (?focus=je) — fires once per asset when JE data is available.
  useEffect(() => {
    if (focusJE && hasJE) {
      setJeOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusJE, hasJE, asset.asset_name]);

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

  // Hover-time prefetch for the secondary toolbox buttons. The first paint of
  // each section can take several seconds against the AI, so we kick off the
  // request as soon as the student's cursor lands on the button — by the time
  // they actually click, the response is usually already cached.
  const prefetchToolbox = (key: ToolboxKey) => {
    if (isEmbed || responses[key]) return;
    supabase.functions
      .invoke("survive-this", {
        body: { asset_id: asset.id, prompt_type: key, context: buildContext() },
      })
      .then(({ data, error }) => {
        if (error || !data?.success) return;
        const text = data.response_text || data.response || "";
        if (!text) return;
        setResponses((p) => (p[key] ? p : { ...p, [key]: text }));
      })
      .catch(() => { /* silent — click handler will surface real errors */ });
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
    <div
      className="rounded-lg border overflow-hidden flex flex-col"
      style={{
        background: "linear-gradient(180deg, #0F1A2E 0%, #0B1424 100%)",
        borderColor: "rgba(255,255,255,0.08)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.5)",
      }}
    >
      {/* ── Column micro-label — mirrors the "Example based on …" label on
          the left column so the two-column layout reads as one balanced
          workspace. */}
      <div
        className="px-4 pt-3 pb-2 flex items-center gap-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      >
        <span
          className="text-[11px] font-medium uppercase tracking-[0.12em]"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Guided Helper
        </span>
        <span
          className="text-[9px] font-semibold uppercase tracking-[0.18em] px-1.5 py-[1px] rounded-sm"
          style={{
            color: "rgba(206,17,38,0.95)",
            background: "rgba(206,17,38,0.12)",
            border: "1px solid rgba(206,17,38,0.35)",
          }}
        >
          Beta
        </span>
      </div>

      {/* ── Top control bar — action buttons live in a single header strip ── */}
      <div
        className="px-4 pt-4 pb-3 space-y-2.5 border-b"
        style={{
          borderColor: "rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.015)",
        }}
      >
        {/* Row 1 — Walk me through it (full width, brand red) */}
        <button
          type="button"
          onClick={() => handleToolboxClick("walk_through")}
          onMouseEnter={() => prefetchToolbox("walk_through")}
          onFocus={() => prefetchToolbox("walk_through")}
          className={cn(
            "w-full inline-flex items-center justify-center gap-2 rounded-md h-11 px-4 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.99]",
            activeSection === "walk_through" && "ring-1 ring-[#CE1126]/60",
          )}
          style={{
            background: "linear-gradient(180deg, #E63950 0%, #CE1126 50%, #A30E1F 100%)",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.18) inset, 0 4px 12px -6px rgba(206,17,38,0.45)",
          }}
        >
          <span aria-hidden>{TOOLBOX_META.walk_through.emoji}</span>
          {TOOLBOX_META.walk_through.label}
        </button>

        {/* Row 2 — Hint + Setup (two equal columns, dark ghost buttons) */}
        <div className="grid grid-cols-2 gap-2">
          {(["hint", "setup"] as ToolboxKey[]).map((k) => {
            const isActive = activeSection === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => handleToolboxClick(k)}
                onMouseEnter={() => prefetchToolbox(k)}
                onFocus={() => prefetchToolbox(k)}
                title={TOOLBOX_META[k].subtitle}
                className="inline-flex items-center justify-start gap-2 h-9 px-3 rounded-md text-xs sm:text-[13px] font-medium transition-colors"
                style={{
                  background: isActive ? "rgba(206,17,38,0.18)" : "rgba(255,255,255,0.04)",
                  border: isActive
                    ? "1px solid rgba(206,17,38,0.5)"
                    : "1px solid rgba(255,255,255,0.10)",
                  color: isActive ? "#FFD3D8" : "rgba(255,255,255,0.85)",
                }}
              >
                <span aria-hidden>{TOOLBOX_META[k].emoji}</span>
                {TOOLBOX_META[k].label}
              </button>
            );
          })}
        </div>

        {/* Row 3 — Full solution (full width, dark ghost) */}
        <button
          type="button"
          onClick={() => handleToolboxClick("full_solution")}
          onMouseEnter={() => prefetchToolbox("full_solution")}
          onFocus={() => prefetchToolbox("full_solution")}
          title={TOOLBOX_META.full_solution.subtitle}
          className="w-full inline-flex items-center justify-start gap-2 h-9 px-3 rounded-md text-xs sm:text-[13px] font-medium transition-colors"
          style={{
            background:
              activeSection === "full_solution" ? "rgba(206,17,38,0.18)" : "rgba(255,255,255,0.04)",
            border:
              activeSection === "full_solution"
                ? "1px solid rgba(206,17,38,0.5)"
                : "1px solid rgba(255,255,255,0.10)",
            color: activeSection === "full_solution" ? "#FFD3D8" : "rgba(255,255,255,0.85)",
          }}
        >
          <span aria-hidden>{TOOLBOX_META.full_solution.emoji}</span>
          {TOOLBOX_META.full_solution.label}
        </button>
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

      {/* ── Response window — chat-style output area ─────────────────── */}
      {/* Note: do NOT blanket-force [&_th] / [&_td] colors here — the inline
          AI HTML stylesheet handles table palette explicitly so totals,
          headers, and contrast all stay readable on the dark panel. */}
      <div
        className="relative px-4 py-4 flex-1 min-h-[200px] [&_p]:!text-white/95 [&_li]:!text-white/95 [&_strong]:!text-white"
        style={{
          color: "rgba(255,255,255,0.92)",
          background:
            "radial-gradient(120% 80% at 50% 0%, rgba(206,17,38,0.06) 0%, rgba(206,17,38,0) 55%), linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)",
          backgroundColor: "rgba(8,14,28,0.55)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(255,255,255,0.04) inset",
        }}
      >
        {/* Subtle dot-matrix workspace texture */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none rounded-[2px]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "14px 14px",
            backgroundPosition: "0 0",
            maskImage:
              "radial-gradient(120% 80% at 50% 30%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 70%, rgba(0,0,0,0) 100%)",
            WebkitMaskImage:
              "radial-gradient(120% 80% at 50% 30%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 70%, rgba(0,0,0,0) 100%)",
          }}
        />
        <div className="relative">
        {error && (
          <div
            className="mb-3 rounded-md p-3 text-sm"
            style={{
              background: "rgba(206,17,38,0.10)",
              border: "1px solid rgba(206,17,38,0.35)",
              color: "#FFD3D8",
            }}
          >
            {error}
          </div>
        )}

        {!activeSection && !error ? (
          // Empty state — minimal, "alive" with a blinking cursor so the
          // workspace feels ready rather than missing.
          <div
            className="flex flex-col items-center justify-center text-center py-10 gap-2"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            <Sparkles className="h-4 w-4" style={{ color: "rgba(206,17,38,0.7)" }} />
            <div className="text-[13px] font-medium tracking-wide flex items-center gap-1">
              <span>Help responses appear here</span>
              <span
                aria-hidden
                className="inline-block w-[7px] h-[14px] -mb-[2px] ml-0.5"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  animation: "sa-helper-blink 1s steps(2, start) infinite",
                }}
              />
            </div>
            <style>{`@keyframes sa-helper-blink { to { visibility: hidden; } }`}</style>
          </div>
        ) : activeSection ? (
          <section
            key={activeSection}
            className="animate-in fade-in slide-in-from-top-1 duration-200"
          >
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-3 flex items-center gap-1.5"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              <span aria-hidden>{TOOLBOX_META[activeSection].emoji}</span>
              {TOOLBOX_META[activeSection].label}
            </div>
            {loading && !responses[activeSection] ? (
              // Minimal "typing" indicator — three dots pulsing in
              // staggered rhythm. Calm, fast, no big spinner or copy.
              <div
                className="flex items-center gap-1.5 py-1"
                aria-label="Tutor is preparing a response"
                role="status"
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ background: "rgba(255,255,255,0.55)", animationDelay: "0ms", animationDuration: "1100ms" }}
                />
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ background: "rgba(255,255,255,0.55)", animationDelay: "180ms", animationDuration: "1100ms" }}
                />
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ background: "rgba(255,255,255,0.55)", animationDelay: "360ms", animationDuration: "1100ms" }}
                />
              </div>
            ) : responses[activeSection] ? (
              <div
                key={`${activeSection}-content`}
                className="animate-fade-in"
              >
                {activeSection === "walk_through" ? (
                  <WalkthroughStepper
                    text={responses.walk_through!}
                    onReviewFullSolution={() => handleToolboxClick("full_solution")}
                  />
                ) : (
                  <InlineResponseBlock text={responses[activeSection]!} />
                )}
              </div>
            ) : null}
          </section>
        ) : null}

        {activeSection && responses[activeSection] && (
          <div
            className="mt-4 pt-3 border-t"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          >
            <HelperResponseThumbs
              asset={asset}
              chapter={chapter}
              section={activeSection}
            />
          </div>
        )}
        </div>
      </div>
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

  // Detect iframe-embed context. When embedded inside the StudyPreviewer the
  // breadcrumb home/chapter clicks should bubble up to the parent so the
  // student lands back on the retro terminal "choose course / chapter" screen
  // instead of navigating inside the iframe.
  const inIframe =
    typeof window !== "undefined" && window.top !== window.self;

  const goHome = () => {
    if (inIframe) {
      try { window.parent?.postMessage({ type: "sa-viewer-go-home" }, "*"); } catch { /* ignore */ }
    } else {
      navigate("/");
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
  const [featureIdeasOpen, setFeatureIdeasOpen] = useState(false);

  const openReportIssue = () => {
    setFeedbackChooserOpen(false);
    // Defer slightly so the chooser unmount doesn't race the second dialog.
    setTimeout(() => setHelpOpen(true), 80);
  };
  const openSuggestFeature = () => {
    setFeedbackChooserOpen(false);
    // Open the shared feature voting modal — same component used by the
    // "Vote on new ideas" accordion in the right helper panel.
    setTimeout(() => setFeatureIdeasOpen(true), 80);
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
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  // Per-task checked state, persisted to localStorage per asset.
  const [checkedTasks, setCheckedTasks] = useState<boolean[]>([]);



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
    setInstructionsOpen(false);
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
          {/* LEFT — Compact Spring '26 Beta chip (desktop only) */}
          <div className="hidden sm:flex items-center justify-start min-w-0">
            <Link
              to="/my-dashboard"
              className="group inline-flex items-center min-w-0 max-w-full"
              data-embed-allow="true"
              aria-label="Spring '26 Beta — back to dashboard"
              title="Spring '26 Beta"
            >
              <span
                className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors group-hover:text-white"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Spring '26 <span style={{ color: "#FF8A95" }}>Beta</span>
              </span>
            </Link>
          </div>
          {/* Mobile: empty placeholder so Switch Problem stays centered */}
          <div className="sm:hidden" />

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

          {/* RIGHT — Share Feedback (icon-only on mobile) */}
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setFeedbackChooserOpen(true)}
              data-embed-allow="true"
              aria-label="Share feedback about this problem"
              className="inline-flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto sm:px-3 rounded-full text-xs font-medium transition-colors hover:bg-white/[0.06]"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              <MessageCircleQuestion className="h-4 w-4 sm:h-3.5 sm:w-3.5" style={{ color: "rgba(255,255,255,0.7)" }} />
              <span className="hidden sm:inline">Share Feedback</span>
            </button>
          </div>
        </div>
      </header>

      {/* Retro breadcrumb strip — mobile + desktop. Right side hosts the
          desktop view-mode menu so we don't need a second toolbar row. */}
      <RetroBreadcrumbs
        crumbs={[
          { label: "home", onClick: goHome },
          ...(chapter
            ? [{
                label: `ch ${chapter.chapter_number}`,
                onClick: () => {
                  if (inIframe) {
                    try { window.parent?.postMessage({ type: "sa-viewer-go-chapter" }, "*"); } catch { /* ignore */ }
                  } else {
                    navigate(`/cram/${chapter.id}`);
                  }
                },
              }]
            : []),
          { label: "practice problem helper" },
        ]}
        rightSlot={
          <TooltipProvider delayDuration={200}>
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Change layout"
                      className="hidden md:inline-flex items-center gap-1.5 h-7 px-2 rounded transition-colors"
                      style={{
                        color: "rgba(57,255,122,0.55)",
                        fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", ui-monospace, Menlo, Consolas, monospace',
                        fontSize: 12,
                        background: "transparent",
                        border: "1px solid rgba(57,255,122,0.18)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#39FF7A";
                        e.currentTarget.style.background = "rgba(57,255,122,0.06)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "rgba(57,255,122,0.55)";
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>view</span>
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6} className="text-xs">Change layout</TooltipContent>
              </Tooltip>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="p-2 w-auto"
                style={{
                  background: "#0F1A2E",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "#fff",
                }}
              >
                <div
                  className="text-[10px] font-semibold uppercase mb-2 px-1"
                  style={{ color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em" }}
                >
                  Change layout
                </div>
                <div className="flex items-center gap-0.5">
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
                            className="h-9 w-9 rounded inline-flex items-center justify-center transition-colors"
                            style={{
                              background: active ? "#14213D" : "transparent",
                              color: active ? "#fff" : "rgba(255,255,255,0.6)",
                              boxShadow: active ? "0 0 0 1px rgba(255,255,255,0.08) inset" : "none",
                            }}
                            onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={6} className="text-xs">
                          {label} <span className="opacity-50 ml-1">{hint}</span>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                <div className="h-px my-2" style={{ background: "rgba(255,255,255,0.08)" }} />
                <button
                  type="button"
                  onClick={() => {
                    setSplitRatio(0.5);
                    try { sessionStorage.setItem("sa.viewer.splitRatio", "0.5"); } catch { /* ignore */ }
                    setViewMode("split");
                  }}
                  disabled={viewMode !== "split"}
                  className="w-full inline-flex items-center gap-2 h-8 px-2 rounded text-[12px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ color: "rgba(255,255,255,0.75)" }}
                  onMouseEnter={(e) => { if (viewMode === "split") e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset split 50/50
                </button>
                <div className="h-px my-2" style={{ background: "rgba(255,255,255,0.08)" }} />
                <button
                  type="button"
                  onClick={() => {
                    const url = window.location.pathname + window.location.search;
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                  className="w-full inline-flex items-center gap-2 h-8 px-2 rounded text-[12px] transition-colors"
                  style={{ color: "rgba(255,255,255,0.75)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in new tab
                </button>
              </PopoverContent>
            </Popover>
          </TooltipProvider>
        }
      />


      <main
        className="relative max-w-6xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6 pb-32"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 40% at 30% 15%, rgba(99,52,180,0.035) 0%, transparent 65%), radial-gradient(ellipse 50% 35% at 75% 60%, rgba(80,130,255,0.03) 0%, transparent 70%)",
        }}>
        {loading && (
          <div className="relative" style={{ minHeight: "60vh" }}>
            <BrandedLoader subtitle="Loading problem…" surface="navy" />
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
            {/* Mobile Problem ↔ Helper toggle. Stacked, full-width, large tap targets.
                Tapping the active button switches to the OTHER pane (acts as a toggle). */}
            {isMobileViewport && (
              <div className="md:hidden mb-4 grid grid-cols-2 gap-2" role="tablist" aria-label="View mode">
                {([
                  { key: "problem" as const, Icon: FileText, label: "Problem" },
                  { key: "helper" as const, Icon: Brain, label: "Guided Helper" },
                ]).map(({ key, Icon, label }) => {
                  const active = mobileTab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        // Click the active tab → switch to the other one (toggle behavior)
                        if (active) {
                          setMobileTab(key === "problem" ? "helper" : "problem");
                        } else {
                          setMobileTab(key);
                        }
                      }}
                      className="inline-flex items-center justify-center gap-2 h-11 rounded-md text-sm font-semibold transition-all active:scale-[0.98]"
                      style={{
                        background: active ? "#CE1126" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${active ? "#CE1126" : "rgba(255,255,255,0.12)"}`,
                        color: active ? "#fff" : "rgba(255,255,255,0.85)",
                        boxShadow: active
                          ? "0 4px 14px -4px rgba(206,17,38,0.5), 0 1px 0 rgba(255,255,255,0.15) inset"
                          : "none",
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Desktop view-mode toolbar moved into the breadcrumb bar's right slot above. */}

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
                className="rounded-[10px] p-5 sm:p-8"
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

                {/* Problem text — always visible. Long word problems get a
                    comfortable reading width and generous line-height. */}
                {asset.survive_problem_text && (
                  <div className="mt-4">
                    {/* Scope text-color overrides to prose elements only — do NOT
                        force td/th colors. SmartTextRenderer renders pipe tables
                        with a white body and dark text; forcing white globally
                        makes those cells invisible. */}
                    <div
                      className="text-[15px] max-w-[68ch] space-y-3 [&_p]:whitespace-pre-wrap [&_p]:text-[15px] [&_p]:!text-white/95 [&_li]:!text-white/95 [&_strong]:!text-white [&_.font-semibold]:!text-amber-300"
                      style={{ color: "rgba(255,255,255,0.95)", lineHeight: 1.7 }}
                    >
                      <SmartTextRenderer text={toYouPerspective(asset.survive_problem_text)} />
                    </div>
                  </div>
                )}

                {/* Instructions — collapsed by default. The header itself is
                    the toggle so the surface stays calm and uncluttered.
                    Markers respect the source format: (a)/(b)/(A) → letter
                    badges; #1/1./1) → number badges; bare text falls back to
                    the index letter. */}
                {instructions.length > 0 && (() => {
                  const parsed = instructions.map((raw) => parseInstructionPrefix(raw));
                  const usesNumbers = parsed.some((p) => p.kind === "number");
                  return (
                    <div
                      className="mt-6 pt-5 border-t"
                      style={{ borderColor: "rgba(255,255,255,0.08)" }}
                    >
                      <button
                        type="button"
                        onClick={() => setInstructionsOpen((v) => !v)}
                        aria-expanded={instructionsOpen}
                        className="w-full flex items-center justify-between gap-3 -mx-1 px-1 py-1 rounded-md transition-colors hover:bg-white/[0.03] group"
                      >
                        <div
                          className="text-[10px] font-semibold uppercase tracking-[0.14em] flex items-center gap-2"
                          style={{ color: "rgba(255,255,255,0.55)" }}
                        >
                          Instructions
                          <span
                            className="text-[10px] font-medium normal-case tracking-normal"
                            style={{ color: "rgba(255,255,255,0.35)" }}
                          >
                            {instructions.length} {instructions.length === 1 ? "part" : "parts"}
                          </span>
                        </div>
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-medium transition-colors group-hover:text-white"
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
                        </span>
                      </button>

                      {instructionsOpen && (
                        <div className="mt-3">
                          <ul
                            className="space-y-1.5 text-[13px] animate-in fade-in slide-in-from-top-1 duration-150"
                            style={{ lineHeight: 1.55 }}
                          >
                            {parsed.map((p, i) => {
                              const checked = !!checkedTasks[i];
                              const isCurrent = !checked && i === currentTaskIndex;
                              // Badge label honors the source-detected marker
                              // when present; otherwise falls back to a clean
                              // sequence (numbers if any sibling used numbers,
                              // letters otherwise).
                              const badge =
                                p.marker ??
                                (usesNumbers ? String(i + 1) : String.fromCharCode(97 + i).toUpperCase());
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
                                    aria-label={`Mark part ${badge} as ${checked ? "incomplete" : "complete"}`}
                                    className="mt-0.5 inline-flex h-5 min-w-[20px] px-1 shrink-0 items-center justify-center rounded-[5px] border text-[10px] font-bold transition-all hover:scale-105"
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
                                    {checked ? <Check className="h-3 w-3" /> : badge}
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
                                    {highlightTerms(toYouPerspective(p.text))}
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
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Subtle "Problem clear?" feedback — bottom of the left card */}
                <ProblemClarityFeedback
                  asset={asset}
                  chapter={chapter}
                  viewMode={viewMode}
                  instructionsOpen={instructionsOpen}
                />
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
              {/* Subtle "Suggest a new idea" link — replaces the old
                  "Vote on new ideas" card. Opens the shared
                  FeatureIdeasModal so vote counts stay unified. */}
              <div className="mt-3 flex justify-end" data-embed-allow="true">
                <button
                  type="button"
                  onClick={() => setFeatureIdeasOpen(true)}
                  className="inline-flex items-center gap-1 text-[12px] font-medium transition-colors text-muted-foreground hover:text-foreground"
                >
                  Suggest a new idea
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
            </div>
          </>
        )}
      </main>

      {/* Sticky bottom nav */}
      {!loading && asset && (
        <nav
          className="fixed bottom-0 inset-x-0 z-20 bg-background/95 backdrop-blur border-t"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 sm:h-14 flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={!prev}
              onClick={() => prev && navigate(`/v2/solutions/${prev.asset_name}`)}
              aria-label="Previous problem"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg h-11 min-w-[44px] sm:min-w-0 sm:h-9 px-3 sm:px-3 text-sm font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "rgba(255,255,255,0.92)",
              }}
            >
              <ArrowLeft className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Previous</span>
              {prev?.source_ref && <span className="font-mono text-xs text-muted-foreground hidden md:inline">{prev.source_ref}</span>}
            </button>

            <div className="text-xs text-muted-foreground font-mono">
              {siblings.length > 0 && asset
                ? `${siblings.findIndex((s) => s.asset_name === asset.asset_name) + 1} / ${siblings.length}`
                : ""}
            </div>

            <button
              type="button"
              disabled={!next}
              onClick={() => next && navigate(`/v2/solutions/${next.asset_name}`)}
              aria-label="Next problem"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg h-11 min-w-[44px] sm:h-9 px-4 text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.99] disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(180deg, #E63950 0%, #CE1126 50%, #A30E1F 100%)",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 16px -6px rgba(206,17,38,0.5), 0 2px 4px rgba(0,0,0,0.2)",
              }}
            >
              {next?.source_ref && <span className="font-mono text-xs hidden md:inline opacity-90">{next.source_ref}</span>}
              <span className="hidden sm:inline">Next</span>
              <ArrowRight className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
          </div>
        </nav>
      )}

      {/* Floating help button removed — Share Feedback already lives in the
          top-right of the header, so a duplicate floating CTA just adds
          visual noise on the helper panel. */}

      <FeedbackChooserModal
        open={feedbackChooserOpen}
        onOpenChange={setFeedbackChooserOpen}
        onReportIssue={openReportIssue}
        onSuggestFeature={openSuggestFeature}
      />
      <FeatureIdeasModal
        open={featureIdeasOpen}
        onOpenChange={setFeatureIdeasOpen}
        asset={asset}
      />
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
