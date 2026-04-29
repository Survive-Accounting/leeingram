import { useEffect, useMemo, useState } from "react";
import { Menu, MessageCircleQuestion, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RetroBreadcrumbs } from "@/components/study-previewer/RetroBreadcrumbs";
import { JETooltip } from "@/components/JETooltip";
import {
  isCanonicalJE,
  formatAmount,
  type CanonicalJEPayload,
  type CanonicalJERow,
} from "@/lib/journalEntryParser";

interface ChapterInfo {
  id: string;
  chapter_number: number;
  chapter_name: string;
}

interface JEHelperPanelProps {
  chapter: ChapterInfo | null;
  onShareFeedback: () => void;
  onGoHome: () => void;
  onGoChapter: () => void;
}

interface FlatEntry {
  key: string;
  /** Transaction description (or fallback) */
  description: string;
  /** Small muted source line, e.g. "E15.10 · Part (a) · Dec 31, 2026" */
  source: string;
  rows: CanonicalJERow[];
}

interface AssetRow {
  id: string;
  asset_name: string;
  source_number: string | null;
  instruction_list: string | null;
  journal_entry_completed_json: any;
}

/** Format a YYYY-MM-DD into "Mon D, YYYY" without UTC drift */
function fmtDate(raw?: string | null): string {
  if (!raw) return "";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return raw;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Pull a short "transaction description" from the scenario label / instructions. */
function deriveDescription(scenarioLabel: string, instructions: string | null, dateLabel: string): string {
  const label = (scenarioLabel || "").trim();
  // Long-form labels are usually descriptive — use them.
  if (label && label.split(/\s+/).length >= 4) return label;

  // Try to extract the matching part letter, e.g. "(a)" -> first sentence after "(a)" in instructions.
  const partMatch = label.match(/\(([a-z])\)/i);
  if (partMatch && instructions) {
    const re = new RegExp(`\\(${partMatch[1]}\\)\\s*([^()\\n]+)`, "i");
    const m = instructions.match(re);
    if (m && m[1]) {
      const sentence = m[1].trim().replace(/\s+/g, " ").split(/(?<=[.?!])\s/)[0];
      if (sentence && sentence.length > 8) {
        return sentence.replace(/[.,;:]+$/, "");
      }
    }
  }

  if (label) return label;
  return dateLabel ? `Entry — ${dateLabel}` : "Journal Entry";
}

function flattenAssets(assets: AssetRow[]): FlatEntry[] {
  const out: FlatEntry[] = [];
  for (const a of assets) {
    const payload = a.journal_entry_completed_json;
    if (!isCanonicalJE(payload)) continue;
    const canonical = payload as CanonicalJEPayload;
    canonical.scenario_sections.forEach((sc, si) => {
      sc.entries_by_date.forEach((entry, ei) => {
        if (!entry.rows || entry.rows.length === 0) return;
        const dateLabel = fmtDate((entry as any).entry_date ?? (entry as any).date);
        const description = deriveDescription(sc.label, a.instructions, dateLabel);
        const sourceParts: string[] = [];
        if (a.source_number) sourceParts.push(a.source_number);
        if (sc.label && sc.label !== description) sourceParts.push(sc.label);
        if (dateLabel) sourceParts.push(dateLabel);
        out.push({
          key: `${a.id}-${si}-${ei}`,
          description,
          source: sourceParts.join("  ·  "),
          rows: entry.rows,
        });
      });
    });
  }
  return out;
}

export default function JEHelperPanel({
  chapter,
  onShareFeedback,
  onGoHome,
  onGoChapter,
}: JEHelperPanelProps) {
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<AssetRow[]>([]);

  useEffect(() => {
    if (!chapter?.id) { setAssets([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, source_number, instruction_list, journal_entry_completed_json")
        .eq("chapter_id", chapter.id)
        .not("journal_entry_completed_json", "is", null)
        .order("source_number", { ascending: true, nullsFirst: false })
        .order("asset_name", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error("[JEHelperPanel] fetch error", error);
        setAssets([]);
      } else {
        setAssets((data ?? []) as AssetRow[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [chapter?.id]);

  const entries = useMemo(() => flattenAssets(assets), [assets]);

  return (
    <div className="w-full flex justify-center px-2 sm:px-6 py-6 sm:py-10 animate-fade-in">
      <div className="w-full" style={{ maxWidth: 980 }}>
        {/* Laptop lid */}
        <div
          className="relative rounded-t-[18px] p-3 sm:p-4"
          style={{
            background: "linear-gradient(180deg, #1F1F23 0%, #141417 100%)",
            border: "1px solid #2A2A30",
            boxShadow:
              "0 30px 60px -25px rgba(0,0,0,0.6), 0 10px 24px -10px rgba(0,0,0,0.4)",
          }}
        >
          <div
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 top-1.5 rounded-full"
            style={{ width: 4, height: 4, background: "#3A3A42" }}
          />

          {/* Screen */}
          <div
            className="relative rounded-md overflow-hidden"
            style={{
              background: "#0B1326",
              border: "1px solid rgba(0,0,0,0.4)",
              minHeight: "clamp(380px, 56vw, 560px)",
            }}
          >
            {/* Header — mirrors V2 viewer header */}
            <header
              className="grid items-center gap-2 px-3 sm:px-5 h-12"
              style={{
                gridTemplateColumns: "1fr auto 1fr",
                background: "#14213D",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="flex items-center min-w-0">
                <span
                  className="truncate text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  Spring '26 <span style={{ color: "#FF8A95" }}>Beta</span>
                </span>
              </div>

              <div className="flex items-center justify-center min-w-0">
                <div
                  className="inline-flex items-center gap-2 h-9 pl-2.5 pr-3.5 rounded-md text-sm font-semibold max-w-full"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.95)",
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center h-5 w-5 rounded shrink-0"
                    style={{ background: "rgba(206,17,38,0.2)", color: "#FF8A95" }}
                  >
                    <Menu className="h-3 w-3" />
                  </span>
                  <span className="leading-tight whitespace-nowrap">View Journal Entries</span>
                  {chapter && (
                    <span
                      className="hidden md:inline text-[11px] font-medium truncate max-w-[160px] pl-0.5"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      · Ch {chapter.chapter_number}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={onShareFeedback}
                  className="inline-flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto sm:px-3 rounded-full text-xs font-medium transition-colors hover:bg-white/[0.06]"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.85)",
                  }}
                >
                  <MessageCircleQuestion
                    className="h-4 w-4 sm:h-3.5 sm:w-3.5"
                    style={{ color: "rgba(255,255,255,0.7)" }}
                  />
                  <span className="hidden sm:inline">Share Feedback</span>
                </button>
              </div>
            </header>

            {/* Breadcrumbs */}
            <RetroBreadcrumbs
              crumbs={[
                { label: "home", onClick: onGoHome },
                ...(chapter
                  ? [{ label: `ch ${chapter.chapter_number}`, onClick: onGoChapter }]
                  : []),
                { label: "je helper" },
              ]}
            />

            {/* Body */}
            <div className="bg-white" style={{ minHeight: 420 }}>
              <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                <div className="mb-5">
                  <h2
                    className="text-[20px] sm:text-[22px] font-semibold leading-tight"
                    style={{ color: "#14213D", fontFamily: "'DM Serif Display', serif" }}
                  >
                    {chapter
                      ? `Journal Entries — Ch ${chapter.chapter_number}: ${chapter.chapter_name}`
                      : "Journal Entries"}
                  </h2>
                  <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "#475569" }}>
                    Every journal entry in this chapter, in one place. Hover the{" "}
                    <span className="inline-block align-middle px-1 text-[11px] rounded border border-slate-300 text-slate-500">
                      ⓘ
                    </span>{" "}
                    icons to see why each account is debited or credited and where each amount comes from.
                  </p>
                </div>

                {loading && (
                  <div className="flex items-center gap-2 text-[13px] py-10 justify-center" style={{ color: "#64748B" }}>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading journal entries…
                  </div>
                )}

                {!loading && entries.length === 0 && (
                  <div className="text-center py-12 text-[14px]" style={{ color: "#64748B" }}>
                    No journal entries available for this chapter yet — try another chapter.
                  </div>
                )}

                {!loading && entries.length > 0 && (
                  <ul className="space-y-5">
                    {entries.map((e) => (
                      <li key={e.key}>
                        <JECard entry={e} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Per-entry card ─── */

function JECard({ entry }: { entry: FlatEntry }) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: "#0F172A",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
      }}
    >
      <div className="px-4 sm:px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-[14px] font-semibold leading-snug" style={{ color: "#F1F5F9" }}>
          {entry.description}
        </p>
        {entry.source && (
          <p className="mt-0.5 text-[11px] tracking-wide" style={{ color: "rgba(241,245,249,0.45)" }}>
            {entry.source}
          </p>
        )}
      </div>
      <div className="px-2 sm:px-3 py-2">
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <th
                className="text-left px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold"
                style={{ color: "rgba(241,245,249,0.5)" }}
              >
                Account
              </th>
              <th
                className="text-right px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold w-28"
                style={{ color: "rgba(241,245,249,0.5)" }}
              >
                Debit
              </th>
              <th
                className="text-right px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold w-28"
                style={{ color: "rgba(241,245,249,0.5)" }}
              >
                Credit
              </th>
            </tr>
          </thead>
          <tbody>
            {entry.rows.map((row, ri) => {
              const isCredit = row.credit != null && row.credit !== 0;
              const reason = (row as any).debit_credit_reason as string | undefined;
              const amountSource = (row as any).amount_source as string | undefined;
              return (
                <tr key={ri} style={{ borderBottom: ri === entry.rows.length - 1 ? undefined : "1px solid rgba(255,255,255,0.04)" }}>
                  <td
                    className={`px-3 py-1.5 ${isCredit ? "pl-10" : ""}`}
                    style={{ color: "#F1F5F9" }}
                  >
                    {row.account_name}
                    {reason && <JETooltip text={reason} variant="solutions" />}
                  </td>
                  <td className="text-right px-3 py-1.5 font-mono" style={{ color: "#F1F5F9" }}>
                    {!isCredit && row.debit != null ? (
                      <span>
                        {formatAmount(row.debit)}
                        {amountSource && <JETooltip text={amountSource} variant="solutions" />}
                      </span>
                    ) : ""}
                  </td>
                  <td className="text-right px-3 py-1.5 font-mono" style={{ color: "#F1F5F9" }}>
                    {isCredit ? (
                      <span>
                        {formatAmount(row.credit)}
                        {amountSource && <JETooltip text={amountSource} variant="solutions" />}
                      </span>
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
}
