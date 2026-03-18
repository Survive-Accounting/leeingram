import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Lock, Unlock, Copy, AlertTriangle, ChevronDown, Sun, Moon, Video, X, BookOpen, CheckCircle, Calendar } from "lucide-react";
import { isCanonicalJE, type CanonicalJEPayload } from "@/lib/journalEntryParser";
import { toast } from "sonner";
import { useEnrollUrl } from "@/hooks/useEnrollUrl";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LOGO_URL = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf121ac35937c4d438ca.png";
const AORAKI_URL = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/88d6f7c98cfeb62f0e339a7648214ace.png";
const LEE_HEADSHOT_URL = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/ab9844f22ec569cdc37f3bf9da363c50.jpg";

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
  watermarkOverlay: "rgba(15,22,35,0.93)",
};

type Theme = typeof lightTheme;

// ── Pipe table helpers ──────────────────────────────────────────────

function parsePipeSegments(text: string) {
  const lines = text.split("\n");
  const segments: { type: "text" | "table"; content: string; rows?: string[][] }[] = [];
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
      const start = i;
      while (i < lines.length && !(i < lines.length - 1 && lines[i].includes("|") && lines[i + 1].includes("|"))) i++;
      const block = lines.slice(start, i).join("\n");
      if (block.trim()) segments.push({ type: "text", content: block });
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

function SmartContent({ text, className, theme }: { text: string; className?: string; theme: Theme }) {
  const segments = parsePipeSegments(text);
  return (
    <div className={className}>
      {segments.map((seg, i) =>
        seg.type === "table" && seg.rows
          ? <PipeTable key={i} rows={seg.rows} theme={theme} />
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

// ── Section heading ─────────────────────────────────────────────────

function SectionHeading({ children, theme }: { children: React.ReactNode; theme: Theme }) {
  return (
    <h2 className="text-[11px] font-bold tracking-[0.15em] uppercase pb-1 mb-3 mt-8" style={{ color: theme.heading, borderBottom: `1px solid ${theme.border}` }}>
      {children}
    </h2>
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
}: {
  label: string;
  children: React.ReactNode;
  theme: Theme;
  isPreview: boolean;
  enrollUrl: string;
  sectionName?: string;
  assetCode?: string;
  extraFooterLeft?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const reportMailto = sectionName && assetCode
    ? `mailto:lee@surviveaccounting.com?subject=${encodeURIComponent(`Issue Report: ${assetCode} — ${sectionName}`)}&body=${encodeURIComponent(`I found an issue in the ${sectionName} section of ${assetCode}. Please describe the issue below:\n\n`)}`
    : null;

  return (
    <div
      className="rounded-lg mt-4 overflow-hidden transition-all"
      style={{
        background: theme.toggleBg,
        border: `1px solid ${theme.border}`,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors"
        style={{ color: theme.textMuted }}
        onMouseEnter={(e) => { e.currentTarget.style.background = theme.cardBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <span className="flex items-center gap-2 text-[13px]">
          {open ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {label}
        </span>
        <span className="flex items-center gap-1.5 text-[12px]">
          {open ? `Hide ${label.replace("Reveal ", "")}` : label}
          <ChevronDown
            className="h-3.5 w-3.5 transition-transform"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
          />
        </span>
      </button>
      {open && (
        <div className="px-5 pb-4 pt-3" style={{ borderTop: `1px solid ${theme.border}` }}>
          {isPreview ? (
            <div className="rounded-lg px-6 py-6 text-center" style={{ background: "linear-gradient(135deg, #0F1623, #1A2E55)" }}>
              <p className="text-[16px] font-bold text-white">🔒 Study Pass Required</p>
              <p className="text-[13px] mt-2" style={{ color: "rgba(255,255,255,0.7)" }}>
                Unlock full solutions, journal entries, formulas, exam traps, and more for every IA2 problem.
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
            <>
              {children}
              {(reportMailto || extraFooterLeft) && (
                <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: `1px solid ${theme.border}` }}>
                  <div>{extraFooterLeft || null}</div>
                  {reportMailto ? (
                    <a
                      href={reportMailto}
                      className="flex items-center gap-1.5 text-[12px] hover:underline"
                      style={{ color: theme.textMuted }}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Report an issue with this section →
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

/** Format YYYY-MM-DD to "Month Day, Year" (e.g., "March 18, 2025") */
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
                {formattedDate && <p className="font-bold text-sm" style={{ color: theme.text }}>{formattedDate}</p>}
                {memo && <p className="text-[12px] italic" style={{ color: theme.textMuted }}>{memo}</p>}
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
  const hasMultipleScenarios = data.scenario_sections.length > 1;
  return (
    <div className="space-y-6">
      {data.scenario_sections.map((section, si) => (
        <div key={si}>
          {hasMultipleScenarios && (
            <p className="font-bold text-[13px] mb-2 pb-1" style={{ color: theme.text, borderBottom: `1px solid ${theme.border}` }}>
              {section.label}
            </p>
          )}
          <JETable entries={section.entries_by_date} theme={theme} scenarioLabel={section.label} />
        </div>
      ))}
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

// ── Answer Summary ──────────────────────────────────────────────────

function AnswerSummarySection({ text, theme }: { text: string; theme: Theme }) {
  const subSections = text.split(/(?=\([a-z]\))/i).filter(s => s.trim());
  return (
    <div className="rounded-md p-4 pl-5 border-l-[3px]" style={{ background: theme.answerBg, borderColor: theme.answerBorder }}>
      {subSections.map((section, si) => {
        const labelMatch = section.match(/^\(([a-z])\)\s*(.*)/i);
        const label = labelMatch ? `(${labelMatch[1]}) ${labelMatch[2].split("\n")[0]}` : null;
        const content = labelMatch ? section.slice(labelMatch[0].split("\n")[0].length) : section;
        const contentLines = content.split("\n").filter(l => l.trim());
        return (
          <div key={si}>
            {si > 0 && <div className="my-3" style={{ borderTop: `1px solid ${theme.border}` }} />}
            {label && <p className="font-bold text-[14px]" style={{ color: theme.text, marginTop: si > 0 ? 16 : 0, marginBottom: 8 }}>{label}</p>}
            {contentLines.map((line, li) => {
              const trimmed = line.trim();
              const isYearLabel = /^\d{4}\s*:/.test(trimmed);
              if (isYearLabel) {
                return <p key={li} className="font-bold text-[13px]" style={{ color: theme.text, marginTop: 10, marginBottom: 4 }}>{trimmed}</p>;
              }
              return <p key={li} className="text-[13px] ml-4 mb-1 leading-[1.6]" style={{ color: theme.text }}>{trimmed}</p>;
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

function ChapterNavigator({ currentAsset, theme }: { currentAsset: any; theme: Theme }) {
  const navigate = useNavigate();
  const currentChapterId = currentAsset.chapter_id;

  const [selectedChapterId, setSelectedChapterId] = useState(currentChapterId || "");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedAssetName, setSelectedAssetName] = useState("");

  const { data: chapters } = useQuery({
    queryKey: ["ia2-chapters-nav"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, courses!chapters_course_id_fkey(code)")
        .gte("chapter_number", 13)
        .lte("chapter_number", 22)
        .order("chapter_number");
      return (data || []).filter((c: any) => c.courses?.code === "IA2");
    },
  });

  const { data: chapterAssets } = useQuery({
    queryKey: ["nav-assets", selectedChapterId, selectedType],
    queryFn: async () => {
      if (!selectedChapterId) return [] as any[];
      const tbl = supabase.from("teaching_assets") as any;
      const res = await tbl
        .select("asset_name, source_ref")
        .eq("chapter_id", selectedChapterId)
        .eq("status", "approved")
        .order("source_ref");
      const data = res.data;
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
      return filtered;
    },
    enabled: !!selectedChapterId,
  });

  const handleGo = () => {
    const target = selectedAssetName || (chapterAssets && chapterAssets[0]?.asset_name);
    if (target) navigate(`/solutions/${target}?preview=true`);
  };

  return (
    <div className="rounded-lg px-5 py-3 mb-4" style={{ background: theme.toggleBg, border: `1px solid ${theme.border}` }}>
      <p className="text-[11px] font-bold tracking-[0.1em] uppercase mb-2" style={{ color: theme.textMuted }}>Browse IA2 Problems</p>
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
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
          <img
            src={imageUrl}
            alt={`How to solve ${letter}`}
            className="w-full rounded-lg mt-3"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}

// ── Supplementary JE Display (accounts only, ??? amounts) ───────────

function SupplementaryJESection({ data, theme }: { data: { entries: { label: string; rows: { account_name: string; side: "debit" | "credit" }[] }[] }; theme: Theme }) {
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
        </div>
      ))}
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

/** Split text into bullet points, breaking long ones at ideal sentence boundaries */
function splitLongBullets(text: string): string[] {
  const raw = text.split(/\.\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean);
  const sentences = raw.map(s => s.endsWith('.') ? s : s + '.');
  
  const result: string[] = [];
  for (const s of sentences) {
    if (s.length <= 200) {
      result.push(s);
      continue;
    }
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
/** Group formulas by shared prefix (e.g. "Fair Value Method") and render with headers */
function GroupedFormulas({ text, theme }: { text: string; theme: Theme }) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // Try to detect "Category: formula" pattern
  const groups: { header: string; items: string[] }[] = [];
  for (const line of lines) {
    const colonMatch = line.match(/^(.+?):\s+(.+)$/);
    if (colonMatch) {
      const [, prefix, formula] = colonMatch;
      const existing = groups.find(g => g.header === prefix);
      if (existing) {
        existing.items.push(formula);
      } else {
        groups.push({ header: prefix, items: [formula] });
      }
    } else {
      // No prefix — standalone formula
      groups.push({ header: "", items: [line] });
    }
  }

  // If grouping produced meaningful headers (at least one group with 2+ items), use grouped layout
  const hasGrouping = groups.some(g => g.items.length >= 2);

  if (!hasGrouping) {
    // Flat list fallback
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
          {group.header && (
            <p className="font-bold text-[13px] mb-2" style={{ color: theme.text }}>
              {group.header}
            </p>
          )}
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


// ── About Lee Content (shared between card and left panel) ──────────

function AboutLeeContent({ theme, compact = false }: { theme: Theme; compact?: boolean }) {
  const imgSize = compact ? "w-28 h-28" : "w-28 h-28";
  return (
    <div className={`flex flex-col ${compact ? "items-center text-center gap-3" : "items-center text-center gap-4"}`}>
      <img
        src={LEE_HEADSHOT_URL}
        alt="Lee Ingram"
        className={`${imgSize} rounded-full object-cover`}
        style={{ objectPosition: "top center" }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <div className={compact ? "space-y-2" : "space-y-3"}>
        <p className={`${compact ? "text-[12px]" : "text-[13px]"} leading-[1.6]`} style={{ color: theme.text }}>
          Tutoring entrepreneur since 2015. Founder of Survive Accounting — exam prep built from thousands of real Ole Miss tutoring sessions.
        </p>
        <p className={`${compact ? "text-[12px]" : "text-[13px]"} leading-[1.6]`} style={{ color: theme.text }}>
          I love helping students ace exams with minimal effort. Thanks for stopping by.
        </p>
        <p className={`${compact ? "text-[12px]" : "text-[13px]"} italic`} style={{ color: theme.text }}>— Lee</p>
      </div>
      <div className={`flex flex-col gap-1.5 ${compact ? "text-[11px]" : "text-[12px]"}`}>
        <a href="mailto:lee@surviveaccounting.com" className="hover:underline" style={{ color: "#3B82F6" }}>
          lee@surviveaccounting.com
        </a>
        <a
          href="https://app.squareup.com/appointments/book/30fvidwxlwh9vt/LY1BCZ6Q74JRF/start"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 hover:underline font-semibold"
          style={{ color: "#3B82F6" }}
        >
          <Calendar className="h-3 w-3" /> Book 1-on-1 Virtual Tutoring →
        </a>
      </div>
    </div>
  );
}

// ── Left Floating Panel — About Lee ─────────────────────────────────

function LeftPanel({ theme, isDark }: { theme: Theme; isDark: boolean }) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed top-1/2 -translate-y-1/2 z-30 hidden xl:flex"
        style={{
          left: 20,
        style={{
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          background: isDark ? theme.cardBg : "#FFFFFF",
          color: theme.textMuted,
          border: `1px solid ${theme.border}`,
          borderRadius: "8px",
          padding: "12px 8px",
          fontSize: "12px",
          fontWeight: 600,
          boxShadow: isDark ? "2px 0 12px rgba(0,0,0,0.3)" : "2px 0 12px rgba(0,0,0,0.06)",
          letterSpacing: "0.05em",
        }}
      >
        About Lee
      </button>
    );
  }

  return (
    <div
      className="fixed top-1/2 -translate-y-1/2 z-30 hidden xl:block"
      style={{
        left: 20,
        width: 230,
        background: isDark ? theme.cardBg : "#FFFFFF",
        border: `1px solid ${theme.border}`,
        borderRadius: "12px",
        boxShadow: isDark ? "4px 0 24px rgba(0,0,0,0.3)" : "4px 0 24px rgba(0,0,0,0.08)",
        padding: "16px 14px",
      }}
    >
      <button
        onClick={() => setOpen(false)}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/5 transition-colors"
        style={{ color: theme.textMuted }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <AboutLeeContent theme={theme} compact />
    </div>
  );
}

// ── Right Floating Panel — Mode Switcher ────────────────────────────

function RightPanel({
  theme,
  isDark,
  practiceMode,
  onSetPracticeMode,
}: {
  theme: Theme;
  isDark: boolean;
  practiceMode: boolean;
  onSetPracticeMode: (v: boolean) => void;
}) {
  return (
    <div
      className="fixed right-0 top-1/2 -translate-y-1/2 z-30 hidden xl:block"
      style={{
        width: 180,
        background: isDark ? theme.cardBg : "#FFFFFF",
        border: `1px solid ${theme.border}`,
        borderRight: "none",
        borderRadius: "12px 0 0 12px",
        boxShadow: isDark ? "-4px 0 24px rgba(0,0,0,0.3)" : "-4px 0 24px rgba(0,0,0,0.08)",
        padding: "16px 14px",
      }}
    >
      <div className="flex flex-col gap-2">
        <button
          onClick={() => onSetPracticeMode(true)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-semibold transition-all text-left"
          style={{
            background: practiceMode ? (isDark ? "#1A2E55" : "#EEF2FF") : "transparent",
            color: practiceMode ? (isDark ? "#93C5FD" : "#3B52B5") : theme.textMuted,
            border: `1px solid ${practiceMode ? (isDark ? "#3B52B5" : "#C7D2FE") : theme.border}`,
          }}
        >
          <BookOpen className="h-3.5 w-3.5 shrink-0" /> Practice Mode
        </button>
        <button
          onClick={() => onSetPracticeMode(false)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-semibold transition-all text-left"
          style={{
            background: !practiceMode ? (isDark ? "#0D2B1A" : "#F0FFF4") : "transparent",
            color: !practiceMode ? (isDark ? "#6EE7B7" : "#166534") : theme.textMuted,
            border: `1px solid ${!practiceMode ? (isDark ? "#166534" : "#BBF7D0") : theme.border}`,
          }}
        >
          <CheckCircle className="h-3.5 w-3.5 shrink-0" /> View Solution
        </button>
      </div>
      <div className="mt-4 pt-3 space-y-1.5" style={{ borderTop: `1px solid ${theme.border}` }}>
        <p className="text-[11px]" style={{ color: theme.textMuted }}>🎬 Video coming soon</p>
        <p className="text-[11px]" style={{ color: theme.textMuted }}>📝 Quiz coming soon</p>
      </div>
    </div>
  );
}

// ── Testimonials Section ────────────────────────────────────────────

function TestimonialsSection({ theme }: { theme: Theme }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const scriptId = "testimonialto-resize-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://testimonial.to/js/iframeResizer.min.js";
      script.onload = () => {
        if ((window as any).iFrameResize && iframeRef.current) {
          (window as any).iFrameResize({ log: false, checkOrigin: false }, iframeRef.current);
        }
      };
      document.body.appendChild(script);
    } else if ((window as any).iFrameResize && iframeRef.current) {
      (window as any).iFrameResize({ log: false, checkOrigin: false }, iframeRef.current);
    }
  }, []);

  return (
    <div className="mt-10">
      <h2 className="text-[13px] font-bold tracking-[0.1em] uppercase mb-4" style={{ color: theme.textMuted }}>
        What Students Are Saying
      </h2>
      <iframe
        ref={iframeRef}
        id="testimonialto-317c8816-eefb-469f-8173-b79efef6c2fa"
        src="https://embed-v2.testimonial.to/w/survive-accounting-with-lee-ingram?id=317c8816-eefb-469f-8173-b79efef6c2fa"
        frameBorder="0"
        scrolling="no"
        width="100%"
        style={{ minHeight: 300, border: "none" }}
      />
    </div>
  );
}

export default function SolutionsViewer() {
  const { assetCode } = useParams<{ assetCode: string }>();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get("preview") === "true";
  const enrollUrl = useEnrollUrl();

  // Theme — persisted dark/light toggle
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem("sa-viewer-theme");
    return stored === "dark";
  });
  const t = isDark ? darkTheme : lightTheme;

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem("sa-viewer-theme", next ? "dark" : "light");
      return next;
    });
  };

  // Highlight toggle
  const [showHighlights, setShowHighlights] = useState(false);

  // Practice mode — hides reveal toggles
  const [practiceMode, setPracticeMode] = useState(isPreview);
  const problemRef = useRef<HTMLDivElement>(null);

  const handleSetPracticeMode = (v: boolean) => {
    setPracticeMode(v);
    if (v && problemRef.current) {
      problemRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Report modal
  const [reportOpen, setReportOpen] = useState(false);

  // Fetch asset with chapter+course join + instruction fields
  const { data, isLoading } = useQuery({
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

      return { ...asset, _problemTitle: asset.problem_title || "", _instructions: instrData || [], _flowcharts: flowchartsData || [] };
    },
    enabled: !!assetCode,
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
  const sourceRef = asset.source_ref || "";

  // Instructions
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
  const rawProblemText = showHighlights && hasHighlights
    ? asset.problem_text_ht_backup!
    : asset.problem_context || "";
  const problemParagraphs = splitLongText(rawProblemText);

  const shareUrl = `https://learn.surviveaccounting.com/solutions/${asset.asset_name}?preview=true`;

  const videoMailto = `mailto:lee@surviveaccounting.com?subject=Video Request: ${asset.asset_name}&body=I would like a video explanation for ${sourceRef || ""} (${asset.asset_name}).`;

  return (
    <div className="min-h-screen relative" style={{ background: t.pageBg }}>
      {/* ── Watermark Background ── */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${AORAKI_URL})`,
            opacity: 0.06,
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: t.watermarkOverlay }}
        />
      </div>

      {/* ── Navy Header Bar ── */}
      <header
        className="relative"
        style={{ background: "#14213D", zIndex: 10 }}
      >
        <div className="max-w-[780px] mx-auto px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={LOGO_URL}
              alt="Survive Accounting"
              className="h-8 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <span className="text-[12px] text-white/50">Created by Lee Ingram</span>
          </div>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 text-[12px] text-white/60 hover:text-white/90 transition-colors px-2 py-1 rounded"
          >
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {isDark ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <div className="relative" style={{ zIndex: 5 }}>
        {/* Marketing Badge */}
        <div className="max-w-[780px] mx-auto px-6 mt-4">
          <span
            className="inline-block text-[11px] px-3 py-1 rounded-full"
            style={{
              background: t.badgeBg,
              border: `1px solid ${t.badgeBorder}`,
              color: t.badgeColor,
            }}
          >
            ✦ Deeper than a solutions manual — built from 10+ years of Ole Miss tutoring
          </span>
        </div>

        {/* Identifier / Title Bar */}
        <div className="mt-3" style={{ background: isDark ? "rgba(26,35,51,0.8)" : "rgba(248,249,250,0.9)", borderBottom: `1px solid ${t.border}` }}>
          <div className="max-w-[780px] mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              {sourceRef && (
                <p className="text-[12px] mb-0.5" style={{ color: t.textMuted }}>
                  Based on {sourceRef}
                </p>
              )}
              <h1
                className="text-[18px] font-bold leading-tight"
                style={{ color: isDark ? "#FFFFFF" : "#131E35" }}
              >
                {problemTitle || asset.asset_name}
              </h1>
              {identifierLine && <p className="text-[12px] mt-0.5" style={{ color: t.textMuted }}>{identifierLine}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Preview link copied — recipients will need a Study Pass for full access"); }}
                className="flex items-center gap-1.5 text-[12px] font-semibold px-4 py-2 rounded-lg transition-all hover:scale-[1.03]"
                style={{
                  color: "#FFFFFF",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.25)",
                  boxShadow: "0 0 12px rgba(255,255,255,0.08), 0 0 4px rgba(255,255,255,0.05)",
                }}
              >
                <Copy className="h-3.5 w-3.5" /> Share
              </button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 border-amber-400 text-amber-600 hover:bg-amber-50"
                onClick={() => setReportOpen(true)}
              >
                <AlertTriangle className="h-3 w-3 mr-1" /> Report Issue
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Floating Side Panels (desktop only) ── */}
      <LeftPanel theme={t} isDark={isDark} />
      <RightPanel theme={t} isDark={isDark} practiceMode={practiceMode} onSetPracticeMode={handleSetPracticeMode} />

      {/* ── Content ── */}
      <main className="relative max-w-[780px] mx-auto px-6 py-8" style={{ zIndex: 5 }}>
        {/* Content card with drop shadow */}
        <div
          className="rounded-xl px-6 py-6 sm:px-8 sm:py-8"
          style={{
            background: isDark ? t.cardBg : t.pageBg,
            boxShadow: isDark
              ? "0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)"
              : "0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03)",
            border: `1px solid ${t.border}`,
          }}
        >
          {/* Chapter navigator (preview only) */}
          {isPreview && <ChapterNavigator currentAsset={asset} theme={t} />}

          {/* Problem text — always visible */}
          {rawProblemText.trim() && (
            <div ref={problemRef}>
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

          {/* ── Reveal Toggles (hidden in practice mode) ── */}
          {!practiceMode && (
            <>
              {/* 1. Solution — with video request link in footer */}
              {answerSummary.trim() && (
                <RevealToggle
                  label="Reveal Solution"
                  theme={t}
                  isPreview={isPreview}
                  enrollUrl={enrollUrl}
                  sectionName="Solution"
                  assetCode={asset.asset_name}
                  extraFooterLeft={
                    <a
                      href={videoMailto}
                      className="flex items-center gap-1.5 text-[12px] hover:underline"
                      style={{ color: "#3B82F6" }}
                    >
                      <Video className="h-3 w-3" />
                      Request Video Explanation →
                    </a>
                  }
                >
                  <AnswerSummarySection text={answerSummary} theme={t} />
                </RevealToggle>
              )}

              {/* 2. How to Solve This — per-instruction flowcharts */}
              {(asset._flowcharts?.length > 0 || asset.flowchart_image_url) && (
                <RevealToggle label="Reveal How to Solve This" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} sectionName="How to Solve This" assetCode={asset.asset_name}>
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
                    <img src={asset._flowcharts[0].flowchart_image_url} alt="How to Solve This — step-by-step flowchart" className="w-full rounded-lg" loading="lazy" />
                  ) : (
                    <img src={asset.flowchart_image_url} alt="How to Solve This — step-by-step flowchart" className="w-full rounded-lg" loading="lazy" />
                  )}
                </RevealToggle>
              )}

              {/* 3. Journal Entries */}
              {hasJE && (
                <RevealToggle label="Reveal Journal Entries" theme={t} isPreview={false} enrollUrl={enrollUrl} sectionName="Journal Entries" assetCode={asset.asset_name}>
                  {isPreview ? (
                    <JEPreviewTeaser jeData={jeData} jeBlock={jeBlock} hasCanonicalJE={!!hasCanonicalJE} theme={t} enrollUrl={enrollUrl} />
                  ) : (
                    hasCanonicalJE ? (
                      <CanonicalJESection data={typeof jeData === "string" ? JSON.parse(jeData) : jeData} theme={t} />
                    ) : (
                      <RawJEFallback text={jeBlock} theme={t} />
                    )
                  )}
                </RevealToggle>
              )}

              {/* 3b. Supplementary / Related Journal Entries */}
              {asset.supplementary_je_json && (
                <RevealToggle label="Reveal Related Journal Entries" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} sectionName="Related Journal Entries" assetCode={asset.asset_name}>
                  <SupplementaryJESection
                    data={typeof asset.supplementary_je_json === "string" ? JSON.parse(asset.supplementary_je_json) : asset.supplementary_je_json}
                    theme={t}
                  />
                </RevealToggle>
              )}

              {formulas.trim() && (
                <RevealToggle label="Reveal Important Formulas" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} sectionName="Important Formulas" assetCode={asset.asset_name}>
                  <GroupedFormulas text={formulas} theme={t} />
                </RevealToggle>
              )}

              {/* 5. Key Concepts */}
              {conceptNotes.trim() && (
                <RevealToggle label="Reveal Key Concepts" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} sectionName="Key Concepts" assetCode={asset.asset_name}>
                  <ul className="space-y-3">
                    {splitLongBullets(conceptNotes).map((sentence: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-[13px] leading-[1.6]" style={{ color: t.text }}>
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: isDark ? "#00BFFF" : "#131E35" }} />
                        <span>{sentence}</span>
                      </li>
                    ))}
                  </ul>
                </RevealToggle>
              )}

              {/* 6. Exam Traps */}
              {examTraps.trim() && (
                <RevealToggle label="Reveal Exam Traps" theme={t} isPreview={isPreview} enrollUrl={enrollUrl} sectionName="Exam Traps" assetCode={asset.asset_name}>
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
            </>
          )}
        </div>

        {/* ── About Lee Card ── */}
        <div className="mt-12 rounded-xl p-6" style={{ background: t.cardBg, border: `1px solid ${t.border}`, boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.3)" : "0 4px 16px rgba(0,0,0,0.04)" }}>
          <AboutLeeContent theme={t} />
        </div>

        {/* ── Testimonials ── */}
        <TestimonialsSection theme={t} />

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
            <button onClick={() => setReportOpen(true)} className="text-[11px] hover:underline" style={{ color: t.textMuted }}>
              Report Issue
            </button>
          </p>
          {!isPreview && (
            <p className="text-center mt-1">
              <a href={`/practice/${asset.asset_name}`} className="text-[12px] hover:underline" style={{ color: "#3B82F6" }}>
                ← View Practice Mode
              </a>
            </p>
          )}
        </div>
      </main>

      <ReportIssueModal open={reportOpen} onOpenChange={setReportOpen} asset={asset} />
    </div>
  );
}