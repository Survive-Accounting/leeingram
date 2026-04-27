import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, ArrowRight, ChevronLeft, MessageCircleQuestion, Sparkles, Loader2, AlertTriangle, Menu, Wand2, Printer, BookOpen, Share2, Copy, Check, Search, ChevronDown, ChevronUp } from "lucide-react";
import { StructuredJEDisplay } from "@/components/StructuredJEDisplay";
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
import { buildShareUrl, captureRefFromUrl, logShareClick, attachReferrerOnConversion } from "@/lib/referralTracking";

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

type ChapterMeta = { id: string; chapter_number: number; chapter_name: string; course_id?: string };

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

// Section keys for the "Get unstuck fast" toolbox.
// `lees_approach` is reused for the "How to start" button.
type ToolboxKey = "lees_approach" | "how_to_solve" | "why_it_works" | "lock_it_in";

const TOOLBOX_META: Record<ToolboxKey, { label: string; emoji: string }> = {
  lees_approach: { label: "How to start", emoji: "🧭" },
  how_to_solve: { label: "Steps to solve", emoji: "📌" },
  why_it_works: { label: "Why it works", emoji: "⚖️" },
  lock_it_in: { label: "Lock this in", emoji: "🔒" },
};

const TOOLBOX_ORDER: ToolboxKey[] = ["lees_approach", "how_to_solve", "why_it_works", "lock_it_in"];

function InlineExplanation({
  asset,
  chapter,
  simplifiedText,
  setSimplifiedText,
  onShareClick,
}: {
  asset: Asset;
  chapter: ChapterMeta | null;
  simplifiedText: string | null;
  setSimplifiedText: (t: string | null) => void;
  onShareClick: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<ExplanationSections | null>(null);
  const [activeSection, setActiveSection] = useState<ToolboxKey | null>(null);
  const [printing, setPrinting] = useState(false);
  const [jeOpen, setJeOpen] = useState(false);

  const hasJE = Array.isArray(asset.journal_entry_completed_json?.scenario_sections)
    && asset.journal_entry_completed_json.scenario_sections.length > 0;

  // Reset on asset change
  useEffect(() => {
    setSections(null);
    setActiveSection(null);
    setError(null);
  }, [asset.asset_name]);

  const ensureSections = async (): Promise<ExplanationSections | null> => {
    if (sections) return sections;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("explain-this-solution", {
        body: { asset_code: asset.asset_name },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to load explanation");
      setSections(data.sections);
      return data.sections as ExplanationSections;
    } catch (e: any) {
      console.error("[explain-this-solution] failed:", e);
      setError("Lee's tools are taking a breather. Try again in a moment — if it keeps happening, hit \"Need help?\" and we'll get on it.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleToolboxClick = async (key: ToolboxKey) => {
    // Toggle off if same button clicked
    if (activeSection === key) {
      setActiveSection(null);
      return;
    }
    setActiveSection(key);
    if (!sections) await ensureSections();
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

    if (simplifiedText) {
      buildPdf(simplifiedText);
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
      buildPdf(data.simplified_text);
    } catch (e: any) {
      console.error("[simplify-problem] failed:", e);
      setError("Couldn't build the PDF right now. Try again in a sec — if it keeps failing, ping us via \"Need help?\".");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
      {/* Top: "Get Quick Help" + Print PDF */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-border/60">
        <span className="text-sm font-semibold text-foreground">
          Get Quick Help
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={handlePrintPdf}
          disabled={printing}
          className="gap-1.5 h-8 px-3 text-xs font-medium"
        >
          {printing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Printer className="h-3.5 w-3.5" />
          )}
          Print PDF
        </Button>
      </div>

      {/* Toolbox */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {TOOLBOX_ORDER.map((k) => {
            const isActive = activeSection === k;
            return (
              <Button
                key={k}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => handleToolboxClick(k)}
                className="justify-start gap-2 h-9 text-xs sm:text-sm font-medium"
              >
                <span aria-hidden>{TOOLBOX_META[k].emoji}</span>
                {TOOLBOX_META[k].label}
              </Button>
            );
          })}
          {hasJE && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setJeOpen(true)}
              className="justify-start gap-2 h-9 text-xs sm:text-sm font-medium col-span-2"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Journal Entries
            </Button>
          )}
        </div>
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

      {/* Active section content */}
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
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <span aria-hidden>{TOOLBOX_META[activeSection].emoji}</span>
            {TOOLBOX_META[activeSection].label}
          </h3>
          {loading && !sections ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Survive Accounting is thinking…
            </div>
          ) : sections ? (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 text-[14px] leading-relaxed">
              <ReactMarkdown>{sections[activeSection]}</ReactMarkdown>
            </div>
          ) : null}
        </section>
      )}

      {sections && activeSection && (
        <div className="pt-3 border-t border-border">
          <ExplanationFeedback asset={asset} onShareClick={onShareClick} />
        </div>
      )}
    </div>
  );
}

