import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, X, ArrowUp, ArrowDown, Loader2, Sparkles, Trash2 } from "lucide-react";

type TermRow = {
  id: string; chapter_id: string; term: string; definition: string;
  category: string | null;
  sort_order: number; is_approved: boolean; is_rejected: boolean | null;
};

export function KeyTermsTab({ chapterId, chapterName, courseCode }: { chapterId: string; chapterName: string; courseCode: string }) {
  const [generating, setGenerating] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState("");

  const { data: terms, refetch } = useQuery({
    queryKey: ["cqa-key-terms", chapterId],
    queryFn: async () => {
      const { data } = await supabase.from("chapter_key_terms").select("*").eq("chapter_id", chapterId).order("sort_order");
      return (data || []) as TermRow[];
    },
  });

  const grouped = useMemo(() => {
    if (!terms?.length) return [];
    const map = new Map<string, TermRow[]>();
    for (const t of terms) {
      const cat = t.category || "General";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(t);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [terms]);

  const invalidate = () => { refetch(); };

  const handleGenerate = async (extra?: string) => {
    setGenerating(true);
    try {
      const body: any = { chapterId, chapterName, courseCode, only: "key_terms" };
      if (extra) body.extraPrompt = extra;
      const { error } = await supabase.functions.invoke("generate-chapter-content-suite", { body });
      if (error) throw error;
      toast.success(extra ? "New terms added." : "Key terms generated.");
      setExtraPrompt("");
      invalidate();
    } catch (err: any) { toast.error(err.message); }
    finally { setGenerating(false); }
  };

  const approve = async (id: string) => { await supabase.from("chapter_key_terms").update({ is_approved: true, is_rejected: false }).eq("id", id); invalidate(); };
  const hide = async (id: string) => { await supabase.from("chapter_key_terms").update({ is_rejected: true, is_approved: false }).eq("id", id); invalidate(); };
  const remove = async (id: string) => { await supabase.from("chapter_key_terms").delete().eq("id", id); invalidate(); };
  const update = async (id: string, field: string, value: string) => { await supabase.from("chapter_key_terms").update({ [field]: value }).eq("id", id); invalidate(); };
  const approveAll = async () => { await supabase.from("chapter_key_terms").update({ is_approved: true, is_rejected: false }).eq("chapter_id", chapterId); invalidate(); toast.success("All terms approved"); };

  const swap = async (a: TermRow, b: TermRow) => {
    await Promise.all([
      supabase.from("chapter_key_terms").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("chapter_key_terms").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    invalidate();
  };

  if (!terms?.length && !generating) {
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-sm text-muted-foreground">No key terms generated yet.</p>
        <Button onClick={() => handleGenerate()} disabled={generating}><Sparkles className="h-4 w-4 mr-2" /> Generate Key Terms →</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-20">
      {grouped.map(([category, catTerms]) => (
        <div key={category}>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 px-1">{category}</h4>
          <div className="space-y-1">
            {catTerms.map((t, idx) => (
              <TermRowBlock key={t.id} term={t}
                onApprove={() => approve(t.id)} onHide={() => hide(t.id)} onDelete={() => remove(t.id)} onUpdate={update}
                onMoveUp={idx > 0 ? () => swap(t, catTerms[idx - 1]) : undefined}
                onMoveDown={idx < catTerms.length - 1 ? () => swap(t, catTerms[idx + 1]) : undefined}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="rounded-lg border border-border p-4 space-y-3 mt-3">
        <p className="text-sm font-semibold text-foreground">Something missing? Add a prompt:</p>
        <Textarea value={extraPrompt} onChange={(e) => setExtraPrompt(e.target.value)} placeholder="e.g. Add terms for amortization schedule and effective interest rate." className="text-sm" rows={3} />
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

function TermRowBlock({ term, onApprove, onHide, onDelete, onUpdate, onMoveUp, onMoveDown }: {
  term: TermRow; onApprove: () => void; onHide: () => void; onDelete: () => void;
  onUpdate: (id: string, field: string, value: string) => void;
  onMoveUp?: () => void; onMoveDown?: () => void;
}) {
  const [editTerm, setEditTerm] = useState(false);
  const [termVal, setTermVal] = useState(term.term);
  const [editDef, setEditDef] = useState(false);
  const [defVal, setDefVal] = useState(term.definition);

  const statusPill = term.is_approved
    ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] h-5">✓</Badge>
    : term.is_rejected
    ? <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] h-5">Hidden</Badge>
    : <Badge variant="secondary" className="text-[10px] h-5">Pending</Badge>;

  return (
    <div className="rounded-md border border-border px-3 py-2 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex flex-col gap-0 shrink-0">
          <button onClick={onMoveUp} disabled={!onMoveUp} className="p-0.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-20 transition-colors"><ArrowUp className="h-3 w-3" /></button>
          <button onClick={onMoveDown} disabled={!onMoveDown} className="p-0.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-20 transition-colors"><ArrowDown className="h-3 w-3" /></button>
        </div>
        {editTerm ? (
          <Input value={termVal} onChange={(e) => setTermVal(e.target.value)} onBlur={() => { onUpdate(term.id, "term", termVal); setEditTerm(false); }} onKeyDown={(e) => { if (e.key === "Enter") { onUpdate(term.id, "term", termVal); setEditTerm(false); } }} className="h-6 text-xs w-48 font-semibold" autoFocus />
        ) : (
          <button onClick={() => setEditTerm(true)} className="text-xs font-semibold text-foreground hover:underline">{term.term}</button>
        )}
        {term.category && <Badge variant="outline" className="text-[9px] h-4">{term.category}</Badge>}
        {statusPill}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <button onClick={onApprove} className="p-1 rounded hover:bg-emerald-500/20 text-emerald-500 transition-colors" title="Approve"><Check className="h-3.5 w-3.5" /></button>
          <button onClick={onHide} className="p-1 rounded hover:bg-amber-500/20 text-amber-500 transition-colors" title="Hide"><X className="h-3.5 w-3.5" /></button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      {editDef ? (
        <Input value={defVal} onChange={(e) => setDefVal(e.target.value)} onBlur={() => { onUpdate(term.id, "definition", defVal); setEditDef(false); }} onKeyDown={(e) => { if (e.key === "Enter") { onUpdate(term.id, "definition", defVal); setEditDef(false); } }} className="h-6 text-[11px] text-muted-foreground ml-6" autoFocus />
      ) : (
        <button onClick={() => setEditDef(true)} className="text-[11px] text-muted-foreground hover:underline text-left block ml-6">{term.definition}</button>
      )}
    </div>
  );
}
