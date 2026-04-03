import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, ArrowLeft,
  GripHorizontal, X, ChevronDown, ChevronUp, Maximize2, Minimize2,
  SkipForward, Eye, Users, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// ── Constants ────────────────────────────────────────────────────────

const COURSES = [
  { code: "INTRO1", name: "Intro Accounting 1", id: "11111111-1111-1111-1111-111111111111" },
  { code: "INTRO2", name: "Intro Accounting 2", id: "22222222-2222-2222-2222-222222222222" },
  { code: "IA1", name: "Intermediate Accounting 1", id: "33333333-3333-3333-3333-333333333333" },
  { code: "IA2", name: "Intermediate Accounting 2", id: "44444444-4444-4444-4444-444444444444" },
];

// ── Types ────────────────────────────────────────────────────────────

type QAAsset = {
  id: string;
  teaching_asset_id: string;
  asset_name: string;
  chapter_id: string;
  course_id: string;
  qa_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  assigned_to: string | null;
};

type QAIssue = {
  id: string;
  qa_asset_id: string;
  asset_name: string;
  section: string;
  issue_description: string;
  suggested_fix: string | null;
  screenshot_url: string | null;
  fix_status: string;
};

type TeachingAssetDetail = {
  id: string;
  asset_name: string;
  source_ref: string | null;
  flowchart_image_url: string | null;
  journal_entry_completed_json: any;
  supplementary_je_json: any;
  important_formulas: string | null;
  concept_notes: string | null;
  exam_traps: string | null;
  base_raw_problem_id: string | null;
  chapter_id: string;
  chapters: { chapter_number: number; chapter_name: string } | null;
};

type SectionDef = { key: string; label: string; hasContent: boolean };

type VAAccount = { id: string; full_name: string; email: string; role: string };

// ── Helpers ──────────────────────────────────────────────────────────

function buildSections(asset: TeachingAssetDetail | null): SectionDef[] {
  if (!asset) return [];
  return [
    { key: "solution", label: "Solution", hasContent: true },
    { key: "howto", label: "How to Solve", hasContent: !!asset.flowchart_image_url },
    { key: "je", label: "Journal Entries", hasContent: !!asset.journal_entry_completed_json },
    { key: "related_je", label: "Related JE", hasContent: !!asset.supplementary_je_json },
    { key: "formulas", label: "Formulas", hasContent: !!(asset.important_formulas?.trim()) },
    { key: "concepts", label: "Concepts", hasContent: !!(asset.concept_notes?.trim()) },
    { key: "traps", label: "Exam Traps", hasContent: !!(asset.exam_traps?.trim()) },
  ].filter(s => s.hasContent);
}

// ── Draggable hook ───────────────────────────────────────────────────

function useDraggable(initialPos: { x: number; y: number }) {
  const [pos, setPos] = useState(initialPos);
  const posRef = useRef(initialPos);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const pendingPosRef = useRef(initialPos);
  const frameRef = useRef<number | null>(null);

  const paint = useCallback((next: { x: number; y: number }) => {
    pendingPosRef.current = next;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const el = containerRef.current;
      if (!el) return;
      const { x, y } = pendingPosRef.current;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });
  }, []);

  useEffect(() => {
    paint(pos);
  }, [paint, pos]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const endDrag = useCallback((currentTarget?: HTMLDivElement, pointerId?: number) => {
    if (pointerId !== undefined && currentTarget?.hasPointerCapture(pointerId)) {
      currentTarget.releasePointerCapture(pointerId);
    }
    dragRef.current = null;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    setPos(posRef.current);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, label')) return;

    dragRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - posRef.current.x,
      offsetY: e.clientY - posRef.current.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || e.pointerId != dragRef.current.pointerId) return;
    const next = {
      x: e.clientX - dragRef.current.offsetX,
      y: e.clientY - dragRef.current.offsetY,
    };
    posRef.current = next;
    paint(next);
  }, [paint]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || e.pointerId != dragRef.current.pointerId) return;
    endDrag(e.currentTarget, e.pointerId);
  }, [endDrag]);

  const onPointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || e.pointerId != dragRef.current.pointerId) return;
    endDrag(e.currentTarget, e.pointerId);
  }, [endDrag]);

  const resetPos = useCallback((newPos: { x: number; y: number }) => {
    posRef.current = newPos;
    setPos(newPos);
    paint(newPos);
  }, [paint]);

  return { pos, containerRef, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, resetPos };
}

