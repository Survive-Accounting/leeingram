/**
 * ChapterJEManager — Admin-only management tool for chapter-level journal entries.
 * Accessible from Phase 3 Study Tools in the sidebar.
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Check, X, ChevronDown, ChevronRight, GripVertical, Trash2, Edit3, Loader2, Sparkles, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type JELine = {
  account: string;
  account_tooltip: string;
  side: "debit" | "credit";
  amount: string;
};

type JEEntry = {
  id: string;
  transaction_label: string;
  je_lines: JELine[];
  is_approved: boolean;
  is_rejected: boolean;
  sort_order: number;
  category_id: string | null;
};

type JECategory = {
  id: string;
  category_name: string;
  sort_order: number;
  entries: JEEntry[];
};

export default function ChapterJEManager() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Course + chapter selection
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState("");
  const [extraPrompt, setExtraPrompt] = useState("");

  const { data: courses } = useQuery({
    queryKey: ["je-mgr-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, code, course_name").order("created_at");
      return data || [];
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["je-mgr-chapters", selectedCourse],
    queryFn: async () => {
      let q = supabase.from("chapters").select("id, chapter_number, chapter_name, course_id").order("chapter_number");
      if (selectedCourse) q = q.eq("course_id", selectedCourse);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: categories, refetch: refetchCategories } = useQuery({
    queryKey: ["je-mgr-categories", selectedChapter],
    queryFn: async () => {
      if (!selectedChapter) return [];
      const { data: cats } = await supabase
        .from("chapter_je_categories")
        .select("*")
        .eq("chapter_id", selectedChapter)
        .order("sort_order");
      const { data: entries } = await supabase
        .from("chapter_journal_entries")
        .select("*")
        .eq("chapter_id", selectedChapter)
        .order("sort_order");

      return (cats || []).map((cat: any) => ({
        ...cat,
        entries: (entries || []).filter((e: any) => e.category_id === cat.id),
      })) as JECategory[];
    },
    enabled: !!selectedChapter,
  });

  // Get chapter info for generation
  const currentChapter = chapters?.find((ch) => ch.id === selectedChapter);
  const currentCourse = courses?.find((c) => c.id === (currentChapter?.course_id || selectedCourse));

  // ── Generate ────────────────────────────────
  const handleGenerate = async (allChapters: boolean) => {
    setGenerating(true);
    setGenProgress(allChapters ? "Starting all chapters..." : "Generating...");
    try {
      const body: any = allChapters
        ? { all: true }
        : {
            chapterId: selectedChapter,
            chapterName: currentChapter?.chapter_name,
            courseCode: currentCourse?.code,
          };

      const { data, error } = await supabase.functions.invoke("generate-chapter-journal-entries", { body });
      if (error) throw error;
      toast.success(`Generated: ${data.completed}/${data.total} chapters. ${data.errors?.length || 0} errors.`);
      if (data.errors?.length) console.warn("Generation errors:", data.errors);
      refetchCategories();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
      setGenProgress("");
    }
  };

  const handleExtraPromptGenerate = async () => {
    if (!extraPrompt.trim() || !selectedChapter) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-chapter-journal-entries", {
        body: {
          chapterId: selectedChapter,
          chapterName: currentChapter?.chapter_name,
          courseCode: currentCourse?.code,
          extraPrompt: extraPrompt.trim(),
        },
      });
      if (error) throw error;
      toast.success(`Added new entries. ${data.errors?.length || 0} errors.`);
      setExtraPrompt("");
      refetchCategories();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Mutations ───────────────────────────────
  const approveEntry = async (id: string) => {
    await supabase.from("chapter_journal_entries").update({ is_approved: true, is_rejected: false }).eq("id", id);
    refetchCategories();
  };

  const rejectEntry = async (id: string) => {
    await supabase.from("chapter_journal_entries").update({ is_rejected: true, is_approved: false }).eq("id", id);
    refetchCategories();
  };

  const deleteEntry = async (id: string) => {
    await supabase.from("chapter_journal_entries").delete().eq("id", id);
    refetchCategories();
  };

  const deleteCategory = async (catId: string) => {
    await supabase.from("chapter_journal_entries").delete().eq("category_id", catId);
    await supabase.from("chapter_je_categories").delete().eq("id", catId);
    refetchCategories();
  };

  const approveAll = async () => {
    if (!selectedChapter) return;
    await supabase.from("chapter_journal_entries").update({ is_approved: true, is_rejected: false }).eq("chapter_id", selectedChapter).eq("is_rejected", false);
    refetchCategories();
    toast.success("All entries approved");
  };

  const updateCategoryName = async (catId: string, name: string) => {
    await supabase.from("chapter_je_categories").update({ category_name: name }).eq("id", catId);
    refetchCategories();
  };

  const updateEntryLabel = async (entryId: string, label: string) => {
    await supabase.from("chapter_journal_entries").update({ transaction_label: label }).eq("id", entryId);
    refetchCategories();
  };

  const updateEntryLines = async (entryId: string, lines: JELine[]) => {
    await supabase.from("chapter_journal_entries").update({ je_lines: lines as any }).eq("id", entryId);
    refetchCategories();
  };

  const totalEntries = categories?.reduce((sum, c) => sum + c.entries.length, 0) || 0;
  const approvedCount = categories?.reduce((sum, c) => sum + c.entries.filter((e) => e.is_approved).length, 0) || 0;

  return (
    <SurviveSidebarLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">Chapter Journal Entries</h1>
        <p className="text-sm text-muted-foreground">
          Manage the master reference list of journal entries per chapter. These replace per-asset Related JEs.
        </p>

        {/* Course + Chapter selection */}
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedCourse} onValueChange={(v) => { setSelectedCourse(v); setSelectedChapter(""); }}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Select course" /></SelectTrigger>
            <SelectContent>
              {courses?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedChapter} onValueChange={setSelectedChapter}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Select chapter" /></SelectTrigger>
            <SelectContent>
              {chapters?.map((ch) => (
                <SelectItem key={ch.id} value={ch.id}>Ch {ch.chapter_number} — {ch.chapter_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={() => handleGenerate(true)} disabled={generating}>
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              Generate All
            </Button>
            <Button size="sm" onClick={() => handleGenerate(false)} disabled={generating || !selectedChapter}>
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              Generate This Chapter
            </Button>
          </div>
        </div>

        {genProgress && <p className="text-xs text-muted-foreground animate-pulse">{genProgress}</p>}

        {/* Summary + bulk actions */}
        {selectedChapter && categories && categories.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="secondary">{totalEntries} entries</Badge>
            <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">{approvedCount} approved</Badge>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={approveAll}>
              <Check className="h-3 w-3 mr-1" /> Approve All
            </Button>
          </div>
        )}

        {/* Category + Entry list */}
        {selectedChapter && categories?.map((cat) => (
          <CategoryBlock
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

        {selectedChapter && (!categories || categories.length === 0) && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No journal entries yet. Click "Generate This Chapter" to start.
          </p>
        )}

        {/* Extra prompt section */}
        {selectedChapter && categories && categories.length > 0 && (
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Something missing? Add a prompt:</p>
            <Textarea
              value={extraPrompt}
              onChange={(e) => setExtraPrompt(e.target.value)}
              placeholder="e.g. Add entries for early bond retirement at a loss, and convertible bond conversion to equity."
              className="text-sm"
              rows={3}
            />
            <Button size="sm" onClick={handleExtraPromptGenerate} disabled={generating || !extraPrompt.trim()}>
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              Run Again with This Prompt →
            </Button>
          </div>
        )}
      </div>
    </SurviveSidebarLayout>
  );
}

// ── CategoryBlock ───────────────────────────────
function CategoryBlock({
  category,
  onDeleteCategory,
  onUpdateCategoryName,
  onApproveEntry,
  onRejectEntry,
  onDeleteEntry,
  onUpdateEntryLabel,
  onUpdateEntryLines,
}: {
  category: JECategory;
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
        <div className="ml-auto">
          <button onClick={() => setConfirmDelete(true)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="divide-y divide-border/50">
          {category.entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              onApprove={() => onApproveEntry(entry.id)}
              onReject={() => onRejectEntry(entry.id)}
              onDelete={() => onDeleteEntry(entry.id)}
              onUpdateLabel={(label) => onUpdateEntryLabel(entry.id, label)}
              onUpdateLines={(lines) => onUpdateEntryLines(entry.id, lines)}
            />
          ))}
          {category.entries.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-3">No entries in this category.</p>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will delete "{category.category_name}" and all {category.entries.length} entries inside.</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
            <Button variant="destructive" size="sm" onClick={() => { onDeleteCategory(); setConfirmDelete(false); }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── EntryRow ────────────────────────────────────
function EntryRow({
  entry,
  onApprove,
  onReject,
  onDelete,
  onUpdateLabel,
  onUpdateLines,
}: {
  entry: JEEntry;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  onUpdateLabel: (label: string) => void;
  onUpdateLines: (lines: JELine[]) => void;
}) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [label, setLabel] = useState(entry.transaction_label);
  const [editingLines, setEditingLines] = useState(false);
  const [lines, setLines] = useState<JELine[]>((entry.je_lines as any) || []);

  const jeLines = (entry.je_lines as any as JELine[]) || [];
  const statusPill = entry.is_approved
    ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] h-5">Approved ✓</Badge>
    : entry.is_rejected
    ? <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px] h-5">Rejected ✗</Badge>
    : <Badge variant="secondary" className="text-[10px] h-5">Pending</Badge>;

  return (
    <div className="px-3 py-2 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 cursor-grab" />
        {editingLabel ? (
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => { onUpdateLabel(label); setEditingLabel(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { onUpdateLabel(label); setEditingLabel(false); } }}
            className="h-6 text-xs w-56"
            autoFocus
          />
        ) : (
          <button onClick={() => setEditingLabel(true)} className="text-xs font-medium text-foreground hover:underline text-left">
            {entry.transaction_label}
          </button>
        )}
        {/* Compact JE preview */}
        <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
          {jeLines.map((l) => l.account).join(", ")}
        </span>
        {statusPill}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <button onClick={onApprove} className="p-1 rounded hover:bg-emerald-500/20 text-emerald-500 transition-colors" title="Approve">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={onReject} className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors" title="Reject">
            <X className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { setLines(jeLines); setEditingLines(true); }} className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors" title="Edit JE lines">
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Inline JE lines editor */}
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
                  <td className="py-1 pr-1">
                    <Input value={line.account} onChange={(e) => { const n = [...lines]; n[i] = { ...n[i], account: e.target.value }; setLines(n); }} className="h-6 text-xs" />
                  </td>
                  <td className="py-1 pr-1">
                    <Input value={line.account_tooltip} onChange={(e) => { const n = [...lines]; n[i] = { ...n[i], account_tooltip: e.target.value }; setLines(n); }} className="h-6 text-xs" />
                  </td>
                  <td className="py-1 pr-1 text-center">
                    <select
                      value={line.side}
                      onChange={(e) => { const n = [...lines]; n[i] = { ...n[i], side: e.target.value as "debit" | "credit" }; setLines(n); }}
                      className="h-6 text-xs bg-background border border-input rounded px-1"
                    >
                      <option value="debit">Debit</option>
                      <option value="credit">Credit</option>
                    </select>
                  </td>
                  <td className="py-1 text-center text-muted-foreground font-mono">???</td>
                  <td className="py-1">
                    <button onClick={() => setLines(lines.filter((_, j) => j !== i))} className="p-0.5 text-destructive hover:bg-destructive/10 rounded">
                      <X className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setLines([...lines, { account: "", account_tooltip: "", side: "debit", amount: "???" }])}>
              <Plus className="h-3 w-3 mr-1" /> Add Line
            </Button>
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
