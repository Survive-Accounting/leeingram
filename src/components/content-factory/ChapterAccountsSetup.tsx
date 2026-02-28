import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Plus, Wand2, Trash2, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  chapterId: string;
  solutionTexts?: string[];  // OCR-extracted solution texts for auto-suggest
}

// Common accounting accounts for fallback suggestions
const COMMON_ACCOUNTS = [
  "Cash", "Accounts Receivable", "Accounts Payable", "Notes Payable", "Notes Receivable",
  "Bonds Payable", "Discount on Bonds Payable", "Premium on Bonds Payable",
  "Interest Expense", "Interest Payable", "Interest Revenue", "Interest Receivable",
  "Sales Revenue", "Cost of Goods Sold", "Inventory", "Prepaid Insurance",
  "Insurance Expense", "Depreciation Expense", "Accumulated Depreciation",
  "Retained Earnings", "Dividends", "Common Stock", "Paid-in Capital",
  "Unearned Revenue", "Service Revenue", "Rent Expense", "Salaries Expense",
  "Salaries Payable", "Equipment", "Land", "Buildings",
];

/** Extract account-like names from solution text */
function extractAccountsFromText(texts: string[]): string[] {
  const combined = texts.join("\n");
  const accountPatterns = [
    // Lines with Dr/Cr or Debit/Credit
    /(?:Dr|Debit)[.:]\s*(.+?)(?:\s+\$[\d,]+|\s*$)/gim,
    /(?:Cr|Credit)[.:]\s*(.+?)(?:\s+\$[\d,]+|\s*$)/gim,
    // Indented account names in JE format
    /^\s{2,}(.+?)\s+\$?[\d,]+/gm,
    // Account names before amounts
    /^([A-Z][a-z]+(?:\s+[A-Za-z]+){0,4})\s+\$?[\d,]+/gm,
  ];

  const found = new Set<string>();
  for (const pattern of accountPatterns) {
    let match;
    while ((match = pattern.exec(combined)) !== null) {
      let name = match[1]?.trim();
      if (!name || name.length < 3 || name.length > 60) continue;
      // Clean up
      name = name.replace(/\$[\d,]+\.?\d*/g, "").replace(/\s+/g, " ").trim();
      name = name.replace(/^(a\.|b\.|c\.|d\.|1\.|2\.|3\.)\s*/i, "");
      if (name.length >= 3 && !/^\d+$/.test(name)) {
        // Title case
        name = name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
        found.add(name);
      }
    }
  }

  // Also match known common accounts mentioned in text
  for (const acc of COMMON_ACCOUNTS) {
    if (combined.toLowerCase().includes(acc.toLowerCase())) {
      found.add(acc);
    }
  }

  return Array.from(found).sort();
}

