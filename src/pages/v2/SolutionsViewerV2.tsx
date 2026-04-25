import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, ArrowRight, ChevronLeft, MessageCircleQuestion, Sparkles, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  what_matters: string;
  how_to_solve: string;
  why_it_works: string;
  exam_tip: string;
};

type SectionKey = "how_to_solve" | "why_it_works" | "exam_tip";

const SECTION_META: Record<SectionKey, { label: string; emoji: string }> = {
  how_to_solve: { label: "How to solve", emoji: "📌" },
  why_it_works: { label: "Why it works", emoji: "⚖️" },
  exam_tip: { label: "Exam tip", emoji: "🚨" },
};

function ExplanationPanel({
  open,
  onOpenChange,
  asset,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset: Asset | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<ExplanationSections | null>(null);
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(new Set());

  useEffect(() => {
    if (!open || !asset) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setSections(null);
      setOpenSections(new Set());
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
  }, [open, asset?.asset_name]);

  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto p-0"
      >
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-5 py-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <SheetHeader className="flex-1 p-0 text-left">
            <SheetTitle className="text-base">Explain this</SheetTitle>
          </SheetHeader>
        </div>

        <div className="px-5 py-5 space-y-5">
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
              {/* Always-visible: What matters */}
              <section className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <span aria-hidden>💡</span> What matters
                </h3>
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 text-[14px] leading-relaxed">
                  <ReactMarkdown>{sections.what_matters}</ReactMarkdown>
                </div>
              </section>

              {/* Section toggle buttons */}
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

              {/* Revealed sections */}
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
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
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

  const [explainOpen, setExplainOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

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
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <div className="text-sm font-medium tracking-tight">{headerLabel}</div>
          <div className="w-12" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-32">
        {loading && (
          <div className="space-y-3">
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
          <article className="space-y-6">
            {/* Problem card */}
            <section className="rounded-2xl border bg-card p-6 sm:p-8 shadow-sm">
              {asset.source_ref && (
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  {asset.source_ref}
                </div>
              )}
              {asset.problem_title && (
                <h1 className="mt-1 text-xl sm:text-2xl font-semibold leading-tight tracking-tight">
                  {asset.problem_title}
                </h1>
              )}

              {asset.survive_problem_text && (
                <div className="mt-4 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-foreground/90">
                  {asset.survive_problem_text}
                </div>
              )}

              {instructions.length > 0 && (
                <div className="mt-5 pt-5 border-t">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    Instructions
                  </div>
                  <ol className="space-y-2 text-[0.95rem] leading-relaxed">
                    {instructions.map((ins, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="font-semibold text-primary shrink-0">
                          {String.fromCharCode(97 + i)}.
                        </span>
                        <span className="whitespace-pre-wrap">{ins}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>

            {/* Try it nudge + Explain button */}
            <div className="rounded-2xl border-2 border-dashed border-border p-5 sm:p-6 text-center bg-muted/30">
              <p className="text-sm text-muted-foreground mb-3">
                Try it first. When you're ready, get a quick walkthrough.
              </p>
              <Button
                size="lg"
                onClick={() => setExplainOpen(true)}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Explain this
              </Button>
            </div>
          </article>
        )}
      </main>

      {/* Sticky bottom nav */}
      {!loading && asset && (
        <nav className="fixed bottom-0 inset-x-0 z-20 bg-background/95 backdrop-blur border-t">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
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

      <ExplanationPanel open={explainOpen} onOpenChange={setExplainOpen} asset={asset} />
      <NeedHelpModal open={helpOpen} onOpenChange={setHelpOpen} asset={asset} />
    </div>
  );
}