// ── Share modal ───────────────────────────────────────────────────────
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

        <p className="text-xs text-muted-foreground italic">
          "Helped me cram this way faster — try this"
        </p>
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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  courseId: string | undefined;
  currentChapterId: string | undefined;
  currentAssetName: string | undefined;
}) {
  const navigate = useNavigate();

  const [chapters, setChapters] = useState<NavChapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");
  const [problemsByChapter, setProblemsByChapter] = useState<Record<string, NavProblem[]>>({});
  const [activeCat, setActiveCat] = useState<"BE" | "EX" | "PR">("BE");
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [loadingProblems, setLoadingProblems] = useState(false);
  const [isIntro, setIsIntro] = useState(false);

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
          <DialogTitle>Navigate</DialogTitle>
          <DialogDescription>Jump anywhere in the course — chapter, type, problem.</DialogDescription>
        </DialogHeader>

        {/* 1. Chapter selection */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Chapter</div>
          {loadingChapters && chapters.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">Loading chapters…</div>
          ) : (
            <div className="flex gap-1.5 overflow-x-auto pb-1.5 -mx-1 px-1" style={{ scrollbarWidth: "thin" }}>
              {chapters.map((ch) => {
                const isCurrent = ch.id === selectedChapterId;
                const isAssetChapter = ch.id === currentChapterId;
                return (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedChapterId(ch.id)}
                    className={cn(
                      "shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all border",
                      isCurrent
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card hover:bg-accent border-border text-foreground",
                    )}
                    title={ch.chapter_name}
                  >
                    Ch {ch.chapter_number}
                    {isAssetChapter && !isCurrent && (
                      <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-primary align-middle" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Problem type */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</div>
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

  const [asset, setAsset] = useState<Asset | null>(null);
  const [chapter, setChapter] = useState<ChapterMeta | null>(null);
  const [siblings, setSiblings] = useState<{ asset_name: string; source_ref: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [helpOpen, setHelpOpen] = useState(false);
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

  // Instructions accordion (collapsed by default for fast cram mode)
  const [instructionsOpen, setInstructionsOpen] = useState(false);

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

        const [{ data: ch }, { data: sibs }] = await Promise.all([
          supabase
            .from("chapters")
            .select("id, chapter_number, chapter_name, course_id")
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
  const headerLabel = chapter
    ? `Ch ${chapter.chapter_number}${asset?.source_ref ? ` — ${asset.source_ref}` : ""}`
    : asset?.source_ref || "";

  return (
    <div className="min-h-screen bg-background text-foreground">
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
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
          <Link
            to="/my-dashboard"
            className="inline-flex items-center gap-1.5 text-sm rounded-md px-2 py-1.5 -ml-2 transition-all hover:bg-white/5"
            style={{ color: "rgba(255,255,255,0.55)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.95)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)")}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to dashboard</span>
            <span className="sm:hidden">Dashboard</span>
          </Link>
          <Link
            to="/my-dashboard"
            className="text-sm font-semibold tracking-tight truncate"
            style={{ color: "rgba(255,255,255,0.95)", letterSpacing: "-0.01em" }}
          >
            Survive Accounting
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openShareModal}
              title="Share this problem"
              aria-label="Share this problem"
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg transition-all hover:bg-white/10"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.75)",
              }}
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setJumpOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium transition-all hover:bg-white/10"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.85)",
              }}
              aria-label="Open navigation panel"
            >
              <Menu className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Navigate</span>
            </button>
          </div>
        </div>
      </header>

      <main
        className="relative max-w-6xl mx-auto px-4 pt-6 pb-32"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 50% at 30% 20%, rgba(99,52,180,0.07) 0%, transparent 60%), radial-gradient(ellipse 60% 45% at 75% 60%, rgba(80,130,255,0.06) 0%, transparent 65%)",
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
          <div className="grid lg:grid-cols-2 gap-6">
            {/* LEFT: Problem + What you need to solve */}
            <div className="space-y-4 min-w-0">
              {/* Card 1: Problem */}
              <section
                className="rounded-2xl p-8"
                style={{
                  background: "#1A2B5C",
                  border: "1px solid rgba(255,255,255,0.06)",
                  boxShadow:
                    "0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 40px -20px rgba(0,0,0,0.5), 0 0 60px -20px rgba(99,52,180,0.25)",
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                {/* Top line: "Practice based on E1.4 🔍" */}
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
                      Practice based on{" "}
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

                {/* Problem section (default open) */}
                {asset.survive_problem_text && (
                  <div className="mt-4">
                    <div
                      className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-2"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      Problem
                    </div>
                    <div
                      className="whitespace-pre-wrap text-[14px] max-w-prose [&>p+p]:mt-3"
                      style={{ color: "rgba(255,255,255,0.88)", lineHeight: 1.65 }}
                    >
                      {asset.survive_problem_text}
                    </div>
                  </div>
                )}

                {/* Instructions — collapsed by default */}
                {instructions.length > 0 && (
                  <div
                    className="mt-6 pt-5 border-t"
                    style={{ borderColor: "rgba(255,255,255,0.08)" }}
                  >
                    <button
                      type="button"
                      onClick={() => setInstructionsOpen((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium transition-colors hover:bg-white/5"
                      style={{
                        color: "rgba(255,255,255,0.85)",
                        border: "1px solid rgba(255,255,255,0.18)",
                        background: "transparent",
                      }}
                    >
                      {instructionsOpen ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                      {instructionsOpen ? "Hide instructions" : "View instructions"}
                    </button>
                    {instructionsOpen && (
                      <ul
                        className="mt-4 space-y-2 text-[14px] animate-in fade-in slide-in-from-top-1 duration-150"
                        style={{ lineHeight: 1.6 }}
                      >
                        {instructions.map((ins, i) => (
                          <li key={i} className="flex gap-2.5">
                            <span
                              className="font-semibold shrink-0 mt-0.5"
                              style={{ color: "rgba(255,255,255,0.7)" }}
                            >
                              {String.fromCharCode(97 + i)}.
                            </span>
                            <span
                              className="whitespace-pre-wrap"
                              style={{ color: "rgba(255,255,255,0.88)" }}
                            >
                              {highlightTerms(ins)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </section>

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

            {/* RIGHT: Get unstuck fast toolbox */}
            <div className="lg:sticky lg:top-20 lg:self-start min-w-0">
              <InlineExplanation
                asset={asset}
                chapter={chapter}
                simplifiedText={simplifiedText}
                setSimplifiedText={setSimplifiedText}
                onShareClick={openShareModal}
              />
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
      <NavigatePanel
        open={jumpOpen}
        onOpenChange={setJumpOpen}
        courseId={chapter?.course_id}
        currentChapterId={chapter?.id}
        currentAssetName={asset?.asset_name}
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
            {originalImages.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Original textbook image isn't available for this problem yet.
              </div>
            ) : (
              originalImages.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Original textbook problem${originalImages.length > 1 ? ` (page ${i + 1})` : ""}`}
                  className="w-full h-auto rounded-md border border-border bg-white"
                  loading="lazy"
                />
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        onCopy={() => trackShareEvent("copy_link")}
      />
    </div>
  );
}
