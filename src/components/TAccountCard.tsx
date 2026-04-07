/**
 * TAccountCard — Renders a visual T-account for an account with tooltips,
 * example toggle, and financial statement placement for contra accounts.
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
  Assets: "You use asset accounts to track everything your business owns or is owed.",
  Liabilities: "You use liability accounts to track everything your business owes to others.",
  Equity: "You use equity accounts to track the owner's stake in the business.",
  Revenue: "You use revenue accounts to track everything your business earns.",
  Expenses: "You use expense accounts to track everything your business spends to operate.",
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
  /** For student-facing: inline style theme object */
  theme?: Record<string, string>;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "$0";
  return "$" + Math.abs(n).toLocaleString("en-US");
}

function SmallTooltip({ text, side = "top", style }: { text: string; side?: "top" | "bottom" | "left" | "right"; style?: React.CSSProperties }) {
  if (!text) return null;
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex items-center justify-center opacity-50 hover:opacity-90 transition-opacity" style={style} onClick={(e) => e.stopPropagation()}>
          <Info className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[260px] text-xs leading-relaxed z-[100] text-left">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function TAccountCard({ account, mode, theme: t }: TAccountCardProps) {
  const [showExample, setShowExample] = useState(false);
  const [showFs, setShowFs] = useState(false);

  const isDebit = account.normal_balance === "Debit";
  const isCredit = account.normal_balance === "Credit";
  const contra = isContraAccount(account.account_name, account.account_type);

  const hasExample = account.example_beginning_balance != null || account.example_debit_amount != null;
  const hasFs = contra && !!account.fs_placement_tooltip;

  if (mode === "admin") {
    return <AdminTAccountCard account={account} isDebit={isDebit} isCredit={isCredit} contra={contra} showExample={showExample} setShowExample={setShowExample} showFs={showFs} setShowFs={setShowFs} hasExample={hasExample} hasFs={!!hasFs} />;
  }

  // Student mode — inline styles using theme
  const th = t || {};
  return <StudentTAccountCard account={account} isDebit={isDebit} isCredit={isCredit} contra={contra} showExample={showExample} setShowExample={setShowExample} showFs={showFs} setShowFs={setShowFs} hasExample={hasExample} hasFs={!!hasFs} theme={th} />;
}

