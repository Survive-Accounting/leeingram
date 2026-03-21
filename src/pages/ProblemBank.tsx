import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DependentProblemsQueue } from "@/components/content-factory/DependentProblemsQueue";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { StageCompletePanel } from "@/components/StageCompletePanel";
import { useBuildRun } from "@/hooks/useBuildRun";
import { useVaAccount } from "@/hooks/useVaAccount";
import { StartBuildRunModal } from "@/components/BuildTimerWidget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Pencil, Trash2, Loader2, CheckCircle2, Eye, Inbox, FileUp, Merge, ScanText, Camera, AlertTriangle } from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import { toast } from "sonner";
import { InfoTip } from "@/components/InfoTip";
import { useNavigate, Link } from "react-router-dom";
import { ImagePasteArea } from "@/components/content-factory/ImagePasteArea";
import { SourceProblemPreview, SourceProblemPreviewData } from "@/components/content-factory/SourceProblemPreview";

type ChapterProblemListItem = {
  id: string;
  course_id: string;
  chapter_id: string;
  problem_type: "exercise" | "problem" | "custom" | "quick_study";
  source_label: string;
  title: string;
  difficulty_internal: "easy" | "medium" | "hard" | "tricky" | null;
  status: string;
  pipeline_status: string;
  created_at: string;
  problem_screenshot_url: string | null;
  solution_screenshot_url: string | null;
};

type ChapterProblem = ChapterProblemListItem & {
  problem_text: string;
  solution_text: string;
  journal_entry_text: string | null;
  problem_screenshot_urls: string[];
  solution_screenshot_urls: string[];
};

const STATUS_STYLES: Record<string, string> = {
  raw: "bg-secondary text-secondary-foreground border-border",
  tagged: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ready: "bg-green-500/20 text-green-400 border-green-500/30",
  imported: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  generated: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30"
};

const STATUS_LABELS: Record<string, string> = {
  raw: "Raw",
  tagged: "Tagged",
  ready: "Ready",
  imported: "Imported",
  generated: "Generated",
  approved: "Approved"
};

