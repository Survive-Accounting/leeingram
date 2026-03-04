/**
 * EntryByDateCard — Single date entry card showing a JE table,
 * balance status, validation errors, and "Mark Entry Correct" button.
 * Supports both read-only and editor modes, with manual override for admin.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2, Circle, XCircle, Lock, Sparkles,
  Loader2, Pencil, AlertTriangle, Copy, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatAmount, canonicalRowsToTSV, type CanonicalJERow } from "@/lib/journalEntryParser";

export interface EntryRow {
  account_name: string;
  debit: number | null;
  credit: number | null;
  coa_id?: string | null;
  display_name?: string;
  unknown_account?: boolean;
  memo?: string;
}

export type DateEntryStatus = "empty" | "drafted" | "edited" | "validated";

interface EntryByDateCardProps {
  date: string;
  rows: EntryRow[];
  status: DateEntryStatus;
  unlocked: boolean;
  isGenerating: boolean;
  balance: { balanced: boolean; diff: number } | null;
  validationErrors: { status: string; message: string }[];
  onGenerateRows: () => void;
  onMarkCorrect: (override?: boolean) => void;
  onEditRows?: () => void;
  /** Render prop for the inline editor */
  editorSlot?: React.ReactNode;
  isEditing?: boolean;
}

function formatDate(d: string): string {
  try {
    // Strip parenthetical labels like "(Dividends)" or "(Fair Value)"
    const cleaned = d.replace(/\s*\(.*?\)\s*$/, "").trim();
    const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const dt = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    return cleaned;
  } catch { return d; }
}