export function ChapterAccountsSetup({ chapterId, solutionTexts = [] }: Props) {
  const qc = useQueryClient();
  const [newAccountName, setNewAccountName] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["chapter-accounts", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_accounts" as any)
        .select("*")
        .eq("chapter_id", chapterId)
        .order("account_name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!chapterId,
  });

  const approvedCount = (accounts ?? []).filter((a: any) => a.is_approved).length;
  const hasApprovedAccounts = approvedCount > 0;

  const addAccountMutation = useMutation({
    mutationFn: async ({ name, source }: { name: string; source: string }) => {
      const { error } = await supabase.from("chapter_accounts" as any).insert({
        chapter_id: chapterId,
        account_name: name.trim(),
        source,
        is_approved: source === "user",
      } as any);
      if (error) {
        if (error.code === "23505") throw new Error(`"${name}" already exists`);
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapter-accounts", chapterId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleApprovalMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase
        .from("chapter_accounts" as any)
        .update({ is_approved: approved } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapter-accounts", chapterId] }),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chapter_accounts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapter-accounts", chapterId] }),
  });

  const handleAutoSuggest = async () => {
    setSuggesting(true);
    try {
      const extracted = extractAccountsFromText(solutionTexts);
      const existing = new Set((accounts ?? []).map((a: any) => a.account_name.toLowerCase()));
      const newAccounts = extracted.filter(a => !existing.has(a.toLowerCase()));

      if (newAccounts.length === 0) {
        toast.info("No new accounts found in solution texts");
        return;
      }

      for (const name of newAccounts) {
        await supabase.from("chapter_accounts" as any).insert({
          chapter_id: chapterId,
          account_name: name,
          source: "ocr_suggested",
          is_approved: false,
        } as any).then(() => {});
      }

      qc.invalidateQueries({ queryKey: ["chapter-accounts", chapterId] });
      toast.success(`Suggested ${newAccounts.length} accounts from OCR text`);
    } finally {
      setSuggesting(false);
    }
  };

  const handleApproveAll = async () => {
    const unapproved = (accounts ?? []).filter((a: any) => !a.is_approved);
    for (const acc of unapproved) {
      await supabase.from("chapter_accounts" as any).update({ is_approved: true } as any).eq("id", acc.id);
    }
    qc.invalidateQueries({ queryKey: ["chapter-accounts", chapterId] });
    toast.success(`Approved ${unapproved.length} accounts`);
  };

  const handleAddAccount = () => {
    if (!newAccountName.trim()) return;
    addAccountMutation.mutate({ name: newAccountName, source: "user" });
    setNewAccountName("");
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          Chapter Account Whitelist
        </span>
        <Badge variant="outline" className={cn(
          "text-[9px] h-4",
          hasApprovedAccounts
            ? "text-green-400 border-green-500/30"
            : "text-amber-400 border-amber-500/30"
        )}>
          {hasApprovedAccounts ? (
            <><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> {approvedCount} approved</>
          ) : (
            <><AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> No accounts</>
          )}
        </Badge>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3 space-y-3">
        {/* Actions bar */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleAutoSuggest}
            disabled={suggesting || solutionTexts.length === 0}
          >
            {suggesting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
            Auto-suggest from OCR
          </Button>
          {(accounts ?? []).some((a: any) => !a.is_approved) && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleApproveAll}>
              <CheckCircle2 className="h-3 w-3 mr-1" /> Approve All
            </Button>
          )}
        </div>

        {/* Add new account */}
        <div className="flex gap-2">
          <Input
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddAccount()}
            placeholder="Add account name..."
            className="h-7 text-xs flex-1"
          />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleAddAccount} disabled={!newAccountName.trim()}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>

        {/* Account list */}
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (accounts ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground italic border border-dashed border-border rounded p-3 text-center">
            No accounts configured. Use "Auto-suggest" or add manually.
          </p>
        ) : (
          <div className="border border-border rounded-md divide-y divide-border max-h-64 overflow-y-auto">
            {(accounts ?? []).map((acc: any) => (
              <div key={acc.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/20 group">
                <Checkbox
                  checked={acc.is_approved}
                  onCheckedChange={(checked) =>
                    toggleApprovalMutation.mutate({ id: acc.id, approved: !!checked })
                  }
                  className="h-3.5 w-3.5"
                />
                <span className={cn("text-sm flex-1", !acc.is_approved && "text-muted-foreground")}>
                  {acc.account_name}
                </span>
                <Badge variant="outline" className="text-[8px] h-3.5 px-1">
                  {acc.source === "ocr_suggested" ? "OCR" : acc.source === "ai_suggested" ? "AI" : "Manual"}
                </Badge>
                <button
                  className="p-0.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteAccountMutation.mutate(acc.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {!hasApprovedAccounts && (accounts ?? []).length > 0 && (
          <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <p className="text-xs text-amber-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Approve at least some accounts to enable whitelist enforcement during generation.
            </p>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Hook to fetch approved accounts for a chapter */
export function useChapterApprovedAccounts(chapterId?: string) {
  return useQuery({
    queryKey: ["chapter-accounts-approved", chapterId],
    queryFn: async () => {
      if (!chapterId) return [];
      const { data, error } = await supabase
        .from("chapter_accounts" as any)
        .select("account_name")
        .eq("chapter_id", chapterId)
        .eq("is_approved", true)
        .order("account_name");
      if (error) throw error;
      return (data ?? []).map((r: any) => r.account_name as string);
    },
    enabled: !!chapterId,
  });
}
