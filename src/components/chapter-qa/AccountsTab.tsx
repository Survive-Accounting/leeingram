import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Check, X, ChevronDown, ChevronRight, Loader2, Sparkles, Trash2 } from "lucide-react";

const ACCOUNT_TYPE_ORDER = [
  "Current Asset", "Long-Term Asset", "Contra Asset",
  "Current Liability", "Long-Term Liability", "Equity",
  "Revenue", "Expense", "Contra Revenue",
];

type AccountRow = {
  id: string; chapter_id: string; account_name: string; account_type: string;
  normal_balance: string; account_description: string; sort_order: number;
  is_approved: boolean; is_rejected: boolean | null;
};

export function AccountsTab({ chapterId, chapterName, courseCode }: { chapterId: string; chapterName: string; courseCode: string }) {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState("");

  const { data: accounts, refetch } = useQuery({
    queryKey: ["cqa-accounts", chapterId],
    queryFn: async () => {
      const { data } = await supabase.from("chapter_accounts").select("*").eq("chapter_id", chapterId).order("sort_order");
      return (data || []) as AccountRow[];
    },
  });

  const invalidate = () => { refetch(); };

  const handleGenerate = async (extra?: string) => {
    setGenerating(true);
    try {
      const body: any = { chapterId, chapterName, courseCode, only: "accounts" };
      if (extra) body.extraPrompt = extra;
      const { error } = await supabase.functions.invoke("generate-chapter-content-suite", { body });
      if (error) throw error;
      toast.success(extra ? "New accounts added." : "Accounts generated.");
      setExtraPrompt("");
      invalidate();
    } catch (err: any) { toast.error(err.message); }
    finally { setGenerating(false); }
  };

  const approve = async (id: string) => { await supabase.from("chapter_accounts").update({ is_approved: true, is_rejected: false }).eq("id", id); invalidate(); };
  const reject = async (id: string) => { await supabase.from("chapter_accounts").update({ is_rejected: true, is_approved: false }).eq("id", id); invalidate(); };
  const remove = async (id: string) => { await supabase.from("chapter_accounts").delete().eq("id", id); invalidate(); };
  const update = async (id: string, field: string, value: string) => { await supabase.from("chapter_accounts").update({ [field]: value }).eq("id", id); invalidate(); };
  const approveAll = async () => { await supabase.from("chapter_accounts").update({ is_approved: true, is_rejected: false }).eq("chapter_id", chapterId); invalidate(); toast.success("All accounts approved"); };

  if (!accounts?.length && !generating) {
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-sm text-muted-foreground">No accounts generated yet.</p>
        <Button onClick={() => handleGenerate()} disabled={generating}><Sparkles className="h-4 w-4 mr-2" /> Generate Accounts →</Button>
      </div>
    );
  }

  const grouped = ACCOUNT_TYPE_ORDER.map(type => ({
    type,
    items: (accounts || []).filter(a => a.account_type === type),
  })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-2 pb-20">
      {grouped.map((group, gi) => (
        <AccountGroup key={group.type} group={group} defaultOpen={gi === 0} onApprove={approve} onReject={reject} onDelete={remove} onUpdate={update} />
      ))}

      <div className="rounded-lg border border-border p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Something missing? Add a prompt:</p>
        <Textarea value={extraPrompt} onChange={(e) => setExtraPrompt(e.target.value)} placeholder="e.g. Add contra accounts for allowance for doubtful accounts." className="text-sm" rows={3} />
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

function AccountGroup({ group, defaultOpen, onApprove, onReject, onDelete, onUpdate }: {
  group: { type: string; items: AccountRow[] };
  defaultOpen: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, field: string, value: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors text-left">
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <span className="text-xs font-semibold text-foreground">{group.type}</span>
        <Badge variant="secondary" className="text-[9px] h-4 ml-auto">{group.items.length}</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 space-y-1 pl-2">
        {group.items.map(acc => (
          <AccountRowBlock key={acc.id} account={acc} onApprove={() => onApprove(acc.id)} onReject={() => onReject(acc.id)} onDelete={() => onDelete(acc.id)} onUpdate={onUpdate} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function AccountRowBlock({ account, onApprove, onReject, onDelete, onUpdate }: {
  account: AccountRow;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  onUpdate: (id: string, field: string, value: string) => void;
}) {
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState(account.account_name);
  const [editDesc, setEditDesc] = useState(false);
  const [desc, setDesc] = useState(account.account_description);

  const balancePill = account.normal_balance === "Debit"
    ? <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] h-5">Dr +</Badge>
    : account.normal_balance === "Credit"
    ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] h-5">Cr +</Badge>
    : <Badge variant="secondary" className="text-[10px] h-5">Both</Badge>;

  const statusPill = account.is_approved
    ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] h-5">✓</Badge>
    : account.is_rejected
    ? <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px] h-5">✗</Badge>
    : <Badge variant="secondary" className="text-[10px] h-5">Pending</Badge>;

  return (
    <div className="rounded-md border border-border px-3 py-2 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        {editName ? (
          <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { onUpdate(account.id, "account_name", name); setEditName(false); }} onKeyDown={(e) => { if (e.key === "Enter") { onUpdate(account.id, "account_name", name); setEditName(false); } }} className="h-6 text-xs w-48 font-semibold" autoFocus />
        ) : (
          <button onClick={() => setEditName(true)} className="text-xs font-semibold text-foreground hover:underline">{account.account_name}</button>
        )}
        {balancePill}
        {statusPill}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <button onClick={onApprove} className="p-1 rounded hover:bg-emerald-500/20 text-emerald-500 transition-colors"><Check className="h-3.5 w-3.5" /></button>
          <button onClick={onReject} className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors"><X className="h-3.5 w-3.5" /></button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      {editDesc ? (
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => { onUpdate(account.id, "account_description", desc); setEditDesc(false); }} onKeyDown={(e) => { if (e.key === "Enter") { onUpdate(account.id, "account_description", desc); setEditDesc(false); } }} className="h-6 text-[11px] text-muted-foreground" autoFocus />
      ) : (
        <button onClick={() => setEditDesc(true)} className="text-[11px] text-muted-foreground hover:underline text-left block">{account.account_description || "Add description..."}</button>
      )}
    </div>
  );
}
