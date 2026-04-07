import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Check, Loader2, Sparkles, Trash2, X } from "lucide-react";
import { TAccountCard, AccountGroupHeader, FIVE_GROUPS, DEBIT_NORMAL_TYPES, type TAccountData } from "@/components/TAccountCard";

export function AccountsTab({ chapterId, chapterName, courseCode }: { chapterId: string; chapterName: string; courseCode: string }) {
  const [generating, setGenerating] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState("");

  const { data: accounts, refetch } = useQuery({
    queryKey: ["cqa-accounts", chapterId],
    queryFn: async () => {
      const { data } = await supabase.from("chapter_accounts").select("*").eq("chapter_id", chapterId).order("sort_order");
      return (data || []) as TAccountData[];
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
  const approveAll = async () => { await supabase.from("chapter_accounts").update({ is_approved: true, is_rejected: false }).eq("chapter_id", chapterId); invalidate(); toast.success("All accounts approved"); };

  if (!accounts?.length && !generating) {
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-sm text-muted-foreground">No accounts generated yet.</p>
        <Button onClick={() => handleGenerate()} disabled={generating}><Sparkles className="h-4 w-4 mr-2" /> Generate Accounts →</Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-2 pb-20">
        {FIVE_GROUPS.map((group) => {
          const groupAccounts = (accounts || []).filter(a => group.subTypes.includes(a.account_type));
          if (groupAccounts.length === 0) return null;
          const isDebitNormal = group.subTypes.some(st => DEBIT_NORMAL_TYPES.has(st));
          return (
            <AdminAccountGroup key={group.label} label={group.label} accounts={groupAccounts} isDebitNormal={isDebitNormal} onApprove={approve} onReject={reject} onDelete={remove} />
          );
        })}

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
    </TooltipProvider>
  );
}

function AdminAccountGroup({ label, accounts, isDebitNormal, onApprove, onReject, onDelete }: {
  label: string; accounts: TAccountData[]; isDebitNormal: boolean;
  onApprove: (id: string) => void; onReject: (id: string) => void; onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <AccountGroupHeader label={label} count={accounts.length} isDebitNormal={isDebitNormal} onClick={() => setOpen(!open)} isOpen={open} mode="admin" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 pl-2 space-y-2">
        {accounts.map(acc => (
          <div key={acc.id} className="relative">
            <TAccountCard account={acc} mode="admin" />
            <div className="absolute top-2 right-2 flex items-center gap-1">
              <button onClick={() => onApprove(acc.id)} className="p-1 rounded hover:bg-emerald-500/20 text-emerald-500 transition-colors"><Check className="h-3.5 w-3.5" /></button>
              <button onClick={() => onReject(acc.id)} className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors"><X className="h-3.5 w-3.5" /></button>
              <button onClick={() => onDelete(acc.id)} className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
