/**
 * TAccountCard — Renders a visual T-account with tooltips,
 * example toggle, and financial statement placement for contra accounts.
 *
 * Layout (4 rows for debit-normal):
 *   Row 1 (Dr side): Beginning balance
 *   Row 2 (Dr side): Debit amount (increase)
 *   Row 3 (Cr side): Credit amount (decrease)
 *   Balance row:     Ending balance
 *
 * Used in AccountsTab (admin), ChapterCramTool, and SolutionsViewer.
 */
import { useState } from "react";
import { Info, ChevronDown, ChevronRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isContraAccount } from "@/lib/contraDetection";

// ── Hardcoded category tooltips ──
const CATEGORY_TOOLTIPS: Record<string, string> = {
  Assets: "Everything your business owns that\nwill benefit you in the future.\n\nAll assets work like this:  (Dr +  |  Cr −)\nNormal Balance: Debit\n\n→ Shows up on the Balance Sheet",
  Liabilities: "Everything your business owes\nto someone else.\n\nAll liabilities work like this:  (Dr −  |  Cr +)\nNormal Balance: Credit\n\n→ Shows up on the Balance Sheet",
  Equity: "The owner's stake in the business —\nwhat's left after subtracting liabilities from assets.\n\nAll equity accounts work like this:  (Dr −  |  Cr +)\nNormal Balance: Credit\n\n→ Shows up on the Balance Sheet",
  Revenue: "Everything your business earns\nby doing what it's in business to do.\n\nAll revenue accounts work like this:  (Dr −  |  Cr +)\nNormal Balance: Credit\n\n→ Shows up on the Income Statement",
  Expenses: "Everything your business spends\nto keep operating and earn revenue.\n\nAll expense accounts work like this:  (Dr +  |  Cr −)\nNormal Balance: Debit\n\n→ Shows up on the Income Statement",
};

// ── 5-group mapping ──
const FIVE_GROUPS = [
  { label: "Assets", subTypes: ["Current Asset", "Long-Term Asset", "Contra Asset"] },
  { label: "Liabilities", subTypes: ["Current Liability", "Long-Term Liability", "Contra Liability"] },
  { label: "Equity", subTypes: ["Equity"] },
  { label: "Revenue", subTypes: ["Revenue", "Contra Revenue"] },
  { label: "Expenses", subTypes: ["Expense"] },
];

const DEBIT_NORMAL_TYPES = new Set(["Current Asset", "Long-Term Asset", "Expense", "Contra Revenue", "Contra Liability"]);

export interface TAccountData {
  id: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  account_description?: string;
  debit_tooltip?: string | null;
  credit_tooltip?: string | null;
  balance_tooltip?: string | null;
  contra_tooltip?: string | null;
  fs_placement_tooltip?: string | null;
  example_beginning_balance?: number | null;
  example_debit_amount?: number | null;
  example_credit_amount?: number | null;
  example_ending_balance?: number | null;
  example_date_label?: string | null;
}

type StyleMode = "admin" | "student";

interface TAccountCardProps {
  account: TAccountData;
  mode: StyleMode;
  theme?: Record<string, string>;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "0";
  return Math.abs(n).toLocaleString("en-US");
}

/** Format with dollar sign — only for FS excerpts */
function fmtDollar(n: number | null | undefined): string {
  if (n == null) return "$0";
  return "$" + Math.abs(n).toLocaleString("en-US");
}

function SmallTooltip({ text, side = "top", style }: { text: string; side?: "top" | "bottom" | "left" | "right"; style?: React.CSSProperties }) {
  if (!text) return null;
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex items-center justify-center opacity-40 hover:opacity-80 transition-opacity" style={style} onClick={(e) => e.stopPropagation()}>
          <Info className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[260px] text-xs leading-relaxed z-[100] text-left">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function CategoryTooltip({ text, style }: { text: string; style?: React.CSSProperties }) {
  if (!text) return null;
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex items-center justify-center opacity-40 hover:opacity-80 transition-opacity" style={style} onClick={(e) => e.stopPropagation()}>
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[300px] text-xs leading-relaxed z-[100] text-left whitespace-pre-line">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function TAccountCard({ account, mode, theme: t }: TAccountCardProps) {
  const [showNumbers, setShowNumbers] = useState(false);
  const [showFs, setShowFs] = useState(false);

  const isDebit = account.normal_balance === "Debit";
  const contra = isContraAccount(account.account_name, account.account_type);

  const hasExample = account.example_beginning_balance != null || account.example_debit_amount != null;
  const hasFs = contra && !!account.fs_placement_tooltip;

  const signLabel = isDebit ? "(+/−)" : "(−/+)";

  if (mode === "admin") {
    return (
      <AdminTAccount account={account} isDebit={isDebit} contra={contra}
        showNumbers={showNumbers} setShowNumbers={setShowNumbers}
        showFs={showFs} setShowFs={setShowFs}
        hasExample={hasExample} hasFs={!!hasFs} signLabel={signLabel} />
    );
  }

  return (
    <StudentTAccount account={account} isDebit={isDebit} contra={contra}
      showNumbers={showNumbers} setShowNumbers={setShowNumbers}
      showFs={showFs} setShowFs={setShowFs}
      hasExample={hasExample} hasFs={!!hasFs} signLabel={signLabel}
      theme={t || {}} />
  );
}

