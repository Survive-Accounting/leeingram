import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, ArrowLeft,
  GripHorizontal, Upload, X, ChevronDown, ChevronUp, Search, Maximize2, Minimize2,
} from "lucide-react";
import { toast } from "sonner";

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

type SectionDef = {
  key: string;
  label: string;
  hasContent: boolean;
};

// ── Section helpers ──────────────────────────────────────────────────

function buildSections(asset: TeachingAssetDetail | null): SectionDef[] {
  if (!asset) return [];
  const sections: SectionDef[] = [
    { key: "solution", label: "Reveal Solution", hasContent: true },
    { key: "howto", label: "Reveal How to Solve This", hasContent: !!asset.flowchart_image_url },
    { key: "je", label: "Reveal Journal Entries", hasContent: !!asset.journal_entry_completed_json },
    { key: "related_je", label: "Reveal Related Journal Entries", hasContent: !!asset.supplementary_je_json },
    { key: "formulas", label: "Reveal Important Formulas", hasContent: !!(asset.important_formulas?.trim()) },
    { key: "concepts", label: "Reveal Key Concepts", hasContent: !!(asset.concept_notes?.trim()) },
    { key: "traps", label: "Reveal Exam Traps", hasContent: !!(asset.exam_traps?.trim()) },
  ];
  return sections.filter(s => s.hasContent);
}

// ── Draggable hook ───────────────────────────────────────────────────

function useDraggable(initialPos: { x: number; y: number }) {
  const [pos, setPos] = useState(initialPos);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const resetPos = useCallback((newPos: { x: number; y: number }) => {
    setPos(newPos);
  }, []);

  return { pos, onMouseDown, resetPos };
}

// ── Inline Issue Form ────────────────────────────────────────────────

