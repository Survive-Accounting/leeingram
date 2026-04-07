import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { isAllowedEmail } from "@/lib/emailWhitelist";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Lock, Unlock, Copy, AlertTriangle, ChevronDown, ChevronUp, X, CheckCircle, Calendar, Share2, Wrench, Loader2, Sparkles, Edit3, Menu } from "lucide-react";
import { QAEditButton, QAInlineEditorPanel, QAInstructionsEditor } from "@/components/QAInlineEditor";
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

// ── Numbered-amount list detection ──────────────────────────────────
// Matches lines like "1. Investment in common stock... $1,500,000. ..."
const NUMBERED_AMOUNT_RE = /^(\d+)\.\s+(.+?)\$\s*([\d,]+(?:\.\d+)?)/;

function isNumberedAmountLine(line: string): boolean {
  return NUMBERED_AMOUNT_RE.test(line.trim());
}

function parseNumberedAmountBlock(lines: string[]): { description: string; amount: string; extra: string }[] {
  return lines.filter(l => l.trim()).map(l => {
    const m = l.trim().match(NUMBERED_AMOUNT_RE);
    if (!m) return { description: l.trim(), amount: "", extra: "" };
    const rawDesc = m[2].trim();
    // Remove trailing colon/period from the description before the amount
    const description = rawDesc.replace(/[:.]\s*$/, "").trim();
    const amount = `$${m[3]}`;
    // Anything after the dollar amount
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
  return lines
    .filter(l => l.trim())
    .map(l => {
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
      // Detect 2+ consecutive numbered lines with dollar amounts
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
        if (kvLines.length >= 2) {
          segments.push({ type: "kv-table", content: kvLines.join("\n"), rows: parseKVBlock(kvLines) });
        } else {
          segments.push({ type: "text", content: kvLines.join("\n") });
        }
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

// ── Split long text ─────────────────────────────────────────────────

function splitLongText(text: string): string[] {
  if (text.length <= 400) return [text];
  const mid = Math.floor(text.length / 2);
  const lower = Math.floor(text.length * 0.4);
  const upper = Math.floor(text.length * 0.6);
  let bestIdx = -1;
  let bestDist = Infinity;
  let idx = text.indexOf(". ", lower);
  while (idx !== -1 && idx <= upper) {
    const dist = Math.abs(idx - mid);
    if (dist < bestDist) { bestDist = dist; bestIdx = idx; }
    idx = text.indexOf(". ", idx + 1);
  }
  if (bestIdx !== -1) return [text.slice(0, bestIdx + 1), text.slice(bestIdx + 2)];
  const spaceIdx = text.lastIndexOf(" ", mid);
  if (spaceIdx > 0) return [text.slice(0, spaceIdx), text.slice(spaceIdx + 1)];
  return [text];
}

// ── Dissector Highlight Types ───────────────────────────────────────

interface DissectorHighlight {
  text: string;
  label: string;
  category: string;
  color: string;
}

function DissectorHighlightedText({ text, highlights, theme }: { text: string; highlights: DissectorHighlight[]; theme: Theme }) {
  // Build segments by finding highlight matches in text
  const segments = useMemo(() => {
    if (!highlights.length) return [{ text, highlight: null as DissectorHighlight | null }];
    const matches: { start: number; end: number; highlight: DissectorHighlight }[] = [];
    for (const h of highlights) {
      const idx = text.indexOf(h.text);
      if (idx !== -1) matches.push({ start: idx, end: idx + h.text.length, highlight: h });
    }
    matches.sort((a, b) => a.start - b.start);
    // Remove overlaps
    const clean: typeof matches = [];
    for (const m of matches) {
      if (!clean.length || m.start >= clean[clean.length - 1].end) clean.push(m);
    }
    const result: { text: string; highlight: DissectorHighlight | null }[] = [];
    let pos = 0;
    for (const m of clean) {
      if (m.start > pos) result.push({ text: text.slice(pos, m.start), highlight: null });
      result.push({ text: text.slice(m.start, m.end), highlight: m.highlight });
      pos = m.end;
    }
    if (pos < text.length) result.push({ text: text.slice(pos), highlight: null });
    return result;
  }, [text, highlights]);

  return (
    <p className="whitespace-pre-wrap">
      {segments.map((seg, i) =>
        seg.highlight ? (
          <DissectorTooltipSpan key={i} text={seg.text} highlight={seg.highlight} />
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </p>
  );
}

function DissectorTooltipSpan({ text, highlight }: { text: string; highlight: DissectorHighlight }) {
  const [show, setShow] = useState(false);
  const spanRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; showBelow: boolean; arrowLeft: number } | null>(null);

  const handleEnter = useCallback(() => {
    if (spanRef.current) {
      const rect = spanRef.current.getBoundingClientRect();
      const tooltipWidth = 260;
      const viewportWidth = window.innerWidth;
      const showBelow = rect.top < 120;

      let left = rect.left + rect.width / 2 - tooltipWidth / 2;
      left = Math.max(12, Math.min(left, viewportWidth - tooltipWidth - 12));

      let arrowLeft = rect.left + rect.width / 2 - left;
      arrowLeft = Math.max(12, Math.min(arrowLeft, tooltipWidth - 12));

      const top = showBelow
        ? rect.bottom + 8
        : rect.top - 8;

      setPos({ left, top, showBelow, arrowLeft });
    }
    setShow(true);
  }, []);

  return (
    <span
      ref={spanRef}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
      style={{
        background: "#fef9c3",
        borderBottom: "2px solid #ca8a04",
        borderRadius: 2,
        padding: "0 2px",
        cursor: "help",
        display: "inline",
      }}
    >
      {text}
      {show && pos && (
        <span
          style={{
            position: "fixed",
            left: pos.left,
            ...(pos.showBelow ? { top: pos.top } : { bottom: window.innerHeight - pos.top }),
            background: "#1e293b",
            color: "#ffffff",
            fontSize: 12,
            lineHeight: 1.5,
            padding: "8px 12px",
            borderRadius: 6,
            width: 260,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            zIndex: 9999,
            pointerEvents: "none" as const,
            textAlign: "left" as const,
            whiteSpace: "normal" as const,
            fontWeight: "normal" as const,
          }}
        >
          <span style={{ display: "block", fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, color: "rgba(255,255,255,0.5)", marginBottom: 4, letterSpacing: "0.08em" }}>
            WHY THIS MATTERS
          </span>
          <span style={{ display: "block" }}>{highlight.label}</span>
          {/* Arrow */}
          <span
            style={{
              position: "absolute",
              left: pos.arrowLeft,
              transform: "translateX(-50%)",
              ...(pos.showBelow
                ? { bottom: "100%", borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: "6px solid #1e293b" }
                : { top: "100%", borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "6px solid #1e293b" }),
              width: 0,
              height: 0,
            }}
          />
        </span>
      )}
    </span>
  );
}

/** Detect repeated leading verb phrases across instruction parts and deduplicate */
function deduplicateInstructions(instructions: string[]): { sharedPrefix: string | null; parts: string[] } {
  if (instructions.length < 2) return { sharedPrefix: null, parts: instructions };

  const extractPrefix = (text: string): string => {
    const m = text.match(/^((?:Prepare|Record|Calculate|Compute|Determine|Journalize|Make|Write)\b.*?\b(?:to record|to|for|of))\b/i);
    if (m) return m[1].trim();
    const m2 = text.match(/^(.+?\bto\s+\w+)\b/i);
    if (m2 && m2[1].length < text.length * 0.7) return m2[1].trim();
    return "";
  };

  const prefixes = instructions.map(extractPrefix);
  const nonEmpty = prefixes.filter(p => p.length > 0);
  if (nonEmpty.length < 2) return { sharedPrefix: null, parts: instructions };

  const normalized = nonEmpty[0].toLowerCase();
  const allMatch = nonEmpty.every(p => p.toLowerCase() === normalized);
  if (!allMatch) return { sharedPrefix: null, parts: instructions };

  const shared = nonEmpty[0];
  const stripped = instructions.map((inst, i) => {
    if (!prefixes[i]) return inst;
    let remainder = inst.slice(prefixes[i].length).trim();
    remainder = remainder.replace(/^the\s+/i, "");
    return remainder;
  });

  const displayPrefix = shared.replace(/\s+(to|for|of)$/i, " $1") + ":";
  return { sharedPrefix: displayPrefix, parts: stripped };
}


function SectionHeading({ children, theme }: { children: React.ReactNode; theme: Theme }) {
  return (
    <h2 className="text-[11px] font-bold tracking-[0.15em] uppercase pb-1 mb-3 mt-8" style={{ color: theme.heading, borderBottom: `1px solid ${theme.border}` }}>
      {children}
    </h2>
  );
}

// ── Reveal Toggle ───────────────────────────────────────────────────

// ── Tiered Paywall Card ──────────────────────────────────────────────

function TieredPaywallCard({
  theme,
  enrollUrl,
  fullPassLink,
  chapterLink,
  chapterNumber,
  onBuyClick,
}: {
  theme: Theme;
  enrollUrl: string;
  fullPassLink?: { label: string; price_cents: number; original_price_cents?: number | null; sale_label?: string | null; sale_expires_at?: string | null; url: string } | null;
  chapterLink?: { label: string; price_cents: number; url: string } | null;
  chapterNumber?: number | null;
  onBuyClick?: () => void;
}) {
  const now = new Date();
  const saleActive = fullPassLink?.sale_expires_at
    ? now < new Date(fullPassLink.sale_expires_at)
    : false;

  const fullPassUrl = fullPassLink?.url || enrollUrl;
  const chapterUrl = chapterLink?.url || enrollUrl;

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: "#FFFBF0" }}>
      {/* Lock icon + text */}
      <div className="text-center mb-2">
        <Lock className="h-6 w-6 mx-auto mb-2" style={{ color: "#14213D" }} />
        <p className="text-[15px] font-bold" style={{ color: "#14213D" }}>
          Unlock with a Study Pass to reveal this section
        </p>
      </div>

      {/* Option 1 — Full Pass (navy card) */}
      <div
        className="relative rounded-xl px-6 py-6"
        style={{
          background: "#14213D",
          border: "2px solid rgba(212,175,55,0.5)",
          boxShadow: "0 4px 24px rgba(20,33,61,0.25), 0 0 0 1px rgba(212,175,55,0.15)",
        }}
      >
        <span
          className="absolute top-0 right-0 text-[10px] font-bold px-3 py-1.5 rounded-bl-xl rounded-tr-xl"
          style={{ background: "#CE1126", color: "#FFFFFF" }}
        >
          Best Value
        </span>
        <p className="font-bold text-[16px] text-white">
          Full Study Pass — Intermediate Accounting 2
        </p>
        <div className="flex items-baseline gap-2 mt-2">
          {saleActive && fullPassLink?.original_price_cents && (
            <span className="line-through text-[14px]" style={{ color: "rgba(255,255,255,0.45)" }}>
              {formatPrice(fullPassLink.original_price_cents)}
            </span>
          )}
          <span className="font-bold text-[24px] text-white">
            {formatPrice(fullPassLink?.price_cents || 12500)}
          </span>
          {saleActive && fullPassLink?.sale_label && (
            <span className="text-[12px] font-semibold" style={{ color: "#00FFFF" }}>
              · {fullPassLink.sale_label}
            </span>
          )}
        </div>
        <a
          href={fullPassUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onBuyClick?.()}
          className="block w-full mt-4 px-6 py-3 rounded-lg font-bold text-[15px] text-center text-white transition-all hover:brightness-90 active:scale-[0.98]"
          style={{ background: "#CE1126", height: 48, lineHeight: "24px" }}
        >
          Get Full Access →
        </a>
        <p className="text-[11px] mt-3 text-center" style={{ color: "rgba(255,255,255,0.55)" }}>
          7-day refund policy · Covers Ch 13–22 · Access expires after finals
        </p>
      </div>

      {/* Option 2 — Chapter Only (white card) */}
      {chapterNumber && (
        <div
          className="rounded-xl px-6 py-5"
          style={{
            border: `1px solid ${theme.border}`,
            background: theme.pageBg,
          }}
        >
          <p className="font-bold text-[15px]" style={{ color: theme.text }}>
            Chapter {chapterNumber} Only
          </p>
          <p className="font-bold text-[22px] mt-1" style={{ color: theme.text }}>
            {formatPrice(chapterLink?.price_cents || 3000)}
          </p>
          <a
            href={chapterUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onBuyClick?.()}
            className="block w-full mt-3 px-6 py-3 rounded-lg font-bold text-[15px] text-center text-white transition-all hover:brightness-90 active:scale-[0.98]"
            style={{ background: "#006BA6", height: 48, lineHeight: "24px" }}
          >
            Buy Chapter {chapterNumber} →
          </a>
          <p className="text-[11px] mt-2.5 text-center" style={{ color: theme.textMuted }}>
            Covers Ch {chapterNumber} only · Access expires after finals
          </p>
        </div>
      )}
    </div>
  );
}

// ── Reveal Toggle ───────────────────────────────────────────────────

function RevealToggle({
  label,
  children,
  theme,
  isPreview,
  enrollUrl,
  sectionName,
  assetCode,
  extraFooterLeft,
  fullPassLink,
  chapterLink,
  chapterNumber,
  forceOpen,
  onReveal,
  onBuyClick,
  onReportClick,
}: {
  label: string;
  children: React.ReactNode;
  theme: Theme;
  isPreview: boolean;
  enrollUrl: string;
  sectionName?: string;
  assetCode?: string;
  extraFooterLeft?: React.ReactNode;
  fullPassLink?: any;
  chapterLink?: any;
  chapterNumber?: number | null;
  forceOpen?: boolean;
  onReveal?: (sectionName: string) => void;
  onBuyClick?: () => void;
  onReportClick?: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const hasReportLink = !!(sectionName && assetCode);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && sectionName && onReveal) {
      onReveal(sectionName);
    }
  };

  const shortLabel = label.replace("Reveal ", "");

  return (
    <div
      className="rounded-lg mt-4 overflow-hidden transition-all"
      style={{
        background: isPreview ? theme.toggleBg : (open ? "#ffffff" : "#f8fafc"),
        border: `1px solid ${isPreview ? theme.border : "#e2e8f0"}`,
      }}
    >
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 text-left transition-colors"
        style={{ color: isPreview ? theme.textMuted : "#14213D" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = isPreview ? theme.cardBg : "#f1f5f9"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <span className="flex items-center gap-2" style={{ fontSize: isPreview ? 13 : 14, fontWeight: isPreview ? 400 : 600 }}>
          {isPreview && (open ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />)}
          {isPreview ? label : shortLabel}
        </span>
        <ChevronDown
          className="h-4 w-4 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)", color: isPreview ? theme.textMuted : "#94a3b8" }}
        />
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-4 pt-3" style={{ borderTop: `1px solid ${isPreview ? theme.border : "#e2e8f0"}` }}>
          {isPreview ? (
            <TieredPaywallCard
              theme={theme}
              enrollUrl={enrollUrl}
              fullPassLink={fullPassLink}
              chapterLink={chapterLink}
              chapterNumber={chapterNumber}
              onBuyClick={onBuyClick}
            />
          ) : (
            <>
              {children}
              {(hasReportLink || extraFooterLeft) && (
                <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: `1px solid ${theme.border}` }}>
                  <div>{extraFooterLeft || null}</div>
                  {hasReportLink ? (
                    <button
                      onClick={onReportClick}
                      className="flex items-center gap-1.5 text-[12px] hover:underline"
                      style={{ color: theme.textMuted, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Report an issue with this section →
                    </button>
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

function JETable({ entries, theme, scenarioLabel }: { entries: any[]; theme: Theme; scenarioLabel?: string }) {
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

function CanonicalJESection({ data, theme, instructions }: { data: CanonicalJEPayload; theme: Theme; instructions?: { instruction_number: number; instruction_text: string }[] }) {
  const hasMultipleScenarios = data.scenario_sections.length > 1;
  return (
    <div className="space-y-6">
      {data.scenario_sections.map((section, si) => {
        // Try to extract a meaningful label from matched instruction
        let displayLabel = section.label;
        if (hasMultipleScenarios && instructions) {
          const partMatch = section.label.match(/^Part\s+([a-z])/i);
          if (partMatch) {
            const letterIndex = partMatch[1].toLowerCase().charCodeAt(0) - 96;
            const matchedInstr = instructions.find(ins => ins.instruction_number === letterIndex);
            if (matchedInstr) {
              const extracted = extractJEPartLabel(matchedInstr.instruction_text);
              if (extracted) displayLabel = extracted;
            }
          }
        }
        return (
          <div key={si}>
            {hasMultipleScenarios && !section.entries_by_date?.some((e: any) => (e.entry_date || e.date) && e.memo) && (
              <p className="font-bold text-[13px] mb-2 pb-1" style={{ color: theme.text, borderBottom: `1px solid ${theme.border}` }}>
                {displayLabel}
              </p>
            )}
            <JETable entries={section.entries_by_date} theme={theme} scenarioLabel={section.label} />
          </div>
        );
      })}
    </div>
  );
}

function RawJEFallback({ text, theme }: { text: string; theme: Theme }) {
  const lines = text.split("\n");
  const rows: { account: string; debit: string; credit: string; isDate: boolean; isCredit: boolean }[] = [];
  const dateRe = /(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)/i;
  const amountRe = /([\d,]+(?:\.\d+)?)\s*$/;
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

// ── Inline JE detection helpers ──────────────────────────────────────

interface InlineJERow {
  side: "debit" | "credit";
  account: string;
  amount: string;
}

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
        <thead>
          <tr style={{ background: theme.tableHeaderBg }}>
            <th style={{ color: "#fff", padding: "6px 10px", textAlign: "left", fontWeight: 600 }}>Account</th>
            <th style={{ color: "#fff", padding: "6px 10px", textAlign: "right", fontWeight: 600, width: 90 }}>Debit</th>
            <th style={{ color: "#fff", padding: "6px 10px", textAlign: "right", fontWeight: 600, width: 90 }}>Credit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? theme.tableAltBg : "transparent" }}>
              <td style={{ padding: "5px 10px", paddingLeft: row.side === "credit" ? 30 : 10, color: theme.text }}>
                {row.account}
              </td>
              <td style={{ padding: "5px 10px", textAlign: "right", color: theme.text }}>
                {row.side === "debit" ? row.amount : ""}
              </td>
              <td style={{ padding: "5px 10px", textAlign: "right", color: theme.text }}>
                {row.side === "credit" ? row.amount : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── JE-only detection helpers ────────────────────────────────────────

const JE_ONLY_PATTERNS = [
  /^prepare\s+the\s+journal\s+entr(?:y|ies)\s+to\s+record/i,
  /^prepare\s+journal\s+entries\s+to\s+record/i,
  /^prepare\s+journal\s+entries\s+for/i,
  /^record\s+the\s+journal\s+entr(?:y|ies)/i,
  /^record\s+journal\s+entries/i,
  /^journalize/i,
  /^prepare\s+the\s+entr(?:y|ies)\s+to\s+record/i,
];

const JE_STRIP_PATTERNS = [
  /^prepare\s+the\s+journal\s+entr(?:y|ies)\s+to\s+record\s*/i,
  /^prepare\s+journal\s+entries\s+to\s+record\s*/i,
  /^prepare\s+journal\s+entries\s+for\s*/i,
  /^record\s+the\s+journal\s+entr(?:y|ies)\s+(?:to\s+record\s+|for\s+)?/i,
  /^record\s+journal\s+entries\s+(?:to\s+record\s+|for\s+)?/i,
  /^journalize\s*/i,
  /^prepare\s+the\s+entr(?:y|ies)\s+to\s+record\s*/i,
];

function detectJEOnly(instructions?: { instruction_number: number; instruction_text: string }[]): boolean {
  if (!instructions || instructions.length === 0) return false;
  return instructions.every(instr => {
    const text = instr.instruction_text.trim();
    return JE_ONLY_PATTERNS.some(p => p.test(text));
  });
}

function extractJEPartLabel(instructionText: string): string {
  let text = instructionText.trim();
  for (const pattern of JE_STRIP_PATTERNS) {
    text = text.replace(pattern, "");
  }
  text = text.replace(/\.\s*$/, "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Check if a line contains calculation content */
function isCalculationLine(line: string): boolean {
  return /[×=÷+−%$]/.test(line) || /\b\d+\s*[×x*]\s*\d/i.test(line) || /\b\d+\s*[/÷]\s*\d/.test(line) || /×\s*rate|×\s*time|[/÷]\s*periods/i.test(line);
}

/** Render inline **bold** markdown as <strong> elements */
function renderBoldMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// ── Answer Summary ──────────────────────────────────────────────────

function AnswerSummarySection({ text, theme, instructions, isJEOnly }: { text: string; theme: Theme; instructions?: { instruction_number: number; instruction_text: string }[]; isJEOnly?: boolean }) {
  const subSections = text.split(/(?=\([a-z]\))/i).filter(s => s.trim());
  return (
    <div className="rounded-md p-4 pl-5 border-l-[3px] break-words overflow-hidden" style={{ background: theme.answerBg, borderColor: theme.answerBorder }}>
      {subSections.map((section, si) => {
        const labelMatch = section.match(/^\(([a-z])\)\s*(.*)/i);
        const letterIndex = labelMatch ? labelMatch[1].toLowerCase().charCodeAt(0) - 96 : 0;
        const matchedInstruction = labelMatch && instructions?.find(i => i.instruction_number === letterIndex);

        // Extract content lines (everything after the (x) label line)
        const rawContent = labelMatch ? section.slice(labelMatch[0].split("\n")[0].length) : section;
        let contentLines = rawContent.split("\n");

        // Build label — if labelMatch[2] is empty (letter on its own line), pull first content line
        let labelSuffix = labelMatch?.[2]?.split("\n")[0]?.trim() || "";
        if (labelMatch && !labelSuffix && !matchedInstruction) {
          const firstNonEmpty = contentLines.findIndex(l => l.trim());
          if (firstNonEmpty >= 0) {
            labelSuffix = contentLines[firstNonEmpty].trim();
            contentLines = [...contentLines.slice(0, firstNonEmpty), ...contentLines.slice(firstNonEmpty + 1)];
          }
        }
        const label = labelMatch
          ? matchedInstruction
            ? `(${labelMatch[1]}) ${matchedInstruction.instruction_text}`
            : `(${labelMatch[1]}) ${labelSuffix}`
          : null;

        // For JE-only problems, filter to calculation lines only
        if (isJEOnly) {
          contentLines = contentLines.filter(l => isCalculationLine(l.trim()));
        }

        // Group lines into segments: plain text vs inline JE blocks
        type TextSeg = { type: "text"; lines: { text: string; idx: number }[] };
        type JESeg = { type: "je"; rows: InlineJERow[]; heading?: string };
        type Seg = TextSeg | JESeg;
        let i = 0;
        const segs: Seg[] = [];

        while (i < contentLines.length) {
          // Empty lines become paragraph break markers
          if (!contentLines[i].trim()) {
            const lastSeg = segs[segs.length - 1];
            if (lastSeg && lastSeg.type === "text") {
              lastSeg.lines.push({ text: "", idx: i });
            } else {
              segs.push({ type: "text", lines: [{ text: "", idx: i }] });
            }
            i++;
            continue;
          }
          const parsed = parseInlineJELine(contentLines[i]);
          if (parsed) {
            // Check if previous line is a JE label heading
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
            // Collect consecutive debit/credit lines
            const jeRows: InlineJERow[] = [parsed];
            i++;
            while (i < contentLines.length) {
              const next = parseInlineJELine(contentLines[i]);
              if (next) { jeRows.push(next); i++; } else break;
            }
            segs.push({ type: "je", rows: jeRows, heading });
          } else {
            const lastSeg = segs[segs.length - 1];
            if (lastSeg && lastSeg.type === "text") {
              lastSeg.lines.push({ text: contentLines[i], idx: i });
            } else {
              segs.push({ type: "text", lines: [{ text: contentLines[i], idx: i }] });
            }
            i++;
          }
        }

        // For JE-only, skip rendering if no calculation content remains
        if (isJEOnly && segs.every(s => s.type === "text" && s.lines.length === 0)) return null;

        return (
          <div key={si}>
            {si > 0 && <div className="my-3" style={{ borderTop: `1px solid ${theme.border}` }} />}
            {label && <p className="font-bold text-[14px]" style={{ color: theme.text, marginTop: si > 0 ? 16 : 0, marginBottom: 8 }}>{label}</p>}
            {segs.map((seg, segIdx) => {
              if (seg.type === "je") {
                // For JE-only problems, skip inline JE in explanation (they're in the JE accordion)
                if (isJEOnly) return null;
                return <InlineJETable key={`je-${segIdx}`} rows={seg.rows} heading={seg.heading} theme={theme} />;
              }
              return seg.lines.map((line) => {
                const trimmed = line.text.trim();
                // Empty line = paragraph break spacer
                if (!trimmed) {
                  return <div key={`spacer-${line.idx}`} className="h-3" />;
                }
                const isYearLabel = /^\d{4}\s*:/.test(trimmed);
                const isNumberedStep = /^\d+\.\s/.test(trimmed);
                if (isJEOnly) {
                  return <p key={line.idx} className="text-[13px] font-mono font-semibold ml-2 sm:ml-4 mb-1 leading-[1.6] break-words" style={{ color: theme.text }}>{renderBoldMarkdown(trimmed)}</p>;
                }
                if (isYearLabel) {
                  return <p key={line.idx} className="font-bold text-[13px]" style={{ color: theme.text, marginTop: 10, marginBottom: 4 }}>{renderBoldMarkdown(trimmed)}</p>;
                }
                if (isNumberedStep) {
                  return <p key={line.idx} className="font-semibold text-[13px] ml-2 sm:ml-4 mb-1 leading-[1.6] break-words" style={{ color: theme.text, marginTop: 14 }}>{renderBoldMarkdown(trimmed)}</p>;
                }
                return <p key={line.idx} className="text-[13px] ml-2 sm:ml-4 mb-1 leading-[1.6] break-words" style={{ color: theme.text }}>{renderBoldMarkdown(trimmed)}</p>;
              });
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Report Issue Modal ──────────────────────────────────────────────

const ISSUE_TYPES = [
  "Something looks wrong in the solution",
  "Numbers don't match my textbook",
  "Journal entry question",
  "Missing content",
  "Other",
];

function ReportIssueModal({ open, onClose, asset, isAdmin = false }: { open: boolean; onClose: () => void; asset: any; isAdmin?: boolean }) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [name, setName] = useState("");
  const [issueType, setIssueType] = useState(ISSUE_TYPES[0]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Pre-fill admin email for name
  useEffect(() => {
    if (isAdmin) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.email && !name) setName(session.user.email);
      });
    }
  }, [isAdmin]);

  const chapter = (asset as any)?.chapters;
  const course = (asset as any)?.courses;
  const chapterNum = chapter?.chapter_number || null;
  const chapterName = chapter?.chapter_name || "";
  const courseName = (() => {
    const code = (course?.code || "").toUpperCase();
    if (code === "IA2") return "Intermediate Accounting 2";
    if (code === "IA1") return "Intermediate Accounting 1";
    if (code === "MA2") return "Managerial Accounting";
    if (code === "FA1") return "Financial Accounting";
    return course?.course_name || code;
  })();

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!isAllowedEmail(trimmedEmail)) {
      setEmailError("Please use your .edu school email address.");
      return;
    }
    setEmailError("");
    if (!message.trim()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await (supabase as any).from("chapter_questions").insert({
        chapter_id: asset.chapter_id,
        student_email: email.trim(),
        student_name: name.trim() || null,
        question: message.trim(),
        issue_type: "issue",
        asset_name: asset.asset_name,
        source_ref: asset.source_ref,
        status: "new",
      });
      supabase.functions.invoke("send-issue-report", {
        body: {
          student_email: email.trim(),
          message: message.trim(),
          issue_type_label: issueType,
          asset_name: asset.asset_name,
          source_ref: asset.source_ref,
          problem_title: asset._problemTitle || asset.problem_title || "",
          course_name: courseName,
          chapter_number: chapterNum,
          chapter_name: chapterName,
        },
      }).catch(() => {});
      setSent(true);
    } catch {
      setSubmitError("Something went wrong — email lee@surviveaccounting.com directly");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100 }}
      />
      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          background: "#ffffff",
          borderRadius: 12,
          padding: 24,
          width: "min(480px, 90vw)",
          maxHeight: "90vh",
          overflowY: "auto",
          zIndex: 101,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-[16px] font-bold" style={{ color: "#14213D" }}>Report an Issue</p>
          <button onClick={onClose} style={{ color: "#94a3b8", background: "none", border: "none", cursor: "pointer", fontSize: 24, lineHeight: 1 }}>×</button>
        </div>

        {sent ? (
          <div className="text-center py-6">
            <CheckCircle className="h-6 w-6 mx-auto" style={{ color: "#22c55e" }} />
            <p className="text-[16px] font-bold mt-3" style={{ color: "#14213D" }}>Thanks for flagging this!</p>
            <p className="text-[13px] mt-1.5" style={{ color: "#64748b" }}>I'll look into it and reply to {email} if I need more info.</p>
            <p className="text-[13px] italic mt-1" style={{ color: "#14213D" }}>— Lee</p>
            <button
              onClick={onClose}
              className="w-full text-[14px] font-semibold text-white mt-4"
              style={{ background: "#14213D", borderRadius: 8, padding: 12, border: "none", cursor: "pointer" }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Asset context banner */}
            <div className="mb-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px" }}>
              <p className="text-[12px]" style={{ color: "#64748b" }}>
                Problem: <strong>{asset.source_ref}</strong>
                {(asset._problemTitle || asset.problem_title) && <><br />{asset._problemTitle || asset.problem_title}</>}
                <br />Course: {courseName}
                <br />Chapter: Ch {chapterNum || "?"} — {chapterName}
              </p>
            </div>

            {/* Email */}
            <div className="mb-3">
              <label className="text-[12px] font-semibold block mb-1" style={{ color: "#14213D" }}>Your .edu email</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailError(""); setSubmitError(""); }}
                placeholder="your@university.edu"
                className="w-full outline-none transition-colors"
                style={{ border: `1px solid ${emailError ? "#dc2626" : "#e2e8f0"}`, borderRadius: 8, padding: "10px 14px", fontSize: 14 }}
                onFocus={e => e.target.style.borderColor = emailError ? "#dc2626" : "#14213D"}
                onBlur={e => e.target.style.borderColor = emailError ? "#dc2626" : "#e2e8f0"}
              />
              {emailError && <p className="text-[12px] mt-1" style={{ color: "#dc2626" }}>{emailError}</p>}
            </div>

            {/* Name (optional) */}
            <div className="mb-3">
              <label className="text-[12px] font-semibold block mb-1" style={{ color: "#14213D" }}>Your name (optional)</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. King, or leave blank"
                className="w-full outline-none transition-colors"
                style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 14 }}
                onFocus={e => e.target.style.borderColor = "#14213D"}
                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
              />
            </div>

            {/* Issue type */}
            <div className="mb-3">
              <label className="text-[12px] font-semibold block mb-1" style={{ color: "#14213D" }}>What kind of issue?</label>
              <select
                value={issueType}
                onChange={e => setIssueType(e.target.value)}
                className="w-full outline-none"
                style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 14, background: "#fff" }}
              >
                {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Message */}
            <div className="mb-3">
              <label className="text-[12px] font-semibold block mb-1" style={{ color: "#14213D" }}>Describe the issue</label>
              <textarea
                value={message}
                onChange={e => { setMessage(e.target.value); setSubmitError(""); }}
                placeholder="Describe what looks wrong or what you're confused about..."
                rows={4}
                className="w-full outline-none"
                style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 14, resize: "vertical" }}
                onFocus={e => e.target.style.borderColor = "#14213D"}
                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
              />
            </div>

            {/* Submit */}
            <button
              disabled={submitting || !email.trim() || !message.trim()}
              onClick={handleSubmit}
              className="w-full text-[14px] font-semibold text-white transition-all hover:brightness-95 active:scale-[0.98]"
              style={{
                background: "#14213D",
                borderRadius: 8,
                padding: 12,
                cursor: submitting ? "wait" : "pointer",
                opacity: (submitting || !email.trim() || !message.trim()) ? 0.6 : 1,
                border: "none",
              }}
            >
              {submitting ? "Sending..." : "Submit Report →"}
            </button>
            {submitError && <p className="text-[12px] mt-2" style={{ color: "#dc2626" }}>{submitError}</p>}
          </>
        )}
      </div>
    </>
  );
}

// ── Browse Problems Bar (preview only, native selects) ──────────────

const COURSE_OPTIONS = [
  { code: "FA1", label: "Financial Accounting" },
  { code: "MA2", label: "Managerial Accounting" },
  { code: "IA1", label: "Intermediate 1" },
  { code: "IA2", label: "Intermediate 2" },
];

function BrowseProblemsBar({ currentAsset, theme }: { currentAsset: any; theme: Theme }) {
  const navigate = useNavigate();
  const currentCourseCode = currentAsset.courses?.code || "IA2";
  const currentChapterId = currentAsset.chapter_id;
  const currentType = (() => {
    const ref = (currentAsset.source_ref || "").toUpperCase();
    if (ref.startsWith("BE")) return "BE";
    if (ref.startsWith("P")) return "P";
    if (ref.startsWith("E")) return "E";
    return "all";
  })();

  const [selectedCourse, setSelectedCourse] = useState(currentCourseCode);
  const [selectedChapterId, setSelectedChapterId] = useState(currentChapterId || "");
  const [selectedType, setSelectedType] = useState(currentType);
  const [selectedSourceCode, setSelectedSourceCode] = useState(currentAsset.source_ref || "");

  // Sync course dropdown when navigating to a different asset
  useEffect(() => {
    setSelectedCourse(currentCourseCode);
    setSelectedChapterId(currentChapterId || "");
    setSelectedSourceCode(currentAsset.source_ref || "");
  }, [currentCourseCode, currentChapterId, currentAsset.source_ref]);

  const { data: chapters } = useQuery({
    queryKey: ["browse-chapters-nav-solutions", selectedCourse],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, courses!chapters_course_id_fkey(code)")
        .order("chapter_number");
      return (data || []).filter((c: any) => c.courses?.code === selectedCourse);
    },
  });

  useEffect(() => {
    if (selectedCourse !== currentCourseCode) {
      setSelectedChapterId("");
      setSelectedSourceCode("");
    }
  }, [selectedCourse, currentCourseCode]);

  const { data: chapterAssets } = useQuery({
    queryKey: ["nav-assets-solutions", selectedChapterId, selectedType],
    queryFn: async () => {
      if (!selectedChapterId) return [] as any[];

      const { data: approvedAssets } = await supabase
        .from("teaching_assets")
        .select("asset_name, source_ref")
        .eq("chapter_id", selectedChapterId)
        .not("asset_approved_at", "is", null)
        .order("source_ref");

      const { data: chapterProblems } = await supabase
        .from("chapter_problems")
        .select("source_code, source_label")
        .eq("chapter_id", selectedChapterId)
        .order("source_code");

      const approved = approvedAssets || [];
      const labelsByCode = new Map((chapterProblems || []).map((p: any) => [p.source_code, p.source_label]));

      let filtered = approved;
      if (selectedType !== "all") {
        filtered = filtered.filter((a: any) => {
          const ref = (a.source_ref || "").toUpperCase();
          if (selectedType === "BE") return ref.startsWith("BE");
          if (selectedType === "E") return ref.startsWith("E") && !ref.startsWith("EX");
          if (selectedType === "P") return ref.startsWith("P");
          return true;
        });
      }

      return filtered.map((a: any) => ({
        asset_name: a.asset_name,
        source_ref: a.source_ref,
        source_label: labelsByCode.get(a.source_ref) || a.source_ref,
      })).sort((a: any, b: any) => naturalSortRef(a.source_ref, b.source_ref));
    },
    enabled: !!selectedChapterId,
  });

  useEffect(() => {
    if (!chapterAssets?.length) {
      setSelectedSourceCode("");
      return;
    }
    const stillExists = chapterAssets.some((a: any) => a.source_ref === selectedSourceCode);
    if (!stillExists) {
      setSelectedSourceCode(chapterAssets[0].source_ref);
    }
  }, [chapterAssets, selectedSourceCode]);

  const handleGo = () => {
    const match = chapterAssets?.find((a: any) => a.source_ref === selectedSourceCode);
    if (match?.asset_name) {
      navigate(`/solutions/${match.asset_name}?preview=true`);
    }
  };

  const selectStyle: React.CSSProperties = {
    appearance: "none" as const,
    background: theme.pageBg,
    border: `1px solid ${theme.border}`,
    color: theme.text,
    borderRadius: 8,
    padding: "6px 28px 6px 10px",
    fontSize: 12,
    height: 34,
    minWidth: 116,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 8px center",
  };

  return (
    <div className="w-full">
      <p className="text-[11px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: theme.textMuted }}>
        Browse Example Problems
      </p>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <select
          value={selectedCourse}
          onChange={(e) => { setSelectedCourse(e.target.value); setSelectedChapterId(""); setSelectedSourceCode(""); }}
          style={selectStyle}
          className="w-full sm:w-auto"
        >
          {COURSE_OPTIONS.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>

        <select
          value={selectedChapterId}
          onChange={(e) => { setSelectedChapterId(e.target.value); setSelectedSourceCode(""); }}
          style={selectStyle}
          className="w-full sm:w-auto"
        >
          <option value="">Chapter…</option>
          {(chapters || []).map((ch: any) => (
            <option key={ch.id} value={ch.id}>Ch {ch.chapter_number}</option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={(e) => { setSelectedType(e.target.value); setSelectedSourceCode(""); }}
          style={selectStyle}
          className="w-full sm:w-auto"
        >
          <option value="all">Problem Type…</option>
          <option value="BE">Brief Exercise</option>
          <option value="E">Exercise</option>
          <option value="P">Problem</option>
        </select>

        <select
          value={selectedSourceCode}
          onChange={(e) => setSelectedSourceCode(e.target.value)}
          disabled={!chapterAssets?.length}
          style={{ ...selectStyle, opacity: chapterAssets?.length ? 1 : 0.55 }}
          className="w-full sm:w-auto"
        >
          <option value="">{!selectedChapterId ? "Source #…" : chapterAssets?.length ? "Source #…" : "None found"}</option>
          {(chapterAssets || []).map((a: any) => (
            <option key={a.asset_name} value={a.source_ref}>
              {a.source_label}
            </option>
          ))}
        </select>

        <button
          onClick={handleGo}
          disabled={!selectedSourceCode}
          className="w-full sm:w-auto px-4 py-1 rounded-md text-[12px] font-bold text-white transition-all hover:opacity-90 disabled:opacity-40"
          style={{ background: "#14213D", height: 34 }}
        >
          Go →
        </button>
      </div>
    </div>
  );
}


// ── JE Preview Teaser (blanked out) ─────────────────────────────────

function JEPreviewTeaser({ jeData, jeBlock, hasCanonicalJE, theme, enrollUrl }: {
  jeData: any; jeBlock: string; hasCanonicalJE: boolean; theme: Theme; enrollUrl: string;
}) {
  const entries: { date: string; rows: { isCredit: boolean }[] }[] = [];

  if (hasCanonicalJE) {
    const parsed: CanonicalJEPayload = typeof jeData === "string" ? JSON.parse(jeData) : jeData;
    for (const section of parsed.scenario_sections) {
      for (const entry of section.entries_by_date) {
        const date = entry.entry_date ?? (entry as any).date ?? "";
        const rows = (entry.rows || []).map((row: any) => ({
          isCredit: row.side === "credit" || (row.credit != null && row.credit !== 0 && (row.debit == null || row.debit === 0)),
        }));
        entries.push({ date, rows });
      }
    }
  } else {
    const lines = jeBlock.split("\n").filter((l: string) => l.trim());
    const rows = lines.map((line: string) => ({
      isCredit: line.startsWith("\t") || line.startsWith("    ") || line.startsWith("  "),
    }));
    entries.push({ date: "", rows });
  }

  return (
    <div className="space-y-4">
      {entries.map((entry, ei) => (
        <div key={ei}>
          {entry.date && <p className="font-bold text-sm mb-1" style={{ color: theme.text }}>???</p>}
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
                {entry.rows.map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? theme.pageBg : theme.tableAltBg }}>
                    <td className={`px-3 py-1.5 text-[13px] ${row.isCredit ? "pl-10" : ""}`} style={{ color: theme.textMuted }}>???</td>
                    <td className="text-right px-3 py-1.5 text-[13px] font-mono" style={{ color: theme.textMuted }}>{!row.isCredit ? "???" : ""}</td>
                    <td className="text-right px-3 py-1.5 text-[13px] font-mono" style={{ color: theme.textMuted }}>{row.isCredit ? "???" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <div className="text-center pt-2">
        <a
          href={enrollUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-semibold hover:underline"
          style={{ color: "#3B82F6" }}
        >
          Unlock account names and amounts with a Study Pass →
        </a>
      </div>
    </div>
  );
}

// ── Flowchart Image with Loading State ──────────────────────────────

function FlowchartImage({ src, alt }: { src: string; alt: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  return (
    <div className="relative mt-3">
      {status === "loading" && (
        <div
          className="flex flex-col items-center justify-center"
          style={{ background: "#f8fafc", borderRadius: 6, minHeight: 200 }}
        >
          <div className="flex flex-col items-center gap-[10px]">
            <div style={{ width: "60%", height: 16, background: "#e2e8f0", borderRadius: 4, animation: "flowchartPulse 1.4s ease-in-out infinite" }} />
            <div style={{ width: "80%", height: 12, background: "#e2e8f0", borderRadius: 4, animation: "flowchartPulse 1.4s ease-in-out infinite", animationDelay: "0.15s" }} />
            <div style={{ width: "45%", height: 12, background: "#e2e8f0", borderRadius: 4, animation: "flowchartPulse 1.4s ease-in-out infinite", animationDelay: "0.3s" }} />
          </div>
          <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 16 }}>
            Generating flowchart...
          </p>
        </div>
      )}
      {status === "error" && (
        <div
          className="flex items-center justify-center"
          style={{ background: "#f8fafc", borderRadius: 6, minHeight: 200 }}
        >
          <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
            Unable to load flowchart.<br />Try refreshing the page.
          </p>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className="w-full rounded-lg"
        loading="lazy"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        style={{
          opacity: status === "loaded" ? 1 : 0,
          transition: "opacity 0.3s ease",
          position: status === "loaded" ? "relative" : "absolute",
          top: 0,
          left: 0,
          pointerEvents: status === "loaded" ? "auto" : "none",
        }}
      />
      <style>{`@keyframes flowchartPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }`}</style>
    </div>
  );
}

// ── Flowchart Sub-Toggle (per instruction) ──────────────────────────

function FlowchartSubToggle({
  letter,
  instructionText,
  imageUrl,
  theme,
}: {
  letter: string;
  instructionText: string;
  imageUrl: string;
  theme: Theme;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded-lg overflow-hidden transition-all"
      style={{
        background: theme.pageBg,
        border: `1px solid ${open ? theme.answerBorder : theme.border}`,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors group"
        style={{ color: theme.text }}
      >
        <span
          className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full text-[12px] font-bold mt-0.5"
          style={{
            background: open ? theme.answerBorder : theme.tableHeaderBg,
            color: "#FFFFFF",
          }}
        >
          {letter}
        </span>
        <span className="flex-1 text-[13px] leading-[1.5]">
          {instructionText}
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 mt-0.5 transition-transform"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0)",
            color: theme.textMuted,
          }}
        />
      </button>
      {open && (
        <div className="px-4 pb-4" style={{ borderTop: `1px solid ${theme.border}` }}>
          <FlowchartImage src={imageUrl} alt={`How to solve ${letter}`} />
        </div>
      )}
    </div>
  );
}

// ── Chapter-Level Formula Carousel ──────────────────────────────────

function ChapterFormulaCarousel({ formulas }: { formulas: { id: string; formula_name: string; formula_expression: string; image_url: string | null }[] }) {
  const [idx, setIdx] = useState(0);
  const f = formulas[idx];
  if (!f) return null;
  return (
    <div className="space-y-3">
      {f.image_url ? (
        <img
          src={f.image_url}
          alt={f.formula_name}
          className="w-full rounded-lg"
          style={{ aspectRatio: "2/1", objectFit: "contain", background: "#14213D" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div className="w-full rounded-lg flex items-center justify-center py-8" style={{ aspectRatio: "2/1", background: "#14213D" }}>
          <span className="text-white/70 text-sm">{f.formula_name}</span>
        </div>
      )}
      <p className="text-xs text-center font-medium" style={{ color: "var(--foreground, #333)" }}>{f.formula_name}</p>
      {formulas.length > 1 && (
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} className="disabled:opacity-30 hover:text-foreground transition-colors">← Prev</button>
          <span>{idx + 1} / {formulas.length}</span>
          <button onClick={() => setIdx(Math.min(formulas.length - 1, idx + 1))} disabled={idx === formulas.length - 1} className="disabled:opacity-30 hover:text-foreground transition-colors">Next →</button>
        </div>
      )}
    </div>
  );
}

// ── Chapter-Level JE Accordion (categories → entries → tables) ──────

function ChapterJEAccordion({ categories, entries, theme }: { categories: { id: string; category_name: string; sort_order: number }[]; entries: { id: string; category_id: string | null; transaction_label: string; je_lines: any; sort_order: number }[]; theme: Theme }) {
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [openEntry, setOpenEntry] = useState<string | null>(null);

  const grouped = categories.map(cat => ({
    ...cat,
    entries: entries.filter(e => e.category_id === cat.id).sort((a, b) => a.sort_order - b.sort_order),
  })).filter(cat => cat.entries.length > 0);

  return (
    <div className="space-y-1">
      <p className="text-[12px] leading-[1.5] rounded-md px-3 py-2 mb-2" style={{ background: theme.cardBg, color: theme.textMuted, border: `1px solid ${theme.border}` }}>
        💡 Master these journal entries to build a strong foundation for this chapter. Tap a category to expand, then tap a transaction to see the entry.
      </p>
      {grouped.map(cat => {
        const catOpen = openCat === cat.id;
        return (
          <div key={cat.id}>
            <button
              onClick={() => setOpenCat(catOpen ? null : cat.id)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left transition-colors text-[14px] font-semibold"
              style={{
                color: theme.text,
                background: catOpen ? theme.cardBg : "transparent",
                border: `1px solid ${catOpen ? theme.border : "transparent"}`,
              }}
            >
              <span>{cat.category_name} <span className="text-[11px] font-normal" style={{ color: theme.textMuted }}>({cat.entries.length})</span></span>
              <span className="text-[10px] shrink-0 ml-2" style={{ color: theme.textMuted }}>{catOpen ? "▼" : "▶"}</span>
            </button>
            {catOpen && (
              <div className="ml-2 space-y-0.5 mt-1 mb-2">
                {cat.entries.map(entry => {
                  const entryOpen = openEntry === entry.id;
                  const lines = (Array.isArray(entry.je_lines) ? entry.je_lines : []) as { account: string; account_tooltip: string; side: string; amount: string }[];
                  return (
                    <div key={entry.id}>
                      <button
                        onClick={() => setOpenEntry(entryOpen ? null : entry.id)}
                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-left transition-colors text-[13px] font-medium"
                        style={{ color: theme.text, background: entryOpen ? theme.cardBg : "transparent" }}
                      >
                        <span>{entry.transaction_label}</span>
                        <span className="text-[10px] shrink-0 ml-2" style={{ color: theme.textMuted }}>{entryOpen ? "▲" : "▼"}</span>
                      </button>
                      {entryOpen && (
                        <div className="overflow-x-auto rounded-md mt-1 mb-2 mx-1" style={{ border: `1px solid ${theme.border}` }}>
                          <table className="w-full text-sm">
                            <thead>
                              <tr style={{ background: theme.tableHeaderBg }}>
                                <th className="text-left px-3 py-1.5 text-white font-bold text-[12px]">Account</th>
                                <th className="text-right px-3 py-1.5 text-white font-bold text-[12px] w-24">Debit</th>
                                <th className="text-right px-3 py-1.5 text-white font-bold text-[12px] w-24">Credit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lines.map((line, ri) => {
                                const isCredit = line.side === "credit";
                                return (
                                  <tr key={ri} style={{ background: ri % 2 === 0 ? theme.pageBg : (theme as any).tableAltBg || theme.cardBg }}>
                                    <td className={`px-3 py-1.5 text-[13px] ${isCredit ? "pl-10" : ""}`} style={{ color: theme.text }}>
                                      {line.account}
                                      {line.account_tooltip && <JETooltip text={line.account_tooltip} variant="solutions" />}
                                    </td>
                                    <td className="text-right px-3 py-1.5 text-[13px] font-mono" style={{ color: theme.textMuted }}>
                                      {!isCredit ? "???" : ""}
                                    </td>
                                    <td className="text-right px-3 py-1.5 text-[13px] font-mono" style={{ color: theme.textMuted }}>
                                      {isCredit ? "???" : ""}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Supplementary JE Display (accounts only, ??? amounts) ───────────

function SupplementaryJESection({ data, theme }: { data: { entries: { label: string; rows: { account_name: string; side: "debit" | "credit"; debit_credit_reason?: string; amount_source?: string }[] }[] }; theme: Theme }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div className="space-y-1">
      <p className="text-[12px] leading-[1.5] rounded-md px-3 py-2 mb-2" style={{ background: theme.cardBg, color: theme.textMuted, border: `1px solid ${theme.border}` }}>
        💡 These entries aren't required by the problem — but understanding them helps you master the topic. Tap a transaction to see the entry.
      </p>
      {data.entries.map((entry, ei) => {
        const isOpen = openIdx === ei;
        return (
          <div key={ei}>
            <button
              onClick={() => setOpenIdx(isOpen ? null : ei)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors text-[13px] font-medium"
              style={{
                color: theme.text,
                background: isOpen ? theme.cardBg : "transparent",
                border: `1px solid ${isOpen ? theme.border : "transparent"}`,
              }}
            >
              <span>{entry.label?.replace(/^How to record\s*/i, "") || entry.label}</span>
              <span className="text-[10px] shrink-0 ml-2" style={{ color: theme.textMuted }}>
                {isOpen ? "▲" : "▼"}
              </span>
            </button>
            {isOpen && (
              <div className="overflow-x-auto rounded-md mt-1 mb-2 mx-1" style={{ border: `1px solid ${theme.border}` }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: theme.tableHeaderBg }}>
                      <th className="text-left px-3 py-1.5 text-white font-bold text-[12px]">Account</th>
                      <th className="text-right px-3 py-1.5 text-white font-bold text-[12px] w-24">Debit</th>
                      <th className="text-right px-3 py-1.5 text-white font-bold text-[12px] w-24">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.rows.map((row, ri) => {
                      const isCredit = row.side === "credit";
                      return (
                        <tr key={ri} style={{ background: ri % 2 === 0 ? theme.pageBg : theme.tableAltBg }}>
                          <td className={`px-3 py-1.5 text-[13px] ${isCredit ? "pl-10" : ""}`} style={{ color: theme.text }}>
                            {row.account_name}
                            {row.debit_credit_reason && <JETooltip text={row.debit_credit_reason} variant="solutions" />}
                          </td>
                          <td className="text-right px-3 py-1.5 text-[13px] font-mono" style={{ color: theme.textMuted }}>
                            {!isCredit ? "???" : ""}
                          </td>
                          <td className="text-right px-3 py-1.5 text-[13px] font-mono" style={{ color: theme.textMuted }}>
                            {isCredit ? "???" : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Parse exam traps text into individual bullet points */
function parseExamTraps(text: string): string[] {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    return lines.map(l => l.replace(/^[-•·]\s*/, '').replace(/^\d+[.)]\s*/, ''));
  }
  const trapStarters = /(?<=[.!])\s+(?=[A-Z][a-z]+(?:ing|ly|ful)\s)/g;
  const parts = text.split(trapStarters).map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts.map(p => p.endsWith('.') ? p : p + '.');
  }
  const sentences = text.split(/\.\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean);
  return sentences.map(s => s.endsWith('.') ? s : s + '.');
}

/** Split text into bullet points */
function splitLongBullets(text: string): string[] {
  const raw = text.split(/\.\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean);
  const sentences = raw.map(s => s.endsWith('.') ? s : s + '.');
  const result: string[] = [];
  for (const s of sentences) {
    if (s.length <= 200) { result.push(s); continue; }
    const inner = s.match(/[^.!]+[.!]+/g);
    if (inner && inner.length >= 2) {
      const mid = s.length / 2;
      let bestIdx = 0;
      let bestDist = Infinity;
      let cumLen = 0;
      for (let i = 0; i < inner.length - 1; i++) {
        cumLen += inner[i].length;
        const dist = Math.abs(cumLen - mid);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      }
      const first = inner.slice(0, bestIdx + 1).join('').trim();
      const second = inner.slice(bestIdx + 1).join('').trim();
      if (first) result.push(first.endsWith('.') ? first : first + '.');
      if (second) result.push(second.endsWith('.') ? second : second + '.');
    } else {
      result.push(s);
    }
  }
  return result;
}

/** Group formulas by shared prefix */
function GroupedFormulas({ text, theme }: { text: string; theme: Theme }) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const groups: { header: string; items: string[] }[] = [];
  for (const line of lines) {
    const colonMatch = line.match(/^(.+?):\s+(.+)$/);
    if (colonMatch) {
      const [, prefix, formula] = colonMatch;
      const existing = groups.find(g => g.header === prefix);
      if (existing) { existing.items.push(formula); }
      else { groups.push({ header: prefix, items: [formula] }); }
    } else {
      groups.push({ header: "", items: [line] });
    }
  }
  const hasGrouping = groups.some(g => g.items.length >= 2);
  if (!hasGrouping) {
    return (
      <div className="space-y-3">
        {lines.map((line, i) => (
          <div key={i} className="rounded px-4 py-2.5 border-l-[3px]" style={{ background: theme.formulaBg, borderColor: theme.formulaBorder }}>
            <p className="font-mono text-[13px]" style={{ color: theme.text }}>{line}</p>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.header && <p className="font-bold text-[13px] mb-2" style={{ color: theme.text }}>{group.header}</p>}
          <div className="space-y-2">
            {group.items.map((item, ii) => (
              <div key={ii} className="rounded px-4 py-2.5 border-l-[3px]" style={{ background: theme.formulaBg, borderColor: theme.formulaBorder }}>
                <p className="font-mono text-[13px]" style={{ color: theme.text }}>{item}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── About Lee Content ──────────────────────────────────────────────

function AboutLeeSection({ theme }: { theme: Theme }) {
  return (
    <div className="flex flex-col items-center text-center gap-4">
      <img
        src={LEE_HERO_URL}
        alt="Lee Ingram"
        className="w-full"
        style={{ objectFit: "contain", borderRadius: 12, maxHeight: 280 }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <div className="max-w-[400px]">
        <p className="text-[13px] leading-[1.6]" style={{ color: theme.text }}>
          Creator of{" "}
          <a href="https://surviveaccounting.com" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline" style={{ color: "#3B82F6" }}>
            SurviveAccounting.com
          </a>.
          <br />
          Accounting tutor since 2015.
          <br />
          Loves helping students.
          <br /><br />
          Thanks for trying my study tools. Best of luck on your exam!
          <br />
          <span className="italic">— Lee</span>
        </p>
        <p className="text-[12px] leading-[1.6]" style={{ color: theme.textMuted }}>
          Ole Miss Alum<br />
          B.A. &amp; M.Acc. in Accounting • 3.75 GPA
        </p>
      </div>
      <div className="flex flex-col gap-1.5 text-[12px]">
        <a href="mailto:lee@surviveaccounting.com" className="flex items-center justify-center gap-1 hover:underline" style={{ color: "#3B82F6" }}>
          <ExternalLink className="h-3 w-3" /> lee@surviveaccounting.com
        </a>
        <a
          href="https://app.squareup.com/appointments/book/30fvidwxlwh9vt/LY1BCZ6Q74JRF/start"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 hover:underline font-semibold"
          style={{ color: "#3B82F6" }}
        >
          <Calendar className="h-3 w-3" /> Book 1-on-1 Tutoring →
        </a>
      </div>
    </div>
  );
}

// ── About Lee Modal ─────────────────────────────────────────────────

function AboutLeeModal({ open, onOpenChange, theme }: { open: boolean; onOpenChange: (v: boolean) => void; theme: Theme }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" style={{ borderRadius: 16 }}>
        <DialogHeader>
          <DialogTitle className="text-center">About Lee Ingram</DialogTitle>
          <DialogDescription className="sr-only">Bio and contact info</DialogDescription>
        </DialogHeader>
        <AboutLeeSection theme={theme} />
      </DialogContent>
    </Dialog>
  );
}

// ── Feedback Modal ──────────────────────────────────────────────────

function FeedbackModal({ open, onClose, asset }: { open: boolean; onClose: () => void; asset: any }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const chapter = (asset as any)?.chapters;
  const course = (asset as any)?.courses;
  const chapterName = chapter?.chapter_name || "";
  const courseName = (() => {
    const code = (course?.code || "").toUpperCase();
    if (code === "IA2") return "Intermediate Accounting 2";
    if (code === "IA1") return "Intermediate Accounting 1";
    if (code === "MA2") return "Managerial Accounting";
    if (code === "FA1") return "Financial Accounting";
    return course?.course_name || code;
  })();

  const handleSubmit = async () => {
    if (!feedback.trim()) return;
    setSubmitting(true);
    try {
      await (supabase as any).from("chapter_questions").insert({
        chapter_id: asset.chapter_id,
        student_email: email.trim() || "anonymous",
        question: feedback.trim(),
        issue_type: "feedback",
        asset_name: asset.asset_name,
        source_ref: asset.source_ref,
        status: "new",
        student_name: name.trim() || null,
      });
      supabase.functions.invoke("send-issue-report", {
        body: {
          student_email: email.trim() || "anonymous@feedback",
          message: feedback.trim(),
          issue_type_label: "Student Feedback",
          asset_name: asset.asset_name,
          source_ref: asset.source_ref,
          problem_title: name.trim() ? `From: ${name.trim()}` : "",
          course_name: courseName,
          chapter_number: chapter?.chapter_number || null,
          chapter_name: chapterName,
        },
      }).catch(() => {});
      setSent(true);
      setTimeout(onClose, 2000);
    } catch {
      toast.error("Something went wrong — try again");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "#ffffff", borderRadius: 12, padding: 24, width: "min(420px, 92vw)", zIndex: 101, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        {sent ? (
          <div className="text-center py-8">
            <CheckCircle className="h-8 w-8 mx-auto mb-3" style={{ color: "#22c55e" }} />
            <p className="text-[15px] font-bold" style={{ color: "#14213D" }}>Got it — thank you. — Lee</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[16px] font-bold" style={{ color: "#14213D" }}>Share Feedback</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-[12px] mb-4" style={{ color: "#999" }}>I read every message personally.</p>
            <div className="space-y-3">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 rounded-md text-[13px]"
                style={{ border: "1px solid #e0e0e0", outline: "none" }}
              />
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-3 py-2 rounded-md text-[13px]"
                style={{ border: "1px solid #e0e0e0", outline: "none" }}
              />
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="What's working well? What could be better? Anything you'd like to see added?"
                className="w-full px-3 py-2 rounded-md text-[13px]"
                style={{ border: "1px solid #e0e0e0", outline: "none", minHeight: 100, resize: "vertical" }}
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || !feedback.trim()}
              className="w-full mt-4 py-2.5 rounded-md text-[13px] font-bold text-white transition-opacity"
              style={{ background: "#14213D", opacity: submitting || !feedback.trim() ? 0.5 : 1 }}
            >
              {submitting ? "Sending…" : "Send to Lee →"}
            </button>
          </>
        )}
      </div>
    </>
  );
}

// ── Fix This Now Modal ───────────────────────────────────────────────

const FIX_SECTIONS = [
  { key: "solution_je", label: "Explanation text + JE reasons" },
  { key: "supplementary_je", label: "Supplementary journal entries" },
  { key: "formulas", label: "Important formulas" },
  { key: "concepts", label: "Key concepts" },
  { key: "traps", label: "Exam traps" },
  { key: "flowchart", label: "Flowchart" },
];

const SECTION_COLUMNS: Record<string, string[]> = {
  solution_je: ["journal_entry_completed_json"],
  supplementary_je: ["supplementary_je_json"],
  formulas: ["important_formulas"],
  concepts: ["concept_notes"],
  traps: ["exam_traps"],
  flowchart: ["flowchart_image_url", "flowchart_image_id"],
};

type FixStep = "prompt" | "running" | "review";
type FixTab = "ai" | "manual";

function FixThisNowModal({ assetCode, teachingAssetId, onClose }: { assetCode: string; teachingAssetId: string; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<FixTab>("ai");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [fixPrompt, setFixPrompt] = useState("");
  const [step, setStep] = useState<FixStep>("prompt");
  const [progress, setProgress] = useState<{ current: number; total: number; currentLabel: string }>({ current: 0, total: 0, currentLabel: "" });
  const [results, setResults] = useState<{ key: string; ok: boolean; error?: string }[]>([]);
  const [snapshot, setSnapshot] = useState<Record<string, Record<string, unknown>> | null>(null);
  const [afterData, setAfterData] = useState<Record<string, Record<string, unknown>> | null>(null);
  const [approving, setApproving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [attemptNumber, setAttemptNumber] = useState(1);

  // Manual edit state
  const [manualFields, setManualFields] = useState<Record<string, string>>({});
  const [manualLoading, setManualLoading] = useState(false);
  const [manualLoaded, setManualLoaded] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});

  const allChecked = checked.size === FIX_SECTIONS.length;
  const toggleAll = () => {
    if (allChecked) setChecked(new Set());
    else setChecked(new Set(FIX_SECTIONS.map(s => s.key)));
  };
  const toggle = (key: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const MIN_PROMPT_LENGTH = 20;
  const canRun = checked.size > 0 && fixPrompt.trim().length >= MIN_PROMPT_LENGTH;

  // Load current data for manual edit tab
  const loadManualData = async () => {
    if (manualLoaded) return;
    setManualLoading(true);
    try {
      const allCols = new Set<string>();
      FIX_SECTIONS.forEach(s => (SECTION_COLUMNS[s.key] || []).forEach(c => allCols.add(c)));
      const { data, error } = await supabase
        .from("teaching_assets")
        .select(["id", ...allCols].join(", "))
        .eq("id", teachingAssetId)
        .single();
      if (error) throw error;
      const fields: Record<string, string> = {};
      for (const col of allCols) {
        const val = (data as any)?.[col];
        if (val === null || val === undefined) {
          fields[col] = "";
        } else if (typeof val === "object") {
          fields[col] = JSON.stringify(val, null, 2);
        } else {
          fields[col] = String(val);
        }
      }
      setManualFields(fields);
      setManualLoaded(true);
    } catch (err: any) {
      toast.error("Failed to load asset data: " + err.message);
    } finally {
      setManualLoading(false);
    }
  };

  const handleManualSave = async () => {
    // Validate JSON fields
    const jsonCols = ["journal_entry_completed_json", "supplementary_je_json"];
    const errors: Record<string, string> = {};
    const updateObj: Record<string, unknown> = {};

    for (const [col, val] of Object.entries(manualFields)) {
      if (!val.trim()) {
        updateObj[col] = null;
        continue;
      }
      if (jsonCols.includes(col)) {
        try {
          updateObj[col] = JSON.parse(val);
        } catch {
          errors[col] = "Invalid JSON";
        }
      } else {
        updateObj[col] = val;
      }
    }

    if (Object.keys(errors).length > 0) {
      setJsonErrors(errors);
      toast.error("Fix JSON errors before saving");
      return;
    }
    setJsonErrors({});

    setManualSaving(true);
    try {
      const { error } = await supabase
        .from("teaching_assets")
        .update(updateObj)
        .eq("id", teachingAssetId);
      if (error) throw error;

      // Save audit trail
      await supabase.functions.invoke("fix-asset", {
        body: { teaching_asset_id: teachingAssetId, fix_prompt: "Manual edit by admin", action: "approve" },
      });

      toast.success("Manual edits saved");
      onClose();
      window.location.reload();
    } catch (err: any) {
      toast.error("Save failed: " + err.message);
    } finally {
      setManualSaving(false);
    }
  };

  const runFix = async () => {
    const selectedKeys = FIX_SECTIONS.filter(s => checked.has(s.key)).map(s => s.key);
    if (!selectedKeys.length || fixPrompt.trim().length < MIN_PROMPT_LENGTH) return;

    setStep("running");
    setResults([]);

    // 1. Snapshot current state
    try {
      const { data: snapRes, error: snapErr } = await supabase.functions.invoke("fix-asset", {
        body: { teaching_asset_id: teachingAssetId, sections: selectedKeys, action: "snapshot" },
      });
      if (snapErr) throw snapErr;
      setSnapshot(snapRes.snapshot);
    } catch (err: any) {
      toast.error("Failed to snapshot: " + (err.message || "Unknown error"));
      setStep("prompt");
      return;
    }

    // 2. Run fixes
    setProgress({ current: 0, total: selectedKeys.length, currentLabel: "Starting..." });
    try {
      const { data: runRes, error: runErr } = await supabase.functions.invoke("fix-asset", {
        body: { teaching_asset_id: teachingAssetId, sections: selectedKeys, fix_prompt: fixPrompt, action: "run", attempt_number: attemptNumber },
      });
      if (runErr) throw runErr;
      setResults(runRes.results || []);
      setAfterData(runRes.after || null);
      setProgress({ current: selectedKeys.length, total: selectedKeys.length, currentLabel: "Complete" });
      setStep("review");
    } catch (err: any) {
      toast.error("Fix failed: " + (err.message || "Unknown error"));
      setStep("prompt");
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const { error } = await supabase.functions.invoke("fix-asset", {
        body: { teaching_asset_id: teachingAssetId, fix_prompt: fixPrompt, action: "approve" },
      });
      if (error) throw error;
      toast.success("Fix approved and saved");
      onClose();
      window.location.reload();
    } catch (err: any) {
      toast.error("Approve failed: " + (err.message || "Unknown error"));
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!snapshot) { setStep("prompt"); return; }
    setRestoring(true);
    try {
      const { error } = await supabase.functions.invoke("fix-asset", {
        body: { teaching_asset_id: teachingAssetId, snapshot, action: "restore" },
      });
      if (error) throw error;
      toast.success("Changes reverted — try again");
      setStep("prompt");
      setResults([]);
      setAfterData(null);
      setSnapshot(null);
      setAttemptNumber(prev => prev + 1);
      // Keep fixPrompt pre-filled for refinement
    } catch (err: any) {
      toast.error("Restore failed: " + (err.message || "Unknown error"));
    } finally {
      setRestoring(false);
    }
  };

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return "(empty)";
    if (typeof val === "object") return JSON.stringify(val, null, 2);
    if (typeof val === "string") return val.length > 500 ? val.slice(0, 500) + "…" : val;
    return String(val);
  };

  const valuesMatch = (before: unknown, after: unknown): boolean => {
    return JSON.stringify(before) === JSON.stringify(after);
  };

  const hasErrors = results.some(r => !r.ok);

  return (
    <Dialog open onOpenChange={() => { if (step !== "running") onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Fix Asset — {assetCode}</DialogTitle>
          <DialogDescription className="text-xs">
            {step === "prompt" && "Describe what's wrong and select sections to regenerate, or edit manually."}
            {step === "running" && "Running fixes…"}
            {step === "review" && "Review what changed before approving."}
          </DialogDescription>
        </DialogHeader>

        {/* Tab switcher - only show on prompt step */}
        {step === "prompt" && (
          <div className="flex gap-1 border-b border-border mb-2">
            <button
              onClick={() => setActiveTab("ai")}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === "ai" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="h-3 w-3 inline mr-1" />AI Fix
            </button>
            <button
              onClick={() => { setActiveTab("manual"); loadManualData(); }}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === "manual" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Edit3 className="h-3 w-3 inline mr-1" />Edit Manually
            </button>
          </div>
        )}

        {/* ── AI Fix Tab ── */}
        {step === "prompt" && activeTab === "ai" && (
          <div className="space-y-4">
            {/* Fix prompt textarea */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">What's wrong and how should it be fixed? <span className="text-destructive">*</span></Label>
              <Textarea
                value={fixPrompt}
                onChange={e => setFixPrompt(e.target.value)}
                placeholder="e.g. The solution text says 'To Calculate A' but provides no actual calculation. Regenerate the solution with a complete step-by-step worked example showing the math for each instruction part."
                className="text-xs min-h-[100px]"
              />
              <div className="flex items-center justify-between">
                <p className={`text-[10px] ${fixPrompt.trim().length < MIN_PROMPT_LENGTH ? "text-muted-foreground" : "text-emerald-600"}`}>
                  {fixPrompt.trim().length} characters {fixPrompt.trim().length < MIN_PROMPT_LENGTH && `(min ${MIN_PROMPT_LENGTH})`}
                </p>
              </div>
            </div>

            {/* Section checkboxes */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Sections to regenerate</Label>
              <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer select-none border-b border-border pb-2">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} className="rounded" />
                Select All
              </label>
              <div className="space-y-1.5">
                {FIX_SECTIONS.map(sec => (
                  <label key={sec.key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input type="checkbox" checked={checked.has(sec.key)} onChange={() => toggle(sec.key)} className="rounded" />
                    <span>{sec.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠ This will regenerate checked sections{attemptNumber > 1 ? " using Opus (strongest model)" : ""} with your fix prompt as context.
            </p>
          </div>
        )}

        {/* ── Manual Edit Tab ── */}
        {step === "prompt" && activeTab === "manual" && (
          <div className="space-y-4">
            {manualLoading ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading current content…</span>
              </div>
            ) : (
              <>
                {FIX_SECTIONS.map(sec => {
                  const cols = SECTION_COLUMNS[sec.key] || [];
                  return cols.map(col => {
                    const isJson = col.endsWith("_json");
                    const val = manualFields[col];
                    if (val === undefined) return null;
                    return (
                      <div key={col} className="space-y-1">
                        <Label className="text-xs font-semibold">{sec.label} — <span className="font-mono text-muted-foreground">{col}</span></Label>
                        <textarea
                          value={val}
                          onChange={e => {
                            setManualFields(prev => ({ ...prev, [col]: e.target.value }));
                            if (jsonErrors[col]) setJsonErrors(prev => { const n = { ...prev }; delete n[col]; return n; });
                          }}
                          className={`w-full min-h-[120px] rounded-md border px-3 py-2 text-xs ${
                            isJson ? "font-mono" : ""
                          } ${jsonErrors[col] ? "border-destructive" : "border-input"} bg-background`}
                        />
                        {jsonErrors[col] && <p className="text-[10px] text-destructive">{jsonErrors[col]}</p>}
                      </div>
                    );
                  });
                })}
              </>
            )}
          </div>
        )}

        {/* ── Step 2: Running ── */}
        {step === "running" && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Running fixes with Opus — this may take a minute…</p>
            <p className="text-xs text-muted-foreground">
              Regenerating {progress.total} section{progress.total !== 1 ? "s" : ""} with your fix context
            </p>
          </div>
        )}

        {/* ── Step 3: Review ── */}
        {step === "review" && (
          <div className="space-y-4">
            {/* Results summary */}
            <div className="space-y-1">
              {results.map(r => {
                const sec = FIX_SECTIONS.find(s => s.key === r.key);
                return (
                  <div key={r.key} className="flex items-center gap-2 text-sm">
                    {r.ok
                      ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      : <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    }
                    <span className="flex-1">{sec?.label}</span>
                    {!r.ok && <span className="text-xs text-destructive">{r.error}</span>}
                  </div>
                );
              })}
            </div>

            {hasErrors && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
                Some sections failed. You can still approve the successful ones or reject all and try again.
              </p>
            )}

            {/* Before/After diffs */}
            {snapshot && afterData && (
              <div className="space-y-3">
                <Label className="text-xs font-semibold">Before → After</Label>
                {Object.keys(snapshot).map(sectionKey => {
                  const sec = FIX_SECTIONS.find(s => s.key === sectionKey);
                  const before = snapshot[sectionKey];
                  const after = afterData[sectionKey];
                  if (!after) return null;

                  // Check if any column actually changed
                  const allSame = Object.keys(before).every(col => valuesMatch(before[col], after[col]));

                  return (
                    <div key={sectionKey} className="border border-border rounded-lg overflow-hidden">
                      <div className="bg-muted/50 px-3 py-1.5 text-xs font-semibold border-b border-border flex items-center justify-between">
                        <span>{sec?.label}</span>
                        {allSame && (
                          <span className="text-[10px] text-amber-600 bg-amber-100 rounded px-1.5 py-0.5">⚠ No change detected</span>
                        )}
                      </div>
                      {allSame ? (
                        <div className="p-3 text-xs text-amber-600 bg-amber-50">
                          Fix prompt may need to be more specific for this section.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 divide-x divide-border">
                          <div className="p-2">
                            <p className="text-[9px] font-bold text-destructive uppercase mb-1">BEFORE</p>
                            {Object.entries(before).map(([col, val]) => (
                              <pre key={col} className="text-[10px] text-muted-foreground whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                                {formatValue(val)}
                              </pre>
                            ))}
                          </div>
                          <div className="p-2">
                            <p className="text-[9px] font-bold text-emerald-600 uppercase mb-1">AFTER</p>
                            {Object.entries(after).map(([col, val]) => (
                              <pre key={col} className="text-[10px] text-foreground whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                                {formatValue(val)}
                              </pre>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Fix prompt audit trail */}
            <div className="bg-muted/30 rounded-lg px-3 py-2">
              <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Fix prompt (saved as audit trail)</p>
              <p className="text-xs text-foreground">{fixPrompt}</p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "prompt" && activeTab === "ai" && (
            <div className="flex items-center gap-2">
              {attemptNumber > 1 && (
                <span className="text-[10px] font-medium text-amber-700 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5">
                  Using stronger model
                </span>
              )}
              <Button
                onClick={runFix}
                disabled={!canRun}
                className="text-white text-sm"
                style={{ background: canRun ? "#14213D" : undefined }}
              >
                Run Fix →
              </Button>
            </div>
          )}
          {step === "prompt" && activeTab === "manual" && (
            <Button
              onClick={handleManualSave}
              disabled={manualSaving || manualLoading}
              className="text-white text-sm bg-emerald-600 hover:bg-emerald-700"
            >
              {manualSaving ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving…</> : "Save Changes"}
            </Button>
          )}
          {step === "review" && (
            <>
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={restoring || approving}
                className="text-xs"
              >
                {restoring ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Reverting…</> : "✗ Try Again"}
              </Button>
              <Button
                onClick={handleApprove}
                disabled={approving || restoring}
                className="text-white text-xs"
                style={{ background: "#14213D" }}
              >
                {approving ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving…</> : "✓ Looks Good — Apply Fix"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Floating Action Bar (fixed top-right) ───────────────────────────

function FloatingActionBar({ theme, shareUrl, assetCode, chapterId, asset, onShareClick, onReportClick, showShare = true, isAdmin = false, courseCode = "" }: { theme: Theme; shareUrl: string; assetCode: string; chapterId?: string; asset?: any; onShareClick?: () => void; onReportClick?: () => void; showShare?: boolean; isAdmin?: boolean; courseCode?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [fixOpen, setFixOpen] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("fix") === "true"; } catch { return false; }
  });
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try { return localStorage.getItem("sa_feedback_banner_dismissed") === "true"; } catch { return false; }
  });

  const dismissBanner = () => {
    setBannerDismissed(true);
    try { localStorage.setItem("sa_feedback_banner_dismissed", "true"); } catch {}
  };
  // Close menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && menuBtnRef.current && !menuBtnRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, [menuOpen]);

  const faqItems = [
    { q: "Who made this?", a: "Lee Ingram — accounting tutor at the University of Mississippi since 2015. These problems are built from real exam prep sessions with hundreds of students." },
    { q: "What textbook are these problems based on?", a: (() => { const cc = courseCode.toUpperCase(); if (cc === "IA1" || cc === "IA2") return "Intermediate Accounting, 18th Edition by Donald E. Kieso, Jerry J. Weygandt, and Terry D. Warfield (ISBN: 978-1-119-77889-9)."; return "Financial and Managerial Accounting by John J. Wild and Ken W. Shaw."; })() },
    { q: "Why are the numbers different from my textbook?", a: "The dollar amounts are intentionally different — we use original numbers so you practice the concept, not just memorize an answer. The accounting method and journal entries are identical to your textbook." },
    { q: "What's included for free vs. paid?", a: "The practice problem, instructions, and a blank Practice PDF are always free. The full solution, journal entries, key formulas, and more are included with a Study Pass." },
    { q: "Something looks wrong — how do I report it?", a: "Use the 'Report Issue' button in the top-right corner. Lee reviews every report personally and fixes issues as they come in." },
  ];

  return (
    <>
      {/* Mobile: compact floating share button bottom-right */}
      {showShare && (
        <div className="block sm:hidden fixed z-30" style={{ bottom: 20, right: 16 }}>
          <button
            onClick={() => { copyToClipboard(shareUrl).then(() => toast.success("Link copied — share with classmates!")); onShareClick?.(); }}
            className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[12px] font-bold shadow-lg"
            style={{ background: "#FFFFFF", color: "#3B82F6", border: `1px solid ${theme.border}` }}
          >
            <Share2 className="h-3.5 w-3.5" /> Share
          </button>
        </div>
      )}

      {/* Desktop: full action bar with feedback banner */}
      <div
        className="hidden sm:block fixed z-30"
        style={{ top: 56, right: 16 }}
      >
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "#FFFFFF",
            border: `1px solid ${theme.border}`,
            boxShadow: "0 2px 12px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          {/* Feedback banner row */}
          {!bannerDismissed && !collapsed && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5"
              style={{ borderBottom: `1px solid ${theme.border}` }}
            >
              <span className="text-[11px]" style={{ color: theme.textMuted }}>
                This content is brand new —{" "}
                <button
                  onClick={() => setFeedbackOpen(true)}
                  className="underline hover:no-underline"
                  style={{ color: theme.textMuted, background: "none", border: "none", cursor: "pointer", fontSize: 11, padding: 0 }}
                >
                  share your feedback
                </button>
                .
              </span>
              <button
                onClick={dismissBanner}
                className="ml-auto shrink-0 hover:opacity-70"
                style={{ color: theme.textMuted, background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Button row */}
          <div className="flex items-center">
            {!collapsed && (
              <>
                {/* Admin: Fix This Now */}
                {isAdmin && (
                  <>
                    <button
                      onClick={() => setFixOpen(true)}
                      className="text-[11px] font-bold px-3 py-2 transition-all hover:scale-[1.03] active:scale-[0.97] whitespace-nowrap flex items-center gap-1.5"
                      style={{ color: "#14213D" }}
                    >
                      <Wrench className="h-3 w-3" /> Fix This Now
                    </button>
                    <div className="w-px h-5" style={{ background: theme.border }} />
                  </>
                )}
                {showShare && (
                  <>
                    <button
                      onClick={() => { copyToClipboard(shareUrl).then(() => toast.success("Link copied — share with classmates!")); onShareClick?.(); }}
                      className="text-[11px] font-bold px-3 py-2 transition-all hover:scale-[1.03] active:scale-[0.97] whitespace-nowrap flex items-center gap-1.5"
                      style={{ color: "#3B82F6" }}
                    >
                      <Share2 className="h-3 w-3" /> Share This
                    </button>
                    <div className="w-px h-5" style={{ background: theme.border }} />
                  </>
                )}
                <button
                  onClick={() => setAboutOpen(true)}
                  className="text-[11px] font-semibold px-3 py-2 transition-colors hover:bg-gray-50 whitespace-nowrap"
                  style={{ color: theme.text }}
                >
                  About Lee Ingram
                </button>
                <div className="w-px h-5" style={{ background: theme.border }} />
                <button
                  onClick={onReportClick}
                  className="text-[11px] font-semibold px-3 py-2 transition-colors hover:bg-gray-50 whitespace-nowrap flex items-center gap-1"
                  style={{ color: theme.textMuted, background: "none", border: "none", cursor: "pointer" }}
                >
                  ⚠ Report Issue →
                </button>
                <div className="w-px h-5" style={{ background: theme.border }} />
              </>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="px-2.5 py-2 text-[10px] transition-colors hover:bg-gray-50 flex items-center gap-0.5"
              style={{ color: theme.textMuted }}
            >
              {collapsed ? (
                <>Show <ChevronDown className="h-3 w-3" /></>
              ) : (
                <ChevronUp className="h-3 w-3" />
              )}
            </button>
            <div className="w-px h-5" style={{ background: theme.border }} />
            <div className="relative">
              <button
                ref={menuBtnRef}
                onClick={() => { setMenuOpen(!menuOpen); setOpenFaqIndex(null); }}
                className="px-2.5 py-2 transition-colors hover:bg-gray-50 flex items-center"
                style={{ color: theme.textMuted }}
                aria-label="Menu"
              >
                <Menu className="h-[18px] w-[18px]" />
              </button>
              {menuOpen && (
                <div
                  ref={menuRef}
                  className="absolute right-0 top-full mt-1.5 w-[280px] sm:w-[280px] max-sm:fixed max-sm:left-0 max-sm:right-0 max-sm:top-[56px] max-sm:w-auto max-sm:mx-2"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid rgba(0,0,0,0.1)",
                    borderRadius: 8,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
                    zIndex: 50,
                  }}
                >
                  <div style={{ fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#999", padding: "12px 16px 6px", fontWeight: 600 }}>
                    About & FAQ
                  </div>
                  <div>
                    {faqItems.map((faq, i) => (
                      <div key={i} style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                        <button
                          onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
                          className="w-full text-left cursor-pointer select-none"
                          style={{ fontSize: 13, fontWeight: 500, color: "#14213D", padding: "10px 16px" }}
                        >
                          {faq.q}
                        </button>
                        <div
                          style={{
                            maxHeight: openFaqIndex === i ? 200 : 0,
                            overflow: "hidden",
                            transition: "max-height 0.25s ease",
                          }}
                        >
                          <p style={{ fontSize: 13, color: "#666", lineHeight: 1.7, padding: "0 16px 12px" }}>
                            {faq.a}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderTop: "1px solid rgba(0,0,0,0.1)" }}>
                    <div className="cursor-default" style={{ fontSize: 13, color: "#BBB", padding: "10px 16px" }}>Sign in</div>
                    <div className="cursor-default" style={{ fontSize: 13, color: "#BBB", padding: "10px 16px" }}>Dashboard</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AboutLeeModal open={aboutOpen} onOpenChange={setAboutOpen} theme={theme} />
      {asset && <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} asset={asset} />}
      {fixOpen && asset && <FixThisNowModal assetCode={assetCode} teachingAssetId={asset.id} onClose={() => setFixOpen(false)} />}
    </>
  );
}



// ── Practice PDF Button ──────────────────────────────────────────────

function PracticePdfButton({
  sourceRef,
  assetName,
}: {
  sourceRef: string;
  assetName: string;
}) {
  const [generating, setGenerating] = useState(false);


  const handleClick = async () => {
    setGenerating(true);
    try {
      const res = await supabase.functions.invoke("generate-practice-pdf", {
        body: { asset_name: assetName },
        headers: { Accept: "application/pdf" },
      });

      if (res.error) {
        throw new Error(res.error.message || "Edge function error");
      }

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SurviveAccounting-${sourceRef.replace(/\s+/g, "-")}-Practice.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error("Practice PDF error:", e);
      toast.error("Could not generate PDF — try again");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={generating}
      style={{
        background: generating ? "#f1f5f9" : "#ffffff",
        border: `1px solid ${BORDER}`,
        borderRadius: 20,
        padding: "4px 12px",
        fontSize: 11,
        fontWeight: 600,
        color: generating ? "#94a3b8" : NAVY,
        cursor: generating ? "default" : "pointer",
        opacity: generating ? 0.6 : 1,
      }}
      onMouseEnter={(e) => { if (!generating) (e.currentTarget.style.background = "#f8fafc"); }}
      onMouseLeave={(e) => { if (!generating) (e.currentTarget.style.background = "#ffffff"); }}
    >
      {generating ? "Generating..." : "⬇ Practice PDF"}
    </button>
  );
}

const BORDER = "#e2e8f0";
const NAVY = "#14213D";

// ── MAIN COMPONENT ──────────────────────────────────────────────────

export default function SolutionsViewer() {
  const { assetCode } = useParams<{ assetCode: string }>();
  const [searchParams] = useSearchParams();
  const rawIsPreview = searchParams.get("preview") === "true";
  const previewToken = searchParams.get("preview_token") || "";
  const hasRefLw = searchParams.get("ref") === "lw";
  const isQaMode = searchParams.get("qa") === "1";
  const enrollUrl = useEnrollUrl();

  // ── QA inline editing state ──
  const [qaEditingField, setQaEditingField] = useState<"problem" | "instructions" | "solution" | null>(null);

  // ── LW params ref (stable across renders) ──
  const lwParams = useRef({
    ref: searchParams.get("ref") || "",
    lw_user_id: searchParams.get("lw_user_id") || "",
    lw_email: searchParams.get("lw_email") || "",
    lw_name: searchParams.get("lw_name") || "",
    lw_course: searchParams.get("lw_course") || "",
    lw_unit: searchParams.get("lw_unit") || "",
    preview: searchParams.get("preview") || "",
  });

  // ── Page start time for time_on_page ──
  const startTimeRef = useRef(Date.now());

  // ── Share buttons visibility setting ──
  const { data: shareButtonsVisible = false } = useQuery({
    queryKey: ["app-setting-share-buttons"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "share_buttons_visible")
        .maybeSingle();
      return data?.value === "true";
    },
    staleTime: 60 * 1000,
  });

  // Theme — light only
  const t = lightTheme;

  // ── Admin bypass: authenticated user always gets full access ──
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setIsAdmin(true);
    });
  }, []);

  // ── LearnWorlds referrer DRM check ──
  const VALID_REFERRER_DOMAINS = [
    "learnworlds.com",
    "surviveaccounting.learnworlds.com",
    "learn.surviveaccounting.com",
    "surviveaccounting.com",
    "lovable.app",
  ];

  const lwVerified = useMemo(() => {
    // Check sessionStorage first (handles in-iframe navigation)
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("sa-lw-verified") === "true") {
      return true;
    }
    // Allow if current host is a lovable.app preview domain (admin preview)
    if (hasRefLw && (window.location.hostname.endsWith("lovable.app") || window.location.hostname.endsWith("lovableproject.com"))) {
      return true;
    }
    // Check referrer against allowed domains
    if (hasRefLw && document.referrer) {
      try {
        const refHost = new URL(document.referrer).hostname;
        return VALID_REFERRER_DOMAINS.some(d => refHost === d || refHost.endsWith("." + d));
      } catch { return false; }
    }
    return false;
  }, [hasRefLw]);

  // Store LW verification in sessionStorage for subsequent navigations
  useEffect(() => {
    if (lwVerified && hasRefLw) {
      try { sessionStorage.setItem("sa-lw-verified", "true"); } catch {}
    }
  }, [lwVerified, hasRefLw]);

  // ── Preview token validation ──
  const { data: tokenSession, isLoading: tokenLoading } = useQuery({
    queryKey: ["preview-token", previewToken],
    queryFn: async () => {
      if (!previewToken) return null;
      const { data } = await supabase
        .from("edu_preview_sessions")
        .select("id, asset_codes, expires_at, email")
        .eq("id", previewToken)
        .maybeSingle();
      return data;
    },
    enabled: !!previewToken,
    staleTime: 5 * 60 * 1000,
  });

  // Countdown timer for preview token
  const [countdown, setCountdown] = useState("");
  const [previewExpired, setPreviewExpired] = useState(false);

  // Determine access mode:
  // 1. Admin bypass → full access
  // 2. Valid preview_token → full access
  // 3. ?ref=lw with valid referrer → full access
  // 4. Everything else → preview mode
  const tokenExpired = tokenSession && new Date(tokenSession.expires_at) < new Date();
  const tokenValidForAsset = tokenSession && !tokenExpired && assetCode &&
    (tokenSession.asset_codes as string[])?.includes(assetCode);

  const isLovablePreviewDomain = typeof window !== "undefined" && window.location.hostname.endsWith("lovableproject.com");
  const isPreview = (() => {
    if (isAdmin) return false;
    if (isLovablePreviewDomain) return false; // Allow full access on Lovable preview domains for testing
    if (previewToken) return !tokenValidForAsset || previewExpired;
    if (lwVerified) return false;
    return true; // Default: preview mode (no valid access method)
  })();

  // Highlight toggle
  const [showHighlights, setShowHighlights] = useState(false);
  // Dissector highlight toggle (default ON, resets each page load)
  const [showDissectorHighlights, setShowDissectorHighlights] = useState(true);

  // Report modal
  const [reportOpen, setReportOpen] = useState(false);

  // QA: force open all toggles via postMessage
  const [allTogglesForceOpen, setAllTogglesForceOpen] = useState(false);
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "QA_OPEN_ALL_TOGGLES") setAllTogglesForceOpen(true);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // ── Event logging helper (fire-and-forget) ──
  // We store the resolved asset in a ref so logEvent can always access it
  const assetRef = useRef<any>(null);

  const logEvent = useCallback((eventType: string, extra?: Record<string, any>) => {
    const lw = lwParams.current;
    const a = assetRef.current;
    supabase.from("asset_events" as any).insert({
      asset_name: assetCode || "",
      teaching_asset_id: a?.id || null,
      chapter_id: a?.chapter_id || null,
      course_id: a?.course_id || null,
      event_type: eventType,
      is_lw_embed: lw.ref === "lw",
      is_preview_mode: lw.preview === "true",
      lw_user_id: lw.lw_user_id || null,
      lw_email: lw.lw_email || null,
      lw_name: lw.lw_name || null,
      lw_course_id: lw.lw_course || null,
      lw_unit_id: lw.lw_unit || null,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent || null,
      ...extra,
    } as any).then(() => {});
  }, [assetCode]);

  // ── Track page visit / LW embed load (fire-and-forget) ──
  const pageVisitFired = useRef(false);
  useEffect(() => {
    if (!assetCode || pageVisitFired.current) return;
    pageVisitFired.current = true;
    const lw = lwParams.current;
    logEvent(lw.ref === "lw" ? "lw_embed_load" : "page_visit");
  }, [assetCode, logEvent]);

  // ── Heartbeat every 60s ──
  useEffect(() => {
    const iv = setInterval(() => {
      if (!document.hidden) {
        logEvent("heartbeat", { seconds_spent: 60 });
      }
    }, 60000);
    return () => clearInterval(iv);
  }, [logEvent]);

  // ── Time on page (beforeunload) ──
  useEffect(() => {
    const handler = () => {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      logEvent("time_on_page", { seconds_spent: elapsed });
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [logEvent]);

  // ── Reveal toggle callback ──
  const sectionNameMap: Record<string, string> = {
    "Explanation": "solution",
    "How to Solve This": "how_to_solve",
    "Journal Entries": "journal_entries",
    "Related Journal Entries": "related_je",
    "Important Formulas": "formulas",
    "Key Concepts": "key_concepts",
    "Exam Traps": "exam_traps",
  };

  const handleReveal = useCallback((sectionName: string) => {
    logEvent("reveal_toggle", { section_name: sectionNameMap[sectionName] || sectionName });
  }, [logEvent]);

  // ── Share click handler ──
  const handleShareClick = useCallback(() => {
    logEvent("share_click");
  }, [logEvent]);

  // ── Buy click handler ──
  const handleBuyClick = useCallback(() => {
    logEvent("buy_click");
  }, [logEvent]);

  useEffect(() => {
    if (!tokenSession?.expires_at || !previewToken) return;
    const update = () => {
      const now = Date.now();
      const exp = new Date(tokenSession.expires_at).getTime();
      const diff = exp - now;
      if (diff <= 0) {
        setCountdown("00:00:00");
        setPreviewExpired(true);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [tokenSession?.expires_at, previewToken]);

  // Minimum display time for loading screen — skip entirely in QA mode
  const [minTimePassed, setMinTimePassed] = useState(isQaMode);
  const [showLoadingDOM, setShowLoadingDOM] = useState(!isQaMode);

  useEffect(() => {
    if (isQaMode) return;
    const timer = setTimeout(() => setMinTimePassed(true), 800);
    return () => clearTimeout(timer);
  }, [isQaMode]);

  // Fetch asset
  const { data, isLoading: dataLoading, isError: dataError, refetch: refetchAsset } = useQuery({
    queryKey: ["solutions-viewer", assetCode],
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

      const { data: instrData } = await supabase
        .from("problem_instructions")
        .select("instruction_number, instruction_text")
        .eq("teaching_asset_id", asset.id)
        .order("instruction_number");

      const { data: flowchartsData } = await supabase
        .from("asset_flowcharts")
        .select("instruction_number, instruction_label, flowchart_image_url")
        .eq("teaching_asset_id", asset.id)
        .order("instruction_number");

      // Fetch dissector highlights
      const { data: dissectorData } = await supabase
        .from("dissector_problems")
        .select("highlights")
        .eq("teaching_asset_id", asset.id)
        .limit(1);
      const dissectorHighlights = (dissectorData?.[0]?.highlights as unknown as DissectorHighlight[] | null) || [];

      return { ...asset, _problemTitle: asset.problem_title || "", _instructions: instrData || [], _flowcharts: flowchartsData || [], _dissectorHighlights: dissectorHighlights };
    },
    enabled: !!assetCode,
  });

  // Fetch payment links for tiered paywall
  const { data: paymentLinks } = useQuery({
    queryKey: ["payment-links-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_links")
        .select("*")
        .eq("is_active", true);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: isPreview,
  });

  // Fetch chapter-level journal entries (replaces per-asset Related JEs)
  const chapterIdForJE = data?.chapter_id;
  const { data: chapterJEData } = useQuery({
    queryKey: ["chapter-je-viewer", chapterIdForJE],
    queryFn: async () => {
      if (!chapterIdForJE) return { categories: [], entries: [] };
      const { data: cats } = await supabase
        .from("chapter_je_categories")
        .select("id, category_name, sort_order")
        .eq("chapter_id", chapterIdForJE)
        .order("sort_order");
      const { data: entries } = await supabase
        .from("chapter_journal_entries")
        .select("id, category_id, transaction_label, je_lines, sort_order")
        .eq("chapter_id", chapterIdForJE)
        .eq("is_approved", true)
        .order("sort_order");
      return { categories: cats || [], entries: entries || [] };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!chapterIdForJE,
  });

  // Fetch chapter-level formulas (approved with images)
  const { data: chapterFormulas } = useQuery({
    queryKey: ["chapter-formulas-viewer", chapterIdForJE],
    queryFn: async () => {
      if (!chapterIdForJE) return [];
      const { data: rows } = await supabase
        .from("chapter_formulas")
        .select("id, formula_name, formula_expression, image_url")
        .eq("chapter_id", chapterIdForJE)
        .eq("is_approved", true)
        .not("image_url", "is", null)
        .order("sort_order");
      return rows || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!chapterIdForJE,
  });

  // ── QA status gate: only show reviewed_clean assets to students ──
  const { data: qaStatusData } = useQuery({
    queryKey: ["solutions-qa-status", data?.id],
    queryFn: async () => {
      const { data: row } = await supabase
        .from("solutions_qa_assets" as any)
        .select("qa_status")
        .eq("teaching_asset_id", data!.id)
        .maybeSingle();
      return (row as unknown as { qa_status: string }) || null;
    },
    enabled: !!data?.id,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (!data?.id) return;
    const key = `solutions_viewed_${data.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    supabase.rpc("increment_solutions_views", { asset_id: data.id }).then(() => {});
  }, [data?.id]);

  // SEO meta — computed values
  const seoRef = data?.source_ref || data?.asset_name || "";
  const seoProblemTitle = data?._problemTitle || "";
  const seoTitle = seoProblemTitle
    ? `${seoRef} — ${seoProblemTitle} | Survive Accounting`
    : seoRef
      ? `${seoRef} | Survive Accounting`
      : "Survive Accounting — Accounting Problem Solutions by Lee Ingram";
  const seoDescription = seoProblemTitle
    ? `Step-by-step solution for ${seoRef}: ${seoProblemTitle}. Journal entries, key concepts, exam traps, and formulas — built by Lee Ingram from 10+ years of Ole Miss tutoring.`
    : "Step-by-step accounting solutions with journal entries, exam traps, and key concepts. Built by Lee Ingram from 10+ years of Ole Miss tutoring.";
  const seoCanonical = `https://learn.surviveaccounting.com/solutions/${assetCode}`;
  const seoImage = LEE_HERO_URL;
  const seoJsonLd = data ? JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: seoProblemTitle ? `${seoRef} — ${seoProblemTitle}` : seoRef,
    description: seoDescription,
    author: { "@type": "Person", name: "Lee Ingram", url: "https://surviveaccounting.com" },
    publisher: {
      "@type": "Organization",
      name: "Survive Accounting",
      url: "https://learn.surviveaccounting.com",
      logo: { "@type": "ImageObject", url: LOGO_URL },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": seoCanonical },
    image: seoImage,
  }) : null;

  const isLoading = dataLoading || !minTimePassed;
  const isLoadingScreenVisible = isLoading || tokenLoading;

  // Remove loading DOM after fade completes
  useEffect(() => {
    if (!isLoadingScreenVisible && showLoadingDOM) {
      const t2 = setTimeout(() => setShowLoadingDOM(false), 400);
      return () => clearTimeout(t2);
    }
  }, [isLoadingScreenVisible, showLoadingDOM]);

  // Branded loading screen
  const loadingScreen = showLoadingDOM ? (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "#14213D",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: isLoadingScreenVisible ? 1 : 0,
        pointerEvents: isLoadingScreenVisible ? "all" as const : "none" as const,
        transition: "opacity 0.4s ease",
      }}
    >
      <img
        src="https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/f10e00cd3462ea2638b6e6161236a92b.png"
        alt="Survive Accounting"
        style={{ width: 360, maxWidth: "80vw", borderRadius: 12, opacity: 0.9, marginBottom: 20, objectFit: "cover" }}
      />
      {dataError ? (
        <>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", marginTop: 20, marginBottom: 20 }}>
            Having trouble loading. Please refresh the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.4)",
              color: "#ffffff",
              borderRadius: 6,
              padding: "6px 16px",
              fontSize: 14,
              cursor: "pointer",
              marginBottom: 20,
            }}
          >
            ↺ Refresh
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 20, color: "rgba(255,255,255,0.9)", textAlign: "center", maxWidth: 380, lineHeight: 1.7, margin: "20px auto 0", fontWeight: 500 }}>
            Your practice problem is loading<span className="loading-dots" />
          </p>
          <div
            style={{
              width: 36,
              height: 36,
              border: "3px solid rgba(255,255,255,0.15)",
              borderTopColor: "#CE1126",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "24px auto",
            }}
          />
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.7)", textAlign: "center", maxWidth: 320, lineHeight: 1.7, margin: "0 auto", fontWeight: 400 }}>
            Best of luck studying!
            <br />
            <span style={{ fontSize: 15, color: "rgba(255,255,255,0.45)" }}>– Lee</span>
          </p>
        </>
      )}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes dotPulse { 0%, 20% { content: ''; } 25%, 45% { content: '.'; } 50%, 70% { content: '..'; } 75%, 100% { content: '...'; } }
        .loading-dots::after { content: ''; animation: dotPulse 1.5s infinite steps(1); }
      `}</style>
    </div>
  ) : null;

  if ((dataLoading || tokenLoading) && !minTimePassed) {
    return <>{loadingScreen}</>;
  }

  if (isLoadingScreenVisible) {
    // Still fading — render loading screen only
    return <>{loadingScreen}</>;
  }

  // Show expired token full-page message
  if (previewToken && tokenSession && tokenExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: t.pageBg }}>
        <div className="text-center max-w-md px-6">
          <p className="text-2xl font-bold" style={{ color: t.text }}>This preview link has expired</p>
          <p className="mt-2 text-[14px]" style={{ color: t.textMuted }}>
            Your 2-hour free preview has ended. Get full access to every problem with a Study Pass.
          </p>
          <a
            href={enrollUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-6 px-8 py-3.5 rounded-md font-bold text-[16px] transition-all hover:scale-105"
            style={{ background: "#00FFFF", color: "#0A0A0A" }}
          >
            Get Full Access →
          </a>
        </div>
      </div>
    );
  }




  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: t.pageBg }}>
        <div className="text-center">
          <p className="text-2xl font-bold" style={{ color: t.text }}>Problem not found</p>
          <p className="mt-2" style={{ color: t.textMuted }}>Check the asset code and try again.</p>
        </div>
      </div>
    );
  }

  // If asset has QA issues (not clean), show "in development" screen for non-admin users
  const qaStatus = qaStatusData?.qa_status;
  const assetIsClean = !qaStatus || qaStatus === "reviewed_clean";
  if (!assetIsClean && !isAdmin && !isQaMode) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#14213D",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={LEE_HERO_URL}
          alt="Survive Accounting"
          style={{ width: 360, maxWidth: "80vw", borderRadius: 12, opacity: 0.9, marginBottom: 28, objectFit: "cover" }}
        />
        <p style={{ fontSize: 20, color: "rgba(255,255,255,0.9)", textAlign: "center", maxWidth: 400, lineHeight: 1.7, fontWeight: 500 }}>
          This practice problem is still in development. Check back soon!
        </p>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", marginTop: 12 }}>– Lee</p>
      </div>
    );
  }

  const asset = data;
  assetRef.current = asset;
  const chapter = (asset as any).chapters;
  const course = (asset as any).courses;

  const chapterLabel = chapter?.chapter_number && chapter?.chapter_name
    ? `Ch ${chapter.chapter_number} — ${chapter.chapter_name}`
    : "";
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

  // Strip parenthetical role hints like "(the issuer)", "(the borrower)" from student-facing text
  const stripRoleHints = (text: string) => text.replace(/\s*\(the\s+[a-z]+(?:\s+[a-z]+)?\)/gi, "");

  // Instructions
  let instructions: string[] = (asset._instructions || [])
    .sort((a: any, b: any) => a.instruction_number - b.instruction_number)
    .filter((i: any) => i.instruction_text?.trim())
    .map((i: any) => stripRoleHints(i.instruction_text));
  if (instructions.length === 0) {
    const i1 = asset.instruction_1;
    if (i1?.trim()) {
      instructions = [i1, asset.instruction_2, asset.instruction_3, asset.instruction_4, asset.instruction_5]
        .filter((v: string | null) => v?.trim()) as string[];
    } else if (asset.instruction_list?.trim()) {
      instructions = asset.instruction_list.split(/[\n|]/).map((s: string) => s.trim()).filter(Boolean);
    }
  }

  // JE data
  const jeData = asset.journal_entry_completed_json;
  const jeBlock = asset.journal_entry_block || "";
  const hasCanonicalJE = jeData && isCanonicalJE(typeof jeData === "string" ? JSON.parse(jeData) : jeData);
  const hasJE = hasCanonicalJE || jeBlock.trim();


  const answerSummary = stripRoleHints(asset.survive_solution_text || "");
  // JE-only: instructions all match JE patterns AND explanation is short (simple problems only)
  const jeOnlyByInstructions = detectJEOnly(asset._instructions);
  const explanationLineCount = answerSummary.split("\n").filter(l => l.trim()).length;
  const isJEOnly = jeOnlyByInstructions && explanationLineCount <= 8;
  const formulas = asset.important_formulas || "";
  const conceptNotes = asset.concept_notes || "";
  const examTraps = asset.exam_traps || "";

  const hasHighlights = !!asset.problem_text_ht_backup?.trim();
  const rawProblemText = stripRoleHints(showHighlights && hasHighlights
    ? asset.problem_text_ht_backup!
    : asset.problem_context || "");
  // Don't split problem text — splitLongText can break KV blocks across paragraphs
  const dissectorHighlights: DissectorHighlight[] = (!isPreview && showDissectorHighlights && asset._dissectorHighlights) || [];

  const shareUrl = `https://learn.surviveaccounting.com/solutions/${asset.asset_name}?preview=true`;

  // Payment link data for tiered paywall
  const chapterNum = chapter?.chapter_number || null;
  const fullPassLink = (paymentLinks || []).find((l: any) => l.link_type === "full_pass" && l.course_id === asset.course_id);
  const chapterLink = (paymentLinks || []).find((l: any) => l.link_type === "chapter" && l.chapter_id === asset.chapter_id);

  // Navy header height ≈ 48px
  const HEADER_HEIGHT = 48;

  return (
    <>
    {loadingScreen}
    <div className="min-h-screen relative" style={{ background: t.pageBg, opacity: isLoadingScreenVisible ? 0 : 1, transition: "opacity 0.4s ease" }}>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={seoCanonical} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={`Step-by-step accounting solution for ${seoRef}. Journal entries, exam traps, and key concepts — from Lee Ingram.`} />
        <meta property="og:image" content={seoImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content={seoCanonical} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Survive Accounting" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={`Step-by-step accounting solution for ${seoRef}. From Lee Ingram.`} />
        <meta name="twitter:image" content={seoImage} />
        {seoJsonLd && <script type="application/ld+json">{seoJsonLd}</script>}
      </Helmet>
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${AORAKI_URL})`, opacity: 0.06 }} />
        <div className="absolute inset-0" style={{ background: t.watermarkOverlay }} />
      </div>

      {/* ── Navy Header Bar + Preview Banner (sticky together) ── */}
      <div className="relative sticky top-0" style={{ zIndex: 20 }}>
        <header style={{ background: "#14213D", height: HEADER_HEIGHT }}>
          <div className="mx-auto px-4 sm:px-6 py-2.5 flex items-center" style={{ maxWidth: 1200 }}>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <img src={LOGO_URL} alt="Survive Accounting" className="h-7 sm:h-8 object-contain shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <span className="text-[11px] sm:text-[12px] text-white/50 truncate">Created by Lee Ingram · Tutor since 2015</span>
            </div>
          </div>
        </header>

        {/* ── Preview Countdown Banner ── */}
        {previewToken && tokenSession && tokenValidForAsset && (
          <div
            className="w-full text-center text-white font-bold text-[11px] sm:text-[13px] flex items-center justify-center gap-1 sm:gap-2 flex-wrap px-3 py-1.5 sm:py-0"
            style={{ background: "#CE1126", minHeight: 36 }}
          >
            {previewExpired ? (
              <>
                Your preview has expired —{" "}
                <a
                  href={enrollUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-bold hover:opacity-80"
                >
                  Get Full Access →
                </a>
              </>
            ) : (
              <>
                <span className="truncate max-w-[180px] sm:max-w-none inline-block align-middle">
                  🔓 Preview for {tokenSession.email}
                </span>
                <span className="whitespace-nowrap">
                  — <span className="font-mono">{countdown}</span> ·{" "}
                  <a
                    href={enrollUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-bold hover:opacity-80"
                  >
                    Get Full Access →
                  </a>
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Hero Section ── */}
      <div className="relative" style={{ zIndex: 5 }}>
        <div className="mx-auto px-4 sm:px-6 mt-4" style={{ maxWidth: 1200 }}>
          <span
            className="inline-block text-[11px] px-3 py-1 rounded-full"
            style={{ background: t.badgeBg, border: `1px solid ${t.badgeBorder}`, color: t.badgeColor }}
          >
            ✦ Survive the exam—think like an accountant
          </span>
        </div>

        <div className="mt-3" style={{ background: "rgba(248,249,250,0.9)", borderBottom: `1px solid ${t.border}` }}>
          <div className="mx-auto px-4 sm:px-6 py-4" style={{ maxWidth: 1200 }}>
            {/* Three-line header hierarchy */}
            <div className="min-w-0">
              <h1 className="text-[20px] font-bold leading-tight" style={{ color: "#131E35" }}>
                {courseDisplayName}
              </h1>
              {chapterLabel && (
                <p className="text-[15px] font-medium mt-0.5" style={{ color: t.textMuted }}>
                  {chapterLabel}
                </p>
              )}
              {problemTitle && (
                <p className="text-[12px] mt-0.5" style={{ color: t.textMuted }}>
                  Topic: {problemTitle}
                </p>
              )}
            </div>

            {/* Browse problems bar — below header with top border */}
            {isPreview && (
              <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${t.border}` }}>
                <BrowseProblemsBar currentAsset={asset} theme={t} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Floating Action Panel (desktop) ── */}
      {!isQaMode && <FloatingActionBar theme={t} shareUrl={shareUrl} assetCode={asset.asset_name} chapterId={asset.chapter_id} asset={asset} onShareClick={handleShareClick} onReportClick={() => setReportOpen(true)} showShare={shareButtonsVisible} isAdmin={isAdmin} courseCode={courseCode} />}

      {/* ── Two-Column Content ── */}
      <main className="relative mx-auto px-4 sm:px-6 py-6 sm:py-8" style={{ zIndex: 5, maxWidth: 1200 }}>
        <div className="flex flex-col lg:flex-row gap-0">

          {/* ── LEFT COLUMN: Problem + Instructions (sticky on desktop) ── */}
          <div
            className="w-full lg:w-[40%] lg:pr-6"
            style={{ borderRight: undefined }}
          >
            <div
              className="lg:sticky"
              style={{ top: HEADER_HEIGHT + 16 }}
            >
              <div
                className="rounded-xl px-4 sm:px-6 py-5 sm:py-6"
                style={{
                  background: t.pageBg,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03)",
                  border: `1px solid ${t.border}`,
                }}
              >
                {/* Source ref label */}
                {sourceRef && (
                  <h2 className="text-[11px] font-bold tracking-[0.15em] uppercase pb-1 mb-3" style={{ color: t.heading, borderBottom: `1px solid ${t.border}` }}>
                    Practice problem based on {sourceRef}
                  </h2>
                )}

                {/* Problem text */}
                {rawProblemText.trim() && (
                  <div>
                    {isQaMode && (
                      <div className="flex items-center gap-2 mb-2">
                        <QAEditButton onClick={() => setQaEditingField(qaEditingField === "problem" ? null : "problem")} />
                      </div>
                    )}
                    {qaEditingField === "problem" && isQaMode && (
                      <QAInlineEditorPanel
                        initialValue={asset.problem_context || ""}
                        label="Problem Text"
                        rows={16}
                        onSave={async (newVal) => {
                          const { error } = await supabase
                            .from("teaching_assets")
                            .update({ problem_context: newVal })
                            .eq("id", asset.id);
                          if (error) throw error;
                          setQaEditingField(null);
                          refetchAsset();
                        }}
                        onCancel={() => setQaEditingField(null)}
                      />
                    )}
                    {hasHighlights && (
                      <div className="flex items-center gap-2 mb-3">
                        <Switch checked={showHighlights} onCheckedChange={setShowHighlights} className="h-5 w-9" />
                        <span className="text-[12px]" style={{ color: t.textMuted }}>Show Highlights</span>
                      </div>
                    )}
                    {/* Dissector key info toggle + Practice PDF */}
                    {!isPreview && (asset._dissectorHighlights?.length > 0) && (
                      <div className="mb-3 flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setShowDissectorHighlights(v => !v)}
                          style={{
                            background: showDissectorHighlights ? "#fef9c3" : "#f1f5f9",
                            border: `1px solid ${showDissectorHighlights ? "#ca8a04" : "#e2e8f0"}`,
                            borderRadius: 20,
                            padding: "4px 12px",
                            fontSize: 11,
                            fontWeight: 600,
                            color: showDissectorHighlights ? "#92400e" : "#94a3b8",
                            cursor: "pointer",
                          }}
                        >
                          ✦ Key Info: {showDissectorHighlights ? "On" : "Off"}
                        </button>
                        <PracticePdfButton
                          sourceRef={sourceRef}
                          assetName={asset.asset_name}
                        />
                      </div>
                    )}
                    {/* Practice PDF button fallback when no dissector highlights or preview mode */}
                    {(isPreview || !(asset._dissectorHighlights?.length > 0)) && (
                      <div className="mb-3">
                        <PracticePdfButton
                          sourceRef={sourceRef}
                          assetName={asset.asset_name}
                        />
                      </div>
                    )}
                    {dissectorHighlights.length > 0 ? (
                      <div className="text-[14px] leading-[1.7] space-y-4">
                        <DissectorHighlightedText text={rawProblemText} highlights={dissectorHighlights} theme={t} />
                      </div>
                    ) : (
                      <SmartContent text={rawProblemText} className="text-[14px] leading-[1.7] space-y-4" theme={t} />
                    )}
                  </div>
                )}

                {/* INSTRUCTIONS */}
                {isQaMode && (
                  <div className="flex items-center gap-2 mt-4 mb-1">
                    <QAEditButton onClick={() => setQaEditingField(qaEditingField === "instructions" ? null : "instructions")} />
                    {!instructions.length && <span className="text-[11px]" style={{ color: t.textMuted }}>No instructions yet</span>}
                  </div>
                )}
                {qaEditingField === "instructions" && isQaMode && (
                  <QAInstructionsEditor
                    instructions={asset._instructions || []}
                    teachingAssetId={asset.id}
                    onSaved={() => { setQaEditingField(null); refetchAsset(); }}
                    onCancel={() => setQaEditingField(null)}
                  />
                )}
                {instructions.length > 0 && (() => {
                  // Detect repeated leading verb phrases across parts
                  const deduped = deduplicateInstructions(instructions);
                  return (
                    <>
                      <SectionHeading theme={t}>INSTRUCTIONS</SectionHeading>
                      <div className="space-y-4">
                        {deduped.sharedPrefix && (
                          <p className="text-[14px] leading-[1.6] font-bold" style={{ color: t.text }}>
                            {deduped.sharedPrefix}
                          </p>
                        )}
                        {deduped.parts.map((part, idx) => {
                          const letter = String.fromCharCode(97 + idx);
                          return (
                            <p key={idx} className="text-[14px] leading-[1.6]" style={{ color: t.text }}>
                              <span className="font-bold" style={{ color: "#131E35" }}>({letter})</span>{" "}{part}
                            </p>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>

            </div>

            {/* Subtle right border for desktop */}
            <div className="hidden lg:block absolute top-0 bottom-0" style={{ right: 0, width: 1, background: t.border }} />
          </div>

          {/* ── RIGHT COLUMN: Reveal Toggles + About + Testimonials ── */}
          <div className="w-full lg:w-[60%] lg:pl-6 mt-6 lg:mt-0">
            <div
              className="rounded-xl px-4 sm:px-6 py-5 sm:py-6"
              style={{
                background: t.pageBg,
                boxShadow: "0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03)",
                border: `1px solid ${t.border}`,
              }}
            >

              {/* 1. Solution */}
              {answerSummary.trim() && (
                <RevealToggle
                  label={isJEOnly ? "Reveal Calculations" : "Reveal Explanation"}
                  theme={t}
                  isPreview={isPreview}
                  enrollUrl={enrollUrl}
                  sectionName={isJEOnly ? "Calculations" : "Explanation"}
                  assetCode={asset.asset_name}
                  fullPassLink={fullPassLink}
                  chapterLink={chapterLink}
                  chapterNumber={chapterNum}
                  forceOpen={allTogglesForceOpen}
                  onReportClick={() => setReportOpen(true)}
                  onReveal={handleReveal}
                  onBuyClick={handleBuyClick}
                >
                  {isQaMode && (
                    <div className="flex items-center gap-2 mb-3">
                      <QAEditButton onClick={() => setQaEditingField(qaEditingField === "solution" ? null : "solution")} />
                    </div>
                  )}
                  {qaEditingField === "solution" && isQaMode ? (
                    <QAInlineEditorPanel
                      initialValue={asset.survive_solution_text || ""}
                      label="Explanation Text"
                      rows={20}
                      onSave={async (newVal) => {
                        const { error } = await supabase
                          .from("teaching_assets")
                          .update({ survive_solution_text: newVal })
                          .eq("id", asset.id);
                        if (error) throw error;
                        setQaEditingField(null);
                        refetchAsset();
                      }}
                      onCancel={() => setQaEditingField(null)}
                    />
                  ) : (
                    <AnswerSummarySection text={answerSummary} theme={t} instructions={asset._instructions} isJEOnly={isJEOnly} />
                  )}
                </RevealToggle>
              )}

              {/* 2. How to Solve This */}
              {(asset._flowcharts?.length > 0 || asset.flowchart_image_url) && (
                <RevealToggle label="Reveal How to Solve This" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} sectionName="How to Solve This" assetCode={asset.asset_name} fullPassLink={fullPassLink} chapterLink={chapterLink} chapterNumber={chapterNum} forceOpen={allTogglesForceOpen} onReportClick={() => setReportOpen(true)}>
                  {asset._flowcharts?.length > 1 ? (
                    <div className="space-y-2">
                      {asset._flowcharts.map((fc: any) => {
                        const instr = (asset._instructions || []).find(
                          (ins: any) => ins.instruction_number === fc.instruction_number
                        );
                        const letter = fc.instruction_label || String.fromCharCode(96 + fc.instruction_number);
                        const text = instr?.instruction_text || `Part ${letter}`;
                        return (
                          <FlowchartSubToggle
                            key={fc.instruction_number}
                            letter={letter}
                            instructionText={text}
                            imageUrl={fc.flowchart_image_url}
                            theme={t}
                          />
                        );
                      })}
                    </div>
                  ) : asset._flowcharts?.length === 1 ? (
                    <FlowchartImage src={asset._flowcharts[0].flowchart_image_url} alt="How to Solve This — step-by-step flowchart" />
                  ) : (
                    <FlowchartImage src={asset.flowchart_image_url} alt="How to Solve This — step-by-step flowchart" />
                  )}
                </RevealToggle>
              )}

              {/* 3. Journal Entries */}
              {hasJE && (
                <RevealToggle label="Reveal Journal Entries" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} sectionName="Journal Entries" assetCode={asset.asset_name} fullPassLink={fullPassLink} chapterLink={chapterLink} chapterNumber={chapterNum} forceOpen={allTogglesForceOpen} onReportClick={() => setReportOpen(true)}>
                  {isPreview ? (
                    <JEPreviewTeaser jeData={jeData} jeBlock={jeBlock} hasCanonicalJE={!!hasCanonicalJE} theme={t} enrollUrl={enrollUrl} />
                  ) : (
                    hasCanonicalJE ? (
                      <CanonicalJESection data={typeof jeData === "string" ? JSON.parse(jeData) : jeData} theme={t} instructions={asset._instructions} />
                    ) : (
                      <RawJEFallback text={jeBlock} theme={t} />
                    )
                  )}
                </RevealToggle>
              )}

              {/* 3b. Chapter-Level Journal Entries — replaces per-asset Related JEs */}
              {chapterJEData && chapterJEData.entries.length > 0 && (
                <RevealToggle label={`Reveal Ch ${chapterNum || "?"} — Journal Entries`} theme={t} isPreview={isPreview} enrollUrl={enrollUrl} sectionName="Related Journal Entries" assetCode={asset.asset_name} fullPassLink={fullPassLink} chapterLink={chapterLink} chapterNumber={chapterNum} forceOpen={allTogglesForceOpen} onReportClick={() => setReportOpen(true)}>
                  <ChapterJEAccordion categories={chapterJEData.categories} entries={chapterJEData.entries} theme={t} />
                </RevealToggle>
              )}

              {/* 4. Important Formulas — hidden in QA mode */}
              {formulas.trim() && !isQaMode && (
                <RevealToggle label="Reveal Important Formulas" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} sectionName="Important Formulas" assetCode={asset.asset_name} fullPassLink={fullPassLink} chapterLink={chapterLink} chapterNumber={chapterNum} forceOpen={allTogglesForceOpen} onReportClick={() => setReportOpen(true)}>
                  <GroupedFormulas text={formulas} theme={t} />
                </RevealToggle>
              )}

              {/* 4b. Ch [N] — Important Formulas (chapter-level, not paywalled) */}
              {chapterFormulas && chapterFormulas.length > 0 && (
                <RevealToggle label={`Reveal Ch ${chapterNum || "?"} — Important Formulas`} theme={t} isPreview={false} enrollUrl={enrollUrl} sectionName="Chapter Formulas" assetCode={asset.asset_name} fullPassLink={fullPassLink} chapterLink={chapterLink} chapterNumber={chapterNum} forceOpen={allTogglesForceOpen} onReportClick={() => setReportOpen(true)}>
                  <ChapterFormulaCarousel formulas={chapterFormulas} />
                </RevealToggle>
              )}

              {/* 5. Key Concepts — hidden in QA mode */}
              {conceptNotes.trim() && !isQaMode && (
                <RevealToggle label="Reveal Key Concepts" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} sectionName="Key Concepts" assetCode={asset.asset_name} fullPassLink={fullPassLink} chapterLink={chapterLink} chapterNumber={chapterNum} forceOpen={allTogglesForceOpen} onReportClick={() => setReportOpen(true)}>
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

              {/* 6. Exam Traps — hidden in QA mode */}
              {examTraps.trim() && !isQaMode && (
                <RevealToggle label="Reveal Exam Traps" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} sectionName="Exam Traps" assetCode={asset.asset_name} fullPassLink={fullPassLink} chapterLink={chapterLink} chapterNumber={chapterNum} forceOpen={allTogglesForceOpen} onReportClick={() => setReportOpen(true)}>
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

      <ReportIssueModal open={reportOpen} onClose={() => setReportOpen(false)} asset={asset} isAdmin={isAdmin} />
    </div>
    </>
  );
}
