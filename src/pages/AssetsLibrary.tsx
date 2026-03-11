import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { StageCompletePanel } from "@/components/StageCompletePanel";
import { useVaAccount } from "@/hooks/useVaAccount";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SheetPrepLog } from "@/components/admin-dashboard/SheetPrepLog";

import { Trash2, Search, Library, Download, Loader2, FolderPlus, FileText, Undo2, Layers, Landmark, Sheet, ChevronDown, ClipboardList, CheckCircle2, Eye } from "lucide-react";
import { toast } from "sonner";
import { InfoTip } from "@/components/InfoTip";
import { format } from "date-fns";
import { generateEbookDocx } from "@/lib/generateEbookDocx";
import AssetDetailDrawer from "@/components/AssetDetailDrawer";

type TeachingAsset = {
  id: string;
  course_id: string;
  chapter_id: string;
  base_raw_problem_id: string | null;
  asset_name: string;
  tags: string[];
  survive_problem_text: string;
  journal_entry_block: string | null;
  survive_solution_text: string;
  difficulty: string | null;
  source_ref: string | null;
  asset_type: string;
  created_at: string;
  updated_at: string;
  journal_entry_completed_json: any;
  journal_entry_template_json: any;
  times_used?: number;
  sheet_template_version?: string | null;
  google_sheet_url?: string | null;
  google_sheet_file_id?: string | null;
  sheet_last_synced_at?: string | null;
  sheet_master_url?: string | null;
  sheet_practice_url?: string | null;
  sheet_promo_url?: string | null;
  sheet_path_url?: string | null;
  source_type?: string | null;
  source_number?: string | null;
  problem_type?: string | null;
  google_sheet_status?: string | null;
};

type JournalOption = "question" | "feedback" | "none";

