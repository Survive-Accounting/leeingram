import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollUrl } from "@/hooks/useEnrollUrl";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle, ChevronLeft, ChevronRight, Eye, EyeOff, Lock, Shuffle } from "lucide-react";
import { JETooltip } from "@/components/JETooltip";
import { isCanonicalJE, type CanonicalJEPayload } from "@/lib/journalEntryParser";

const LOGO_URL = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf121ac35937c4d438ca.png";
const PREVIEW_LIMIT = 3;
const SOLUTIONS_INITIAL_SHOW = 4;

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
  name: string;
  expression: string;
  explanation?: string;
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
              name: name || formulaPart,
              expression: formulaPart,
              explanation,
            });
            return;
          }

          formulas.push({
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
          "id, asset_name, source_ref, asset_type, problem_title, important_formulas, supplementary_je_json, journal_entry_completed_json",
        )
        .eq("chapter_id", chapterId)
        .not("asset_approved_at", "is", null)
        .order("source_ref");

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

  const structuredFormulas = useMemo(() => {
    const seen = new Set<string>();
    const cards: FormulaCard[] = [];

    approvedAssets.forEach((asset) => {
      parseImportantFormulas(asset.important_formulas).forEach((formula) => {
        const key = formula.name.toLowerCase().trim().replace(/\s+/g, " ");
        if (!key || seen.has(key)) return;
        seen.add(key);
        cards.push(formula);
      });
    });

    return cards;
  }, [approvedAssets]);

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

  const visibleFormulas = useMemo(() => {
    return structuredFormulas.filter((formula) => {
      const id = slugify(formula.name);
      return isAdmin || !isItemHidden("formulas", id);
    });
  }, [structuredFormulas, isAdmin, isItemHidden]);

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

  const isTabExpanded = (key: string) => !!expandedTabs[key];
  const toggleTab = (key: string) => setExpandedTabs((prev) => ({ ...prev, [key]: !prev[key] }));

  // Current formula for flashcard
  const currentFormula = visibleFormulas[formulaIndex];
  const currentFormulaHidden = currentFormula ? isItemHidden("formulas", slugify(currentFormula.name)) : false;

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
                  <div
                    className="relative mx-auto flex min-h-[140px] flex-col justify-center rounded-xl"
                    style={{
                      background: theme.cardBg,
                      padding: "24px 32px",
                      boxShadow: "0 4px 20px rgba(15,23,42,0.06)",
                      border: `1px solid ${theme.border}`,
                      opacity: currentFormulaHidden ? 0.5 : 1,
                    }}
                  >
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => toggleItemHidden("formulas", slugify(currentFormula.name))}
                        className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-md"
                        style={{
                          background: currentFormulaHidden ? theme.warningBg : theme.mutedBg,
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
                        className="absolute left-3 top-3 rounded-full px-2 py-0.5 text-[9px] font-semibold"
                        style={{ background: theme.warningBg, color: theme.warningText }}
                      >
                        Hidden from students
                      </span>
                    )}

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
                        {formulaIndex + 1} of {visibleFormulas.length}
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

          {/* ──── Ask Lee ──── */}
          <section>
            <SectionHeaderWithToggle
              label="ASK LEE"
              isAdmin={isAdmin}
              sectionName="ask_lee"
              isVisible={isSectionVisible("ask_lee")}
              onToggle={toggleSectionVisibility}
            />
            {(isAdmin || isSectionVisible("ask_lee")) && (
              <div
                className="rounded-xl border p-5"
                style={{ borderColor: theme.border, background: theme.cardBg, opacity: isSectionVisible("ask_lee") ? 1 : 0.4 }}
              >
                <p className="text-[14px] font-semibold" style={{ color: theme.heading }}>
                  Have a question about this chapter?
                </p>
                <p className="mt-1 text-[13px]" style={{ color: theme.textMuted }}>
                  Send me your question and I'll get back to you — usually within a few hours.
                </p>
                <a
                  href={`mailto:lee@surviveaccounting.com?subject=Question about Ch ${chapter?.chapter_number || ""} — ${chapter?.chapter_name || ""}`}
                  className="mt-3 inline-block rounded-lg px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:brightness-90"
                  style={{ background: theme.navy }}
                >
                  Email Lee →
                </a>
              </div>
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
                className="rounded-xl border p-5"
                style={{ borderColor: theme.border, background: theme.cardBg, opacity: isSectionVisible("about_lee") ? 1 : 0.4 }}
              >
                <p className="text-[14px] font-semibold" style={{ color: theme.heading }}>
                  Hi, I'm Lee Ingram
                </p>
                <p className="mt-2 text-[13px] leading-relaxed" style={{ color: theme.textMuted }}>
                  I'm an accounting educator who's spent years tutoring students one-on-one. I built Survive Accounting because I saw the same patterns — students struggling with the same concepts, making the same mistakes, and not having access to clear, structured explanations.
                </p>
                <p className="mt-2 text-[13px] leading-relaxed" style={{ color: theme.textMuted }}>
                  Every solution, journal entry, and formula on this page was built to help you study smarter — not harder. If something doesn't make sense, reach out. I read every message.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
