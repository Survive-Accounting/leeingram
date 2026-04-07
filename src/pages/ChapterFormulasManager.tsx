/**
 * ChapterFormulasManager — Admin-only management tool for chapter-level formulas.
 * Accessible from Phase 3 Study Tools in the sidebar.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Check, X, GripVertical, Trash2, Loader2, Sparkles, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type FormulaRow = {
  id: string;
  chapter_id: string;
  formula_name: string;
  formula_expression: string;
  formula_explanation: string | null;
  image_url: string | null;
  is_approved: boolean;
  is_rejected: boolean;
  sort_order: number;
};

export default function ChapterFormulasManager() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState("");
  const [extraPrompt, setExtraPrompt] = useState("");
  const [genImagesProgress, setGenImagesProgress] = useState("");

  const { data: courses } = useQuery({
    queryKey: ["formula-mgr-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, code, course_name").order("created_at");
      return data || [];
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["formula-mgr-chapters", selectedCourse],
    queryFn: async () => {
      let q = supabase.from("chapters").select("id, chapter_number, chapter_name, course_id").order("chapter_number");
      if (selectedCourse) q = q.eq("course_id", selectedCourse);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: formulas, refetch } = useQuery({
    queryKey: ["formula-mgr-formulas", selectedChapter],
    queryFn: async () => {
      if (!selectedChapter) return [];
      const { data } = await supabase.from("chapter_formulas").select("*").eq("chapter_id", selectedChapter).order("sort_order");
      return (data || []) as FormulaRow[];
    },
    enabled: !!selectedChapter,
  });

  const currentChapter = chapters?.find((ch) => ch.id === selectedChapter);
  const currentCourse = courses?.find((c) => c.id === (currentChapter?.course_id || selectedCourse));

  const invalidate = () => { refetch(); };

  const handleGenerate = async (allChapters: boolean) => {
    setGenerating(true);
    setGenProgress(allChapters ? "Starting all chapters..." : "Generating...");
    try {
      const body: any = allChapters
        ? { all: true }
        : { chapterId: selectedChapter, chapterName: currentChapter?.chapter_name, courseCode: currentCourse?.code };
      const { data, error } = await supabase.functions.invoke("generate-chapter-formulas", { body });
      if (error) throw error;
      toast.success(`Generated: ${data.completed}/${data.total} chapters. ${data.errors?.length || 0} errors.`);
      invalidate();
    } catch (err: any) { toast.error(err.message); }
    finally { setGenerating(false); setGenProgress(""); }
  };

  const handleExtraPromptGenerate = async () => {
    if (!extraPrompt.trim() || !selectedChapter) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-chapter-formulas", {
        body: { chapterId: selectedChapter, chapterName: currentChapter?.chapter_name, courseCode: currentCourse?.code, extraPrompt: extraPrompt.trim() },
      });
      if (error) throw error;
      toast.success("New formulas added.");
      setExtraPrompt("");
      invalidate();
    } catch (err: any) { toast.error(err.message); }
    finally { setGenerating(false); }
  };

  const approveFormula = async (id: string) => { await supabase.from("chapter_formulas").update({ is_approved: true, is_rejected: false } as any).eq("id", id); invalidate(); };
  const rejectFormula = async (id: string) => { await supabase.from("chapter_formulas").update({ is_rejected: true, is_approved: false } as any).eq("id", id); invalidate(); };
  const deleteFormula = async (id: string) => { await supabase.from("chapter_formulas").delete().eq("id", id); invalidate(); };
  const updateFormula = async (id: string, field: string, value: string) => { await supabase.from("chapter_formulas").update({ [field]: value }).eq("id", id); invalidate(); };

  const approveAll = async () => {
    if (!selectedChapter) return;
    await supabase.from("chapter_formulas").update({ is_approved: true, is_rejected: false } as any).eq("chapter_id", selectedChapter);
    invalidate();
    toast.success("All formulas approved");
  };

  const rejectAll = async () => {
    if (!selectedChapter) return;
    await supabase.from("chapter_formulas").update({ is_rejected: true, is_approved: false } as any).eq("chapter_id", selectedChapter);
    invalidate();
    toast.success("All formulas rejected");
  };

  const generateImages = async () => {
    if (!selectedChapter) return;
    setGenImagesProgress("Generating images...");
    try {
      const { data, error } = await supabase.functions.invoke("generate-formula-images", { body: { chapterId: selectedChapter } });
      if (error) throw error;
      toast.success(`${data.generated} formula images generated, ${data.skipped} skipped.`);
    } catch (err: any) { toast.error(err.message); }
    finally { setGenImagesProgress(""); invalidate(); }
  };

  const generateAllImages = async () => {
    if (!chapters?.length) return;
    setGenImagesProgress("Starting...");
    let totalGen = 0;
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      setGenImagesProgress(`Ch ${ch.chapter_number}: ${i + 1}/${chapters.length}...`);
      try {
        const { data, error } = await supabase.functions.invoke("generate-formula-images", { body: { chapterId: ch.id } });
        if (!error && data) totalGen += data.generated || 0;
      } catch { /* continue */ }
    }
    setGenImagesProgress("");
    toast.success(`${totalGen} images generated across all chapters.`);
    invalidate();
  };

  const totalCount = formulas?.length || 0;
  const approvedCount = formulas?.filter(f => f.is_approved).length || 0;

  return (
    <SurviveSidebarLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">Chapter Formulas</h1>
        <p className="text-sm text-muted-foreground">
          Manage the master reference list of formulas per chapter for student study tools.
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
            <SelectContent className="z-50 max-h-80">
              {chapters?.map((ch) => (
                <SelectItem key={ch.id} value={ch.id}>Ch {ch.chapter_number} — {ch.chapter_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2 ml-auto">
            <Button size="sm" onClick={() => handleGenerate(false)} disabled={generating || !selectedChapter}>
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              Generate This Chapter
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleGenerate(true)} disabled={generating}>
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              Generate All
            </Button>
            <Button size="sm" variant="outline" onClick={generateAllImages} disabled={generating || !!genImagesProgress}>
              {genImagesProgress && !selectedChapter ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ImageIcon className="h-3.5 w-3.5 mr-1" />}
              Generate All Images
            </Button>
          </div>
        </div>

        {(genProgress || genImagesProgress) && <p className="text-xs text-muted-foreground animate-pulse">{genProgress || genImagesProgress}</p>}

        {/* Summary + bulk actions */}
        {selectedChapter && formulas && formulas.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="secondary">{totalCount} formulas</Badge>
            <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">{approvedCount} approved</Badge>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={approveAll}>
              <Check className="h-3 w-3 mr-1" /> Approve All
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={rejectAll}>
              <X className="h-3 w-3 mr-1" /> Reject All
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs ml-auto" onClick={generateImages} disabled={!!genImagesProgress}>
              {genImagesProgress ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ImageIcon className="h-3.5 w-3.5 mr-1" />}
              {genImagesProgress || "Generate Images →"}
            </Button>
          </div>
        )}

        {/* Formula list */}
        {selectedChapter && formulas?.map((f) => (
          <FormulaRowBlock
            key={f.id}
            formula={f}
            onApprove={() => approveFormula(f.id)}
            onReject={() => rejectFormula(f.id)}
            onDelete={() => deleteFormula(f.id)}
            onUpdate={updateFormula}
            onRegenImage={async () => {
              try {
                await supabase.functions.invoke("generate-formula-images", { body: { formulaId: f.id } });
                toast.success("Image regenerated.");
                invalidate();
              } catch (err: any) { toast.error(err.message); }
            }}
          />
        ))}

        {selectedChapter && (!formulas || formulas.length === 0) && !generating && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No formulas yet. Click "Generate This Chapter" to start.
          </p>
        )}

        {/* Extra prompt section */}
        {selectedChapter && formulas && formulas.length > 0 && (
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Something missing? Describe what to add:</p>
            <Textarea
              value={extraPrompt}
              onChange={(e) => setExtraPrompt(e.target.value)}
              placeholder="e.g. Also include the effective interest method formula, and the formula for interest accrual at a partial period."
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

// ── Formula Row ────────────────────────────────────
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
    : formula.is_rejected
    ? <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px] h-5">Rejected ✗</Badge>
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
