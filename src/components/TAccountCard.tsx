/**
 * TAccountCard — Renders a visual T-account with tooltips,
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
  const [showExample, setShowExample] = useState(false);
  const [showFs, setShowFs] = useState(false);

  const isDebit = account.normal_balance === "Debit";
  const isCredit = account.normal_balance === "Credit";
  const contra = isContraAccount(account.account_name, account.account_type);

  const hasExample = account.example_beginning_balance != null || account.example_debit_amount != null;
  const hasFs = contra && !!account.fs_placement_tooltip;

  const signLabel = isDebit ? "(+/−)" : "(−/+)";

  if (mode === "admin") {
    return (
      <AdminTAccount account={account} isDebit={isDebit} contra={contra}
        showExample={showExample} setShowExample={setShowExample}
        showFs={showFs} setShowFs={setShowFs}
        hasExample={hasExample} hasFs={!!hasFs} signLabel={signLabel} />
    );
  }

  return (
    <StudentTAccount account={account} isDebit={isDebit} contra={contra}
      showExample={showExample} setShowExample={setShowExample}
      showFs={showFs} setShowFs={setShowFs}
      hasExample={hasExample} hasFs={!!hasFs} signLabel={signLabel}
      theme={t || {}} />
  );
}

// ── Admin version ──
function AdminTAccount({ account, isDebit, contra, showExample, setShowExample, showFs, setShowFs, hasExample, hasFs, signLabel }: {
  account: TAccountData; isDebit: boolean; contra: boolean;
  showExample: boolean; setShowExample: (v: boolean) => void;
  showFs: boolean; setShowFs: (v: boolean) => void;
  hasExample: boolean; hasFs: boolean; signLabel: string;
}) {
  const lineColor = "hsl(var(--foreground))";
  const lineWeight = 2;

  return (
    <div className="max-w-[380px]">
      {/* Header */}
      <div className="text-center pb-1" style={{ borderBottom: `${lineWeight}px solid ${lineColor}` }}>
        <span className="text-sm font-bold text-foreground">{account.account_name}</span>
        <span className="text-xs text-muted-foreground ml-1.5">{signLabel}</span>
        {contra && (
          <span className="inline-flex items-center gap-0.5 ml-1.5 align-middle">
            <span className="text-[10px] px-1 py-0 rounded bg-purple-100 text-purple-700 border border-purple-300 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30 font-medium">Contra</span>
            {account.contra_tooltip && <SmallTooltip text={account.contra_tooltip} />}
          </span>
        )}
      </div>

      {/* T-account body — staggered layout */}
      <div className="grid grid-cols-2">
        {/* Row 1: debit side */}
        <div className="flex items-center gap-1 py-1 pl-2" style={{ borderRight: `${lineWeight}px solid ${lineColor}` }}>
          {account.debit_tooltip && <SmallTooltip text={account.debit_tooltip} />}
          <span className="text-xs font-mono text-muted-foreground">???</span>
        </div>
        <div className="py-1" />

        {/* Row 2: credit side */}
        <div className="py-1" style={{ borderRight: `${lineWeight}px solid ${lineColor}` }} />
        <div className="flex items-center gap-1 py-1 justify-end pr-2">
          <span className="text-xs font-mono text-muted-foreground">???</span>
          {account.credit_tooltip && <SmallTooltip text={account.credit_tooltip} />}
        </div>

        {/* Row 3: debit side (balance placeholder row for stagger) */}
        <div className="py-0.5" style={{ borderRight: `${lineWeight}px solid ${lineColor}` }} />
        <div className="py-0.5" />
      </div>

      {/* Balance row */}
      <div className="py-1 grid grid-cols-2" style={{ borderTop: `${lineWeight}px solid ${lineColor}` }}>
        {isDebit ? (
          <>
            <div className="flex items-center gap-1 pl-2">
              <span className="text-xs font-mono text-foreground font-semibold">???</span>
              {account.balance_tooltip && <SmallTooltip text={account.balance_tooltip} />}
            </div>
            <div />
          </>
        ) : (
          <>
            <div />
            <div className="flex items-center gap-1 justify-end pr-2">
              <span className="text-xs font-mono text-foreground font-semibold">???</span>
              {account.balance_tooltip && <SmallTooltip text={account.balance_tooltip} />}
            </div>
          </>
        )}
      </div>

      {/* Toggles */}
      {(hasExample || hasFs) && (
        <div className="mt-1.5">
          {hasExample && (
            <button onClick={() => setShowExample(!showExample)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              {showExample ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Show example with numbers
            </button>
          )}
          {showExample && hasExample && <ExampleSection account={account} isDebit={isDebit} mode="admin" />}
          {hasFs && (
            <button onClick={() => setShowFs(!showFs)} className="flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors mt-0.5">
              {showFs ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              See financial statement placement
            </button>
          )}
          {showFs && hasFs && <FsPlacementSection account={account} mode="admin" />}
        </div>
      )}
    </div>
  );
}

// ── Student version ──
function StudentTAccount({ account, isDebit, contra, showExample, setShowExample, showFs, setShowFs, hasExample, hasFs, signLabel, theme: t }: {
  account: TAccountData; isDebit: boolean; contra: boolean;
  showExample: boolean; setShowExample: (v: boolean) => void;
  showFs: boolean; setShowFs: (v: boolean) => void;
  hasExample: boolean; hasFs: boolean; signLabel: string;
  theme: Record<string, string>;
}) {
  const text = t.text || "#0F172A";
  const textMuted = t.textMuted || "#64748B";
  const heading = t.heading || "#14213D";
  const lineColor = heading;
  const lw = 2;

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

      {/* T-body — staggered */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        {/* Row 1: debit */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 0 4px 8px", borderRight: `${lw}px solid ${lineColor}` }}>
          {account.debit_tooltip && <SmallTooltip text={account.debit_tooltip} style={{ color: textMuted }} />}
          <span style={{ fontSize: 12, fontFamily: "monospace", color: textMuted }}>???</span>
        </div>
        <div style={{ padding: "4px 0" }} />

        {/* Row 2: credit */}
        <div style={{ padding: "4px 0", borderRight: `${lw}px solid ${lineColor}` }} />
        <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", padding: "4px 8px 4px 0" }}>
          <span style={{ fontSize: 12, fontFamily: "monospace", color: textMuted }}>???</span>
          {account.credit_tooltip && <SmallTooltip text={account.credit_tooltip} style={{ color: textMuted }} />}
        </div>

        {/* Row 3: spacer */}
        <div style={{ padding: "2px 0", borderRight: `${lw}px solid ${lineColor}` }} />
        <div style={{ padding: "2px 0" }} />
      </div>

      {/* Balance */}
      <div style={{ borderTop: `${lw}px solid ${lineColor}`, padding: "4px 0", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        {isDebit ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 4, paddingLeft: 8 }}>
              <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: text }}>???</span>
              {account.balance_tooltip && <SmallTooltip text={account.balance_tooltip} style={{ color: textMuted }} />}
            </div>
            <div />
          </>
        ) : (
          <>
            <div />
            <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", paddingRight: 8 }}>
              <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: text }}>???</span>
              {account.balance_tooltip && <SmallTooltip text={account.balance_tooltip} style={{ color: textMuted }} />}
            </div>
          </>
        )}
      </div>

      {/* Toggles */}
      {(hasExample || hasFs) && (
        <div style={{ marginTop: 6 }}>
          {hasExample && (
            <button onClick={() => setShowExample(!showExample)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: textMuted, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              {showExample ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Show example with numbers
            </button>
          )}
          {showExample && hasExample && <ExampleSection account={account} isDebit={isDebit} mode="student" theme={t} />}
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

// ── Example with numbers section ──
function ExampleSection({ account, isDebit, mode, theme: t }: { account: TAccountData; isDebit: boolean; mode: StyleMode; theme?: Record<string, string> }) {
  const beg = account.example_beginning_balance;
  const dr = account.example_debit_amount;
  const cr = account.example_credit_amount;
  const end = account.example_ending_balance;
  const dateLabel = account.example_date_label || "";

  // Parse start/end dates from label like "Jan 1 – Dec 31, 2024"
  const dateParts = dateLabel.match(/^(.+?)\s*[–—-]\s*(.+)$/);
  const startDate = dateParts ? dateParts[1].trim() : "";
  const endDate = dateParts ? dateParts[2].trim() : "";

  const calcStr = isDebit
    ? `${fmt(beg)} + ${fmt(dr)} − ${fmt(cr)} = ${fmt(end)}`
    : `${fmt(beg)} − ${fmt(dr)} + ${fmt(cr)} = ${fmt(end)}`;
  const balTooltip = (account.balance_tooltip || "") + `\n${calcStr}`;

  if (mode === "admin") {
    return (
      <div className="max-w-[400px] mt-2">
        {/* Header */}
        <div className="text-center border-b-2 border-foreground pb-1">
          <span className="text-sm font-bold text-foreground">{account.account_name}</span>
          <span className="text-xs text-muted-foreground ml-1.5">{isDebit ? "(+/−)" : "(−/+)"}</span>
        </div>

        {/* T-body rows */}
        <div className="grid grid-cols-[auto_1fr_1fr] min-h-[20px]">
          {/* Beginning balance row */}
          {beg != null && (
            <>
              <div className="text-[10px] text-muted-foreground font-mono pr-2 py-0.5 flex items-center">{startDate}</div>
              {isDebit ? (
                <>
                  <div className="text-xs font-mono text-foreground py-0.5 border-r border-foreground/30 pl-1">{fmt(beg)}</div>
                  <div className="py-0.5" />
                </>
              ) : (
                <>
                  <div className="py-0.5 border-r border-foreground/30" />
                  <div className="text-xs font-mono text-foreground py-0.5 text-right pr-1">{fmt(beg)}</div>
                </>
              )}
            </>
          )}
          {/* Debit transaction */}
          {dr != null && (
            <>
              <div className="py-0.5" />
              <div className="text-xs font-mono text-foreground py-0.5 border-r border-foreground/30 pl-3">{fmt(dr)}</div>
              <div className="py-0.5" />
            </>
          )}
          {/* Credit transaction */}
          {cr != null && (
            <>
              <div className="py-0.5" />
              <div className="py-0.5 border-r border-foreground/30" />
              <div className="text-xs font-mono text-foreground py-0.5 text-right pr-1">{fmt(cr)}</div>
            </>
          )}
        </div>

        {/* Ending balance */}
        <div className="border-t border-foreground/30 py-0.5 grid grid-cols-[auto_1fr_1fr]">
          <div className="text-[10px] text-muted-foreground font-mono pr-2 flex items-center">{endDate}</div>
          {isDebit ? (
            <>
              <div className="flex items-center gap-1 pl-1">
                <span className="text-xs font-mono font-semibold text-foreground">{fmt(end)}</span>
                <SmallTooltip text={balTooltip} />
              </div>
              <div />
            </>
          ) : (
            <>
              <div className="border-r border-foreground/30" />
              <div className="flex items-center gap-1 justify-end pr-1">
                <SmallTooltip text={balTooltip} />
                <span className="text-xs font-mono font-semibold text-foreground">{fmt(end)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Student mode
  const text = t?.text || "#0F172A";
  const textMuted = t?.textMuted || "#64748B";
  const heading = t?.heading || "#14213D";
  const divider = t?.border || "#334155";

  return (
    <div style={{ maxWidth: 400, marginTop: 8 }}>
      <div style={{ textAlign: "center", borderBottom: `2px solid ${heading}`, paddingBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: heading }}>{account.account_name}</span>
        <span style={{ fontSize: 12, color: textMuted, marginLeft: 6 }}>{isDebit ? "(+/−)" : "(−/+)"}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr" }}>
        {beg != null && (
          <>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: textMuted, paddingRight: 8, padding: "2px 8px 2px 0", display: "flex", alignItems: "center" }}>{startDate}</div>
            {isDebit ? (
              <>
                <div style={{ fontSize: 12, fontFamily: "monospace", color: text, padding: "2px 0 2px 4px", borderRight: `1px solid ${divider}40` }}>{fmt(beg)}</div>
                <div style={{ padding: "2px 0" }} />
              </>
            ) : (
              <>
                <div style={{ padding: "2px 0", borderRight: `1px solid ${divider}40` }} />
                <div style={{ fontSize: 12, fontFamily: "monospace", color: text, padding: "2px 4px 2px 0", textAlign: "right" }}>{fmt(beg)}</div>
              </>
            )}
          </>
        )}
        {dr != null && (
          <>
            <div style={{ padding: "2px 0" }} />
            <div style={{ fontSize: 12, fontFamily: "monospace", color: text, padding: "2px 0 2px 12px", borderRight: `1px solid ${divider}40` }}>{fmt(dr)}</div>
            <div style={{ padding: "2px 0" }} />
          </>
        )}
        {cr != null && (
          <>
            <div style={{ padding: "2px 0" }} />
            <div style={{ padding: "2px 0", borderRight: `1px solid ${divider}40` }} />
            <div style={{ fontSize: 12, fontFamily: "monospace", color: text, padding: "2px 4px 2px 0", textAlign: "right" }}>{fmt(cr)}</div>
          </>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${divider}40`, padding: "2px 0", display: "grid", gridTemplateColumns: "auto 1fr 1fr" }}>
        <div style={{ fontSize: 10, fontFamily: "monospace", color: textMuted, paddingRight: 8, display: "flex", alignItems: "center" }}>{endDate}</div>
        {isDebit ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 4, paddingLeft: 4 }}>
              <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: text }}>{fmt(end)}</span>
              <SmallTooltip text={balTooltip} style={{ color: textMuted }} />
            </div>
            <div />
          </>
        ) : (
          <>
            <div style={{ borderRight: `1px solid ${divider}40` }} />
            <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", paddingRight: 4 }}>
              <SmallTooltip text={balTooltip} style={{ color: textMuted }} />
              <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: text }}>{fmt(end)}</span>
            </div>
          </>
        )}
      </div>
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
  const text = t?.text || "#0F172A";

  return (
    <div style={{ marginTop: 8, maxWidth: 400 }}>
      <pre style={{ fontSize: 10, fontFamily: "monospace", color: text, lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>{generateFsExcerpt(account)}</pre>
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
    return `Property, Plant & Equipment        ${fmt(parentVal)}\n  Less: ${name}   (${fmt(contraVal)})\n  ─────────────────────────────────────\n  Book Value (Net)                 ${fmt(net)}`;
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
