/**
 * ChapterCramTool — public standalone page for practicing all JEs in a chapter.
 * Route: /cram/:chapterId or /cram?chapter_id=[uuid]
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollUrl } from "@/hooks/useEnrollUrl";
import { Lock, ExternalLink, Calendar, Eye, EyeOff, CheckCircle, Shuffle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { JETooltip } from "@/components/JETooltip";
import { isCanonicalJE, type CanonicalJEPayload } from "@/lib/journalEntryParser";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const LOGO_URL = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf121ac35937c4d438ca.png";
const AORAKI_URL = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/88d6f7c98cfeb62f0e339a7648214ace.png";
const LEE_HERO_URL = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/f10e00cd3462ea2638b6e6161236a92b.png";

const lightTheme = {
  pageBg: "#FFFFFF",
  cardBg: "#F8F9FA",
  text: "#1A1A1A",
  textMuted: "#666666",
  heading: "#131E35",
  border: "#E0E0E0",
  tableHeaderBg: "#1A2E55",
  tableAltBg: "#F8F9FA",
  watermarkOverlay: "rgba(255,255,255,0.93)",
};

type Theme = typeof lightTheme;

// ── Types ───────────────────────────────────────────────────────────

interface SupplementaryRow {
  account_name: string;
  side: "debit" | "credit";
  debit_credit_reason?: string;
  amount_source?: string;
}

interface SupplementaryEntry {
  label: string;
  rows: SupplementaryRow[];
}

interface CramCard {
  id: string;
  assetName: string;
  sourceRef: string;
  label: string;
  rows: SupplementaryRow[];
  // Matched completed entry rows (with amounts)
  completedRows: { account_name: string; debit: number | null; credit: number | null; debit_credit_reason?: string; amount_source?: string }[] | null;
}

// ── Match supplementary entries to completed entries ─────────────────

function matchCompletedEntry(
  suppEntry: SupplementaryEntry,
  completedJson: any
): CramCard["completedRows"] {
  if (!completedJson) return null;
  const parsed: CanonicalJEPayload = typeof completedJson === "string" ? JSON.parse(completedJson) : completedJson;
  if (!isCanonicalJE(parsed)) return null;

  const suppAccounts = new Set(suppEntry.rows.map(r => r.account_name.toLowerCase().trim()));

  // Find the entry_by_date with the best account overlap
  let bestMatch: any[] | null = null;
  let bestScore = 0;

  for (const section of parsed.scenario_sections) {
    for (const entry of section.entries_by_date) {
      const entryAccounts = new Set((entry.rows || []).map((r: any) => (r.account_name || "").toLowerCase().trim()));
      let overlap = 0;
      for (const acc of suppAccounts) {
        if (entryAccounts.has(acc)) overlap++;
      }
      if (overlap > bestScore) {
        bestScore = overlap;
        bestMatch = entry.rows;
      }
    }
  }

  if (bestScore === 0) return null;
  return bestMatch;
}

// ── Tiered Paywall Card ─────────────────────────────────────────────

function TieredPaywallCard({ enrollUrl, fullPassLink, chapterLink, chapterNumber, theme }: {
  enrollUrl: string; fullPassLink?: any; chapterLink?: any; chapterNumber?: number | null; theme: Theme;
}) {
  const now = new Date();
  const saleActive = fullPassLink?.sale_expires_at ? now < new Date(fullPassLink.sale_expires_at) : false;
  const fullPassUrl = fullPassLink?.url || enrollUrl;
  const chapterUrl = chapterLink?.url || enrollUrl;
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: "#FFFBF0" }}>
      <div className="text-center mb-2">
        <Lock className="h-6 w-6 mx-auto mb-2" style={{ color: "#14213D" }} />
        <p className="text-[15px] font-bold" style={{ color: "#14213D" }}>Unlock all journal entries with a Study Pass</p>
        <p className="text-[13px] mt-1" style={{ color: theme.textMuted }}>You've seen 3 free journal entries.</p>
      </div>
      <div className="relative rounded-xl px-6 py-6" style={{ background: "#14213D", border: "2px solid rgba(212,175,55,0.5)", boxShadow: "0 4px 24px rgba(20,33,61,0.25)" }}>
        <span className="absolute top-0 right-0 text-[10px] font-bold px-3 py-1.5 rounded-bl-xl rounded-tr-xl" style={{ background: "#CE1126", color: "#FFFFFF" }}>Best Value</span>
        <p className="font-bold text-[16px] text-white">Full Study Pass — Intermediate Accounting 2</p>
        <div className="flex items-baseline gap-2 mt-2">
          {saleActive && fullPassLink?.original_price_cents && <span className="line-through text-[14px]" style={{ color: "rgba(255,255,255,0.45)" }}>{formatPrice(fullPassLink.original_price_cents)}</span>}
          <span className="font-bold text-[24px] text-white">{formatPrice(fullPassLink?.price_cents || 12500)}</span>
          {saleActive && fullPassLink?.sale_label && <span className="text-[12px] font-semibold" style={{ color: "#00FFFF" }}>· {fullPassLink.sale_label}</span>}
        </div>
        <a href={fullPassUrl} target="_blank" rel="noopener noreferrer" className="block w-full mt-4 px-6 py-3 rounded-lg font-bold text-[15px] text-center text-white transition-all hover:brightness-90 active:scale-[0.98]" style={{ background: "#CE1126", height: 48, lineHeight: "24px" }}>Get Full Access →</a>
        <p className="text-[11px] mt-3 text-center" style={{ color: "rgba(255,255,255,0.55)" }}>7-day refund policy · Covers Ch 13–22 · Access expires after finals</p>
      </div>
      {chapterNumber && (
        <div className="rounded-xl px-6 py-5" style={{ border: `1px solid ${theme.border}`, background: theme.pageBg }}>
          <p className="font-bold text-[15px]" style={{ color: theme.text }}>Chapter {chapterNumber} Only</p>
          <p className="font-bold text-[22px] mt-1" style={{ color: theme.text }}>{formatPrice(chapterLink?.price_cents || 3000)}</p>
          <a href={chapterUrl} target="_blank" rel="noopener noreferrer" className="block w-full mt-3 px-6 py-3 rounded-lg font-bold text-[15px] text-center text-white transition-all hover:brightness-90 active:scale-[0.98]" style={{ background: "#006BA6", height: 48, lineHeight: "24px" }}>Buy Chapter {chapterNumber} →</a>
          <p className="text-[11px] mt-2.5 text-center" style={{ color: theme.textMuted }}>Covers Ch {chapterNumber} only · Access expires after finals</p>
        </div>
      )}
    </div>
  );
}

// ── JE Cram Card ────────────────────────────────────────────────────

function CramCardComponent({
  card,
  theme,
  isReviewed,
  onReview,
}: {
  card: CramCard;
  theme: Theme;
  isReviewed: boolean;
  onReview: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [flashGreen, setFlashGreen] = useState(false);

  const handleReview = () => {
    if (isReviewed) return;
    setFlashGreen(true);
    onReview();
    setTimeout(() => setFlashGreen(false), 600);
  };

  // Build display rows — merge supplementary structure with completed amounts
  const displayRows = card.rows.map((suppRow) => {
    const matchedRow = card.completedRows?.find(
      (cr) => cr.account_name.toLowerCase().trim() === suppRow.account_name.toLowerCase().trim()
    );
    const isCredit = suppRow.side === "credit";
    return {
      account_name: suppRow.account_name,
      isCredit,
      debit: matchedRow?.debit ?? null,
      credit: matchedRow?.credit ?? null,
      debit_credit_reason: matchedRow?.debit_credit_reason || suppRow.debit_credit_reason || "",
      amount_source: matchedRow?.amount_source || suppRow.amount_source || "",
    };
  });

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: theme.pageBg,
        border: `1px solid ${flashGreen ? "#22C55E" : isReviewed ? "#BBF7D0" : theme.border}`,
        borderLeftWidth: isReviewed ? 4 : 1,
        borderLeftColor: isReviewed ? "#22C55E" : undefined,
        boxShadow: flashGreen
          ? "0 0 20px rgba(34,197,94,0.2)"
          : "0 2px 12px rgba(0,0,0,0.04)",
      }}
    >
      {/* Header */}
      <div className="px-4 sm:px-5 pt-4 pb-2">
        <p className="text-[11px] font-mono" style={{ color: theme.textMuted }}>
          From {card.sourceRef || card.assetName}
        </p>
        <p className="text-[14px] font-bold mt-1 leading-[1.4]" style={{ color: theme.text }}>
          {card.label}
        </p>
      </div>

      {/* JE Table */}
      <div className="px-4 sm:px-5 pb-3">
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
              {displayRows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? theme.pageBg : theme.tableAltBg }}>
                  <td
                    className={`px-3 py-1.5 text-[13px] ${row.isCredit ? "pl-10" : ""}`}
                    style={{ color: theme.text }}
                  >
                    {row.account_name}
                    {revealed && row.debit_credit_reason && (
                      <JETooltip text={row.debit_credit_reason} variant="solutions" />
                    )}
                  </td>
                  <td className="text-right px-3 py-1.5 text-[13px] font-mono" style={{ color: revealed ? theme.text : theme.textMuted }}>
                    {!row.isCredit ? (
                      revealed ? (
                        row.debit != null && row.debit !== 0 ? (
                          <span>
                            {Number(row.debit).toLocaleString("en-US")}
                            {row.amount_source && <JETooltip text={row.amount_source} variant="solutions" />}
                          </span>
                        ) : "???"
                      ) : "???"
                    ) : ""}
                  </td>
                  <td className="text-right px-3 py-1.5 text-[13px] font-mono" style={{ color: revealed ? theme.text : theme.textMuted }}>
                    {row.isCredit ? (
                      revealed ? (
                        row.credit != null && row.credit !== 0 ? (
                          <span>
                            {Number(row.credit).toLocaleString("en-US")}
                            {row.amount_source && <JETooltip text={row.amount_source} variant="solutions" />}
                          </span>
                        ) : "???"
                      ) : "???"
                    ) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 sm:px-5 pb-4 flex items-center gap-3">
        <button
          onClick={() => setRevealed(!revealed)}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold transition-all hover:brightness-95 active:scale-[0.98]"
          style={{
            background: revealed ? theme.cardBg : "#FEF3C7",
            color: revealed ? theme.textMuted : "#92400E",
            border: `1px solid ${revealed ? theme.border : "#FCD34D"}`,
          }}
        >
          {revealed ? <><EyeOff className="h-3.5 w-3.5" /> Hide Amounts</> : <><Eye className="h-3.5 w-3.5" /> Reveal Amounts</>}
        </button>
        <button
          onClick={handleReview}
          disabled={isReviewed}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold transition-all hover:brightness-95 active:scale-[0.98]"
          style={{
            background: isReviewed ? "#F0FDF4" : "#DCFCE7",
            color: isReviewed ? "#86EFAC" : "#166534",
            border: `1px solid ${isReviewed ? "#BBF7D0" : "#86EFAC"}`,
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

// ── About Lee Section ───────────────────────────────────────────────

function AboutLeeSection({ theme }: { theme: Theme }) {
  return (
    <div className="rounded-xl px-5 py-6 flex flex-col items-center text-center gap-4" style={{ background: theme.pageBg, border: `1px solid ${theme.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
      <img
        src={LEE_HERO_URL}
        alt="Lee Ingram"
        className="w-full"
        style={{ objectFit: "contain", borderRadius: 12, maxHeight: 280 }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <div className="max-w-[400px]">
        <p className="text-[13px] leading-[1.6]" style={{ color: theme.text }}>
          Founder of{" "}
          <a href="https://surviveaccounting.com" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline" style={{ color: "#3B82F6" }}>
            SurviveAccounting.com
          </a>.
          <br />
          Tutoring entrepreneur since 2015.
          <br />
          Hope this helps you feel more confident going into your exam.
          <br />
          <span className="italic">— Lee</span>
        </p>
        <p className="text-[12px] leading-[1.6]" style={{ color: theme.textMuted }}>
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
  );
}

// ── MAIN COMPONENT ──────────────────────────────────────────────────

export default function ChapterCramTool() {
  const { chapterId: paramChapterId } = useParams<{ chapterId: string }>();
  const [searchParams] = useSearchParams();
  const queryChapterId = searchParams.get("chapter_id") || "";
  const chapterId = paramChapterId || queryChapterId;
  const isPreview = searchParams.get("preview") === "true";
  const enrollUrl = useEnrollUrl();
  const t = lightTheme;

  const [reviewedSet, setReviewedSet] = useState<Set<string>>(new Set());
  const [shuffledOrder, setShuffledOrder] = useState<number[] | null>(null);

  // Fetch chapter info
  const { data: chapter } = useQuery({
    queryKey: ["cram-chapter", chapterId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id, courses!chapters_course_id_fkey(code, course_name)")
        .eq("id", chapterId)
        .single();
      return data;
    },
    enabled: !!chapterId,
  });

  // Fetch all assets with supplementary_je_json
  const { data: assets, isLoading } = useQuery({
    queryKey: ["cram-assets", chapterId],
    queryFn: async () => {
      const { data } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, source_ref, supplementary_je_json, journal_entry_completed_json")
        .eq("chapter_id", chapterId)
        .not("supplementary_je_json", "is", null)
        .order("source_ref");
      return data || [];
    },
    enabled: !!chapterId,
  });

  // Fetch payment links for paywall
  const { data: paymentLinks } = useQuery({
    queryKey: ["payment-links-cram"],
    queryFn: async () => {
      const { data } = await supabase.from("payment_links").select("*").eq("is_active", true);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: isPreview,
  });

  // Build cram cards
  const cramCards: CramCard[] = useMemo(() => {
    if (!assets) return [];
    const cards: CramCard[] = [];
    for (const asset of assets) {
      const suppJson = typeof asset.supplementary_je_json === "string"
        ? JSON.parse(asset.supplementary_je_json)
        : asset.supplementary_je_json;
      if (!suppJson?.entries) continue;
      for (let i = 0; i < suppJson.entries.length; i++) {
        const entry: SupplementaryEntry = suppJson.entries[i];
        if (!entry.rows?.length) continue;
        const completedRows = matchCompletedEntry(entry, asset.journal_entry_completed_json);
        cards.push({
          id: `${asset.id}-${i}`,
          assetName: asset.asset_name,
          sourceRef: asset.source_ref || asset.asset_name,
          label: entry.label,
          rows: entry.rows,
          completedRows,
        });
      }
    }
    return cards;
  }, [assets]);

  // Apply shuffle order
  const displayCards = useMemo(() => {
    if (!shuffledOrder) return cramCards;
    return shuffledOrder.map(i => cramCards[i]).filter(Boolean);
  }, [cramCards, shuffledOrder]);

  const handleShuffle = useCallback(() => {
    const indices = Array.from({ length: cramCards.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffledOrder(indices);
    setReviewedSet(new Set());
  }, [cramCards.length]);

  const handleReview = (cardId: string) => {
    setReviewedSet(prev => new Set(prev).add(cardId));
  };

  const reviewedCount = reviewedSet.size;
  const totalCards = cramCards.length;
  const progressPercent = totalCards > 0 ? (reviewedCount / totalCards) * 100 : 0;

  // Page title
  useEffect(() => {
    if (!chapter) return;
    document.title = `Chapter ${(chapter as any).chapter_number} Cram Tool — Survive Accounting`;
    return () => { document.title = "Survive Accounting"; };
  }, [chapter]);

  const courseCode = (chapter as any)?.courses?.code || "";
  const courseDisplayName = (() => {
    const code = courseCode.toUpperCase();
    if (code === "IA2") return "Intermediate Accounting 2";
    if (code === "IA1") return "Intermediate Accounting 1";
    if (code === "MA2") return "Managerial Accounting";
    if (code === "FA1") return "Financial Accounting";
    return (chapter as any)?.courses?.course_name || courseCode;
  })();

  const chapterNum = (chapter as any)?.chapter_number || null;
  const chapterName = (chapter as any)?.chapter_name || "";
  const fullPassLink = (paymentLinks || []).find((l: any) => l.link_type === "full_pass" && l.course_id === (chapter as any)?.course_id);
  const chapterLink = (paymentLinks || []).find((l: any) => l.link_type === "chapter" && l.chapter_id === chapterId);

  const PREVIEW_LIMIT = 3;

  if (!chapterId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: t.pageBg }}>
        <p className="text-[16px]" style={{ color: t.text }}>No chapter specified. Use /cram/[chapterId] or ?chapter_id=[uuid].</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: t.pageBg }}>
        <div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: t.border, borderTopColor: t.text }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative" style={{ background: t.pageBg }}>
      {/* Watermark */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${AORAKI_URL})`, opacity: 0.06 }} />
        <div className="absolute inset-0" style={{ background: t.watermarkOverlay }} />
      </div>

      {/* Navy Header */}
      <header className="relative sticky top-0" style={{ zIndex: 20, background: "#14213D", height: 48 }}>
        <div className="mx-auto px-4 sm:px-6 py-2.5 flex items-center" style={{ maxWidth: 680 }}>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img src={LOGO_URL} alt="Survive Accounting" className="h-7 sm:h-8 object-contain shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span className="text-[11px] sm:text-[12px] text-white/50 truncate">Created by Lee Ingram</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative mx-auto px-4 sm:px-6 py-6 sm:py-8" style={{ zIndex: 5, maxWidth: 680 }}>

        {/* Chapter Header */}
        <div className="mb-6">
          {courseDisplayName && (
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase" style={{ color: t.textMuted }}>
              {courseDisplayName}
            </p>
          )}
          <h1 className="text-[22px] font-bold mt-1" style={{ color: t.heading }}>
            {chapterNum ? `Chapter ${chapterNum}` : ""}{chapterName ? ` — ${chapterName}` : ""}
          </h1>
          <p className="text-[14px] mt-0.5" style={{ color: t.textMuted }}>Chapter Cram Tool</p>
          <p className="text-[13px] mt-1" style={{ color: t.textMuted }}>
            {totalCards} journal {totalCards === 1 ? "entry" : "entries"} to practice
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-4 rounded-xl px-4 py-3" style={{ background: t.cardBg, border: `1px solid ${t.border}` }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] font-semibold" style={{ color: t.text }}>
              {reviewedCount} of {totalCards} reviewed
            </p>
            <button
              onClick={handleShuffle}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all hover:brightness-95 active:scale-[0.97]"
              style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}
            >
              <Shuffle className="h-3 w-3" /> Shuffle
            </button>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "#E5E7EB" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
                background: progressPercent === 100 ? "#22C55E" : "#3B82F6",
              }}
            />
          </div>
        </div>

        {totalCards === 0 && (
          <div className="rounded-xl px-5 py-8 text-center" style={{ background: t.cardBg, border: `1px solid ${t.border}` }}>
            <p className="text-[14px]" style={{ color: t.textMuted }}>No journal entry data available for this chapter yet.</p>
          </div>
        )}

        {/* Cards */}
        <div className="space-y-4">
          {displayCards.map((card, idx) => {
            if (isPreview && idx >= PREVIEW_LIMIT) return null;
            return (
              <CramCardComponent
                key={card.id}
                card={card}
                theme={t}
                isReviewed={reviewedSet.has(card.id)}
                onReview={() => handleReview(card.id)}
              />
            );
          })}

          {/* Paywall after 3 cards in preview mode */}
          {isPreview && totalCards > PREVIEW_LIMIT && (
            <TieredPaywallCard
              enrollUrl={enrollUrl}
              fullPassLink={fullPassLink}
              chapterLink={chapterLink}
              chapterNumber={chapterNum}
              theme={t}
            />
          )}
        </div>

        {/* About Lee (at bottom) */}
        <div className="mt-10 mb-8">
          <AboutLeeSection theme={t} />
        </div>
      </main>
    </div>
  );
}