// ── Admin version (tailwind classes) ──
function AdminTAccountCard({ account, isDebit, isCredit, contra, showExample, setShowExample, showFs, setShowFs, hasExample, hasFs }: {
  account: TAccountData; isDebit: boolean; isCredit: boolean; contra: boolean;
  showExample: boolean; setShowExample: (v: boolean) => void;
  showFs: boolean; setShowFs: (v: boolean) => void;
  hasExample: boolean; hasFs: boolean;
}) {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
        <span className="text-xs font-semibold text-foreground">{account.account_name}</span>
        <span className="text-[10px] font-mono text-muted-foreground">{isDebit ? "Dr+" : isCredit ? "Cr+" : "Both"}</span>
        {contra && (
          <span className="flex items-center gap-0.5">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-300 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30 font-medium">Contra</span>
            {account.contra_tooltip && <SmallTooltip text={account.contra_tooltip} />}
          </span>
        )}
      </div>

      {/* T-account body */}
      <div className="grid grid-cols-2 border-b border-border text-center">
        <div className="text-[10px] font-semibold text-muted-foreground py-1 border-r border-border">Debit</div>
        <div className="text-[10px] font-semibold text-muted-foreground py-1">Credit</div>
      </div>
      <div className="grid grid-cols-2 border-b border-border min-h-[32px]">
        <div className="flex items-center justify-center gap-1 py-1.5 border-r border-border">
          {account.debit_tooltip && <SmallTooltip text={account.debit_tooltip} />}
          <span className="text-xs font-mono text-muted-foreground">???</span>
        </div>
        <div className="flex items-center justify-center gap-1 py-1.5">
          <span className="text-xs font-mono text-muted-foreground">???</span>
          {account.credit_tooltip && <SmallTooltip text={account.credit_tooltip} />}
        </div>
      </div>

      {/* Balance row */}
      <div className={`flex items-center gap-1 px-3 py-1.5 bg-muted/20 ${isDebit ? "justify-start" : "justify-end"}`}>
        <span className="text-[10px] font-semibold text-foreground">Bal: ???</span>
        {account.balance_tooltip && <SmallTooltip text={account.balance_tooltip} />}
      </div>

      {/* Toggles */}
      <div className="border-t border-border">
        {hasExample && (
          <button onClick={() => setShowExample(!showExample)} className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            {showExample ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Show example with numbers
          </button>
        )}
        {showExample && hasExample && <ExampleSection account={account} isDebit={isDebit} mode="admin" />}
        {hasFs && (
          <button onClick={() => setShowFs(!showFs)} className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors border-t border-border">
            {showFs ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            See financial statement placement
          </button>
        )}
        {showFs && hasFs && <FsPlacementSection account={account} mode="admin" />}
      </div>
    </div>
  );
}

// ── Student version (inline styles) ──
function StudentTAccountCard({ account, isDebit, isCredit, contra, showExample, setShowExample, showFs, setShowFs, hasExample, hasFs, theme: t }: {
  account: TAccountData; isDebit: boolean; isCredit: boolean; contra: boolean;
  showExample: boolean; setShowExample: (v: boolean) => void;
  showFs: boolean; setShowFs: (v: boolean) => void;
  hasExample: boolean; hasFs: boolean;
  theme: Record<string, string>;
}) {
  const border = t.border || "#E2E8F0";
  const mutedBg = t.mutedBg || "#F8FAFC";
  const text = t.text || "#0F172A";
  const textMuted = t.textMuted || "#64748B";
  const heading = t.heading || "#14213D";

  return (
    <div style={{ borderRadius: 8, border: `1px solid ${border}`, overflow: "hidden", background: t.cardBg || "#FFF" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: mutedBg, borderBottom: `1px solid ${border}` }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: heading }}>{account.account_name}</span>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: textMuted }}>{isDebit ? "Dr+" : isCredit ? "Cr+" : "Both"}</span>
        {contra && (
          <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#F3E8FF", color: "#7C3AED", border: "1px solid #C4B5FD", fontWeight: 500 }}>Contra</span>
            {account.contra_tooltip && <SmallTooltip text={account.contra_tooltip} style={{ color: textMuted }} />}
          </span>
        )}
      </div>

      {/* T-account */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: `1px solid ${border}`, textAlign: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: textMuted, padding: "4px 0", borderRight: `1px solid ${border}` }}>Debit</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: textMuted, padding: "4px 0" }}>Credit</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: `1px solid ${border}`, minHeight: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px 0", borderRight: `1px solid ${border}` }}>
          {account.debit_tooltip && <SmallTooltip text={account.debit_tooltip} style={{ color: textMuted }} />}
          <span style={{ fontSize: 12, fontFamily: "monospace", color: textMuted }}>???</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px 0" }}>
          <span style={{ fontSize: 12, fontFamily: "monospace", color: textMuted }}>???</span>
          {account.credit_tooltip && <SmallTooltip text={account.credit_tooltip} style={{ color: textMuted }} />}
        </div>
      </div>

      {/* Balance */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", background: mutedBg, justifyContent: isDebit ? "flex-start" : "flex-end" }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: text }}>Bal: ???</span>
        {account.balance_tooltip && <SmallTooltip text={account.balance_tooltip} style={{ color: textMuted }} />}
      </div>

      {/* Toggles */}
      <div style={{ borderTop: `1px solid ${border}` }}>
        {hasExample && (
          <button onClick={() => setShowExample(!showExample)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px 0", fontSize: 10, color: textMuted, background: "none", border: "none", cursor: "pointer" }}>
            {showExample ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Show example with numbers
          </button>
        )}
        {showExample && hasExample && <ExampleSection account={account} isDebit={isDebit} mode="student" theme={t} />}
        {hasFs && (
          <button onClick={() => setShowFs(!showFs)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px 0", fontSize: 10, color: "#7C3AED", background: "none", border: "none", cursor: "pointer", borderTop: `1px solid ${border}` }}>
            {showFs ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            See financial statement placement
          </button>
        )}
        {showFs && hasFs && <FsPlacementSection account={account} mode="student" theme={t} />}
      </div>
    </div>
  );
}

// ── Example with numbers section ──
function ExampleSection({ account, isDebit, mode, theme: t }: { account: TAccountData; isDebit: boolean; mode: StyleMode; theme?: Record<string, string> }) {
  const beg = account.example_beginning_balance;
  const dr = account.example_debit_amount;
  const cr = account.example_credit_amount;
  const end = account.example_ending_balance;
  const dateLabel = account.example_date_label || "";

  const calcStr = isDebit
    ? `${fmt(beg)} + ${fmt(dr)} − ${fmt(cr)} = ${fmt(end)}`
    : `${fmt(beg)} − ${fmt(dr)} + ${fmt(cr)} = ${fmt(end)}`;
  const balTooltip = (account.balance_tooltip || "") + `\n${calcStr}`;

  if (mode === "admin") {
    return (
      <div className="border-t border-border">
        <div className="px-3 py-1.5 bg-muted/20 text-[10px] font-medium text-muted-foreground">
          {account.account_name} — {dateLabel}
        </div>
        <div className="grid grid-cols-2 border-t border-border text-center">
          <div className="text-[10px] font-semibold text-muted-foreground py-1 border-r border-border">Debit</div>
          <div className="text-[10px] font-semibold text-muted-foreground py-1">Credit</div>
        </div>
        <div className="grid grid-cols-2 border-t border-border">
          <div className="px-3 py-1 border-r border-border text-xs font-mono text-foreground space-y-0.5">
            {isDebit && beg != null && <div className="text-[10px] text-muted-foreground">Beg: {fmt(beg)}</div>}
            {dr != null && <div>{fmt(dr)}</div>}
          </div>
          <div className="px-3 py-1 text-xs font-mono text-foreground text-right space-y-0.5">
            {!isDebit && beg != null && <div className="text-[10px] text-muted-foreground">Beg: {fmt(beg)}</div>}
            {cr != null && <div>{fmt(cr)}</div>}
          </div>
        </div>
        <div className={`flex items-center gap-1 px-3 py-1.5 border-t border-border bg-muted/30 ${isDebit ? "justify-start" : "justify-end"}`}>
          <span className="text-[10px] font-semibold text-foreground">Ending Balance: {fmt(end)}</span>
          <SmallTooltip text={balTooltip} />
        </div>
      </div>
    );
  }

  // Student mode
  const border = t?.border || "#E2E8F0";
  const textMuted = t?.textMuted || "#64748B";
  const text = t?.text || "#0F172A";
  const mutedBg = t?.mutedBg || "#F8FAFC";

  return (
    <div style={{ borderTop: `1px solid ${border}` }}>
      <div style={{ padding: "6px 12px", background: mutedBg, fontSize: 10, fontWeight: 500, color: textMuted }}>
        {account.account_name} — {dateLabel}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: `1px solid ${border}`, textAlign: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: textMuted, padding: "4px 0", borderRight: `1px solid ${border}` }}>Debit</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: textMuted, padding: "4px 0" }}>Credit</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: `1px solid ${border}` }}>
        <div style={{ padding: "4px 12px", borderRight: `1px solid ${border}`, fontFamily: "monospace", fontSize: 12, color: text }}>
          {isDebit && beg != null && <div style={{ fontSize: 10, color: textMuted }}>Beg: {fmt(beg)}</div>}
          {dr != null && <div>{fmt(dr)}</div>}
        </div>
        <div style={{ padding: "4px 12px", fontFamily: "monospace", fontSize: 12, color: text, textAlign: "right" }}>
          {!isDebit && beg != null && <div style={{ fontSize: 10, color: textMuted }}>Beg: {fmt(beg)}</div>}
          {cr != null && <div>{fmt(cr)}</div>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderTop: `1px solid ${border}`, background: mutedBg, justifyContent: isDebit ? "flex-start" : "flex-end" }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: text }}>Ending Balance: {fmt(end)}</span>
        <SmallTooltip text={balTooltip} style={{ color: textMuted }} />
      </div>
    </div>
  );
}