/**
 * T-account body — 4 data rows + balance row.
 *
 * Debit-normal layout:
 *   Row 1: Beg Dr  |            (beginning balance on normal side)
 *   Row 2: +Dr     |            (debit increase)
 *   Row 3:         |  Cr        (credit decrease)
 *   ─────────────────────────
 *   Row 4: End     |            (ending balance on normal side)
 *
 * Credit-normal layout mirrors (normal side = right).
 */

// ── Admin version ──
function AdminTAccount({ account, isDebit, contra, showNumbers, setShowNumbers, showFs, setShowFs, hasExample, hasFs, signLabel }: {
  account: TAccountData; isDebit: boolean; contra: boolean;
  showNumbers: boolean; setShowNumbers: (v: boolean) => void;
  showFs: boolean; setShowFs: (v: boolean) => void;
  hasExample: boolean; hasFs: boolean; signLabel: string;
}) {
  const lineColor = "hsl(var(--foreground))";
  const lw = 2;

  const beg = account.example_beginning_balance;
  const dr = account.example_debit_amount;
  const cr = account.example_credit_amount;
  const end = account.example_ending_balance;

  const calcStr = isDebit
    ? `${fmt(beg)} + ${fmt(dr)} − ${fmt(cr)} = ${fmt(end)}`
    : `${fmt(beg)} − ${fmt(dr)} + ${fmt(cr)} = ${fmt(end)}`;
  const balCalcTooltip = (account.balance_tooltip || "") + `\n${calcStr}`;

  const nums = showNumbers && hasExample;

  return (
    <div className="max-w-[380px]">
      {/* Header */}
      <div className="text-center pb-1" style={{ borderBottom: `${lw}px solid ${lineColor}` }}>
        <span className="text-sm font-bold text-foreground">{account.account_name}</span>
        <span className="text-xs text-muted-foreground ml-1.5">{signLabel}</span>
        {contra && (
          <span className="inline-flex items-center gap-0.5 ml-1.5 align-middle">
            <span className="text-[10px] px-1 py-0 rounded bg-purple-100 text-purple-700 border border-purple-300 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30 font-medium">Contra</span>
            {account.contra_tooltip && <SmallTooltip text={account.contra_tooltip} />}
          </span>
        )}
      </div>

      {/* T-account body — 4 rows */}
      <div className="grid grid-cols-2">
        {isDebit ? (
          <>
            {/* Debit-normal: Row1=Beg(Dr), Row2=+Dr, Row3=Cr */}
            <div className="flex items-center justify-center gap-1 py-1.5" style={{ borderRight: `${lw}px solid ${lineColor}` }}>
              {nums ? (
                <><SmallTooltip text={account.balance_tooltip || ""} /><span className="text-xs font-mono text-foreground">{fmt(beg)}</span><span className="text-[10px] text-muted-foreground">Beg</span></>
              ) : (
                <><SmallTooltip text={account.balance_tooltip || ""} /><span className="text-xs font-mono text-muted-foreground">???</span><span className="text-[10px] text-muted-foreground">Beg</span></>
              )}
            </div>
            <div className="py-1.5" />

            {/* Row 2: Debit increase */}
            <div className="flex items-center justify-center gap-1 py-1.5" style={{ borderRight: `${lw}px solid ${lineColor}` }}>
              {nums ? (
                <><SmallTooltip text={account.debit_tooltip || ""} /><span className="text-xs font-mono text-foreground">{fmt(dr)}</span><span className="text-[10px] text-muted-foreground">Dr</span></>
              ) : (
                <><SmallTooltip text={account.debit_tooltip || ""} /><span className="text-xs font-mono text-muted-foreground">???</span><span className="text-[10px] text-muted-foreground">Dr</span></>
              )}
            </div>
            <div className="py-1.5" />

            {/* Row 3: Credit decrease */}
            <div className="py-1.5" style={{ borderRight: `${lw}px solid ${lineColor}` }} />
            <div className="flex items-center justify-center gap-1 py-1.5">
              {nums ? (
                <><span className="text-xs font-mono text-foreground">{fmt(cr)}</span><SmallTooltip text={account.credit_tooltip || ""} /><span className="text-[10px] text-muted-foreground">Cr</span></>
              ) : (
                <><span className="text-xs font-mono text-muted-foreground">???</span><SmallTooltip text={account.credit_tooltip || ""} /><span className="text-[10px] text-muted-foreground">Cr</span></>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Credit-normal: Row1=Beg(Cr), Row2=Dr, Row3=+Cr */}
            <div className="py-1.5" style={{ borderRight: `${lw}px solid ${lineColor}` }} />
            <div className="flex items-center justify-center gap-1 py-1.5">
              {nums ? (
                <><span className="text-xs font-mono text-foreground">{fmt(beg)}</span><SmallTooltip text={account.balance_tooltip || ""} /><span className="text-[10px] text-muted-foreground">Beg</span></>
              ) : (
                <><span className="text-xs font-mono text-muted-foreground">???</span><SmallTooltip text={account.balance_tooltip || ""} /><span className="text-[10px] text-muted-foreground">Beg</span></>
              )}
            </div>

            {/* Row 2: Debit decrease */}
            <div className="flex items-center justify-center gap-1 py-1.5" style={{ borderRight: `${lw}px solid ${lineColor}` }}>
              {nums ? (
                <><SmallTooltip text={account.debit_tooltip || ""} /><span className="text-xs font-mono text-foreground">{fmt(dr)}</span><span className="text-[10px] text-muted-foreground">Dr</span></>
              ) : (
                <><SmallTooltip text={account.debit_tooltip || ""} /><span className="text-xs font-mono text-muted-foreground">???</span><span className="text-[10px] text-muted-foreground">Dr</span></>
              )}
            </div>
            <div className="py-1.5" style={{}} />

            {/* Row 3: Credit increase */}
            <div className="py-1.5" style={{ borderRight: `${lw}px solid ${lineColor}` }} />
            <div className="flex items-center justify-center gap-1 py-1.5">
              {nums ? (
                <><span className="text-xs font-mono text-foreground">{fmt(cr)}</span><SmallTooltip text={account.credit_tooltip || ""} /><span className="text-[10px] text-muted-foreground">Cr</span></>
              ) : (
                <><span className="text-xs font-mono text-muted-foreground">???</span><SmallTooltip text={account.credit_tooltip || ""} /><span className="text-[10px] text-muted-foreground">Cr</span></>
              )}
            </div>
          </>
        )}
      </div>

      {/* Balance row */}
      <div className="py-1.5 grid grid-cols-2" style={{ borderTop: `${lw}px solid ${lineColor}` }}>
        {isDebit ? (
          <>
            <div className="flex items-center justify-center gap-1" style={{ borderRight: `${lw}px solid ${lineColor}` }}>
              {nums ? (
                <><SmallTooltip text={balCalcTooltip} /><span className="text-xs font-mono text-foreground font-semibold">{fmt(end)}</span><span className="text-[10px] text-muted-foreground">End</span></>
              ) : (
                <><SmallTooltip text={account.balance_tooltip || ""} /><span className="text-xs font-mono text-foreground font-semibold">???</span><span className="text-[10px] text-muted-foreground">End</span></>
              )}
            </div>
            <div />
          </>
        ) : (
          <>
            <div style={{ borderRight: `${lw}px solid ${lineColor}` }} />
            <div className="flex items-center justify-center gap-1">
              {nums ? (
                <><SmallTooltip text={balCalcTooltip} /><span className="text-xs font-mono text-foreground font-semibold">{fmt(end)}</span><span className="text-[10px] text-muted-foreground">End</span></>
              ) : (
                <><SmallTooltip text={account.balance_tooltip || ""} /><span className="text-xs font-mono text-foreground font-semibold">???</span><span className="text-[10px] text-muted-foreground">End</span></>
              )}
            </div>
          </>
        )}
      </div>

      {/* Toggles */}
      <div className="mt-1.5">
        {hasExample && (
          <button onClick={() => setShowNumbers(!showNumbers)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="h-3 w-3" />
            {showNumbers ? "Show ??? version →" : "Show numbers →"}
          </button>
        )}
        {hasFs && (
          <button onClick={() => setShowFs(!showFs)} className="flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors mt-0.5">
            {showFs ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            See financial statement placement
          </button>
        )}
        {showFs && hasFs && <FsPlacementSection account={account} mode="admin" />}
      </div>
    </div>
  );
}

// ── Student version ──
function StudentTAccount({ account, isDebit, contra, showNumbers, setShowNumbers, showFs, setShowFs, hasExample, hasFs, signLabel, theme: t }: {
  account: TAccountData; isDebit: boolean; contra: boolean;
  showNumbers: boolean; setShowNumbers: (v: boolean) => void;
  showFs: boolean; setShowFs: (v: boolean) => void;
  hasExample: boolean; hasFs: boolean; signLabel: string;
  theme: Record<string, string>;
}) {
  const text = t.text || "#0F172A";
  const textMuted = t.textMuted || "#64748B";
  const heading = t.heading || "#14213D";
  const lineColor = heading;
  const lw = 2;

  const beg = account.example_beginning_balance;
  const dr = account.example_debit_amount;
  const cr = account.example_credit_amount;
  const end = account.example_ending_balance;

  const calcStr = isDebit
    ? `${fmt(beg)} + ${fmt(dr)} − ${fmt(cr)} = ${fmt(end)}`
    : `${fmt(beg)} − ${fmt(dr)} + ${fmt(cr)} = ${fmt(end)}`;
  const balCalcTooltip = (account.balance_tooltip || "") + `\n${calcStr}`;

  const nums = showNumbers && hasExample;

  const cellCenter: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: 4 };
  const labelStyle: React.CSSProperties = { fontSize: 10, color: textMuted };

  return (
    <div style={{ maxWidth: 380 }}>
      {/* Header */}
      <div style={{ textAlign: "center", borderBottom: `${lw}px solid ${lineColor}`, paddingBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: heading }}>{account.account_name}</span>
        <span style={{ fontSize: 12, color: textMuted, marginLeft: 6 }}>{signLabel}</span>
        {contra && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 2, marginLeft: 6, verticalAlign: "middle" }}>
            <span style={{ fontSize: 10, padding: "0 4px", borderRadius: 3, background: "#F3E8FF", color: "#7C3AED", border: "1px solid #C4B5FD", fontWeight: 500 }}>Contra</span>
            {account.contra_tooltip && <SmallTooltip text={account.contra_tooltip} style={{ color: textMuted }} />}
          </span>
        )}
      </div>

      {/* T-body — 4 rows */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        {isDebit ? (
          <>
            {/* Debit-normal: Row1=Beg, Row2=+Dr, Row3=Cr */}
            <div style={{ ...cellCenter, padding: "6px 0", borderRight: `${lw}px solid ${lineColor}` }}>
              {nums ? (
                <><SmallTooltip text={account.balance_tooltip || ""} style={{ color: textMuted }} /><span style={{ fontSize: 12, fontFamily: "monospace", color: text }}>{fmt(beg)}</span><span style={labelStyle}>Beg</span></>
              ) : (
                <><SmallTooltip text={account.balance_tooltip || ""} style={{ color: textMuted }} /><span style={{ fontSize: 12, fontFamily: "monospace", color: textMuted }}>???</span><span style={labelStyle}>Beg</span></>
              )}
            </div>
            <div style={{ padding: "6px 0" }} />

            {/* Row 2: Debit increase */}
            <div style={{ ...cellCenter, padding: "6px 0", borderRight: `${lw}px solid ${lineColor}` }}>
              {nums ? (
                <><SmallTooltip text={account.debit_tooltip || ""} style={{ color: textMuted }} /><span style={{ fontSize: 12, fontFamily: "monospace", color: text }}>{fmt(dr)}</span><span style={labelStyle}>Dr</span></>
              ) : (
                <><SmallTooltip text={account.debit_tooltip || ""} style={{ color: textMuted }} /><span style={{ fontSize: 12, fontFamily: "monospace", color: textMuted }}>???</span><span style={labelStyle}>Dr</span></>
              )}
            </div>
            <div style={{ padding: "6px 0" }} />

            {/* Row 3: Credit decrease */}
            <div style={{ padding: "6px 0", borderRight: `${lw}px solid ${lineColor}` }} />
            <div style={{ ...cellCenter, padding: "6px 0" }}>
              {nums ? (
                <><span style={{ fontSize: 12, fontFamily: "monospace", color: text }}>{fmt(cr)}</span><SmallTooltip text={account.credit_tooltip || ""} style={{ color: textMuted }} /><span style={labelStyle}>Cr</span></>
              ) : (
                <><span style={{ fontSize: 12, fontFamily: "monospace", color: textMuted }}>???</span><SmallTooltip text={account.credit_tooltip || ""} style={{ color: textMuted }} /><span style={labelStyle}>Cr</span></>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Credit-normal: Row1=Beg(Cr), Row2=Dr, Row3=+Cr */}
            <div style={{ padding: "6px 0", borderRight: `${lw}px solid ${lineColor}` }} />
            <div style={{ ...cellCenter, padding: "6px 0" }}>
              {nums ? (
                <><span style={{ fontSize: 12, fontFamily: "monospace", color: text }}>{fmt(beg)}</span><SmallTooltip text={account.balance_tooltip || ""} style={{ color: textMuted }} /><span style={labelStyle}>Beg</span></>
              ) : (
                <><span style={{ fontSize: 12, fontFamily: "monospace", color: textMuted }}>???</span><SmallTooltip text={account.balance_tooltip || ""} style={{ color: textMuted }} /><span style={labelStyle}>Beg</span></>
              )}
            </div>

            {/* Row 2: Debit decrease */}
            <div style={{ ...cellCenter, padding: "6px 0", borderRight: `${lw}px solid ${lineColor}` }}>
              {nums ? (
                <><SmallTooltip text={account.debit_tooltip || ""} style={{ color: textMuted }} /><span style={{ fontSize: 12, fontFamily: "monospace", color: text }}>{fmt(dr)}</span><span style={labelStyle}>Dr</span></>
              ) : (
                <><SmallTooltip text={account.debit_tooltip || ""} style={{ color: textMuted }} /><span style={{ fontSize: 12, fontFamily: "monospace", color: textMuted }}>???</span><span style={labelStyle}>Dr</span></>
              )}
            </div>
            <div style={{ padding: "6px 0" }} />

            {/* Row 3: Credit increase */}
            <div style={{ padding: "6px 0", borderRight: `${lw}px solid ${lineColor}` }} />
            <div style={{ ...cellCenter, padding: "6px 0" }}>
              {nums ? (
                <><span style={{ fontSize: 12, fontFamily: "monospace", color: text }}>{fmt(cr)}</span><SmallTooltip text={account.credit_tooltip || ""} style={{ color: textMuted }} /><span style={labelStyle}>Cr</span></>
              ) : (
                <><span style={{ fontSize: 12, fontFamily: "monospace", color: textMuted }}>???</span><SmallTooltip text={account.credit_tooltip || ""} style={{ color: textMuted }} /><span style={labelStyle}>Cr</span></>
              )}
            </div>
          </>
        )}
      </div>

      {/* Balance row */}
      <div style={{ borderTop: `${lw}px solid ${lineColor}`, padding: "6px 0", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        {isDebit ? (
          <>
            <div style={{ ...cellCenter, borderRight: `${lw}px solid ${lineColor}` }}>
              {nums ? (
                <><SmallTooltip text={balCalcTooltip} style={{ color: textMuted }} /><span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: text }}>{fmt(end)}</span><span style={labelStyle}>End</span></>
              ) : (
                <><SmallTooltip text={account.balance_tooltip || ""} style={{ color: textMuted }} /><span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: text }}>???</span><span style={labelStyle}>End</span></>
              )}
            </div>
            <div />
          </>
        ) : (
          <>
            <div style={{ borderRight: `${lw}px solid ${lineColor}` }} />
            <div style={cellCenter}>
              {nums ? (
                <><SmallTooltip text={balCalcTooltip} style={{ color: textMuted }} /><span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: text }}>{fmt(end)}</span><span style={labelStyle}>End</span></>
              ) : (
                <><SmallTooltip text={account.balance_tooltip || ""} style={{ color: textMuted }} /><span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: text }}>???</span><span style={labelStyle}>End</span></>
              )}
            </div>
          </>
        )}
      </div>

      {/* Toggles */}
      {(hasExample || hasFs) && (
        <div style={{ marginTop: 6 }}>
          {hasExample && (
            <button onClick={() => setShowNumbers(!showNumbers)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: textMuted, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <ChevronRight className="h-3 w-3" />
              {showNumbers ? "Show ??? version →" : "Show numbers →"}
            </button>
          )}
          {hasFs && (
            <button onClick={() => setShowFs(!showFs)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#7C3AED", background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 2 }}>
              {showFs ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              See financial statement placement
            </button>
          )}
          {showFs && hasFs && <FsPlacementSection account={account} mode="student" theme={t} />}
        </div>
      )}
    </div>
  );
}

// ── Financial statement placement (contra accounts only) ──
function FsPlacementSection({ account, mode, theme: t }: { account: TAccountData; mode: StyleMode; theme?: Record<string, string> }) {
  if (mode === "admin") {
    return (
      <div className="mt-2 space-y-1.5 max-w-[400px]">
        <pre className="text-[10px] font-mono text-foreground leading-relaxed whitespace-pre-wrap">{generateFsExcerpt(account)}</pre>
        <p className="text-[10px] text-muted-foreground leading-relaxed">{account.fs_placement_tooltip}</p>
      </div>
    );
  }

  const textMuted = t?.textMuted || "#64748B";
  const textColor = t?.text || "#0F172A";

  return (
    <div style={{ marginTop: 8, maxWidth: 400 }}>
      <pre style={{ fontSize: 10, fontFamily: "monospace", color: textColor, lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>{generateFsExcerpt(account)}</pre>
      <p style={{ fontSize: 10, color: textMuted, lineHeight: 1.5, marginTop: 6 }}>{account.fs_placement_tooltip}</p>
    </div>
  );
}

function generateFsExcerpt(account: TAccountData): string {
  const name = account.account_name;
  const end = account.example_ending_balance;

  if (account.account_type === "Contra Asset") {
    const parentVal = 50000;
    const contraVal = end != null ? Math.abs(end) : 12000;
    const net = parentVal - contraVal;
    return `Property, Plant & Equipment        ${fmtDollar(parentVal)}\n  Less: ${name}   (${fmtDollar(contraVal)})\n  ─────────────────────────────────────\n  Book Value (Net)                 ${fmtDollar(net)}`;
  }
  if (account.account_type === "Contra Revenue") {
    const parentVal = 100000;
    const contraVal = end != null ? Math.abs(end) : 5000;
    const net = parentVal - contraVal;
    return `Sales Revenue                      ${fmtDollar(parentVal)}\n  Less: ${name}   (${fmtDollar(contraVal)})\n  ─────────────────────────────────────\n  Net Sales                        ${fmtDollar(net)}`;
  }
  if (account.account_type === "Contra Liability") {
    const parentVal = 200000;
    const contraVal = end != null ? Math.abs(end) : 8000;
    const net = parentVal - contraVal;
    return `Bonds Payable                      ${fmtDollar(parentVal)}\n  Less: ${name}   (${fmtDollar(contraVal)})\n  ─────────────────────────────────────\n  Carrying Value                   ${fmtDollar(net)}`;
  }
  return `${name} — see financial statements for placement`;
}

// ── Exported group header with tooltip ──
export function AccountGroupHeader({ label, count, isDebitNormal, onClick, isOpen, mode, theme: t }: {
  label: string; count: number; isDebitNormal: boolean;
  onClick: () => void; isOpen: boolean;
  mode: StyleMode; theme?: Record<string, string>;
}) {
  const tooltip = CATEGORY_TOOLTIPS[label];

  if (mode === "admin") {
    return (
      <button onClick={onClick} className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors text-left">
        {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <span className="text-xs font-bold text-foreground uppercase tracking-wider">{label}</span>
        {tooltip && <CategoryTooltip text={tooltip} />}
        <span className="ml-auto text-[9px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">{count}</span>
      </button>
    );
  }

  const th = t || {};
  return (
    <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
      <span style={{ fontSize: 10, color: th.textMuted || "#64748B" }}>{isOpen ? "▼" : "▶"}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: th.heading || "#14213D", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{label}</span>
      {tooltip && <CategoryTooltip text={tooltip} style={{ color: th.textMuted || "#64748B" }} />}
      <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, borderRadius: 999, padding: "1px 8px", background: th.mutedBg || "#F8FAFC", color: th.textMuted || "#64748B" }}>({count})</span>
    </button>
  );
}

// ── Exported grouping logic ──
export { FIVE_GROUPS, DEBIT_NORMAL_TYPES, CATEGORY_TOOLTIPS };
