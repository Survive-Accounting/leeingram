import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Unlock, Copy, AlertTriangle, ChevronDown } from "lucide-react";
import { isCanonicalJE, type CanonicalJEPayload } from "@/lib/journalEntryParser";
import { naturalSortRef } from "@/lib/utils";
import { toast } from "sonner";
import { useEnrollUrl } from "@/hooks/useEnrollUrl";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
const LEE_HEADSHOT_URL = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/ab9844f22ec569cdc37f3bf9da363c50.jpg";

// ── Theme colors (same as SolutionsViewer) ──────────────────────────

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
};

const darkTheme = {
  pageBg: "#0F1623",
  cardBg: "#1A2333",
  text: "rgba(255,255,255,0.85)",
  textMuted: "rgba(255,255,255,0.5)",
  heading: "rgba(255,255,255,0.5)",
  border: "rgba(255,255,255,0.08)",
  answerBg: "#0D2B1A",
  answerBorder: "#1B8A3E",
  formulaBg: "#1A1600",
  formulaBorder: "#D97706",
  trapBg: "#2B0D0D",
  trapBorder: "#C0392B",
  tableHeaderBg: "#1A2E55",
  tableAltBg: "#151E2C",
  toggleBg: "#1E2A3A",
  badgeColor: "rgba(0, 200, 150, 0.9)",
  badgeBg: "rgba(0, 200, 150, 0.12)",
  badgeBorder: "rgba(0, 200, 150, 0.3)",
};

type Theme = typeof lightTheme;

// ── Pipe table helpers ──────────────────────────────────────────────

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
  const segments: { type: "text" | "table" | "kv-table"; content: string; rows?: string[][] }[] = [];
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
          !(isKVLine(lines[i]) && i < lines.length - 1 && isKVLine(lines[i + 1]))
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

function SmartContent({ text, className, theme }: { text: string; className?: string; theme: Theme }) {
  const segments = parsePipeSegments(text);
  return (
    <div className={className}>
      {segments.map((seg, i) =>
        seg.type === "table" && seg.rows
          ? <PipeTable key={i} rows={seg.rows} theme={theme} />
          : seg.type === "kv-table" && seg.rows
            ? <KVTable key={i} rows={seg.rows} theme={theme} />
            : <p key={i} className="whitespace-pre-wrap">{seg.content}</p>
      )}
    </div>
  );
}

// ── Strip trailing requirements ─────────────────────────────────────