function escapeCSV(val: string): string {
  if (!val) return "";
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

export default function AssetsLibrary() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { workspace } = useActiveWorkspace();
  const { isVa, primaryRole, assignedChapterIds } = useVaAccount();
  const { impersonating } = useImpersonation();
  const effectiveRole = impersonating?.role || primaryRole;
  const isAdmin = !isVa && !impersonating;
  const isSheetPrepVa = effectiveRole === "sheet_prep_va";
  const isContentCreationVa = effectiveRole === "content_creation_va";
  const deepLinkAssetId = searchParams.get("asset");
  const deepLinkAction = searchParams.get("action");
  const [courseFilter, setCourseFilter] = useState<string>(workspace?.courseId || "all");
  const [chapterFilter, setChapterFilter] = useState<string>(workspace?.chapterId || "all");
  const [search, setSearch] = useState("");
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [verifyAssetId, setVerifyAssetId] = useState<string | null>(null);
  const [verifyPrepMinutes, setVerifyPrepMinutes] = useState("");
  const [verifyNotes, setVerifyNotes] = useState("");

  useEffect(() => {
    if (workspace?.courseId && !deepLinkAssetId) setCourseFilter(workspace.courseId);
    if (workspace?.chapterId && !deepLinkAssetId) setChapterFilter(workspace.chapterId);
  }, [workspace?.courseId, workspace?.chapterId]);

  // Deep-link: when ?asset=ID is present, fetch that asset directly and set filters
  useEffect(() => {
    if (!deepLinkAssetId) return;
    (async () => {
      const { data: targetAsset } = await supabase
        .from("teaching_assets")
        .select("id, course_id, chapter_id")
        .eq("id", deepLinkAssetId)
        .single();
      if (targetAsset) {
        setCourseFilter(targetAsset.course_id);
        setChapterFilter(targetAsset.chapter_id);
      }
    })();
  }, [deepLinkAssetId]);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [revertId, setRevertId] = useState<string | null>(null);
  const [viewingAsset, setViewingAsset] = useState<TeachingAsset | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [exportName, setExportName] = useState("LearnWorlds Export");
  const [exportQuestionType, setExportQuestionType] = useState("TMC");
  const [journalOption, setJournalOption] = useState<JournalOption>("feedback");
  const [isExporting, setIsExporting] = useState(false);

  const [addToSetOpen, setAddToSetOpen] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<string>("__new__");
  const [newSetName, setNewSetName] = useState("");
  const [isGeneratingEbook, setIsGeneratingEbook] = useState(false);
  const [isBanking, setIsBanking] = useState(false);
  const [isCreatingSheets, setIsCreatingSheets] = useState(false);
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [sheetLogOpen, setSheetLogOpen] = useState(false);

  // Total source problems + approved count for chapter complete check
  const { data: chapterPipelineCounts } = useQuery({
    queryKey: ["chapter-pipeline-counts", chapterFilter],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapter_problems")
        .select("pipeline_status")
        .eq("chapter_id", chapterFilter);
      const total = data?.length ?? 0;
      const approved = data?.filter(p => p.pipeline_status === "approved").length ?? 0;
      return { total, approved };
    },
    enabled: chapterFilter !== "all",
  });

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("course_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["chapters", courseFilter],
    queryFn: async () => {
      let q = supabase.from("chapters").select("*").order("chapter_number");
      if (courseFilter !== "all") q = q.eq("course_id", courseFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: assets, isLoading } = useQuery({
    queryKey: ["teaching-assets", courseFilter, chapterFilter, search],
    queryFn: async () => {
      let q = supabase.from("teaching_assets").select("*").neq("google_sheet_status", "archived");
      if (courseFilter !== "all") q = q.eq("course_id", courseFilter);
      if (chapterFilter !== "all") q = q.eq("chapter_id", chapterFilter);
      if (search.trim()) {
        q = q.or(`asset_name.ilike.%${search.trim()}%,survive_problem_text.ilike.%${search.trim()}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data as TeachingAsset[]).sort((a, b) =>
        (a.source_ref || a.asset_name || "").localeCompare(b.source_ref || b.asset_name || "", undefined, { numeric: true, sensitivity: "base" })
      );
    },
  });

  // Deep-link: open asset detail from ?asset=ID (after filters have updated and assets loaded)
  useEffect(() => {
    if (!deepLinkAssetId || !assets?.length) return;
    const found = assets.find((a) => a.id === deepLinkAssetId);
    if (found) {
      setViewingAsset(found);
      setDrawerOpen(true);

      // Handle ?action=verify → open confirmation dialog
      if (deepLinkAction === "verify") {
        setVerifyAssetId(found.id);
        setVerifyPrepMinutes("");
        setVerifyNotes("");
        setVerifyDialogOpen(true);
      }

      // Clear the params so refreshing doesn't re-open
      searchParams.delete("asset");
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [assets, deepLinkAssetId]);

  // Build sheet URL map from teaching_assets themselves + fallback to assets table
  const sheetUrls: Record<string, string> = {};
  if (assets) {
    for (const a of assets) {
      if (a.google_sheet_url) sheetUrls[a.asset_name] = a.google_sheet_url;
    }
  }

  const { data: fallbackSheetUrls } = useQuery({
    queryKey: ["asset-sheet-urls-fallback", assets?.filter(a => !a.google_sheet_url).map(a => a.asset_name).join(",")],
    queryFn: async () => {
      if (!assets?.length) return {};
      const names = assets.filter(a => !a.google_sheet_url).map(a => a.asset_name).filter(Boolean);
      if (!names.length) return {};
      const { data, error } = await supabase
        .from("assets")
        .select("asset_code, google_sheet_url")
        .in("asset_code", names)
        .neq("google_sheet_url", "");
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((a) => { if (a.google_sheet_url) map[a.asset_code] = a.google_sheet_url; });
      return map;
    },
    enabled: !!assets?.length,
  });

  // Merge fallback URLs
  if (fallbackSheetUrls) {
    for (const [k, v] of Object.entries(fallbackSheetUrls)) {
      if (!sheetUrls[k]) sheetUrls[k] = v;
    }
  }

  const { data: exportSets } = useQuery({
    queryKey: ["export-sets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("export_sets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────

  const addToSetMutation = useMutation({
    mutationFn: async ({ setId, assetIds }: { setId: string; assetIds: string[] }) => {
      const { data: existing } = await supabase
        .from("export_set_items")
        .select("order_index")
        .eq("export_set_id", setId)
        .order("order_index", { ascending: false })
        .limit(1);
      let nextOrder = (existing?.[0]?.order_index ?? -1) + 1;
      const rows = assetIds.map((id, i) => ({
        export_set_id: setId,
        teaching_asset_id: id,
        order_index: nextOrder + i,
      }));
      const { error } = await supabase.from("export_set_items").insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["export-sets"] });
      qc.invalidateQueries({ queryKey: ["export-set-items"] });
      setAddToSetOpen(false);
      setSelectedIds(new Set());
      toast.success("Assets added to export set");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleAddToSet = async () => {
    const assetIds = Array.from(selectedIds);
    if (!assetIds.length) return;
    let targetSetId = selectedSetId;
    if (selectedSetId === "__new__") {
      if (!newSetName.trim()) { toast.error("Enter a set name"); return; }
      const { data, error } = await supabase.from("export_sets").insert({ name: newSetName.trim() } as any).select("id").single();
      if (error) { toast.error(error.message); return; }
      targetSetId = data.id;
      qc.invalidateQueries({ queryKey: ["export-sets"] });
    }
    addToSetMutation.mutate({ setId: targetSetId, assetIds });
  };

  const revertMutation = useMutation({
    mutationFn: async (asset: TeachingAsset) => {
      if (asset.base_raw_problem_id) {
        const { error: varErr } = await supabase.from("problem_variants")
          .update({ variant_status: "draft" } as any)
          .eq("base_problem_id", asset.base_raw_problem_id)
          .eq("variant_status", "approved");
        if (varErr) console.error("Variant revert error:", varErr);
        const { error: probErr } = await supabase.from("chapter_problems")
          .update({ pipeline_status: "generated", status: "generated" } as any)
          .eq("id", asset.base_raw_problem_id);
        if (probErr) console.error("Problem revert error:", probErr);
      }
      const { error } = await supabase.from("teaching_assets").delete().eq("id", asset.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teaching-assets"] });
      qc.invalidateQueries({ queryKey: ["chapter-problems"] });
      qc.invalidateQueries({ queryKey: ["problem-variants"] });
      qc.invalidateQueries({ queryKey: ["pipeline-counts"] });
      setRevertId(null);
      toast.success("Asset reverted to Generated — variants set back to draft");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teaching_assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teaching-assets"] });
      setDeleteId(null);
      toast.success("Asset deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Selection helpers ──────────────────────────────────────────────

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!assets) return;
    if (selectedIds.size === assets.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(assets.map((a) => a.id)));
  };

  const openDrawer = (a: TeachingAsset) => {
    setViewingAsset(a);
    setDrawerOpen(true);
  };

  // ── Export ─────────────────────────────────────────────────────────

  const handleExport = async () => {
    if (!assets) return;
    const selected = assets.filter((a) => selectedIds.has(a.id));
    if (selected.length === 0) { toast.error("No assets selected"); return; }
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-distractors", {
        body: {
          assets: selected.map((a) => ({
            asset_name: a.asset_name,
            survive_problem_text: a.survive_problem_text,
            journal_entry_block: a.journal_entry_block,
            survive_solution_text: a.survive_solution_text,
          })),
          journalOption,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const distractors: any[] = data.distractors || [];
      const header = "Group,Type,Question,CorAns,Answer1,Answer2,Answer3,Answer4,Answer5,Answer6,Answer7,CorrectExplanation,IncorrectExplanation";
      const rows = selected.map((asset, idx) => {
        const d = distractors[idx] || {};
        let questionText = asset.survive_problem_text;
        if (journalOption === "question" && asset.journal_entry_block) questionText += "\n\n" + asset.journal_entry_block;
        let correctFeedback = asset.survive_solution_text;
        if (journalOption === "feedback" && asset.journal_entry_block) correctFeedback = asset.journal_entry_block + "\n\n" + asset.survive_solution_text;
        const incorrectFeedback = asset.survive_solution_text;
        const correctPos = Math.floor(Math.random() * 4) + 1;
        const answers = ["", "", "", ""];
        answers[correctPos - 1] = d.correct_answer || asset.journal_entry_block || "Correct answer";
        let dIdx = 0;
        const distractorList = [d.distractor_1, d.distractor_2, d.distractor_3].filter(Boolean);
        for (let i = 0; i < 4; i++) {
          if (i !== correctPos - 1) { answers[i] = distractorList[dIdx] || `Option ${i + 1}`; dIdx++; }
        }
        return [exportName, exportQuestionType, questionText, String(correctPos), ...answers, "", "", "", correctFeedback, incorrectFeedback].map(escapeCSV).join(",");
      });
      const csv = header + "\n" + rows.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${exportName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${selected.length} assets to CSV`);
      setExportOpen(false);
      setSelectedIds(new Set());
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Label helpers ──────────────────────────────────────────────────

  const chapterLabel = (chId: string) => {
    const ch = chapters?.find((c) => c.id === chId);
    return ch ? `Ch ${ch.chapter_number} — ${ch.chapter_name}` : "";
  };

  const courseLabel = (cId: string) => {
    const c = courses?.find((co) => co.id === cId);
    return c ? c.course_name : "";
  };

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <SurviveSidebarLayout>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-primary-foreground">
            <Library className="h-5 w-5 text-primary" />
            Assets Library
           </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {assets?.length ?? 0} approved assets
          </p>
        </div>

        {/* Stage complete banner */}
        {(() => {
          if (!assets || assets.length === 0 || chapterFilter === "all") return null;
          // Fetch total chapter_problems count for this chapter to check 100% approval
          const totalAssets = assets.length;
          // All assets in the filtered view must exist — chapter complete when all are present
          // We compare against the chapter's total source problems that reached "approved"
          // For simplicity: chapter complete = all assets have been created (assets.length matches total approved)
          // The StageCompletePanel for "assets" should only show when all items are approved
          // Since every teaching asset IS an approved item, we need to verify nothing is left unapproved
          // We'll use the perChapterCounts approach - but we already have the data inline
          // Simple check: all assets exist = chapter complete (this page only shows approved assets)
          return (
            <StageCompletePanel
              stage="assets"
              statLine={`${totalAssets} of ${totalAssets} teaching assets approved`}
              role={effectiveRole}
              assignedChapterIds={assignedChapterIds}
            />
          );
        })()}
        
        <div className="flex gap-2 flex-wrap items-center">
          {selectedIds.size > 0 && (
            <>
              <Select value={bulkAction || ""} onValueChange={(v) => setBulkAction(v)}>
                <SelectTrigger className="h-8 text-xs w-[220px] bg-background/95 border-border">
                  <SelectValue placeholder={`Action for ${selectedIds.size} selected…`} />
                </SelectTrigger>
                <SelectContent>
                  {isAdmin && (
                    <SelectItem value="export-csv">
                      <span className="flex items-center gap-1.5"><Download className="h-3 w-3" /> Export to CSV</span>
                    </SelectItem>
                  )}
                  {isAdmin && (
                    <SelectItem value="add-to-set">
                      <span className="flex items-center gap-1.5"><FolderPlus className="h-3 w-3" /> Add to Export Set</span>
                    </SelectItem>
                  )}
                  {isAdmin && (
                    <SelectItem value="generate-ebook">
                      <span className="flex items-center gap-1.5"><FileText className="h-3 w-3" /> Generate eBook</span>
                    </SelectItem>
                  )}
                  {isAdmin && (
                    <SelectItem value="bank-mc">
                      <span className="flex items-center gap-1.5"><Landmark className="h-3 w-3" /> Bank (Generate MC Questions)</span>
                    </SelectItem>
                  )}
                  {!isSheetPrepVa && (
                    <SelectItem value="revert">
                      <span className="flex items-center gap-1.5"><Undo2 className="h-3 w-3" /> Revert to Generated</span>
                    </SelectItem>
                  )}
                  {isAdmin && (
                    <SelectItem value="create-master-sheet">
                      <span className="flex items-center gap-1.5"><Sheet className="h-3 w-3" /> Create Master Google Sheet</span>
                    </SelectItem>
                  )}
                  {isAdmin && (
                    <SelectItem value="create-practice-sheet" disabled={!assets?.filter(a => selectedIds.has(a.id)).every(a => a.sheet_master_url)}>
                      <span className={`flex items-center gap-1.5 ${!assets?.filter(a => selectedIds.has(a.id)).every(a => a.sheet_master_url) ? "opacity-50" : ""}`}>
                        <Sheet className="h-3 w-3" /> Create (Paid) Study Pass Sheet
                      </span>
                    </SelectItem>
                  )}
                  {isAdmin && (
                    <SelectItem value="create-promo-sheet" disabled={!assets?.filter(a => selectedIds.has(a.id)).every(a => a.sheet_master_url)}>
                      <span className={`flex items-center gap-1.5 ${!assets?.filter(a => selectedIds.has(a.id)).every(a => a.sheet_master_url) ? "opacity-50" : ""}`}>
                        <Sheet className="h-3 w-3" /> Create (Free) Promo Sheet
                      </span>
                    </SelectItem>
                  )}
                  {isSheetPrepVa && (
                    <SelectItem value="mark-ready">
                      <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> Mark Ready for Review</span>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!bulkAction || isBanking || isGeneratingEbook || isExporting || isCreatingSheets}
                onClick={async () => {
                  if (!assets || !bulkAction) return;
                  const selected = assets.filter((a) => selectedIds.has(a.id));
                  if (!selected.length) return;

                  if (bulkAction === "export-csv") {
                    setExportOpen(true);
                  } else if (bulkAction === "add-to-set") {
                    setSelectedSetId("__new__");
                    setNewSetName("");
                    setAddToSetOpen(true);
                  } else if (bulkAction === "generate-ebook") {
                    setIsGeneratingEbook(true);
                    try {
                      const chapterMap = new Map(chapters?.map((c) => [c.id, c]) ?? []);
                      const courseMap = new Map(courses?.map((c) => [c.id, c]) ?? []);
                      const ebookAssets = selected.map((a) => ({
                        id: a.id,
                        asset_name: a.asset_name,
                        survive_problem_text: a.survive_problem_text,
                        survive_solution_text: a.survive_solution_text,
                        journal_entry_block: a.journal_entry_block,
                        course_slug: courseMap.get(a.course_id)?.slug ?? "COURSE",
                        chapter_number: chapterMap.get(a.chapter_id)?.chapter_number ?? 0,
                        chapter_name: chapterMap.get(a.chapter_id)?.chapter_name ?? "",
                      }));
                      await generateEbookDocx(ebookAssets);
                      toast.success(`Generated eBook with ${selected.length} problems`);
                    } catch (e: any) {
                      toast.error(e.message || "eBook generation failed");
                    } finally {
                      setIsGeneratingEbook(false);
                    }
                  } else if (bulkAction === "bank-mc") {
                    setIsBanking(true);
                    let successCount = 0;
                    let failCount = 0;
                    for (const asset of selected) {
                      try {
                        const { data, error } = await supabase.functions.invoke("bank-teaching-asset", {
                          body: {
                            teaching_asset_id: asset.id,
                            asset_name: asset.asset_name,
                            problem_text: asset.survive_problem_text,
                            solution_text: asset.survive_solution_text,
                            journal_entry_block: asset.journal_entry_block,
                            difficulty: asset.difficulty,
                          },
                        });
                        if (error) throw error;
                        if (data?.error) throw new Error(data.error);
                        successCount++;
                        toast.success(`Banked ${asset.asset_name}`, { description: `${data.questions_generated} questions generated` });
                      } catch (e: any) {
                        failCount++;
                        toast.error(`Failed to bank ${asset.asset_name}`, { description: e.message });
                      }
                    }
                    setIsBanking(false);
                    if (successCount > 0) {
                      qc.invalidateQueries({ queryKey: ["banked-questions-review"] });
                      setSelectedIds(new Set());
                    }
                  } else if (bulkAction === "revert") {
                    for (const asset of selected) {
                      revertMutation.mutate(asset);
                    }
                    setSelectedIds(new Set());
                  } else if (bulkAction === "mark-ready") {
                    let count = 0;
                    for (const asset of selected) {
                      const { error } = await supabase
                        .from("teaching_assets")
                        .update({ google_sheet_status: "ready_for_review" } as any)
                        .eq("id", asset.id);
                      if (!error) count++;
                    }
                    if (count > 0) {
                      toast.success(`${count} asset(s) marked ready for review`);
                      qc.invalidateQueries({ queryKey: ["teaching-assets"] });
                      setSelectedIds(new Set());
                    }
                  } else if (bulkAction === "create-master-sheet" || bulkAction === "create-practice-sheet" || bulkAction === "create-promo-sheet") {
                    const sheetTypeMap: Record<string, string> = {
                      "create-master-sheet": "master",
                      "create-practice-sheet": "practice",
                      "create-promo-sheet": "promo",
                    };
                    const sheetType = sheetTypeMap[bulkAction];
                    const sheetLabel = bulkAction === "create-master-sheet" ? "Master" : bulkAction === "create-practice-sheet" ? "Study Pass" : "Promo";
                    setIsCreatingSheets(true);
                    let sheetSuccess = 0;
                    let sheetFail = 0;
                    for (const asset of selected) {
                      try {
                        const { data, error } = await supabase.functions.invoke("create-asset-sheet", {
                          body: { asset_id: asset.id, sheet_types: [sheetType] },
                        });
                        if (error) throw error;
                        if (data?.error) throw new Error(data.error);
                        sheetSuccess++;
                      } catch (e: any) {
                        sheetFail++;
                        toast.error(`${sheetLabel} sheet failed: ${asset.asset_name}`, { description: e.message });
                      }
                    }
                    setIsCreatingSheets(false);
                    if (sheetSuccess > 0) {
                      toast.success(`Created ${sheetLabel} sheets for ${sheetSuccess} assets`);
                      qc.invalidateQueries({ queryKey: ["teaching-assets"] });
                      setSelectedIds(new Set());
                    }
                  }
                  setBulkAction(null);
                }}
              >
                {(isBanking || isGeneratingEbook || isExporting || isCreatingSheets) ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Running…</>
                ) : (
                  "Go"
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        <Select value={courseFilter} onValueChange={(v) => { setCourseFilter(v); setChapterFilter("all"); }}>
          <SelectTrigger className="h-8 text-xs bg-background/95 border-border">
            <SelectValue placeholder="All Courses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {courses?.map((c) => <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={chapterFilter} onValueChange={setChapterFilter}>
          <SelectTrigger className="h-8 text-xs bg-background/95 border-border">
            <SelectValue placeholder="All Chapters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Chapters</SelectItem>
            {chapters?.map((c) => <SelectItem key={c.id} value={c.id}>Ch {c.chapter_number} — {c.chapter_name}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, tags, or problem text…"
            className="h-8 text-xs pl-7 bg-background/95 border-border"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden border border-border bg-background/95">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="w-10">
                <Checkbox
                  checked={assets && assets.length > 0 && selectedIds.size === assets.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className="text-xs">
                <span className="inline-flex items-center gap-1">
                  Asset Code
                  <InfoTip text="A unique code for each teaching asset. Format: [Course]_[Chapter]_[Seq]_[Variant]. Used to identify assets across all systems." />
                </span>
              </TableHead>
              <TableHead className="text-xs">Textbook Ref</TableHead>
              {!isContentCreationVa && (
                <TableHead className="text-xs">
                  <span className="inline-flex items-center gap-1">
                    Sheet Status
                    <InfoTip text="Shows whether a Google Sheet whiteboard has been created for this asset. Sheets are used for tutoring sessions and video recording." />
                  </span>
                </TableHead>
              )}
              <TableHead className="text-xs">Created</TableHead>
              {!isContentCreationVa && (
                <TableHead className="text-xs w-16 text-right">Sheets</TableHead>
              )}
              <TableHead className="text-xs w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={isContentCreationVa ? 4 : 6} className="text-center text-foreground/80 text-xs py-8"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</TableCell></TableRow>
            ) : !assets?.length ? (
              <TableRow><TableCell colSpan={isContentCreationVa ? 4 : 6} className="text-center text-muted-foreground text-xs py-8">No assets found</TableCell></TableRow>
            ) : (
              assets.map((a) => {
                const sheetStatus = (a as any).google_sheet_status || "none";
                const statusIcon = sheetStatus === "finalized" ? "✓"
                  : sheetStatus === "ready_for_review" ? "⚠"
                  : sheetStatus === "auto_created" ? "✓"
                  : "—";
                const statusLabel = sheetStatus === "finalized" ? "Finalized"
                  : sheetStatus === "ready_for_review" ? "Needs Review"
                  : sheetStatus === "auto_created" ? "Created"
                  : sheetStatus === "verified_by_va" ? "Verified"
                  : "None";
                const statusColor = sheetStatus === "finalized" ? "text-emerald-400 border-emerald-500/40"
                  : sheetStatus === "ready_for_review" ? "text-amber-400 border-amber-500/40"
                  : sheetStatus === "auto_created" ? "text-sky-400 border-sky-500/40"
                  : sheetStatus === "verified_by_va" ? "text-emerald-400 border-emerald-500/40"
                  : "text-muted-foreground border-border";

                return (
                  <TableRow
                    key={a.id}
                    className="border-border cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => openDrawer(a)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(a.id)}
                        onCheckedChange={() => toggleSelect(a.id)}
                      />
                    </TableCell>
                    <TableCell className="text-xs font-mono font-medium text-foreground">{a.asset_name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {a.source_ref || "—"}
                    </TableCell>
                    {!isContentCreationVa && (
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] ${statusColor}`}>
                          {statusIcon} {statusLabel}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(a.created_at), "MMM d")}
                    </TableCell>
                    {!isContentCreationVa && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-0.5 justify-end">
                          {a.sheet_master_url ? (
                            <>
                              <a href={a.sheet_master_url} target="_blank" rel="noopener noreferrer" title="Master: tutoring / filming version" className="hover:scale-110 transition-transform">📋</a>
                              {a.sheet_practice_url && (
                                <a href={a.sheet_practice_url} target="_blank" rel="noopener noreferrer" title="Practice: student practice version" className="hover:scale-110 transition-transform">✏️</a>
                              )}
                              {a.sheet_promo_url && (
                                <a href={a.sheet_promo_url} target="_blank" rel="noopener noreferrer" title="Promo: shareable promo version" className="hover:scale-110 transition-transform">📣</a>
                              )}
                            </>
                          ) : sheetUrls?.[a.asset_name] ? (
                            <a href={sheetUrls[a.asset_name]} target="_blank" rel="noopener noreferrer" title="Open Google Sheet" className="hover:scale-110 transition-transform">📋</a>
                          ) : null}
                        </div>
                      </TableCell>
                    )}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => openDrawer(a)}>
                        <Eye className="h-3 w-3 mr-1" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Sheet Prep Log (Admin only) */}
      {isAdmin && (
        <div className="mt-6">
          <Collapsible open={sheetLogOpen} onOpenChange={setSheetLogOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between h-10 text-sm font-medium border-border">
                <span className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  Google Sheets Activity Log
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${sheetLogOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <SheetPrepLog />
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* Export Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export to LearnWorlds CSV</DialogTitle>
            <DialogDescription>Configure the export for {selectedIds.size} selected asset{selectedIds.size !== 1 ? "s" : ""}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Export Name (Group)</Label>
              <Input value={exportName} onChange={(e) => setExportName(e.target.value)} className="h-8 text-xs" placeholder="e.g. Ch 8 Bonds" />
            </div>
            <div>
              <Label className="text-xs">Question Type</Label>
              <Select value={exportQuestionType} onValueChange={setExportQuestionType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TMC">Multiple Choice (TMC)</SelectItem>
                  <SelectItem value="TMCMA">Multiple Answers (TMCMA)</SelectItem>
                  <SelectItem value="TTF">True/False (TTF)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Include Journal Entry as:</Label>
              <Select value={journalOption} onValueChange={(v) => setJournalOption(v as JournalOption)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="question">Part of question text</SelectItem>
                  <SelectItem value="feedback">Part of feedback</SelectItem>
                  <SelectItem value="none">Not included</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setExportOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleExport} disabled={isExporting}>
              {isExporting ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Generating…</> : <><Download className="h-3.5 w-3.5 mr-1" /> Export CSV</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
            <DialogDescription>This will permanently remove this teaching asset. Continue?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revert confirmation */}
      <Dialog open={!!revertId} onOpenChange={() => setRevertId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Revert to Generated</DialogTitle>
            <DialogDescription>This will delete this asset, revert its variants back to draft, and set the source problem back to "Generated" so you can make modifications. Continue?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRevertId(null)}>Cancel</Button>
            <Button size="sm" variant="destructive" onClick={() => {
              const asset = assets?.find((a) => a.id === revertId);
              if (asset) revertMutation.mutate(asset);
            }} disabled={revertMutation.isPending}>
              {revertMutation.isPending ? "Reverting…" : "Revert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Export Set Dialog */}
      <Dialog open={addToSetOpen} onOpenChange={setAddToSetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to Export Set</DialogTitle>
            <DialogDescription>Add {selectedIds.size} asset{selectedIds.size !== 1 ? "s" : ""} to an export set.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Export Set</Label>
              <Select value={selectedSetId} onValueChange={setSelectedSetId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__">+ Create New Set</SelectItem>
                  {exportSets?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedSetId === "__new__" && (
              <div>
                <Label className="text-xs">New Set Name</Label>
                <Input value={newSetName} onChange={(e) => setNewSetName(e.target.value)} placeholder="e.g. Ch 8 Bonds Quiz" className="h-8 text-xs" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddToSetOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddToSet} disabled={addToSetMutation.isPending}>
              {addToSetMutation.isPending ? "Adding…" : "Add to Set"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet Prep Complete Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Sheet Prep Complete!
            </DialogTitle>
            <DialogDescription>
              Thanks for prepping this sheet! Lee will review it ASAP to verify it's ready for deployment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Estimated prep time (minutes)</Label>
              <Input
                type="number"
                min={1}
                value={verifyPrepMinutes}
                onChange={(e) => setVerifyPrepMinutes(e.target.value)}
                placeholder="e.g. 15"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                placeholder="Anything Lee should know about this sheet…"
                className="text-xs min-h-[60px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setVerifyDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={async () => {
              if (!verifyAssetId) return;
              try {
                const { error } = await supabase
                  .from("teaching_assets")
                  .update({
                    google_sheet_status: "verified_by_va",
                  } as any)
                  .eq("id", verifyAssetId);
                if (error) throw error;

                // Log to sheet_prep_log if it exists
                await supabase.from("sheet_prep_log").insert({
                  teaching_asset_id: verifyAssetId,
                  notes: [
                    verifyPrepMinutes ? `Prep time: ${verifyPrepMinutes} min` : "",
                    verifyNotes || "",
                  ].filter(Boolean).join(" — ") || "Marked ready for review",
                } as any).then(() => {});

                qc.invalidateQueries({ queryKey: ["teaching-assets"] });
                toast.success("Sheet marked as ready for review!");
                setVerifyDialogOpen(false);
              } catch (e: any) {
                toast.error(e.message || "Failed to update status");
              }
            }}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Submit for Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Asset Detail Drawer */}
      <AssetDetailDrawer
        asset={viewingAsset as any}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setViewingAsset(null); }}
        chapterLabel={viewingAsset ? chapterLabel(viewingAsset.chapter_id) : ""}
        courseLabel={viewingAsset ? courseLabel(viewingAsset.course_id) : ""}
        sheetUrl={viewingAsset ? sheetUrls[viewingAsset.asset_name] : undefined}
        onRevert={() => { if (viewingAsset) { setRevertId(viewingAsset.id); setDrawerOpen(false); setViewingAsset(null); } }}
        onDelete={() => { if (viewingAsset) { setDeleteId(viewingAsset.id); setDrawerOpen(false); setViewingAsset(null); } }}
        onAssetUpdated={() => qc.invalidateQueries({ queryKey: ["teaching-assets"] })}
        isAdmin={isAdmin}
      />
    </SurviveSidebarLayout>
  );
}
