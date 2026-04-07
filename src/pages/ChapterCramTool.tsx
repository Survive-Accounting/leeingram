import { useCallback, useEffect, useMemo, useState } from "react";
import { isAllowedEmail } from "@/lib/emailWhitelist";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollUrl } from "@/hooks/useEnrollUrl";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Eye, EyeOff, ExternalLink, Calendar, Lock, Share2, Shuffle, X, AlertTriangle, Info } from "lucide-react";
import { JETooltip } from "@/components/JETooltip";
import { isCanonicalJE, type CanonicalJEPayload } from "@/lib/journalEntryParser";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboardFallback";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const LOGO_URL = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf121ac35937c4d438ca.png";
const PREVIEW_LIMIT = 3;
const SOLUTIONS_INITIAL_SHOW = 4;
const LEE_HERO_URL = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/f10e00cd3462ea2638b6e6161236a92b.png";
const STUDENT_BASE_URL = "https://learn.surviveaccounting.com";

const theme = {
  pageBg: "#FFFFFF",
  cardBg: "#FFFFFF",
  mutedBg: "#F8FAFC",
  text: "#0F172A",
  textMuted: "#64748B",
  label: "#94A3B8",
  heading: "#14213D",
  border: "#E2E8F0",
  navy: "#14213D",
  navySoft: "#EFF6FF",
  successBg: "#F0FDF4",
  successBorder: "#BBF7D0",
  successText: "#166534",
  warningBg: "#FEF2F2",
  warningText: "#DC2626",
  amberBg: "#FFFBEB",
  amberBorder: "#FDE68A",
  amberText: "#92400E",
};

type SupplementaryRow = {
  account_name: string;
  side: "debit" | "credit";
  debit_credit_reason?: string;
  amount_source?: string;
};

type SupplementaryEntry = {
  label: string;
  rows: SupplementaryRow[];
};

type CompletedRow = {
  account_name: string;
  debit: number | null;
  credit: number | null;
  debit_credit_reason?: string;
  amount_source?: string;
};

type CramCard = {
  id: string;
  assetName: string;
  sourceRef: string;
  label: string;
  rows: SupplementaryRow[];
  completedRows: CompletedRow[] | null;
};

type FormulaCard = {
  id: string;
  name: string;
  expression: string;
  explanation?: string;
  image_url?: string | null;
};

type SectionConfigRow = {
  id: string;
  chapter_id: string;
  section_name: string;
  is_visible: boolean;
  hidden_item_ids: string[] | null;
  updated_at: string;
};

function parseSourceRef(ref: string): { prefix: string; num: number; sub: number } {
  const match = ref.match(/^([A-Z]+)(\d+)(?:\.(\d+))?/i);
  if (!match) return { prefix: "ZZ", num: 9999, sub: 0 };
  return {
    prefix: match[1].toUpperCase(),
    num: Number.parseInt(match[2], 10),
    sub: match[3] ? Number.parseInt(match[3], 10) : 0,
  };
}

const PREFIX_ORDER: Record<string, number> = { BE: 0, QS: 1, E: 2, EX: 2, P: 3 };

function sortBySourceRef(a: { source_ref?: string | null }, b: { source_ref?: string | null }) {
  const left = parseSourceRef(a.source_ref || "");
  const right = parseSourceRef(b.source_ref || "");
  const leftOrder = PREFIX_ORDER[left.prefix] ?? 99;
  const rightOrder = PREFIX_ORDER[right.prefix] ?? 99;

  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  if (left.num !== right.num) return left.num - right.num;
  return left.sub - right.sub;
}

function matchCompletedEntry(suppEntry: SupplementaryEntry, completedJson: unknown): CompletedRow[] | null {
  if (!completedJson) return null;

  try {
    const parsed: CanonicalJEPayload = typeof completedJson === "string" ? JSON.parse(completedJson) : (completedJson as CanonicalJEPayload);
    if (!isCanonicalJE(parsed)) return null;

    const suppAccounts = new Set(suppEntry.rows.map((row) => row.account_name.toLowerCase().trim()));
    let bestMatch: CompletedRow[] | null = null;
    let bestScore = 0;

    for (const section of parsed.scenario_sections) {
      for (const entry of section.entries_by_date) {
        const entryRows = (entry.rows || []) as CompletedRow[];
        const entryAccounts = new Set(entryRows.map((row) => (row.account_name || "").toLowerCase().trim()));
        let overlap = 0;

        for (const account of suppAccounts) {
          if (entryAccounts.has(account)) overlap += 1;
        }

        if (overlap > bestScore) {
          bestScore = overlap;
          bestMatch = entryRows;
        }
      }
    }

    return bestScore > 0 ? bestMatch : null;
  } catch {
    return null;
  }
}

function parseImportantFormulas(raw: unknown): FormulaCard[] {
  const formulas: FormulaCard[] = [];

  const visit = (value: unknown) => {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return;

      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && parsed !== value && (Array.isArray(parsed) || typeof parsed === "object")) {
          visit(parsed);
          return;
        }
      } catch {
        // Fall through to plain text parsing.
      }

      trimmed
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => {
          const parts = line.split(/\s+[—–-]\s+/);
          const formulaPart = parts[0]?.trim() || "";
          const explanation = parts.slice(1).join(" — ").trim() || undefined;
          const eqIndex = formulaPart.indexOf("=");

          if (eqIndex > 0) {
            const name = formulaPart.slice(0, eqIndex).trim();
            formulas.push({
              id: crypto.randomUUID(),
              name: name || formulaPart,
              expression: formulaPart,
              explanation,
            });
            return;
          }

          formulas.push({
            id: crypto.randomUUID(),
            name: formulaPart,
            expression: formulaPart,
            explanation,
          });
        });
      return;
    }

    if (typeof value === "object") {
      const record = value as Record<string, unknown>;

      if (record.formulas) {
        visit(record.formulas);
        return;
      }

      const name = record.name ?? record.formula_name ?? record.title;
      const expression = record.expression ?? record.formula_expression ?? record.formula ?? record.value;
      const explanation = record.explanation ?? record.description ?? record.note;

      if (typeof name === "string" && typeof expression === "string") {
        formulas.push({
          id: crypto.randomUUID(),
          name: name.trim(),
          expression: expression.trim(),
          explanation: typeof explanation === "string" ? explanation.trim() : undefined,
        });
        return;
      }

      Object.values(record).forEach(visit);
    }
  };

  visit(raw);
  return formulas.filter((formula) => formula.name.trim() && formula.expression.trim());
}

