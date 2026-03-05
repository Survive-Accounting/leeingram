import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Trash2, Search, Library, Download, Loader2, FolderPlus, FileText, Undo2, ChevronDown, Layers, RefreshCw, Tag, Link2 } from "lucide-react";
import { toast } from "sonner";
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
  const { workspace } = useActiveWorkspace();
  const [courseFilter, setCourseFilter] = useState<string>(workspace?.courseId || "all");
  const [chapterFilter, setChapterFilter] = useState<string>(workspace?.chapterId || "all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (workspace?.courseId) setCourseFilter(workspace.courseId);
    if (workspace?.chapterId) setChapterFilter(workspace.chapterId);
  }, [workspace?.courseId, workspace?.chapterId]);

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
      let q = supabase.from("teaching_assets").select("*");
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

  const { data: sheetUrls } = useQuery({
    queryKey: ["asset-sheet-urls", assets?.map((a) => a.asset_name).join(",")],
    queryFn: async () => {
      if (!assets?.length) return {};
      const names = assets.map((a) => a.asset_name).filter(Boolean);
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
            {assets?.length ?? 0} approved assets · Source of truth for all teaching content.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Bulk action dropdown */}
          {selectedIds.size > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  Actions ({selectedIds.size}) <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setExportOpen(true)}>
                  <Download className="h-3.5 w-3.5 mr-2" /> Export to CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSelectedSetId("__new__"); setNewSetName(""); setAddToSetOpen(true); }}>
                  <FolderPlus className="h-3.5 w-3.5 mr-2" /> Add to Export Set
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  if (!assets) return;
                  const selected = assets.filter((a) => selectedIds.has(a.id));
                  if (!selected.length) return;
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
                }}>
                  <FileText className="h-3.5 w-3.5 mr-2" /> Generate eBook
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="opacity-40">
                  <RefreshCw className="h-3.5 w-3.5 mr-2" /> Sync Sheets to Template
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="opacity-40">
                  <Tag className="h-3.5 w-3.5 mr-2" /> Mark as Banked Candidate
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="opacity-40">
                  <Link2 className="h-3.5 w-3.5 mr-2" /> Export Links
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
              <TableHead className="text-xs">Asset Code</TableHead>
              <TableHead className="text-xs">Tags</TableHead>
              <TableHead className="text-xs">Created</TableHead>
              <TableHead className="text-xs w-16 text-right">Quick</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-foreground/80 text-xs py-8"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</TableCell></TableRow>
            ) : !assets?.length ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-xs py-8">No assets found</TableCell></TableRow>
            ) : (
              assets.map((a) => (
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
                  <TableCell className="text-xs">
                    <div className="flex flex-wrap gap-1">
                      {(a.tags ?? []).slice(0, 3).map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>
                      ))}
                      {(a.tags ?? []).length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{a.tags.length - 3}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(a.created_at), "MMM d")}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-0.5 justify-end">
                      {sheetUrls?.[a.asset_name] && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" asChild title="Open Google Sheet">
                          <a href={sheetUrls[a.asset_name]} target="_blank" rel="noopener noreferrer">
                            <Layers className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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

      {/* Asset Detail Drawer */}
      <AssetDetailDrawer
        asset={viewingAsset}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setViewingAsset(null); }}
        chapterLabel={viewingAsset ? chapterLabel(viewingAsset.chapter_id) : ""}
        courseLabel={viewingAsset ? courseLabel(viewingAsset.course_id) : ""}
        sheetUrl={viewingAsset ? sheetUrls?.[viewingAsset.asset_name] : undefined}
        onRevert={() => { if (viewingAsset) { setRevertId(viewingAsset.id); setDrawerOpen(false); setViewingAsset(null); } }}
        onDelete={() => { if (viewingAsset) { setDeleteId(viewingAsset.id); setDrawerOpen(false); setViewingAsset(null); } }}
      />
    </SurviveSidebarLayout>
  );
}
