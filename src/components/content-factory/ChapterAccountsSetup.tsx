import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus, Wand2, Trash2, CheckCircle2, Loader2, AlertTriangle,
  Download, Upload, Search, Pencil, X, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ACCOUNT_TYPES, type AccountType,
  deriveDefaults, generateCsvTemplate, parseCsvImport,
} from "@/lib/accountTypeDefaults";

interface Props {
  chapterId: string;
  solutionTexts?: string[];
}

// Common accounts for auto-suggest fallback
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

function extractAccountsFromText(texts: string[]): string[] {
  const combined = texts.join("\n");
  const found = new Set<string>();
  for (const acc of COMMON_ACCOUNTS) {
    if (combined.toLowerCase().includes(acc.toLowerCase())) found.add(acc);
  }
  const patterns = [
    /(?:Dr|Debit)[.:]\s*(.+?)(?:\s+\$[\d,]+|\s*$)/gim,
    /(?:Cr|Credit)[.:]\s*(.+?)(?:\s+\$[\d,]+|\s*$)/gim,
    /^([A-Z][a-z]+(?:\s+[A-Za-z]+){0,4})\s+\$?[\d,]+/gm,
  ];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(combined)) !== null) {
      let name = m[1]?.trim().replace(/\$[\d,]+\.?\d*/g, "").replace(/\s+/g, " ").trim();
      if (name && name.length >= 3 && name.length <= 60 && !/^\d+$/.test(name)) {
        name = name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
        found.add(name);
      }
    }
  }
  return Array.from(found).sort();
}

interface AccountRow {
  id: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  debit_effect: string;
  credit_effect: string;
  is_approved: boolean;
  source: string;
}

