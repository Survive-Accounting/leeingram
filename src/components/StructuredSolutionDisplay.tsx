import { useEffect, useMemo, useRef, useState, createContext, useContext } from "react";
import { ChevronRight, Sparkles, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { JETooltip } from "@/components/JETooltip";

// ─── Tooltip lookup built from canonical journal_entry_completed_json ───
type TooltipEntry = { reason?: string; amountSource?: string };
type TooltipLookup = Map<string, TooltipEntry>;

const JETooltipContext = createContext<TooltipLookup | null>(null);

function normalizeAccount(name: string): string {
  return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function buildTooltipLookup(source: any): TooltipLookup {
  const map: TooltipLookup = new Map();
  if (!source) return map;
  let payload: any = source;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { return map; }
  }
  const sections = payload?.scenario_sections;
  if (!Array.isArray(sections)) return map;
  for (const sc of sections) {
    for (const e of sc.entries_by_date ?? []) {
      for (const row of e.rows ?? []) {
        const key = normalizeAccount(row.account_name);
        if (!key) continue;
        const reason = row.debit_credit_reason || undefined;
        const amountSource = row.amount_source || undefined;
        if (!reason && !amountSource) continue;
        const existing = map.get(key);
        if (!existing) {
          map.set(key, { reason, amountSource });
        } else {
          map.set(key, {
            reason: existing.reason || reason,
            amountSource: existing.amountSource || amountSource,
          });
        }
      }
    }
  }
  return map;
}

// ─── Types ────────────────────────────────────────────────────────────
type JELine = {
  account: string;
  debit: number | null;
  credit: number | null;
};

type JournalEntry = {
  label?: string | null;
  lines: JELine[];
};

export type StructuredSolutionPart = {
  label: string;
  instruction: string;
  answer_type: "number" | "calculation" | "statement" | "journal_entry" | "list" | string;
  answer: string | null;
  steps: string;
  journal_entry?: JournalEntry | null;
  journal_entries?: JournalEntry[] | null;
};

export type StructuredSolutionJson = {
  parts: StructuredSolutionPart[];
};

interface Props {
  asset: {
    id: string;
    asset_name?: string | null;
    survive_solution_json: StructuredSolutionJson | null;
    survive_solution_explanation_cache?: Record<string, string> | null;
  };
  /** Canonical journal_entry_completed_json — used to source tooltip text per account. */
  jeTooltipSource?: any;
  onSuggestFix?: () => void;
  onLearnMore?: () => void;
}

// ─── Lightweight inline renderers (mirror AnswerSummarySection rules) ───
// Intentionally kept minimal — must NOT modify AnswerSummarySection.
function renderBoldMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    }
    return <span key={i}>{p}</span>;
  });
}

function isCalculationLine(line: string): boolean {
  if (!line) return false;
  if (/^[─━—-]{3,}$/.test(line)) return true;
  return /[$=×÷+−\-]/.test(line) && /\d/.test(line);
}

function StepsRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div>
      {lines.map((raw, idx) => {
        const trimmed = raw.trim();
        if (!trimmed) return <div key={idx} className="h-3" />;
        const isStepLabel = /^step\s+\d+/i.test(trimmed);
        const isYearLabel = /^\d{4}\s*:/.test(trimmed);
        const isCalc = !isStepLabel && isCalculationLine(trimmed);

        if (isStepLabel) {
          return (
            <p
              key={idx}
              className="break-words"
              style={{
                fontSize: 14,
                color: "#1A1A1A",
                marginTop: 12,
                marginBottom: 4,
                lineHeight: 1.6,
                fontWeight: 600,
              }}
            >
              {renderBoldMarkdown(trimmed)}
            </p>
          );
        }

        if (isCalc) {
          return (
            <p
              key={idx}
              className="font-mono break-words"
              style={{
                fontSize: 14,
                color: "rgba(0,0,0,0.87)",
                paddingLeft: 8,
                borderLeft: "2px solid #CE1126",
                background: "rgba(206,17,38,0.05)",
                borderRadius: 2,
                marginBottom: 4,
                lineHeight: 1.7,
                fontWeight: 500,
                whiteSpace: "pre",
              }}
            >
              {renderBoldMarkdown(trimmed)}
            </p>
          );
        }

        if (isYearLabel) {
          return (
            <p
              key={idx}
              className="font-bold break-words"
              style={{
                fontSize: 14,
                color: "#14213D",
                marginTop: 12,
                marginBottom: 4,
              }}
            >
              {renderBoldMarkdown(trimmed)}
            </p>
          );
        }

        return (
          <p
            key={idx}
            className="break-words"
            style={{
              fontSize: 14,
              color: "rgba(0,0,0,0.78)",
              marginBottom: 6,
              lineHeight: 1.7,
            }}
          >
            {renderBoldMarkdown(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

// ─── Typewriter (line-by-line, ~25 chars/sec, skip on click) ──────────
function useTypewriter(fullText: string, storageKey: string) {
  const alreadyShown =
    typeof window !== "undefined" && sessionStorage.getItem(storageKey) === "1";
  const [shownChars, setShownChars] = useState<number>(alreadyShown ? fullText.length : 0);
  const skipRef = useRef(false);

  useEffect(() => {
    if (alreadyShown || !fullText) return;
    const total = fullText.length;
    const startedAt = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      if (skipRef.current) {
        setShownChars(total);
        sessionStorage.setItem(storageKey, "1");
        return;
      }
      const elapsed = (now - startedAt) / 1000;
      const next = Math.min(total, Math.floor(elapsed * 25));
      setShownChars(next);
      if (next < total) raf = requestAnimationFrame(tick);
      else sessionStorage.setItem(storageKey, "1");
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullText, storageKey]);

  const skip = () => {
    skipRef.current = true;
    setShownChars(fullText.length);
    sessionStorage.setItem(storageKey, "1");
  };

  return { visible: fullText.slice(0, shownChars), done: shownChars >= fullText.length, skip };
}

// ─── JE Table ─────────────────────────────────────────────────────────
function fmtAmount(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  const num = Number(n);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function JETable({ je }: { je: JournalEntry }) {
  return (
    <div className="rounded-md overflow-hidden border" style={{ borderColor: "#E5E7EB" }}>
      <div
        className="grid grid-cols-[1fr_120px_120px] text-xs font-semibold uppercase tracking-wide"
        style={{ background: "#14213D", color: "#fff", padding: "8px 12px" }}
      >
        <div>Account</div>
        <div className="text-right">Debit</div>
        <div className="text-right">Credit</div>
      </div>
      {je.lines.map((line, i) => {
        const isCredit = line.credit != null && (line.debit == null || line.debit === 0);
        return (
          <div
            key={i}
            className="grid grid-cols-[1fr_120px_120px] text-sm"
            style={{
              padding: "8px 12px",
              borderTop: i === 0 ? "none" : "1px solid #F3F4F6",
              background: "#fff",
            }}
          >
            <div
              style={{
                color: "#14213D",
                paddingLeft: isCredit ? 20 : 0,
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              {line.account}
            </div>
            <div className="text-right font-mono" style={{ color: "rgba(0,0,0,0.85)" }}>
              {fmtAmount(line.debit)}
            </div>
            <div className="text-right font-mono" style={{ color: "rgba(0,0,0,0.85)" }}>
              {fmtAmount(line.credit)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Part Card ────────────────────────────────────────────────────────
function PartCard({
  part,
  assetId,
  cachedExplanation,
}: {
  part: StructuredSolutionPart;
  assetId: string;
  cachedExplanation: string | null;
}) {
  const [stepsOpen, setStepsOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(cachedExplanation);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const isJE = part.answer_type === "journal_entry";
  const isList = part.answer_type === "list";
  const showsAnswerBlock =
    !isJE && !isList && part.answer != null && String(part.answer).trim() !== "";
  const needsReview =
    typeof part.answer === "string" && part.answer.includes("[NEEDS REVIEW");

  const stepsKey = `sa_animated_${assetId}_${part.label}_steps`;
  const explainKey = `sa_animated_${assetId}_${part.label}_explain`;
  const stepsTw = useTypewriter(stepsOpen ? part.steps ?? "" : "", stepsKey);
  const explainTw = useTypewriter(explainOpen ? explanation ?? "" : "", explainKey);

  const fetchExplanation = async () => {
    if (explanation) {
      setExplainOpen(true);
      return;
    }
    setExplainOpen(true);
    setExplainLoading(true);
    setExplainError(null);
    try {
      const { data, error } = await supabase.functions.invoke("explain-solution-part", {
        body: {
          asset_id: assetId,
          part_label: part.label,
        },
      });
      if (error) throw new Error(error.message ?? "Request failed");
      const text = (data as any)?.explanation ?? (data as any)?.text ?? "";
      if (!text) throw new Error("No explanation returned");
      setExplanation(String(text));
    } catch (err: any) {
      setExplainError(err?.message ?? "Failed to load explanation");
    } finally {
      setExplainLoading(false);
    }
  };

  const journalEntries: JournalEntry[] = useMemo(() => {
    if (Array.isArray(part.journal_entries) && part.journal_entries.length) {
      return part.journal_entries;
    }
    if (part.journal_entry) return [part.journal_entry];
    return [];
  }, [part]);

  const showAnswerSection = showsAnswerBlock || (isJE && journalEntries.length > 0);

  return (
    <div
      className="overflow-hidden mb-4"
      style={{
        borderLeft: "3px solid #14213D",
        borderRadius: 8,
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderLeftWidth: 3,
        borderLeftColor: "#14213D",
      }}
    >
      {/* Part header */}
      <div
        className="flex items-center gap-3"
        style={{
          background: "#F8F9FA",
          padding: "12px 16px",
          borderBottom: "1px solid #E5E7EB",
        }}
      >
        <span
          style={{
            background: "#14213D",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "Inter, system-ui, sans-serif",
            padding: "2px 8px",
            borderRadius: 4,
            lineHeight: 1.4,
          }}
        >
          ({part.label})
        </span>
        {part.instruction && (
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "#14213D",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            {part.instruction}
          </span>
        )}
      </div>

      {/* Answer section */}
      {showAnswerSection && (
        <div style={{ padding: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            {isJE ? "Journal Entry" : "Answer"}
          </div>

          {!isJE && showsAnswerBlock && (
            needsReview ? (
              <div
                style={{
                  background: "#FEF3C7",
                  color: "#92400E",
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {part.answer}
              </div>
            ) : (
              <div
                style={{
                  fontFamily: '"DM Serif Display", Georgia, serif',
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#14213D",
                  lineHeight: 1.2,
                }}
              >
                {part.answer}
              </div>
            )
          )}

          {isJE && journalEntries.length > 0 && (
            <div className="space-y-3">
              {journalEntries.map((je, i) => (
                <div key={i}>
                  {je.label && (
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#14213D",
                        marginBottom: 6,
                        fontFamily: "Inter, system-ui, sans-serif",
                      }}
                    >
                      {je.label}
                    </div>
                  )}
                  <JETable je={je} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Steps collapsible */}
      {part.steps && String(part.steps).trim() !== "" && (
        <>
          <button
            type="button"
            onClick={() => setStepsOpen((v) => !v)}
            className="w-full flex items-center gap-2 text-left transition-colors"
            style={{
              padding: "8px 16px",
              borderTop: "1px solid #F3F4F6",
              background: "#fff",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              color: "#6B7280",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F8F9FA")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
          >
            <ChevronRight
              size={14}
              style={{
                transform: stepsOpen ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.15s ease",
              }}
            />
            <span>{isJE ? "Why this entry?" : "How did we get this?"}</span>
          </button>
          {stepsOpen && (
            <div
              style={{
                padding: 16,
                borderTop: "1px solid #F3F4F6",
                cursor: "pointer",
              }}
              onClick={stepsTw.skip}
            >
              <StepsRenderer text={stepsTw.visible} />
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
          type="button"
          onClick={fetchExplanation}
          className="inline-flex items-center gap-1 hover:underline"
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            color: "#CE1126",
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "Inter, system-ui, sans-serif",
            cursor: "pointer",
          }}
        >
          <Sparkles size={14} />
          Explain the concept →
        </button>
      </div>

      {explainOpen && (
        <div
          style={{
            background: "#FFF8F0",
            borderLeft: "3px solid #CE1126",
            padding: 16,
            borderRadius: "0 0 8px 8px",
            position: "relative",
          }}
        >
          <button
            type="button"
            onClick={() => setExplainOpen(false)}
            aria-label="Close explanation"
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#6B7280",
              padding: 4,
            }}
          >
            <X size={16} />
          </button>
          {explainLoading && !explanation && (
            <div className="flex items-center gap-2" style={{ color: "#CE1126", fontSize: 14 }}>
              <Loader2 size={14} className="animate-spin" />
              <span>✨ Generating explanation...</span>
            </div>
          )}
          {explainError && !explanation && (
            <div style={{ color: "#92400E", fontSize: 13 }}>{explainError}</div>
          )}
          {explanation && (
            <div
              onClick={explainTw.skip}
              style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 14,
                color: "#14213D",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                cursor: "pointer",
                paddingRight: 24,
              }}
            >
              {explainTw.visible}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────
export default function StructuredSolutionDisplay({ asset, jeTooltipSource, onSuggestFix, onLearnMore }: Props) {
  const tooltipLookup = useMemo(() => buildTooltipLookup(jeTooltipSource), [jeTooltipSource]);

  if (!asset?.survive_solution_json || !Array.isArray(asset.survive_solution_json.parts)) {
    return null;
  }

  const cache = asset.survive_solution_explanation_cache ?? null;

  return (
    <JETooltipContext.Provider value={tooltipLookup}>
    <div>
      {asset.survive_solution_json.parts.map((part, i) => (
        <PartCard
          key={`${part.label}-${i}`}
          part={part}
          assetId={asset.id}
          cachedExplanation={cache?.[part.label] ?? null}
        />
      ))}

      {/* AI disclosure */}
      <div
        className="text-center mt-3"
        style={{
          fontSize: 12,
          color: "#6B7280",
          fontFamily: "Inter, system-ui, sans-serif",
          lineHeight: 1.6,
        }}
      >
        ✨ AI-assisted · reviewed for accuracy by Survive Accounting{" "}
        <button
          type="button"
          onClick={onLearnMore}
          className="hover:underline"
          style={{
            background: "transparent",
            border: "none",
            color: "#14213D",
            cursor: "pointer",
            padding: 0,
            fontSize: 12,
          }}
        >
          [Learn more →]
        </button>{" "}
        <button
          type="button"
          onClick={onSuggestFix}
          className="hover:underline"
          style={{
            background: "transparent",
            border: "none",
            color: "#CE1126",
            cursor: "pointer",
            padding: 0,
            fontSize: 12,
          }}
        >
          [Suggest a fix →]
        </button>
      </div>
    </div>
    </JETooltipContext.Provider>
  );
}