export function EntryByDateCard({
  date,
  rows,
  status,
  unlocked,
  isGenerating,
  balance,
  validationErrors,
  onGenerateRows,
  onMarkCorrect,
  onEditRows,
  editorSlot,
  isEditing,
}: EntryByDateCardProps) {
  const [manualOverride, setManualOverride] = useState(true);
  const hasRows = rows.length >= 2;
  const hasAnyRows = rows.length > 0;
  const dateFails = validationErrors.some(r => r.status === "fail");

  // Core enablement: needs >= 2 rows AND (balanced + no fails, OR manual override)
  const passesAutomatic = hasRows && balance?.balanced === true && !dateFails;
  const canMarkCorrect = passesAutomatic || (hasRows && manualOverride);

  const StatusIcon = status === "validated"
    ? CheckCircle2
    : status === "empty" ? Circle
    : dateFails ? XCircle : Circle;
  const statusColor = status === "validated"
    ? "text-green-400"
    : status === "empty" ? "text-muted-foreground"
    : dateFails ? "text-destructive" : "text-amber-400";

  const handleCopy = () => {
    const canonical: CanonicalJERow[] = rows.map(r => ({
      account_name: r.account_name,
      debit: r.debit,
      credit: r.credit,
    }));
    navigator.clipboard.writeText(canonicalRowsToTSV(canonical));
    toast.success("Copied for Google Sheets");
  };

  const handleMarkCorrect = () => {
    onMarkCorrect(manualOverride);
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header row */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-2",
        !unlocked && "opacity-50"
      )}>
        {!unlocked ? (
          <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", statusColor)} />
        )}

        <span className="text-xs font-semibold text-foreground flex-1">
          {formatDate(date)}
        </span>

        {/* Status badges */}
        {status === "validated" && (
          <Badge variant="outline" className="text-[9px] h-4 text-green-400 border-green-500/30">Validated</Badge>
        )}
        {status === "edited" && (
          <Badge variant="outline" className="text-[9px] h-4 text-amber-400 border-amber-500/30">Edited</Badge>
        )}
        {status === "drafted" && (
          <Badge variant="outline" className="text-[9px] h-4 text-muted-foreground border-border">Drafted</Badge>
        )}
        {hasAnyRows && rows.length < 2 && (
          <Badge variant="outline" className="text-[9px] h-4 text-amber-400 border-amber-500/30">
            Need ≥2 rows
          </Badge>
        )}
        {hasRows && !balance?.balanced && (
          <Badge variant="outline" className="text-[9px] h-4 text-destructive border-destructive/30">
            Off ${balance!.diff.toFixed(2)}
          </Badge>
        )}
        {hasRows && balance?.balanced && status !== "validated" && (
          <Badge variant="outline" className="text-[9px] h-4 text-green-400 border-green-500/30">Balanced</Badge>
        )}

        {/* Action buttons */}
        {unlocked && (
          <div className="flex gap-1">
            {!hasAnyRows && (
              <Button
                variant="outline" size="sm" className="h-6 text-[10px]"
                onClick={onGenerateRows}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <><Sparkles className="h-3 w-3 mr-0.5" /> Generate Rows</>
                )}
              </Button>
            )}
            {hasAnyRows && onEditRows && (
              <Button
                variant="ghost" size="sm" className="h-6 text-[10px]"
                onClick={onEditRows}
              >
                <Pencil className="h-3 w-3 mr-0.5" /> {isEditing ? "Close" : "Edit"}
              </Button>
            )}
            {hasAnyRows && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={handleCopy}>
                <Copy className="h-3 w-3 mr-0.5" /> Copy
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Read-only JE table (shown when rows exist and NOT editing) */}
      {hasAnyRows && !isEditing && unlocked && (
        <div className="border-t border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-3 py-1.5 text-[10px] uppercase tracking-wider text-foreground/60 font-semibold">
                  Account
                </th>
                <th className="text-right px-3 py-1.5 text-[10px] uppercase tracking-wider text-foreground/60 font-semibold w-24">
                  Debit
                </th>
                <th className="text-right px-3 py-1.5 text-[10px] uppercase tracking-wider text-foreground/60 font-semibold w-24">
                  Credit
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                const isCredit = row.credit != null && row.credit !== 0;
                return (
                  <tr key={ri} className="border-b border-border/50 last:border-0">
                    <td className={cn("px-3 py-1.5 text-foreground", isCredit && "pl-10")}>
                      {row.display_name || row.account_name}
                      {row.unknown_account && (
                        <Badge variant="outline" className="ml-2 text-[9px] px-1 py-0 text-amber-400 border-amber-400/40">
                          Unknown
                        </Badge>
                      )}
                    </td>
                    <td className="text-right px-3 py-1.5 text-foreground font-mono">
                      {!isCredit && row.debit != null ? formatAmount(row.debit) : ""}
                    </td>
                    <td className="text-right px-3 py-1.5 text-foreground font-mono">
                      {isCredit ? formatAmount(row.credit) : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Editor slot (shown when editing) */}
      {isEditing && hasAnyRows && unlocked && (
        <div className="border-t border-border px-3 py-3 space-y-3">
          {editorSlot}

          {/* Per-date validation errors */}
          {validationErrors.filter(r => r.status !== "pass").length > 0 && (
            <div className="space-y-1">
              {validationErrors.filter(r => r.status !== "pass").map((r, ri) => (
                <div key={ri} className={cn(
                  "rounded border px-2.5 py-1.5 text-xs flex items-start gap-1.5",
                  r.status === "fail"
                    ? "border-destructive/30 bg-destructive/5 text-destructive"
                    : "border-amber-500/30 bg-amber-500/5 text-amber-400"
                )}>
                  {r.status === "fail" ? <XCircle className="h-3 w-3 mt-0.5 shrink-0" /> : <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />}
                  <span>{r.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Balance + override + mark correct */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-muted-foreground">
                {balance?.balanced ? (
                  <span className="text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Balanced
                  </span>
                ) : (
                  <span className="text-destructive flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> Off by ${balance?.diff.toFixed(2)}
                  </span>
                )}
              </div>
              {status !== "validated" ? (
                <Button
                  size="sm" className="h-7 text-xs"
                  disabled={!canMarkCorrect}
                  onClick={handleMarkCorrect}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Entry Correct
                </Button>
              ) : (
                <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/30 bg-green-500/10">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Validated
                </Badge>
              )}
            </div>

            {/* Manual override toggle — shown when automatic pass fails */}
            {!passesAutomatic && hasRows && status !== "validated" && (
              <div className="flex items-center gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <Label htmlFor="manual-override" className="text-[10px] text-amber-400 flex-1 cursor-pointer">
                  Allow manual pass (admin override)
                </Label>
                <Switch
                  id="manual-override"
                  checked={manualOverride}
                  onCheckedChange={setManualOverride}
                  className="h-4 w-7"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsed: show mark correct button inline for non-editing read-only view */}
      {hasAnyRows && !isEditing && unlocked && status !== "validated" && (
        <div className="border-t border-border px-3 py-2 flex items-center justify-between">
          {/* Manual override in collapsed view too */}
          {!passesAutomatic && hasRows && (
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-amber-400" />
              <Label htmlFor="manual-override-collapsed" className="text-[9px] text-amber-400 cursor-pointer">
                Override
              </Label>
              <Switch
                id="manual-override-collapsed"
                checked={manualOverride}
                onCheckedChange={setManualOverride}
                className="h-3.5 w-6"
              />
            </div>
          )}
          <div className="flex-1" />
          <Button
            size="sm" className="h-6 text-[10px]"
            disabled={!canMarkCorrect}
            onClick={handleMarkCorrect}
          >
            <CheckCircle2 className="h-3 w-3 mr-0.5" /> Mark Entry Correct
          </Button>
        </div>
      )}
    </div>
  );
}