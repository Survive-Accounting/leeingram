import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Download, Trash2, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type JournalOption = "question" | "feedback" | "none";

function escapeCSV(val: string): string {
  if (!val) return "";
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

type SetItem = {
  id: string;
  export_set_id: string;
  teaching_asset_id: string;
  order_index: number;
  teaching_assets: {
    id: string;
    asset_name: string;
    tags: string[];
    survive_problem_text: string;
    journal_entry_block: string | null;
    survive_solution_text: string;
  };
};

function SortableItem({ item, onRemove }: { item: SetItem; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const asset = item.teaching_assets;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3"
    >
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{asset.asset_name}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {(asset.tags ?? []).slice(0, 4).map((t) => (
            <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>
          ))}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => onRemove(item.id)}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

export default function ExportSetDetail() {
  const { setId } = useParams<{ setId: string }>();
  const qc = useQueryClient();
  const [exportOpen, setExportOpen] = useState(false);
  const [exportName, setExportName] = useState("");
  const [exportQuestionType, setExportQuestionType] = useState("TMC");
  const [journalOption, setJournalOption] = useState<JournalOption>("feedback");
  const [isExporting, setIsExporting] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: exportSet } = useQuery({
    queryKey: ["export-set", setId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("export_sets")
        .select("*")
        .eq("id", setId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!setId,
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ["export-set-items", setId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("export_set_items")
        .select("*, teaching_assets(id, asset_name, tags, survive_problem_text, journal_entry_block, survive_solution_text)")
        .eq("export_set_id", setId!)
        .order("order_index");
      if (error) throw error;
      return data as unknown as SetItem[];
    },
    enabled: !!setId,
  });

  const removeMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("export_set_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["export-set-items", setId] });
      toast.success("Asset removed from set");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderMutation = useMutation({
    mutationFn: async (reordered: { id: string; order_index: number }[]) => {
      for (const item of reordered) {
        const { error } = await supabase
          .from("export_set_items")
          .update({ order_index: item.order_index } as any)
          .eq("id", item.id);
        if (error) throw error;
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !items) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);

    // Optimistic update
    qc.setQueryData(["export-set-items", setId], reordered.map((item, idx) => ({
      ...item,
      order_index: idx,
    })));

    reorderMutation.mutate(reordered.map((item, idx) => ({ id: item.id, order_index: idx })));
  };

  const handleExport = async () => {
    if (!items?.length) return;

    setIsExporting(true);
    try {
      const assetPayloads = items.map((i) => ({
        asset_name: i.teaching_assets.asset_name,
        survive_problem_text: i.teaching_assets.survive_problem_text,
        journal_entry_block: i.teaching_assets.journal_entry_block,
        survive_solution_text: i.teaching_assets.survive_solution_text,
      }));

      const { data, error } = await supabase.functions.invoke("generate-distractors", {
        body: { assets: assetPayloads, journalOption },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const distractors: any[] = data.distractors || [];
      const groupName = exportName || exportSet?.name || "Export";

      const header = "Group,Type,Question,CorAns,Answer1,Answer2,Answer3,Answer4,Answer5,Answer6,Answer7,CorrectExplanation,IncorrectExplanation";
      const rows = items.map((item, idx) => {
        const asset = item.teaching_assets;
        const d = distractors[idx] || {};

        let questionText = asset.survive_problem_text;
        if (journalOption === "question" && asset.journal_entry_block) {
          questionText += "\n\n" + asset.journal_entry_block;
        }

        let correctFeedback = asset.survive_solution_text;
        if (journalOption === "feedback" && asset.journal_entry_block) {
          correctFeedback = asset.journal_entry_block + "\n\n" + asset.survive_solution_text;
        }

        const correctPos = Math.floor(Math.random() * 4) + 1;
        const answers = ["", "", "", ""];
        answers[correctPos - 1] = d.correct_answer || asset.journal_entry_block || "Correct answer";
        let dIdx = 0;
        const distractorList = [d.distractor_1, d.distractor_2, d.distractor_3].filter(Boolean);
        for (let i = 0; i < 4; i++) {
          if (i !== correctPos - 1) {
            answers[i] = distractorList[dIdx] || `Option ${i + 1}`;
            dIdx++;
          }
        }

        return [groupName, exportQuestionType, questionText, String(correctPos), ...answers, "", "", "", correctFeedback, asset.survive_solution_text].map(escapeCSV).join(",");
      });

      const csv = header + "\n" + rows.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${(exportName || exportSet?.name || "export").replace(/\s+/g, "_")}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${items.length} assets`);
      setExportOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SurviveSidebarLayout>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
            <Link to="/export-sets"><ArrowLeft className="h-3 w-3 mr-1" /> Back</Link>
          </Button>
          <h1 className="text-xl font-bold text-foreground">{exportSet?.name || "Export Set"}</h1>
        </div>
        <Button size="sm" onClick={() => { setExportName(exportSet?.name || ""); setExportOpen(true); }} disabled={!items?.length}>
          <Download className="h-3.5 w-3.5 mr-1" /> Export this Set
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !items?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No assets in this set yet.</p>
          <p className="text-xs mt-1">Go to Assets Library → select assets → "Add to Export Set"</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map((item) => (
                <SortableItem key={item.id} item={item} onRemove={(id) => removeMutation.mutate(id)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Export Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export to LearnWorlds CSV</DialogTitle>
            <DialogDescription>Export {items?.length || 0} assets from this set.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Export Name (Group)</Label>
              <Input value={exportName} onChange={(e) => setExportName(e.target.value)} className="h-8 text-xs" />
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
    </SurviveSidebarLayout>
  );
}
