import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink } from "lucide-react";
import { JournalEntryTable } from "@/components/JournalEntryTable";

/* ── Types ── */
interface Question {
  id: string;
  topic_id: string;
  chapter_id: string;
  question_number: number;
  question_type: string;
  question_text: string;
  correct_answer: string;
  explanation_correct: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  explanation_a: string | null;
  explanation_b: string | null;
  explanation_c: string | null;
  explanation_d: string | null;
  je_accounts: any;
  je_description: string | null;
  example_asset_id: string | null;
}

interface TopicInfo {
  topic_name: string;
  topic_description: string | null;
}

interface ChapterInfo {
  chapter_number: number;
  chapter_name: string;
}

interface CourseInfo {
  course_name: string;
  code: string;
}

interface AssetInfo {
  id: string;
  asset_name: string;
  source_ref: string;
  problem_title: string;
  lw_activity_url: string | null;
  asset_type: string | null;
  supplementary_je_json: any;
}

/* ── Source ref sorting ── */
const PREFIX_ORDER: Record<string, number> = { BE: 0, QS: 1, E: 2, P: 3 };

function parseSourceRef(ref: string): { prefix: string; num: number } {
  const m = ref.match(/^([A-Z]+)\s*(\d+(?:\.\d+)?)/);
  if (!m) return { prefix: "ZZZ", num: 9999 };
  return { prefix: m[1], num: parseFloat(m[2]) };
}

function sortBySourceRef(a: AssetInfo, b: AssetInfo): number {
  const pa = parseSourceRef(a.source_ref);
  const pb = parseSourceRef(b.source_ref);
  const oa = PREFIX_ORDER[pa.prefix] ?? 99;
  const ob = PREFIX_ORDER[pb.prefix] ?? 99;
  if (oa !== ob) return oa - ob;
  return pa.num - pb.num;
}

function assetTypeBadge(ref: string): string {
  const p = ref.match(/^([A-Z]+)/)?.[1];
  if (p === "BE") return "BE";
  if (p === "QS") return "QS";
  if (p === "E") return "EX";
  if (p === "P") return "P";
  return p || "?";
}

/* ── Tabs ── */
type TabKey = "solution" | "je" | "examples";

