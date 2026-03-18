import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

const enrollUrl = import.meta.env.VITE_LEARNWORLDS_ENROLL_URL || "https://surviveaccounting.com";

// ── Pipe table rendering (same as SolutionsViewer) ───────────────────

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

function isNumericCell(cell: string): boolean {
  return /^\$?[\d,]+(\.\d+)?%?$/.test(cell.trim());
}

function PipeTable({ rows }: { rows: string[][] }) {
  const [header, ...body] = rows;
  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-[13px]">
        <thead>
          <tr style={{ background: "#1A2E55" }}>
            {header.map((h, i) => <th key={i} className="px-3 py-2 text-center text-white font-bold text-[12px]">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "#FFFFFF" : "#F8F9FA" }}>
              {row.map((cell, ci) => <td key={ci} className={`px-3 py-1.5 text-center text-[12px] ${isNumericCell(cell) ? "font-mono" : ""}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
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

// ── Redacted placeholder blocks ──────────────────────────────────────

function RedactedLines({ widths }: { widths: string[] }) {
  return (
    <div className="space-y-2">
      {widths.map((w, i) => (
        <div key={i} className="rounded" style={{ width: w, height: 14, background: "#CBD5E0" }} />
      ))}
    </div>
  );
}

function RedactedJETable() {
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
          {[70, 55, 65, 50].map((w, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#F8F9FA" }}>
              <td className="px-3 py-2"><div className="rounded" style={{ width: `${w}%`, height: 12, background: "#CBD5E0" }} /></td>
              <td className="px-3 py-2 text-right"><div className="rounded ml-auto" style={{ width: 48, height: 12, background: "#CBD5E0" }} /></td>
              <td className="px-3 py-2 text-right"><div className="rounded ml-auto" style={{ width: 48, height: 12, background: i % 2 !== 0 ? "#CBD5E0" : "transparent" }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RedactedFormulas() {
  return (
    <div className="rounded-md p-4 pl-5 border-l-[3px] space-y-2" style={{ background: "#FFFBEB", borderColor: "#D97706" }}>
      {["85%", "70%", "60%"].map((w, i) => (
        <div key={i} className="rounded" style={{ width: w, height: 14, background: "#D4C99E" }} />
      ))}
    </div>
  );
}

function UnlockPill() {
  return (
    <div className="flex justify-center mt-3">
      <a
        href={enrollUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-white text-[12px] font-medium transition-all hover:scale-105"
        style={{ background: "#131E35" }}
      >
        🔒 Unlock with Study Pass →
      </a>
    </div>
  );
}

// ── Section heading (smaller variant) ────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold tracking-[0.12em] uppercase pb-1 mb-2 mt-5 border-b border-gray-200" style={{ color: "#131E35" }}>
      {children}
    </p>
  );
}

// ── Main component ───────────────────────────────────────────────────

interface BlurredPreviewProps {
  assetId: string;
}

export default function BlurredPreview({ assetId }: BlurredPreviewProps) {
  const [swappedContext, setSwappedContext] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);

  const { data: asset, isLoading } = useQuery({
    queryKey: ["blurred-preview", assetId],
    queryFn: async () => {
      const { data } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, source_ref, problem_context, survive_solution_text, important_formulas, concept_notes, exam_traps, chapter_id, course_id")
        .eq("id", assetId)
        .single();
      if (!data) return null;

      let chapter: any = null;
      let course: any = null;
      if (data.chapter_id) { const { data: ch } = await supabase.from("chapters").select("chapter_number, chapter_name").eq("id", data.chapter_id).single(); chapter = ch; }
      if (data.course_id) { const { data: c } = await supabase.from("courses").select("course_name").eq("id", data.course_id).single(); course = c; }

      const { data: instructions } = await supabase
        .from("problem_instructions")
        .select("instruction_number, instruction_text")
        .eq("teaching_asset_id", data.id)
        .order("instruction_number");

      return { ...(data as any), chapter, course, instructions: instructions || [] };
    },
    enabled: !!assetId,
  });

  const handleSwapNumbers = async () => {
    if (!asset) return;
    setSwapping(true);
    try {
      const { data, error } = await supabase.functions.invoke("swap-problem-numbers", {
        body: { teaching_asset_id: asset.id },
      });
      if (error) throw error;
      if (data?.success && data.new_problem_context) {
        setSwappedContext(data.new_problem_context);
        toast.success("New numbers generated — get the solution with Study Pass");
      } else {
        throw new Error(data?.error || "Failed to generate new numbers");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to swap numbers");
    } finally {
      setSwapping(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 p-8 flex items-center justify-center" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
        <div className="animate-spin h-6 w-6 border-3 border-gray-200 border-t-[#131E35] rounded-full" />
      </div>
    );
  }

  if (!asset) return null;

  const problemContext = swappedContext || asset.problem_context || "";
  const sortedInstr = [...(asset.instructions || [])].sort((a: any, b: any) => a.instruction_number - b.instruction_number);
  const hasJE = !!(asset as any).journal_entry_raw?.trim();
  const hasAnswer = !!(asset as any).survive_solution_text?.trim();
  const hasFormulas = !!(asset as any).important_formulas?.trim();
  const hasConcepts = !!(asset as any).concept_notes?.trim();
  const hasTraps = !!(asset as any).exam_traps?.trim();

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
      {/* ── Header bar ── */}
      <div className="px-5 py-2.5 border-b border-gray-200" style={{ background: "#F8F9FA" }}>
        <span className="font-mono font-bold text-[13px]" style={{ color: "#131E35" }}>{asset.asset_name}</span>
        <span className="text-gray-400 text-[11px] ml-2">
          {asset.course?.course_name} · Ch {asset.chapter?.chapter_number} — {asset.chapter?.chapter_name} · {asset.source_ref}
        </span>
      </div>

      <div className="p-5">
        {/* ── PROBLEM (visible) ── */}
        <SectionLabel>PROBLEM</SectionLabel>
        <SmartContent text={problemContext} className="text-[13px] leading-[1.7] text-[#1A1A1A]" />

        {/* ── REQUIRED (visible) ── */}
        {sortedInstr.length > 0 && (
          <>
            <SectionLabel>REQUIRED</SectionLabel>
            <div className="space-y-3">
              {sortedInstr.filter((i: any) => i.instruction_text?.trim()).map((inst: any, idx: number) => {
                const letter = String.fromCharCode(97 + idx);
                return (
                  <p key={idx} className="text-[13px] leading-[1.6]">
                    <span className="font-bold" style={{ color: "#131E35" }}>({letter})</span> {inst.instruction_text}
                  </p>
                );
              })}
            </div>
          </>
        )}

        {/* ── Button bar ── */}
        <div className="flex items-center gap-3 mt-5 mb-2 flex-wrap">
          <button
            onClick={handleSwapNumbers}
            disabled={swapping}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium border transition-colors hover:bg-gray-50 disabled:opacity-60"
            style={{ borderColor: "#131E35", color: "#131E35" }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${swapping ? "animate-spin" : ""}`} />
            {swapping ? "Generating..." : "✨ Try New Numbers"}
          </button>
          <a
            href={`/practice/${asset.asset_name}?preview=true`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-medium text-white transition-all hover:opacity-90"
            style={{ background: "#131E35" }}
          >
            🔒 See Full Solution →
          </a>
        </div>

        {/* ── Redacted sections ── */}

        {hasJE && (
          <>
            <SectionLabel>JOURNAL ENTRIES</SectionLabel>
            <RedactedJETable />
            <UnlockPill />
          </>
        )}

        {hasAnswer && (
          <>
            <SectionLabel>ANSWER SUMMARY</SectionLabel>
            <RedactedLines widths={["90%", "75%", "85%", "60%", "80%"]} />
            <UnlockPill />
          </>
        )}

        {hasFormulas && (
          <>
            <SectionLabel>IMPORTANT FORMULAS</SectionLabel>
            <RedactedFormulas />
            <UnlockPill />
          </>
        )}

        {hasConcepts && (
          <>
            <SectionLabel>KEY CONCEPTS</SectionLabel>
            <RedactedLines widths={["80%", "65%", "90%", "50%"]} />
            <UnlockPill />
          </>
        )}

        {hasTraps && (
          <>
            <SectionLabel>⚠ EXAM TRAPS</SectionLabel>
            <div className="rounded-md p-4 pl-5 border-l-[3px]" style={{ background: "#FFF5F5", borderColor: "#C0392B" }}>
              <RedactedLines widths={["85%", "70%", "60%"]} />
            </div>
            <UnlockPill />
          </>
        )}
      </div>
    </div>
  );
}