export default function ProblemBank() {
  const qc = useQueryClient();
  const { workspace } = useActiveWorkspace();
  const { activeRun, isRunning, registerImport } = useBuildRun();
  const { isVa } = useVaAccount();

  const courseFilter = workspace?.courseId || "all";
  const chapterFilter = workspace?.chapterId || "all";
  const isIntroCourse = courseFilter === "11111111-1111-1111-1111-111111111111" || courseFilter === "22222222-2222-2222-2222-222222222222";

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProblem, setEditingProblem] = useState<ChapterProblem | null>(null);
  const [previewProblem, setPreviewProblem] = useState<ChapterProblem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [buildRunModalOpen, setBuildRunModalOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const pendingSaveRef = useRef<{ keepOpen: boolean } | null>(null);
  const navigate = useNavigate();
  

  // Add Source Problem form state
  const [problemFiles, setProblemFiles] = useState<File[]>([]);
  const [solutionFiles, setSolutionFiles] = useState<File[]>([]);
  const [formType, setFormType] = useState<string>("");
  const [formLabel, setFormLabel] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formNoJE, setFormNoJE] = useState(false);

  // Edit form state
  const [editType, setEditType] = useState<string>("");
  const [editLabel, setEditLabel] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editNoJE, setEditNoJE] = useState(false);
  const [editProblemFiles, setEditProblemFiles] = useState<File[]>([]);
  const [editSolutionFiles, setEditSolutionFiles] = useState<File[]>([]);

  const { data: chapters } = useQuery({
    queryKey: ["chapters", courseFilter],
    queryFn: async () => {
      let q = supabase.from("chapters").select("*").order("chapter_number");
      if (courseFilter !== "all") q = q.eq("course_id", courseFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    }
  });

  const { data: problems, isLoading } = useQuery({
    queryKey: ["chapter-problems", courseFilter, chapterFilter],
    queryFn: async () => {
      let q = supabase.from("chapter_problems").select("id, course_id, chapter_id, problem_type, source_label, title, status, pipeline_status, created_at, difficulty_internal, problem_screenshot_url, solution_screenshot_url, ocr_status, ocr_detected_label, contains_no_journal_entries");
      if (courseFilter !== "all") q = q.eq("course_id", courseFilter);
      if (chapterFilter !== "all") q = q.eq("chapter_id", chapterFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]).sort((a: any, b: any) =>
        (a.source_label || "").localeCompare(b.source_label || "", undefined, { numeric: true, sensitivity: "base" })
      ) as (ChapterProblemListItem & { ocr_status?: string; ocr_detected_label?: string; contains_no_journal_entries?: boolean })[];
    }
  });


  const uploadFile = async (file: File, prefix: string): Promise<string> => {
    const ext = file.name?.split(".").pop() || "png";
    const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("problem-assets").upload(path, file, { contentType: file.type });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("problem-assets").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const saveMutation = useMutation({
    mutationFn: async (opts: { keepOpen: boolean }) => {
      if (courseFilter === "all" || chapterFilter === "all") throw new Error("Select a course and chapter first");
      if (problemFiles.length === 0) throw new Error("Add at least one problem screenshot");

      const problemUrls = await Promise.all(problemFiles.map((f) => uploadFile(f, "intake-problems")));
      const solutionUrls = await Promise.all(solutionFiles.map((f) => uploadFile(f, "intake-solutions")));

      const { data: inserted, error } = await supabase.from("chapter_problems").insert({
        course_id: courseFilter,
        chapter_id: chapterFilter,
        status: "raw",
        problem_screenshot_url: problemUrls[0] || null,
        solution_screenshot_url: solutionUrls[0] || null,
        problem_screenshot_urls: problemUrls,
        solution_screenshot_urls: solutionUrls,
        problem_type: (formType || "exercise") as any,
        source_label: formLabel,
        title: formTitle,
        contains_no_journal_entries: formNoJE,
        problem_text: "",
        solution_text: ""
      }).select("id").single();
      if (error) throw error;

      // Register with active build run
      if (inserted?.id) {
        await registerImport(inserted.id);
      }

      // Auto-trigger OCR in background (fire-and-forget)
      if (inserted?.id && problemUrls.length > 0) {
        supabase.functions.invoke("extract-ocr", {
          body: {
            problemId: inserted.id,
            problemImageUrls: problemUrls,
            solutionImageUrls: solutionUrls
          }
        }).then(() => {
          qc.invalidateQueries({ queryKey: ["chapter-problems"] });
        }).catch((e) => console.error("Auto-OCR failed:", e));
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["chapter-problems"] });
      qc.invalidateQueries({ queryKey: ["build-run"] });
      setProblemFiles([]);
      setSolutionFiles([]);
      setFormType("");
      setFormLabel("");
      setFormTitle("");
      setFormNoJE(false);
      if (variables.keepOpen) {
        toast.success("Saved — ready for next problem");
      } else {
        setAddDialogOpen(false);
        toast.success("Source problem saved to Raw queue");
      }
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingProblem) return;
      const updates: any = {
        problem_type: editType || "exercise",
        source_label: editLabel,
        title: editTitle,
        contains_no_journal_entries: editNoJE
      };
      if ((editLabel || editTitle) && editingProblem.status === "raw") {
        updates.status = "tagged";
      }

      // Handle screenshot replacements
      if (editProblemFiles.length > 0) {
        const urls: string[] = [];
        for (const f of editProblemFiles) {
          urls.push(await uploadFile(f, "intake-problems"));
        }
        updates.problem_screenshot_url = urls[0];
        updates.problem_screenshot_urls = urls;
        updates.ocr_status = "pending";
      }
      if (editSolutionFiles.length > 0) {
        const urls: string[] = [];
        for (const f of editSolutionFiles) {
          urls.push(await uploadFile(f, "intake-solutions"));
        }
        updates.solution_screenshot_url = urls[0];
        updates.solution_screenshot_urls = urls;
      }

      const { error } = await supabase.from("chapter_problems").update(updates).eq("id", editingProblem.id);
      if (error) throw error;

      // Auto-OCR if screenshots were replaced
      if (editProblemFiles.length > 0 && updates.problem_screenshot_urls) {
        supabase.functions.invoke("extract-ocr", {
          body: {
            problemId: editingProblem.id,
            problemImageUrls: updates.problem_screenshot_urls,
            solutionImageUrls: updates.solution_screenshot_urls || editingProblem.solution_screenshot_urls || [],
          }
        }).then(() => qc.invalidateQueries({ queryKey: ["chapter-problems"] }))
          .catch(e => console.error("Auto-OCR failed:", e));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-problems"] });
      setEditDialogOpen(false);
      setEditingProblem(null);
      toast.success("Problem updated");
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chapter_problems").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-problems"] });
      setDeleteId(null);
      toast.success("Problem deleted");
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const bulkMarkReady = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("chapter_problems").update({ status: "ready", pipeline_status: "imported" } as any).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-problems"] });
      setSelectedIds(new Set());
      toast.success("Marked as Ready");
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const bulkMarkNotReady = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("chapter_problems").update({ status: "raw" } as any).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-problems"] });
      setSelectedIds(new Set());
      toast.success("Marked as Not Ready");
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const bulkCombine = useMutation({
    mutationFn: async (ids: string[]) => {
      // Generate a shared group ID so generation can merge their text
      const groupId = crypto.randomUUID();
      const { error } = await supabase.from("chapter_problems").update({
        dependency_type: "dependent_problem",
        dependency_status: "combined",
        combined_group_id: groupId,
      } as any).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-problems"] });
      qc.invalidateQueries({ queryKey: ["dependent-problems"] });
      setSelectedIds(new Set());
      toast.success("Problems linked as combined group — generation will merge their text automatically.");
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      if (!chapterFilter || chapterFilter === "all") throw new Error("No chapter selected");
      const { error } = await supabase.from("chapter_problems").delete().eq("chapter_id", chapterFilter);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-problems"] });
      setSelectedIds(new Set());
      setDeleteAllOpen(false);
      toast.success("All sources deleted for this chapter");
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrHasRun, setOcrHasRun] = useState(false);

  const runBulkOcr = useCallback(async (forceAll = false) => {
    if (!problems) return;
    const pending = problems.filter(
      (p) => {
        const hasImages = p.problem_screenshot_urls.length > 0 || p.problem_screenshot_url;
        if (!hasImages) return false;
        const ocrStatus = (p as any).ocr_status;
        if (forceAll) return true;
        return !ocrStatus || ocrStatus === "pending" || ocrStatus === "no_images";
      }
    );
    if (pending.length === 0) {
      toast.info("No problems need OCR — all already processed.");
      return;
    }
    setOcrRunning(true);
    toast.info(`Running OCR on ${pending.length} problems…`);
    let success = 0;
    let failed = 0;
    // Process sequentially to avoid rate limits
    for (const p of pending) {
      const pUrls = p.problem_screenshot_urls.length > 0 ? p.problem_screenshot_urls : p.problem_screenshot_url ? [p.problem_screenshot_url] : [];
      const sUrls = p.solution_screenshot_urls.length > 0 ? p.solution_screenshot_urls : p.solution_screenshot_url ? [p.solution_screenshot_url] : [];
      try {
        const { error } = await supabase.functions.invoke("extract-ocr", {
          body: { problemId: p.id, problemImageUrls: pUrls, solutionImageUrls: sUrls },
        });
        if (error) { failed++; } else { success++; }
      } catch {
        failed++;
      }
    }
    setOcrRunning(false);
    setOcrHasRun(true);
    qc.invalidateQueries({ queryKey: ["chapter-problems"] });
    toast.success(`OCR complete: ${success} succeeded, ${failed} failed`);
  }, [problems, qc]);

  const markReady = async (id: string) => {
    const { error } = await supabase.from("chapter_problems").update({ status: "ready", pipeline_status: "imported" } as any).eq("id", id);
    if (error) {toast.error(error.message);return;}
    qc.invalidateQueries({ queryKey: ["chapter-problems"] });
    toast.success("Marked as Ready");
  };

  const resetScreenshot = async (p: ChapterProblem) => {
    const { error } = await supabase.from("chapter_problems").update({
      import_status: "needs_problem_screenshot",
      problem_screenshot_url: null,
      problem_screenshot_urls: [],
      ocr_status: "pending",
      ocr_detected_label: "",
      ocr_detected_title: "",
      ocr_extracted_problem_text: "",
      title: "",
    } as any).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    logActivity({
      actor_type: "user",
      entity_type: "source_problem",
      entity_id: p.id,
      event_type: "screenshot_reset",
      message: `Reset screenshot for ${p.source_label} due to mismatch (was showing ${(p as any).ocr_detected_label})`,
      severity: "warn",
    });
    qc.invalidateQueries({ queryKey: ["chapter-problems"] });
    qc.invalidateQueries({ queryKey: ["screenshot-queue"] });
    toast.success(`${p.source_label} returned to screenshot queue`);
  };

  const openEdit = (p: ChapterProblem) => {
    setEditingProblem(p);
    setEditType(p.problem_type);
    setEditLabel(p.source_label);
    setEditTitle(p.title);
    setEditNoJE(!!(p as any).contains_no_journal_entries);
    setEditProblemFiles([]);
    setEditSolutionFiles([]);
    setEditDialogOpen(true);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);else next.add(id);
      return next;
    });
  };

  const imgCount = (urls: string[], legacy: string | null) => {
    if (urls.length > 0) return urls.length;
    return legacy ? 1 : 0;
  };

  const canAdd = courseFilter !== "all" && chapterFilter !== "all" && chapterFilter !== "";

  return (
    <SurviveSidebarLayout>
      <div className="mb-4">
        <h1 className="text-xl font-bold flex items-center gap-2 text-primary-foreground">
          <Inbox className="h-5 w-5 text-primary" />
          Problem Import
        </h1>
      </div>

      {/* Stage complete banner */}
      {(() => {
        if (!problems || problems.length === 0 || chapterFilter === "all") return null;
        const rawCount = problems.filter(p => p.status === "raw").length;
        if (rawCount > 0) return null;
        const readyCount = problems.filter(p => ["ready", "generated", "approved"].includes(p.status)).length;
        return (
          <StageCompletePanel
            stage="import"
            statLine={`${readyCount} source problem${readyCount === 1 ? "" : "s"} ready to generate`}
          />
        );
      })()}

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 mb-3">
        {canAdd && chapterFilter && chapterFilter !== "all" && (
          <>
            {!isVa && !isIntroCourse && (
              <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5" asChild>
                <Link to={`/solutions-upload/${chapterFilter}`}>
                  <FileUp className="h-3 w-3 mr-1" /> Upload Solutions
                </Link>
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5" asChild>
              <Link to={`/screenshot-capture/${chapterFilter}`}>
                <Camera className="h-3 w-3 mr-1" /> Upload Textbook Screenshots
              </Link>
            </Button>
          </>
        )}
        {!isIntroCourse && (
          <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5" onClick={() => runBulkOcr(true)} disabled={ocrRunning}>
            {ocrRunning ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ScanText className="h-3 w-3 mr-1" />}
            {ocrRunning ? "Running OCR…" : "Re-run OCR"}
          </Button>
        )}
        {canAdd && !isVa && problems && problems.length > 0 && (
          <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5 border-destructive/40 text-destructive hover:bg-destructive/10 ml-auto" onClick={() => setDeleteAllOpen(true)}>
            <Trash2 className="h-3 w-3 mr-1" /> Delete All Sources
          </Button>
        )}
        {selectedIds.size > 0 && (
          <>
            <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5" onClick={() => bulkMarkReady.mutate(Array.from(selectedIds))} disabled={bulkMarkReady.isPending}>
              <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Ready ({selectedIds.size})
            </Button>
            <InfoTip text="Marks this source problem as ready to be generated into a Survive Teaching Asset. Only Ready problems appear in the Generate queue." />
            <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => bulkMarkNotReady.mutate(Array.from(selectedIds))} disabled={bulkMarkNotReady.isPending}>
              Mark Not Ready ({selectedIds.size})
            </Button>
            {selectedIds.size >= 2 && selectedIds.size <= 4 && (
              <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={() => bulkCombine.mutate(Array.from(selectedIds))} disabled={bulkCombine.isPending}>
                <Merge className="h-3 w-3 mr-1" /> Combine ({selectedIds.size})
              </Button>
            )}
            {selectedIds.size > 4 && (
              <span className="text-[11px] text-muted-foreground italic">Max 4 to combine</span>
            )}
          </>
        )}
      </div>

      {/* Divider between buttons and table */}
      <div className="border-t border-border mb-3" />

      {/* Mismatch warning banner */}
      {problems && (() => {
        const mismatchCount = problems.filter((p) => {
          const ocr = ((p as any).ocr_detected_label || "").trim();
          const src = (p.source_label || "").trim();
          if (!ocr || !src) return false;
          // Normalize both to a canonical form: strip prefixes like "Exercise ", "Problem ", "Brief Exercise "
          // then unify separators so "Exercise 1-1" → "E1.1" and "E1.1" → "E1.1"
          const normalize = (s: string) => {
            let v = s.replace(/\s+/g, " ").trim().toUpperCase();
            v = v.replace(/^BRIEF\s*EXERCISE\s*/i, "BE");
            v = v.replace(/^EXERCISE\s*/i, "E");
            v = v.replace(/^PROBLEM\s*/i, "P");
            v = v.replace(/^QUICK\s*STUDY\s*/i, "QS");
            v = v.replace(/[\s-]+/g, ".");
            v = v.replace(/\.+/g, ".");
            v = v.replace(/\s+/g, "");
            v = v.replace(/^([A-Z]+)\./, "$1");
            return v;
          };
          // Strip all leading letter prefixes to get just the numeric ID (e.g. "P1.6B" → "1.6B")
          const numericPart = (s: string) => s.replace(/^[A-Z]+/, "");
          const nOcr = normalize(ocr);
          const nSrc = normalize(src);
          if (nOcr === nSrc) return false;
          // Fallback: if OCR dropped the prefix (e.g. "1-6B" vs "P1.6B"), compare numeric parts only
          return numericPart(nOcr) !== numericPart(nSrc);
        }).length;
        return mismatchCount > 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span><strong>{mismatchCount} screenshot mismatch{mismatchCount > 1 ? "es" : ""}</strong> — the pasted screenshot doesn't match the source label. Re-paste the correct textbook screenshot for flagged items.</span>
          </div>
        ) : null;
      })()}

      {!canAdd &&
      <p className="text-xs text-muted-foreground text-center py-4">Select a course and chapter in the sidebar pipeline to view and add source problems.</p>
      }

      {/* Source problems table */}
      {canAdd &&
      <>
        <div className="rounded-lg overflow-hidden border border-border bg-background/95">
          <Table>
             <TableHeader>
              <TableRow className="border-border">
                <TableHead className="w-10">
                  <Checkbox
                  checked={problems && problems.length > 0 && selectedIds.size === problems.length}
                  onCheckedChange={() => {
                    if (!problems) return;
                    if (selectedIds.size === problems.length) setSelectedIds(new Set());else
                    setSelectedIds(new Set(problems.map((p) => p.id)));
                  }} />
                </TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Label</TableHead>
                <TableHead className="text-xs">Title</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Screenshot</TableHead>
                <TableHead className="text-xs w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ?
            <TableRow><TableCell colSpan={7} className="text-center text-foreground/80 text-xs">Loading…</TableCell></TableRow> :
            !problems?.length ?
            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-xs">No imported sources yet.</TableCell></TableRow> :

            problems.map((p) => {
              const ocrLabel = (p as any).ocr_detected_label || "";
              const normalizeLabel = (s: string) => {
                let v = s.replace(/\s+/g, " ").trim().toUpperCase();
                v = v.replace(/^BRIEF\s*EXERCISE\s*/i, "BE");
                v = v.replace(/^EXERCISE\s*/i, "E");
                v = v.replace(/^PROBLEM\s*/i, "P");
                v = v.replace(/^QUICK\s*STUDY\s*/i, "QS");
                v = v.replace(/[\s\-]+/g, ".");
                v = v.replace(/\.+/g, ".");
                v = v.replace(/\s+/g, "");
                // Ensure prefix-number boundary is consistent: "QS.1.1" → "QS1.1"
                v = v.replace(/^([A-Z]+)\./, "$1");
                return v;
              };
              const numericPart = (s: string) => s.replace(/^[A-Z]+/, "");
              const hasMismatch = (() => {
                if (!ocrLabel || !p.source_label) return false;
                const nOcr = normalizeLabel(ocrLabel);
                const nSrc = normalizeLabel(p.source_label);
                if (nOcr === nSrc) return false;
                return numericPart(nOcr) !== numericPart(nSrc);
              })();
              const hasScreenshot = !!(p.problem_screenshot_url || p.problem_screenshot_urls.length > 0);
              return (
              <TableRow key={p.id} className={`border-border ${hasMismatch ? "bg-destructive/10" : ""}`}>
                    <TableCell>
                      <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[p.status] ?? "bg-muted text-muted-foreground"}`}>
                          {STATUS_LABELS[p.status] ?? p.status}
                        </Badge>
                        {hasMismatch && (
                          <span title={`Screenshot shows ${ocrLabel}, expected ${p.source_label}`} className="text-destructive">
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {p.source_label || "—"}
                      {hasMismatch && <span className="block text-[10px] text-destructive">OCR: {ocrLabel}</span>}
                    </TableCell>
                    <TableCell className="text-xs">{p.title || "—"}</TableCell>
                    <TableCell className="text-xs capitalize">{p.source_label?.match(/^BE/i) ? "Brief Exercise" : p.problem_type}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {hasMismatch ? (
                          <button className="text-[11px] text-destructive hover:underline" onClick={() => resetScreenshot(p)} title="Clear wrong screenshot and re-queue for pasting">
                            Re-paste
                          </button>
                        ) : !hasScreenshot ? (
                          <button className="text-[11px] text-primary hover:underline" onClick={() => openEdit(p)} title="Add screenshot via edit dialog">
                            Add
                          </button>
                        ) : (p.status === "raw" || p.status === "tagged") ? (
                          <div className="flex items-center gap-2">
                            <button className="text-[11px] text-muted-foreground hover:underline" onClick={() => resetScreenshot(p)} title="Clear current screenshot and re-paste">
                              Replace
                            </button>
                            <button className="text-[11px] text-primary hover:underline" onClick={() => markReady(p.id)}>
                              Ready
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">✓</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewProblem(p)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(p.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
              );
            })
            }
            </TableBody>
          </Table>
        </div>

        {/* Dependent Problems Queue */}
        <div className="mt-6">
          <DependentProblemsQueue chapterId={chapterFilter} courseId={courseFilter} />
        </div>
      </>
      }

      {/* Add Source Problem Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Source Problem</DialogTitle>
            <DialogDescription>Paste or drop screenshots. Label/title/type are optional — you can tag later.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs mb-1 block">Problem Screenshots (paste Ctrl+V or drag & drop)</Label>
              <ImagePasteArea
                label="Paste or drop problem images"
                files={problemFiles}
                onAdd={(files) => setProblemFiles((prev) => [...prev, ...files])}
                onRemove={(i) => setProblemFiles((prev) => prev.filter((_, idx) => idx !== i))} />

            </div>

            <div>
              <Label className="text-xs mb-1 block">Solution Screenshots (optional)</Label>
              <ImagePasteArea
                label="Paste or drop solution images"
                files={solutionFiles}
                onAdd={(files) => setSolutionFiles((prev) => [...prev, ...files])}
                onRemove={(i) => setSolutionFiles((prev) => prev.filter((_, idx) => idx !== i))} />

            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Type (optional)</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exercise">Exercise</SelectItem>
                    <SelectItem value="problem">Problem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Label (optional)</Label>
                <Input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="E13-3 or P13-4" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Title (optional)</Label>
                <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Bond amortization" className="h-8 text-xs" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="form-no-je" checked={formNoJE} onCheckedChange={(v) => setFormNoJE(!!v)} />
              <Label htmlFor="form-no-je" className="text-xs cursor-pointer">Contains no Journal Entries</Label>
              <span className="text-[10px] text-muted-foreground">— EPS/ratios/analysis. Skips JE logic in generation.</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button size="sm" variant="outline" onClick={() => saveMutation.mutate({ keepOpen: true })} disabled={saveMutation.isPending || problemFiles.length === 0}>
              {saveMutation.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Saving…</> : "Save & Add Next"}
            </Button>
            <Button size="sm" onClick={() => saveMutation.mutate({ keepOpen: false })} disabled={saveMutation.isPending || problemFiles.length === 0}>
              {saveMutation.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Saving…</> : "Save Source Problem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Replace Screenshots</DialogTitle>
            <DialogDescription>Paste or upload a replacement screenshot for this source problem. Title and label are auto-detected from your screenshots.</DialogDescription>
          </DialogHeader>

          {editingProblem &&
          <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1 block">Problem Screenshot</Label>
                  {editProblemFiles.length === 0 && (editingProblem.problem_screenshot_urls.length > 0 || editingProblem.problem_screenshot_url) ? (
                    <div className="space-y-1">
                      <div className="flex gap-1 flex-wrap">
                        {(editingProblem.problem_screenshot_urls.length > 0 ?
                          editingProblem.problem_screenshot_urls :
                          [editingProblem.problem_screenshot_url].filter(Boolean)).map((url, i) =>
                          <img key={i} src={url!} alt="" className="h-20 rounded border border-border object-cover" />
                        )}
                      </div>
                      <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={() => setEditProblemFiles([])}>
                        <Camera className="h-3 w-3 mr-1" /> Replace
                      </Button>
                    </div>
                  ) : (
                    <ImagePasteArea
                      label="Paste or drop replacement"
                      files={editProblemFiles}
                      onAdd={(f) => setEditProblemFiles(f.slice(0, 3))}
                      onRemove={() => setEditProblemFiles([])}
                    />
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">Paste (Ctrl+V) or click to upload</p>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Solution Screenshot</Label>
                  {editSolutionFiles.length === 0 && (editingProblem.solution_screenshot_urls.length > 0 || editingProblem.solution_screenshot_url) ? (
                    <div className="space-y-1">
                      <div className="flex gap-1 flex-wrap">
                        {(editingProblem.solution_screenshot_urls.length > 0 ?
                          editingProblem.solution_screenshot_urls :
                          [editingProblem.solution_screenshot_url].filter(Boolean)).map((url, i) =>
                          <img key={i} src={url!} alt="" className="h-20 rounded border border-border object-cover" />
                        )}
                      </div>
                      <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={() => setEditSolutionFiles([])}>
                        <Camera className="h-3 w-3 mr-1" /> Replace
                      </Button>
                    </div>
                  ) : (
                    <ImagePasteArea
                      label="Paste or drop replacement"
                      files={editSolutionFiles}
                      onAdd={(f) => setEditSolutionFiles(f.slice(0, 3))}
                      onRemove={() => setEditSolutionFiles([])}
                    />
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">Paste (Ctrl+V) or click to upload</p>
                </div>
              </div>
            </>
          }

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Problem</DialogTitle>
            <DialogDescription>This will permanently remove this source problem. Continue?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Source Problem Preview */}
      <SourceProblemPreview
        problem={previewProblem}
        open={!!previewProblem}
        onOpenChange={(open) => {if (!open) setPreviewProblem(null);}} />

      {/* Build Run Start Modal */}
      <StartBuildRunModal
        open={buildRunModalOpen}
        onOpenChange={setBuildRunModalOpen}
        onStarted={() => setAddDialogOpen(true)}
      />
      {/* Delete All Confirmation */}
      <Dialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Delete All Sources
            </DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>all {problems?.length ?? 0} source problems</strong> for this chapter. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteAllOpen(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => deleteAllMutation.mutate()} disabled={deleteAllMutation.isPending}>
              {deleteAllMutation.isPending ? "Deleting…" : "Delete All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </SurviveSidebarLayout>);

}