function slugify(text: string) {
  return text.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function SectionHeaderWithToggle({
  label,
  count,
  isAdmin,
  sectionName,
  isVisible,
  onToggle,
}: {
  label: string;
  count?: number;
  isAdmin: boolean;
  sectionName: string;
  isVisible: boolean;
  onToggle: (sectionName: string) => Promise<void> | void;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: theme.label }}>
          {label}
        </p>
        {typeof count === "number" && count > 0 && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
            style={{ background: "#F1F5F9", color: theme.textMuted }}
          >
            {count}
          </span>
        )}
        {isAdmin && !isVisible && (
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
            style={{ background: theme.warningBg, color: theme.warningText }}
          >
            Hidden from students
          </span>
        )}
      </div>

      {isAdmin && (
        <button
          type="button"
          onClick={() => onToggle(sectionName)}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-opacity hover:opacity-80"
          style={{ background: "transparent", border: `1px solid ${theme.border}`, color: isVisible ? theme.textMuted : theme.warningText }}
          title={isVisible ? "Hide from students" : "Show to students"}
        >
          {isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}

function CramChapterJEAccordion({ categories, entries }: { categories: { id: string; category_name: string; sort_order: number }[]; entries: { id: string; category_id: string | null; transaction_label: string; je_lines: any; sort_order: number }[] }) {
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [openEntry, setOpenEntry] = useState<string | null>(null);

  const grouped = categories.map(cat => ({
    ...cat,
    entries: entries.filter(e => e.category_id === cat.id).sort((a, b) => a.sort_order - b.sort_order),
  })).filter(cat => cat.entries.length > 0);

  return (
    <div className="space-y-1">
      {grouped.map(cat => {
        const catOpen = openCat === cat.id;
        return (
          <div key={cat.id}>
            <button
              onClick={() => setOpenCat(catOpen ? null : cat.id)}
              className="w-full flex items-center justify-between px-2 py-2 rounded-md text-left transition-colors text-[13px] font-semibold"
              style={{ color: theme.text, background: catOpen ? theme.mutedBg : "transparent" }}
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
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors text-[12px] font-medium"
                        style={{ color: theme.text, background: entryOpen ? theme.mutedBg : "transparent" }}
                      >
                        <span>{entry.transaction_label}</span>
                        <span className="text-[10px] shrink-0 ml-2" style={{ color: theme.textMuted }}>{entryOpen ? "▲" : "▼"}</span>
                      </button>
                      {entryOpen && (
                        <div className="overflow-x-auto rounded-md mt-1 mb-2 mx-1" style={{ border: `1px solid ${theme.border}` }}>
                          <table className="w-full text-sm">
                            <thead>
                              <tr style={{ background: theme.navy }}>
                                <th className="text-left px-3 py-1.5 text-white font-bold text-[11px]">Account</th>
                                <th className="text-right px-3 py-1.5 text-white font-bold text-[11px] w-20">Debit</th>
                                <th className="text-right px-3 py-1.5 text-white font-bold text-[11px] w-20">Credit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lines.map((line, ri) => {
                                const isCredit = line.side === "credit";
                                return (
                                  <tr key={ri} style={{ background: ri % 2 === 0 ? theme.cardBg : theme.mutedBg }}>
                                    <td className={`px-3 py-1.5 text-[12px] ${isCredit ? "pl-8" : ""}`} style={{ color: theme.text }}>
                                      {line.account}
                                      {line.account_tooltip && <JETooltip text={line.account_tooltip} variant="solutions" />}
                                    </td>
                                    <td className="text-right px-3 py-1.5 text-[12px] font-mono" style={{ color: theme.textMuted }}>
                                      {!isCredit ? "???" : ""}
                                    </td>
                                    <td className="text-right px-3 py-1.5 text-[12px] font-mono" style={{ color: theme.textMuted }}>
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

function TieredPaywallCard({
  enrollUrl,
  chapterNumber,
  fullPassLink,
  chapterLink,
}: {
  enrollUrl: string;
  chapterNumber: number | null;
  fullPassLink?: any;
  chapterLink?: any;
}) {
  const now = new Date();
  const saleActive = fullPassLink?.sale_expires_at ? now < new Date(fullPassLink.sale_expires_at) : false;
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;
  const fullPassUrl = fullPassLink?.url || enrollUrl;
  const singleChapterUrl = chapterLink?.url || enrollUrl;

  return (
    <div className="rounded-xl p-5" style={{ background: "#FFFBF0", border: `1px solid ${theme.amberBorder}` }}>
      <div className="text-center">
        <Lock className="mx-auto h-5 w-5" style={{ color: theme.navy }} />
        <p className="mt-2 text-[15px] font-bold" style={{ color: theme.navy }}>
          Unlock the full chapter with a Study Pass
        </p>
      </div>

      <div
        className="relative mt-4 rounded-xl px-6 py-6"
        style={{ background: theme.navy, border: "2px solid rgba(212,175,55,0.45)" }}
      >
        <span
          className="absolute right-0 top-0 rounded-bl-xl rounded-tr-xl px-3 py-1.5 text-[10px] font-bold"
          style={{ background: "#CE1126", color: "#FFFFFF" }}
        >
          Best Value
        </span>

        <p className="text-[16px] font-bold text-white">Full Study Pass</p>
        <div className="mt-2 flex items-baseline gap-2">
          {saleActive && fullPassLink?.original_price_cents && (
            <span className="text-[14px] line-through" style={{ color: "rgba(255,255,255,0.45)" }}>
              {formatPrice(fullPassLink.original_price_cents)}
            </span>
          )}
          <span className="text-[24px] font-bold text-white">{formatPrice(fullPassLink?.price_cents || 12500)}</span>
        </div>
        <a
          href={fullPassUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block rounded-lg px-6 py-3 text-center text-[15px] font-bold text-white transition-all hover:brightness-90"
          style={{ background: "#CE1126" }}
        >
          Get Full Access →
        </a>
      </div>

      {chapterNumber && (
        <div className="mt-4 rounded-xl px-6 py-5" style={{ background: theme.cardBg, border: `1px solid ${theme.border}` }}>
          <p className="text-[15px] font-bold" style={{ color: theme.text }}>
            Chapter {chapterNumber} Only
          </p>
          <p className="mt-1 text-[22px] font-bold" style={{ color: theme.text }}>
            {formatPrice(chapterLink?.price_cents || 3000)}
          </p>
          <a
            href={singleChapterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block rounded-lg px-6 py-3 text-center text-[15px] font-bold text-white transition-all hover:brightness-90"
            style={{ background: "#006BA6" }}
          >
            Buy Chapter {chapterNumber} →
          </a>
        </div>
      )}
    </div>
  );
}

function JournalEntryCard({
  card,
  hidden,
  isAdmin,
  isReviewed,
  onReview,
  onToggleHidden,
}: {
  card: CramCard;
  hidden: boolean;
  isAdmin: boolean;
  isReviewed: boolean;
  onReview: () => void;
  onToggleHidden: () => void;
}) {
  const [revealed, setRevealed] = useState(false);

  const displayRows = card.rows.map((suppRow) => {
    const matchedRow = card.completedRows?.find(
      (row) => row.account_name.toLowerCase().trim() === suppRow.account_name.toLowerCase().trim(),
    );

    return {
      account_name: suppRow.account_name,
      isCredit: suppRow.side === "credit",
      debit: matchedRow?.debit ?? null,
      credit: matchedRow?.credit ?? null,
      debit_credit_reason: matchedRow?.debit_credit_reason || suppRow.debit_credit_reason || "",
      amount_source: matchedRow?.amount_source || suppRow.amount_source || "",
    };
  });

  return (
    <div
      className="relative rounded-xl border overflow-hidden"
      style={{
        background: theme.cardBg,
        borderColor: isReviewed ? theme.successBorder : theme.border,
        boxShadow: "0 2px 10px rgba(15,23,42,0.04)",
        opacity: hidden ? 0.4 : 1,
      }}
    >
      {isAdmin && (
        <button
          type="button"
          onClick={onToggleHidden}
          className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-md"
          style={{ background: hidden ? theme.warningBg : theme.mutedBg, color: hidden ? theme.warningText : theme.textMuted, border: `1px solid ${theme.border}` }}
          title={hidden ? "Show entry to students" : "Hide entry from students"}
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      )}

      <div className="px-4 pt-4 pb-2 sm:px-5">
        <div className="flex flex-wrap items-center gap-2 pr-10">
          <p className="text-[11px] font-mono" style={{ color: theme.textMuted }}>
            {card.sourceRef || card.assetName}
          </p>
          {isAdmin && hidden && (
            <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold" style={{ background: theme.warningBg, color: theme.warningText }}>
              Hidden
            </span>
          )}
        </div>
        <p className="mt-1 text-[14px] font-bold leading-[1.4]" style={{ color: theme.text }}>
          {card.label}
        </p>
      </div>

      <div className="px-4 pb-3 sm:px-5">
        <div className="overflow-x-auto rounded-md" style={{ border: `1px solid ${theme.border}` }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: theme.navy }}>
                <th className="px-3 py-1.5 text-left text-[12px] font-bold text-white">Account</th>
                <th className="w-24 px-3 py-1.5 text-right text-[12px] font-bold text-white">Debit</th>
                <th className="w-24 px-3 py-1.5 text-right text-[12px] font-bold text-white">Credit</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, index) => (
                <tr key={`${row.account_name}-${index}`} style={{ background: index % 2 === 0 ? "#FFFFFF" : theme.mutedBg }}>
                  <td className={`px-3 py-1.5 text-[13px] ${row.isCredit ? "pl-10" : ""}`} style={{ color: theme.text }}>
                    {row.account_name}
                    {revealed && row.debit_credit_reason && <JETooltip text={row.debit_credit_reason} variant="solutions" />}
                  </td>
                  <td className="px-3 py-1.5 text-right text-[13px] font-mono" style={{ color: revealed ? theme.text : theme.textMuted }}>
                    {!row.isCredit ? (
                      revealed ? (
                        row.debit != null && row.debit !== 0 ? (
                          <span>
                            {Number(row.debit).toLocaleString("en-US")}
                            {row.amount_source && <JETooltip text={row.amount_source} variant="solutions" />}
                          </span>
                        ) : (
                          "???"
                        )
                      ) : (
                        "???"
                      )
                    ) : (
                      ""
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right text-[13px] font-mono" style={{ color: revealed ? theme.text : theme.textMuted }}>
                    {row.isCredit ? (
                      revealed ? (
                        row.credit != null && row.credit !== 0 ? (
                          <span>
                            {Number(row.credit).toLocaleString("en-US")}
                            {row.amount_source && <JETooltip text={row.amount_source} variant="solutions" />}
                          </span>
                        ) : (
                          "???"
                        )
                      ) : (
                        "???"
                      )
                    ) : (
                      ""
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 pb-4 sm:px-5">
        <button
          type="button"
          onClick={() => setRevealed((value) => !value)}
          className="rounded-lg px-4 py-2 text-[12px] font-semibold"
          style={{ background: revealed ? theme.mutedBg : "#FEF3C7", color: revealed ? theme.textMuted : theme.amberText, border: `1px solid ${revealed ? theme.border : "#FCD34D"}` }}
        >
          {revealed ? "Hide Amounts" : "Reveal Amounts"}
        </button>
        <button
          type="button"
          onClick={onReview}
          disabled={isReviewed}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold"
          style={{
            background: isReviewed ? theme.successBg : "#DCFCE7",
            color: isReviewed ? "#15803D" : theme.successText,
            border: `1px solid ${isReviewed ? theme.successBorder : "#86EFAC"}`,
            cursor: isReviewed ? "default" : "pointer",
          }}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          {isReviewed ? "Reviewed" : "Got It"}
        </button>
      </div>
    </div>
  );
}

function getBELabel(courseCode: string) {
  if (courseCode === "INTRO1" || courseCode === "INTRO2" || courseCode === "FA1" || courseCode === "MA2") return "Quick Studies";
  return "Brief Exercises";
}

export default function ChapterCramTool() {
  const { chapterId: routeChapterId } = useParams<{ chapterId: string }>();
  const [searchParams] = useSearchParams();
  const chapterId = routeChapterId || searchParams.get("chapter_id") || "";
  const isPreview = searchParams.get("preview") === "true";
  const enrollUrl = useEnrollUrl();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();

  const [reviewedSet, setReviewedSet] = useState<Set<string>>(new Set());
  const [shuffledOrder, setShuffledOrder] = useState<number[] | null>(null);
  const [solutionsTab, setSolutionsTab] = useState<"be" | "ex" | "p">("be");
  const [expandedTabs, setExpandedTabs] = useState<Record<string, boolean>>({});
  const [formulaIndex, setFormulaIndex] = useState(0);
  const [jeIndex, setJeIndex] = useState(0);
  const [formulasSeenSet, setFormulasSeenSet] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem(`sa_formulas_seen_${chapterId}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const { data: isAdmin = false } = useQuery({
    queryKey: ["cram-admin-check", user?.id],
    enabled: !authLoading,
    queryFn: async () => {
      if (!user?.id) return false;

      const { data, error } = await supabase
        .from("va_accounts")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      const normalizedEmail = user.email?.toLowerCase() || "";
      if (["lee@survivestudios.com", "lee@surviveaccounting.com"].includes(normalizedEmail)) return true;
      if (!data) return true;

      return data.role === "admin" || data.role === "lead_va";
    },
  });

  const { data: chapter, isLoading: chapterLoading } = useQuery({
    queryKey: ["cram-chapter", chapterId],
    enabled: !!chapterId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id, courses!chapters_course_id_fkey(code, course_name)")
        .eq("id", chapterId)
        .single();

      if (error) throw error;
      return data as any;
    },
  });

  const { data: approvedAssets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ["cram-approved-assets", chapterId],
    enabled: !!chapterId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("teaching_assets")
        .select(
          "id, asset_name, source_ref, asset_type, problem_title, supplementary_je_json, journal_entry_completed_json, important_formulas",
        )
        .eq("chapter_id", chapterId)
        .not("asset_approved_at", "is", null)
        .order("source_ref");

      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: chapterFormulas = [] } = useQuery({
    queryKey: ["cram-chapter-formulas", chapterId],
    enabled: !!chapterId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("chapter_formulas")
        .select("id, formula_name, formula_expression, formula_explanation, image_url, is_approved, sort_order")
        .eq("chapter_id", chapterId)
        .eq("is_approved", true)
        .order("sort_order");

      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: sectionConfigs = [] } = useQuery({
    queryKey: ["cram-section-config", chapterId],
    enabled: !!chapterId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("chapter_section_config")
        .select("*")
        .eq("chapter_id", chapterId);

      if (error) throw error;
      return (data || []) as SectionConfigRow[];
    },
  });

  const { data: paymentLinks = [] } = useQuery({
    queryKey: ["payment-links-cram"],
    enabled: isPreview,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("payment_links").select("*").eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });

  // Chapter-level journal entries
  const { data: chapterJEData } = useQuery({
    queryKey: ["cram-chapter-je", chapterId],
    enabled: !!chapterId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: cats } = await supabase
        .from("chapter_je_categories")
        .select("id, category_name, sort_order")
        .eq("chapter_id", chapterId!)
        .order("sort_order");
      const { data: entries } = await supabase
        .from("chapter_journal_entries")
        .select("id, category_id, transaction_label, je_lines, sort_order")
        .eq("chapter_id", chapterId!)
        .eq("is_approved", true)
        .order("sort_order");
      return { categories: cats || [], entries: entries || [] };
    },
  });

  // Content suite data
  const { data: contentSuite } = useQuery({
    queryKey: ["cram-content-suite", chapterId],
    enabled: !!chapterId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [purposeRes, termsRes, mistakesRes, checklistRes, accountsRes] = await Promise.all([
        supabase.from("chapter_purpose").select("*").eq("chapter_id", chapterId!).maybeSingle(),
        supabase.from("chapter_key_terms").select("*").eq("chapter_id", chapterId!).eq("is_approved", true).order("sort_order"),
        supabase.from("chapter_exam_mistakes").select("*").eq("chapter_id", chapterId!).eq("is_approved", true).order("sort_order"),
        supabase.from("chapter_exam_checklist").select("*").eq("chapter_id", chapterId!).eq("is_approved", true).order("sort_order"),
        supabase.from("chapter_accounts").select("*").eq("chapter_id", chapterId!).eq("is_approved", true).order("sort_order"),
      ]);
      return {
        purpose: purposeRes.data as any,
        keyTerms: (termsRes.data || []) as any[],
        examMistakes: (mistakesRes.data || []) as any[],
        examChecklist: (checklistRes.data || []) as any[],
        accounts: (accountsRes.data || []) as any[],
      };
    },
  });

  const sectionConfigMap = useMemo(() => {
    const map: Record<string, SectionConfigRow> = {};
    sectionConfigs.forEach((config) => {
      map[config.section_name] = config;
    });
    return map;
  }, [sectionConfigs]);

  const isSectionVisible = useCallback(
    (sectionName: string) => {
      const config = sectionConfigMap[sectionName];
      return config ? config.is_visible : true;
    },
    [sectionConfigMap],
  );

  const isItemHidden = useCallback(
    (sectionName: string, itemId: string) => {
      const config = sectionConfigMap[sectionName];
      return config ? (config.hidden_item_ids || []).includes(itemId) : false;
    },
    [sectionConfigMap],
  );

  const toggleSectionVisibility = useCallback(
    async (sectionName: string) => {
      const config = sectionConfigMap[sectionName];
      const nextVisible = !isSectionVisible(sectionName);

      if (config) {
        const { error } = await (supabase as any)
          .from("chapter_section_config")
          .update({ is_visible: nextVisible, updated_at: new Date().toISOString() })
          .eq("id", config.id);

        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("chapter_section_config").insert({
          chapter_id: chapterId,
          section_name: sectionName,
          is_visible: nextVisible,
          hidden_item_ids: [],
        });

        if (error) throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ["cram-section-config", chapterId] });
    },
    [chapterId, isSectionVisible, queryClient, sectionConfigMap],
  );

  const toggleItemHidden = useCallback(
    async (sectionName: string, itemId: string) => {
      const config = sectionConfigMap[sectionName];
      const currentHidden = config?.hidden_item_ids || [];
      const nextHidden = currentHidden.includes(itemId)
        ? currentHidden.filter((value) => value !== itemId)
        : [...currentHidden, itemId];

      if (config) {
        const { error } = await (supabase as any)
          .from("chapter_section_config")
          .update({ hidden_item_ids: nextHidden, updated_at: new Date().toISOString() })
          .eq("id", config.id);

        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("chapter_section_config").insert({
          chapter_id: chapterId,
          section_name: sectionName,
          is_visible: true,
          hidden_item_ids: nextHidden,
        });

        if (error) throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ["cram-section-config", chapterId] });
    },
    [chapterId, queryClient, sectionConfigMap],
  );

  const cramCards = useMemo<CramCard[]>(() => {
    const cards: CramCard[] = [];

    approvedAssets.forEach((asset) => {
      let supplementary = asset.supplementary_je_json;
      if (!supplementary) return;

      if (typeof supplementary === "string") {
        try {
          supplementary = JSON.parse(supplementary);
        } catch {
          return;
        }
      }

      if (!supplementary?.entries || !Array.isArray(supplementary.entries)) return;

      supplementary.entries.forEach((entry: SupplementaryEntry, index: number) => {
        if (!entry?.rows?.length) return;

        cards.push({
          id: `${asset.id}-${index}`,
          assetName: asset.asset_name,
          sourceRef: asset.source_ref || asset.asset_name,
          label: entry.label,
          rows: entry.rows,
          completedRows: matchCompletedEntry(entry, asset.journal_entry_completed_json),
        });
      });
    });

    return cards;
  }, [approvedAssets]);

  const displayCards = useMemo(() => {
    if (!shuffledOrder) return cramCards;
    return shuffledOrder.map((index) => cramCards[index]).filter(Boolean);
  }, [cramCards, shuffledOrder]);

  const visibleJournalCards = useMemo(() => {
    return displayCards.filter((card) => isAdmin || !isItemHidden("journal_entries", card.id));
  }, [displayCards, isAdmin, isItemHidden]);

  // Chapter-level formulas with images
  const chapterImageFormulas = useMemo(() => {
    return chapterFormulas
      .filter((f: any) => f.image_url)
      .map((f: any): FormulaCard => ({
        id: f.id,
        name: f.formula_name,
        expression: f.formula_expression,
        explanation: f.formula_explanation || undefined,
        image_url: f.image_url,
      }));
  }, [chapterFormulas]);

  // Fallback: per-asset important_formulas (legacy)
  const perAssetFormulas = useMemo(() => {
    if (chapterImageFormulas.length > 0) return [];
    const all: FormulaCard[] = [];
    approvedAssets.forEach((asset) => {
      if (asset.important_formulas) {
        all.push(...parseImportantFormulas(asset.important_formulas));
      }
    });
    return all;
  }, [approvedAssets, chapterImageFormulas.length]);

  const useChapterFormulas = chapterImageFormulas.length > 0;
  const structuredFormulas = useChapterFormulas ? chapterImageFormulas : perAssetFormulas;

  const visibleFormulas = useMemo(() => {
    return structuredFormulas.filter((formula) => {
      return isAdmin || !isItemHidden("formulas", formula.id);
    });
  }, [structuredFormulas, isAdmin, isItemHidden]);

  const solutionsFiltered = useMemo(() => {
    const sorted = [...approvedAssets].sort(sortBySourceRef);
    return sorted.filter((asset) => {
      const assetType = (asset.asset_type || "").toLowerCase();
      const parsed = parseSourceRef((asset.source_ref || "").toUpperCase());
      const isBE = assetType === "be" || assetType === "qs" || assetType === "brief_exercise" || assetType === "brief exercise" || parsed.prefix === "BE" || parsed.prefix === "QS";
      const isEX = assetType === "e" || assetType === "ex" || assetType === "exercise" || parsed.prefix === "E" || parsed.prefix === "EX";
      const isP = assetType === "p" || assetType === "problem" || parsed.prefix === "P";
      if (solutionsTab === "be") return isBE || (!isEX && !isP);
      if (solutionsTab === "ex") return isEX;
      return isP;
    });
  }, [approvedAssets, solutionsTab]);

  const formulasSeenCount = visibleFormulas.filter((f) => formulasSeenSet.has(f.id)).length;

  const handleFormulaSeen = useCallback((formulaId: string) => {
    setFormulasSeenSet((prev) => {
      const next = new Set(prev).add(formulaId);
      try { sessionStorage.setItem(`sa_formulas_seen_${chapterId}`, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, [chapterId]);

  const reviewedCount = visibleJournalCards.filter((card) => reviewedSet.has(card.id)).length;
  const progressPercent = visibleJournalCards.length > 0 ? (reviewedCount / visibleJournalCards.length) * 100 : 0;

  const handleShuffle = useCallback(() => {
    const indices = Array.from({ length: cramCards.length }, (_, index) => index);
    for (let index = indices.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [indices[index], indices[swapIndex]] = [indices[swapIndex], indices[index]];
    }
    setShuffledOrder(indices);
    setReviewedSet(new Set());
    setJeIndex(0);
  }, [cramCards.length]);

  const handleReview = useCallback((cardId: string) => {
    setReviewedSet((previous) => new Set(previous).add(cardId));
  }, []);

  useEffect(() => {
    if (!chapter) return;
    document.title = `Survive This Chapter — Ch ${chapter.chapter_number} — Survive Accounting`;
    return () => {
      document.title = "Survive Accounting";
    };
  }, [chapter]);

  useEffect(() => { setFormulaIndex(0); }, [visibleFormulas.length]);
  useEffect(() => { setJeIndex(0); }, [visibleJournalCards.length]);

  if (!chapterId) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: theme.pageBg }}>
        <p style={{ color: theme.text }}>No chapter specified.</p>
      </div>
    );
  }

  if (chapterLoading || assetsLoading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: theme.pageBg }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4" style={{ borderColor: theme.border, borderTopColor: theme.heading }} />
      </div>
    );
  }

  const courseCode = chapter?.courses?.code || "";
  const beLabel = getBELabel(courseCode);
  const courseDisplayName =
    courseCode === "IA2"
      ? "Intermediate Accounting 2"
      : courseCode === "IA1"
        ? "Intermediate Accounting 1"
        : courseCode === "MA2"
          ? "Managerial Accounting"
          : courseCode === "FA1"
            ? "Financial Accounting"
            : chapter?.courses?.course_name || courseCode;

  const fullPassLink = paymentLinks.find((link: any) => link.link_type === "full_pass" && link.course_id === chapter?.course_id);
  const chapterLink = paymentLinks.find((link: any) => link.link_type === "chapter" && link.chapter_id === chapterId);

  const showSolutionsSection = isAdmin || isSectionVisible("solutions_library");
  const showJournalSection = (visibleJournalCards.length > 0 || isAdmin) && (isAdmin || isSectionVisible("journal_entries"));
  const showFormulasSection = (structuredFormulas.length > 0 || isAdmin) && (isAdmin || isSectionVisible("formulas"));
  const chapterJEEntries = chapterJEData?.entries || [];
  const chapterJECategories = chapterJEData?.categories || [];
  const showChapterJESection = (chapterJEEntries.length > 0 || isAdmin) && (isAdmin || isSectionVisible("chapter_je_reference"));

  const isTabExpanded = (key: string) => !!expandedTabs[key];
  const toggleTab = (key: string) => setExpandedTabs((prev) => ({ ...prev, [key]: !prev[key] }));

  // Current formula for flashcard
  const currentFormula = visibleFormulas[formulaIndex];
  const currentFormulaHidden = currentFormula ? isItemHidden("formulas", currentFormula.id) : false;

  // Current JE card for flashcard
  const currentJeCard = visibleJournalCards[jeIndex];
  const currentJeHidden = currentJeCard ? isItemHidden("journal_entries", currentJeCard.id) : false;

  return (
    <div className="min-h-screen" style={{ background: theme.pageBg }}>
      <header style={{ background: theme.navy, height: 48 }}>
        <div className="mx-auto flex h-full max-w-[920px] items-center px-4 sm:px-6">
          <img src={LOGO_URL} alt="Survive Accounting" className="h-7 object-contain sm:h-8" />
        </div>
      </header>

      <main className="mx-auto max-w-[920px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-8">
          {courseDisplayName && (
            <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: theme.label }}>
              {courseDisplayName}
            </p>
          )}
          <h1 className="mt-1 text-[26px] font-bold" style={{ color: theme.heading }}>
            Survive This Chapter
          </h1>
          <p className="mt-1 text-[15px] font-semibold" style={{ color: theme.heading }}>
            Ch {chapter?.chapter_number} — {chapter?.chapter_name}
          </p>
        </div>

        <div className="space-y-10">
          {/* ──── Solutions Library ──── */}
          {showSolutionsSection && (
            <section style={{ opacity: isSectionVisible("solutions_library") ? 1 : 0.4 }}>
              <SectionHeaderWithToggle
                label="SOLUTIONS LIBRARY"
                isAdmin={isAdmin}
                sectionName="solutions_library"
                isVisible={isSectionVisible("solutions_library")}
                onToggle={toggleSectionVisibility}
              />

              <div className="mb-4 flex flex-wrap gap-2">
                {([
                  ["be", beLabel],
                  ["ex", "Exercises"],
                  ["p", "Problems"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSolutionsTab(key)}
                    className="rounded-full px-4 py-1.5 text-[12px] font-semibold"
                    style={{
                      background: solutionsTab === key ? theme.navy : theme.mutedBg,
                      color: solutionsTab === key ? "#FFFFFF" : theme.textMuted,
                      border: "none",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border" style={{ borderColor: theme.border, background: theme.cardBg }}>
                {solutionsFiltered.length > 0 ? (
                  <div>
                    {solutionsFiltered.map((asset, index) => {
                      if (isPreview && index >= PREVIEW_LIMIT) return null;
                      if (!isTabExpanded(solutionsTab) && index >= SOLUTIONS_INITIAL_SHOW) return null;

                      return (
                        <div
                          key={asset.id}
                          className="flex items-center gap-3 px-4 py-3 text-[12px] sm:px-5"
                          style={{ borderBottom: index < Math.min(solutionsFiltered.length, isTabExpanded(solutionsTab) ? solutionsFiltered.length : SOLUTIONS_INITIAL_SHOW) - 1 ? `1px solid ${theme.border}` : "none" }}
                        >
                          <span className="min-w-[64px] shrink-0 font-mono text-[11px]" style={{ color: theme.heading }}>
                            {asset.source_ref || "—"}
                          </span>
                          <span className="min-w-0 flex-1 truncate" style={{ color: theme.text }}>
                            {asset.problem_title || asset.asset_name}
                          </span>
                          <a
                            href={`https://learn.surviveaccounting.com/solutions/${asset.asset_name}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-[12px] font-semibold"
                            style={{ color: "#2563EB" }}
                          >
                            View →
                          </a>
                        </div>
                      );
                    })}

                    {!isPreview && solutionsFiltered.length > SOLUTIONS_INITIAL_SHOW && (
                      <div className="px-4 py-3 sm:px-5" style={{ borderTop: `1px solid ${theme.border}` }}>
                        <button
                          type="button"
                          onClick={() => toggleTab(solutionsTab)}
                          className="text-[12px] font-semibold"
                          style={{ color: "#2563EB", background: "none", border: "none", cursor: "pointer" }}
                        >
                          {isTabExpanded(solutionsTab) ? "Show less ↑" : `Show more → (${solutionsFiltered.length - SOLUTIONS_INITIAL_SHOW} more)`}
                        </button>
                      </div>
                    )}

                    {isPreview && solutionsFiltered.length > PREVIEW_LIMIT && (
                      <div className="border-t p-4 sm:p-5" style={{ borderColor: theme.border }}>
                        <TieredPaywallCard
                          enrollUrl={enrollUrl}
                          chapterNumber={chapter?.chapter_number || null}
                          fullPassLink={fullPassLink}
                          chapterLink={chapterLink}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="px-4 py-5 sm:px-5">
                    <p className="text-[13px]" style={{ color: theme.textMuted }}>
                      No solutions in this tab yet.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ──── Chapter-Level All Journal Entries ──── */}
          {showChapterJESection && (
            <section style={{ opacity: isSectionVisible("chapter_je_reference") ? 1 : 0.4 }}>
              <SectionHeaderWithToggle
                label={`CH ${chapter?.chapter_number || "?"} — ALL JOURNAL ENTRIES`}
                count={chapterJEEntries.length}
                isAdmin={isAdmin}
                sectionName="chapter_je_reference"
                isVisible={isSectionVisible("chapter_je_reference")}
                onToggle={toggleSectionVisibility}
              />
              <div className="rounded-xl border px-4 py-4 sm:px-5" style={{ borderColor: theme.border, background: theme.cardBg }}>
                {chapterJEEntries.length > 0 ? (
                  <CramChapterJEAccordion categories={chapterJECategories} entries={chapterJEEntries} />
                ) : (
                  <p className="text-[13px]" style={{ color: theme.textMuted }}>
                    No chapter journal entries available yet.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* ──── Journal Entries to Memorize (Flashcard Mode) ──── */}
          {showJournalSection && (
            <section id="je-cram-tool" className="scroll-mt-16" style={{ opacity: isSectionVisible("journal_entries") ? 1 : 0.4 }}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <SectionHeaderWithToggle
                  label="JOURNAL ENTRIES TO MEMORIZE"
                  count={visibleJournalCards.length}
                  isAdmin={isAdmin}
                  sectionName="journal_entries"
                  isVisible={isSectionVisible("journal_entries")}
                  onToggle={toggleSectionVisibility}
                />

                {visibleJournalCards.length > 1 && (
                  <button
                    type="button"
                    onClick={handleShuffle}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold"
                    style={{ background: theme.navySoft, color: "#2563EB", border: `1px solid #BFDBFE` }}
                  >
                    <Shuffle className="h-3 w-3" />
                    Shuffle
                  </button>
                )}
              </div>

              {visibleJournalCards.length > 0 ? (
                <>
                  <div className="mb-4 rounded-xl border px-4 py-3" style={{ background: theme.mutedBg, borderColor: theme.border }}>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[13px] font-semibold" style={{ color: theme.text }}>
                        {reviewedCount} of {visibleJournalCards.length} reviewed
                      </p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full" style={{ background: "#E5E7EB" }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%`, background: progressPercent === 100 ? "#22C55E" : "#3B82F6" }}
                      />
                    </div>
                  </div>

                  {currentJeCard && (
                    <div style={{ opacity: currentJeHidden ? 0.5 : 1 }}>
                      {isAdmin && currentJeHidden && (
                        <div className="mb-2 rounded-md px-3 py-1.5 text-[11px] font-semibold" style={{ background: theme.warningBg, color: theme.warningText }}>
                          Hidden from students
                        </div>
                      )}
                      <JournalEntryCard
                        card={currentJeCard}
                        hidden={currentJeHidden}
                        isAdmin={isAdmin}
                        isReviewed={reviewedSet.has(currentJeCard.id)}
                        onReview={() => handleReview(currentJeCard.id)}
                        onToggleHidden={() => toggleItemHidden("journal_entries", currentJeCard.id)}
                      />
                    </div>
                  )}

                  {visibleJournalCards.length > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                      <button
                        type="button"
                        disabled={jeIndex === 0}
                        onClick={() => setJeIndex((i) => i - 1)}
                        className="inline-flex items-center gap-1 rounded-md px-4 py-2 text-[13px] font-semibold disabled:opacity-30"
                        style={{ color: theme.navy, border: `1px solid ${theme.navy}`, background: "transparent" }}
                      >
                        <ChevronLeft className="h-4 w-4" /> Prev
                      </button>
                      <span className="text-[13px]" style={{ color: theme.textMuted }}>
                        {jeIndex + 1} of {visibleJournalCards.length}
                      </span>
                      <button
                        type="button"
                        disabled={jeIndex >= visibleJournalCards.length - 1}
                        onClick={() => setJeIndex((i) => i + 1)}
                        className="inline-flex items-center gap-1 rounded-md px-4 py-2 text-[13px] font-semibold disabled:opacity-30"
                        style={{ color: theme.navy, border: `1px solid ${theme.navy}`, background: "transparent" }}
                      >
                        Next <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {isPreview && visibleJournalCards.length > PREVIEW_LIMIT && (
                    <div className="mt-4">
                      <TieredPaywallCard
                        enrollUrl={enrollUrl}
                        chapterNumber={chapter?.chapter_number || null}
                        fullPassLink={fullPassLink}
                        chapterLink={chapterLink}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border px-4 py-5 sm:px-5" style={{ borderColor: theme.border, background: theme.cardBg }}>
                  <p className="text-[13px]" style={{ color: theme.textMuted }}>
                    No journal entries to memorize yet.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* ──── Formulas to Memorize (Flashcard Mode) ──── */}
          {showFormulasSection && (
            <section style={{ opacity: isSectionVisible("formulas") ? 1 : 0.4 }}>
              <SectionHeaderWithToggle
                label="FORMULAS TO MEMORIZE"
                count={visibleFormulas.length}
                isAdmin={isAdmin}
                sectionName="formulas"
                isVisible={isSectionVisible("formulas")}
                onToggle={toggleSectionVisibility}
              />

              {visibleFormulas.length > 0 && currentFormula ? (
                <>
                  {/* Seen progress */}
                  {useChapterFormulas && (
                    <div className="mb-4 rounded-xl border px-4 py-3" style={{ background: theme.mutedBg, borderColor: theme.border }}>
                      <p className="text-[13px] font-semibold" style={{ color: theme.text }}>
                        {formulasSeenCount} ✓ / {visibleFormulas.length}
                      </p>
                    </div>
                  )}

                  <div
                    className="relative mx-auto flex flex-col rounded-xl overflow-hidden"
                    style={{
                      background: theme.cardBg,
                      boxShadow: "0 4px 20px rgba(15,23,42,0.06)",
                      border: `1px solid ${theme.border}`,
                      opacity: currentFormulaHidden ? 0.5 : 1,
                    }}
                  >
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => toggleItemHidden("formulas", currentFormula.id)}
                        className="absolute right-3 top-3 z-10 inline-flex h-6 w-6 items-center justify-center rounded-md"
                        style={{
                          background: currentFormulaHidden ? theme.warningBg : "rgba(255,255,255,0.9)",
                          color: currentFormulaHidden ? theme.warningText : theme.textMuted,
                          border: `1px solid ${theme.border}`,
                        }}
                        title={currentFormulaHidden ? "Show to students" : "Hide from students"}
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {isAdmin && currentFormulaHidden && (
                      <span
                        className="absolute left-3 top-3 z-10 rounded-full px-2 py-0.5 text-[9px] font-semibold"
                        style={{ background: theme.warningBg, color: theme.warningText }}
                      >
                        Hidden from students
                      </span>
                    )}

                    {currentFormula.image_url ? (
                      <>
                        {/* Formula name heading above image */}
                        <div className="px-5 pt-4 pb-2">
                          <p className="text-[13px] font-semibold" style={{ color: theme.heading }}>
                            {currentFormula.name}
                          </p>
                        </div>
                        <div className="px-4 pb-4">
                          <img
                            src={currentFormula.image_url}
                            alt={currentFormula.name}
                            style={{
                              width: "100%",
                              maxWidth: 800,
                              aspectRatio: "2 / 1",
                              objectFit: "contain",
                              margin: "0 auto",
                              borderRadius: 12,
                              display: "block",
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: "24px 32px" }}>
                        <p
                          className="text-[11px] font-semibold uppercase"
                          style={{ color: theme.heading, letterSpacing: "0.05em", marginBottom: 8 }}
                        >
                          {currentFormula.name}
                        </p>
                        <p
                          className="text-[20px] font-medium"
                          style={{
                            color: theme.heading,
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
                          }}
                        >
                          {currentFormula.expression}
                        </p>
                        {currentFormula.explanation && (
                          <p className="text-[13px]" style={{ color: theme.textMuted, marginTop: 10 }}>
                            {currentFormula.explanation}
                          </p>
                        )}
                        <span
                          className="mt-3 inline-block rounded-full px-2 py-0.5 text-[10px]"
                          style={{ background: theme.mutedBg, color: theme.textMuted }}
                        >
                          Image coming soon
                        </span>
                      </div>
                    )}

                    {/* Got It button row */}
                    {useChapterFormulas && (
                      <div className="flex items-center gap-3 px-5 pb-4">
                        <button
                          type="button"
                          onClick={() => handleFormulaSeen(currentFormula.id)}
                          disabled={formulasSeenSet.has(currentFormula.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold"
                          style={{
                            background: formulasSeenSet.has(currentFormula.id) ? theme.successBg : "#DCFCE7",
                            color: formulasSeenSet.has(currentFormula.id) ? "#15803D" : theme.successText,
                            border: `1px solid ${formulasSeenSet.has(currentFormula.id) ? theme.successBorder : "#86EFAC"}`,
                            cursor: formulasSeenSet.has(currentFormula.id) ? "default" : "pointer",
                          }}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          {formulasSeenSet.has(currentFormula.id) ? "Got It ✓" : "Got It"}
                        </button>
                      </div>
                    )}
                  </div>

                  {visibleFormulas.length > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                      <button
                        type="button"
                        disabled={formulaIndex === 0}
                        onClick={() => setFormulaIndex((i) => i - 1)}
                        className="inline-flex items-center gap-1 rounded-md px-4 py-2 text-[13px] font-semibold disabled:opacity-30"
                        style={{ color: theme.navy, border: `1px solid ${theme.navy}`, background: "transparent" }}
                      >
                        <ChevronLeft className="h-4 w-4" /> Prev
                      </button>
                      <span className="text-[13px]" style={{ color: theme.textMuted }}>
                        {formulasSeenSet.has(currentFormula.id) ? "✓ " : ""}
                        {formulaIndex + 1} / {visibleFormulas.length}
                      </span>
                      <button
                        type="button"
                        disabled={formulaIndex >= visibleFormulas.length - 1}
                        onClick={() => setFormulaIndex((i) => i + 1)}
                        className="inline-flex items-center gap-1 rounded-md px-4 py-2 text-[13px] font-semibold disabled:opacity-30"
                        style={{ color: theme.navy, border: `1px solid ${theme.navy}`, background: "transparent" }}
                      >
                        Next <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border px-4 py-5 sm:px-5" style={{ borderColor: theme.border, background: theme.cardBg }}>
                  <p className="text-[13px]" style={{ color: theme.textMuted }}>
                    No formulas to memorize yet.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* ──── Share Feedback / Report Issue ──── */}
          <section>
            <SectionHeaderWithToggle
              label="SHARE FEEDBACK"
              isAdmin={isAdmin}
              sectionName="ask_lee"
              isVisible={isSectionVisible("ask_lee")}
              onToggle={toggleSectionVisibility}
            />
            {(isAdmin || isSectionVisible("ask_lee")) && (
              <CramFeedbackForm
                chapterId={chapterId}
                chapterNumber={chapter?.chapter_number}
                chapterName={chapter?.chapter_name || ""}
                courseDisplayName={courseDisplayName}
                isVisible={isSectionVisible("ask_lee")}
              />
            )}
          </section>

          {/* ──── About Lee ──── */}
          <section>
            <SectionHeaderWithToggle
              label="ABOUT LEE"
              isAdmin={isAdmin}
              sectionName="about_lee"
              isVisible={isSectionVisible("about_lee")}
              onToggle={toggleSectionVisibility}
            />
            {(isAdmin || isSectionVisible("about_lee")) && (
              <div
                className="rounded-xl border p-6"
                style={{ borderColor: theme.border, background: theme.cardBg, opacity: isSectionVisible("about_lee") ? 1 : 0.4 }}
              >
                <div className="flex flex-col items-center text-center gap-4">
                  <img
                    src={LEE_HERO_URL}
                    alt="Lee Ingram"
                    className="w-full"
                    style={{ objectFit: "contain", borderRadius: 12, maxHeight: 240 }}
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
                    <p className="text-[12px] leading-[1.6] mt-2" style={{ color: theme.textMuted }}>
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
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Floating Action Bar */}
      <CramFloatingActionBar
        chapterId={chapterId}
        chapterNumber={chapter?.chapter_number}
        chapterName={chapter?.chapter_name || ""}
        courseDisplayName={courseDisplayName}
      />
    </div>
  );
}

// ── Feedback Form (Report Issue style with .edu validation) ─────────

const CRAM_ISSUE_TYPES = [
  "Something looks wrong",
  "Missing content",
  "General feedback",
  "Question about this chapter",
  "Other",
];

function CramFeedbackForm({
  chapterId,
  chapterNumber,
  chapterName,
  courseDisplayName,
  isVisible,
}: {
  chapterId: string;
  chapterNumber?: number;
  chapterName: string;
  courseDisplayName: string;
  isVisible: boolean;
}) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [name, setName] = useState("");
  const [issueType, setIssueType] = useState(CRAM_ISSUE_TYPES[0]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState("");

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
        chapter_id: chapterId,
        student_email: email.trim(),
        question: message.trim(),
        issue_type: issueType === "General feedback" ? "feedback" : "issue",
        status: "new",
        student_name: name.trim() || null,
      });
      supabase.functions.invoke("send-issue-report", {
        body: {
          student_email: email.trim(),
          message: message.trim(),
          issue_type_label: issueType,
          course_name: courseDisplayName,
          chapter_number: chapterNumber || null,
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

  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: theme.border, background: theme.cardBg, opacity: isVisible ? 1 : 0.4 }}
    >
      {sent ? (
        <div className="text-center py-6">
          <CheckCircle className="h-6 w-6 mx-auto" style={{ color: "#22c55e" }} />
          <p className="text-[15px] font-bold mt-3" style={{ color: theme.heading }}>Got it — thank you!</p>
          <p className="text-[13px] mt-1" style={{ color: theme.textMuted }}>I'll reply to {email} if needed.</p>
          <p className="text-[13px] italic mt-1" style={{ color: theme.heading }}>— Lee</p>
        </div>
      ) : (
        <>
          <p className="text-[14px] font-semibold" style={{ color: theme.heading }}>
            Share Feedback or Report an Issue
          </p>
          <p className="mt-1 mb-4 text-[12px]" style={{ color: theme.textMuted }}>
            I read every message personally.
          </p>

          <div className="space-y-3">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
              style={{ border: `1px solid ${theme.border}`, background: theme.pageBg, color: theme.text }}
            />

            <div>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailError(""); }}
                placeholder="your@university.edu"
                className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
                style={{ border: `1px solid ${emailError ? "#dc2626" : theme.border}`, background: theme.pageBg, color: theme.text }}
              />
              {emailError && <p className="text-[11px] mt-1" style={{ color: "#dc2626" }}>{emailError}</p>}
            </div>

            <select
              value={issueType}
              onChange={e => setIssueType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
              style={{ border: `1px solid ${theme.border}`, background: theme.pageBg, color: theme.text }}
            >
              {CRAM_ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <textarea
              value={message}
              onChange={e => { setMessage(e.target.value); setSubmitError(""); }}
              placeholder={`What's on your mind about Ch ${chapterNumber || ""} — ${chapterName}?`}
              rows={4}
              className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
              style={{ border: `1px solid ${theme.border}`, background: theme.pageBg, color: theme.text, resize: "vertical" }}
            />
          </div>

          <button
            disabled={submitting || !email.trim() || !message.trim()}
            onClick={handleSubmit}
            className="w-full mt-4 py-2.5 rounded-lg text-[13px] font-bold text-white transition-all hover:brightness-95"
            style={{
              background: theme.navy,
              opacity: (submitting || !email.trim() || !message.trim()) ? 0.5 : 1,
              cursor: submitting ? "wait" : "pointer",
            }}
          >
            {submitting ? "Sending…" : "Send to Lee →"}
          </button>
          {submitError && <p className="text-[11px] mt-2" style={{ color: "#dc2626" }}>{submitError}</p>}
        </>
      )}
    </div>
  );
}

// ── About Lee Modal ─────────────────────────────────────────────────

function CramAboutLeeModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" style={{ borderRadius: 16 }}>
        <DialogHeader>
          <DialogTitle className="text-center">About Lee Ingram</DialogTitle>
          <DialogDescription className="sr-only">Bio and contact info</DialogDescription>
        </DialogHeader>
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
            <p className="text-[12px] leading-[1.6] mt-2" style={{ color: theme.textMuted }}>
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
      </DialogContent>
    </Dialog>
  );
}

// ── Floating Action Bar ─────────────────────────────────────────────

function CramFloatingActionBar({
  chapterId,
  chapterNumber,
  chapterName,
  courseDisplayName,
}: {
  chapterId: string;
  chapterNumber?: number;
  chapterName: string;
  courseDisplayName: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try { return localStorage.getItem("sa_cram_feedback_banner_dismissed") === "true"; } catch { return false; }
  });

  const shareUrl = `${STUDENT_BASE_URL}/cram/${chapterId}?preview=true`;

  const dismissBanner = () => {
    setBannerDismissed(true);
    try { localStorage.setItem("sa_cram_feedback_banner_dismissed", "true"); } catch {}
  };

  return (
    <>
      {/* Mobile: compact floating share button bottom-right */}
      <div className="block sm:hidden fixed z-30" style={{ bottom: 20, right: 16 }}>
        <button
          onClick={() => { copyToClipboard(shareUrl).then(() => toast.success("Preview link copied — share with classmates!")); }}
          className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[12px] font-bold shadow-lg"
          style={{ background: "#FFFFFF", color: "#3B82F6", border: `1px solid ${theme.border}` }}
        >
          <Share2 className="h-3.5 w-3.5" /> Share
        </button>
      </div>

      {/* Desktop: full action bar */}
      <div className="hidden sm:block fixed z-30" style={{ top: 56, right: 16 }}>
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "#FFFFFF",
            border: `1px solid ${theme.border}`,
            boxShadow: "0 2px 12px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          {/* Feedback banner */}
          {!bannerDismissed && !collapsed && (
            <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ borderBottom: `1px solid ${theme.border}` }}>
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
                <button
                  onClick={() => { copyToClipboard(shareUrl).then(() => toast.success("Preview link copied — share with classmates!")); }}
                  className="text-[11px] font-bold px-3 py-2 transition-all hover:scale-[1.03] active:scale-[0.97] whitespace-nowrap flex items-center gap-1.5"
                  style={{ color: "#3B82F6" }}
                >
                  <Share2 className="h-3 w-3" /> Share This
                </button>
                <div className="w-px h-5" style={{ background: theme.border }} />
                <button
                  onClick={() => setAboutOpen(true)}
                  className="text-[11px] font-semibold px-3 py-2 transition-colors hover:bg-gray-50 whitespace-nowrap"
                  style={{ color: theme.text }}
                >
                  About Lee Ingram
                </button>
                <div className="w-px h-5" style={{ background: theme.border }} />
                <button
                  onClick={() => setFeedbackOpen(true)}
                  className="text-[11px] font-semibold px-3 py-2 transition-colors hover:bg-gray-50 whitespace-nowrap flex items-center gap-1"
                  style={{ color: theme.textMuted }}
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
          </div>
        </div>
      </div>

      <CramAboutLeeModal open={aboutOpen} onOpenChange={setAboutOpen} />

      {/* Feedback modal */}
      {feedbackOpen && (
        <>
          <div onClick={() => setFeedbackOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "#ffffff", borderRadius: 12, padding: 24, width: "min(480px, 90vw)", maxHeight: "90vh", overflowY: "auto", zIndex: 101, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <CramFeedbackFormInline
              chapterId={chapterId}
              chapterNumber={chapterNumber}
              chapterName={chapterName}
              courseDisplayName={courseDisplayName}
              onClose={() => setFeedbackOpen(false)}
            />
          </div>
        </>
      )}
    </>
  );
}

// ── Inline Feedback Form (for modal in floating bar) ────────────────

function CramFeedbackFormInline({
  chapterId,
  chapterNumber,
  chapterName,
  courseDisplayName,
  onClose,
}: {
  chapterId: string;
  chapterNumber?: number;
  chapterName: string;
  courseDisplayName: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [name, setName] = useState("");
  const [issueType, setIssueType] = useState(CRAM_ISSUE_TYPES[0]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!isAllowedEmail(trimmedEmail)) {
      setEmailError("Please use your .edu school email address.");
      return;
    }
    setEmailError("");
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await (supabase as any).from("chapter_questions").insert({
        chapter_id: chapterId,
        student_email: email.trim(),
        question: message.trim(),
        issue_type: issueType === "General feedback" ? "feedback" : "issue",
        status: "new",
        student_name: name.trim() || null,
      });
      supabase.functions.invoke("send-issue-report", {
        body: {
          student_email: email.trim(),
          message: message.trim(),
          issue_type_label: issueType,
          course_name: courseDisplayName,
          chapter_number: chapterNumber || null,
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

  if (sent) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="h-8 w-8 mx-auto mb-3" style={{ color: "#22c55e" }} />
        <p className="text-[15px] font-bold" style={{ color: "#14213D" }}>Got it — thank you. — Lee</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[16px] font-bold" style={{ color: "#14213D" }}>Share Feedback</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
      </div>
      <p className="text-[12px] mb-4" style={{ color: "#999" }}>I read every message personally.</p>

      <div className="mb-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px" }}>
        <p className="text-[12px]" style={{ color: "#64748b" }}>
          Course: {courseDisplayName}<br />
          Chapter: Ch {chapterNumber || "?"} — {chapterName}
        </p>
      </div>

      <div className="space-y-3">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name"
          className="w-full px-3 py-2 rounded-md text-[13px] outline-none"
          style={{ border: "1px solid #e0e0e0" }}
        />
        <div>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setEmailError(""); }}
            placeholder="your@university.edu"
            className="w-full px-3 py-2 rounded-md text-[13px] outline-none"
            style={{ border: `1px solid ${emailError ? "#dc2626" : "#e0e0e0"}` }}
          />
          {emailError && <p className="text-[11px] mt-1" style={{ color: "#dc2626" }}>{emailError}</p>}
        </div>
        <select
          value={issueType}
          onChange={e => setIssueType(e.target.value)}
          className="w-full px-3 py-2 rounded-md text-[13px] outline-none"
          style={{ border: "1px solid #e0e0e0", background: "#fff" }}
        >
          {CRAM_ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={`What's on your mind about Ch ${chapterNumber || ""} — ${chapterName}?`}
          rows={4}
          className="w-full px-3 py-2 rounded-md text-[13px] outline-none"
          style={{ border: "1px solid #e0e0e0", resize: "vertical" }}
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={submitting || !email.trim() || !message.trim()}
        className="w-full mt-4 py-2.5 rounded-md text-[13px] font-bold text-white transition-opacity"
        style={{ background: "#14213D", opacity: submitting || !email.trim() || !message.trim() ? 0.5 : 1 }}
      >
        {submitting ? "Sending…" : "Send to Lee →"}
      </button>
    </>
  );
}