export function ChapterAccountsSetup({ chapterId, solutionTexts = [] }: Props) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AccountRow>>({});
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ account_name: "", account_type: "Asset" as AccountType });
  const [csvPreview, setCsvPreview] = useState<ReturnType<typeof parseCsvImport> | null>(null);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["chapter-accounts", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_accounts" as any)
        .select("*")
        .eq("chapter_id", chapterId)
        .order("account_name");
      if (error) throw error;
      return (data ?? []) as unknown as AccountRow[];
    },
    enabled: !!chapterId,
  });

  const approvedCount = (accounts ?? []).filter(a => a.is_approved).length;

  const filtered = useMemo(() => {
    if (!accounts) return [];
    if (!search.trim()) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(a =>
      a.account_name.toLowerCase().includes(q) ||
      a.account_type.toLowerCase().includes(q)
    );
  }, [accounts, search]);

  const upsertMutation = useMutation({
    mutationFn: async (row: Partial<AccountRow> & { id?: string }) => {
      if (row.id) {
        const { error } = await supabase.from("chapter_accounts" as any).update(row as any).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("chapter_accounts" as any).insert({ chapter_id: chapterId, ...row } as any);
        if (error) {
          if (error.code === "23505") throw new Error(`"${row.account_name}" already exists`);
          throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-accounts", chapterId] });
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chapter_accounts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapter-accounts", chapterId] }),
  });

  const toggleApproval = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase.from("chapter_accounts" as any).update({ is_approved: approved } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapter-accounts", chapterId] }),
  });

  const handleAdd = () => {
    const defaults = deriveDefaults(addForm.account_type);
    upsertMutation.mutate({
      account_name: addForm.account_name.trim(),
      account_type: addForm.account_type,
      normal_balance: defaults.normal_balance,
      debit_effect: defaults.debit_effect,
      credit_effect: defaults.credit_effect,
      is_approved: true,
      source: "user",
    });
    setAddForm({ account_name: "", account_type: "Asset" });
    setShowAddDialog(false);
  };

  const startEdit = (acc: AccountRow) => {
    setEditingId(acc.id);
    setEditForm({ ...acc });
  };

  const saveEdit = () => {
    if (!editForm.id) return;
    upsertMutation.mutate(editForm as any);
  };

  const handleAutoSuggest = async () => {
    setSuggesting(true);
    try {
      const extracted = extractAccountsFromText(solutionTexts);
      const existing = new Set((accounts ?? []).map(a => a.account_name.toLowerCase()));
      const newAccounts = extracted.filter(a => !existing.has(a.toLowerCase()));
      if (newAccounts.length === 0) { toast.info("No new accounts found"); return; }
      for (const name of newAccounts) {
        const defaults = deriveDefaults("Asset");
        await supabase.from("chapter_accounts" as any).insert({
          chapter_id: chapterId, account_name: name, account_type: "Asset",
          normal_balance: defaults.normal_balance, debit_effect: defaults.debit_effect,
          credit_effect: defaults.credit_effect, source: "ocr_suggested", is_approved: false,
        } as any);
      }
      qc.invalidateQueries({ queryKey: ["chapter-accounts", chapterId] });
      toast.success(`Suggested ${newAccounts.length} accounts`);
    } finally { setSuggesting(false); }
  };

  const handleApproveAll = async () => {
    const unapproved = (accounts ?? []).filter(a => !a.is_approved);
    for (const acc of unapproved) {
      await supabase.from("chapter_accounts" as any).update({ is_approved: true } as any).eq("id", acc.id);
    }
    qc.invalidateQueries({ queryKey: ["chapter-accounts", chapterId] });
    toast.success(`Approved ${unapproved.length} accounts`);
  };

  const handleCsvDownloadTemplate = () => {
    const blob = new Blob([generateCsvTemplate()], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "chapter_accounts_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsvImport(text);
      if (parsed.length === 0) { toast.error("No valid rows found in CSV"); return; }
      setCsvPreview(parsed);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCsvImportConfirm = async () => {
    if (!csvPreview) return;
    const existing = new Set((accounts ?? []).map(a => a.account_name.toLowerCase()));
    let added = 0;
    for (const row of csvPreview) {
      if (existing.has(row.account_name.toLowerCase())) continue;
      await supabase.from("chapter_accounts" as any).insert({
        chapter_id: chapterId, account_name: row.account_name,
        account_type: row.account_type, normal_balance: row.normal_balance,
        debit_effect: row.debit_effect, credit_effect: row.credit_effect,
        source: "csv_import", is_approved: true,
      } as any);
      added++;
    }
    qc.invalidateQueries({ queryKey: ["chapter-accounts", chapterId] });
    toast.success(`Imported ${added} accounts (${csvPreview.length - added} duplicates skipped)`);
    setCsvPreview(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Chapter Account Whitelist</h3>
          <Badge variant="outline" className={cn(
            "text-[10px]",
            approvedCount > 0 ? "text-green-400 border-green-500/30" : "text-amber-400 border-amber-500/30"
          )}>
            {approvedCount > 0 ? <><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> {approvedCount} approved</> : <><AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> No accounts</>}
          </Badge>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleAutoSuggest} disabled={suggesting || solutionTexts.length === 0}>
            {suggesting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />} Auto-suggest
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCsvDownloadTemplate}>
            <Download className="h-3 w-3 mr-1" /> CSV Template
          </Button>
          <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleCsvFileChange} />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3 w-3 mr-1" /> Import CSV
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-3 w-3 mr-1" /> Add Account
          </Button>
          {(accounts ?? []).some(a => !a.is_approved) && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleApproveAll}>
              <CheckCircle2 className="h-3 w-3 mr-1" /> Approve All
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts..." className="h-8 pl-8 text-xs" />
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded p-6 text-center">
          <p className="text-xs text-muted-foreground italic">No accounts configured. Use "Auto-suggest", "Import CSV", or "Add Account".</p>
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-auto max-h-96">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 px-2">✓</TableHead>
                <TableHead className="text-xs">Account Name</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Normal Bal</TableHead>
                <TableHead className="text-xs">Dr Effect</TableHead>
                <TableHead className="text-xs">Cr Effect</TableHead>
                <TableHead className="text-xs w-10">Src</TableHead>
                <TableHead className="text-xs w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(acc => (
                <TableRow key={acc.id} className={cn("group", !acc.is_approved && "opacity-60")}>
                  {editingId === acc.id ? (
                    <>
                      <TableCell className="px-2">
                        <Checkbox checked={editForm.is_approved} onCheckedChange={c => setEditForm(f => ({ ...f, is_approved: !!c }))} className="h-3.5 w-3.5" />
                      </TableCell>
                      <TableCell><Input value={editForm.account_name || ""} onChange={e => setEditForm(f => ({ ...f, account_name: e.target.value }))} className="h-6 text-xs" /></TableCell>
                      <TableCell>
                        <Select value={editForm.account_type || "Asset"} onValueChange={v => {
                          const d = deriveDefaults(v as AccountType);
                          setEditForm(f => ({ ...f, account_type: v, normal_balance: d.normal_balance, debit_effect: d.debit_effect, credit_effect: d.credit_effect }));
                        }}>
                          <SelectTrigger className="h-6 text-xs w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>{ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={editForm.normal_balance || "Debit"} onValueChange={v => setEditForm(f => ({ ...f, normal_balance: v }))}>
                          <SelectTrigger className="h-6 text-xs w-20"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="Debit" className="text-xs">Debit</SelectItem><SelectItem value="Credit" className="text-xs">Credit</SelectItem></SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={editForm.debit_effect || "Increase"} onValueChange={v => setEditForm(f => ({ ...f, debit_effect: v }))}>
                          <SelectTrigger className="h-6 text-xs w-24"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="Increase" className="text-xs">Increase</SelectItem><SelectItem value="Decrease" className="text-xs">Decrease</SelectItem></SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={editForm.credit_effect || "Decrease"} onValueChange={v => setEditForm(f => ({ ...f, credit_effect: v }))}>
                          <SelectTrigger className="h-6 text-xs w-24"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="Increase" className="text-xs">Increase</SelectItem><SelectItem value="Decrease" className="text-xs">Decrease</SelectItem></SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell className="px-2">
                        <div className="flex gap-1">
                          <button onClick={saveEdit} className="p-0.5 text-green-400 hover:text-green-300"><Check className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setEditingId(null)} className="p-0.5 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="px-2">
                        <Checkbox checked={acc.is_approved} onCheckedChange={c => toggleApproval.mutate({ id: acc.id, approved: !!c })} className="h-3.5 w-3.5" />
                      </TableCell>
                      <TableCell className="text-xs font-medium">{acc.account_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{acc.account_type}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{acc.normal_balance}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{acc.debit_effect}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{acc.credit_effect}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[8px] h-3.5 px-1">
                          {acc.source === "ocr_suggested" ? "OCR" : acc.source === "csv_import" ? "CSV" : acc.source === "ai_suggested" ? "AI" : "Man"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-2">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(acc)} className="p-0.5 text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                          <button onClick={() => deleteMutation.mutate(acc.id)} className="p-0.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Gating warning */}
      {approvedCount === 0 && (accounts ?? []).length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <p className="text-xs text-amber-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Approve at least some accounts to enable whitelist enforcement during generation.
          </p>
        </div>
      )}

      {/* Add Account Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Add Account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={addForm.account_name} onChange={e => setAddForm(f => ({ ...f, account_name: e.target.value }))} placeholder="Account name..." className="h-8 text-sm" onKeyDown={e => e.key === "Enter" && addForm.account_name.trim() && handleAdd()} />
            <Select value={addForm.account_type} onValueChange={v => setAddForm(f => ({ ...f, account_type: v as AccountType }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t} className="text-sm">{t}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Normal balance, debit/credit effects auto-derived from type. You can override after adding.</p>
          </div>
          <DialogFooter>
            <Button size="sm" onClick={handleAdd} disabled={!addForm.account_name.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Preview Dialog */}
      <Dialog open={!!csvPreview} onOpenChange={() => setCsvPreview(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle className="text-sm">CSV Import Preview</DialogTitle></DialogHeader>
          <div className="max-h-64 overflow-auto border border-border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Account Name</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Normal Bal</TableHead>
                  <TableHead className="text-xs">Dr Effect</TableHead>
                  <TableHead className="text-xs">Cr Effect</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(csvPreview ?? []).map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{row.account_name}</TableCell>
                    <TableCell className="text-xs">{row.account_type}</TableCell>
                    <TableCell className="text-xs">{row.normal_balance}</TableCell>
                    <TableCell className="text-xs">{row.debit_effect}</TableCell>
                    <TableCell className="text-xs">{row.credit_effect}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">{csvPreview?.length} rows to import. Duplicates will be skipped.</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCsvPreview(null)}>Cancel</Button>
            <Button size="sm" onClick={handleCsvImportConfirm}><Upload className="h-3.5 w-3.5 mr-1" /> Import {csvPreview?.length} Accounts</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