export default function QuizExplanation() {
  const { questionId } = useParams<{ questionId: string }>();
  const [question, setQuestion] = useState<Question | null>(null);
  const [topic, setTopic] = useState<TopicInfo | null>(null);
  const [chapter, setChapter] = useState<ChapterInfo | null>(null);
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [jeData, setJeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("solution");

  useEffect(() => {
    if (!questionId) { setError(true); setLoading(false); return; }

    (async () => {
      try {
        const { data: q, error: qErr } = await supabase
          .from("topic_quiz_questions")
          .select("*")
          .eq("id", questionId)
          .single();
        if (qErr || !q) { setError(true); setLoading(false); return; }
        setQuestion(q as unknown as Question);

        const [topicRes, chapterRes, allAssetsRes] = await Promise.all([
          supabase.from("chapter_topics")
            .select("topic_name, topic_description, course_id")
            .eq("id", q.topic_id).single(),
          supabase.from("chapters")
            .select("chapter_number, chapter_name, course_id")
            .eq("id", q.chapter_id).single(),
          supabase.from("teaching_assets")
            .select("id, asset_name, source_ref, problem_title, lw_activity_url, asset_type, supplementary_je_json")
            .eq("topic_id", q.topic_id)
            .not("asset_approved_at", "is", null)
            .limit(10),
        ]);

        if (topicRes.data) setTopic(topicRes.data as unknown as TopicInfo);
        if (chapterRes.data) setChapter(chapterRes.data as unknown as ChapterInfo);

        // Build asset list: prioritize example_asset_id, then fill from topic
        const allAssets = (allAssetsRes.data as unknown as AssetInfo[]) || [];
        let finalAssets: AssetInfo[];
        if (q.example_asset_id) {
          const primary = allAssets.find((a) => a.id === q.example_asset_id);
          const others = allAssets.filter((a) => a.id !== q.example_asset_id).sort(sortBySourceRef).slice(0, 2);
          finalAssets = primary ? [primary, ...others] : others;
        } else {
          finalAssets = [...allAssets].sort(sortBySourceRef).slice(0, 3);
        }
        setAssets(finalAssets);

        // Gather JE data from assets that have supplementary_je_json
        const jes: any[] = [];
        if (allAssetsRes.data) {
          for (const a of allAssetsRes.data as any[]) {
            const json = a.supplementary_je_json;
            if (!json) continue;
            const entries = Array.isArray(json) ? json : (json as any)?.entries;
            if (!Array.isArray(entries)) continue;
            // Filter to only entries that have actual account lines
            const validEntries = entries.filter((e: any) => {
              const lines = e.accounts || e.lines || [];
              return Array.isArray(lines) && lines.length > 0;
            });
            if (validEntries.length > 0) {
              jes.push({ label: a.problem_title ? `${a.source_ref} — ${a.problem_title}` : a.source_ref, entries: validEntries });
            }
          }
        }
        setJeData(jes);

        // Fetch course info
        const courseId = (chapterRes.data as any)?.course_id || (topicRes.data as any)?.course_id;
        if (courseId) {
          const { data: c } = await supabase.from("courses")
            .select("course_name, code")
            .eq("id", courseId).single();
          if (c) setCourse(c as unknown as CourseInfo);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [questionId]);

  // Set transparent background immediately
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  }, []);

  // Height reporting for iframe — use resize message type
  const reportHeight = useCallback(() => {
    const height = document.body.scrollHeight;
    window.parent.postMessage({ type: "sa-height", height }, "*");
    window.parent.postMessage({ type: "resize", height }, "*");
  }, []);

  useEffect(() => {
    if (loading) return;
    // Report after render
    reportHeight();
    const t1 = setTimeout(reportHeight, 300);
    const t2 = setTimeout(reportHeight, 800);
    document.fonts.ready.then(reportHeight);
    // Also observe DOM size changes
    const observer = new ResizeObserver(reportHeight);
    observer.observe(document.body);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      observer.disconnect();
    };
  }, [loading, activeTab, reportHeight]);

  // Determine available tabs
  const availableTabs = useMemo(() => {
    const tabs: { key: TabKey; label: string }[] = [{ key: "solution", label: "Solution" }];

    if (jeData.length > 0) tabs.push({ key: "je", label: "Journal Entries" });
    if (assets.length > 0) tabs.push({ key: "examples", label: "Examples" });

    return tabs;
  }, [jeData, assets]);

  // Report issue mailto
  const reportMailto = useMemo(() => {
    if (!question) return "";
    const subject = encodeURIComponent(
      `Quiz Issue — ${course?.code || ""} Ch ${chapter?.chapter_number ?? "?"} — Q${question.question_number}`
    );
    const body = encodeURIComponent(
      [
        `Course: ${course?.course_name || "Unknown"} (${course?.code || ""})`,
        `Chapter: ${chapter?.chapter_number ?? "?"} — ${chapter?.chapter_name || ""}`,
        `Topic: ${topic?.topic_name || "Unknown"}`,
        `Question #: ${question.question_number}`,
        `Question ID: ${question.id}`,
        ``,
        `Issue:`,
        ``,
      ].join("\n")
    );
    return `mailto:lee@surviveaccounting.com?subject=${subject}&body=${body}`;
  }, [question, course, chapter, topic]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]" style={{ background: "transparent" }}>
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#e8e8e8" }} />
          <p className="text-xs" style={{ color: "#e8e8e8" }}>Loading explanation...</p>
        </div>
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="flex items-center justify-center min-h-[200px]" style={{ background: "transparent" }}>
        <p className="text-sm" style={{ color: "#e8e8e8" }}>Explanation not available.</p>
      </div>
    );
  }

  return (
    <div className="font-sans" style={{ fontSize: 14, background: "transparent", color: "#e8e8e8" }}>
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: "#14213D" }}>
        <img
          src="https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf121ac35937c4d438ca.png"
          alt="Survive Accounting"
          style={{ height: 22, width: "auto" }}
        />
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
          Ch. {chapter?.chapter_number} · {topic?.topic_name ? topic.topic_name.charAt(0).toUpperCase() + topic.topic_name.slice(1).toLowerCase() : ""}
        </span>
      </div>

      {/* Tab bar — pill style */}
      {availableTabs.length > 1 && (
        <div className="flex px-4 py-2 gap-2" style={{ background: "transparent" }}>
          {availableTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="py-1.5 px-3 text-xs font-medium transition-colors rounded-full"
              style={{
                backgroundColor: activeTab === t.key ? "#14213D" : "transparent",
                color: activeTab === t.key ? "white" : "#94a3b8",
                border: activeTab === t.key ? "none" : "1px solid rgba(255,255,255,0.15)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      <div className="px-4 py-4">
        {activeTab === "solution" && <SolutionTab question={question} />}
        {activeTab === "je" && <JeTab jeData={jeData} />}
        {activeTab === "examples" && <ExamplesTab assets={assets} />}
      </div>

      {/* Footer */}
      <div className="text-center py-3 space-y-1" style={{ background: "transparent" }}>
        <a
          href={reportMailto}
          className="inline-block text-xs font-medium hover:underline"
          style={{ color: "#94a3b8" }}
        >
          🐛 Report an issue with this question
        </a>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
          Survive Accounting · by Lee Ingram
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════ */
/*  TAB COMPONENTS                         */
/* ════════════════════════════════════════ */

/** Parse a JE option string (JSON array of {account_name, side}) into structured rows */
function parseJEOptionLocal(value: string | null | undefined): { account_name: string; side: string }[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0].account_name === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** Render a mini JE table for an option */
function JEOptionMiniTable({ rows }: { rows: { account_name: string; side: string }[] }) {
  const debits = rows.filter(r => r.side === "debit");
  const credits = rows.filter(r => r.side === "credit");
  const ordered = [...debits, ...credits];

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
          <th style={{ textAlign: "left", padding: "3px 4px", fontSize: 11, color: "#94a3b8" }}>Account</th>
          <th style={{ textAlign: "center", padding: "3px 4px", fontSize: 11, color: "#94a3b8", width: 50 }}>Debit</th>
          <th style={{ textAlign: "center", padding: "3px 4px", fontSize: 11, color: "#94a3b8", width: 50 }}>Credit</th>
        </tr>
      </thead>
      <tbody>
        {ordered.map((r, i) => (
          <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <td style={{ padding: "3px 4px", paddingLeft: r.side === "credit" ? 20 : 4, fontSize: 13, color: "#e8e8e8" }}>{r.account_name}</td>
            <td style={{ textAlign: "center", padding: "3px 4px", color: "#4ade80" }}>{r.side === "debit" ? "✓" : ""}</td>
            <td style={{ textAlign: "center", padding: "3px 4px", color: "#4ade80" }}>{r.side === "credit" ? "✓" : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Render wrong JE options as mini tables */
function JEWrongAnswers({ question }: { question: Question }) {
  const optMap: Record<string, string | null> = {
    a: question.option_a, b: question.option_b,
    c: question.option_c, d: question.option_d,
  };
  const expMap: Record<string, string | null> = {
    a: question.explanation_a, b: question.explanation_b,
    c: question.explanation_c, d: question.explanation_d,
  };
  const wrongKeys = ["a", "b", "c", "d"].filter((k) => k !== question.correct_answer);

  if (wrongKeys.length === 0) return null;

  return (
    <div>
      <p className="uppercase font-bold tracking-wider mb-2" style={{ fontSize: 10, color: "#dc2626" }}>
        ✗ WHY THE OTHER OPTIONS ARE WRONG
      </p>
      <div className="space-y-3">
        {wrongKeys.map((k) => {
          const jeRows = parseJEOptionLocal(optMap[k]);
          const exp = expMap[k];
          if (!jeRows && !exp) return null;
          return (
            <div key={k} className="rounded-md p-2.5" style={{ border: "1px solid rgba(252,165,165,0.4)", borderLeftWidth: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626" }}>Choice {k.toUpperCase()}</span>
              {jeRows && <div style={{ marginTop: 4 }}><JEOptionMiniTable rows={jeRows} /></div>}
              {exp && <p style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic", marginTop: 4 }}>{exp}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SolutionTab({ question }: { question: Question }) {
  // JE Recall questions — render correct answer as JE table with tooltips
  if (question.question_type === "je_recall" && Array.isArray(question.je_accounts) && question.je_accounts.length > 0) {
    const lines = question.je_accounts.map((a: any) => ({
      account: a.account_name,
      side: a.side || "debit",
      debit: a.side === "debit" ? (a.amount || 0) : 0,
      credit: a.side === "credit" ? (a.amount || 0) : 0,
      debit_credit_reason: a.debit_credit_reason || a.reason,
      amount_source: a.amount_source,
    }));

    return (
      <div className="space-y-4">
        <p className="text-xs italic" style={{ color: "#94a3b8" }}>
          Hover over each row to see why this entry is recorded this way.
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontStyle: "italic", marginBottom: 8 }}>
          Hover over each row to see why it's debited or credited.
        </p>
        <JournalEntryTable
          completedJson={[{ label: question.je_description || "Journal Entry", lines, unbalanced: false }]}
          mode="completed"
          showHeading={false}
        />
        {question.explanation_correct && (
          <div className="mt-3 rounded-md p-3" style={{ backgroundColor: "#1a3a1a", borderLeft: "3px solid #16a34a" }}>
            <p className="text-xs" style={{ color: "#4ade80", fontWeight: 600, marginBottom: 4 }}>WHY</p>
            <p className="text-sm leading-relaxed" style={{ color: "#e8e8e8" }}>{question.explanation_correct}</p>
          </div>
        )}
      </div>
    );
  }

  // JE Recall fallback — when je_accounts is empty but options have JE JSON
  if (question.question_type === "je_recall") {
    const optMap: Record<string, string | null> = {
      a: question.option_a, b: question.option_b,
      c: question.option_c, d: question.option_d,
    };
    const correctRows = parseJEOptionLocal(optMap[question.correct_answer]);

    return (
      <div className="space-y-5">
        <div>
          <p className="uppercase font-bold tracking-wider mb-2" style={{ fontSize: 10, color: "#16a34a" }}>
            ✓ CORRECT JOURNAL ENTRY
          </p>
          <div className="rounded-md p-3" style={{ backgroundColor: "#1a3a1a", borderLeft: "3px solid #16a34a" }}>
            {correctRows ? <JEOptionMiniTable rows={correctRows} /> : <p className="text-sm" style={{ color: "#e8e8e8" }}>{optMap[question.correct_answer]}</p>}
            {question.explanation_correct && (
              <p className="text-sm leading-relaxed" style={{ marginTop: 8, color: "#e8e8e8" }}>{question.explanation_correct}</p>
            )}
           </div>
        </div>
      </div>
    );
  }

  // MC questions — standard explanation with calculation highlighting
  const optMap: Record<string, string | null> = {
    a: question.option_a, b: question.option_b,
    c: question.option_c, d: question.option_d,
  };
  const expMap: Record<string, string | null> = {
    a: question.explanation_a, b: question.explanation_b,
    c: question.explanation_c, d: question.explanation_d,
  };

  const wrongKeys = ["a", "b", "c", "d"].filter((k) => k !== question.correct_answer);

  return (
    <div className="space-y-5">
      {/* Correct */}
      <div>
        <p className="uppercase font-bold tracking-wider mb-2" style={{ fontSize: 10, color: "#16a34a" }}>
          ✓ WHY THIS IS CORRECT
        </p>
        <div className="rounded-md p-4" style={{ backgroundColor: "#1a3a1a", borderLeft: "3px solid #16a34a" }}>
          <ExplanationText text={question.explanation_correct} />
        </div>
      </div>

      {/* Wrong answers */}
      {wrongKeys.length > 0 && (
        <div>
          <p className="uppercase font-bold tracking-wider mb-2" style={{ fontSize: 10, color: "#dc2626" }}>
            ✗ WHY THE OTHER OPTIONS ARE WRONG
          </p>
          <div className="space-y-3">
            {wrongKeys.map((k) => {
              const label = optMap[k];
              const exp = expMap[k];
              if (!label && !exp) return null;
              return (
                <div key={k} className="flex gap-3 items-start">
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 font-bold"
                    style={{ fontSize: 11, color: "#dc2626", border: "1px solid rgba(252,165,165,0.4)" }}
                  >
                    {k.toUpperCase()}
                  </span>
                  <div>
                    {label && (
                      <p className="font-bold" style={{ fontSize: 13, color: "#e8e8e8" }}>{label}</p>
                    )}
                    {exp && (
                      <p className="italic" style={{ fontSize: 12, color: "#94a3b8" }}>{exp}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Renders explanation text with dollar amounts / calculations in highlighted blocks */
function ExplanationText({ text }: { text: string }) {
  if (!text) return null;

  // Check if the text contains dollar amounts or calculation patterns
  const calcPattern = /\$[\d,]+(?:\.\d+)?|\d+\s*[×x*÷/]\s*\d+|=\s*\$?[\d,]+/g;
  const hasCalc = calcPattern.test(text);

  if (!hasCalc) {
    return <BulletedText text={text} />;
  }

  // Split text around calculation segments
  const parts = text.split(/(\$[\d,]+(?:\.\d+)?(?:\s*[×x*÷/+\-]\s*\$?[\d,]+(?:\.\d+)?)*(?:\s*=\s*\$?[\d,]+(?:\.\d+)?)?)/g);

  return (
    <p className="text-sm leading-relaxed" style={{ color: "#e8e8e8" }}>
      {parts.map((part, i) => {
        if (calcPattern.test(part)) {
          return (
            <span
              key={i}
              className="inline-block rounded px-1.5 py-0.5 mx-0.5 font-mono"
              style={{ backgroundColor: "rgba(255,255,255,0.1)", fontSize: 13, color: "#e8e8e8" }}
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

function JeTab({ jeData }: { jeData: any[] }) {
  return (
    <div className="space-y-4">
      <p className="uppercase font-bold tracking-wider mb-2" style={{ fontSize: 10, color: "#14213D" }}>
        RELATED JOURNAL ENTRIES
      </p>
      {jeData.map((je, idx) => (
        <div key={idx} className="space-y-1.5">
          <p className="text-xs font-semibold" style={{ color: "#e8e8e8" }}>{je.label}</p>
          {Array.isArray(je.entries) && je.entries.map((entry: any, ei: number) => {
            const rawLines = entry.accounts || entry.lines || [];
            if (!Array.isArray(rawLines) || rawLines.length === 0) return null;
            const lines = rawLines.map((line: any) => ({
              account: line.account_name || line.account,
              side: line.side || "debit",
              debit: line.side === "debit" ? (line.amount || 0) : 0,
              credit: line.side === "credit" ? (line.amount || 0) : 0,
              debit_credit_reason: line.debit_credit_reason || line.reason,
              amount_source: line.amount_source,
            }));
            if (lines.length === 0) return null;
            return (
              <JournalEntryTable
                key={ei}
                completedJson={[{
                  label: entry.description || `Entry ${ei + 1}`,
                  lines,
                  unbalanced: false,
                }]}
                mode="completed"
                heading={entry.description || undefined}
                showHeading={!!entry.description}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ExampleCard({ asset, isPrimary }: { asset: AssetInfo; isPrimary?: boolean }) {
  const badge = assetTypeBadge(asset.source_ref);
  const hasLink = asset.lw_activity_url && asset.lw_activity_url.trim().length > 0;

  return (
    <div
      className="rounded-lg border p-4 flex items-center justify-between gap-3"
      style={{ borderColor: isPrimary ? "#bfdbfe" : "#e2e8f0", backgroundColor: isPrimary ? "#f0f7ff" : undefined }}
    >
      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 font-bold"
          style={{ fontSize: 10, color: "#2563eb", backgroundColor: "#eff6ff" }}
        >
          {badge}
        </span>
        <p className="text-sm font-medium text-slate-700">
          {asset.problem_title ? `${asset.source_ref} — ${asset.problem_title}` : asset.source_ref}
        </p>
      </div>
      {hasLink ? (
        <a
          href={asset.lw_activity_url!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium shrink-0"
          style={{ color: "#2563eb" }}
        >
          View in course <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <span
          className="rounded px-1.5 py-0.5 text-xs shrink-0"
          style={{ color: "#94a3b8", backgroundColor: "#f1f5f9", fontSize: 10 }}
        >
          Link pending
        </span>
      )}
    </div>
  );
}

function ExamplesTab({ assets }: { assets: AssetInfo[] }) {
  if (assets.length === 0) return null;

  const primary = assets[0];
  const more = assets.slice(1);

  return (
    <div className="space-y-3">
      <p className="uppercase font-bold tracking-wider mb-2" style={{ fontSize: 10, color: "#14213D" }}>
        RELATED EXAMPLES
      </p>
      <ExampleCard asset={primary} isPrimary />
      {more.length > 0 && (
        <>
          <p className="uppercase font-bold tracking-wider mt-4 mb-1" style={{ fontSize: 9, color: "#94a3b8" }}>
            MORE EXAMPLES
          </p>
          {more.map((a) => (
            <ExampleCard key={a.id} asset={a} />
          ))}
        </>
      )}
    </div>
  );
}

/** Render text as bulleted list — splits on newlines/sentences */
function BulletedText({ text }: { text: string }) {
  const bullets = text
    .split(/\n|(?<=\.)\s+(?=[A-Z])/)
    .map((s) => s.replace(/^[•\-–—]\s*/, "").trim())
    .filter((s) => s.length > 0);

  if (bullets.length <= 1) {
    return <p className="text-sm leading-relaxed" style={{ color: "#e8e8e8" }}>{text}</p>;
  }

  return (
    <ul className="space-y-3">
      {bullets.map((b, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed" style={{ color: "#e8e8e8" }}>
          <span className="shrink-0 mt-1" style={{ color: "#f59e0b" }}>•</span>
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}
