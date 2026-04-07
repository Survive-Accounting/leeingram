/**
 * Chapter Content QA — Admin-only tool for managing chapter JEs and formulas.
 * Mirrors the style/UX of SolutionsQAAdmin.
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Check, X, ChevronDown, ChevronRight, GripVertical, Trash2, Edit3,
  Loader2, Sparkles, Plus, BookOpen, FlaskConical, ChevronLeft,
  ExternalLink, AlertTriangle, Image as ImageIcon, Layers, BookText,
  AlertCircle, CheckSquare, Target,
} from "lucide-react";
import { AccountsTab } from "@/components/chapter-qa/AccountsTab";
import { KeyTermsTab } from "@/components/chapter-qa/KeyTermsTab";
import { MistakesTab } from "@/components/chapter-qa/MistakesTab";
import { ChecklistTab } from "@/components/chapter-qa/ChecklistTab";
import { PurposeTab } from "@/components/chapter-qa/PurposeTab";
import { useAuth } from "@/contexts/AuthContext";
import { useVaAccount } from "@/hooks/useVaAccount";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────

type JELine = {
  account: string;
  account_tooltip: string;
  side: "debit" | "credit";
  amount: string;
};

type ChapterRow = {
  id: string;
  chapter_number: number;
  chapter_name: string;
  course_id: string;
};

type CourseRow = {
  id: string;
  code: string;
  course_name: string;
};

type JECatRow = { id: string; category_name: string; sort_order: number; chapter_id: string };
type JEEntryRow = { id: string; category_id: string | null; transaction_label: string; je_lines: any; is_approved: boolean; is_rejected: boolean; sort_order: number; chapter_id: string; source?: string };
type FormulaRow = { id: string; chapter_id: string; formula_name: string; formula_expression: string; formula_explanation: string | null; image_url: string | null; is_approved: boolean; sort_order: number };

// ── Main ─────────────────────────────────────────────────────────

export default function ChapterContentQA() {
  const { user } = useAuth();
  const { isVa } = useVaAccount();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Access guard
  useEffect(() => {
    if (isVa) {
      toast.error("Access restricted.");
      navigate("/dashboard");
    }
  }, [isVa, navigate]);

  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<string>("je");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem("chapter_qa_onboarding_dismissed") === "true"
  );

  // ── Data queries ───────────────────────────────────────────────

  const { data: courses } = useQuery({
    queryKey: ["cqa-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, code, course_name").order("created_at");
      return (data || []) as CourseRow[];
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["cqa-chapters"],
    queryFn: async () => {
      const { data } = await supabase.from("chapters").select("id, chapter_number, chapter_name, course_id").order("chapter_number");
      return (data || []) as ChapterRow[];
    },
  });

  // Count queries using head:true (efficient)
  const { data: jeCounts } = useQuery({
    queryKey: ["cqa-je-counts"],
    queryFn: async () => {
      const { data: allEntries } = await supabase
        .from("chapter_journal_entries")
        .select("chapter_id, is_approved");
      const byChapter: Record<string, { total: number; approved: number }> = {};
      (allEntries || []).forEach((e: any) => {
        if (!byChapter[e.chapter_id]) byChapter[e.chapter_id] = { total: 0, approved: 0 };
        byChapter[e.chapter_id].total++;
        if (e.is_approved) byChapter[e.chapter_id].approved++;
      });
      return byChapter;
    },
  });

  const { data: formulaCounts } = useQuery({
    queryKey: ["cqa-formula-counts"],
    queryFn: async () => {
      const { data: allFormulas } = await supabase
        .from("chapter_formulas")
        .select("chapter_id, is_approved");
      const byChapter: Record<string, { total: number; approved: number }> = {};
      (allFormulas || []).forEach((f: any) => {
        if (!byChapter[f.chapter_id]) byChapter[f.chapter_id] = { total: 0, approved: 0 };
        byChapter[f.chapter_id].total++;
        if (f.is_approved) byChapter[f.chapter_id].approved++;
      });
      return byChapter;
    },
  });

  // Summary pills
  const totalChapters = chapters?.length || 0;
  const pendingJEChapters = chapters?.filter(ch => !jeCounts?.[ch.id]?.approved).length || 0;
  const approvedJEChapters = chapters?.filter(ch => (jeCounts?.[ch.id]?.approved || 0) > 0).length || 0;
  const pendingFormulaChapters = chapters?.filter(ch => !formulaCounts?.[ch.id]?.approved).length || 0;
  const approvedFormulaChapters = chapters?.filter(ch => (formulaCounts?.[ch.id]?.approved || 0) > 0).length || 0;

  // Group chapters by course
  const courseGroups = useMemo(() => {
    if (!courses || !chapters) return [];
    return courses.map(c => ({
      ...c,
      chapters: chapters.filter(ch => ch.course_id === c.id),
    }));
  }, [courses, chapters]);

  // Flat ordered list for keyboard nav
  const flatChapters = useMemo(() => chapters || [], [chapters]);
  const selectedIndex = flatChapters.findIndex(ch => ch.id === selectedChapterId);
  const selectedChapter = selectedIndex >= 0 ? flatChapters[selectedIndex] : null;
  const selectedCourse = courses?.find(c => c.id === selectedChapter?.course_id);

  const goNext = useCallback(() => {
    if (selectedIndex < flatChapters.length - 1) setSelectedChapterId(flatChapters[selectedIndex + 1].id);
  }, [selectedIndex, flatChapters]);
  const goPrev = useCallback(() => {
    if (selectedIndex > 0) setSelectedChapterId(flatChapters[selectedIndex - 1].id);
  }, [selectedIndex, flatChapters]);

  // Keyboard nav
  useEffect(() => {
    if (!selectedChapterId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "j") goNext();
      if (e.key === "k") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedChapterId, goNext, goPrev]);

  // JE status for a chapter
  const jeStatus = (chId: string) => {
    const c = jeCounts?.[chId];
    if (!c || c.total === 0) return "none";
    if (c.approved > 0) return "approved";
    return "pending";
  };
  const formulaStatus = (chId: string) => {
    const c = formulaCounts?.[chId];
    if (!c || c.total === 0) return "none";
    if (c.approved > 0) return "approved";
    return "pending";
  };

  const statusPill = (status: string, type: string) => {
    if (status === "none") return <Badge variant="secondary" className="text-[9px] h-4 px-1.5">No {type}</Badge>;
    if (status === "pending") return <Badge className="text-[9px] h-4 px-1.5 bg-amber-500/20 text-amber-400 border-amber-500/30">Pending</Badge>;
    return <Badge className="text-[9px] h-4 px-1.5 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Approved ✓</Badge>;
  };

  // ── Bulk ops state ─────────────────────────────────────────────
  const [bulkGenerating, setBulkGenerating] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState("");

  const runBulkJE = async () => {
    setBulkGenerating("je");
    setBulkProgress("Starting...");
    try {
      const { data, error } = await supabase.functions.invoke("generate-chapter-journal-entries", { body: { all: true } });
      if (error) throw error;
      toast.success(`JEs generated: ${data.completed}/${data.total}. ${data.errors?.length || 0} errors.`);
      qc.invalidateQueries({ queryKey: ["cqa-je-counts"] });
    } catch (err: any) { toast.error(err.message); }
    finally { setBulkGenerating(null); setBulkProgress(""); }
  };

  const runBulkFormulas = async () => {
    setBulkGenerating("formulas");
    setBulkProgress("Starting...");
    try {
      const { data, error } = await supabase.functions.invoke("generate-chapter-formulas", { body: { all: true } });
      if (error) throw error;
      toast.success(`Formulas generated: ${data.completed}/${data.total}. ${data.errors?.length || 0} errors.`);
      qc.invalidateQueries({ queryKey: ["cqa-formula-counts"] });
    } catch (err: any) { toast.error(err.message); }
    finally { setBulkGenerating(null); setBulkProgress(""); }
  };

  const runBulkImages = async () => {
    setBulkGenerating("images");
    setBulkProgress("Starting...");
    try {
      const { data, error } = await supabase.functions.invoke("generate-formula-images", { body: { all: true } });
      if (error) throw error;
      toast.success("Formula images generated.");
    } catch (err: any) { toast.error(err.message); }
    finally { setBulkGenerating(null); setBulkProgress(""); }
  };

  // Onboarding: generate Ch 13 IA2
  const handleOnboardingGenerate = async () => {
    const ia2Course = courses?.find(c => c.code === "ACCY304" || c.course_name.includes("Intermediate Accounting 2"));
    const ch13 = chapters?.find(ch => ch.chapter_number === 13 && ch.course_id === ia2Course?.id);
    if (!ch13 || !ia2Course) { toast.error("Could not find IA2 Ch 13"); return; }
    setSelectedChapterId(ch13.id);
    setBulkGenerating("onboarding");
    try {
      await Promise.all([
        supabase.functions.invoke("generate-chapter-journal-entries", {
          body: { chapterId: ch13.id, chapterName: ch13.chapter_name, courseCode: ia2Course.code },
        }),
        supabase.functions.invoke("generate-chapter-formulas", {
          body: { chapterId: ch13.id, chapterName: ch13.chapter_name, courseCode: ia2Course.code },
        }),
      ]);
      toast.success("Ch 13 JEs + Formulas generated!");
      qc.invalidateQueries({ queryKey: ["cqa-je-counts"] });
      qc.invalidateQueries({ queryKey: ["cqa-formula-counts"] });
    } catch (err: any) { toast.error(err.message); }
    finally { setBulkGenerating(null); }
  };

  const dismissOnboarding = () => {
    localStorage.setItem("chapter_qa_onboarding_dismissed", "true");
    setOnboardingDismissed(true);
  };

  return (
    <SurviveSidebarLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">Chapter Content QA</h1>

        {/* Onboarding banner */}
        {!onboardingDismissed && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Start here → Generate Ch 13 (IA2) to test the pipeline before running all chapters.</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" onClick={handleOnboardingGenerate} disabled={!!bulkGenerating}>
                  {bulkGenerating === "onboarding" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                  Generate Ch 13 Now →
                </Button>
                <Button size="sm" variant="ghost" onClick={dismissOnboarding}>Dismiss</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Count pills */}
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: "Total Chapters", value: totalChapters, color: "text-foreground" },
            { label: "Pending JEs", value: pendingJEChapters, color: "text-amber-400" },
            { label: "JEs Approved", value: approvedJEChapters, color: "text-emerald-400" },
            { label: "Pending Formulas", value: pendingFormulaChapters, color: "text-amber-400" },
            { label: "Formulas Approved", value: approvedFormulaChapters, color: "text-emerald-400" },
          ].map(c => (
            <Card key={c.label} className="bg-card/50">
              <CardContent className="p-3 text-center">
                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-[10px] text-muted-foreground">{c.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bulk operations */}
        <Collapsible open={bulkOpen} onOpenChange={setBulkOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between text-xs">
              Bulk Operations {bulkOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={runBulkJE} disabled={!!bulkGenerating}>
                {bulkGenerating === "je" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                Generate All Chapter JEs
              </Button>
              <Button size="sm" variant="outline" onClick={runBulkFormulas} disabled={!!bulkGenerating}>
                {bulkGenerating === "formulas" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FlaskConical className="h-3.5 w-3.5 mr-1" />}
                Generate All Chapter Formulas
              </Button>
              <Button size="sm" variant="outline" onClick={runBulkImages} disabled={!!bulkGenerating}>
                {bulkGenerating === "images" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ImageIcon className="h-3.5 w-3.5 mr-1" />}
                Generate All Formula Images
              </Button>
              <Button size="sm" variant="outline" onClick={async () => {
                setBulkGenerating("suite");
                setBulkProgress("Starting full suite generation...");
                try {
                  const { data, error } = await supabase.functions.invoke("generate-chapter-content-suite", { body: { all: true } });
                  if (error) throw error;
                  toast.success(`Full suite generated: ${data.completed}/${data.total}. ${data.errors?.length || 0} errors.`);
                  qc.invalidateQueries({ queryKey: ["cqa-je-counts"] });
                  qc.invalidateQueries({ queryKey: ["cqa-formula-counts"] });
                } catch (err: any) { toast.error(err.message); }
                finally { setBulkGenerating(null); setBulkProgress(""); }
              }} disabled={!!bulkGenerating}>
                {bulkGenerating === "suite" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Layers className="h-3.5 w-3.5 mr-1" />}
                Generate Full Suite — All Chapters
              </Button>
            </div>
            {bulkProgress && <p className="text-xs text-muted-foreground animate-pulse">{bulkProgress}</p>}
            <p className="text-[10px] text-destructive/70">
              <AlertTriangle className="h-3 w-3 inline mr-1" />
              These operations affect all chapters. Run one at a time and monitor for errors.
            </p>
          </CollapsibleContent>
        </Collapsible>

        {/* Chapter list grouped by course */}
        <div className="space-y-2">
          {courseGroups.map(cg => (
            <CourseGroupBlock
              key={cg.id}
              course={cg}
              chapters={cg.chapters}
              jeStatus={jeStatus}
              formulaStatus={formulaStatus}
              statusPill={statusPill}
              selectedId={selectedChapterId}
              onSelect={setSelectedChapterId}
            />
          ))}
        </div>
      </div>

      {/* Modal */}
      {selectedChapter && (
        <ChapterQAModal
          chapter={selectedChapter}
          course={selectedCourse}
          index={selectedIndex}
          total={flatChapters.length}
          onClose={() => setSelectedChapterId(null)}
          onPrev={goPrev}
          onNext={goNext}
          tab={modalTab}
          onTabChange={setModalTab}
        />
      )}
    </SurviveSidebarLayout>
  );
}

// ── Course group ──────────────────────────────────────────────────

function CourseGroupBlock({
  course, chapters, jeStatus, formulaStatus, statusPill, selectedId, onSelect,
}: {
  course: CourseRow;
  chapters: ChapterRow[];
  jeStatus: (id: string) => string;
  formulaStatus: (id: string) => string;
  statusPill: (status: string, type: string) => React.ReactNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const label = `${course.code} — ${course.course_name}`;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors text-left">
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <span className="text-xs font-bold text-foreground uppercase tracking-wider">{label}</span>
        <Badge variant="secondary" className="text-[9px] h-4 ml-auto">{chapters.length} chapters</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 space-y-0.5">
        {chapters.map(ch => (
          <button
            key={ch.id}
            onClick={() => onSelect(ch.id)}
            className={cn(
              "w-full flex items-center gap-2 px-4 py-2 rounded-md text-left transition-colors text-sm",
              selectedId === ch.id
                ? "bg-primary/15 text-foreground border border-primary/30"
                : "hover:bg-muted/30 text-foreground/80"
            )}
          >
            <span className="font-medium text-xs">Ch {ch.chapter_number}</span>
            <span className="text-xs truncate">{ch.chapter_name}</span>
            <div className="flex gap-1 ml-auto shrink-0">
              {statusPill(jeStatus(ch.id), "JEs")}
              {statusPill(formulaStatus(ch.id), "Formulas")}
            </div>
          </button>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Chapter QA Modal ────────────────────────────────────────────

function ChapterQAModal({
  chapter, course, index, total, onClose, onPrev, onNext, tab, onTabChange,
}: {
  chapter: ChapterRow;
  course: CourseRow | undefined;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  tab: string;
  onTabChange: (t: string) => void;
}) {
  const qc = useQueryClient();
  const courseCode = course?.code || "???";

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base">
            {courseCode} — Ch {chapter.chapter_number}: {chapter.chapter_name}
          </DialogTitle>
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onPrev} disabled={index <= 0}>
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Button>
              <span className="text-xs text-muted-foreground">{index + 1} / {total}</span>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onNext} disabled={index >= total - 1}>
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <a
              href={`/cram/${chapter.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-primary hover:underline flex items-center gap-1"
            >
              View Survive This Chapter <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={onTabChange} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="bg-secondary shrink-0 flex-wrap h-auto gap-0.5 p-1">
            <TabsTrigger value="je" className="gap-1 text-[11px]"><BookOpen className="h-3 w-3" /> JEs</TabsTrigger>
            <TabsTrigger value="formulas" className="gap-1 text-[11px]"><FlaskConical className="h-3 w-3" /> Formulas</TabsTrigger>
            <TabsTrigger value="accounts" className="gap-1 text-[11px]"><Layers className="h-3 w-3" /> Accounts</TabsTrigger>
            <TabsTrigger value="terms" className="gap-1 text-[11px]"><BookText className="h-3 w-3" /> Key Terms</TabsTrigger>
            <TabsTrigger value="mistakes" className="gap-1 text-[11px]"><AlertCircle className="h-3 w-3" /> Mistakes</TabsTrigger>
            <TabsTrigger value="checklist" className="gap-1 text-[11px]"><CheckSquare className="h-3 w-3" /> Checklist</TabsTrigger>
            <TabsTrigger value="purpose" className="gap-1 text-[11px]"><Target className="h-3 w-3" /> Purpose</TabsTrigger>
          </TabsList>
          <ScrollArea className="flex-1 mt-3">
            <TabsContent value="je" className="mt-0">
              <JETab chapterId={chapter.id} chapterName={chapter.chapter_name} courseCode={courseCode} />
            </TabsContent>
            <TabsContent value="formulas" className="mt-0">
              <FormulasTab chapterId={chapter.id} chapterName={chapter.chapter_name} courseCode={courseCode} />
            </TabsContent>
            <TabsContent value="accounts" className="mt-0">
              <AccountsTab chapterId={chapter.id} chapterName={chapter.chapter_name} courseCode={courseCode} />
            </TabsContent>
            <TabsContent value="terms" className="mt-0">
              <KeyTermsTab chapterId={chapter.id} chapterName={chapter.chapter_name} courseCode={courseCode} />
            </TabsContent>
            <TabsContent value="mistakes" className="mt-0">
              <MistakesTab chapterId={chapter.id} chapterName={chapter.chapter_name} courseCode={courseCode} />
            </TabsContent>
            <TabsContent value="checklist" className="mt-0">
              <ChecklistTab chapterId={chapter.id} chapterName={chapter.chapter_name} courseCode={courseCode} />
            </TabsContent>
            <TabsContent value="purpose" className="mt-0">
              <PurposeTab chapterId={chapter.id} chapterName={chapter.chapter_name} courseCode={courseCode} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── JE Tab ──────────────────────────────────────────────────────

function JETab({ chapterId, chapterName, courseCode }: { chapterId: string; chapterName: string; courseCode: string }) {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState("");

  const { data, refetch } = useQuery({
    queryKey: ["cqa-je-detail", chapterId],
    queryFn: async () => {
      const [{ data: cats }, { data: entries }] = await Promise.all([
        supabase.from("chapter_je_categories").select("*").eq("chapter_id", chapterId).order("sort_order"),
        supabase.from("chapter_journal_entries").select("*").eq("chapter_id", chapterId).order("sort_order"),
      ]);
      return {
        categories: (cats || []) as JECatRow[],
        entries: (entries || []) as JEEntryRow[],
      };
    },
  });

  const categories = data?.categories || [];
  const entries = data?.entries || [];
  const grouped = categories.map(c => ({ ...c, entries: entries.filter(e => e.category_id === c.id) }));

  const invalidate = () => { refetch(); qc.invalidateQueries({ queryKey: ["cqa-je-counts"] }); };

  const handleGenerate = async (extra?: string) => {
    setGenerating(true);
    try {
      const body: any = { chapterId, chapterName, courseCode };
      if (extra) body.extraPrompt = extra;
      const { error } = await supabase.functions.invoke("generate-chapter-journal-entries", { body });
      if (error) throw error;
      toast.success(extra ? "New entries added." : "Journal entries generated.");
      setExtraPrompt("");
      invalidate();
    } catch (err: any) { toast.error(err.message); }
    finally { setGenerating(false); }
  };

  const approveEntry = async (id: string) => { await supabase.from("chapter_journal_entries").update({ is_approved: true, is_rejected: false }).eq("id", id); invalidate(); };
  const rejectEntry = async (id: string) => { await supabase.from("chapter_journal_entries").update({ is_rejected: true, is_approved: false }).eq("id", id); invalidate(); };
  const deleteEntry = async (id: string) => { await supabase.from("chapter_journal_entries").delete().eq("id", id); invalidate(); };
  const deleteCategory = async (catId: string) => {
    await supabase.from("chapter_journal_entries").delete().eq("category_id", catId);
    await supabase.from("chapter_je_categories").delete().eq("id", catId);
    invalidate();
  };
  const approveAll = async () => {
    await supabase.from("chapter_journal_entries").update({ is_approved: true, is_rejected: false }).eq("chapter_id", chapterId).eq("is_rejected", false);
    invalidate();
    toast.success("All entries approved");
  };
  const rejectAll = async () => {
    await supabase.from("chapter_journal_entries").update({ is_rejected: true, is_approved: false }).eq("chapter_id", chapterId);
    invalidate();
    toast.success("All entries rejected");
  };
  const updateCategoryName = async (catId: string, name: string) => { await supabase.from("chapter_je_categories").update({ category_name: name }).eq("id", catId); invalidate(); };
  const updateEntryLabel = async (id: string, label: string) => { await supabase.from("chapter_journal_entries").update({ transaction_label: label }).eq("id", id); invalidate(); };
  const updateEntryLines = async (id: string, lines: JELine[]) => { await supabase.from("chapter_journal_entries").update({ je_lines: lines as any }).eq("id", id); invalidate(); };

  if (entries.length === 0 && !generating) {
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-sm text-muted-foreground">No journal entries generated yet.</p>
        <Button onClick={() => handleGenerate()} disabled={generating}>
          <Sparkles className="h-4 w-4 mr-2" /> Generate Journal Entries →
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-20">
      {grouped.map(cat => (
        <JECategoryBlock
          key={cat.id}
          category={cat}
          onDeleteCategory={() => deleteCategory(cat.id)}
          onUpdateCategoryName={(name) => updateCategoryName(cat.id, name)}
          onApproveEntry={approveEntry}
          onRejectEntry={rejectEntry}
          onDeleteEntry={deleteEntry}
          onUpdateEntryLabel={updateEntryLabel}
          onUpdateEntryLines={updateEntryLines}
        />
      ))}

      {/* Extra prompt */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Something missing? Add a prompt:</p>
        <Textarea
          value={extraPrompt}
          onChange={(e) => setExtraPrompt(e.target.value)}
          placeholder="e.g. Add entries for convertible bond conversion and early retirement at a loss."
          className="text-sm"
          rows={3}
        />
        <Button size="sm" onClick={() => handleGenerate(extraPrompt.trim())} disabled={generating || !extraPrompt.trim()}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
          Run Again with This Prompt →
        </Button>
      </div>

      {/* Sticky bulk actions */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border py-2 px-3 flex gap-2 -mx-3">
        <Button size="sm" variant="outline" className="text-xs" onClick={approveAll}>
          <Check className="h-3 w-3 mr-1" /> Approve All ✓
        </Button>
        <Button size="sm" variant="outline" className="text-xs text-destructive" onClick={rejectAll}>
          <X className="h-3 w-3 mr-1" /> Reject All ✗
        </Button>
        <Button size="sm" variant="ghost" className="text-xs ml-auto" onClick={() => handleGenerate()} disabled={generating}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
          Regenerate All
        </Button>
      </div>
    </div>
  );
}

// ── JE Category Block ───────────────────────────────────────────

function JECategoryBlock({
  category, onDeleteCategory, onUpdateCategoryName, onApproveEntry, onRejectEntry, onDeleteEntry, onUpdateEntryLabel, onUpdateEntryLines,
}: {
  category: JECatRow & { entries: JEEntryRow[] };
  onDeleteCategory: () => void;
  onUpdateCategoryName: (name: string) => void;
  onApproveEntry: (id: string) => void;
  onRejectEntry: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onUpdateEntryLabel: (id: string, label: string) => void;
  onUpdateEntryLines: (id: string, lines: JELine[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [catName, setCatName] = useState(category.category_name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
        <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0 cursor-grab" />
        <button onClick={() => setOpen(!open)} className="shrink-0">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
        {editing ? (
          <Input
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            onBlur={() => { onUpdateCategoryName(catName); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { onUpdateCategoryName(catName); setEditing(false); } }}
            className="h-7 text-sm font-semibold w-48"
            autoFocus
          />
        ) : (
          <button onClick={() => setEditing(true)} className="text-sm font-semibold text-foreground hover:underline">
            {category.category_name}
          </button>
        )}
        <Badge variant="outline" className="text-[10px] h-5">{category.entries.length} entries</Badge>
        <button onClick={() => setConfirmDelete(true)} className="ml-auto text-muted-foreground hover:text-destructive transition-colors p-1">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && (
        <div className="divide-y divide-border/50">
          {category.entries.map(entry => (
            <JEEntryRow
              key={entry.id}
              entry={entry}
              onApprove={() => onApproveEntry(entry.id)}
              onReject={() => onRejectEntry(entry.id)}
              onDelete={() => onDeleteEntry(entry.id)}
              onUpdateLabel={(label) => onUpdateEntryLabel(entry.id, label)}
              onUpdateLines={(lines) => onUpdateEntryLines(entry.id, lines)}
            />
          ))}
          {category.entries.length === 0 && <p className="text-xs text-muted-foreground px-3 py-3">No entries.</p>}
        </div>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Category?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Delete "{category.category_name}" and all {category.entries.length} entries?</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
            <Button variant="destructive" size="sm" onClick={() => { onDeleteCategory(); setConfirmDelete(false); }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── JE Entry Row ────────────────────────────────────────────────

function JEEntryRow({
  entry, onApprove, onReject, onDelete, onUpdateLabel, onUpdateLines,
}: {
  entry: JEEntryRow;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  onUpdateLabel: (label: string) => void;
  onUpdateLines: (lines: JELine[]) => void;
}) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [label, setLabel] = useState(entry.transaction_label);
  const [editingLines, setEditingLines] = useState(false);
  const jeLines = (Array.isArray(entry.je_lines) ? entry.je_lines : []) as JELine[];
  const [lines, setLines] = useState<JELine[]>(jeLines);

  const statusPill = entry.is_approved
    ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] h-5">Approved ✓</Badge>
    : entry.is_rejected
    ? <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px] h-5">Rejected ✗</Badge>
    : <Badge variant="secondary" className="text-[10px] h-5">Pending</Badge>;

  // Compact chips preview
  const chips = jeLines.map((l, i) => (
    <span key={i} className={cn("text-[10px] px-1.5 py-0.5 rounded-sm", l.side === "debit" ? "bg-blue-500/10 text-blue-400" : "bg-amber-500/10 text-amber-400")}>
      {l.side === "debit" ? "Dr" : "Cr"}: {l.account}
    </span>
  ));

  return (
    <div className="px-3 py-2 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 cursor-grab" />
        {editingLabel ? (
          <Input value={label} onChange={(e) => setLabel(e.target.value)}
            onBlur={() => { onUpdateLabel(label); setEditingLabel(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { onUpdateLabel(label); setEditingLabel(false); } }}
            className="h-6 text-xs w-56" autoFocus />
        ) : (
          <button onClick={() => setEditingLabel(true)} className="text-xs font-medium text-foreground hover:underline text-left">
            {entry.transaction_label}
          </button>
        )}
        <div className="flex gap-1 flex-wrap">{chips}</div>
        {entry.source === "extracted" ? (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] h-4 shrink-0">Extracted</Badge>
        ) : entry.source === "suggested" ? (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[9px] h-4 shrink-0">Suggested</Badge>
        ) : null}
        {statusPill}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <button onClick={onApprove} className="p-1 rounded hover:bg-emerald-500/20 text-emerald-500 transition-colors" title="Approve"><Check className="h-3.5 w-3.5" /></button>
          <button onClick={onReject} className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors" title="Reject"><X className="h-3.5 w-3.5" /></button>
          <button onClick={() => { setLines(jeLines); setEditingLines(true); }} className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors" title="Edit JE"><Edit3 className="h-3.5 w-3.5" /></button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {editingLines && (
        <div className="ml-6 space-y-2 p-3 rounded-md border border-border bg-muted/20">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left py-1 font-medium">Account</th>
                <th className="text-left py-1 font-medium w-[180px]">Tooltip</th>
                <th className="text-center py-1 font-medium w-20">Side</th>
                <th className="text-center py-1 font-medium w-14">Amt</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="border-t border-border/30">
                  <td className="py-1 pr-1"><Input value={line.account} onChange={(e) => { const n = [...lines]; n[i] = { ...n[i], account: e.target.value }; setLines(n); }} className="h-6 text-xs" /></td>
                  <td className="py-1 pr-1"><Input value={line.account_tooltip} onChange={(e) => { const n = [...lines]; n[i] = { ...n[i], account_tooltip: e.target.value }; setLines(n); }} className="h-6 text-xs" /></td>
                  <td className="py-1 pr-1 text-center">
                    <select value={line.side} onChange={(e) => { const n = [...lines]; n[i] = { ...n[i], side: e.target.value as "debit" | "credit" }; setLines(n); }} className="h-6 text-xs bg-background border border-input rounded px-1">
                      <option value="debit">Debit</option>
                      <option value="credit">Credit</option>
                    </select>
                  </td>
                  <td className="py-1 text-center text-muted-foreground font-mono">???</td>
                  <td className="py-1"><button onClick={() => setLines(lines.filter((_, j) => j !== i))} className="p-0.5 text-destructive hover:bg-destructive/10 rounded"><X className="h-3 w-3" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setLines([...lines, { account: "", account_tooltip: "", side: "debit", amount: "???" }])}><Plus className="h-3 w-3 mr-1" /> Add Line</Button>
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setEditingLines(false)}>Cancel</Button>
              <Button size="sm" className="h-6 text-[10px]" onClick={() => { onUpdateLines(lines); setEditingLines(false); }}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Formulas Tab ────────────────────────────────────────────────

function FormulasTab({ chapterId, chapterName, courseCode }: { chapterId: string; chapterName: string; courseCode: string }) {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState("");
  const [genImagesProgress, setGenImagesProgress] = useState("");

  const { data: formulas, refetch } = useQuery({
    queryKey: ["cqa-formulas-detail", chapterId],
    queryFn: async () => {
      const { data } = await supabase.from("chapter_formulas").select("*").eq("chapter_id", chapterId).order("sort_order");
      return (data || []) as FormulaRow[];
    },
  });

  const invalidate = () => { refetch(); qc.invalidateQueries({ queryKey: ["cqa-formula-counts"] }); };

  const handleGenerate = async (extra?: string) => {
    setGenerating(true);
    try {
      const body: any = { chapterId, chapterName, courseCode };
      if (extra) body.extraPrompt = extra;
      const { error } = await supabase.functions.invoke("generate-chapter-formulas", { body });
      if (error) throw error;
      toast.success(extra ? "New formulas added." : "Formulas generated.");
      setExtraPrompt("");
      invalidate();
    } catch (err: any) { toast.error(err.message); }
    finally { setGenerating(false); }
  };

  const approveFormula = async (id: string) => { await supabase.from("chapter_formulas").update({ is_approved: true }).eq("id", id); invalidate(); };
  const rejectFormula = async (id: string) => { await supabase.from("chapter_formulas").update({ is_approved: false }).eq("id", id); invalidate(); };
  const deleteFormula = async (id: string) => { await supabase.from("chapter_formulas").delete().eq("id", id); invalidate(); };
  const updateFormula = async (id: string, field: string, value: string) => { await supabase.from("chapter_formulas").update({ [field]: value }).eq("id", id); invalidate(); };

  const approveAll = async () => {
    await supabase.from("chapter_formulas").update({ is_approved: true }).eq("chapter_id", chapterId);
    invalidate();
    toast.success("All formulas approved");
  };
  const rejectAll = async () => {
    await supabase.from("chapter_formulas").update({ is_approved: false }).eq("chapter_id", chapterId);
    invalidate();
    toast.success("All formulas rejected");
  };

  const generateImages = async () => {
    const approved = formulas?.filter(f => f.is_approved && !f.image_url) || [];
    if (approved.length === 0) { toast.info("No approved formulas missing images."); return; }
    setGenImagesProgress(`Generating 0 of ${approved.length}...`);
    let done = 0;
    for (const f of approved) {
      try {
        await supabase.functions.invoke("generate-formula-images", { body: { formulaId: f.id } });
        done++;
        setGenImagesProgress(`Generating ${done} of ${approved.length}...`);
      } catch { /* continue */ }
    }
    setGenImagesProgress("");
    toast.success(`${done} formula images generated.`);
    invalidate();
  };

  if (!formulas?.length && !generating) {
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-sm text-muted-foreground">No formulas generated yet.</p>
        <Button onClick={() => handleGenerate()} disabled={generating}>
          <FlaskConical className="h-4 w-4 mr-2" /> Generate Formulas →
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-20">
      {formulas?.map(f => (
        <FormulaRowBlock key={f.id} formula={f} onApprove={() => approveFormula(f.id)} onReject={() => rejectFormula(f.id)} onDelete={() => deleteFormula(f.id)} onUpdate={updateFormula} onRegenImage={async () => {
          try {
            await supabase.functions.invoke("generate-formula-images", { body: { formulaId: f.id } });
            toast.success("Image regenerated.");
            invalidate();
          } catch (err: any) { toast.error(err.message); }
        }} />
      ))}

      {/* Extra prompt */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Something missing? Add a prompt:</p>
        <Textarea value={extraPrompt} onChange={(e) => setExtraPrompt(e.target.value)} placeholder="e.g. Also include the effective interest method formula and partial period accrual formula." className="text-sm" rows={3} />
        <Button size="sm" onClick={() => handleGenerate(extraPrompt.trim())} disabled={generating || !extraPrompt.trim()}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
          Run Again with This Prompt →
        </Button>
      </div>

      {/* Sticky bulk actions */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border py-2 px-3 flex gap-2 -mx-3">
        <Button size="sm" variant="outline" className="text-xs" onClick={approveAll}><Check className="h-3 w-3 mr-1" /> Approve All ✓</Button>
        <Button size="sm" variant="outline" className="text-xs text-destructive" onClick={rejectAll}><X className="h-3 w-3 mr-1" /> Reject All ✗</Button>
        <Button size="sm" variant="outline" className="text-xs ml-auto" onClick={generateImages} disabled={!!genImagesProgress}>
          {genImagesProgress ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ImageIcon className="h-3.5 w-3.5 mr-1" />}
          {genImagesProgress || "Generate Images →"}
        </Button>
      </div>
    </div>
  );
}

// ── Formula Row ─────────────────────────────────────────────────

function FormulaRowBlock({ formula, onApprove, onReject, onDelete, onUpdate, onRegenImage }: {
  formula: FormulaRow;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  onUpdate: (id: string, field: string, value: string) => void;
  onRegenImage: () => void;
}) {
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState(formula.formula_name);
  const [editExpr, setEditExpr] = useState(false);
  const [expr, setExpr] = useState(formula.formula_expression);
  const [editExpl, setEditExpl] = useState(false);
  const [expl, setExpl] = useState(formula.formula_explanation || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const statusPill = formula.is_approved
    ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] h-5">Approved ✓</Badge>
    : <Badge variant="secondary" className="text-[10px] h-5">Pending</Badge>;

  const hasImage = !!formula.image_url;

  return (
    <div className="rounded-lg border border-border px-3 py-2 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 cursor-grab" />
        {editName ? (
          <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { onUpdate(formula.id, "formula_name", name); setEditName(false); }} onKeyDown={(e) => { if (e.key === "Enter") { onUpdate(formula.id, "formula_name", name); setEditName(false); } }} className="h-6 text-xs w-56 font-semibold" autoFocus />
        ) : (
          <button onClick={() => setEditName(true)} className="text-xs font-semibold text-foreground hover:underline">{formula.formula_name}</button>
        )}
        {statusPill}
        {hasImage && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] h-5">Has Image 🖼</Badge>}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <button onClick={onApprove} className="p-1 rounded hover:bg-emerald-500/20 text-emerald-500 transition-colors" title="Approve"><Check className="h-3.5 w-3.5" /></button>
          <button onClick={onReject} className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors" title="Reject"><X className="h-3.5 w-3.5" /></button>
          {hasImage && <button onClick={onRegenImage} className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors" title="Regen Image">🔄</button>}
          <button onClick={() => setConfirmDelete(true)} className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-1">
          {editExpr ? (
            <Input value={expr} onChange={(e) => setExpr(e.target.value)} onBlur={() => { onUpdate(formula.id, "formula_expression", expr); setEditExpr(false); }} onKeyDown={(e) => { if (e.key === "Enter") { onUpdate(formula.id, "formula_expression", expr); setEditExpr(false); } }} className="h-6 text-xs font-mono text-destructive" autoFocus />
          ) : (
            <button onClick={() => setEditExpr(true)} className="text-xs font-mono text-destructive hover:underline text-left block">{formula.formula_expression}</button>
          )}
          {editExpl ? (
            <Input value={expl} onChange={(e) => setExpl(e.target.value)} onBlur={() => { onUpdate(formula.id, "formula_explanation", expl); setEditExpl(false); }} onKeyDown={(e) => { if (e.key === "Enter") { onUpdate(formula.id, "formula_explanation", expl); setEditExpl(false); } }} className="h-6 text-xs text-muted-foreground" autoFocus />
          ) : (
            <button onClick={() => setEditExpl(true)} className="text-[11px] text-muted-foreground hover:underline text-left block">{formula.formula_explanation || "Add explanation..."}</button>
          )}
        </div>
        {hasImage && (
          <img src={formula.image_url!} alt={formula.formula_name} className="w-20 h-10 object-contain rounded border border-border" />
        )}
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Formula?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Delete "{formula.formula_name}"?</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
            <Button variant="destructive" size="sm" onClick={() => { onDelete(); setConfirmDelete(false); }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
