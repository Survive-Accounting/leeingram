/**
 * SolutionsViewerStaging — staging version of SolutionsViewer with dissector highlights.
 * Protected route — requires authentication. Identical to SolutionsViewer except for:
 * 1. Staging banner
 * 2. Dissector highlight toggle + rendering on problem text
 * 3. No share tracking (staging only)
 */

import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Lock, Unlock, Copy, AlertTriangle, ChevronDown, ChevronUp, X, CheckCircle, Calendar, Share2 } from "lucide-react";
import { isCanonicalJE, type CanonicalJEPayload } from "@/lib/journalEntryParser";
import { naturalSortRef } from "@/lib/utils";
import { JETooltip } from "@/components/JETooltip";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboardFallback";
import { useEnrollUrl } from "@/hooks/useEnrollUrl";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";


const LOGO_URL = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf121ac35937c4d438ca.png";
const AORAKI_URL = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/88d6f7c98cfeb62f0e339a7648214ace.png";
const LEE_HEADSHOT_URL = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/ab9844f22ec569cdc37f3bf9da363c50.jpg";
const LEE_HERO_URL = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/f10e00cd3462ea2638b6e6161236a92b.png";

// ── Theme colors ────────────────────────────────────────────────────

const lightTheme = {
  pageBg: "#FFFFFF",
  cardBg: "#F8F9FA",
  text: "#1A1A1A",
  textMuted: "#666666",
  heading: "#131E35",
  border: "#E0E0E0",
  answerBg: "#F0FFF4",
  answerBorder: "#1B8A3E",
  formulaBg: "#FFFBEB",
  formulaBorder: "#D97706",
  trapBg: "#FFF5F5",
  trapBorder: "#C0392B",
  tableHeaderBg: "#1A2E55",
  tableAltBg: "#F8F9FA",
  toggleBg: "#F3F4F6",
  badgeColor: "#0A6B4A",
  badgeBg: "rgba(0, 200, 150, 0.12)",
  badgeBorder: "rgba(0, 200, 150, 0.3)",
  watermarkOverlay: "rgba(255,255,255,0.93)",
};

type Theme = typeof lightTheme;

// ── Dissector highlight colors ──────────────────────────────────────

const DISSECTOR_COLORS: Record<string, { bg: string; text: string }> = {
  amount: { bg: "#FEF08A", text: "#1A1A1A" },
  KEY_NUMBER: { bg: "#FEF08A", text: "#1A1A1A" },
  rate: { bg: "#FEF08A", text: "#1A1A1A" },
  WARNING: { bg: "#FCA5A5", text: "#1A1A1A" },
  critical_variable: { bg: "#FCA5A5", text: "#1A1A1A" },
  ACCOUNT: { bg: "#BAE6FD", text: "#1A1A1A" },
  account_name: { bg: "#BAE6FD", text: "#1A1A1A" },
  account: { bg: "#BAE6FD", text: "#1A1A1A" },
  CONCEPT: { bg: "#BBF7D0", text: "#1A1A1A" },
  key_concept: { bg: "#BBF7D0", text: "#1A1A1A" },
  DATE: { bg: "#E9D5FF", text: "#1A1A1A" },
  time_period: { bg: "#E9D5FF", text: "#1A1A1A" },
  date: { bg: "#E9D5FF", text: "#1A1A1A" },
  entity: { bg: "#D1D5DB", text: "#1A1A1A" },
  term: { bg: "#D1D5DB", text: "#1A1A1A" },
  method: { bg: "#D1D5DB", text: "#1A1A1A" },
  other: { bg: "#D1D5DB", text: "#1A1A1A" },
};

function getDissectorColor(category: string): { bg: string; text: string } {
  return DISSECTOR_COLORS[category] || { bg: "#D1D5DB", text: "#1A1A1A" };
}

function isWarningCategory(category: string): boolean {
  return category === "WARNING" || category === "critical_variable";
}

// ── Dissector Highlighted Text ──────────────────────────────────────

interface DissectorHighlight {
  text: string;
  label?: string;
  category?: string;
  color?: string;
}