function InlineIssueForm({
  section,
  qaAssetId,
  assetName,
  onSaved,
  onCancel,
}: {
  section: string;
  qaAssetId: string;
  assetName: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [desc, setDesc] = useState("");
  const [fix, setFix] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `qa/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("qa-screenshots").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("qa-screenshots").getPublicUrl(path);
      setScreenshotUrl(data.publicUrl);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!desc.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("solutions_qa_issues" as any).insert({
        qa_asset_id: qaAssetId,
        asset_name: assetName,
        section,
        issue_description: desc.trim(),
        suggested_fix: fix.trim() || null,
        screenshot_url: screenshotUrl,
        fix_status: "pending",
      });
      if (error) throw error;
      toast.success("Issue added");
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pl-6 pr-2 pb-2 space-y-2 animate-in slide-in-from-top-1 duration-150">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{section}</p>
      <Textarea
        value={desc}
        onChange={e => setDesc(e.target.value)}
        placeholder="Describe the issue..."
        className="text-xs min-h-[40px] resize-y"
        rows={2}
        autoFocus
      />
      <Textarea
        value={fix}
        onChange={e => setFix(e.target.value)}
        placeholder="Suggest a fix (optional)..."
        className="text-xs min-h-[28px] resize-y"
        rows={1}
      />
      <div className="flex items-center gap-2">
        <label className="cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" asChild disabled={uploading}>
            <span><Upload className="h-2.5 w-2.5 mr-1" />{uploading ? "..." : "Screenshot"}</span>
          </Button>
        </label>
        {screenshotUrl && (
          <div className="relative inline-block">
            <img src={screenshotUrl} alt="" className="max-h-6 rounded border border-border" />
            <button onClick={() => setScreenshotUrl(null)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
              <X className="h-2 w-2" />
            </button>
          </div>
        )}
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" className="text-[10px] h-6 px-2" disabled={!desc.trim() || saving} onClick={save}>
          Add Issue →
        </Button>
        <Button size="sm" variant="ghost" className="text-[10px] h-6 px-2" onClick={onCancel}>
          Cancel
        </Button>
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
      <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white">
        <X className="h-6 w-6" />
      </button>
    </div>
  );
}

// ── Scroll Down Reminder ─────────────────────────────────────────────

function ScrollDownReminder() {
  return (
    <div className="fixed z-[45] left-1/2 -translate-x-1/2 bottom-24 pointer-events-none animate-bounce">
      <div className="bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-semibold">
        <ChevronDown className="h-4 w-4" />
        Scroll Down to Check All Sections
        <ChevronDown className="h-4 w-4" />
      </div>
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
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeChecklistIdx, setActiveChecklistIdx] = useState(0);

  // Position modal on left side by default
  const { pos, onMouseDown, resetPos } = useDraggable({
    x: 16,
    y: 80,
  });

  // ── Seed IA2 records ────────────────────────────────────────────
  const seedMutation = useMutation({
    mutationFn: async () => {
      const { count } = await supabase
        .from("solutions_qa_assets" as any)
        .select("id", { count: "exact", head: true });
      if (count && count > 0) return;

      const { data: ia2Courses } = await supabase.from("courses").select("id").ilike("course_name", "%Intermediate Accounting 2%");
      if (!ia2Courses?.length) return;
      const courseId = ia2Courses[0].id;

      const { data: assets } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, chapter_id, course_id")
        .eq("course_id", courseId);
      if (!assets?.length) return;

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
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-assets"] }),
  });

  useEffect(() => { seedMutation.mutate(); }, []);

  // ── Fetch all QA assets ─────────────────────────────────────────
  const { data: allAssets, isLoading } = useQuery({
    queryKey: ["qa-assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solutions_qa_assets" as any)
        .select("*")
        .order("asset_name");
      if (error) throw error;
      return (data as any[]) as QAAsset[];
    },
  });

  const current = allAssets?.[currentIndex] ?? null;
  const totalReviewed = allAssets?.filter(r => r.qa_status !== "pending").length ?? 0;
  const totalAll = allAssets?.length ?? 0;
  const progress = totalAll > 0 ? (totalReviewed / totalAll) * 100 : 0;

  // ── Fetch teaching asset detail for current ─────────────────────
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

  // ── Fetch screenshot from chapter_problems ──────────────────────
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

  // ── Fetch issues for current asset ──────────────────────────────
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
  const issueSectionCounts = useMemo(() => {
    const map: Record<string, number> = {};
    currentIssues?.forEach(i => { map[i.section] = (map[i.section] || 0) + 1; });
    return map;
  }, [currentIssues]);

  // Determine which section is "active" — the first unchecked one
  const activeSection = useMemo(() => {
    if (screenshotStep !== "done") return null;
    for (let i = 0; i < sections.length; i++) {
      if (!checkedSections.has(sections[i].key)) return i;
    }
    return null; // all checked
  }, [sections, checkedSections, screenshotStep]);

  // Show scroll reminder when there's an active section beyond the first
  const showScrollReminder = activeSection !== null && activeSection > 0 && checkedSections.size > 0;

  // ── Reset state on asset change ─────────────────────────────────
  useEffect(() => {
    setCheckedSections(new Set());
    setOpenIssueSection(null);
    setScreenshotStep(hasScreenshot ? "pending" : "done");
    setActiveChecklistIdx(0);
  }, [current?.id, hasScreenshot]);

  // Auto-move modal to left when entering checklist step
  useEffect(() => {
    if (screenshotStep === "done" && reviewerName) {
      resetPos({ x: 16, y: 80 });
    }
  }, [screenshotStep, current?.id]);

  // ── Post message to iframe to open all toggles ──────────────────
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-issues", current?.id] });
    },
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
      .update({
        qa_status: finalStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewerName || "VA",
      })
      .eq("id", current.id);
    if (error) { toast.error(error.message); return; }

    qc.invalidateQueries({ queryKey: ["qa-assets"] });
    qc.invalidateQueries({ queryKey: ["qa-pending-count"] });
    toast.success(finalStatus === "reviewed_clean" ? "Marked clean ✓" : "Issues flagged ⚠");

    // Advance to next pending
    if (!allAssets) return;
    const nextPending = allAssets.findIndex((r, i) => i > currentIndex && r.qa_status === "pending");
    if (nextPending >= 0) setCurrentIndex(nextPending);
    else if (currentIndex < allAssets.length - 1) setCurrentIndex(i => i + 1);
  }, [current, currentIndex, allAssets, reviewerName, qc]);

  // ── Screenshot comparison handlers ──────────────────────────────
  const handleScreenshotMatch = useCallback(async (result: "yes" | "almost" | "no") => {
    if (result === "almost" && current) {
      await supabase.from("solutions_qa_issues" as any).insert({
        qa_asset_id: current.id,
        asset_name: current.asset_name,
        section: "Problem Text",
        issue_description: "Problem text does not fully match textbook screenshot — minor differences",
        fix_status: "pending",
      });
      qc.invalidateQueries({ queryKey: ["qa-issues", current.id] });
    } else if (result === "no" && current) {
      await supabase.from("solutions_qa_issues" as any).insert({
        qa_asset_id: current.id,
        asset_name: current.asset_name,
        section: "Problem Text",
        issue_description: "Problem text does not match textbook screenshot",
        fix_status: "pending",
      });
      qc.invalidateQueries({ queryKey: ["qa-issues", current.id] });
    }
    setScreenshotStep("done");
  }, [current, qc]);

  // ── Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    if (!reviewerName) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;

      // Screenshot step shortcuts
      if (screenshotStep === "pending" && hasScreenshot) {
        if (e.key === "y" || e.key === "Y") { e.preventDefault(); handleScreenshotMatch("yes"); return; }
        if (e.key === "a" || e.key === "A") { e.preventDefault(); handleScreenshotMatch("almost"); return; }
        if (e.key === "n" || e.key === "N") { e.preventDefault(); handleScreenshotMatch("no"); return; }
      }

      // Navigation
      if (e.key === "ArrowRight" || e.key === ".") {
        e.preventDefault();
        setCurrentIndex(i => Math.min((allAssets?.length ?? 1) - 1, i + 1));
      } else if (e.key === "ArrowLeft" || e.key === ",") {
        e.preventDefault();
        setCurrentIndex(i => Math.max(0, i - 1));
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        markAndAdvance();
      }

      // Number keys for checklist
      if (screenshotStep === "done") {
        const num = parseInt(e.key);
        if (num >= 1 && num <= sections.length) {
          e.preventDefault();
          if (e.shiftKey) {
            setOpenIssueSection(sections[num - 1].label);
          } else {
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
  }, [reviewerName, screenshotStep, hasScreenshot, handleScreenshotMatch, allAssets?.length, markAndAdvance, sections]);

  // ── Loading ─────────────────────────────────────────────────────
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen bg-background text-muted-foreground text-sm">Loading QA records...</div>;
  }

  if (!allAssets?.length) {
    return <div className="flex items-center justify-center h-screen bg-background text-muted-foreground text-sm">No QA records found.</div>;
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen overflow-hidden relative bg-background">
      {/* Back button */}
      <Link
        to="/dashboard"
        className="fixed top-3 left-3 z-[55] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/90 backdrop-blur border border-border text-xs text-muted-foreground hover:text-foreground transition-colors shadow-md"
      >
        <ArrowLeft className="h-3 w-3" /> Back to Admin
      </Link>

      {/* Red border overlay on problem text area during Step 1 */}
      {screenshotStep === "pending" && hasScreenshot && (
        <div
          className="fixed z-[42] pointer-events-none"
          style={{
            left: 0,
            top: 60,
            width: "45%",
            bottom: 60,
          }}
        >
          <div className="w-full h-full border-4 border-destructive rounded-lg animate-pulse opacity-70" />
        </div>
      )}

      {/* Red border overlay on active section toggle during checklist */}
      {screenshotStep === "done" && activeSection !== null && (
        <div
          className="fixed z-[42] pointer-events-none"
          style={{
            // Target the right-side content area where toggles live
            right: 0,
            left: "40%",
            top: 60,
            bottom: 60,
          }}
        >
          <div className="w-full h-full border-4 border-destructive/60 rounded-lg animate-pulse" />
        </div>
      )}

      {/* Scroll Down reminder when checking sections beyond the first */}
      {showScrollReminder && <ScrollDownReminder />}

      {/* Full-screen iframe */}
      {current && (
        <iframe
          ref={iframeRef}
          key={current.asset_name}
          src={`https://learn.surviveaccounting.com/solutions/${current.asset_name}`}
          className="w-full h-full border-0"
          title={`Solutions: ${current.asset_name}`}
        />
      )}

      {/* Lightbox */}
      {lightboxUrl && <ScreenshotLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      {/* Floating QA Modal */}
      <div
        className={`fixed z-50 bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isMaximized
            ? "inset-4 w-auto h-auto max-h-none"
            : "w-[320px] max-h-[80vh]"
        }`}
        style={isMaximized ? undefined : { left: pos.x, top: pos.y }}
      >
        {/* Drag handle + maximize */}
        <div
          onMouseDown={isMaximized ? undefined : onMouseDown}
          className={`flex items-center justify-center py-1.5 border-b border-border bg-muted/30 shrink-0 ${isMaximized ? "" : "cursor-grab active:cursor-grabbing"}`}
        >
          <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground/50" />
          <button
            onClick={() => setIsMaximized(prev => !prev)}
            className="absolute right-2 top-1.5 p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            title={isMaximized ? "Minimize" : "Maximize"}
          >
            {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Reviewer setup */}
          {!reviewerName ? (
            <div className="p-5 space-y-3">
              <p className="text-sm font-semibold text-foreground">What's your name?</p>
              <Input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="Your name"
                className="text-sm"
                autoFocus
                onKeyDown={e => {
                  if (e.key === "Enter" && nameInput.trim()) {
                    localStorage.setItem("qa-reviewer-name", nameInput.trim());
                    setReviewerName(nameInput.trim());
                  }
                }}
              />
              <Button
                size="sm"
                className="w-full"
                disabled={!nameInput.trim()}
                onClick={() => {
                  localStorage.setItem("qa-reviewer-name", nameInput.trim());
                  setReviewerName(nameInput.trim());
                }}
              >
                Start Reviewing →
              </Button>
            </div>
          ) : (
            <>
              {/* Asset header */}
              <div className="px-3 py-2.5 border-b border-border space-y-1.5 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-foreground text-xs truncate max-w-[180px]">
                    {current?.asset_name}
                  </span>
                  <span className="text-[9px] text-muted-foreground">{reviewerName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {assetDetail?.chapters && (
                    <span className="text-[10px] text-muted-foreground">
                      Ch {assetDetail.chapters.chapter_number} · {assetDetail?.source_ref || ""}
                    </span>
                  )}
                  <Badge variant="outline" className="text-[9px] ml-auto">
                    {current?.qa_status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={progress} className="flex-1 h-1.5" />
                  <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                    {totalReviewed}/{totalAll}
                  </span>
                </div>
                {/* Navigation */}
                <div className="flex items-center gap-1 pt-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={currentIndex <= 0}
                    onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-[10px] text-muted-foreground">
                    {currentIndex + 1} / {totalAll}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={currentIndex >= (allAssets?.length ?? 1) - 1}
                    onClick={() => setCurrentIndex(i => Math.min((allAssets?.length ?? 1) - 1, i + 1))}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Step 1: Screenshot comparison */}
              {screenshotStep === "pending" && hasScreenshot && (
                <div className="px-3 py-3 border-b border-border space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Step 1: Screenshot Comparison
                  </p>
                  <div className="text-[9px] text-destructive font-semibold flex items-center gap-1 animate-pulse">
                    <ChevronLeft className="h-3 w-3" /> Check the problem text area (red border)
                  </div>
                  <div
                    className="w-full max-h-[160px] rounded-lg border border-border overflow-hidden cursor-pointer bg-muted/20"
                    onClick={() => setLightboxUrl(screenshotUrl!)}
                  >
                    <img
                      src={screenshotUrl!}
                      alt="Textbook screenshot"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-xs text-foreground font-medium">
                    Does the problem text match the textbook?
                  </p>
                  <div className="flex gap-1.5">
                    <Button size="sm" className="flex-1 text-[10px] h-7 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleScreenshotMatch("yes")}>
                      ✓ Yes <span className="ml-1 opacity-50">[Y]</span>
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-[10px] h-7 border-amber-500/30 text-amber-600" onClick={() => handleScreenshotMatch("almost")}>
                      ~ Almost <span className="ml-1 opacity-50">[A]</span>
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-[10px] h-7 border-destructive/30 text-destructive" onClick={() => handleScreenshotMatch("no")}>
                      ✗ No <span className="ml-1 opacity-50">[N]</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* No screenshot note */}
              {screenshotStep === "done" && !hasScreenshot && (
                <div className="px-3 py-1.5">
                  <p className="text-[9px] text-muted-foreground italic">
                    No textbook screenshot available for this asset.
                  </p>
                </div>
              )}

              {/* Step 2: Section checklist — sequential guided review */}
              {screenshotStep === "done" && (
                <div className="px-3 py-2 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Section Checklist
                  </p>
                  {sections.map((sec, idx) => {
                    const checked = checkedSections.has(sec.key);
                    const sectionIssueCount = issueSectionCounts[sec.label] || 0;
                    const isActive = activeSection === idx;
                    const isPast = checked;
                    const isFuture = !checked && activeSection !== null && idx > activeSection;

                    return (
                      <div key={sec.key}>
                        <div
                          className={`flex items-center gap-2 py-1.5 px-1.5 rounded-md group transition-all ${
                            isActive
                              ? "bg-destructive/10 border border-destructive/40 shadow-sm"
                              : ""
                          } ${isFuture ? "opacity-40" : ""}`}
                        >
                          <button
                            onClick={() => {
                              setCheckedSections(prev => {
                                const next = new Set(prev);
                                if (next.has(sec.key)) next.delete(sec.key);
                                else next.add(sec.key);
                                return next;
                              });
                            }}
                            className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              checked ? "bg-emerald-600 border-emerald-600" : isActive ? "border-destructive ring-1 ring-destructive/30" : "border-border hover:border-foreground/50"
                            }`}
                          >
                            {checked && <CheckCircle2 className="h-3 w-3 text-white" />}
                          </button>
                          <span className={`text-xs flex-1 truncate ${
                            checked ? "text-muted-foreground line-through" : isActive ? "text-foreground font-medium" : "text-foreground"
                          }`}>
                            {sec.label.replace("Reveal ", "")}
                          </span>
                          <span className="text-[9px] text-muted-foreground/50 font-mono">[{idx + 1}]</span>
                          {isActive && !checked && (
                            <span className="text-[8px] text-destructive font-semibold animate-pulse">◀ CHECK</span>
                          )}
                          {sectionIssueCount > 0 && (
                            <Badge className="bg-destructive/20 text-destructive text-[8px] h-4 px-1">
                              {sectionIssueCount}
                            </Badge>
                          )}
                          <button
                            onClick={() => setOpenIssueSection(openIssueSection === sec.label ? null : sec.label)}
                            className="text-amber-500 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Report issue"
                          >
                            <AlertTriangle className="h-3 w-3" />
                          </button>
                        </div>
                        {openIssueSection === sec.label && current && (
                          <InlineIssueForm
                            section={sec.label}
                            qaAssetId={current.id}
                            assetName={current.asset_name}
                            onSaved={() => {
                              setOpenIssueSection(null);
                              qc.invalidateQueries({ queryKey: ["qa-issues", current.id] });
                            }}
                            onCancel={() => setOpenIssueSection(null)}
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* All sections checked indicator */}
                  {activeSection === null && sections.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1 text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" />
                      <span className="text-[10px] font-semibold">All sections reviewed</span>
                    </div>
                  )}

                  {/* Existing issues summary */}
                  {issueCount > 0 && (
                    <div className="mt-2 pt-2 border-t border-border space-y-1">
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {issueCount} issue{issueCount !== 1 ? "s" : ""} logged
                      </p>
                      {currentIssues?.map(issue => (
                        <div key={issue.id} className="flex items-center gap-1.5 text-[10px] bg-muted/30 rounded px-2 py-1">
                          <Badge variant="outline" className="text-[8px] shrink-0">{issue.section.replace("Reveal ", "")}</Badge>
                          <span className="truncate text-foreground">{issue.issue_description}</span>
                          <button
                            onClick={() => deleteIssueMutation.mutate(issue.id)}
                            className="ml-auto shrink-0 text-destructive hover:text-destructive/80"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Keyboard shortcuts */}
              <div className="px-3 py-1.5 border-t border-border">
                <button
                  onClick={() => setShortcutsOpen(!shortcutsOpen)}
                  className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground w-full"
                >
                  {shortcutsOpen ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                  Keyboard Shortcuts
                </button>
                {shortcutsOpen && (
                  <div className="mt-1 text-[9px] text-muted-foreground space-y-0.5 pb-1">
                    {hasScreenshot && <p><kbd className="font-mono bg-muted px-1 rounded">Y</kbd> Yes · <kbd className="font-mono bg-muted px-1 rounded">A</kbd> Almost · <kbd className="font-mono bg-muted px-1 rounded">N</kbd> No</p>}
                    <p><kbd className="font-mono bg-muted px-1 rounded">1-7</kbd> Check section · <kbd className="font-mono bg-muted px-1 rounded">⇧+1-7</kbd> Issue form</p>
                    <p><kbd className="font-mono bg-muted px-1 rounded">→</kbd> <kbd className="font-mono bg-muted px-1 rounded">.</kbd> Next · <kbd className="font-mono bg-muted px-1 rounded">←</kbd> <kbd className="font-mono bg-muted px-1 rounded">,</kbd> Prev</p>
                    <p><kbd className="font-mono bg-muted px-1 rounded">Enter</kbd> <kbd className="font-mono bg-muted px-1 rounded">Space</kbd> All Good → Next</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Sticky bottom buttons */}
        {reviewerName && screenshotStep === "done" && (
          <div className="shrink-0 border-t border-border bg-card px-3 py-2 space-y-1.5">
            {/* Only show "All Good" when there are NO issues */}
            {issueCount === 0 && (
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                onClick={() => markAndAdvance()}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> All Good — Next Asset →
              </Button>
            )}
            {issueCount > 0 && (
              <Button
                className="w-full border-amber-500/30 bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"
                onClick={() => markAndAdvance("reviewed_issues")}
              >
                <AlertTriangle className="h-3 w-3 mr-1.5" /> Save Issues & Next →
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