// ── Financial statement placement (contra accounts only) ──
function FsPlacementSection({ account, mode, theme: t }: { account: TAccountData; mode: StyleMode; theme?: Record<string, string> }) {
  if (mode === "admin") {
    return (
      <div className="border-t border-border px-3 py-2 space-y-1.5">
        <pre className="text-[10px] font-mono text-foreground leading-relaxed whitespace-pre-wrap">{generateFsExcerpt(account)}</pre>
        <p className="text-[10px] text-muted-foreground leading-relaxed">{account.fs_placement_tooltip}</p>
      </div>
    );
  }

  const border = t?.border || "#E2E8F0";
  const textMuted = t?.textMuted || "#64748B";
  const text = t?.text || "#0F172A";

  return (
    <div style={{ borderTop: `1px solid ${border}`, padding: "8px 12px" }}>
      <pre style={{ fontSize: 10, fontFamily: "monospace", color: text, lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>{generateFsExcerpt(account)}</pre>
      <p style={{ fontSize: 10, color: textMuted, lineHeight: 1.5, marginTop: 6 }}>{account.fs_placement_tooltip}</p>
    </div>
  );
}

function generateFsExcerpt(account: TAccountData): string {
  // Generate a realistic FS excerpt based on account type
  const name = account.account_name;
  const beg = account.example_beginning_balance;
  const end = account.example_ending_balance;

  if (account.account_type === "Contra Asset") {
    // e.g. Accumulated Depreciation
    const parentVal = 50000;
    const contraVal = end != null ? Math.abs(end) : 12000;
    const net = parentVal - contraVal;
    return `Property, Plant & Equipment        ${fmt(parentVal)}\n  Less: ${name}   (${fmt(contraVal).replace("$", "$")})\n  ─────────────────────────────────────\n  Book Value (Net)                 ${fmt(net)}`;
  }
  if (account.account_type === "Contra Revenue") {
    const parentVal = 100000;
    const contraVal = end != null ? Math.abs(end) : 5000;
    const net = parentVal - contraVal;
    return `Sales Revenue                      ${fmt(parentVal)}\n  Less: ${name}   (${fmt(contraVal)})\n  ─────────────────────────────────────\n  Net Sales                        ${fmt(net)}`;
  }
  if (account.account_type === "Contra Liability") {
    const parentVal = 200000;
    const contraVal = end != null ? Math.abs(end) : 8000;
    const net = parentVal - contraVal;
    return `Bonds Payable                      ${fmt(parentVal)}\n  Less: ${name}   (${fmt(contraVal)})\n  ─────────────────────────────────────\n  Carrying Value                   ${fmt(net)}`;
  }
  return `${name} — see financial statements for placement`;
}

// ── Exported group header with tooltip ──
export function AccountGroupHeader({ label, count, isDebitNormal, onClick, isOpen, mode, theme: t }: {
  label: string; count: number; isDebitNormal: boolean;
  onClick: () => void; isOpen: boolean;
  mode: StyleMode; theme?: Record<string, string>;
}) {
  const signLabel = isDebitNormal ? "(+/−)" : "(−/+)";
  const tooltip = CATEGORY_TOOLTIPS[label];

  if (mode === "admin") {
    return (
      <button onClick={onClick} className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors text-left">
        {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <span className="text-xs font-bold text-foreground uppercase tracking-wider">{label}</span>
        <span className="text-[10px] text-muted-foreground font-mono">{signLabel}</span>
        {tooltip && <SmallTooltip text={tooltip} />}
        <span className="ml-auto text-[9px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">{count}</span>
      </button>
    );
  }

  const th = t || {};
  return (
    <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
      <span style={{ fontSize: 10, color: th.textMuted || "#64748B" }}>{isOpen ? "▼" : "▶"}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: th.heading || "#14213D", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: 10, fontFamily: "monospace", color: th.textMuted || "#64748B" }}>{signLabel}</span>
      {tooltip && <SmallTooltip text={tooltip} style={{ color: th.textMuted || "#64748B" }} />}
      <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, borderRadius: 999, padding: "1px 8px", background: th.mutedBg || "#F8FAFC", color: th.textMuted || "#64748B" }}>({count})</span>
    </button>
  );
}

// ── Exported grouping logic ──
export { FIVE_GROUPS, DEBIT_NORMAL_TYPES, CATEGORY_TOOLTIPS };
