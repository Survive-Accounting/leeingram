import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, X, GripVertical, Loader2, Sparkles, Trash2 } from "lucide-react";

type ChecklistRow = {
  id: string; chapter_id: string; checklist_item: string;
  sort_order: number; is_approved: boolean; is_rejected: boolean | null;
};

export function ChecklistTab({ chapterId, chapterName, courseCode }: { chapterId: string; chapterName: string; courseCode: string }) {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState("");

  const { data: items, refetch } = useQuery({
    queryKey: ["cqa-checklist", chapterId],
    queryFn: async () => {
      const { data } = await supabase.from("chapter_exam_checklist").select("*").eq("chapter_id", chapterId).order("sort_order");
      return (data || []) as ChecklistRow[];
    },
  });

  const invalidate = () => { refetch(); };

  const handleGenerate = async (extra?: string) => {
    setGenerating(true);
    try {
      const body: any = { chapterId, chapterName, courseCode, only: "exam_checklist" };
      if (extra) body.extraPrompt = extra;
      const { error } = await supabase.functions.invoke("generate-chapter-content-suite", { body });
      if (error) throw error;
      toast.success(extra ? "New checklist items added." : "Exam checklist generated.");
      setExtraPrompt("");
      invalidate();
    } catch (err: any) { toast.error(err.message); }
    finally { setGenerating(false); }
  };

  const approve = async (id: string) => { await supabase.from("chapter_exam_checklist").update({ is_approved: true, is_rejected: false }).eq("id", id); invalidate(); };
  const reject = async (id: string) => { await supabase.from("chapter_exam_checklist").update({ is_rejected: true, is_approved: false }).eq("id", id); invalidate(); };
  const remove = async (id: string) => { await supabase.from("chapter_exam_checklist").delete().eq("id", id); invalidate(); };
  const update = async (id: string, value: string) => { await supabase.from("chapter_exam_checklist").update({ checklist_item: value }).eq("id", id); invalidate(); };
  const approveAll = async () => { await supabase.from("chapter_exam_checklist").update({ is_approved: true, is_rejected: false }).eq("chapter_id", chapterId); invalidate(); toast.success("All checklist items approved"); };

  if (!items?.length && !generating) {
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-sm text-muted-foreground">No exam checklist generated yet.</p>
        <Button onClick={() => handleGenerate()} disabled={generating}><Sparkles className="h-4 w-4 mr-2" /> Generate Exam Checklist →</Button>
      </div>
    );
  }

  return (
    <div className="space-y-1 pb-20">
      {items?.map(item => (
        <ChecklistRowBlock key={item.id} item={item} onApprove={() => approve(item.id)} onReject={() => reject(item.id)} onDelete={() => remove(item.id)} onUpdate={(val) => update(item.id, val)} />
      ))}

      <div className="rounded-lg border border-border p-4 space-y-3 mt-3">
        <p className="text-sm font-semibold text-foreground">Something missing? Add a prompt:</p>
        <Textarea value={extraPrompt} onChange={(e) => setExtraPrompt(e.target.value)} placeholder="e.g. Add a checklist item about calculating bond issue price." className="text-sm" rows={3} />
        <Button size="sm" onClick={() => handleGenerate(extraPrompt.trim())} disabled={generating || !extraPrompt.trim()}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
          Run Again with This Prompt →
        </Button>
      </div>

      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border py-2 px-3 flex gap-2 -mx-3">
        <Button size="sm" variant="outline" className="text-xs" onClick={approveAll}><Check className="h-3 w-3 mr-1" /> Approve All ✓</Button>
        <Button size="sm" variant="ghost" className="text-xs ml-auto" onClick={() => handleGenerate()} disabled={generating}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
          Regenerate All
        </Button>
      </div>
    </div>
  );
}

function ChecklistRowBlock({ item, onApprove, onReject, onDelete, onUpdate }: {
  item: ChecklistRow; onApprove: () => void; onReject: () => void; onDelete: () => void;
  onUpdate: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.checklist_item);

  const statusPill = item.is_approved
    ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] h-5">✓</Badge>
    : item.is_rejected
    ? <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px] h-5">✗</Badge>
    : <Badge variant="secondary" className="text-[10px] h-5">Pending</Badge>;

  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 cursor-grab" />
        {editing ? (
          <Input value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => { onUpdate(value); setEditing(false); }} onKeyDown={(e) => { if (e.key === "Enter") { onUpdate(value); setEditing(false); } }} className="h-6 text-xs flex-1" autoFocus />
        ) : (
          <button onClick={() => setEditing(true)} className="text-xs text-foreground hover:underline text-left flex-1">{item.checklist_item}</button>
        )}
        {statusPill}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onApprove} className="p-1 rounded hover:bg-emerald-500/20 text-emerald-500 transition-colors"><Check className="h-3.5 w-3.5" /></button>
          <button onClick={onReject} className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors"><X className="h-3.5 w-3.5" /></button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  );
}
