import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

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
  concept_notes: string | null;
  exam_traps: any;
  important_formulas: any;
  supplementary_je_json: any;
}

/* ── Account type detection ── */
const ASSET_EXPENSE_KEYWORDS = [
  "cash", "accounts receivable", "receivable", "inventory", "equipment",
  "supplies", "land", "building", "prepaid", "investment", "vehicle",
  "furniture", "machinery", "cost of goods", "cogs", "expense", "depreciation expense",
  "amortization expense", "interest expense", "rent expense", "salary expense",
  "wages expense", "insurance expense", "tax expense", "utilities expense",
  "loss", "dividend", "drawing", "withdrawal",
];

const LIABILITY_EQUITY_REVENUE_KEYWORDS = [
  "accounts payable", "payable", "unearned", "deferred", "notes payable",
  "bonds payable", "mortgage", "liability", "accrued", "revenue", "sales",
  "service revenue", "interest revenue", "gain", "income", "retained earnings",
  "common stock", "capital", "equity", "accumulated depreciation",
  "accumulated amortization", "allowance",
];

function getAccountCategory(name: string): "asset_expense" | "liability_equity_revenue" {
  const lower = name.toLowerCase();
  for (const kw of LIABILITY_EQUITY_REVENUE_KEYWORDS) {
    if (lower.includes(kw)) return "liability_equity_revenue";
  }
  for (const kw of ASSET_EXPENSE_KEYWORDS) {
    if (lower.includes(kw)) return "asset_expense";
  }
  return "asset_expense";
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

/* ── Tabs ── */
type TabKey = "solution" | "je" | "concepts" | "traps" | "example";

export default function QuizExplanation() {
  const { questionId } = useParams<{ questionId: string }>();
  const [question, setQuestion] = useState<Question | null>(null);
  const [topic, setTopic] = useState<TopicInfo | null>(null);
  const [chapter, setChapter] = useState<ChapterInfo | null>(null);
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [assets, setAssets] = useState<AssetInfo[]>([]);
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

        const [topicRes, chapterRes, assetsRes] = await Promise.all([
          supabase.from("chapter_topics")
            .select("topic_name, topic_description, course_id")
            .eq("id", q.topic_id).single(),
          supabase.from("chapters")
            .select("chapter_number, chapter_name, course_id")
            .eq("id", q.chapter_id).single(),
          supabase.from("teaching_assets")
            .select("id, asset_name, source_ref, problem_title, concept_notes, exam_traps, important_formulas, supplementary_je_json")
            .eq("topic_id", q.topic_id)
            .limit(3),
        ]);

        if (topicRes.data) setTopic(topicRes.data as unknown as TopicInfo);
        if (chapterRes.data) setChapter(chapterRes.data as unknown as ChapterInfo);
        if (assetsRes.data) setAssets(assetsRes.data as unknown as AssetInfo[]);

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

  // Height reporting for iframe
  useEffect(() => {
    if (loading) return;
    const report = () => {
      window.parent.postMessage(
        { type: "sa-height", height: document.body.scrollHeight },
        "*"
      );
    };
    report();
    const timer = setTimeout(report, 500);
    return () => clearTimeout(timer);
  }, [loading, activeTab]);

  // Determine available tabs
  const availableTabs = useMemo(() => {
    const tabs: { key: TabKey; label: string }[] = [{ key: "solution", label: "Solution" }];

    const hasJe = question?.question_type === "je_recall" ||
      assets.some((a) => a.supplementary_je_json);
    if (hasJe) tabs.push({ key: "je", label: "Journal Entry" });

    if (assets.some((a) => a.concept_notes || a.important_formulas))
      tabs.push({ key: "concepts", label: "Concepts" });
    if (assets.some((a) => a.exam_traps)) tabs.push({ key: "traps", label: "Exam Traps" });
    if (assets.length > 0) tabs.push({ key: "example", label: "Example" });

    return tabs;
  }, [question, assets]);

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
      <div className="flex items-center justify-center min-h-[200px] bg-white">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          <p className="text-xs text-slate-400">Loading explanation...</p>
        </div>
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="flex items-center justify-center min-h-[200px] bg-white">
        <p className="text-sm text-slate-400">Explanation not available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white text-slate-900 min-h-screen font-sans" style={{ fontSize: 14 }}>
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: "#14213D" }}>
        <span className="text-white font-bold" style={{ fontSize: 13 }}>📖 Deep Explanation</span>
        <span className="text-white/50" style={{ fontSize: 11 }}>
          {topic?.topic_name} · Ch {chapter?.chapter_number}
        </span>
      </div>

      {/* Tab bar */}
      {availableTabs.length > 1 && (
        <div className="flex border-b border-slate-200 px-4 gap-4 bg-white">
          {availableTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="py-2 text-xs font-medium transition-colors relative"
              style={{
                color: activeTab === t.key ? "#14213D" : "#94a3b8",
                borderBottom: activeTab === t.key ? "2px solid #14213D" : "2px solid transparent",
                marginBottom: -1,
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
        {activeTab === "je" && <JeTab question={question} assets={assets} />}
        {activeTab === "concepts" && <ConceptsTab assets={assets} />}
        {activeTab === "traps" && <TrapsTab assets={assets} />}
        {activeTab === "example" && <ExampleTab assets={assets} />}
      </div>

      {/* Footer with report issue */}
      <div className="text-center py-3 space-y-1" style={{ backgroundColor: "#f8fafc" }}>
        <a
          href={reportMailto}
          className="inline-block text-xs font-medium hover:underline"
          style={{ color: "#64748b" }}
        >
          🐛 Report an issue with this question
        </a>
        <p style={{ fontSize: 11, color: "#cbd5e1" }}>
          Survive Accounting · by Lee Ingram
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════ */
/*  TAB COMPONENTS                         */
/* ════════════════════════════════════════ */

function SolutionTab({ question }: { question: Question }) {
  const optMap: Record<string, string | null> = {
    a: question.option_a, b: question.option_b,
    c: question.option_c, d: question.option_d,
  };
  const expMap: Record<string, string | null> = {
    a: question.explanation_a, b: question.explanation_b,
    c: question.explanation_c, d: question.explanation_d,
  };

  const wrongKeys = question.question_type === "mc"
    ? ["a", "b", "c", "d"].filter((k) => k !== question.correct_answer)
    : question.question_type === "true_false"
      ? ["a", "b"].filter((k) => k !== question.correct_answer)
      : [];

  return (
    <div className="space-y-5">
      {/* Correct */}
      <div>
        <p className="uppercase font-bold tracking-wider mb-2" style={{ fontSize: 10, color: "#16a34a" }}>
          ✓ WHY THIS IS CORRECT
        </p>
        <div
          className="rounded-md p-4"
          style={{ backgroundColor: "#f0fdf4", borderLeft: "3px solid #16a34a" }}
        >
          <p style={{ fontSize: 14, lineHeight: 1.65 }}>{question.explanation_correct}</p>
        </div>
      </div>

      {/* Wrong answers (MC/TF only) */}
      {wrongKeys.length > 0 && (
        <div>
          <p className="uppercase font-bold tracking-wider mb-2" style={{ fontSize: 10, color: "#dc2626" }}>
            ✗ WHY THE OTHER OPTIONS ARE WRONG
          </p>
          <div className="space-y-3">
            {wrongKeys.map((k) => {
              const label = question.question_type === "true_false"
                ? (k === "a" ? "True" : "False")
                : optMap[k];
              const exp = expMap[k];
              if (!label && !exp) return null;
              return (
                <div key={k} className="flex gap-3 items-start">
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 font-bold"
                    style={{ fontSize: 11, color: "#dc2626", border: "1px solid #fca5a5" }}
                  >
                    {k.toUpperCase()}
                  </span>
                  <div>
                    {label && (
                      <p className="font-bold" style={{ fontSize: 13, color: "#374151" }}>{label}</p>
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

function JeTab({ question, assets }: { question: Question; assets: AssetInfo[] }) {
  const [showWhy, setShowWhy] = useState(false);
  const [showSupp, setShowSupp] = useState(false);

  const accounts = Array.isArray(question.je_accounts) ? question.je_accounts : [];

  // Gather supplementary JE from assets
  const suppEntries: any[] = [];
  for (const a of assets) {
    const json = a.supplementary_je_json;
    if (!json) continue;
    const entries = Array.isArray(json) ? json : (json as any)?.entries;
    if (Array.isArray(entries)) {
      for (const e of entries.slice(0, 2)) {
        if (suppEntries.length < 2) suppEntries.push(e);
      }
    }
  }

  return (
    <div className="space-y-4">
      {accounts.length > 0 && (
        <div>
          <p className="uppercase font-bold tracking-wider mb-2" style={{ fontSize: 10, color: "#14213D" }}>
            THE JOURNAL ENTRY
          </p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: "#14213D", color: "white" }}>
                <th className="text-left py-1.5 px-3 font-semibold" style={{ fontSize: 12 }}>Account</th>
                <th className="text-left py-1.5 px-3 font-semibold" style={{ fontSize: 12 }}>Type</th>
                <th className="text-left py-1.5 px-3 font-semibold" style={{ fontSize: 12 }}>Side</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a: any, i: number) => {
                const cat = getAccountCategory(a.account_name ?? "");
                const isDebit = a.side === "debit";
                return (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1.5 px-3" style={{ fontSize: 13, fontWeight: isDebit ? 600 : 400, paddingLeft: isDebit ? 12 : 28 }}>
                      {a.account_name}
                    </td>
                    <td className="py-1.5 px-3">
                      <span
                        className="rounded px-1.5 py-0.5"
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: cat === "asset_expense" ? "#2563eb" : "#7c3aed",
                          backgroundColor: cat === "asset_expense" ? "#eff6ff" : "#f5f3ff",
                        }}
                      >
                        {cat === "asset_expense" ? "(+Dr / -Cr)" : "(-Dr / +Cr)"}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 font-bold" style={{ fontSize: 13, color: isDebit ? "#2563eb" : "#7c3aed" }}>
                      {isDebit ? "DR" : "CR"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Collapsible why */}
          <button
            onClick={() => setShowWhy(!showWhy)}
            className="mt-2 text-xs font-medium"
            style={{ color: "#64748b" }}
          >
            💡 {showWhy ? "Hide" : "Why these entries?"}
          </button>
          {showWhy && question.explanation_correct && (
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "#64748b" }}>
              {question.explanation_correct}
            </p>
          )}
        </div>
      )}

      {suppEntries.length > 0 && (
        <div>
          <button
            onClick={() => setShowSupp(!showSupp)}
            className="text-xs font-medium"
            style={{ color: "#64748b" }}
          >
            📝 {showSupp ? "Hide" : "Show"} related journal entries ({suppEntries.length})
          </button>
          {showSupp && (
            <div className="mt-2 space-y-3">
              {suppEntries.map((entry: any, idx: number) => (
                <div key={idx} className="rounded border border-slate-200 p-3">
                  {entry.description && (
                    <p className="text-xs font-medium mb-2" style={{ color: "#374151" }}>
                      {entry.description}
                    </p>
                  )}
                  {Array.isArray(entry.accounts || entry.lines) && (
                    <div className="text-xs space-y-1" style={{ color: "#475569" }}>
                      {(entry.accounts || entry.lines).map((line: any, li: number) => {
                        const isDebit = line.side === "debit";
                        return (
                          <p key={li} style={{ paddingLeft: isDebit ? 0 : 16 }}>
                            <span className="font-bold" style={{ color: isDebit ? "#2563eb" : "#7c3aed" }}>
                              {isDebit ? "DR" : "CR"}
                            </span>{" "}
                            {line.account_name || line.account}
                            {line.amount && (
                              <span className="ml-2" style={{ color: "#94a3b8" }}>
                                {typeof line.amount === "number" ? `$${line.amount.toLocaleString()}` : line.amount}
                              </span>
                            )}
                          </p>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {accounts.length === 0 && suppEntries.length === 0 && (
        <p className="text-xs text-center py-4" style={{ color: "#94a3b8" }}>
          No journal entries available for this question.
        </p>
      )}
    </div>
  );
}

/** Render text as bulleted list — splits on newlines/sentences */
function BulletedText({ text }: { text: string }) {
  // Split on newlines, periods followed by capital letters, or bullet chars
  const bullets = text
    .split(/\n|(?<=\.)\s+(?=[A-Z])/)
    .map((s) => s.replace(/^[•\-–—]\s*/, "").trim())
    .filter((s) => s.length > 0);

  if (bullets.length <= 1) {
    return <p className="text-sm leading-relaxed">{text}</p>;
  }

  return (
    <ul className="space-y-3">
      {bullets.map((b, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed">
          <span className="shrink-0 mt-1" style={{ color: "#d97706" }}>•</span>
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}

function ConceptsTab({ assets }: { assets: AssetInfo[] }) {
  const conceptAsset = assets.find((a) => a.concept_notes);
  const formulaAsset = assets.find((a) => a.important_formulas);

  const formulaText = useMemo(() => {
    if (!formulaAsset?.important_formulas) return null;
    const f = formulaAsset.important_formulas;
    if (typeof f === "string") return f;
    if (Array.isArray(f)) return f.join("\n\n");
    return JSON.stringify(f, null, 2);
  }, [formulaAsset]);

  return (
    <div className="space-y-5">
      {conceptAsset?.concept_notes && (
        <div>
          <p className="uppercase font-bold tracking-wider mb-2" style={{ fontSize: 10, color: "#d97706" }}>
            KEY CONCEPTS
          </p>
          <div
            className="rounded-md p-4"
            style={{ backgroundColor: "#fffbeb", borderLeft: "3px solid #d97706" }}
          >
            <BulletedText text={conceptAsset.concept_notes} />
          </div>
        </div>
      )}

      {formulaText && (
        <div>
          <p className="uppercase font-bold tracking-wider mb-2" style={{ fontSize: 10, color: "#14213D" }}>
            IMPORTANT FORMULAS
          </p>
          <div
            className="rounded-md p-4"
            style={{ backgroundColor: "#f1f5f9", borderLeft: "3px solid #14213D" }}
          >
            <BulletedText text={formulaText} />
          </div>
        </div>
      )}
    </div>
  );
}

function TrapsTab({ assets }: { assets: AssetInfo[] }) {
  // Gather all trap strings across assets
  const allTraps: string[] = [];
  for (const a of assets) {
    if (!a.exam_traps) continue;
    if (typeof a.exam_traps === "string") {
      // Split long text into individual traps
      a.exam_traps
        .split(/\n|(?<=\.)\s+(?=[A-Z])/)
        .map((s: string) => s.replace(/^[•\-–—]\s*/, "").trim())
        .filter((s: string) => s.length > 0)
        .forEach((t: string) => allTraps.push(t));
    } else if (Array.isArray(a.exam_traps)) {
      for (const t of a.exam_traps) {
        if (typeof t === "string" && t.trim()) allTraps.push(t.trim());
      }
    }
  }

  return (
    <div className="space-y-3">
      <p className="uppercase font-bold tracking-wider mb-2" style={{ fontSize: 10, color: "#dc2626" }}>
        ⚠ EXAM TRAPS
      </p>
      {allTraps.length > 0 ? (
        <div
          className="rounded-md p-4"
          style={{ backgroundColor: "#fef2f2", borderLeft: "3px solid #dc2626" }}
        >
          <ul className="space-y-3">
            {allTraps.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed">
                <span className="shrink-0 mt-0.5" style={{ color: "#dc2626" }}>⚠</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-center py-4" style={{ color: "#94a3b8" }}>
          No exam traps available.
        </p>
      )}
    </div>
  );
}

function ExampleTab({ assets }: { assets: AssetInfo[] }) {
  const sorted = [...assets].sort(sortBySourceRef).slice(0, 2);

  return (
    <div className="space-y-3">
      {sorted.map((a) => (
        <div key={a.id} className="rounded-lg border border-slate-200 p-4 space-y-2">
          <p className="text-sm font-medium text-slate-700">
            {a.source_ref} — {a.problem_title}
          </p>
          <a
            href={`https://learn.surviveaccounting.com/solutions/${a.asset_name}?ref=lw`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-medium"
            style={{ color: "#2563eb" }}
          >
            View Full Solution →
          </a>
        </div>
      ))}
    </div>
  );
}