// ── Quick Issue Form ─────────────────────────────────────────────────

function QuickIssueForm({
  section, qaAssetId, assetName, onSaved, onCancel,
}: {
  section: string; qaAssetId: string; assetName: string; onSaved: () => void; onCancel: () => void;
}) {
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!desc.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("solutions_qa_issues" as any).insert({
        qa_asset_id: qaAssetId, asset_name: assetName, section,
        issue_description: desc.trim(), fix_status: "pending",
      });
      if (error) throw error;
      toast.success("Issue logged");
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="pl-5 pr-1 pb-1.5 space-y-1.5 animate-in slide-in-from-top-1 duration-100">
      <Textarea
        value={desc} onChange={e => setDesc(e.target.value)}
        placeholder={`What's wrong with ${section}?`}
        className="text-xs min-h-[32px] resize-y" rows={2} autoFocus
        onKeyDown={e => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && desc.trim()) { e.preventDefault(); save(); }
        }}
      />
      <div className="flex gap-1">
        <Button size="sm" className="text-[10px] h-5 px-2" disabled={!desc.trim() || saving} onClick={save}>Add ⌘↵</Button>
        <Button size="sm" variant="ghost" className="text-[10px] h-5 px-2" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Screenshot Lightbox ──────────────────────────────────────────────

function ScreenshotLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-8" onClick={onClose}>
      <img src={url} alt="Textbook screenshot" className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
      <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white"><X className="h-6 w-6" /></button>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export default function SolutionsQAReview() {
  const qc = useQueryClient();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewerName, setReviewerName] = useState(() => localStorage.getItem("qa-reviewer-name") || "");
  const [nameInput, setNameInput] = useState("");
  const [checkedSections, setCheckedSections] = useState<Set<string>>(new Set());
  const [openIssueSection, setOpenIssueSection] = useState<string | null>(null);
  const [screenshotStep, setScreenshotStep] = useState<"pending" | "done">("pending");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState(() => localStorage.getItem("qa-course-filter") || "all");
  const [showAssignPanel, setShowAssignPanel] = useState(false);

  const { pos, containerRef, onPointerDown, onPointerMove, onPointerUp, onPointerCancel } = useDraggable({ x: 16, y: 60 });

  // ── Fetch VAs ───────────────────────────────────────────────────
  const { data: vaAccounts } = useQuery({
    queryKey: ["va-accounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("va_accounts")
        .select("id, full_name, email, role")
        .eq("account_status", "active")
        .order("full_name");
      if (error) throw error;
      return data as VAAccount[];
    },
  });

  // ── Seed all courses ────────────────────────────────────────────
  const seedMutation = useMutation({
    mutationFn: async (courseId: string) => {
      // Check if already seeded for this course
      const { count } = await supabase
        .from("solutions_qa_assets" as any)
        .select("id", { count: "exact", head: true })
        .eq("course_id", courseId);
      if (count && count > 0) return { seeded: 0 };

      // Paginate to get ALL teaching assets (beyond 1000-row default)
      let allTeachingAssets: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data: page } = await supabase
          .from("teaching_assets")
          .select("id, asset_name, chapter_id, course_id")
          .eq("course_id", courseId)
          .range(from, from + pageSize - 1);
        if (!page?.length) break;
        allTeachingAssets = allTeachingAssets.concat(page);
        if (page.length < pageSize) break;
        from += pageSize;
      }
      if (!allTeachingAssets.length) return { seeded: 0 };
      const assets = allTeachingAssets;

      const records = assets.map(a => ({
        teaching_asset_id: a.id,
        asset_name: a.asset_name,
        chapter_id: a.chapter_id,
        course_id: a.course_id,
        qa_status: "pending",
      }));

      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        const { error } = await supabase.from("solutions_qa_assets" as any).insert(batch);
        if (error) throw error;
      }
      return { seeded: records.length };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["qa-assets"] });
      if (result && result.seeded > 0) toast.success(`Seeded ${result.seeded} assets`);
    },
  });

  const seedAllCourses = useCallback(async () => {
    for (const course of COURSES) {
      await seedMutation.mutateAsync(course.id);
    }
    toast.success("All courses seeded");
  }, [seedMutation]);

  useEffect(() => { seedAllCourses(); }, []);

  // ── Fetch all QA assets ─────────────────────────────────────────
  const { data: allAssetsRaw, isLoading } = useQuery({
    queryKey: ["qa-assets"],
    queryFn: async () => {
      // Paginate to get ALL QA assets (beyond 1000-row default)
      let all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("solutions_qa_assets" as any)
          .select("*")
          .order("asset_name")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data?.length) break;
        all = all.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all as QAAsset[];
    },
  });

  // Filter by selected course
  const allAssets = useMemo(() => {
    if (!allAssetsRaw) return [];
    if (selectedCourseId === "all") return allAssetsRaw;
    return allAssetsRaw.filter(a => a.course_id === selectedCourseId);
  }, [allAssetsRaw, selectedCourseId]);

  const current = allAssets[currentIndex] ?? null;
  const totalReviewed = allAssets.filter(r => r.qa_status !== "pending").length;
  const totalAll = allAssets.length;
  const totalPending = totalAll - totalReviewed;
  const progress = totalAll > 0 ? (totalReviewed / totalAll) * 100 : 0;

  // Per-course stats
  const courseStats = useMemo(() => {
    if (!allAssetsRaw) return {};
    const stats: Record<string, { total: number; reviewed: number; pending: number }> = {};
    for (const c of COURSES) {
      const courseAssets = allAssetsRaw.filter(a => a.course_id === c.id);
      stats[c.id] = {
        total: courseAssets.length,
        reviewed: courseAssets.filter(a => a.qa_status !== "pending").length,
        pending: courseAssets.filter(a => a.qa_status === "pending").length,
      };
    }
    return stats;
  }, [allAssetsRaw]);

  // ── Fetch teaching asset detail ─────────────────────────────────
  const { data: assetDetail } = useQuery({
    queryKey: ["qa-asset-detail", current?.teaching_asset_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teaching_assets")
        .select(`
          id, asset_name, source_ref, flowchart_image_url,
          journal_entry_completed_json, supplementary_je_json,
          important_formulas, concept_notes, exam_traps,
          base_raw_problem_id, chapter_id,
          chapters(chapter_number, chapter_name)
        `)
        .eq("id", current!.teaching_asset_id)
        .single();
      if (error) throw error;
      return data as unknown as TeachingAssetDetail;
    },
    enabled: !!current?.teaching_asset_id,
  });

  // ── Fetch screenshot ────────────────────────────────────────────
  const { data: screenshotUrl } = useQuery({
    queryKey: ["qa-screenshot", assetDetail?.base_raw_problem_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_problems")
        .select("problem_screenshot_url, problem_screenshot_urls")
        .eq("id", assetDetail!.base_raw_problem_id!)
        .single();
      if (error) return null;
      return data?.problem_screenshot_url || (data?.problem_screenshot_urls as string[])?.[0] || null;
    },
    enabled: !!assetDetail?.base_raw_problem_id,
  });

  // ── Fetch issues ────────────────────────────────────────────────
  const { data: currentIssues } = useQuery({
    queryKey: ["qa-issues", current?.id],
    queryFn: async () => {
      if (!current) return [];
      const { data, error } = await supabase
        .from("solutions_qa_issues" as any)
        .select("*")
        .eq("qa_asset_id", current.id)
        .order("created_at");
      if (error) throw error;
      return (data as any[]) as QAIssue[];
    },
    enabled: !!current?.id,
  });

  const sections = useMemo(() => buildSections(assetDetail ?? null), [assetDetail]);
  const hasScreenshot = !!screenshotUrl;
  const issueCount = currentIssues?.length ?? 0;
  const isPending = current?.qa_status === "pending";

  // ── Assign VA to course ─────────────────────────────────────────
  const assignMutation = useMutation({
    mutationFn: async ({ courseId, assignee }: { courseId: string; assignee: string }) => {
      const { error } = await supabase
        .from("solutions_qa_assets" as any)
        .update({ assigned_to: assignee })
        .eq("course_id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-assets"] });
      toast.success("Assignment saved");
    },
  });

  // ── Reset state on asset change ─────────────────────────────────
  useEffect(() => {
    setCheckedSections(new Set());
    setOpenIssueSection(null);
    setScreenshotStep(hasScreenshot ? "pending" : "done");
  }, [current?.id, hasScreenshot]);

  useEffect(() => {
    if (screenshotStep === "done" && iframeRef.current) {
      const timer = setTimeout(() => {
        iframeRef.current?.contentWindow?.postMessage({ type: "QA_OPEN_ALL_TOGGLES" }, "*");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [screenshotStep, current?.id]);

  // ── Delete issue ────────────────────────────────────────────────
  const deleteIssueMutation = useMutation({
    mutationFn: async (issueId: string) => {
      const { error } = await supabase.from("solutions_qa_issues" as any).delete().eq("id", issueId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["qa-issues", current?.id] }); },
  });

  // ── Mark and advance ────────────────────────────────────────────
  const markAndAdvance = useCallback(async (forceStatus?: "reviewed_issues") => {
    if (!current) return;
    const { count } = await supabase
      .from("solutions_qa_issues" as any)
      .select("id", { count: "exact", head: true })
      .eq("qa_asset_id", current.id);
    const finalStatus = forceStatus || ((count && count > 0) ? "reviewed_issues" : "reviewed_clean");
    const { error } = await supabase
      .from("solutions_qa_assets" as any)
      .update({ qa_status: finalStatus, reviewed_at: new Date().toISOString(), reviewed_by: reviewerName || "VA" })
      .eq("id", current.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["qa-assets"] });
    toast.success(finalStatus === "reviewed_clean" ? "✓ Clean" : "⚠ Issues saved");
    const nextPending = allAssets.findIndex((r, i) => i > currentIndex && r.qa_status === "pending");
    if (nextPending >= 0) setCurrentIndex(nextPending);
    else if (currentIndex < allAssets.length - 1) setCurrentIndex(i => i + 1);
  }, [current, currentIndex, allAssets, reviewerName, qc]);

  const jumpToNextPending = useCallback(() => {
    const next = allAssets.findIndex((r, i) => i > currentIndex && r.qa_status === "pending");
    if (next >= 0) setCurrentIndex(next);
    else {
      const fromStart = allAssets.findIndex(r => r.qa_status === "pending");
      if (fromStart >= 0) setCurrentIndex(fromStart);
      else toast.info("All assets reviewed!");
    }
  }, [allAssets, currentIndex]);

  const handleScreenshotMatch = useCallback(async (result: "yes" | "almost" | "no") => {
    if ((result === "almost" || result === "no") && current) {
      await supabase.from("solutions_qa_issues" as any).insert({
        qa_asset_id: current.id, asset_name: current.asset_name, section: "Problem Text",
        issue_description: result === "almost" ? "Problem text minor mismatch with textbook" : "Problem text does not match textbook",
        fix_status: "pending",
      });
      qc.invalidateQueries({ queryKey: ["qa-issues", current.id] });
    }
    setScreenshotStep("done");
  }, [current, qc]);

  const checkAll = useCallback(() => {
    setCheckedSections(new Set(sections.map(s => s.key)));
  }, [sections]);

  // ── Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    if (!reviewerName) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;

      if (screenshotStep === "pending" && hasScreenshot) {
        if (e.key === "y" || e.key === "Y") { e.preventDefault(); handleScreenshotMatch("yes"); return; }
        if (e.key === "a" || e.key === "A") { e.preventDefault(); handleScreenshotMatch("almost"); return; }
        if (e.key === "n" || e.key === "N") { e.preventDefault(); handleScreenshotMatch("no"); return; }
      }

      if (e.key === "ArrowRight" || e.key === ".") { e.preventDefault(); setCurrentIndex(i => Math.min(allAssets.length - 1, i + 1)); }
      else if (e.key === "ArrowLeft" || e.key === ",") { e.preventDefault(); setCurrentIndex(i => Math.max(0, i - 1)); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); markAndAdvance(); }
      else if (e.key === "s" || e.key === "S") { e.preventDefault(); jumpToNextPending(); }

      if (screenshotStep === "done") {
        const num = parseInt(e.key);
        if (num >= 1 && num <= sections.length) {
          e.preventDefault();
          if (e.shiftKey) { setOpenIssueSection(sections[num - 1].label); }
          else {
            setCheckedSections(prev => {
              const next = new Set(prev);
              if (next.has(sections[num - 1].key)) next.delete(sections[num - 1].key);
              else next.add(sections[num - 1].key);
              return next;
            });
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [reviewerName, screenshotStep, hasScreenshot, handleScreenshotMatch, allAssets.length, markAndAdvance, jumpToNextPending, sections]);

  // ── Course change handler ───────────────────────────────────────
  const handleCourseChange = (val: string) => {
    setSelectedCourseId(val);
    localStorage.setItem("qa-course-filter", val);
    setCurrentIndex(0);
  };

  // ── Loading ─────────────────────────────────────────────────────
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen bg-background text-muted-foreground text-sm">Loading QA records...</div>;
  }

  // ── No reviewer yet — show setup ───────────────────────────────
  if (!reviewerName) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="bg-card border border-border rounded-xl p-8 w-full max-w-md shadow-lg space-y-6">
          <div>
            <Link to="/dashboard" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="h-3 w-3" /> Back
            </Link>
            <h1 className="text-xl font-bold text-foreground">Solutions QA Review</h1>
            <p className="text-sm text-muted-foreground mt-1">Before expanding to new universities</p>
          </div>

          {/* Course stats */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Course Progress</p>
            {COURSES.map(c => {
              const s = courseStats[c.id];
              const pct = s && s.total > 0 ? (s.reviewed / s.total) * 100 : 0;
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold w-14 text-foreground">{c.code}</span>
                  <Progress value={pct} className="flex-1 h-1.5" />
                  <span className="text-[10px] text-muted-foreground w-20 text-right">
                    {s ? `${s.reviewed}/${s.total}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* VA Assignment panel */}
          <div className="space-y-2 border-t border-border pt-4">
            <button
              onClick={() => setShowAssignPanel(!showAssignPanel)}
              className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground"
            >
              <Users className="h-3 w-3" />
              Assign VA's to Courses
              {showAssignPanel ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {showAssignPanel && (
              <div className="space-y-2 mt-2">
                {COURSES.map(c => {
                  // Find current assignment
                  const assignedAsset = allAssetsRaw?.find(a => a.course_id === c.id && a.assigned_to);
                  const currentAssignee = assignedAsset?.assigned_to || "";
                  return (
                    <div key={c.id} className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold w-14 text-foreground">{c.code}</span>
                      <Select
                        value={currentAssignee}
                        onValueChange={(val) => assignMutation.mutate({ courseId: c.id, assignee: val })}
                      >
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Lee">Lee (Admin)</SelectItem>
                          {vaAccounts?.map(va => (
                            <SelectItem key={va.id} value={va.full_name}>{va.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Name entry */}
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-semibold text-foreground">Your name to start</p>
            <Input
              value={nameInput} onChange={e => setNameInput(e.target.value)}
              placeholder="Enter your name" className="text-sm h-9" autoFocus
              onKeyDown={e => {
                if (e.key === "Enter" && nameInput.trim()) {
                  localStorage.setItem("qa-reviewer-name", nameInput.trim());
                  setReviewerName(nameInput.trim());
                }
              }}
            />
          </div>

          {/* Course selector */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Start reviewing</p>
            <Select value={selectedCourseId} onValueChange={handleCourseChange}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {COURSES.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full h-10"
            disabled={!nameInput.trim()}
            onClick={() => {
              localStorage.setItem("qa-reviewer-name", nameInput.trim());
              setReviewerName(nameInput.trim());
            }}
          >
            Start Reviewing →
          </Button>
        </div>
      </div>
    );
  }

  if (!allAssets.length) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-3">
        <p className="text-muted-foreground text-sm">No QA records for this filter.</p>
        <div className="flex gap-2">
          <Select value={selectedCourseId} onValueChange={handleCourseChange}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {COURSES.map(c => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => seedAllCourses()}>
            <RefreshCw className="h-3 w-3 mr-1" /> Seed
          </Button>
        </div>
      </div>
    );
  }

  const courseCode = COURSES.find(c => c.id === current?.course_id)?.code || "";

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen overflow-hidden relative bg-background">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-[55] h-10 bg-card/95 backdrop-blur border-b border-border flex items-center px-3 gap-3">
        <Link to="/dashboard" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <ArrowLeft className="h-3 w-3" /> Back
        </Link>

        {/* Course filter */}
        <Select value={selectedCourseId} onValueChange={handleCourseChange}>
          <SelectTrigger className="h-6 text-[10px] w-28 border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {COURSES.map(c => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Progress value={progress} className="flex-1 h-1.5 max-w-[200px]" />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {totalReviewed}/{totalAll} done · {totalPending} left
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">👤 {reviewerName}</span>
        <button
          onClick={() => { localStorage.removeItem("qa-reviewer-name"); setReviewerName(""); }}
          className="text-[9px] text-muted-foreground/50 hover:text-foreground"
        >
          Switch
        </button>
      </div>

      {/* Full-screen iframe — PAID version (no preview param) with ref=lw for DRM bypass */}
      {current && (
        <iframe
          ref={iframeRef}
          key={current.asset_name}
          src={`/solutions/${current.asset_name}?ref=lw&qa=1`}
          className="w-full h-full border-0 pt-10"
          title={`Solutions: ${current.asset_name}`}
        />
      )}

      {/* Lightbox */}
      {lightboxUrl && <ScreenshotLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      {/* Floating QA Modal */}
      <div
        ref={containerRef}
        className={`fixed left-0 top-0 z-50 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden will-change-transform ${
          isMinimized ? "w-[200px]" : "w-[300px] max-h-[85vh]"
        }`}
        style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` }}
      >
        {/* Drag handle */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className="flex items-center justify-between px-2.5 py-1.5 border-b border-border bg-muted/30 shrink-0 cursor-grab active:cursor-grabbing select-none touch-none"
        >
          <div className="flex items-center gap-1.5">
            <GripHorizontal className="h-3 w-3 text-muted-foreground/40" />
            <Badge variant="outline" className="text-[8px] h-4 px-1 font-mono">{courseCode}</Badge>
            <span className="font-mono font-bold text-[11px] text-foreground truncate max-w-[120px]">
              {current?.asset_name || "—"}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            {!isPending && <Badge className="text-[8px] h-4 px-1 bg-emerald-500/20 text-emerald-400 mr-1">done</Badge>}
            <button onClick={() => setIsMinimized(prev => !prev)} className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
              {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {isMinimized ? (
          <div className="p-2 text-center">
            <span className="text-[10px] text-muted-foreground">{currentIndex + 1}/{totalAll}</span>
          </div>
        ) : (
          <>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {/* Nav row */}
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border">
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" disabled={currentIndex <= 0} onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-[10px] text-muted-foreground font-mono">{currentIndex + 1}/{totalAll}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" disabled={currentIndex >= allAssets.length - 1} onClick={() => setCurrentIndex(i => Math.min(allAssets.length - 1, i + 1))}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-muted-foreground" onClick={jumpToNextPending} title="Skip to next pending [S]">
                  <SkipForward className="h-3 w-3 mr-0.5" /> Next Pending
                </Button>
              </div>

              {/* Chapter info */}
              {assetDetail?.chapters && (
                <div className="px-2.5 py-1 border-b border-border">
                  <span className="text-[10px] text-muted-foreground">
                    Ch {assetDetail.chapters.chapter_number} · {assetDetail.source_ref || ""}
                  </span>
                </div>
              )}

              {/* Step 1: Screenshot comparison */}
              {screenshotStep === "pending" && hasScreenshot && (
                <div className="px-2.5 py-2.5 border-b border-border space-y-2">
                  <p className="text-[10px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="h-3 w-3 text-destructive" /> Compare with Textbook
                  </p>
                  <div
                    className="w-full max-h-[120px] rounded-lg border border-border overflow-hidden cursor-pointer bg-muted/20 hover:opacity-90 transition-opacity"
                    onClick={() => setLightboxUrl(screenshotUrl!)}
                  >
                    <img src={screenshotUrl!} alt="Textbook" className="w-full h-full object-contain" />
                  </div>
                  <p className="text-[11px] text-foreground font-medium">Match textbook?</p>
                  <div className="flex gap-1">
                    <Button size="sm" className="flex-1 text-[10px] h-6 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleScreenshotMatch("yes")}>Yes [Y]</Button>
                    <Button size="sm" variant="outline" className="flex-1 text-[10px] h-6 border-amber-500/30 text-amber-600" onClick={() => handleScreenshotMatch("almost")}>~ish [A]</Button>
                    <Button size="sm" variant="outline" className="flex-1 text-[10px] h-6 border-destructive/30 text-destructive" onClick={() => handleScreenshotMatch("no")}>No [N]</Button>
                  </div>
                </div>
              )}

              {/* Step 2: Section checklist */}
              {screenshotStep === "done" && (
                <div className="px-2.5 py-2 space-y-0.5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                      Sections ({checkedSections.size}/{sections.length})
                    </p>
                    {sections.length > 0 && checkedSections.size < sections.length && (
                      <button onClick={checkAll} className="text-[9px] text-emerald-500 hover:text-emerald-400 font-medium">Check All ✓</button>
                    )}
                  </div>

                  {sections.map((sec, idx) => {
                    const checked = checkedSections.has(sec.key);
                    return (
                      <div key={sec.key}>
                        <div className="flex items-center gap-1.5 py-1 px-1 rounded group hover:bg-muted/30 transition-colors">
                          <button
                            onClick={() => {
                              setCheckedSections(prev => {
                                const next = new Set(prev);
                                if (next.has(sec.key)) next.delete(sec.key); else next.add(sec.key);
                                return next;
                              });
                            }}
                            className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              checked ? "bg-emerald-600 border-emerald-600" : "border-border hover:border-foreground/50"
                            }`}
                          >
                            {checked && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                          </button>
                          <span className={`text-[11px] flex-1 ${checked ? "text-muted-foreground line-through" : "text-foreground"}`}>{sec.label}</span>
                          <span className="text-[8px] text-muted-foreground/40 font-mono">{idx + 1}</span>
                          <button
                            onClick={() => setOpenIssueSection(openIssueSection === sec.label ? null : sec.label)}
                            className="text-amber-500 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            title={`Report issue with ${sec.label}`}
                          >
                            <AlertTriangle className="h-3 w-3" />
                          </button>
                        </div>
                        {openIssueSection === sec.label && current && (
                          <QuickIssueForm
                            section={sec.label} qaAssetId={current.id} assetName={current.asset_name}
                            onSaved={() => { setOpenIssueSection(null); qc.invalidateQueries({ queryKey: ["qa-issues", current.id] }); }}
                            onCancel={() => setOpenIssueSection(null)}
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* Logged issues */}
                  {issueCount > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-border space-y-0.5">
                      <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">
                        {issueCount} issue{issueCount !== 1 ? "s" : ""}
                      </p>
                      {currentIssues?.map(issue => (
                        <div key={issue.id} className="flex items-center gap-1 text-[10px] bg-amber-500/5 rounded px-1.5 py-0.5">
                          <span className="text-amber-500 font-medium shrink-0">{issue.section}:</span>
                          <span className="truncate text-foreground/80">{issue.issue_description}</span>
                          <button onClick={() => deleteIssueMutation.mutate(issue.id)} className="ml-auto shrink-0 text-destructive/60 hover:text-destructive">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Shortcuts */}
              <div className="px-2.5 py-1 border-t border-border">
                <button onClick={() => setShowShortcuts(!showShortcuts)} className="flex items-center gap-1 text-[9px] text-muted-foreground/60 hover:text-muted-foreground w-full">
                  {showShortcuts ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />} Keys
                </button>
                {showShortcuts && (
                  <div className="mt-0.5 text-[9px] text-muted-foreground/60 space-y-0">
                    <p><kbd className="font-mono bg-muted px-0.5 rounded">1-7</kbd> check · <kbd className="font-mono bg-muted px-0.5 rounded">⇧+#</kbd> issue</p>
                    <p><kbd className="font-mono bg-muted px-0.5 rounded">→</kbd> next · <kbd className="font-mono bg-muted px-0.5 rounded">←</kbd> prev · <kbd className="font-mono bg-muted px-0.5 rounded">S</kbd> skip</p>
                    <p><kbd className="font-mono bg-muted px-0.5 rounded">Enter/Space</kbd> submit & next</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky bottom action */}
            {screenshotStep === "done" && (
              <div className="shrink-0 border-t border-border bg-card px-2.5 py-2 space-y-1">
                {issueCount === 0 ? (
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8" onClick={() => markAndAdvance()}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> All Good — Next →
                  </Button>
                ) : (
                  <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs h-8" onClick={() => markAndAdvance("reviewed_issues")}>
                    <AlertTriangle className="h-3 w-3 mr-1" /> Save {issueCount} Issue{issueCount !== 1 ? "s" : ""} & Next →
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