function stripTrailingRequirements(text: string): string {
  if (!text.trim()) return text;
  const lines = text.split("\n");
  let end = lines.length;
  while (end > 0) {
    const trimmed = lines[end - 1].trim();
    if (
      !trimmed ||
      /^\s*\(?[a-zA-Z]\)\s+\S/.test(lines[end - 1]) ||
      /^\s*-\s*\(?[a-zA-Z]\)\s+\S/.test(lines[end - 1])
    ) {
      end--;
    } else {
      break;
    }
  }
  if (end === lines.length) return text;
  return lines.slice(0, end).join("\n").trimEnd();
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

// ── Section heading ─────────────────────────────────────────────────

function SectionHeading({ children, theme }: { children: React.ReactNode; theme: Theme }) {
  return (
    <h2 className="text-[11px] font-bold tracking-[0.15em] uppercase pb-1 mb-3 mt-8" style={{ color: theme.heading, borderBottom: `1px solid ${theme.border}` }}>
      {children}
    </h2>
  );
}

// ── Reveal Toggle (same as SolutionsViewer) ─────────────────────────

function RevealToggle({
  label,
  children,
  theme,
  isPreview,
  enrollUrl,
  revealed,
  onToggle,
}: {
  label: string;
  children: React.ReactNode;
  theme: Theme;
  isPreview: boolean;
  enrollUrl: string;
  revealed: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="rounded-lg mt-4 overflow-hidden transition-all"
      style={{ background: theme.toggleBg, border: `1px solid ${theme.border}` }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors"
        style={{ color: theme.textMuted }}
      >
        <span className="flex items-center gap-2 text-[13px]">
          {revealed ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {label}
        </span>
        <span className="flex items-center gap-1.5 text-[12px]">
          {revealed ? `Hide ${label.replace("Reveal ", "")}` : label}
          <ChevronDown
            className="h-3.5 w-3.5 transition-transform"
            style={{ transform: revealed ? "rotate(180deg)" : "rotate(0)" }}
          />
        </span>
      </button>
      {revealed && (
        <div className="px-5 pb-4 pt-3" style={{ borderTop: `1px solid ${theme.border}` }}>
          {isPreview ? (
            <div className="rounded-lg px-6 py-6 text-center" style={{ background: "linear-gradient(135deg, #0F1623, #1A2E55)" }}>
              <p className="text-[16px] font-bold text-white">🔒 Study Pass Required</p>
              <p className="text-[13px] mt-2" style={{ color: "rgba(255,255,255,0.7)" }}>
                Unlock full solutions, journal entries, formulas, exam traps, and more for every Intermediate Accounting 2 problem.
              </p>
              <a
                href={enrollUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 px-6 py-2.5 rounded-md font-bold text-[14px] transition-all hover:scale-105"
                style={{ background: "#00FFFF", color: "#0A0A0A" }}
              >
                Get Study Pass →
              </a>
              <p className="text-[11px] mt-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                7-day refund policy · Access all semester
              </p>
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}

// ── JE Tables ───────────────────────────────────────────────────────

function JETable({ entries, theme }: { entries: any[]; theme: Theme }) {
  return (
    <div className="space-y-4">
      {entries.map((entry: any, ei: number) => {
        const date = entry.entry_date || entry.date || "";
        const rows = entry.rows || entry.accounts || [];
        return (
          <div key={ei}>
            {date && <p className="font-bold text-sm mb-1" style={{ color: theme.text }}>{date}</p>}
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
                        <td className={`px-3 py-1.5 text-[13px] ${isCredit ? "pl-10" : ""}`} style={{ color: theme.text }}>{row.account_name || row.account || ""}</td>
                        <td className="text-right px-3 py-1.5 text-[13px] font-mono" style={{ color: theme.text }}>{!isCredit && row.debit != null && row.debit !== 0 ? Number(row.debit).toLocaleString("en-US") : ""}</td>
                        <td className="text-right px-3 py-1.5 text-[13px] font-mono" style={{ color: theme.text }}>{isCredit && row.credit != null ? Number(row.credit).toLocaleString("en-US") : ""}</td>
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
  const allEntries: any[] = [];
  for (const section of data.scenario_sections) {
    for (const entry of section.entries_by_date) allEntries.push(entry);
  }
  return <JETable entries={allEntries} theme={theme} />;
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

// ── Answer Summary ──────────────────────────────────────────────────

const SEPARATOR_RE = /^(Final Answer|Part\s*\(?[a-z]\)?|Situation\s+[A-Z]|Case\s+[A-Z]):/i;
const BG_TAG_RE = /^<bg:(red|yellow)>(.*)<\/bg:\1>$/;

function renderBoldInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

function AnswerSummarySection({ text, theme, instructions }: { text: string; theme: Theme; instructions?: { instruction_number: number; instruction_text: string }[] }) {
  const lines = text.split('\n');

  // Group consecutive non-empty lines into blocks (blank lines = block break)
  const blocks: { type: 'block'; lines: { raw: string; trimmed: string; origIdx: number }[] }[] = [];
  let current: { raw: string; trimmed: string; origIdx: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      if (current.length > 0) {
        blocks.push({ type: 'block', lines: [...current] });
        current = [];
      }
    } else {
      current.push({ raw: lines[i], trimmed, origIdx: i });
    }
  }
  if (current.length > 0) blocks.push({ type: 'block', lines: [...current] });

  function renderLine(trimmed: string, key: string | number) {
    // Background color tags: <bg:red>...</bg:red> or <bg:yellow>...</bg:yellow>
    const bgMatch = trimmed.match(BG_TAG_RE);
    if (bgMatch) {
      const color = bgMatch[1] as "red" | "yellow";
      const inner = bgMatch[2];
      if (color === "red") {
        return (
          <div key={key} style={{
            fontFamily: 'monospace',
            fontSize: 13,
            background: '#FEF2F2',
            color: '#991B1B',
            borderLeft: '3px solid #CE1126',
            borderRadius: 3,
            padding: '3px 10px',
            marginBottom: 3,
          }}>
            {renderBoldInline(inner)}
          </div>
        );
      }
      return (
        <div key={key} style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 13,
          background: '#FEFCE8',
          borderLeft: '3px solid #D97706',
          borderRadius: 3,
          padding: '3px 10px',
          marginBottom: 3,
          color: theme.text,
        }}>
          {renderBoldInline(inner)}
        </div>
      );
    }

    // Separator labels: Final Answer, Part (a):, Situation A:, Case A:
    const sepMatch = trimmed.match(SEPARATOR_RE);
    if (sepMatch) {
      const colonIdx = trimmed.indexOf(':');
      const label = trimmed.slice(0, colonIdx + 1);
      const rest = trimmed.slice(colonIdx + 1).trim();
      return (
        <div key={key}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            color: theme.text,
            opacity: 0.5,
            marginTop: 16,
            marginBottom: 4,
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.05em',
          }}>
            {label}
          </div>
          {rest && (
            <div style={{
              fontFamily: 'monospace',
              fontSize: 13,
              background: theme.answerBg,
              color: (theme as any).answerColor || '#991B1B',
              borderLeft: '3px solid ' + theme.answerBorder,
              borderRadius: 3,
              padding: '3px 10px',
              marginBottom: 3,
            }}>
              {renderBoldInline(rest)}
            </div>
          )}
        </div>
      );
    }

    // Step labels
    if (/^Step \d+/i.test(trimmed)) {
      return (
        <p key={key} style={{
          fontSize: 13,
          fontWeight: 600,
          color: theme.text,
          marginTop: 14,
          marginBottom: 6,
          fontFamily: 'Inter, sans-serif'
        }}>
          {renderBoldInline(trimmed)}
        </p>
      );
    }

    // Default: monospace code block line
    return (
      <div key={key} style={{
        fontFamily: 'monospace',
        fontSize: 13,
        background: theme.answerBg,
        color: (theme as any).answerColor || '#991B1B',
        borderLeft: '3px solid ' + theme.answerBorder,
        borderRadius: 3,
        padding: '3px 10px',
        marginBottom: 3,
        display: 'block'
      }}>
        {renderBoldInline(trimmed)}
      </div>
    );
  }

  return (
    <div>
      {blocks.map((block, bi) => (
        <div key={bi} className="rounded-md p-4 pl-5 border-l-[3px]" style={{
          background: theme.answerBg,
          borderColor: theme.answerBorder,
          marginBottom: bi < blocks.length - 1 ? 12 : 0,
        }}>
          {block.lines.map((l, li) => renderLine(l.trimmed, `${bi}-${li}`))}
        </div>
      ))}
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
      await supabase.from("asset_issue_reports").insert({
        teaching_asset_id: asset.id,
        asset_name: asset.asset_name,
        reporter_email: email.trim() || null,
        message: message.trim(),
      });
      supabase.functions.invoke("send-issue-report", {
        body: { asset_name: asset.asset_name, source_ref: asset.source_ref, reporter_email: email.trim() || "Anonymous", message: message.trim() },
      }).catch(() => {});
      toast.success("Report submitted — thank you!");
      setEmail("");
      setMessage("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report an Issue</DialogTitle>
          <DialogDescription>{asset.source_ref} · {asset.asset_name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Email (optional)</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com (optional — for follow-up)" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Message</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe the issue — wrong answer, typo, missing info, etc." rows={4} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost" size="sm">Cancel</Button></DialogClose>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>{submitting ? "Sending…" : "Send Report"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Chapter Navigator (preview only) ────────────────────────────────

const COURSE_OPTIONS = [
  { code: "FA1", label: "Financial Accounting" },
  { code: "MA2", label: "Managerial Accounting" },
  { code: "IA1", label: "Intermediate 1" },
  { code: "IA2", label: "Intermediate 2" },
];

function ChapterNavigator({ currentAsset, theme }: { currentAsset: any; theme: Theme }) {
  const navigate = useNavigate();
  const currentCourseCode = currentAsset.courses?.code || "IA2";
  const currentChapterId = currentAsset.chapter_id;

  const [selectedCourse, setSelectedCourse] = useState(currentCourseCode);
  const [selectedChapterId, setSelectedChapterId] = useState(currentChapterId || "");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedAssetName, setSelectedAssetName] = useState("");

  const { data: chapters } = useQuery({
    queryKey: ["browse-chapters-nav-practice", selectedCourse],
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
      setSelectedAssetName("");
    }
  }, [selectedCourse, currentCourseCode]);

  const { data: chapterAssets } = useQuery({
    queryKey: ["nav-assets-practice", selectedChapterId, selectedType],
    queryFn: async () => {
      if (!selectedChapterId) return [] as any[];
      const { data } = await supabase
        .from("teaching_assets")
        .select("asset_name, source_ref")
        .eq("chapter_id", selectedChapterId)
        .not("asset_approved_at", "is", null)
        .order("source_ref");
      let filtered = data || [];
      if (selectedType !== "all") {
        filtered = filtered.filter((a: any) => {
          const ref = (a.source_ref || "").toUpperCase();
          if (selectedType === "BE") return ref.startsWith("BE");
          if (selectedType === "E") return ref.startsWith("E") && !ref.startsWith("EX");
          if (selectedType === "P") return ref.startsWith("P");
          return true;
        });
      }
      return filtered.sort((a: any, b: any) => naturalSortRef(a.source_ref, b.source_ref));
    },
    enabled: !!selectedChapterId,
  });

  const handleGo = () => {
    const target = selectedAssetName || (chapterAssets && chapterAssets[0]?.asset_name);
    if (target) navigate(`/practice/${target}?preview=true`);
  };

  return (
    <div className="rounded-lg px-5 py-3 mb-4" style={{ background: theme.toggleBg, border: `1px solid ${theme.border}` }}>
      <p className="text-[11px] font-bold tracking-[0.1em] uppercase mb-2" style={{ color: theme.textMuted }}>Browse Example Problems</p>
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
        <div className="flex-1">
          <Select value={selectedCourse} onValueChange={(v) => { setSelectedCourse(v); setSelectedChapterId(""); setSelectedAssetName(""); }}>
            <SelectTrigger className="h-8 text-xs" style={{ background: theme.pageBg, borderColor: theme.border, color: theme.text }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COURSE_OPTIONS.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Select value={selectedChapterId} onValueChange={(v) => { setSelectedChapterId(v); setSelectedAssetName(""); }}>
            <SelectTrigger className="h-8 text-xs" style={{ background: theme.pageBg, borderColor: theme.border, color: theme.text }}>
              <SelectValue placeholder="Chapter" />
            </SelectTrigger>
            <SelectContent>
              {(chapters || []).map((ch: any) => (
                <SelectItem key={ch.id} value={ch.id}>Ch {ch.chapter_number} — {ch.chapter_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-36">
          <Select value={selectedType} onValueChange={(v) => { setSelectedType(v); setSelectedAssetName(""); }}>
            <SelectTrigger className="h-8 text-xs" style={{ background: theme.pageBg, borderColor: theme.border, color: theme.text }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="BE">Brief Exercise (BE)</SelectItem>
              <SelectItem value="E">Exercise (E)</SelectItem>
              <SelectItem value="P">Problem (P)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Select value={selectedAssetName} onValueChange={setSelectedAssetName}>
            <SelectTrigger className="h-8 text-xs" style={{ background: theme.pageBg, borderColor: theme.border, color: theme.text }}>
              <SelectValue placeholder="Source #" />
            </SelectTrigger>
            <SelectContent>
              {(chapterAssets || []).map((a: any) => (
                <SelectItem key={a.asset_name} value={a.asset_name}>{a.source_ref}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="h-8 text-xs px-4" onClick={handleGo}>Go →</Button>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────

export default function PracticeViewer() {
  const { assetCode } = useParams<{ assetCode: string }>();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get("preview") === "true";
  const enrollUrl = useEnrollUrl();

  // Theme — light only
  const isDark = false;
  const t = lightTheme;

  // Highlight toggle
  const [showHighlights, setShowHighlights] = useState(false);

  // Report modal
  const [reportOpen, setReportOpen] = useState(false);

  // Practice-specific reveal state
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const toggle = useCallback((key: string) => {
    setRevealed(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Fetch asset with chapter+course join
  const { data, isLoading } = useQuery({
    queryKey: ["practice-viewer", assetCode],
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
          instruction_list, flowchart_image_url,
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

      return { ...asset, _problemTitle: asset.problem_title || "", _instructions: instrData || [] };
    },
    enabled: !!assetCode,
  });

  // Track page view
  useEffect(() => {
    if (!data?.id) return;
    const key = `practice_viewed_${data.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    supabase.rpc("increment_practice_views", { asset_id: data.id }).then(() => {});
  }, [data?.id]);

  // Page title
  useEffect(() => {
    if (!data) return;
    const ref = data.source_ref || data.asset_name || "";
    const pt = data._problemTitle || "";
    document.title = pt ? `${ref} — ${pt} | Survive Accounting` : `${ref} | Survive Accounting`;
    return () => { document.title = "Survive Accounting"; };
  }, [data]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: t.pageBg }}>
        <div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: t.border, borderTopColor: t.text }} />
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

  const asset = data;
  const chapter = (asset as any).chapters;
  const course = (asset as any).courses;

  const chapterLabel = chapter?.chapter_number && chapter?.chapter_name
    ? `Ch ${chapter.chapter_number} — ${chapter.chapter_name}`
    : "";
  const courseCode = course?.code || "";
  const identifierLine = [courseCode, chapterLabel].filter(Boolean).join(" · ");
  const problemTitle = asset._problemTitle || "";
  const titleLine = problemTitle
    ? `${asset.source_ref || asset.asset_name} — ${problemTitle}`
    : (asset.source_ref || asset.asset_name);

  // Instructions: priority 1 = problem_instructions table, 2 = instruction_1-5, 3 = instruction_list
  let instructions: string[] = (asset._instructions || [])
    .sort((a: any, b: any) => a.instruction_number - b.instruction_number)
    .filter((i: any) => i.instruction_text?.trim())
    .map((i: any) => i.instruction_text);
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

  const answerSummary = asset.survive_solution_text || "";
  const formulas = asset.important_formulas || "";
  const conceptNotes = asset.concept_notes || "";
  const examTraps = asset.exam_traps || "";
  const quizLink = asset.lw_quiz_url || null;
  const whiteboardLink = asset.sheet_master_url || null;
  const videoLink = asset.lw_video_url || null;
  const hasFooterLinks = quizLink || whiteboardLink || videoLink;

  const hasHighlights = !!asset.problem_text_ht_backup?.trim();
  const rawProblemTextRaw = showHighlights && hasHighlights
    ? asset.problem_text_ht_backup!
    : asset.problem_context || "";
  const rawProblemText = stripTrailingRequirements(rawProblemTextRaw);
  const problemParagraphs = splitLongText(rawProblemText);

  // Reveal sections progress tracker
  const revealSections: { key: string; exists: boolean }[] = [
    { key: "solution", exists: !!answerSummary.trim() },
    { key: "je", exists: !!hasJE },
    { key: "formulas", exists: !!formulas.trim() },
    { key: "concepts", exists: !!conceptNotes.trim() },
    { key: "traps", exists: !!examTraps.trim() },
  ];
  const availableSections = revealSections.filter(s => s.exists);
  const revealedCount = availableSections.filter(s => revealed[s.key]).length;
  const totalSections = availableSections.length;
  const allRevealed = totalSections > 0 && revealedCount === totalSections;

  const shareUrl = `https://learn.surviveaccounting.com/practice/${asset.asset_name}`;

  return (
    <div className="min-h-screen" style={{ background: t.pageBg }}>
      {/* ── Top Bar ── */}
      <header style={{ borderBottom: `2px solid ${t.border}` }}>
        <div className="max-w-[780px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full shrink-0 overflow-hidden" style={{ background: "#131E35" }}>
              <img
                src={LEE_HEADSHOT_URL}
                alt="Lee Ingram"
                className="h-8 w-8 object-cover"
                style={{ objectPosition: "top center", borderRadius: "50%" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div>
              <p className="font-bold text-[15px] leading-tight" style={{ color: t.text }}>Survive Accounting</p>
              <p className="text-[11px]" style={{ color: t.textMuted }}>by Lee Ingram</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Marketing Badge ── */}
      <div className="max-w-[780px] mx-auto px-6 mt-3">
        <span
          className="inline-block text-[11px] px-3 py-1 rounded-full"
          style={{
            background: t.badgeBg,
            border: `1px solid ${t.badgeBorder}`,
            color: t.badgeColor,
          }}
        >
          ✦ Deeper than a solutions manual — built from 10+ years of accounting tutoring experience
        </span>
      </div>

      {/* ── Identifier Bar ── */}
      <div style={{ background: t.cardBg, borderBottom: `1px solid ${t.border}` }} className="mt-3">
        <div className="max-w-[780px] mx-auto px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-[14px]" style={{ color: isDark ? "#FFFFFF" : "#131E35" }}>
              <span className="font-bold">{asset.source_ref || asset.asset_name}</span>
              {problemTitle && <span style={{ color: t.textMuted }}> — </span>}
              {problemTitle && <span>{problemTitle}</span>}
            </p>
            {identifierLine && <p className="text-[12px] mt-0.5" style={{ color: t.textMuted }}>{identifierLine}</p>}
            <a
              href={`mailto:lee@surviveaccounting.com?subject=Video Request: ${asset.asset_name}&body=I would like a video explanation for ${asset.source_ref || ""} (${asset.asset_name}).`}
              className="text-[12px] hover:underline mt-0.5 inline-block"
              style={{ color: "#3B82F6" }}
            >
              Request Video Explanation →
            </a>
          </div>
          <div className="flex items-center gap-2">
            {/* Progress indicator */}
            <span className="text-[11px] rounded-full px-3 py-1" style={{ color: t.textMuted, background: t.pageBg, border: `1px solid ${t.border}` }}>
              {allRevealed ? "✓ All revealed" : `${revealedCount}/${totalSections} revealed`}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Practice link copied!"); }}
            >
              <Copy className="h-3 w-3 mr-1" /> Share
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 border-amber-400 text-amber-600 hover:bg-amber-50"
              onClick={() => setReportOpen(true)}
            >
              <AlertTriangle className="h-3 w-3 mr-1" /> Report Issue
            </Button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <main className="max-w-[780px] mx-auto px-6 py-8">

        {/* ── Chapter navigator (preview only) ── */}
        {isPreview && <ChapterNavigator currentAsset={asset} theme={t} />}

        {/* Problem text — always visible */}
        {rawProblemText.trim() && (
          <div>
            {hasHighlights && (
              <div className="flex items-center gap-2 mb-3">
                <Switch checked={showHighlights} onCheckedChange={setShowHighlights} className="h-5 w-9" />
                <span className="text-[12px]" style={{ color: t.textMuted }}>Show Highlights</span>
              </div>
            )}
            <div className="space-y-4">
              {problemParagraphs.map((para, i) => (
                <SmartContent key={i} text={para} className="text-[14px] leading-[1.7]" theme={t} />
              ))}
            </div>
          </div>
        )}

        {/* INSTRUCTIONS — always visible */}
        {instructions.length > 0 && (
          <>
            <SectionHeading theme={t}>INSTRUCTIONS</SectionHeading>
            <div className="space-y-4">
              {instructions.map((inst, idx) => {
                const letter = String.fromCharCode(97 + idx);
                return (
                  <p key={idx} className="text-[14px] leading-[1.6]" style={{ color: t.text }}>
                    <span className="font-bold" style={{ color: isDark ? "#FFFFFF" : "#131E35" }}>({letter})</span>{" "}{inst}
                  </p>
                );
              })}
            </div>
          </>
        )}

        {/* ── Reveal Toggles ── */}

        {/* 1. Solution */}
        {answerSummary.trim() && (
          <RevealToggle label="Reveal Explanation" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} revealed={!!revealed.solution} onToggle={() => toggle("solution")}>
            <AnswerSummarySection text={answerSummary} theme={t} instructions={asset._instructions} />
          </RevealToggle>
        )}

        {/* 2. Journal Entries */}
        {hasJE && (
          <RevealToggle label="Reveal Journal Entries" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} revealed={!!revealed.je} onToggle={() => toggle("je")}>
            {hasCanonicalJE ? (
              <CanonicalJESection data={typeof jeData === "string" ? JSON.parse(jeData) : jeData} theme={t} />
            ) : (
              <RawJEFallback text={jeBlock} theme={t} />
            )}
          </RevealToggle>
        )}

        {/* 3. How to Solve This (flowchart) */}
        {asset.flowchart_image_url && (
          <RevealToggle label="Reveal How to Solve This" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} revealed={!!revealed.flowchart} onToggle={() => toggle("flowchart")}>
            <img
              src={asset.flowchart_image_url}
              alt="How to Solve This — step-by-step flowchart"
              className="w-full rounded-lg"
              loading="lazy"
            />
          </RevealToggle>
        )}

        {/* 4. Important Formulas */}
        {formulas.trim() && (
          <RevealToggle label="Reveal Important Formulas" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} revealed={!!revealed.formulas} onToggle={() => toggle("formulas")}>
            <div className="space-y-2">
              {formulas.split("\n").filter((l: string) => l.trim()).map((line: string, i: number) => (
                <div key={i} className="rounded px-4 py-2 border-l-[3px]" style={{ background: t.formulaBg, borderColor: t.formulaBorder }}>
                  <p className="font-mono text-[13px]" style={{ color: t.text }}>{line}</p>
                </div>
              ))}
            </div>
          </RevealToggle>
        )}

        {/* 4. Key Concepts */}
        {conceptNotes.trim() && (
          <RevealToggle label="Reveal Key Concepts" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} revealed={!!revealed.concepts} onToggle={() => toggle("concepts")}>
            <ul className="space-y-2">
              {conceptNotes.split(". ").filter((s: string) => s.trim()).map((sentence: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-[13px] leading-[1.6]" style={{ color: t.text }}>
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: isDark ? "#00BFFF" : "#131E35" }} />
                  <span>{sentence.endsWith(".") ? sentence : sentence + "."}</span>
                </li>
              ))}
            </ul>
          </RevealToggle>
        )}

        {/* 5. Exam Traps */}
        {examTraps.trim() && (
          <RevealToggle label="Reveal Exam Traps" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} revealed={!!revealed.traps} onToggle={() => toggle("traps")}>
            <div className="rounded-md p-4 pl-5 border-l-[3px]" style={{ background: t.trapBg, borderColor: t.trapBorder }}>
              <ul className="space-y-2">
                {examTraps.split(". ").filter((s: string) => s.trim()).map((sentence: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] leading-[1.6]" style={{ color: "#C0392B" }}>
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#C0392B" }} />
                    <span>{sentence.endsWith(".") ? sentence : sentence + "."}</span>
                  </li>
                ))}
              </ul>
            </div>
          </RevealToggle>
        )}

        {/* ── About Lee Card ── */}
        <div className="mt-12 rounded-xl p-6" style={{ background: t.cardBg, border: `1px solid ${t.border}` }}>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="sm:w-[30%] flex flex-col items-center text-center shrink-0">
              <img
                src={LEE_HEADSHOT_URL}
                alt="Lee Ingram"
                className="w-full object-cover"
                style={{ maxWidth: 220, borderRadius: 12 }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <p className="font-bold text-[14px] mt-3" style={{ color: t.text }}>Lee Ingram</p>
              <p className="text-[12px]" style={{ color: t.textMuted }}>Ole Miss ACCY Tutor since 2015</p>
            </div>
            <div className="sm:w-[70%]">
              <p className="font-bold text-[13px] mb-2" style={{ color: t.text }}>About Lee Ingram</p>
              <p className="text-[13px] leading-[1.6]" style={{ color: t.text }}>
                Ole Miss Accounting alum · B.A. &amp; M.Acc. · 3.75 GPA
              </p>
              <p className="text-[13px] leading-[1.6] mt-3" style={{ color: t.text }}>
                Tutoring entrepreneur since 2015, building exam prep from thousands of real Ole Miss tutoring sessions.
              </p>
              <p className="text-[12px] mt-3" style={{ color: t.textMuted }}>
                Join 2,000+ Ole Miss students I've helped since 2015.
              </p>
              <a href="mailto:lee@surviveaccounting.com" className="text-[12px] mt-1 inline-block hover:underline" style={{ color: "#3B82F6" }}>
                📨 lee@surviveaccounting.com
              </a>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="mt-8 pt-4" style={{ borderTop: `1px solid ${t.border}` }}>
          {hasFooterLinks && (
            <p className="text-center text-[13px] mb-3">
              {quizLink && <a href={quizLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">📝 Practice Quiz</a>}
              {quizLink && (whiteboardLink || videoLink) && <span className="mx-2" style={{ color: t.border }}>·</span>}
              {whiteboardLink && <a href={whiteboardLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">📊 Whiteboard</a>}
              {whiteboardLink && videoLink && <span className="mx-2" style={{ color: t.border }}>·</span>}
              {videoLink && <a href={videoLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">🎬 Video Walkthrough</a>}
            </p>
          )}
          <p className="text-center text-[11px]" style={{ color: t.textMuted }}>
            Survive Accounting · surviveaccounting.com
          </p>
          <p className="text-center mt-2">
            <a href={`/solutions/${asset.asset_name}`} className="text-[12px] hover:underline" style={{ color: "#3B82F6" }}>
              → View Full Solutions
            </a>
          </p>
          <p className="text-center mt-1">
            <button onClick={() => setReportOpen(true)} className="text-[11px] hover:underline" style={{ color: t.textMuted }}>
              Report Issue
            </button>
          </p>
        </div>
      </main>

      <ReportIssueModal open={reportOpen} onOpenChange={setReportOpen} asset={asset} />
    </div>
  );
}