function DissectorHighlightedText({
  problemText,
  highlights,
  theme,
}: {
  problemText: string;
  highlights: DissectorHighlight[];
  theme: Theme;
}) {
  // Build non-overlapping segments
  const matches: { start: number; end: number; hi: number }[] = [];
  for (let hi = 0; hi < highlights.length; hi++) {
    const h = highlights[hi];
    if (!h.text) continue;
    const idx = problemText.indexOf(h.text);
    if (idx !== -1) {
      matches.push({ start: idx, end: idx + h.text.length, hi });
    }
  }
  matches.sort((a, b) => a.start - b.start);
  const nonOverlapping: typeof matches = [];
  for (const m of matches) {
    if (nonOverlapping.length === 0 || m.start >= nonOverlapping[nonOverlapping.length - 1].end) {
      nonOverlapping.push(m);
    }
  }

  const segments: { text: string; highlight: DissectorHighlight | null }[] = [];
  let pos = 0;
  for (const m of nonOverlapping) {
    if (m.start > pos) segments.push({ text: problemText.slice(pos, m.start), highlight: null });
    segments.push({ text: problemText.slice(m.start, m.end), highlight: highlights[m.hi] });
    pos = m.end;
  }
  if (pos < problemText.length) segments.push({ text: problemText.slice(pos), highlight: null });

  return (
    <p className="text-[14px] leading-[1.7] whitespace-pre-wrap" style={{ color: theme.text }}>
      {segments.map((seg, i) => {
        if (!seg.highlight) return <span key={i}>{seg.text}</span>;
        const cat = seg.highlight.category || "other";
        const colors = getDissectorColor(cat);
        const isWarning = isWarningCategory(cat);
        const tooltipContent = seg.highlight.label || seg.highlight.category || "";

        return (
          <Tooltip key={i} delayDuration={150}>
            <TooltipTrigger asChild>
              <span
                className="rounded px-0.5 py-px cursor-help transition-colors"
                style={{
                  background: colors.bg,
                  color: colors.text,
                  borderBottom: isWarning ? "2px solid #DC2626" : undefined,
                }}
              >
                {seg.text}
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-[260px] text-xs leading-relaxed z-[100]"
              style={{ background: "#FFFFFF", color: "#1A1A1A", border: "1px solid #E0E0E0" }}
            >
              {isWarning && <span className="font-bold">⚠ If this changes, everything changes</span>}
              {isWarning && tooltipContent && <br />}
              {tooltipContent}
              {isWarning && (
                <p className="text-[10px] mt-1" style={{ color: "#999" }}>
                  Future feature: see how this changes the problem →
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </p>
  );
}

// ── Numbered-amount list detection ──────────────────────────────────
const NUMBERED_AMOUNT_RE = /^(\d+)\.\s+(.+?)\$\s*([\d,]+(?:\.\d+)?)/;

function isNumberedAmountLine(line: string): boolean {
  return NUMBERED_AMOUNT_RE.test(line.trim());
}

function parseNumberedAmountBlock(lines: string[]): { description: string; amount: string; extra: string }[] {
  return lines.filter(l => l.trim()).map(l => {
    const m = l.trim().match(NUMBERED_AMOUNT_RE);
    if (!m) return { description: l.trim(), amount: "", extra: "" };
    const rawDesc = m[2].trim();
    const description = rawDesc.replace(/[:.]\s*$/, "").trim();
    const amount = `$${m[3]}`;
    const afterAmount = l.trim().slice(m[0].length).replace(/^[.,;:\s]+/, "").trim();
    return { description, amount, extra: afterAmount };
  });
}

function isKVLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return /^[\w\s&]+:\s*.+$/.test(t);
}

function parseKVBlock(lines: string[]): string[][] {
  return lines.filter(l => l.trim()).map(l => {
    const idx = l.indexOf(":");
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
  });
}

function parsePipeSegments(text: string) {
  const lines = text.split("\n");
  const segments: { type: "text" | "table" | "kv-table" | "numbered-amount"; content: string; rows?: string[][]; numberedRows?: { description: string; amount: string; extra: string }[] }[] = [];
  let i = 0;
  while (i < lines.length) {
    if (i < lines.length - 1 && lines[i].includes("|") && lines[i + 1].includes("|")) {
      const start = i;
      while (i < lines.length && lines[i].includes("|")) i++;
      const block = lines.slice(start, i).join("\n");
      const rows = block.split("\n").filter(l => l.trim()).map(line => {
        const cells = line.split("|").map(c => c.trim());
        if (cells[0] === "") cells.shift();
        if (cells[cells.length - 1] === "") cells.pop();
        return cells;
      });
      const dataRows = rows.filter(row => !row.every(c => /^[-:]+$/.test(c)));
      if (dataRows.length >= 2) segments.push({ type: "table", content: block, rows: dataRows });
      else segments.push({ type: "text", content: block });
    } else if (isNumberedAmountLine(lines[i]) && i < lines.length - 1 && isNumberedAmountLine(lines[i + 1])) {
      const start = i;
      while (i < lines.length && isNumberedAmountLine(lines[i])) i++;
      const block = lines.slice(start, i);
      const numberedRows = parseNumberedAmountBlock(block);
      segments.push({ type: "numbered-amount", content: block.join("\n"), numberedRows });
    } else {
      if (isKVLine(lines[i]) && i < lines.length - 1 && isKVLine(lines[i + 1])) {
        const start = i;
        while (i < lines.length && (isKVLine(lines[i]) || !lines[i].trim())) {
          if (!lines[i].trim()) {
            if (i + 1 < lines.length && isKVLine(lines[i + 1])) { i++; continue; }
            break;
          }
          i++;
        }
        const kvLines = lines.slice(start, i).filter(l => l.trim());
        if (kvLines.length >= 2) segments.push({ type: "kv-table", content: kvLines.join("\n"), rows: parseKVBlock(kvLines) });
        else segments.push({ type: "text", content: kvLines.join("\n") });
      } else {
        const start = i;
        while (
          i < lines.length &&
          !(i < lines.length - 1 && lines[i].includes("|") && lines[i + 1].includes("|")) &&
          !(isKVLine(lines[i]) && i < lines.length - 1 && isKVLine(lines[i + 1])) &&
          !(isNumberedAmountLine(lines[i]) && i < lines.length - 1 && isNumberedAmountLine(lines[i + 1]))
        ) i++;
        const block = lines.slice(start, i).join("\n");
        if (block.trim()) segments.push({ type: "text", content: block });
      }
    }
  }
  return segments;
}

function isNumericCell(cell: string) {
  return /^\$?[\d,]+(\.\d+)?%?$/.test(cell.trim());
}

function PipeTable({ rows, theme }: { rows: string[][]; theme: Theme }) {
  const header = rows[0];
  const body = rows.slice(1);
  return (
    <div className="my-4">
      <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${theme.border}` }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: theme.tableHeaderBg }}>
              {header.map((h, i) => <th key={i} className="px-3 py-2 text-center text-white font-bold text-[13px]">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? theme.pageBg : theme.tableAltBg }}>
                {row.map((cell, ci) => <td key={ci} className={`px-3 py-1.5 text-center text-[13px] ${isNumericCell(cell) ? "font-mono" : ""}`} style={{ color: theme.text }}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KVTable({ rows, theme }: { rows: string[][]; theme: Theme }) {
  return (
    <div className="my-4 flex justify-center">
      <table className="text-[14px]">
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              <td className="pr-6 py-[3px] text-right" style={{ color: theme.text }}>{row[0]}</td>
              <td className="py-[3px] text-right font-mono" style={{ color: theme.text }}>{row[1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NumberedAmountTable({ rows, theme }: { rows: { description: string; amount: string; extra: string }[]; theme: Theme }) {
  return (
    <div className="my-5">
      <div className="flex justify-center">
        <table className="text-[14px]" style={{ borderCollapse: "collapse" }}>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                <td className="pr-8 py-[5px] text-left" style={{ color: theme.text, verticalAlign: "top" }}>{row.description}</td>
                <td className="py-[5px] text-right font-mono whitespace-nowrap" style={{ color: theme.text }}>{row.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.some(r => r.extra) && (
        <div className="mt-3 space-y-1">
          {rows.map((r, i) => r.extra ? (
            <p key={i} className="text-[13px] whitespace-pre-wrap" style={{ color: theme.textMuted }}>{r.extra}</p>
          ) : null)}
        </div>
      )}
    </div>
  );
}

function SmartContent({ text, className, theme }: { text: string; className?: string; theme: Theme }) {
  const segments = parsePipeSegments(text);
  return (
    <div className={className}>
      {segments.map((seg, i) =>
        seg.type === "table" && seg.rows
          ? <PipeTable key={i} rows={seg.rows} theme={theme} />
          : seg.type === "kv-table" && seg.rows
            ? <KVTable key={i} rows={seg.rows} theme={theme} />
            : seg.type === "numbered-amount" && seg.numberedRows
              ? <NumberedAmountTable key={i} rows={seg.numberedRows} theme={theme} />
              : <p key={i} className="whitespace-pre-wrap">{seg.content}</p>
      )}
    </div>
  );
}

// ── SmartContent with dissector highlights ───────────────────────────

function SmartContentWithDissector({
  text,
  className,
  theme,
  highlights,
}: {
  text: string;
  className?: string;
  theme: Theme;
  highlights: DissectorHighlight[];
}) {
  const segments = parsePipeSegments(text);
  return (
    <div className={className}>
      {segments.map((seg, i) =>
        seg.type === "table" && seg.rows
          ? <PipeTable key={i} rows={seg.rows} theme={theme} />
          : seg.type === "kv-table" && seg.rows
            ? <KVTable key={i} rows={seg.rows} theme={theme} />
            : seg.type === "numbered-amount" && seg.numberedRows
              ? <NumberedAmountTable key={i} rows={seg.numberedRows} theme={theme} />
              : <DissectorHighlightedText key={i} problemText={seg.content} highlights={highlights} theme={theme} />
      )}
    </div>
  );
}

// ── Section heading ─────────────────────────────────────────────────

function SectionHeading({ children, theme }: { children: React.ReactNode; theme: Theme }) {
  return (
    <h2 className="text-[11px] font-bold tracking-[0.15em] uppercase pb-1 mb-3 mt-8" style={{ color: theme.heading, borderBottom: `1px solid ${theme.border}` }}>
      {children}
    </h2>
  );
}

// ── Tiered Paywall Card ──────────────────────────────────────────────

function TieredPaywallCard({ theme, enrollUrl, fullPassLink, chapterLink, chapterNumber }: { theme: Theme; enrollUrl: string; fullPassLink?: any; chapterLink?: any; chapterNumber?: number | null }) {
  const now = new Date();
  const saleActive = fullPassLink?.sale_expires_at ? now < new Date(fullPassLink.sale_expires_at) : false;
  const fullPassUrl = fullPassLink?.url || enrollUrl;
  const chapterUrl = chapterLink?.url || enrollUrl;
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: "#FFFBF0" }}>
      <div className="text-center mb-2">
        <Lock className="h-6 w-6 mx-auto mb-2" style={{ color: "#14213D" }} />
        <p className="text-[15px] font-bold" style={{ color: "#14213D" }}>Unlock with a Study Pass to reveal this section</p>
      </div>
      <div className="relative rounded-xl px-6 py-6" style={{ background: "#14213D", border: "2px solid rgba(212,175,55,0.5)", boxShadow: "0 4px 24px rgba(20,33,61,0.25), 0 0 0 1px rgba(212,175,55,0.15)" }}>
        <span className="absolute top-0 right-0 text-[10px] font-bold px-3 py-1.5 rounded-bl-xl rounded-tr-xl" style={{ background: "#CE1126", color: "#FFFFFF" }}>Best Value</span>
        <p className="font-bold text-[16px] text-white">Full Study Pass — Intermediate Accounting 2</p>
        <div className="flex items-baseline gap-2 mt-2">
          {saleActive && fullPassLink?.original_price_cents && <span className="line-through text-[14px]" style={{ color: "rgba(255,255,255,0.45)" }}>{formatPrice(fullPassLink.original_price_cents)}</span>}
          <span className="font-bold text-[24px] text-white">{formatPrice(fullPassLink?.price_cents || 12500)}</span>
          {saleActive && fullPassLink?.sale_label && <span className="text-[12px] font-semibold" style={{ color: "#00FFFF" }}>· {fullPassLink.sale_label}</span>}
        </div>
        <a href={fullPassUrl} target="_blank" rel="noopener noreferrer" className="block w-full mt-4 px-6 py-3 rounded-lg font-bold text-[15px] text-center text-white transition-all hover:brightness-90 active:scale-[0.98]" style={{ background: "#CE1126", height: 48, lineHeight: "24px" }}>Get Full Access →</a>
        <p className="text-[11px] mt-3 text-center" style={{ color: "rgba(255,255,255,0.55)" }}>7-day refund policy · Covers Ch 13–22 · Access expires after finals</p>
      </div>
      {chapterNumber && (
        <div className="rounded-xl px-6 py-5" style={{ border: `1px solid ${theme.border}`, background: theme.pageBg }}>
          <p className="font-bold text-[15px]" style={{ color: theme.text }}>Chapter {chapterNumber} Only</p>
          <p className="font-bold text-[22px] mt-1" style={{ color: theme.text }}>{formatPrice(chapterLink?.price_cents || 3000)}</p>
          <a href={chapterUrl} target="_blank" rel="noopener noreferrer" className="block w-full mt-3 px-6 py-3 rounded-lg font-bold text-[15px] text-center text-white transition-all hover:brightness-90 active:scale-[0.98]" style={{ background: "#006BA6", height: 48, lineHeight: "24px" }}>Buy Chapter {chapterNumber} →</a>
          <p className="text-[11px] mt-2.5 text-center" style={{ color: theme.textMuted }}>Covers Ch {chapterNumber} only · Access expires after finals</p>
        </div>
      )}
    </div>
  );
}

// ── Reveal Toggle ───────────────────────────────────────────────────

function RevealToggle({ label, children, theme, isPreview, enrollUrl, sectionName, assetCode, extraFooterLeft, fullPassLink, chapterLink, chapterNumber, forceOpen }: { label: string; children: React.ReactNode; theme: Theme; isPreview: boolean; enrollUrl: string; sectionName?: string; assetCode?: string; extraFooterLeft?: React.ReactNode; fullPassLink?: any; chapterLink?: any; chapterNumber?: number | null; forceOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);
  const reportMailto = sectionName && assetCode ? `mailto:lee@surviveaccounting.com?subject=${encodeURIComponent(`Issue Report: ${assetCode} — ${sectionName}`)}&body=${encodeURIComponent(`I found an issue in the ${sectionName} section of ${assetCode}. Please describe the issue below:\n\n`)}` : null;

  return (
    <div className="rounded-lg mt-4 overflow-hidden transition-all" style={{ background: theme.toggleBg, border: `1px solid ${theme.border}` }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 text-left transition-colors" style={{ color: theme.textMuted }} onMouseEnter={(e) => { e.currentTarget.style.background = theme.cardBg; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
        <span className="flex items-center gap-2 text-[13px]">
          {open ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {label}
        </span>
        <span className="flex items-center gap-1.5 text-[12px]">
          {open ? `Hide ${label.replace("Reveal ", "")}` : label}
          <ChevronDown className="h-3.5 w-3.5 transition-transform" style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }} />
        </span>
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-4 pt-3" style={{ borderTop: `1px solid ${theme.border}` }}>
          {isPreview ? (
            <TieredPaywallCard theme={theme} enrollUrl={enrollUrl} fullPassLink={fullPassLink} chapterLink={chapterLink} chapterNumber={chapterNumber} />
          ) : (
            <>
              {children}
              {(reportMailto || extraFooterLeft) && (
                <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: `1px solid ${theme.border}` }}>
                  <div>{extraFooterLeft || null}</div>
                  {reportMailto ? (
                    <a href={reportMailto} className="flex items-center gap-1.5 text-[12px] hover:underline" style={{ color: theme.textMuted }}>
                      <AlertTriangle className="h-3 w-3" /> Report an issue with this section →
                    </a>
                  ) : <div />}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── JE Tables ───────────────────────────────────────────────────────

function formatJEDate(dateStr: string): string {
  if (!dateStr) return "";
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return dateStr;
  const [, y, m, d] = match;
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const monthName = months[parseInt(m, 10) - 1] || m;
  const day = parseInt(d, 10);
  return `${monthName} ${day}, ${y}`;
}

function JETable({ entries, theme }: { entries: any[]; theme: Theme }) {
  return (
    <div className="space-y-5">
      {entries.map((entry: any, ei: number) => {
        const rawDate = entry.entry_date || entry.date || "";
        const formattedDate = formatJEDate(rawDate);
        const memo = entry.memo || "";
        const rows = entry.rows || entry.accounts || [];
        return (
          <div key={ei}>
            {(formattedDate || memo) && (
              <div className="mb-1.5">
                {formattedDate && memo ? (
                  <p className="font-bold text-sm" style={{ color: theme.text }}>
                    {formattedDate} — <span className="font-semibold italic">{memo.replace(/^To record\s*/i, "").replace(/\.$/, "")}</span>
                  </p>
                ) : (
                  <>
                    {formattedDate && <p className="font-bold text-sm" style={{ color: theme.text }}>{formattedDate}</p>}
                    {memo && <p className="text-[12px] italic" style={{ color: theme.textMuted }}>{memo}</p>}
                  </>
                )}
              </div>
            )}
            <div className="overflow-x-auto rounded-md" style={{ border: `1px solid ${theme.border}` }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: theme.tableHeaderBg }}>
                    <th className="text-left px-3 py-1.5 text-white font-bold text-[12px]">Account</th>
                    <th className="text-right px-3 py-1.5 text-white font-bold text-[12px] w-24">Debit</th>
                    <th className="text-right px-3 py-1.5 text-white font-bold text-[12px] w-24">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: any, ri: number) => {
                    const isCredit = row.side === "credit" || (row.credit != null && row.credit !== 0 && (row.debit == null || row.debit === 0));
                    return (
                      <tr key={ri} style={{ background: ri % 2 === 0 ? theme.pageBg : theme.tableAltBg }}>
                        <td className={`px-3 py-1.5 text-[13px] ${isCredit ? "pl-10" : ""}`} style={{ color: theme.text }}>
                          {row.account_name || row.account || ""}
                          {row.debit_credit_reason && <JETooltip text={row.debit_credit_reason} variant="solutions" />}
                        </td>
                        <td className="text-right px-3 py-1.5 text-[13px] font-mono" style={{ color: theme.text }}>
                          {!isCredit && row.debit != null && row.debit !== 0 ? (
                            <span>{Number(row.debit).toLocaleString("en-US")}{row.amount_source && <JETooltip text={row.amount_source} variant="solutions" />}</span>
                          ) : ""}
                        </td>
                        <td className="text-right px-3 py-1.5 text-[13px] font-mono" style={{ color: theme.text }}>
                          {isCredit && row.credit != null ? (
                            <span>{Number(row.credit).toLocaleString("en-US")}{row.amount_source && <JETooltip text={row.amount_source} variant="solutions" />}</span>
                          ) : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CanonicalJESection({ data, theme }: { data: CanonicalJEPayload; theme: Theme }) {
  const hasMultipleScenarios = data.scenario_sections.length > 1;
  return (
    <div className="space-y-6">
      {data.scenario_sections.map((section, si) => (
        <div key={si}>
          {hasMultipleScenarios && (
            <p className="font-bold text-[13px] mb-2 pb-1" style={{ color: theme.text, borderBottom: `1px solid ${theme.border}` }}>{section.label}</p>
          )}
          <JETable entries={section.entries_by_date} theme={theme} />
        </div>
      ))}
    </div>
  );
}

function RawJEFallback({ text, theme }: { text: string; theme: Theme }) {
  const lines = text.split("\n");
  const dateRe = /(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)/i;
  const amountRe = /([\d,]+(?:\.\d+)?)\s*$/;
  const rows: { account: string; debit: string; credit: string; isDate: boolean; isCredit: boolean }[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    if (dateRe.test(line) && !amountRe.test(line)) {
      rows.push({ account: line.trim(), debit: "", credit: "", isDate: true, isCredit: false });
    } else {
      const isCredit = line.startsWith("\t") || line.startsWith("    ") || line.startsWith("  ");
      const amountMatch = line.match(amountRe);
      const amount = amountMatch ? amountMatch[1] : "";
      const accountName = line.replace(amountRe, "").trim();
      rows.push({ account: accountName, debit: !isCredit ? amount : "", credit: isCredit ? amount : "", isDate: false, isCredit });
    }
  }
  return (
    <div className="overflow-x-auto rounded-md" style={{ border: `1px solid ${theme.border}` }}>
      <table className="w-full text-sm">
        <thead><tr style={{ background: theme.tableHeaderBg }}>
          <th className="text-left px-3 py-1.5 text-white font-bold text-[12px]">Account</th>
          <th className="text-right px-3 py-1.5 text-white font-bold text-[12px] w-24">Debit</th>
          <th className="text-right px-3 py-1.5 text-white font-bold text-[12px] w-24">Credit</th>
        </tr></thead>
        <tbody>
          {rows.map((r, i) =>
            r.isDate ? (
              <tr key={i} style={{ background: theme.cardBg }}><td colSpan={3} className="px-3 py-1.5 font-bold text-[13px]" style={{ color: theme.text }}>{r.account}</td></tr>
            ) : (
              <tr key={i} style={{ background: i % 2 === 0 ? theme.pageBg : theme.tableAltBg }}>
                <td className={`px-3 py-1.5 text-[13px] ${r.isCredit ? "pl-10" : ""}`} style={{ color: theme.text }}>{r.account}</td>
                <td className="text-right px-3 py-1.5 text-[13px] font-mono" style={{ color: theme.text }}>{r.debit}</td>
                <td className="text-right px-3 py-1.5 text-[13px] font-mono" style={{ color: theme.text }}>{r.credit}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Inline JE detection ──────────────────────────────────────────────

interface InlineJERow { side: "debit" | "credit"; account: string; amount: string }
const DEBIT_CREDIT_RE = /^(Debit|Credit)\s+(.+?)\s+(\$[\d,]+(?:\.\d+)?)\s*$/i;
function parseInlineJELine(line: string): InlineJERow | null {
  const m = line.trim().match(DEBIT_CREDIT_RE);
  if (!m) return null;
  return { side: m[1].toLowerCase() as "debit" | "credit", account: m[2].trim(), amount: m[3] };
}

function InlineJETable({ rows, heading, theme }: { rows: InlineJERow[]; heading?: string; theme: Theme }) {
  return (
    <div style={{ margin: "12px 0" }}>
      {heading && <p style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 6 }}>{heading}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ background: theme.tableHeaderBg }}>
          <th style={{ color: "#fff", padding: "6px 10px", textAlign: "left", fontWeight: 600 }}>Account</th>
          <th style={{ color: "#fff", padding: "6px 10px", textAlign: "right", fontWeight: 600, width: 90 }}>Debit</th>
          <th style={{ color: "#fff", padding: "6px 10px", textAlign: "right", fontWeight: 600, width: 90 }}>Credit</th>
        </tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? theme.tableAltBg : "transparent" }}>
              <td style={{ padding: "5px 10px", paddingLeft: row.side === "credit" ? 30 : 10, color: theme.text }}>{row.account}</td>
              <td style={{ padding: "5px 10px", textAlign: "right", color: theme.text }}>{row.side === "debit" ? row.amount : ""}</td>
              <td style={{ padding: "5px 10px", textAlign: "right", color: theme.text }}>{row.side === "credit" ? row.amount : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Answer Summary ──────────────────────────────────────────────────

function AnswerSummarySection({ text, theme, instructions }: { text: string; theme: Theme; instructions?: { instruction_number: number; instruction_text: string }[] }) {
  const subSections = text.split(/(?=\([a-z]\))/i).filter(s => s.trim());
  return (
    <div className="rounded-md p-4 pl-5 border-l-[3px] break-words overflow-hidden" style={{ background: theme.answerBg, borderColor: theme.answerBorder }}>
      {subSections.map((section, si) => {
        const labelMatch = section.match(/^\(([a-z])\)\s*(.*)/i);
        const letterIndex = labelMatch ? labelMatch[1].toLowerCase().charCodeAt(0) - 96 : 0;
        const matchedInstruction = labelMatch && instructions?.find(i => i.instruction_number === letterIndex);
        const label = labelMatch ? matchedInstruction ? `(${labelMatch[1]}) ${matchedInstruction.instruction_text}` : `(${labelMatch[1]}) ${labelMatch[2].split("\n")[0]}` : null;
        const content = labelMatch ? section.slice(labelMatch[0].split("\n")[0].length) : section;
        const contentLines = content.split("\n").filter(l => l.trim());

        type TextSeg = { type: "text"; lines: { text: string; idx: number }[] };
        type JESeg = { type: "je"; rows: InlineJERow[]; heading?: string };
        type Seg = TextSeg | JESeg;
        let i = 0;
        const segs: Seg[] = [];

        while (i < contentLines.length) {
          const parsed = parseInlineJELine(contentLines[i]);
          if (parsed) {
            let heading: string | undefined;
            const lastSeg = segs[segs.length - 1];
            if (lastSeg && lastSeg.type === "text") {
              const lastLine = lastSeg.lines[lastSeg.lines.length - 1];
              if (lastLine && /^journal\s+entr(y|ies)\s*:/i.test(lastLine.text.trim())) {
                heading = lastLine.text.trim();
                lastSeg.lines.pop();
                if (lastSeg.lines.length === 0) segs.pop();
              }
            }
            const jeRows: InlineJERow[] = [parsed];
            i++;
            while (i < contentLines.length) {
              const next = parseInlineJELine(contentLines[i]);
              if (next) { jeRows.push(next); i++; } else break;
            }
            segs.push({ type: "je", rows: jeRows, heading });
          } else {
            const lastSeg = segs[segs.length - 1];
            if (lastSeg && lastSeg.type === "text") lastSeg.lines.push({ text: contentLines[i], idx: i });
            else segs.push({ type: "text", lines: [{ text: contentLines[i], idx: i }] });
            i++;
          }
        }

        return (
          <div key={si}>
            {si > 0 && <div className="my-3" style={{ borderTop: `1px solid ${theme.border}` }} />}
            {label && <p className="font-bold text-[14px]" style={{ color: theme.text, marginTop: si > 0 ? 16 : 0, marginBottom: 8 }}>{label}</p>}
            {segs.map((seg, segIdx) => {
              if (seg.type === "je") return <InlineJETable key={`je-${segIdx}`} rows={seg.rows} heading={seg.heading} theme={theme} />;
              return seg.lines.map((line) => {
                const trimmed = line.text.trim();
                const isYearLabel = /^\d{4}\s*:/.test(trimmed);
                const isNumberedStep = /^\d+\.\s/.test(trimmed);
                if (isYearLabel) return <p key={line.idx} className="font-bold text-[13px]" style={{ color: theme.text, marginTop: 10, marginBottom: 4 }}>{trimmed}</p>;
                if (isNumberedStep) return <p key={line.idx} className="font-semibold text-[13px] ml-2 sm:ml-4 mb-1 leading-[1.6] break-words" style={{ color: theme.text, marginTop: 14 }}>{trimmed}</p>;
                return <p key={line.idx} className="text-[13px] ml-2 sm:ml-4 mb-1 leading-[1.6] break-words" style={{ color: theme.text }}>{trimmed}</p>;
              });
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Report Issue Modal ──────────────────────────────────────────────

function ReportIssueModal({ open, onOpenChange, asset }: { open: boolean; onOpenChange: (v: boolean) => void; asset: any }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async () => {
    if (!message.trim()) { toast.error("Please describe the issue"); return; }
    setSubmitting(true);
    try {
      await supabase.from("asset_issue_reports").insert({ teaching_asset_id: asset.id, asset_name: asset.asset_name, reporter_email: email.trim() || null, message: message.trim() });
      toast.success("Report submitted — thank you!");
      setEmail(""); setMessage(""); onOpenChange(false);
    } catch (e: any) { toast.error(e.message || "Failed to submit report"); }
    finally { setSubmitting(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Report an Issue</DialogTitle><DialogDescription>{asset.source_ref} · {asset.asset_name}</DialogDescription></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label className="text-xs">Email (optional)</Label><Input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="mt-1" /></div>
          <div><Label className="text-xs">Message</Label><Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe the issue…" rows={4} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost" size="sm">Cancel</Button></DialogClose>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>{submitting ? "Sending…" : "Send Report"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Flowchart Sub-Toggle ────────────────────────────────────────────

function FlowchartSubToggle({ letter, instructionText, imageUrl, theme }: { letter: string; instructionText: string; imageUrl: string; theme: Theme }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg overflow-hidden transition-all" style={{ background: theme.pageBg, border: `1px solid ${open ? theme.answerBorder : theme.border}` }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors group" style={{ color: theme.text }}>
        <span className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full text-[12px] font-bold mt-0.5" style={{ background: open ? theme.answerBorder : theme.tableHeaderBg, color: "#FFFFFF" }}>{letter}</span>
        <span className="flex-1 text-[13px] leading-[1.5]">{instructionText}</span>
        <ChevronDown className="h-4 w-4 shrink-0 mt-0.5 transition-transform" style={{ transform: open ? "rotate(180deg)" : "rotate(0)", color: theme.textMuted }} />
      </button>
      {open && (
        <div className="px-4 pb-4" style={{ borderTop: `1px solid ${theme.border}` }}>
          <img src={imageUrl} alt={`How to solve ${letter}`} className="w-full rounded-lg mt-3" loading="lazy" />
        </div>
      )}
    </div>
  );
}

// ── Supplementary JE Display ────────────────────────────────────────

function SupplementaryJESection({ data, theme }: { data: { entries: { label: string; rows: { account_name: string; side: "debit" | "credit"; debit_credit_reason?: string; amount_source?: string }[] }[] }; theme: Theme }) {
  return (
    <div className="space-y-4">
      <p className="text-[12px] leading-[1.5] rounded-md px-3 py-2" style={{ background: theme.cardBg, color: theme.textMuted, border: `1px solid ${theme.border}` }}>
        💡 These journal entries aren't explicitly required by the problem — but understanding the underlying entries helps you master the topic.
      </p>
      {data.entries.map((entry, ei) => (
        <div key={ei}>
          <p className="font-semibold text-[13px] mb-1.5" style={{ color: theme.text }}>{entry.label}</p>
          <div className="overflow-x-auto rounded-md" style={{ border: `1px solid ${theme.border}` }}>
            <table className="w-full text-sm">
              <thead><tr style={{ background: theme.tableHeaderBg }}>
                <th className="text-left px-3 py-1.5 text-white font-bold text-[12px]">Account</th>
                <th className="text-right px-3 py-1.5 text-white font-bold text-[12px] w-24">Debit</th>
                <th className="text-right px-3 py-1.5 text-white font-bold text-[12px] w-24">Credit</th>
              </tr></thead>
              <tbody>
                {entry.rows.map((row, ri) => {
                  const isCredit = row.side === "credit";
                  return (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? theme.pageBg : theme.tableAltBg }}>
                      <td className={`px-3 py-1.5 text-[13px] ${isCredit ? "pl-10" : ""}`} style={{ color: theme.text }}>
                        {row.account_name}
                        {row.debit_credit_reason && <JETooltip text={row.debit_credit_reason} variant="solutions" />}
                      </td>
                      <td className="text-right px-3 py-1.5 text-[13px] font-mono" style={{ color: theme.textMuted }}>{!isCredit ? "???" : ""}</td>
                      <td className="text-right px-3 py-1.5 text-[13px] font-mono" style={{ color: theme.textMuted }}>{isCredit ? "???" : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function parseExamTraps(text: string): string[] {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length >= 2) return lines.map(l => l.replace(/^[-•·]\s*/, '').replace(/^\d+[.)]\s*/, ''));
  const sentences = text.split(/\.\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean);
  return sentences.map(s => s.endsWith('.') ? s : s + '.');
}

function splitLongBullets(text: string): string[] {
  const raw = text.split(/\.\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean);
  return raw.map(s => s.endsWith('.') ? s : s + '.');
}

function GroupedFormulas({ text, theme }: { text: string; theme: Theme }) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const groups: { header: string; items: string[] }[] = [];
  for (const line of lines) {
    const colonMatch = line.match(/^(.+?):\s+(.+)$/);
    if (colonMatch) {
      const [, prefix, formula] = colonMatch;
      const existing = groups.find(g => g.header === prefix);
      if (existing) existing.items.push(formula);
      else groups.push({ header: prefix, items: [formula] });
    } else groups.push({ header: "", items: [line] });
  }
  const hasGrouping = groups.some(g => g.items.length >= 2);
  if (!hasGrouping) {
    return (<div className="space-y-3">{lines.map((line, i) => (<div key={i} className="rounded px-4 py-2.5 border-l-[3px]" style={{ background: theme.formulaBg, borderColor: theme.formulaBorder }}><p className="font-mono text-[13px]" style={{ color: theme.text }}>{line}</p></div>))}</div>);
  }
  return (
    <div className="space-y-5">{groups.map((group, gi) => (<div key={gi}>{group.header && <p className="font-bold text-[13px] mb-2" style={{ color: theme.text }}>{group.header}</p>}<div className="space-y-2">{group.items.map((item, ii) => (<div key={ii} className="rounded px-4 py-2.5 border-l-[3px]" style={{ background: theme.formulaBg, borderColor: theme.formulaBorder }}><p className="font-mono text-[13px]" style={{ color: theme.text }}>{item}</p></div>))}</div></div>))}</div>
  );
}

// ── About Lee ───────────────────────────────────────────────────────

function AboutLeeSection({ theme }: { theme: Theme }) {
  return (
    <div className="flex flex-col items-center text-center gap-4">
      <img src={LEE_HERO_URL} alt="Lee Ingram" className="w-full" style={{ objectFit: "contain", borderRadius: 12, maxHeight: 280 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      <div className="max-w-[400px]">
        <p className="text-[13px] leading-[1.6]" style={{ color: theme.text }}>
          Founder of <a href="https://surviveaccounting.com" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline" style={{ color: "#3B82F6" }}>SurviveAccounting.com</a>.<br />
          Tutoring entrepreneur since 2015.<br />Hope this helps you feel more confident going into your exam.<br /><span className="italic">— Lee</span>
        </p>
      </div>
    </div>
  );
}

function AboutLeeModal({ open, onOpenChange, theme }: { open: boolean; onOpenChange: (v: boolean) => void; theme: Theme }) {
  return (<Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" style={{ borderRadius: 16 }}><DialogHeader><DialogTitle className="text-center">About Lee Ingram</DialogTitle><DialogDescription className="sr-only">Bio</DialogDescription></DialogHeader><AboutLeeSection theme={theme} /></DialogContent></Dialog>);
}

// ── Floating Action Bar ─────────────────────────────────────────────

function FloatingActionBar({ theme, shareUrl, assetCode }: { theme: Theme; shareUrl: string; assetCode: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const reportMailto = `mailto:lee@surviveaccounting.com?subject=${encodeURIComponent(`Issue Report: ${assetCode}`)}&body=${encodeURIComponent(`I found an issue on this page (${assetCode}).`)}`;

  return (
    <>
      <div className="block sm:hidden fixed z-30" style={{ bottom: 20, right: 16 }}>
        <button onClick={() => { copyToClipboard(shareUrl).then(() => toast.success("Link copied!")); }} className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[12px] font-bold shadow-lg" style={{ background: "#FFFFFF", color: "#3B82F6", border: `1px solid ${theme.border}` }}>
          <Share2 className="h-3.5 w-3.5" /> Share
        </button>
      </div>
      <div className="hidden sm:block fixed z-30" style={{ top: 56, right: 16 }}>
        <div className="flex items-center rounded-full overflow-hidden" style={{ background: "#FFFFFF", border: `1px solid ${theme.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.10)" }}>
          {!collapsed && (
            <>
              <button onClick={() => { copyToClipboard(shareUrl).then(() => toast.success("Link copied!")); }} className="text-[11px] font-bold px-3 py-2 whitespace-nowrap flex items-center gap-1.5" style={{ color: "#3B82F6" }}><Share2 className="h-3 w-3" /> Share This</button>
              <div className="w-px h-5" style={{ background: theme.border }} />
              <button onClick={() => setAboutOpen(true)} className="text-[11px] font-semibold px-3 py-2 whitespace-nowrap" style={{ color: theme.text }}>About Lee Ingram</button>
              <div className="w-px h-5" style={{ background: theme.border }} />
              <a href={reportMailto} className="text-[11px] font-semibold px-3 py-2 whitespace-nowrap flex items-center gap-1" style={{ color: theme.textMuted }}>⚠ Report Issue →</a>
              <div className="w-px h-5" style={{ background: theme.border }} />
            </>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="px-2.5 py-2 text-[10px] flex items-center gap-0.5" style={{ color: theme.textMuted }}>
            {collapsed ? <>Show <ChevronDown className="h-3 w-3" /></> : <ChevronUp className="h-3 w-3" />}
          </button>
        </div>
      </div>
      <AboutLeeModal open={aboutOpen} onOpenChange={setAboutOpen} theme={theme} />
    </>
  );
}

// ── JE Preview Teaser ───────────────────────────────────────────────

function JEPreviewTeaser({ jeData, jeBlock, hasCanonicalJE, theme, enrollUrl }: { jeData: any; jeBlock: string; hasCanonicalJE: boolean; theme: Theme; enrollUrl: string }) {
  const entries: { date: string; rows: { isCredit: boolean }[] }[] = [];
  if (hasCanonicalJE) {
    const parsed: CanonicalJEPayload = typeof jeData === "string" ? JSON.parse(jeData) : jeData;
    for (const section of parsed.scenario_sections) {
      for (const entry of section.entries_by_date) {
        entries.push({ date: entry.entry_date ?? (entry as any).date ?? "", rows: (entry.rows || []).map((row: any) => ({ isCredit: row.side === "credit" || (row.credit != null && row.credit !== 0 && (row.debit == null || row.debit === 0)) })) });
      }
    }
  } else {
    const lines = jeBlock.split("\n").filter((l: string) => l.trim());
    entries.push({ date: "", rows: lines.map((line: string) => ({ isCredit: line.startsWith("\t") || line.startsWith("    ") || line.startsWith("  ") })) });
  }
  return (
    <div className="space-y-4">
      {entries.map((entry, ei) => (
        <div key={ei}>
          {entry.date && <p className="font-bold text-sm mb-1" style={{ color: theme.text }}>???</p>}
          <div className="overflow-x-auto rounded-md" style={{ border: `1px solid ${theme.border}` }}>
            <table className="w-full text-sm">
              <thead><tr style={{ background: theme.tableHeaderBg }}>
                <th className="text-left px-3 py-1.5 text-white font-bold text-[12px]">Account</th>
                <th className="text-right px-3 py-1.5 text-white font-bold text-[12px] w-24">Debit</th>
                <th className="text-right px-3 py-1.5 text-white font-bold text-[12px] w-24">Credit</th>
              </tr></thead>
              <tbody>{entry.rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? theme.pageBg : theme.tableAltBg }}>
                  <td className={`px-3 py-1.5 text-[13px] ${row.isCredit ? "pl-10" : ""}`} style={{ color: theme.textMuted }}>???</td>
                  <td className="text-right px-3 py-1.5 text-[13px] font-mono" style={{ color: theme.textMuted }}>{!row.isCredit ? "???" : ""}</td>
                  <td className="text-right px-3 py-1.5 text-[13px] font-mono" style={{ color: theme.textMuted }}>{row.isCredit ? "???" : ""}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      ))}
      <div className="text-center pt-2">
        <a href={enrollUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold hover:underline" style={{ color: "#3B82F6" }}>Unlock account names and amounts with a Study Pass →</a>
      </div>
    </div>
  );
}

// ── Pulse animation CSS ─────────────────────────────────────────────

const pulseKeyframes = `
@keyframes highlight-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(217, 119, 6, 0); }
}
`;

// ── MAIN COMPONENT ──────────────────────────────────────────────────

export default function SolutionsViewerStaging() {
  const { assetCode } = useParams<{ assetCode: string }>();
  const [searchParams] = useSearchParams();
  const rawIsPreview = searchParams.get("preview") === "true";
  const previewToken = searchParams.get("preview_token") || "";
  const enrollUrl = useEnrollUrl();
  const t = lightTheme;

  // Preview token validation
  const { data: tokenSession, isLoading: tokenLoading } = useQuery({
    queryKey: ["preview-token", previewToken],
    queryFn: async () => {
      if (!previewToken) return null;
      const { data } = await supabase.from("edu_preview_sessions").select("id, asset_codes, expires_at, email").eq("id", previewToken).maybeSingle();
      return data;
    },
    enabled: !!previewToken,
    staleTime: 5 * 60 * 1000,
  });

  const [countdown, setCountdown] = useState("");
  const [previewExpired, setPreviewExpired] = useState(false);
  const tokenExpired = tokenSession && new Date(tokenSession.expires_at) < new Date();
  const tokenValidForAsset = tokenSession && !tokenExpired && assetCode && (tokenSession.asset_codes as string[])?.includes(assetCode);
  const isPreview = previewToken ? (!tokenValidForAsset || previewExpired) : rawIsPreview;

  const [showHighlights, setShowHighlights] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [allTogglesForceOpen, setAllTogglesForceOpen] = useState(false);

  // ── Dissector highlights toggle ──
  const [dissectorHighlightsOn, setDissectorHighlightsOn] = useState(false);

  useEffect(() => {
    const handler = (e: MessageEvent) => { if (e.data?.type === "QA_OPEN_ALL_TOGGLES") setAllTogglesForceOpen(true); };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    if (!tokenSession?.expires_at || !previewToken) return;
    const update = () => {
      const now = Date.now();
      const exp = new Date(tokenSession.expires_at).getTime();
      const diff = exp - now;
      if (diff <= 0) { setCountdown("00:00:00"); setPreviewExpired(true); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [tokenSession?.expires_at, previewToken]);

  // Fetch asset
  const { data, isLoading } = useQuery({
    queryKey: ["solutions-viewer-staging", assetCode],
    queryFn: async () => {
      const { data: assets, error: assetErr } = await (supabase
        .from("teaching_assets")
        .select(`
          id, asset_name, source_ref, source_number, problem_title,
          problem_context, survive_problem_text, problem_text_ht_backup,
          survive_solution_text, journal_entry_completed_json, journal_entry_block,
          important_formulas, concept_notes, exam_traps,
          lw_quiz_url, sheet_master_url, lw_video_url,
          solutions_page_views, practice_page_views,
          course_id, chapter_id, phase2_status, asset_approved_at, problem_type,
          instruction_1, instruction_2, instruction_3, instruction_4, instruction_5,
          instruction_list, flowchart_image_url, supplementary_je_json,
          chapters!teaching_assets_chapter_id_fkey ( chapter_number, chapter_name ),
          courses!teaching_assets_course_id_fkey ( course_name, code )
        `)
        .eq("asset_name", assetCode!)
        .limit(1) as any);
      if (assetErr) throw assetErr;
      const asset = assets?.[0];
      if (!asset) return null;
      const { data: instrData } = await supabase.from("problem_instructions").select("instruction_number, instruction_text").eq("teaching_asset_id", asset.id).order("instruction_number");
      const { data: flowchartsData } = await supabase.from("asset_flowcharts").select("instruction_number, instruction_label, flowchart_image_url").eq("teaching_asset_id", asset.id).order("instruction_number");
      return { ...asset, _problemTitle: asset.problem_title || "", _instructions: instrData || [], _flowcharts: flowchartsData || [] };
    },
    enabled: !!assetCode,
  });

  // Fetch dissector highlights
  const { data: dissectorData } = useQuery({
    queryKey: ["dissector-highlights-staging", data?.id],
    queryFn: async () => {
      const { data: problems } = await supabase
        .from("dissector_problems")
        .select("id, highlights")
        .eq("teaching_asset_id", data!.id)
        .order("created_at", { ascending: false })
        .limit(1);
      return problems?.[0] || null;
    },
    enabled: !!data?.id,
  });

  const dissectorHighlights: DissectorHighlight[] = useMemo(() => {
    if (!dissectorData?.highlights) return [];
    const raw = dissectorData.highlights as any;
    if (Array.isArray(raw)) return raw;
    return [];
  }, [dissectorData]);

  const hasDissectorData = dissectorHighlights.length > 0;

  // Fetch payment links
  const { data: paymentLinks } = useQuery({
    queryKey: ["payment-links-public"],
    queryFn: async () => {
      const { data } = await supabase.from("payment_links").select("*").eq("is_active", true);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: isPreview,
  });

  // Track page view
  useEffect(() => {
    if (!data?.id) return;
    const key = `solutions_viewed_${data.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    supabase.rpc("increment_solutions_views", { asset_id: data.id }).then(() => {});
  }, [data?.id]);

  // Page title
  useEffect(() => {
    if (!data) return;
    const ref = data.source_ref || data.asset_name || "";
    const pt = data._problemTitle || "";
    document.title = pt ? `[STAGING] ${ref} — ${pt}` : `[STAGING] ${ref}`;
    return () => { document.title = "Survive Accounting"; };
  }, [data]);

  if (isLoading || tokenLoading) {
    return (<div className="min-h-screen flex items-center justify-center" style={{ background: t.pageBg }}><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: t.border, borderTopColor: t.text }} /></div>);
  }

  if (!data) {
    return (<div className="min-h-screen flex items-center justify-center" style={{ background: t.pageBg }}><div className="text-center"><p className="text-2xl font-bold" style={{ color: t.text }}>Problem not found</p><p className="mt-2" style={{ color: t.textMuted }}>Check the asset code and try again.</p></div></div>);
  }

  const asset = data;
  const chapter = (asset as any).chapters;
  const course = (asset as any).courses;
  const chapterLabel = chapter?.chapter_number && chapter?.chapter_name ? `Ch ${chapter.chapter_number} — ${chapter.chapter_name}` : "";
  const courseCode = course?.code || "";
  const courseDisplayName = (() => {
    const code = courseCode.toUpperCase();
    if (code === "IA2") return "Intermediate Accounting 2";
    if (code === "IA1") return "Intermediate Accounting 1";
    if (code === "MA2") return "Managerial Accounting";
    if (code === "FA1") return "Financial Accounting";
    return course?.course_name || courseCode;
  })();
  const problemTitle = asset._problemTitle || "";
  const sourceRef = asset.source_ref || "";

  let instructions: string[] = (asset._instructions || []).sort((a: any, b: any) => a.instruction_number - b.instruction_number).filter((i: any) => i.instruction_text?.trim()).map((i: any) => i.instruction_text);
  if (instructions.length === 0) {
    const i1 = asset.instruction_1;
    if (i1?.trim()) instructions = [i1, asset.instruction_2, asset.instruction_3, asset.instruction_4, asset.instruction_5].filter((v: string | null) => v?.trim()) as string[];
    else if (asset.instruction_list?.trim()) instructions = asset.instruction_list.split(/[\n|]/).map((s: string) => s.trim()).filter(Boolean);
  }

  const jeData = asset.journal_entry_completed_json;
  const jeBlock = asset.journal_entry_block || "";
  const hasCanonicalJE = jeData && isCanonicalJE(typeof jeData === "string" ? JSON.parse(jeData) : jeData);
  const hasJE = hasCanonicalJE || jeBlock.trim();
  const answerSummary = asset.survive_solution_text || "";
  const formulas = asset.important_formulas || "";
  const conceptNotes = asset.concept_notes || "";
  const examTraps = asset.exam_traps || "";

  const hasHighlights = !!asset.problem_text_ht_backup?.trim();
  const rawProblemText = showHighlights && hasHighlights ? asset.problem_text_ht_backup! : asset.problem_context || "";

  const shareUrl = `https://learn.surviveaccounting.com/solutions/${asset.asset_name}?preview=true`;
  const chapterNum = chapter?.chapter_number || null;
  const fullPassLink = (paymentLinks || []).find((l: any) => l.link_type === "full_pass" && l.course_id === asset.course_id);
  const chapterLink = (paymentLinks || []).find((l: any) => l.link_type === "chapter" && l.chapter_id === asset.chapter_id);
  const HEADER_HEIGHT = 48;

  const stagingMailto = `mailto:lee@surviveaccounting.com?subject=${encodeURIComponent(`Staging Issue: ${assetCode}`)}&body=${encodeURIComponent(`I found an issue on the staging page for ${assetCode}.\n\n`)}`;

  return (
    <div className="min-h-screen relative" style={{ background: t.pageBg }}>
      {/* Pulse animation styles */}
      <style>{pulseKeyframes}</style>

      {/* Watermark */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${AORAKI_URL})`, opacity: 0.06 }} />
        <div className="absolute inset-0" style={{ background: t.watermarkOverlay }} />
      </div>

      {/* Navy Header + Staging Banner */}
      <div className="relative sticky top-0" style={{ zIndex: 20 }}>
        <header style={{ background: "#14213D", height: HEADER_HEIGHT }}>
          <div className="mx-auto px-4 sm:px-6 py-2.5 flex items-center" style={{ maxWidth: 1200 }}>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <img src={LOGO_URL} alt="Survive Accounting" className="h-7 sm:h-8 object-contain shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <span className="text-[11px] sm:text-[12px] text-white/50 truncate">Created by Lee Ingram</span>
            </div>
          </div>
        </header>

        {/* ── Staging Banner ── */}
        <div className="w-full px-4 py-2 text-center text-[12px] sm:text-[13px] flex items-center justify-center gap-2 flex-wrap" style={{ background: "#FEF08A", color: "#1A1A1A" }}>
          <span className="font-bold">⚗ Staging Mode</span>
          <span>— This page is for testing only and may look different from the live version.</span>
          <a href={stagingMailto} className="font-bold underline hover:opacity-80" style={{ color: "#B45309" }}>Report Staging Issue →</a>
        </div>

        {/* Preview Countdown Banner */}
        {previewToken && tokenSession && tokenValidForAsset && (
          <div className="w-full text-center text-white font-bold text-[11px] sm:text-[13px] flex items-center justify-center gap-1 sm:gap-2 flex-wrap px-3 py-1.5 sm:py-0" style={{ background: "#CE1126", minHeight: 36 }}>
            {previewExpired ? (
              <>Your preview has expired — <a href={enrollUrl} target="_blank" rel="noopener noreferrer" className="underline font-bold hover:opacity-80">Get Full Access →</a></>
            ) : (
              <>
                <span className="truncate max-w-[180px] sm:max-w-none">🔓 Preview for {tokenSession.email}</span>
                <span className="whitespace-nowrap">— <span className="font-mono">{countdown}</span> · <a href={enrollUrl} target="_blank" rel="noopener noreferrer" className="underline font-bold hover:opacity-80">Get Full Access →</a></span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Hero Section */}
      <div className="relative" style={{ zIndex: 5 }}>
        <div className="mx-auto px-4 sm:px-6 mt-4" style={{ maxWidth: 1200 }}>
          <span className="inline-block text-[11px] px-3 py-1 rounded-full" style={{ background: t.badgeBg, border: `1px solid ${t.badgeBorder}`, color: t.badgeColor }}>✦ Deeper than a solutions manual — built from 10+ years of Ole Miss tutoring</span>
        </div>
        <div className="mt-3" style={{ background: "rgba(248,249,250,0.9)", borderBottom: `1px solid ${t.border}` }}>
          <div className="mx-auto px-4 sm:px-6 py-4" style={{ maxWidth: 1200 }}>
            <div className="min-w-0">
              <h1 className="text-[20px] font-bold leading-tight" style={{ color: "#131E35" }}>{courseDisplayName}</h1>
              {chapterLabel && <p className="text-[15px] font-medium mt-0.5" style={{ color: t.textMuted }}>{chapterLabel}</p>}
              {problemTitle && <p className="text-[12px] mt-0.5" style={{ color: t.textMuted }}>Topic: {problemTitle}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Bar */}
      <FloatingActionBar theme={t} shareUrl={shareUrl} assetCode={asset.asset_name} />

      {/* Two-Column Content */}
      <main className="relative mx-auto px-4 sm:px-6 py-6 sm:py-8" style={{ zIndex: 5, maxWidth: 1200 }}>
        <div className="flex flex-col lg:flex-row gap-0">

          {/* LEFT COLUMN */}
          <div className="w-full lg:w-[40%] lg:pr-6">
            <div className="lg:sticky overflow-y-auto" style={{ top: HEADER_HEIGHT + 16, maxHeight: `calc(100vh - ${HEADER_HEIGHT + 32}px)` }}>
              <div className="rounded-xl px-4 sm:px-6 py-5 sm:py-6" style={{ background: t.pageBg, boxShadow: "0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03)", border: `1px solid ${t.border}` }}>
                {sourceRef && (
                  <h2 className="text-[11px] font-bold tracking-[0.15em] uppercase pb-1 mb-3" style={{ color: t.heading, borderBottom: `1px solid ${t.border}` }}>
                    Practice problem based on {sourceRef}
                  </h2>
                )}

                {/* ── Dissector Highlight Toggle ── */}
                {hasDissectorData && (
                  <div className="mb-3">
                    <button
                      onClick={() => setDissectorHighlightsOn(!dissectorHighlightsOn)}
                      className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-bold transition-all"
                      style={{
                        background: dissectorHighlightsOn ? "#F59E0B" : "#FEF3C7",
                        color: dissectorHighlightsOn ? "#FFFFFF" : "#92400E",
                        border: dissectorHighlightsOn ? "1px solid #D97706" : "1px solid #FCD34D",
                        animation: dissectorHighlightsOn ? "none" : "highlight-pulse 2s ease-in-out infinite",
                      }}
                    >
                      {dissectorHighlightsOn ? "Hide Highlights ✕" : "✨ Try Highlights"}
                    </button>
                  </div>
                )}

                {/* No dissector data note */}
                {!hasDissectorData && data?.id && (
                  <p className="text-[11px] mb-3 px-2 py-1.5 rounded" style={{ color: t.textMuted, background: t.cardBg }}>
                    No highlight data available for this asset yet. Run the dissector generator to add highlights.
                  </p>
                )}

                {/* Problem text */}
                {rawProblemText.trim() && (
                  <div>
                    {hasHighlights && !dissectorHighlightsOn && (
                      <div className="flex items-center gap-2 mb-3">
                        <Switch checked={showHighlights} onCheckedChange={setShowHighlights} className="h-5 w-9" />
                        <span className="text-[12px]" style={{ color: t.textMuted }}>Show Highlights</span>
                      </div>
                    )}
                    {dissectorHighlightsOn && hasDissectorData ? (
                      <SmartContentWithDissector text={rawProblemText} className="text-[14px] leading-[1.7] space-y-4" theme={t} highlights={dissectorHighlights} />
                    ) : (
                      <SmartContent text={rawProblemText} className="text-[14px] leading-[1.7] space-y-4" theme={t} />
                    )}
                  </div>
                )}

                {/* Instructions */}
                {instructions.length > 0 && (
                  <>
                    <SectionHeading theme={t}>INSTRUCTIONS</SectionHeading>
                    <div className="space-y-4">
                      {instructions.map((inst, idx) => {
                        const letter = String.fromCharCode(97 + idx);
                        return (
                          <p key={idx} className="text-[14px] leading-[1.6]" style={{ color: t.text }}>
                            <span className="font-bold" style={{ color: "#131E35" }}>({letter})</span> {inst}
                          </p>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="hidden lg:block absolute top-0 bottom-0" style={{ right: 0, width: 1, background: t.border }} />
          </div>

          {/* RIGHT COLUMN */}
          <div className="w-full lg:w-[60%] lg:pl-6 mt-6 lg:mt-0">
            <div className="rounded-xl px-4 sm:px-6 py-5 sm:py-6" style={{ background: t.pageBg, boxShadow: "0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03)", border: `1px solid ${t.border}` }}>

              {/* 1. Solution */}
              {answerSummary.trim() && (
                <RevealToggle label="Reveal Solution" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} sectionName="Solution" assetCode={asset.asset_name} fullPassLink={fullPassLink} chapterLink={chapterLink} chapterNumber={chapterNum} forceOpen={allTogglesForceOpen}>
                  <AnswerSummarySection text={answerSummary} theme={t} instructions={asset._instructions} />
                </RevealToggle>
              )}

              {/* 2. How to Solve This */}
              {(asset._flowcharts?.length > 0 || asset.flowchart_image_url) && (
                <RevealToggle label="Reveal How to Solve This" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} sectionName="How to Solve This" assetCode={asset.asset_name} fullPassLink={fullPassLink} chapterLink={chapterLink} chapterNumber={chapterNum} forceOpen={allTogglesForceOpen}>
                  {asset._flowcharts?.length > 1 ? (
                    <div className="space-y-2">
                      {asset._flowcharts.map((fc: any) => {
                        const instr = (asset._instructions || []).find((ins: any) => ins.instruction_number === fc.instruction_number);
                        const letter = fc.instruction_label || String.fromCharCode(96 + fc.instruction_number);
                        const text = instr?.instruction_text || `Part ${letter}`;
                        return <FlowchartSubToggle key={fc.instruction_number} letter={letter} instructionText={text} imageUrl={fc.flowchart_image_url} theme={t} />;
                      })}
                    </div>
                  ) : asset._flowcharts?.length === 1 ? (
                    <img src={asset._flowcharts[0].flowchart_image_url} alt="How to Solve This" className="w-full rounded-lg" loading="lazy" />
                  ) : (
                    <img src={asset.flowchart_image_url} alt="How to Solve This" className="w-full rounded-lg" loading="lazy" />
                  )}
                </RevealToggle>
              )}

              {/* 3. Journal Entries */}
              {hasJE && (
                <RevealToggle label="Reveal Journal Entries" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} sectionName="Journal Entries" assetCode={asset.asset_name} fullPassLink={fullPassLink} chapterLink={chapterLink} chapterNumber={chapterNum} forceOpen={allTogglesForceOpen}>
                  {isPreview ? (
                    <JEPreviewTeaser jeData={jeData} jeBlock={jeBlock} hasCanonicalJE={!!hasCanonicalJE} theme={t} enrollUrl={enrollUrl} />
                  ) : hasCanonicalJE ? (
                    <CanonicalJESection data={typeof jeData === "string" ? JSON.parse(jeData) : jeData} theme={t} />
                  ) : (
                    <RawJEFallback text={jeBlock} theme={t} />
                  )}
                </RevealToggle>
              )}

              {/* 3b. Supplementary JEs */}
              {asset.supplementary_je_json && !hasJE && (
                <RevealToggle label="Reveal Related Journal Entries" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} sectionName="Related Journal Entries" assetCode={asset.asset_name} fullPassLink={fullPassLink} chapterLink={chapterLink} chapterNumber={chapterNum} forceOpen={allTogglesForceOpen}>
                  <SupplementaryJESection data={typeof asset.supplementary_je_json === "string" ? JSON.parse(asset.supplementary_je_json) : asset.supplementary_je_json} theme={t} />
                </RevealToggle>
              )}

              {/* 4. Important Formulas */}
              {formulas.trim() && (
                <RevealToggle label="Reveal Important Formulas" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} sectionName="Important Formulas" assetCode={asset.asset_name} fullPassLink={fullPassLink} chapterLink={chapterLink} chapterNumber={chapterNum} forceOpen={allTogglesForceOpen}>
                  <GroupedFormulas text={formulas} theme={t} />
                </RevealToggle>
              )}

              {/* 5. Key Concepts */}
              {conceptNotes.trim() && (
                <RevealToggle label="Reveal Key Concepts" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} sectionName="Key Concepts" assetCode={asset.asset_name} fullPassLink={fullPassLink} chapterLink={chapterLink} chapterNumber={chapterNum} forceOpen={allTogglesForceOpen}>
                  <ul className="space-y-3">
                    {splitLongBullets(conceptNotes).map((sentence: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-[13px] leading-[1.6]" style={{ color: t.text }}>
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#131E35" }} />
                        <span>{sentence}</span>
                      </li>
                    ))}
                  </ul>
                </RevealToggle>
              )}

              {/* 6. Exam Traps */}
              {examTraps.trim() && (
                <RevealToggle label="Reveal Exam Traps" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} sectionName="Exam Traps" assetCode={asset.asset_name} fullPassLink={fullPassLink} chapterLink={chapterLink} chapterNumber={chapterNum} forceOpen={allTogglesForceOpen}>
                  <div className="rounded-md p-4 pl-5 border-l-[3px]" style={{ background: t.trapBg, borderColor: t.trapBorder }}>
                    <ul className="space-y-3">
                      {parseExamTraps(examTraps).map((trap: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] leading-[1.6]" style={{ color: "#C0392B" }}>
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#C0392B" }} />
                          <span>{trap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </RevealToggle>
              )}
            </div>
          </div>
        </div>
      </main>

      <ReportIssueModal open={reportOpen} onOpenChange={setReportOpen} asset={asset} />
    </div>
  );
}
