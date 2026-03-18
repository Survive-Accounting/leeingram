import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Lock, ChevronDown, ChevronUp, Share2 } from "lucide-react";
import { isCanonicalJE, type CanonicalJEPayload } from "@/lib/journalEntryParser";
import { toast } from "sonner";

// ── Pipe table helpers (same as SolutionsViewer) ─────────────────────

function parsePipeSegments(text: string): { type: "text" | "table"; content: string; rows?: string[][] }[] {
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
      if (dataRows.length >= 2) {
        segments.push({ type: "table", content: block, rows: dataRows });
      } else {
        segments.push({ type: "text", content: block });
      }
    } else {
      const start = i;
      while (i < lines.length && !(i < lines.length - 1 && lines[i].includes("|") && lines[i + 1].includes("|"))) i++;
      const block = lines.slice(start, i).join("\n");
      if (block.trim()) segments.push({ type: "text", content: block });
    }
  }
  return segments;
}

function isNumericCell(cell: string): boolean {
  return /^\$?[\d,]+(\.\d+)?%?$/.test(cell.trim());
}

function PipeTable({ rows }: { rows: string[][] }) {
  const header = rows[0];
  const body = rows.slice(1);
  const copyTSV = () => {
    navigator.clipboard.writeText(rows.map(r => r.join("\t")).join("\n"));
    toast.success("Copied as TSV");
  };
  return (
    <div className="my-4 relative">
      <button onClick={copyTSV} className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors z-10">
        Copy as TSV
      </button>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: "#1A2E55" }}>
              {header.map((h, i) => <th key={i} className="px-3 py-2 text-center text-white font-bold text-[13px]">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? "#FFFFFF" : "#F8F9FA" }}>
                {row.map((cell, ci) => <td key={ci} className={`px-3 py-1.5 text-center text-[13px] ${isNumericCell(cell) ? "font-mono" : ""}`}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SmartContent({ text, className }: { text: string; className?: string }) {
  const segments = parsePipeSegments(text);
  return (
    <div className={className}>
      {segments.map((seg, i) =>
        seg.type === "table" && seg.rows ? <PipeTable key={i} rows={seg.rows} /> : <p key={i} className="whitespace-pre-wrap">{seg.content}</p>
      )}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold tracking-[0.15em] uppercase border-b border-gray-200 pb-1 mb-3 mt-8" style={{ color: "#131E35" }}>
      {children}
    </h2>
  );
}

// ── JE renderers (same as SolutionsViewer) ───────────────────────────

function JETable({ entries }: { entries: any[] }) {
  return (
    <div className="space-y-4">
      {entries.map((entry: any, ei: number) => {
        const date = entry.entry_date || entry.date || "";
        const rows = entry.rows || entry.accounts || [];
        return (
          <div key={ei}>
            {date && <p className="font-bold text-sm mb-1" style={{ color: "#131E35" }}>{date}</p>}
            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#1A2E55" }}>
                    <th className="text-left px-3 py-1.5 text-white font-bold text-[12px]">Account</th>
                    <th className="text-right px-3 py-1.5 text-white font-bold text-[12px] w-24">Debit</th>
                    <th className="text-right px-3 py-1.5 text-white font-bold text-[12px] w-24">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: any, ri: number) => {
                    const isCredit = row.side === "credit" || (row.credit != null && row.credit !== 0 && (row.debit == null || row.debit === 0));
                    return (
                      <tr key={ri} style={{ background: ri % 2 === 0 ? "#FFFFFF" : "#F8F9FA" }}>
                        <td className={`px-3 py-1.5 text-[13px] ${isCredit ? "pl-10" : ""}`}>{row.account_name || row.account || ""}</td>
                        <td className="text-right px-3 py-1.5 text-[13px] font-mono">{!isCredit && row.debit != null && row.debit !== 0 ? Number(row.debit).toLocaleString("en-US") : ""}</td>
                        <td className="text-right px-3 py-1.5 text-[13px] font-mono">{isCredit && row.credit != null ? Number(row.credit).toLocaleString("en-US") : ""}</td>
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

function CanonicalJESection({ data }: { data: CanonicalJEPayload }) {
  const allEntries: any[] = [];
  for (const section of data.scenario_sections) {
    for (const entry of section.entries_by_date) allEntries.push(entry);
  }
  return <JETable entries={allEntries} />;
}

function RawJEFallback({ text }: { text: string }) {
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
    <div className="overflow-x-auto rounded-md border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "#1A2E55" }}>
            <th className="text-left px-3 py-1.5 text-white font-bold text-[12px]">Account</th>
            <th className="text-right px-3 py-1.5 text-white font-bold text-[12px] w-24">Debit</th>
            <th className="text-right px-3 py-1.5 text-white font-bold text-[12px] w-24">Credit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) =>
            r.isDate ? (
              <tr key={i} style={{ background: "#EEF2FF" }}>
                <td colSpan={3} className="px-3 py-1.5 font-bold text-[13px]" style={{ color: "#131E35" }}>{r.account}</td>
              </tr>
            ) : (
              <tr key={i} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#F8F9FA" }}>
                <td className={`px-3 py-1.5 text-[13px] ${r.isCredit ? "pl-10" : ""}`}>{r.account}</td>
                <td className="text-right px-3 py-1.5 text-[13px] font-mono">{r.debit}</td>
                <td className="text-right px-3 py-1.5 text-[13px] font-mono">{r.credit}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function AnswerSummarySection({ text }: { text: string }) {
  const subSections = text.split(/(?=\([a-z]\))/i).filter(s => s.trim());
  return (
    <div className="rounded-md p-4 pl-5 border-l-[3px]" style={{ background: "#F0FFF4", borderColor: "#1B8A3E" }}>
      {subSections.map((section, si) => {
        const labelMatch = section.match(/^\(([a-z])\)\s*(.*)/i);
        const label = labelMatch ? `(${labelMatch[1]}) ${labelMatch[2].split("\n")[0]}` : null;
        const content = labelMatch ? section.slice(labelMatch[0].split("\n")[0].length) : section;
        const lines = content.split("\n").filter(l => l.trim());
        return (
          <div key={si}>
            {label && <p className="font-bold text-[15px] mt-4 first:mt-0" style={{ color: "#131E35" }}>{label}</p>}
            {lines.map((line, li) => {
              const yearMatch = line.trim().match(/^(\d{4})\s*:/);
              if (yearMatch) return <p key={li} className="font-bold text-[14px] mt-2" style={{ color: "#1A2E55" }}>{line.trim()}</p>;
              return <p key={li} className="text-[13px] ml-4 mb-1" style={{ color: "#1A1A1A" }}>{line.trim()}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Paywall overlay ──────────────────────────────────────────────────

function PaywallOverlay() {
  const enrollUrl = import.meta.env.VITE_LEARNWORLDS_ENROLL_URL || "https://surviveaccounting.com";
  return (
    <div className="relative mt-8">
      <div className="absolute inset-0 backdrop-blur-md z-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(19, 30, 53, 0.85)" }}>
        <div className="text-center px-8 py-10 max-w-md">
          <Lock className="h-10 w-10 text-white/80 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">🔒 Full practice mode available with Survive Accounting Study Pass</h3>
          <a href={enrollUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-4 px-6 py-3 rounded-lg text-white font-bold text-sm transition-all hover:scale-105" style={{ background: "#1B8A3E" }}>
            Get Study Pass →
          </a>
        </div>
      </div>
      <div className="filter blur-sm pointer-events-none select-none min-h-[400px] opacity-40">
        <div className="space-y-8">
          <div className="h-20 bg-gray-100 rounded" />
          <div className="h-32 bg-gray-100 rounded" />
          <div className="h-16 bg-gray-100 rounded" />
        </div>
      </div>
    </div>
  );
}

// ── Reveal card ──────────────────────────────────────────────────────

function RevealCard({ label, revealed, onToggle, children }: { label: string; revealed: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      {!revealed ? (
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between rounded-lg border border-dashed px-5 py-3.5 transition-colors hover:bg-gray-50"
          style={{ borderColor: "#CBD5E0", background: "#F8F9FA" }}
        >
          <span className="flex items-center gap-2 text-gray-500 text-[13px]">
            <Lock className="h-4 w-4" /> {label}
          </span>
          <span className="flex items-center gap-1 text-[13px] font-medium border rounded-md px-3 py-1.5 transition-colors hover:bg-white" style={{ color: "#131E35", borderColor: "#131E35" }}>
            Reveal {label.replace("Reveal ", "")} <ChevronDown className="h-3.5 w-3.5" />
          </span>
        </button>
      ) : (
        <div>
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-between rounded-t-lg border border-gray-200 px-5 py-2.5 bg-gray-50 transition-colors hover:bg-gray-100"
          >
            <span className="text-[13px] font-medium" style={{ color: "#131E35" }}>{label.replace("Reveal ", "")}</span>
            <span className="flex items-center gap-1 text-[12px] text-gray-500">
              Hide <ChevronUp className="h-3.5 w-3.5" />
            </span>
          </button>
          <div className="border border-t-0 border-gray-200 rounded-b-lg p-5 animate-in slide-in-from-top-2 duration-200">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function PracticeViewer() {
  const { assetCode } = useParams<{ assetCode: string }>();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get("preview") === "true";

  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [workText, setWorkText] = useState("");

  const toggle = useCallback((key: string) => {
    setRevealed(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Fetch asset data (same query as SolutionsViewer)
  const { data, isLoading } = useQuery({
    queryKey: ["practice-viewer", assetCode],
    queryFn: async () => {
      const { data: assets, error: assetErr } = await supabase
        .from("teaching_assets").select("*").eq("asset_name", assetCode!).limit(1);
      if (assetErr) throw assetErr;
      const asset = assets?.[0];
      if (!asset) return null;
      let course: any = null;
      let chapter: any = null;
      if (asset.course_id) { const { data: c } = await supabase.from("courses").select("*").eq("id", asset.course_id).single(); course = c; }
      if (asset.chapter_id) { const { data: ch } = await supabase.from("chapters").select("*").eq("id", asset.chapter_id).single(); chapter = ch; }
      const { data: instructions } = await supabase
        .from("problem_instructions").select("instruction_number, instruction_text").eq("teaching_asset_id", asset.id).order("instruction_number");
      return { asset, course, chapter, instructions: instructions || [] };
    },
    enabled: !!assetCode,
  });

  // Load workspace text from localStorage
  useEffect(() => {
    if (!assetCode) return;
    const saved = localStorage.getItem(`practice_work_${assetCode}`);
    if (saved) setWorkText(saved);
  }, [assetCode]);

  // Save workspace text
  useEffect(() => {
    if (!assetCode) return;
    localStorage.setItem(`practice_work_${assetCode}`, workText);
  }, [workText, assetCode]);

  // Track page view
  useEffect(() => {
    if (!data?.asset?.id) return;
    const key = `practice_viewed_${data.asset.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    supabase.rpc("increment_practice_views", { asset_id: data.asset.id }).then(() => {});
  }, [data?.asset?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-[#131E35] rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold" style={{ color: "#131E35" }}>Problem not found</p>
          <p className="text-gray-500 mt-2">Check the asset code and try again.</p>
        </div>
      </div>
    );
  }

  const { asset, course, chapter, instructions } = data;

  const jeData = asset.journal_entry_completed_json;
  const jeRaw = (asset as any).journal_entry_raw || "";
  const hasCanonicalJE = jeData && isCanonicalJE(typeof jeData === "string" ? JSON.parse(jeData) : jeData);
  const hasJE = hasCanonicalJE || jeRaw.trim();

  const answerSummary = asset.survive_solution_text || "";
  const formulas = (asset as any).important_formulas || "";
  const conceptNotes = (asset as any).concept_notes || "";
  const examTraps = (asset as any).exam_traps || "";
  const flowchartUrl = (asset as any).flowchart_image_url || "";

  const sortedInstr = [...instructions].sort((a, b) => a.instruction_number - b.instruction_number);

  const quizLink = (asset as any).lw_quiz_link || null;
  const whiteboardLink = (asset as any).sheet_master_url || null;
  const videoLink = (asset as any).lw_video_link || null;
  const hasFooterLinks = quizLink || whiteboardLink || videoLink;

  // Count revealable sections
  const revealSections: { key: string; label: string; exists: boolean }[] = [
    { key: "je", label: "Journal Entries", exists: !!hasJE },
    { key: "answer", label: "Answer Summary", exists: !!answerSummary.trim() },
    { key: "flowchart", label: "How to Solve This", exists: !!flowchartUrl },
    { key: "traps", label: "Exam Traps", exists: !!examTraps.trim() },
  ];
  const availableSections = revealSections.filter(s => s.exists);
  const revealedCount = availableSections.filter(s => revealed[s.key]).length;
  const totalSections = availableSections.length;
  const allRevealed = totalSections > 0 && revealedCount === totalSections;

  const handleShare = () => {
    const url = `${window.location.origin}/practice/${assetCode}?preview=true`;
    navigator.clipboard.writeText(url);
    toast.success("Preview link copied — share with friends to show them what they're missing!");
  };

  return (
    <div className="min-h-screen bg-white">
      {/* ── Branded Header ── */}
      <header className="border-b-2" style={{ borderColor: "#131E35" }}>
        <div className="max-w-[780px] mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-[16px]" style={{ color: "#131E35" }}>Survive Accounting</p>
            <p className="text-[12px] text-gray-500">by Lee Ingram</p>
          </div>
          <div className="flex items-center gap-3 text-[12px]">
            {quizLink && <a href={quizLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">Practice Quiz <ExternalLink className="h-3 w-3" /></a>}
            {whiteboardLink && <a href={whiteboardLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">Whiteboard <ExternalLink className="h-3 w-3" /></a>}
            {videoLink && <a href={videoLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">Video <ExternalLink className="h-3 w-3" /></a>}
          </div>
        </div>
      </header>

      {/* ── Asset Identifier Bar ── */}
      <div style={{ background: "#F8F9FA" }} className="border-b border-gray-200">
        <div className="max-w-[780px] mx-auto px-6 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <span className="font-mono font-bold text-sm" style={{ color: "#131E35" }}>{asset.asset_name}</span>
              <span className="text-gray-400 text-[12px] ml-3">
                {course?.course_name} · Ch {chapter?.chapter_number} — {chapter?.chapter_name} · {asset.source_ref || ""}
              </span>
            </div>
            <span className="text-[11px] text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1">
              {allRevealed ? (
                <span className="flex items-center gap-1">
                  ✓ All sections revealed — <a href={`/solutions/${asset.asset_name}`} className="text-blue-600 hover:underline">View full solutions →</a>
                </span>
              ) : (
                `Revealed: ${revealedCount} of ${totalSections} sections`
              )}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={`/solutions/${asset.asset_name}`}
              className="text-[12px] px-3 py-1.5 rounded-md font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              📖 Full Solutions
            </a>
            <span className="text-[12px] px-3 py-1.5 rounded-md font-medium text-white" style={{ background: "#131E35" }}>
              ✏️ Practice Mode
            </span>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <main className="max-w-[780px] mx-auto px-6 py-8">
        {/* PROBLEM */}
        {(asset as any).problem_context?.trim() && (
          <>
            <SectionHeading>PROBLEM</SectionHeading>
            <SmartContent text={(asset as any).problem_context} className="text-[14px] leading-[1.7] text-[#1A1A1A]" />
          </>
        )}

        {/* REQUIRED */}
        {sortedInstr.length > 0 && (
          <>
            <SectionHeading>REQUIRED</SectionHeading>
            <div className="space-y-4">
              {sortedInstr.filter(i => i.instruction_text?.trim()).map((inst, idx) => {
                const letter = String.fromCharCode(97 + idx);
                return (
                  <p key={idx} className="text-[14px] leading-[1.6]">
                    <span className="font-bold" style={{ color: "#131E35" }}>({letter})</span> {inst.instruction_text}
                  </p>
                );
              })}
            </div>
          </>
        )}

        {/* ── Paywall gate ── */}
        {isPreview ? (
          <PaywallOverlay />
        ) : (
          <>
            {/* YOUR WORK */}
            <SectionHeading>YOUR WORK</SectionHeading>
            <div className="rounded-lg border border-gray-200 p-4" style={{ minHeight: 200 }}>
              <textarea
                value={workText}
                onChange={e => setWorkText(e.target.value)}
                placeholder="Work through the problem here before revealing the solution..."
                className="w-full min-h-[180px] resize-y text-[13px] leading-[1.6] bg-transparent border-none outline-none placeholder:text-gray-400"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Your work is saved locally in this browser session only.</p>

            {/* IMPORTANT FORMULAS (always visible) */}
            {formulas.trim() && (
              <>
                <SectionHeading>IMPORTANT FORMULAS</SectionHeading>
                <div className="rounded-md p-4 pl-5 border-l-[3px]" style={{ background: "#FFFBEB", borderColor: "#D97706" }}>
                  {formulas.split("\n").filter((l: string) => l.trim()).map((line: string, i: number) => (
                    <p key={i} className="font-mono text-[13px] mb-2 text-[#1A1A1A]">{line}</p>
                  ))}
                </div>
              </>
            )}

            {/* KEY CONCEPTS (always visible) */}
            {conceptNotes.trim() && (
              <>
                <SectionHeading>KEY CONCEPTS</SectionHeading>
                <ul className="space-y-2">
                  {conceptNotes.split(". ").filter((s: string) => s.trim()).map((sentence: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] leading-[1.6]">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#131E35" }} />
                      <span>{sentence.endsWith(".") ? sentence : sentence + "."}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* ── Reveal sections ── */}

            {/* Journal Entries */}
            {hasJE && (
              <RevealCard label="Reveal Journal Entries" revealed={!!revealed.je} onToggle={() => toggle("je")}>
                {hasCanonicalJE ? (
                  <CanonicalJESection data={typeof jeData === "string" ? JSON.parse(jeData) : jeData} />
                ) : (
                  <RawJEFallback text={jeRaw} />
                )}
              </RevealCard>
            )}

            {/* Answer Summary */}
            {answerSummary.trim() && (
              <RevealCard label="Reveal Answer Summary" revealed={!!revealed.answer} onToggle={() => toggle("answer")}>
                <AnswerSummarySection text={answerSummary} />
              </RevealCard>
            )}

            {/* How to Solve This */}
            {flowchartUrl && (
              <RevealCard label="Reveal How to Solve This" revealed={!!revealed.flowchart} onToggle={() => toggle("flowchart")}>
                <div className="text-center">
                  <img src={flowchartUrl} alt="Solution flowchart" className="max-w-[700px] w-full mx-auto rounded-lg border border-gray-200" />
                  <p className="text-gray-400 text-[12px] mt-2">Step-by-step process</p>
                </div>
              </RevealCard>
            )}

            {/* Exam Traps */}
            {examTraps.trim() && (
              <RevealCard label="Reveal Exam Traps" revealed={!!revealed.traps} onToggle={() => toggle("traps")}>
                <div className="rounded-md p-4 pl-5 border-l-[3px]" style={{ background: "#FFF5F5", borderColor: "#C0392B" }}>
                  <ul className="space-y-2">
                    {examTraps.split(". ").filter((s: string) => s.trim()).map((sentence: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-[13px] leading-[1.6]" style={{ color: "#C0392B" }}>
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#C0392B" }} />
                        <span>{sentence.endsWith(".") ? sentence : sentence + "."}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </RevealCard>
            )}

            {/* FOOTER */}
            <div className="border-t border-gray-200 mt-12 pt-4">
              <p className="text-center text-[13px] mb-3">
                <a href={`/solutions/${asset.asset_name}`} className="text-blue-600 hover:underline">📖 View Full Solutions →</a>
                {hasFooterLinks && <span className="text-gray-300 mx-2">·</span>}
                {quizLink && <a href={quizLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">📝 Practice Quiz</a>}
                {quizLink && (whiteboardLink || videoLink) && <span className="text-gray-300 mx-2">·</span>}
                {whiteboardLink && <a href={whiteboardLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">📊 Whiteboard</a>}
                {whiteboardLink && videoLink && <span className="text-gray-300 mx-2">·</span>}
                {videoLink && <a href={videoLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">🎬 Video Walkthrough</a>}
              </p>
              <p className="text-center text-[11px] text-[#AAAAAA]">
                Survive Accounting · Lee Ingram · surviveaccounting.com
              </p>
            </div>
          </>
        )}
      </main>

      {/* ── Share FAB ── */}
      <button
        onClick={handleShare}
        className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-[13px] font-medium shadow-lg transition-all hover:scale-105 z-50"
        style={{ background: "#131E35" }}
      >
        Share <Share2 className="h-4 w-4" />
      </button>
    </div>
  );
}
