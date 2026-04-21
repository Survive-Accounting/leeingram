import { useEffect, useRef, useState } from "react";
import { ChevronRight, X, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ── Types ───────────────────────────────────────────────────────────
interface JELine {
  account: string;
  debit: number | null;
  credit: number | null;
}

interface JournalEntry {
  label: string;
  lines: JELine[];
}

interface SolutionPart {
  label: string;
  instruction: string;
  answer_type: string;
  answer: string | null;
  steps: string;
  journal_entry?: JournalEntry | null;
  journal_entries?: JournalEntry[] | null;
}

interface StructuredSolutionJson {
  parts: SolutionPart[];
}

interface AssetLike {
  id: string;
  survive_solution_json?: StructuredSolutionJson | null;
  survive_solution_explanation_cache?: Record<string, string> | null;
  chapters?: { chapter_number?: number; chapter_name?: string } | null;
  _topic_name?: string;
}

interface Props {
  asset: AssetLike;
}

// ── Typewriter hook ─────────────────────────────────────────────────
function useTypewriter(fullText: string, sessionKey: string) {
  const [displayed, setDisplayed] = useState("");
  const skipRef = useRef(false);

  useEffect(() => {
    if (!fullText) {
      setDisplayed("");
      return;
    }
    const alreadyAnimated =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(sessionKey) === "1";
    if (alreadyAnimated) {
      setDisplayed(fullText);
      return;
    }

    skipRef.current = false;
    setDisplayed("");
    let i = 0;
    const charsPerTick = 5; // ~25 chars/sec at 50ms intervals would be 1.25 — bump up
    const intervalMs = 40;
    const id = window.setInterval(() => {
      if (skipRef.current) {
        setDisplayed(fullText);
        window.clearInterval(id);
        window.sessionStorage.setItem(sessionKey, "1");
        return;
      }
      i += charsPerTick;
      if (i >= fullText.length) {
        setDisplayed(fullText);
        window.clearInterval(id);
        window.sessionStorage.setItem(sessionKey, "1");
      } else {
        setDisplayed(fullText.slice(0, i));
      }
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [fullText, sessionKey]);

  const skip = () => {
    skipRef.current = true;
  };

  return { displayed, skip };
}

// ── Lightweight steps renderer ──────────────────────────────────────
function renderBoldMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} style={{ color: "#14213D", fontWeight: 600 }}>
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function StepsRenderer({ text }: { text: string }) {
  // Group consecutive indented/calculation lines into monospace blocks
  const lines = text.split("\n");
  const blocks: { type: "calc" | "text"; lines: string[] }[] = [];
  for (const line of lines) {
    const isCalc =
      /^\s{2,}/.test(line) ||
      /^[\s─━=]+$/.test(line) ||
      /^\s*[─━]/.test(line);
    const last = blocks[blocks.length - 1];
    if (isCalc) {
      if (last && last.type === "calc") last.lines.push(line);
      else blocks.push({ type: "calc", lines: [line] });
    } else {
      if (last && last.type === "text") last.lines.push(line);
      else blocks.push({ type: "text", lines: [line] });
    }
  }

  return (
    <div style={{ fontSize: 14, lineHeight: 1.7, color: "#14213D" }}>
      {blocks.map((b, idx) => {
        if (b.type === "calc") {
          return (
            <pre
              key={idx}
              style={{
                background: "#F8F9FA",
                border: "1px solid #E5E7EB",
                borderRadius: 6,
                padding: "10px 14px",
                margin: "10px 0",
                fontFamily:
                  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                fontSize: 13,
                color: "#14213D",
                whiteSpace: "pre",
                overflowX: "auto",
              }}
            >
              {b.lines.join("\n")}
            </pre>
          );
        }
        return (
          <div key={idx} style={{ whiteSpace: "pre-wrap" }}>
            {b.lines.map((l, i) => (
              <div key={i}>{renderBoldMarkdown(l)}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── JE Table ────────────────────────────────────────────────────────
function fmtAmt(n: number | null) {
  if (n === null || n === undefined) return "";
  return n.toLocaleString("en-US", { minimumFractionDigits: 0 });
}

function JETable({ je }: { je: JournalEntry }) {
  return (
    <div style={{ marginTop: 8 }}>
      {je.label && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#14213D",
            marginBottom: 6,
          }}
        >
          {je.label}
        </div>
      )}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          border: "1px solid #E5E7EB",
          borderRadius: 6,
          overflow: "hidden",
          fontSize: 13,
        }}
      >
        <thead>
          <tr style={{ background: "#14213D", color: "white" }}>
            <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600 }}>
              Account
            </th>
            <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 600, width: 120 }}>
              Debit
            </th>
            <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 600, width: 120 }}>
              Credit
            </th>
          </tr>
        </thead>
        <tbody>
          {je.lines.map((ln, i) => {
            const isCredit = ln.credit !== null && ln.credit !== undefined;
            return (
              <tr key={i} style={{ borderTop: "1px solid #F3F4F6" }}>
                <td
                  style={{
                    padding: "8px 12px",
                    paddingLeft: isCredit ? 32 : 12,
                    color: "#14213D",
                  }}
                >
                  {ln.account}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {fmtAmt(ln.debit)}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {fmtAmt(ln.credit)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Single Part Card ────────────────────────────────────────────────
function PartCard({
  part,
  assetId,
  cachedExplanation,
  chapterName,
  topicName,
  onCacheUpdate,
}: {
  part: SolutionPart;
  assetId: string;
  cachedExplanation: string | null;
  chapterName: string;
  topicName: string;
  onCacheUpdate: (label: string, text: string) => void;
}) {
  const [stepsOpen, setStepsOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [explanation, setExplanation] = useState<string>(cachedExplanation ?? "");
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const stepsKey = `sa_animated_${assetId}_${part.label}_steps`;
  const explainKey = `sa_animated_${assetId}_${part.label}_explain`;

  const stepsTw = useTypewriter(stepsOpen ? part.steps : "", stepsKey);
  const explainTw = useTypewriter(explainOpen ? explanation : "", explainKey);

  const isJE = part.answer_type === "journal_entry";
  const isList = part.answer_type === "list";
  const needsReview = part.answer && /\[NEEDS REVIEW/i.test(part.answer);

  const handleExplain = async () => {
    if (explainOpen) {
      setExplainOpen(false);
      return;
    }
    setExplainOpen(true);
    if (explanation) return; // already cached locally

    setLoadingExplain(true);
    setExplainError(null);
    try {
      // Notify viewer for header pill
      window.dispatchEvent(
        new CustomEvent("sa-explain-loading", { detail: { loading: true } }),
      );
      const { data, error } = await supabase.functions.invoke(
        "explain-solution-part",
        {
          body: {
            asset_id: assetId,
            part_label: part.label,
            part_instruction: part.instruction,
            part_answer: part.answer,
            part_steps: part.steps,
            chapter_name: chapterName,
            topic_name: topicName,
          },
        },
      );
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Failed to explain");
      const text = data.explanation as string;
      setExplanation(text);
      onCacheUpdate(part.label, text);
    } catch (e: any) {
      setExplainError(e?.message ?? "Failed to generate explanation");
    } finally {
      setLoadingExplain(false);
      window.dispatchEvent(
        new CustomEvent("sa-explain-loading", { detail: { loading: false } }),
      );
    }
  };

  return (
    <div
      style={{
        borderLeft: "3px solid #14213D",
        border: "1px solid #E5E7EB",
        borderLeftWidth: 3,
        borderRadius: 8,
        background: "white",
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#F8F9FA",
          padding: "12px 16px",
          borderBottom: "1px solid #E5E7EB",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          style={{
            background: "#14213D",
            color: "white",
            fontSize: 12,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 4,
          }}
        >
          ({part.label})
        </span>
        <span style={{ fontSize: 14, fontWeight: 500, color: "#14213D" }}>
          {part.instruction}
        </span>
      </div>

      {/* Answer */}
      {!isList && (part.answer || isJE) && (
        <div style={{ padding: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 6,
            }}
          >
            {isJE ? "Journal Entry" : "Answer"}
          </div>

          {isJE ? (
            <>
              {part.journal_entries && part.journal_entries.length > 0 ? (
                part.journal_entries.map((je, i) => <JETable key={i} je={je} />)
              ) : part.journal_entry ? (
                <JETable je={part.journal_entry} />
              ) : null}
            </>
          ) : needsReview ? (
            <div
              style={{
                background: "#FEF3C7",
                color: "#92400E",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 14,
              }}
            >
              {part.answer}
            </div>
          ) : (
            <div
              style={{
                fontSize: 28,
                fontFamily: '"DM Serif Display", Georgia, serif',
                color: "#14213D",
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              {part.answer}
            </div>
          )}
        </div>
      )}

      {/* Steps */}
      {part.steps && (
        <>
          <button
            onClick={() => setStepsOpen((o) => !o)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderTop: "1px solid #F3F4F6",
              background: "white",
              cursor: "pointer",
              border: "none",
              textAlign: "left",
              fontSize: 13,
              fontWeight: 500,
              color: "#6B7280",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F8F9FA")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
          >
            <ChevronRight
              style={{
                width: 14,
                height: 14,
                transform: stepsOpen ? "rotate(90deg)" : "rotate(0)",
                transition: "transform 0.15s",
              }}
            />
            {isJE ? "Why this entry?" : "How did we get this?"}
          </button>
          {stepsOpen && (
            <div
              onClick={stepsTw.skip}
              style={{
                padding: 16,
                borderTop: "1px solid #F3F4F6",
                cursor: "pointer",
              }}
            >
              <StepsRenderer text={stepsTw.displayed} />
            </div>
          )}
        </>
      )}

      {/* Explain the concept */}
      <div
        style={{
          padding: "8px 16px",
          borderTop: "1px solid #F3F4F6",
        }}
      >
        <button
          onClick={handleExplain}
          disabled={loadingExplain}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: loadingExplain ? "wait" : "pointer",
            color: "#CE1126",
            fontSize: 13,
            fontWeight: 500,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.textDecoration = "underline")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.textDecoration = "none")
          }
        >
          {loadingExplain ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Generating explanation...
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              {explainOpen ? "Hide explanation" : "Explain the concept →"}
            </>
          )}
        </button>
      </div>

      {explainOpen && (explanation || explainError) && (
        <div
          style={{
            background: "#FFF8F0",
            borderLeft: "3px solid #CE1126",
            padding: 16,
            borderRadius: "0 0 8px 8px",
            position: "relative",
          }}
          onClick={explainTw.skip}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExplainOpen(false);
            }}
            aria-label="Close explanation"
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#92400E",
            }}
          >
            <X className="h-4 w-4" />
          </button>
          {explainError ? (
            <div style={{ color: "#92400E", fontSize: 13 }}>{explainError}</div>
          ) : (
            <div
              style={{
                fontSize: 14,
                color: "#14213D",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                paddingRight: 24,
              }}
            >
              {explainTw.displayed}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────
export function StructuredSolutionDisplay({ asset }: Props) {
  const parts = asset?.survive_solution_json?.parts;
  const [cache, setCache] = useState<Record<string, string>>(
    asset?.survive_solution_explanation_cache ?? {},
  );

  if (!parts || parts.length === 0) return null;

  const chapterName = asset.chapters?.chapter_name ?? "";
  const topicName = asset._topic_name ?? "";

  return (
    <div>
      {parts.map((part, idx) => (
        <PartCard
          key={`${part.label}-${idx}`}
          part={part}
          assetId={asset.id}
          cachedExplanation={cache[part.label] ?? null}
          chapterName={chapterName}
          topicName={topicName}
          onCacheUpdate={(label, text) =>
            setCache((c) => ({ ...c, [label]: text }))
          }
        />
      ))}
      <div
        style={{
          textAlign: "center",
          fontSize: 12,
          color: "#6B7280",
          marginTop: 16,
          paddingTop: 12,
          borderTop: "1px solid #F3F4F6",
        }}
      >
        ✨ AI-assisted · reviewed for accuracy by Survive Accounting
      </div>
    </div>
  );
}

export default StructuredSolutionDisplay;
