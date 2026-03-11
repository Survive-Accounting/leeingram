import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// ── Types ────────────────────────────────────────────────────────────

type TAccount = { account_name: string; debits: string[]; credits: string[] };
type TableItem = { title: string; tsv: string };
type StatementItem = { title: string; tsv: string };

interface LearningStructuresEditorProps {
  assetId: string;
  usesT: boolean;
  usesTables: boolean;
  usesFS: boolean;
  tAccountsJson: TAccount[] | null;
  tablesJson: TableItem[] | null;
  financialStatementsJson: StatementItem[] | null;
  onUpdated?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────

function safeParse<T>(val: any, fallback: T[]): T[] {
  if (!val) return fallback;
  if (Array.isArray(val)) return val as T[];
  try { return JSON.parse(val); } catch { return fallback; }
}

// ── Component ────────────────────────────────────────────────────────

export default function LearningStructuresEditor({
  assetId, usesT, usesTables, usesFS,
  tAccountsJson, tablesJson, financialStatementsJson,
  onUpdated,
}: LearningStructuresEditorProps) {
  const [showT, setShowT] = useState(usesT);
  const [showTables, setShowTables] = useState(usesTables);
  const [showFS, setShowFS] = useState(usesFS);

  const [tAccounts, setTAccounts] = useState<TAccount[]>(safeParse(tAccountsJson, []));
  const [tables, setTables] = useState<TableItem[]>(safeParse(tablesJson, []));
  const [statements, setStatements] = useState<StatementItem[]>(safeParse(financialStatementsJson, []));

  const [saving, setSaving] = useState(false);

  // Sync from props on asset change
  useEffect(() => {
    setShowT(usesT);
    setShowTables(usesTables);
    setShowFS(usesFS);
    setTAccounts(safeParse(tAccountsJson, []));
    setTables(safeParse(tablesJson, []));
    setStatements(safeParse(financialStatementsJson, []));
  }, [assetId]);

  // ── T Account handlers ─────────────────────────────────────────────
  const addTAccount = () => setTAccounts([...tAccounts, { account_name: "", debits: [""], credits: [""] }]);
  const removeTAccount = (i: number) => setTAccounts(tAccounts.filter((_, idx) => idx !== i));
  const updateTAccount = (i: number, field: keyof TAccount, value: any) =>
    setTAccounts(tAccounts.map((t, idx) => idx === i ? { ...t, [field]: value } : t));

  const addDebit = (i: number) => updateTAccount(i, "debits", [...tAccounts[i].debits, ""]);
  const addCredit = (i: number) => updateTAccount(i, "credits", [...tAccounts[i].credits, ""]);
  const updateDebit = (ti: number, di: number, val: string) => {
    const newDebits = [...tAccounts[ti].debits];
    newDebits[di] = val;
    updateTAccount(ti, "debits", newDebits);
  };
  const updateCredit = (ti: number, ci: number, val: string) => {
    const newCredits = [...tAccounts[ti].credits];
    newCredits[ci] = val;
    updateTAccount(ti, "credits", newCredits);
  };
  const removeDebit = (ti: number, di: number) =>
    updateTAccount(ti, "debits", tAccounts[ti].debits.filter((_, i) => i !== di));
  const removeCredit = (ti: number, ci: number) =>
    updateTAccount(ti, "credits", tAccounts[ti].credits.filter((_, i) => i !== ci));

  // ── Table handlers ─────────────────────────────────────────────────
  const addTable = () => setTables([...tables, { title: "", tsv: "" }]);
  const removeTable = (i: number) => setTables(tables.filter((_, idx) => idx !== i));
  const updateTable = (i: number, field: keyof TableItem, value: string) =>
    setTables(tables.map((t, idx) => idx === i ? { ...t, [field]: value } : t));

  // ── Statement handlers ─────────────────────────────────────────────
  const addStatement = () => setStatements([...statements, { title: "", tsv: "" }]);
  const removeStatement = (i: number) => setStatements(statements.filter((_, idx) => idx !== i));
  const updateStatement = (i: number, field: keyof StatementItem, value: string) =>
    setStatements(statements.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  // ── Save ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        uses_t_accounts: showT,
        uses_tables: showTables,
        uses_financial_statements: showFS,
        t_accounts_json: showT && tAccounts.length > 0 ? tAccounts : null,
        tables_json: showTables && tables.length > 0 ? tables : null,
        financial_statements_json: showFS && statements.length > 0 ? statements : null,
      };
      const { error } = await supabase
        .from("teaching_assets")
        .update(updates as any)
        .eq("id", assetId);
      if (error) throw error;
      toast.success("Learning structures saved");
      onUpdated?.();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        Optional Learning Structures
      </p>

      {/* Toggles */}
      <div className="space-y-2">
        <ToggleRow label="Uses T Accounts" checked={showT} onChange={setShowT} />
        <ToggleRow label="Uses Tables" checked={showTables} onChange={setShowTables} />
        <ToggleRow label="Uses Financial Statements" checked={showFS} onChange={setShowFS} />
      </div>

      {/* T Accounts Editor */}
      {showT && (
        <div className="space-y-3 pl-2 border-l-2 border-primary/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">T Accounts</p>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={addTAccount}>
              <Plus className="h-3 w-3 mr-1" /> Add T Account
            </Button>
          </div>
          {tAccounts.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No T accounts yet.</p>
          )}
          {tAccounts.map((ta, ti) => (
            <div key={ti} className="rounded-md border border-border bg-background p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={ta.account_name}
                  onChange={(e) => updateTAccount(ti, "account_name", e.target.value)}
                  placeholder="Account Name"
                  className="text-sm flex-1"
                />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeTAccount(ti)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* Debits */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1">Debits</p>
                  {ta.debits.map((d, di) => (
                    <div key={di} className="flex items-center gap-1 mb-1">
                      <Input value={d} onChange={(e) => updateDebit(ti, di, e.target.value)} placeholder="Amount" className="text-xs h-7" />
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeDebit(ti, di)}>
                        <Trash2 className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" className="h-5 text-[9px] px-1" onClick={() => addDebit(ti)}>
                    <Plus className="h-2.5 w-2.5 mr-0.5" /> Debit
                  </Button>
                </div>
                {/* Credits */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1">Credits</p>
                  {ta.credits.map((c, ci) => (
                    <div key={ci} className="flex items-center gap-1 mb-1">
                      <Input value={c} onChange={(e) => updateCredit(ti, ci, e.target.value)} placeholder="Amount" className="text-xs h-7" />
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeCredit(ti, ci)}>
                        <Trash2 className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" className="h-5 text-[9px] px-1" onClick={() => addCredit(ti)}>
                    <Plus className="h-2.5 w-2.5 mr-0.5" /> Credit
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tables Editor */}
      {showTables && (
        <div className="space-y-3 pl-2 border-l-2 border-primary/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Tables</p>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={addTable}>
              <Plus className="h-3 w-3 mr-1" /> Add Table
            </Button>
          </div>
          {tables.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No tables yet.</p>
          )}
          {tables.map((t, i) => (
            <div key={i} className="rounded-md border border-border bg-background p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={t.title}
                  onChange={(e) => updateTable(i, "title", e.target.value)}
                  placeholder="Table Title"
                  className="text-sm flex-1"
                />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeTable(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Textarea
                value={t.tsv}
                onChange={(e) => updateTable(i, "tsv", e.target.value)}
                placeholder="Paste TSV content here (tab-separated values)..."
                className="text-xs min-h-[80px] font-mono"
              />
            </div>
          ))}
        </div>
      )}

      {/* Financial Statements Editor */}
      {showFS && (
        <div className="space-y-3 pl-2 border-l-2 border-primary/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Financial Statements</p>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={addStatement}>
              <Plus className="h-3 w-3 mr-1" /> Add Statement
            </Button>
          </div>
          {statements.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No financial statements yet.</p>
          )}
          {statements.map((s, i) => (
            <div key={i} className="rounded-md border border-border bg-background p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={s.title}
                  onChange={(e) => updateStatement(i, "title", e.target.value)}
                  placeholder="Statement Title (e.g. Income Statement)"
                  className="text-sm flex-1"
                />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeStatement(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Textarea
                value={s.tsv}
                onChange={(e) => updateStatement(i, "tsv", e.target.value)}
                placeholder="Paste TSV content here (tab-separated values)..."
                className="text-xs min-h-[80px] font-mono"
              />
            </div>
          ))}
        </div>
      )}

      {/* Save */}
      <Button size="sm" onClick={handleSave} disabled={saving} className="text-xs">
        {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
        Save Learning Structures
      </Button>
    </div>
  );
}

// ── Toggle Row ───────────────────────────────────────────────────────

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="h-4 w-8 [&>span]:h-3 [&>span]:w-3"
      />
      <span className="text-xs text-foreground">{label}</span>
    </div>
  );
}

// ── TSV export helpers (used by the display component) ────────────────

export function tAccountToTSV(ta: { account_name: string; debits: string[]; credits: string[] }): string {
  const maxRows = Math.max(ta.debits.length, ta.credits.length, 1);
  const lines = [`${ta.account_name}`, `Debit\tCredit`];
  for (let i = 0; i < maxRows; i++) {
    lines.push(`${ta.debits[i] || ""}\t${ta.credits[i] || ""}`);
  }
  return lines.join("\n");
}
