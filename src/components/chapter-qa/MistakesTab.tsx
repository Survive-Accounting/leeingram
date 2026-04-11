import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, X, ArrowUp, ArrowDown, Loader2, Sparkles, Trash2, ChevronDown, ChevronRight } from "lucide-react";

type MistakeRow = {
  id: string; chapter_id: string; mistake: string; explanation: string | null;
  example_text: string | null;
  sort_order: number; is_approved: boolean; is_rejected: boolean | null;
};

const RANK_BADGES: Record<number, { label: string; className: string }> = {
  1: { label: "#1 Most Dangerous", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  2: { label: "#2 Most Common", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  3: { label: "#3 Most Subtle", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
};

export function MistakesTab({ chapterId, chapterName, courseCode }: { chapterId: string; chapterName: string; courseCode: string }) {
  const [generating, setGenerating] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState("");

  const { data: mistakes, refetch } = useQuery({
    queryKey: ["cqa-mistakes", chapterId],
    queryFn: async () => {
      const { data } = await supabase.from("chapter_exam_mistakes").select("*").eq("chapter_id", chapterId).order("sort_order");
      return (data || []) as MistakeRow[];
    },
  });

  const invalidate = () => { refetch(); };

  const handleGenerate = async (extra?: string) => {
    setGenerating(true);
    try {
      const body: any = { chapterId, chapterName, courseCode, only: "exam_mistakes" };
      if (extra) body.extraPrompt = extra;
      const { error } = await supabase.functions.invoke("generate-chapter-content-suite", { body });
      if (error) throw error;
      toast.success(extra ? "New mistakes added." : "Exam mistakes generated.");
      setExtraPrompt("");
      invalidate();
    } catch (err: any) { toast.error(err.message); }
    finally { setGenerating(false); }
  };

  const approve = async (id: string) => { await supabase.from("chapter_exam_mistakes").update({ is_approved: true, is_rejected: false }).eq("id", id); invalidate(); };
  const hide = async (id: string) => { await supabase.from("chapter_exam_mistakes").update({ is_rejected: true, is_approved: false }).eq("id", id); invalidate(); };
  const remove = async (id: string) => { await supabase.from("chapter_exam_mistakes").delete().eq("id", id); invalidate(); };
  const update = async (id: string, field: string, value: string) => { await supabase.from("chapter_exam_mistakes").update({ [field]: value }).eq("id", id); invalidate(); };
  const approveAll = async () => { await supabase.from("chapter_exam_mistakes").update({ is_approved: true, is_rejected: false }).eq("chapter_id", chapterId); invalidate(); toast.success("All mistakes approved"); };

  const swap = async (a: MistakeRow, b: MistakeRow) => {
    await Promise.all([
      supabase.from("chapter_exam_mistakes").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("chapter_exam_mistakes").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    invalidate();
  };

  if (!mistakes?.length && !generating) {
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-sm text-muted-foreground">No exam mistakes generated yet.</p>
        <Button onClick={() => handleGenerate()} disabled={generating}><Sparkles className="h-4 w-4 mr-2" /> Generate Exam Mistakes →</Button>
      </div>
    );
  }

  return (
    <div className="space-y-1 pb-20">
      {mistakes?.map((m, idx) => (
        <MistakeRowBlock key={m.id} mistake={m} rank={idx + 1}
          onApprove={() => approve(m.id)} onHide={() => hide(m.id)} onDelete={() => remove(m.id)} onUpdate={update}
          onMoveUp={idx > 0 ? () => swap(m, mistakes[idx - 1]) : undefined}
          onMoveDown={idx < mistakes.length - 1 ? () => swap(m, mistakes[idx + 1]) : undefined}
        />
      ))}

      <div className="rounded-lg border border-border p-4 space-y-3 mt-3">
        <p className="text-sm font-semibold text-foreground">Something missing? Add a prompt:</p>
        <Textarea value={extraPrompt} onChange={(e) => setExtraPrompt(e.target.value)} placeholder="e.g. Add mistakes about confusing premium vs discount amortization direction." className="text-sm" rows={3} />
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

function MistakeRowBlock({ mistake, rank, onApprove, onHide, onDelete, onUpdate, onMoveUp, onMoveDown }: {
  mistake: MistakeRow; rank: number; onApprove: () => void; onHide: () => void; onDelete: () => void;
  onUpdate: (id: string, field: string, value: string) => void;
  onMoveUp?: () => void; onMoveDown?: () => void;
}) {
  const [editLabel, setEditLabel] = useState(false);
  const [label, setLabel] = useState(mistake.mistake);
  const [editExpl, setEditExpl] = useState(false);
  const [expl, setExpl] = useState(mistake.explanation || "");
  const [showExample, setShowExample] = useState(false);
  const [editExample, setEditExample] = useState(false);
  const [exampleText, setExampleText] = useState(mistake.example_text || "");

  const rankBadge = RANK_BADGES[rank];
  const statusPill = mistake.is_approved
    ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] h-5">✓</Badge>
    : mistake.is_rejected
    ? <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] h-5">Hidden</Badge>
    : <Badge variant="secondary" className="text-[10px] h-5">Pending</Badge>;

  return (
    <div className="rounded-md border border-border px-3 py-2 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex flex-col gap-0 shrink-0">
          <button onClick={onMoveUp} disabled={!onMoveUp} className="p-0.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-20 transition-colors"><ArrowUp className="h-3 w-3" /></button>
          <button onClick={onMoveDown} disabled={!onMoveDown} className="p-0.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-20 transition-colors"><ArrowDown className="h-3 w-3" /></button>
        </div>
        {rankBadge && <Badge className={`${rankBadge.className} text-[9px] h-4 shrink-0`}>{rankBadge.label}</Badge>}
        {editLabel ? (
          <Input value={label} onChange={(e) => setLabel(e.target.value)} onBlur={() => { onUpdate(mistake.id, "mistake", label); setEditLabel(false); }} onKeyDown={(e) => { if (e.key === "Enter") { onUpdate(mistake.id, "mistake", label); setEditLabel(false); } }} className="h-6 text-xs w-64 font-semibold" autoFocus />
        ) : (
          <button onClick={() => setEditLabel(true)} className="text-xs font-semibold text-foreground hover:underline">{mistake.mistake}</button>
        )}
        {statusPill}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <button onClick={onApprove} className="p-1 rounded hover:bg-emerald-500/20 text-emerald-500 transition-colors" title="Approve"><Check className="h-3.5 w-3.5" /></button>
          <button onClick={onHide} className="p-1 rounded hover:bg-amber-500/20 text-amber-500 transition-colors" title="Hide"><X className="h-3.5 w-3.5" /></button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      {editExpl ? (
        <Input value={expl} onChange={(e) => setExpl(e.target.value)} onBlur={() => { onUpdate(mistake.id, "explanation", expl); setEditExpl(false); }} onKeyDown={(e) => { if (e.key === "Enter") { onUpdate(mistake.id, "explanation", expl); setEditExpl(false); } }} className="h-6 text-[11px] text-muted-foreground ml-6" autoFocus />
      ) : (
        <button onClick={() => setEditExpl(true)} className="text-[11px] text-muted-foreground hover:underline text-left block ml-6">{mistake.explanation || "Add explanation..."}</button>
      )}
      <div className="ml-6">
        <button onClick={() => setShowExample(!showExample)} className="text-[10px] text-primary/70 hover:text-primary flex items-center gap-1 mt-0.5">
          {showExample ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          See an example
        </button>
        {showExample && (
          <div className="mt-1 pl-4 border-l-2 border-primary/20">
            {editExample ? (
              <Textarea value={exampleText} onChange={(e) => setExampleText(e.target.value)} onBlur={() => { onUpdate(mistake.id, "example_text", exampleText); setEditExample(false); }} className="text-[11px] text-muted-foreground min-h-[60px]" autoFocus rows={3} />
            ) : (
              <button onClick={() => setEditExample(true)} className="text-[11px] text-muted-foreground/80 hover:underline text-left block italic">
                {mistake.example_text || "Click to add an example..."}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
