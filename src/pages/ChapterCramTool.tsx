/**
 * ChapterCramTool — "Survive This Chapter" hub page.
 * Route: /cram/:chapterId or /cram?chapter_id=[uuid]
 *
 * Sections:
 *   1. Chapter Tools (Cram Tool card, Key Formulas, Exam Traps)
 *   2. Topic Breakdown (if topics are locked)
 *   3. JE Cram Tool (existing card deck)
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollUrl } from "@/hooks/useEnrollUrl";
import { useAuth } from "@/contexts/AuthContext";
import { Lock, ExternalLink, Calendar, Eye, EyeOff, CheckCircle, Shuffle, ChevronDown, ChevronUp, ChevronRight, Trash2, CheckCircle2 } from "lucide-react";
import { JETooltip } from "@/components/JETooltip";
import { isCanonicalJE, type CanonicalJEPayload } from "@/lib/journalEntryParser";

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

// ── Section Label ───────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold tracking-[0.15em] uppercase mb-3" style={{ color: "#94A3B8" }}>
      {children}
    </p>
  );
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

// ── Mini Paywall (for formulas / exam traps) ────────────────────────

function MiniPaywall({ enrollUrl, theme }: { enrollUrl: string; theme: Theme }) {
  return (
    <div className="rounded-lg p-4 text-center" style={{ background: "#FFFBF0", border: "1px solid #FDE68A" }}>
      <Lock className="h-5 w-5 mx-auto mb-2" style={{ color: "#14213D" }} />
      <p className="text-[13px] font-bold" style={{ color: "#14213D" }}>Unlock all content with a Study Pass</p>
      <a href={enrollUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 px-5 py-2 rounded-lg font-bold text-[13px] text-white transition-all hover:brightness-90" style={{ background: "#14213D" }}>Get Access →</a>
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
      <div className="px-4 sm:px-5 pt-4 pb-2">
        <p className="text-[11px] font-mono" style={{ color: theme.textMuted }}>
          From {card.sourceRef || card.assetName}
        </p>
        <p className="text-[14px] font-bold mt-1 leading-[1.4]" style={{ color: theme.text }}>
          {card.label}
        </p>
      </div>

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
          Hope my study tools give you more confidence going into your exam 👍
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

// ── Chapter Tool Card ───────────────────────────────────────────────

function ChapterToolCard({ icon, title, subtitle, bg, borderColor, buttonLabel, onClick, disabled }: {
  icon: string; title: string; subtitle: string; bg: string; borderColor: string; buttonLabel: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2" style={{ background: bg, border: `1px solid ${borderColor}`, borderRadius: 10, padding: 16, opacity: disabled ? 0.5 : 1 }}>
      <span className="text-[20px]">{icon}</span>
      <p className="text-[14px] font-bold" style={{ color: "#14213D" }}>{title}</p>
      <p className="text-[12px]" style={{ color: "#64748B" }}>{subtitle}</p>
      <button
        onClick={onClick}
        disabled={disabled}
        className="w-full text-[13px] font-semibold transition-all hover:brightness-95 active:scale-[0.98]"
        style={{ background: disabled ? "#E2E8F0" : "#14213D", color: disabled ? "#94A3B8" : "#FFFFFF", cursor: disabled ? "default" : "pointer", borderRadius: 8, padding: "8px 16px", marginTop: 12 }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

// ── Source ref sorting helper ────────────────────────────────────────

const PREFIX_ORDER: Record<string, number> = { BE: 0, QS: 1, E: 2, EX: 2, P: 3 };

function parseSourceRef(ref: string): { prefix: string; num: number; sub: number } {
  const m = ref.match(/^([A-Z]+)(\d+)(?:\.(\d+))?/i);
  if (!m) return { prefix: "ZZ", num: 9999, sub: 0 };
  return { prefix: m[1].toUpperCase(), num: parseInt(m[2], 10), sub: m[3] ? parseInt(m[3], 10) : 0 };
}

function sortBySourceRef(a: any, b: any): number {
  const pa = parseSourceRef(a.source_ref || "");
  const pb = parseSourceRef(b.source_ref || "");
  const oa = PREFIX_ORDER[pa.prefix] ?? 99;
  const ob = PREFIX_ORDER[pb.prefix] ?? 99;
  if (oa !== ob) return oa - ob;
  if (pa.num !== pb.num) return pa.num - pb.num;
  return pa.sub - pb.sub;
}

// ── MAIN COMPONENT ──────────────────────────────────────────────────

export default function ChapterCramTool() {
  const { chapterId: paramChapterId } = useParams<{ chapterId: string }>();
  const [searchParams] = useSearchParams();
  const queryChapterId = searchParams.get("chapter_id") || "";
  const chapterId = paramChapterId || queryChapterId;
  const isPreview = searchParams.get("preview") === "true";
  const enrollUrl = useEnrollUrl();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const t = lightTheme;

  const [reviewedSet, setReviewedSet] = useState<Set<string>>(new Set());
  const [shuffledOrder, setShuffledOrder] = useState<number[] | null>(null);
  const [formulasOpen, setFormulasOpen] = useState(false);
  const [trapsOpen, setTrapsOpen] = useState(false);
  const [videoElapsed, setVideoElapsed] = useState(0);
  const [openTopicId, setOpenTopicId] = useState<string | null>(null);
  const [solutionsTab, setSolutionsTab] = useState<"be" | "ex" | "p">("be");
  const [requestedTopics, setRequestedTopics] = useState<Set<string>>(new Set());

  // Ask Lee form state
  const [askEmail, setAskEmail] = useState("");
  const [askQuestion, setAskQuestion] = useState("");
  const [askSending, setAskSending] = useState(false);
  const [askSent, setAskSent] = useState(false);
  const [askError, setAskError] = useState("");
  const [askEmailError, setAskEmailError] = useState("");

  // Admin video manager state
  const [vmType, setVmType] = useState<"intro" | "showcase" | "topic" | "legacy">("intro");
  const [vmTopicId, setVmTopicId] = useState<string>("");
  const [vmVimeoUrl, setVmVimeoUrl] = useState("");
  const [vmThumbUrl, setVmThumbUrl] = useState("");
  const [vmTitle, setVmTitle] = useState("");
  const [vmDate, setVmDate] = useState("");
  const [vmSaving, setVmSaving] = useState(false);
  const [vmDeleteConfirm, setVmDeleteConfirm] = useState<string | null>(null);

  // Check if admin
  const { data: isAdmin } = useQuery({
    queryKey: ["cram-admin-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase.from("va_accounts").select("role").eq("user_id", user.id).maybeSingle();
      if (data?.role === "admin" || data?.role === "lead_va") return true;
      // Fallback: check if user email is admin
      return user.email === "lee@surviveaccounting.com";
    },
    enabled: !!user?.id,
  });

  // Fetch chapter info
  const { data: chapter } = useQuery({
    queryKey: ["cram-chapter", chapterId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id, topics_locked, courses!chapters_course_id_fkey(code, course_name)")
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

  // Fetch chapter topics
  const { data: topics } = useQuery({
    queryKey: ["cram-topics", chapterId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapter_topics")
        .select("id, topic_name, topic_number, topic_description, lw_quiz_link, lw_video_link, is_supplementary, is_active")
        .eq("chapter_id", chapterId)
        .eq("is_active", true)
        .order("topic_number");
      return data || [];
    },
    enabled: !!chapterId,
  });

  // Fetch formulas
  const { data: formulasData } = useQuery({
    queryKey: ["cram-formulas", chapterId],
    queryFn: async () => {
      const { data } = await supabase
        .from("teaching_assets")
        .select("important_formulas")
        .eq("chapter_id", chapterId)
        .not("important_formulas", "is", null)
        .neq("important_formulas", "")
        .limit(10);
      return data || [];
    },
    enabled: !!chapterId,
  });

  // Fetch exam traps
  const { data: trapsData } = useQuery({
    queryKey: ["cram-traps", chapterId],
    queryFn: async () => {
      const { data } = await supabase
        .from("teaching_assets")
        .select("exam_traps")
        .eq("chapter_id", chapterId)
        .not("exam_traps", "is", null)
        .neq("exam_traps", "")
        .limit(10);
      return data || [];
    },
    enabled: !!chapterId,
  });

  // Fetch topic asset counts
  const { data: topicAssets } = useQuery({
    queryKey: ["cram-topic-assets", chapterId],
    queryFn: async () => {
      const { data } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, source_ref, topic_id")
        .eq("chapter_id", chapterId)
        .not("topic_id", "is", null)
        .order("source_ref");
      return data || [];
    },
    enabled: !!chapterId,
  });

  // Fetch chapter videos
  const { data: chapterVideos } = useQuery({
    queryKey: ["cram-chapter-videos", chapterId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("chapter_videos")
        .select("*")
        .eq("chapter_id", chapterId)
        .eq("is_active", true)
        .order("recorded_at", { ascending: false });
      return data || [];
    },
    enabled: !!chapterId,
  });

  // Fetch approved teaching assets for this chapter
  const { data: approvedAssets } = useQuery({
    queryKey: ["cram-approved-assets", chapterId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("teaching_assets")
        .select("id, asset_name, source_ref, asset_type, topic_id, problem_title")
        .eq("chapter_id", chapterId)
        .eq("status", "approved")
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

  // Deduplicate formulas and traps
  const formulas = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const row of formulasData || []) {
      const text = (row as any).important_formulas?.trim();
      if (text && !seen.has(text)) { seen.add(text); result.push(text); }
    }
    return result;
  }, [formulasData]);

  const traps = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const row of trapsData || []) {
      const text = (row as any).exam_traps?.trim();
      if (text && !seen.has(text)) { seen.add(text); result.push(text); }
    }
    return result;
  }, [trapsData]);

  // Topic asset counts + first asset
  const topicCountMap = useMemo(() => {
    const map: Record<string, { count: number; firstName: string | null }> = {};
    for (const a of topicAssets || []) {
      const tid = (a as any).topic_id;
      if (!tid) continue;
      if (!map[tid]) map[tid] = { count: 0, firstName: null };
      map[tid].count++;
      if (!map[tid].firstName) map[tid].firstName = (a as any).asset_name;
    }
    return map;
  }, [topicAssets]);

  // Map topic_id → chapter_videos for that topic
  const topicVideosMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const v of (chapterVideos as any[] || [])) {
      if (!v.topic_id) continue;
      if (!map[v.topic_id]) map[v.topic_id] = [];
      map[v.topic_id].push(v);
    }
    return map;
  }, [chapterVideos]);

  // Map topic_id → sorted approved assets for accordion
  const topicAssetsMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const a of (approvedAssets as any[] || [])) {
      if (!a.topic_id) continue;
      if (!map[a.topic_id]) map[a.topic_id] = [];
      map[a.topic_id].push(a);
    }
    for (const key of Object.keys(map)) {
      map[key].sort(sortBySourceRef);
    }
    return map;
  }, [approvedAssets]);

  // Non-supplementary topics
  const displayTopics = useMemo(() => {
    return (topics || []).filter((t: any) => !t.is_supplementary);
  }, [topics]);

  const anyTopicMissingVideo = useMemo(() => {
    return displayTopics.some((t: any) => !t.lw_video_link);
  }, [displayTopics]);

  // Solutions library filtered assets
  const solutionsFiltered = useMemo(() => {
    const all = (approvedAssets as any[] || []).slice().sort(sortBySourceRef);
    return all.filter((a: any) => {
      const at = (a.asset_type || "").toLowerCase();
      const ref = (a.source_ref || "").toUpperCase();
      const parsed = parseSourceRef(ref);
      const isBE = at === "be" || at === "qs" || at === "brief_exercise" || at === "brief exercise" || parsed.prefix === "BE" || parsed.prefix === "QS";
      const isEX = at === "e" || at === "ex" || at === "exercise" || parsed.prefix === "E" || parsed.prefix === "EX";
      const isP = at === "p" || at === "problem" || parsed.prefix === "P";
      if (solutionsTab === "be") return isBE || (!isEX && !isP); // fallback to BE
      if (solutionsTab === "ex") return isEX;
      if (solutionsTab === "p") return isP;
      return false;
    });
  }, [approvedAssets, solutionsTab]);

  // Handle topic video request
  const handleRequestTopicVideo = async (topicId: string) => {
    try {
      await supabase.from("topic_video_requests").insert({ topic_id: topicId, user_agent: navigator.userAgent });
    } catch { /* noop */ }
    setRequestedTopics(prev => new Set(prev).add(topicId));
  };

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
    document.title = `Survive This Chapter — Ch ${(chapter as any).chapter_number} — Survive Accounting`;
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
  const topicsLocked = (chapter as any)?.topics_locked === true;
  const fullPassLink = (paymentLinks || []).find((l: any) => l.link_type === "full_pass" && l.course_id === (chapter as any)?.course_id);
  const chapterLink = (paymentLinks || []).find((l: any) => l.link_type === "chapter" && l.chapter_id === chapterId);

  // Find intro video
  const introVideo = useMemo(() => {
    return (chapterVideos as any[] || []).find((v: any) => v.video_type === "intro") || null;
  }, [chapterVideos]);

  // 30-second paywall timer for intro video
  useEffect(() => {
    if (!introVideo || !isPreview) return;
    const interval = setInterval(() => {
      setVideoElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [introVideo, isPreview]);

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

        {/* Page Header */}
        <div className="mb-6">
          {courseDisplayName && (
            <p className="text-[9px] font-bold tracking-[0.15em] uppercase" style={{ color: "#94a3b8" }}>
              {courseDisplayName}
            </p>
          )}
          <h1 className="text-[24px] font-bold mt-1" style={{ color: "#14213D" }}>
            Survive This Chapter
          </h1>
          <p className="text-[14px] font-bold mt-0.5" style={{ color: "#14213D" }}>
            {chapterNum ? `Ch ${chapterNum}` : ""}{chapterName ? ` — ${chapterName}` : ""}
          </p>
        </div>

        {/* ─── CHAPTER INTRO VIDEO ─── */}
        {introVideo && (
          <div className="mb-8">
            <div className="relative" style={{ borderRadius: 12, overflow: "hidden", background: "#000", width: "100%", paddingTop: "56.25%" }}>
              <iframe
                src={`${introVideo.vimeo_embed_url}?autoplay=0&title=0&byline=0&portrait=0`}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
              {/* 30-second paywall overlay for free users */}
              {isPreview && videoElapsed >= 30 && (
                <div
                  className="flex flex-col items-center justify-end"
                  style={{
                    position: "absolute",
                    top: "35%",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "linear-gradient(transparent, rgba(20,33,61,0.97) 40%)",
                    paddingBottom: 24,
                    zIndex: 10,
                  }}
                >
                  <Lock className="h-5 w-5 text-white" />
                  <p className="text-[13px] font-bold text-white mt-2">Continue watching with a Study Pass</p>
                  <div className="mt-4 w-full px-4">
                    <TieredPaywallCard enrollUrl={enrollUrl} fullPassLink={fullPassLink} chapterLink={chapterLink} chapterNumber={chapterNum} theme={t} />
                  </div>
                </div>
              )}
            </div>
            {introVideo.recorded_at && (
              <p className="text-[10px] mt-2" style={{ color: "#94a3b8" }}>
                Recorded {new Date(introVideo.recorded_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
            )}
            {introVideo.title && (
              <p className="text-[13px] font-medium mt-1" style={{ color: "#14213D" }}>{introVideo.title}</p>
            )}
          </div>
        )}

        {/* ─── CHAPTER TOOLS ─── */}
        <div className="mb-8" style={{ marginTop: 32 }}>
          <SectionLabel>Chapter Tools</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ChapterToolCard
              icon="📚"
              title="Chapter Cram Tool"
              subtitle={totalCards > 0 ? `${totalCards} journal ${totalCards === 1 ? "entry" : "entries"} to drill` : "No journal entries for this chapter"}
              bg="#f0fdf4"
              borderColor="#bbf7d0"
              buttonLabel="Start Drilling →"
              onClick={() => document.getElementById("je-cram-tool")?.scrollIntoView({ behavior: "smooth" })}
              disabled={totalCards === 0}
            />
            <ChapterToolCard
              icon="⚡"
              title="Key Formulas"
              subtitle={formulas.length > 0 ? `${formulas.length} formula${formulas.length !== 1 ? "s" : ""}` : "No formulas yet"}
              bg={formulas.length > 0 ? "#fffbeb" : "#f8fafc"}
              borderColor={formulas.length > 0 ? "#fde68a" : "#e2e8f0"}
              buttonLabel={formulasOpen ? "Hide Formulas" : "View Formulas →"}
              onClick={() => { setFormulasOpen(!formulasOpen); if (!formulasOpen) setTrapsOpen(false); }}
              disabled={formulas.length === 0}
            />
            <ChapterToolCard
              icon="⚠️"
              title="Exam Traps"
              subtitle={traps.length > 0 ? `${traps.length} common mistake${traps.length !== 1 ? "s" : ""}` : "No traps yet"}
              bg={traps.length > 0 ? "#fef2f2" : "#f8fafc"}
              borderColor={traps.length > 0 ? "#fecaca" : "#e2e8f0"}
              buttonLabel={trapsOpen ? "Hide Traps" : "View Traps →"}
              onClick={() => { setTrapsOpen(!trapsOpen); if (!trapsOpen) setFormulasOpen(false); }}
              disabled={traps.length === 0}
            />
          </div>

          {/* Formulas accordion */}
          {formulasOpen && formulas.length > 0 && (
            <div className="mt-3 space-y-2">
              {formulas.map((f, idx) => {
                if (isPreview && idx >= 1) return null;
                return (
                  <div key={idx} className="font-mono text-[12px] leading-[1.6]" style={{ background: "#fffbeb", color: "#1e293b", padding: "10px 14px", borderRadius: 6, borderLeft: "3px solid #d97706" }}>
                    {f}
                  </div>
                );
              })}
              {isPreview && formulas.length > 1 && (
                <TieredPaywallCard enrollUrl={enrollUrl} fullPassLink={fullPassLink} chapterLink={chapterLink} chapterNumber={chapterNum} theme={t} />
              )}
            </div>
          )}

          {/* Traps accordion */}
          {trapsOpen && traps.length > 0 && (
            <div className="mt-3 space-y-2">
              {traps.map((trap, idx) => {
                if (isPreview && idx >= 1) return null;
                return (
                  <div key={idx} className="text-[12px] leading-[1.6]" style={{ background: "#fef2f2", color: "#1e293b", padding: "10px 14px", borderRadius: 6, borderLeft: "3px solid #dc2626" }}>
                    {trap}
                  </div>
                );
              })}
              {isPreview && traps.length > 1 && (
                <TieredPaywallCard enrollUrl={enrollUrl} fullPassLink={fullPassLink} chapterLink={chapterLink} chapterNumber={chapterNum} theme={t} />
              )}
            </div>
          )}
        </div>

        {/* ─── CHAPTER VIDEOS (Showcases) ─── */}
        {(() => {
          const showcaseVideos = (chapterVideos as any[] || [])
            .filter((v: any) => v.video_type === "showcase")
            .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          if (showcaseVideos.length === 0) return null;
          return (
            <div style={{ marginTop: 32 }} className="mb-8">
              <SectionLabel>Chapter Videos</SectionLabel>
              <div className="space-y-6">
                {showcaseVideos.map((vid: any) => (
                  <div key={vid.id}>
                    {vid.title && (
                      <p className="text-[13px] font-bold mb-2" style={{ color: "#14213D" }}>{vid.title}</p>
                    )}
                    {isPreview ? (
                      <div className="flex flex-col items-center justify-center" style={{ background: "#1e293b", borderRadius: 12, aspectRatio: "16/9" }}>
                        <Lock className="h-6 w-6 text-white" />
                        <p className="text-[14px] font-bold text-white mt-2">Unlock with Study Pass</p>
                        <div className="mt-4 w-full px-4">
                          <TieredPaywallCard enrollUrl={enrollUrl} fullPassLink={fullPassLink} chapterLink={chapterLink} chapterNumber={chapterNum} theme={t} />
                        </div>
                      </div>
                    ) : (
                      <div className="relative" style={{ borderRadius: 12, overflow: "hidden", background: "#000", width: "100%", paddingTop: "56.25%" }}>
                        <iframe
                          src={vid.vimeo_embed_url}
                          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ─── SECTION 3: TOPIC ACCORDION ─── */}
        {topicsLocked && displayTopics.length > 0 && (
          <div style={{ marginTop: 32 }} className="mb-8">
            <SectionLabel>Topics</SectionLabel>
            {anyTopicMissingVideo && (
              <p className="text-[11px] italic mb-3" style={{ color: "#94a3b8" }}>
                🎬 Videos are being added throughout Spring 2026. Topics with quizzes and solutions are fully ready now.
              </p>
            )}
            <div className="space-y-2">
              {displayTopics.map((topic: any) => {
                const isOpen = openTopicId === topic.id;
                const topicVids = topicVideosMap[topic.id] || [];
                const topicProblems = topicAssetsMap[topic.id] || [];
                const problemCount = topicCountMap[topic.id]?.count || 0;
                const hasQuiz = !!topic.lw_quiz_link;
                const hasTopicVideo = topicVids.length > 0;

                return (
                  <div key={topic.id}>
                    {/* Accordion Header */}
                    <button
                      onClick={() => setOpenTopicId(isOpen ? null : topic.id)}
                      className="w-full flex items-center justify-between transition-colors"
                      style={{
                        height: 52,
                        background: isOpen ? "#f8fafc" : "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: isOpen ? "8px 8px 0 0" : 8,
                        padding: "0 16px",
                        cursor: "pointer",
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="shrink-0 text-[10px] font-bold text-white" style={{ background: "#14213D", borderRadius: 20, padding: "2px 8px" }}>
                          {topic.topic_number || "—"}
                        </span>
                        <span className="text-[14px] font-bold truncate" style={{ color: "#14213D" }}>{topic.topic_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasQuiz && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }}>Quiz</span>
                        )}
                        {hasTopicVideo && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>Video</span>
                        )}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0" }}>
                          {problemCount} Problem{problemCount !== 1 ? "s" : ""}
                        </span>
                        <ChevronRight
                          className="h-4 w-4 transition-transform duration-200"
                          style={{ color: "#94a3b8", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                        />
                      </div>
                    </button>

                    {/* Accordion Body */}
                    {isOpen && (
                      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 8px 8px", padding: 16 }}>
                        {/* ── VIDEO ── */}
                        <p className="text-[8px] font-bold tracking-[0.15em] uppercase mb-2.5" style={{ color: "#94a3b8" }}>VIDEO</p>
                        {hasTopicVideo ? (
                          isPreview ? (
                            <div className="flex items-center justify-center" style={{ background: "#1e293b", borderRadius: 8, aspectRatio: "16/9" }}>
                              <div className="text-center">
                                <Lock className="h-5 w-5 mx-auto text-white" />
                                <p className="text-[12px] text-white mt-2">Unlock with Study Pass</p>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="relative" style={{ borderRadius: 8, overflow: "hidden", background: "#000", width: "100%", paddingTop: "56.25%" }}>
                                <iframe
                                  src={`${topicVids[0].vimeo_embed_url}?autoplay=0&title=0&byline=0&portrait=0`}
                                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                                  allow="autoplay; fullscreen; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                              {topicVids[0].title && <p className="text-[12px] mt-2" style={{ color: "#14213D" }}>{topicVids[0].title}</p>}
                            </div>
                          )
                        ) : (
                          <div style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 14px" }}>
                            <p className="text-[12px]" style={{ color: "#64748b" }}>🎬 In production — Lee is filming this topic</p>
                            {!requestedTopics.has(topic.id) ? (
                              <button onClick={() => handleRequestTopicVideo(topic.id)} className="mt-1.5 text-[11px] font-semibold hover:underline" style={{ color: "#3b82f6", cursor: "pointer", background: "none", border: "none", padding: 0 }}>🙋 Request priority →</button>
                            ) : (
                              <p className="mt-1.5 text-[11px] font-semibold" style={{ color: "#22c55e" }}>✓ Requested!</p>
                            )}
                          </div>
                        )}

                        {/* ── QUIZ ── */}
                        <p className="text-[8px] font-bold tracking-[0.15em] uppercase mt-4 mb-2.5" style={{ color: "#94a3b8" }}>QUIZ</p>
                        {hasQuiz ? (
                          <div className="flex items-center justify-between" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "12px 14px" }}>
                            <p className="text-[13px] font-bold" style={{ color: "#14213D" }}>📝 Topic Quiz — 5 questions</p>
                            <a href={topic.lw_quiz_link} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-white shrink-0" style={{ background: "#14213D", borderRadius: 6, padding: "6px 14px" }}>Take Quiz →</a>
                          </div>
                        ) : (
                          <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "12px 14px" }}>
                            <p className="text-[12px]" style={{ color: "#94a3b8" }}>Quiz not yet available</p>
                          </div>
                        )}

                        {/* ── PRACTICE PROBLEMS ── */}
                        <p className="text-[8px] font-bold tracking-[0.15em] uppercase mt-4 mb-2.5" style={{ color: "#94a3b8" }}>PRACTICE PROBLEMS</p>
                        {topicProblems.length > 0 ? (
                          <div>
                            {topicProblems.map((asset: any, idx: number) => {
                              if (isPreview && idx >= 3) return null;
                              return (
                                <div key={asset.id} className="flex items-center" style={{ padding: "8px 0", borderBottom: idx < topicProblems.length - 1 ? "1px solid #e2e8f0" : "none" }}>
                                  <span className="font-mono text-[11px] shrink-0" style={{ color: "#14213D", minWidth: 60 }}>{asset.source_ref}</span>
                                  <span className="text-[12px] flex-1 truncate mx-3" style={{ color: "#1e293b" }}>{asset.problem_title || asset.asset_name}</span>
                                  <a href={`https://learn.surviveaccounting.com/solutions/${asset.asset_name}`} target="_blank" rel="noopener noreferrer" className="text-[12px] shrink-0 whitespace-nowrap" style={{ color: "#3b82f6" }}>View →</a>
                                </div>
                              );
                            })}
                            {isPreview && topicProblems.length > 3 && (
                              <a href={enrollUrl} target="_blank" rel="noopener noreferrer" className="block mt-2 text-[12px] font-semibold" style={{ background: "#fffbf0", borderRadius: 6, padding: "8px 12px", color: "#14213D", cursor: "pointer" }}>
                                🔒 Unlock all {topicProblems.length} problems with a Study Pass →
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="text-[12px]" style={{ color: "#94a3b8", padding: "8px 0" }}>No practice problems for this topic yet.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── SECTION 4: JE CRAM TOOL (only if cards exist) ─── */}
        {totalCards > 0 && (
          <div id="je-cram-tool" className="scroll-mt-16" style={{ marginTop: 32 }}>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Journal Entries</SectionLabel>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold" style={{ color: "#94a3b8" }}>{totalCards} entries</span>
                <button
                  onClick={handleShuffle}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all hover:brightness-95 active:scale-[0.97]"
                  style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}
                >
                  <Shuffle className="h-3 w-3" /> Shuffle
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4 rounded-xl px-4 py-3" style={{ background: t.cardBg, border: `1px solid ${t.border}` }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-semibold" style={{ color: t.text }}>
                  {reviewedCount} of {totalCards} reviewed
                </p>
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
          </div>
        )}

        {/* ─── SECTION 5: SOLUTIONS LIBRARY ─── */}
        <div style={{ marginTop: 32 }} className="mb-8">
          <SectionLabel>Solutions Library</SectionLabel>
          <p className="text-[12px] mb-3" style={{ color: "#64748b" }}>Browse all practice problems for this chapter.</p>

          {/* Tab buttons */}
          <div className="flex gap-2 mb-4">
            {([["be", "Brief Exercises"], ["ex", "Exercises"], ["p", "Problems"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSolutionsTab(key)}
                className="text-[12px] font-semibold transition-colors"
                style={{
                  padding: "6px 16px",
                  borderRadius: 20,
                  background: solutionsTab === key ? "#14213D" : "#f1f5f9",
                  color: solutionsTab === key ? "#ffffff" : "#64748b",
                  cursor: "pointer",
                  border: "none",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Asset rows */}
          {solutionsFiltered.length > 0 ? (
            <div>
              {solutionsFiltered.map((asset: any, idx: number) => {
                if (isPreview && idx >= 3) return null;
                return (
                  <div key={asset.id} className="flex items-center" style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <span className="font-mono text-[11px] shrink-0" style={{ color: "#14213D", minWidth: 60 }}>{asset.source_ref}</span>
                    <span className="text-[12px] flex-1 truncate mx-3" style={{ color: "#1e293b" }}>{asset.problem_title || asset.asset_name}</span>
                    <a href={`https://learn.surviveaccounting.com/solutions/${asset.asset_name}`} target="_blank" rel="noopener noreferrer" className="text-[12px] shrink-0 whitespace-nowrap" style={{ color: "#3b82f6" }}>View →</a>
                  </div>
                );
              })}
              {isPreview && solutionsFiltered.length > 3 && (
                <div className="mt-3">
                  <TieredPaywallCard enrollUrl={enrollUrl} fullPassLink={fullPassLink} chapterLink={chapterLink} chapterNumber={chapterNum} theme={t} />
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 16 }}>
              <p className="text-[12px]" style={{ color: "#94a3b8" }}>
                No {solutionsTab === "be" ? "brief exercises" : solutionsTab === "ex" ? "exercises" : "problems"} for this chapter yet.
              </p>
            </div>
          )}
        </div>

        {/* ─── SECTION 6: ASK LEE ─── */}
        <div style={{ marginTop: 32 }} className="mb-8">
          <SectionLabel>Ask Lee</SectionLabel>
          {!askSent ? (
            <>
              <p className="text-[13px] mb-4" style={{ color: "#64748b" }}>
                Have a question about Ch {chapterNum || "?"} — {chapterName}? Send it over — I typically reply within 2 business days.
              </p>
              <input
                id="ask-lee-email"
                type="email"
                value={askEmail}
                onChange={e => { setAskEmail(e.target.value); setAskError(""); setAskEmailError(""); }}
                placeholder="your@email.com"
                required
                className="w-full outline-none transition-colors"
                style={{ border: `1px solid ${askEmailError ? "#dc2626" : "#e2e8f0"}`, borderRadius: 8, padding: "10px 14px", fontSize: 14 }}
                onFocus={e => e.target.style.borderColor = askEmailError ? "#dc2626" : "#14213D"}
                onBlur={e => e.target.style.borderColor = askEmailError ? "#dc2626" : "#e2e8f0"}
              />
              {askEmailError && (
                <p className="text-[12px] mt-1" style={{ color: "#dc2626" }}>{askEmailError}</p>
              )}
              <div className="mb-2.5" />
              <textarea
                value={askQuestion}
                onChange={e => { setAskQuestion(e.target.value); setAskError(""); }}
                placeholder={`What's your question about Ch ${chapterNum || "?"} — ${chapterName}?`}
                rows={4}
                required
                className="w-full mb-3 outline-none transition-colors"
                style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 14, resize: "vertical" }}
                onFocus={e => e.target.style.borderColor = "#14213D"}
                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
              />
              <button
                disabled={askSending || !askEmail.trim() || !askQuestion.trim()}
                onClick={async () => {
                  // .edu validation
                  if (!askEmail.trim().toLowerCase().endsWith(".edu")) {
                    setAskEmailError("Please use your .edu school email address to submit a question.");
                    document.getElementById("ask-lee-email")?.focus();
                    return;
                  }
                  setAskEmailError("");
                  setAskSending(true);
                  setAskError("");
                  try {
                    // Insert into chapter_questions
                    await (supabase as any).from("chapter_questions").insert({
                      chapter_id: chapterId,
                      student_email: askEmail.trim(),
                      question: askQuestion.trim(),
                      status: "new",
                    });
                    // Send email notification
                    await supabase.functions.invoke("send-chapter-question", {
                      body: {
                        student_email: askEmail.trim(),
                        question: askQuestion.trim(),
                        course_name: courseDisplayName,
                        chapter_number: chapterNum,
                        chapter_name: chapterName,
                      },
                    });
                    setAskSent(true);
                  } catch {
                    setAskError("Something went wrong — email lee@surviveaccounting.com directly");
                  } finally {
                    setAskSending(false);
                  }
                }}
                className="w-full font-semibold text-[14px] text-white transition-all hover:brightness-95 active:scale-[0.98]"
                style={{
                  background: "#14213D",
                  borderRadius: 8,
                  padding: 12,
                  cursor: askSending ? "wait" : "pointer",
                  opacity: (askSending || !askEmail.trim() || !askQuestion.trim()) ? 0.6 : 1,
                  border: "none",
                }}
              >
                {askSending ? "Sending..." : "Send Question →"}
              </button>
              {askError && (
                <p className="text-[12px] mt-2" style={{ color: "#dc2626" }}>{askError}</p>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <CheckCircle2 className="h-6 w-6 mx-auto" style={{ color: "#22c55e" }} />
              <p className="text-[16px] font-bold mt-3" style={{ color: "#14213D" }}>Thanks for reaching out!</p>
              <p className="text-[13px] mt-1.5" style={{ color: "#64748b" }}>I'll reply to {askEmail} within 2 business days.</p>
              <p className="text-[13px] italic mt-1" style={{ color: "#14213D" }}>— Lee</p>
            </div>
          )}
        </div>

        {/* About Lee (at bottom) */}
        <div className="mt-10 mb-8">
          <AboutLeeSection theme={t} />
        </div>

        {/* ─── ADMIN VIDEO MANAGER ─── */}
        {isAdmin && (
          <div className="mb-8" style={{ borderLeft: "3px solid #f59e0b", background: "#fffbeb", borderRadius: 8, padding: 16, marginTop: 32 }}>
            <p className="text-[9px] font-bold tracking-[0.15em] uppercase mb-3" style={{ color: "#92400e" }}>Video Manager</p>

            {/* Add Video Form */}
            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] font-semibold block mb-1" style={{ color: "#92400e" }}>Type</label>
                <select
                  value={vmType}
                  onChange={e => setVmType(e.target.value as any)}
                  className="w-full text-[13px] outline-none"
                  style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 10px", background: "#fff" }}
                >
                  <option value="intro">intro — Chapter intro clip</option>
                  <option value="showcase">showcase — Legacy video showcase</option>
                  <option value="topic">topic — Topic walkthrough</option>
                  <option value="legacy">legacy — Individual legacy video</option>
                </select>
              </div>

              {(vmType === "topic" || vmType === "legacy" || vmType === "showcase") && (
                <div>
                  <label className="text-[11px] font-semibold block mb-1" style={{ color: "#92400e" }}>Topic</label>
                  <select
                    value={vmTopicId}
                    onChange={e => setVmTopicId(e.target.value)}
                    className="w-full text-[13px] outline-none"
                    style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 10px", background: "#fff" }}
                  >
                    <option value="">Select topic...</option>
                    {(topics || []).filter((t: any) => t.is_active).map((t: any) => (
                      <option key={t.id} value={t.id}>{t.topic_number ? `${t.topic_number}. ` : ""}{t.topic_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold block mb-1" style={{ color: "#92400e" }}>Vimeo Embed URL</label>
                <input
                  value={vmVimeoUrl}
                  onChange={e => setVmVimeoUrl(e.target.value)}
                  placeholder="https://player.vimeo.com/video/[VIDEO_ID]"
                  className="w-full text-[13px] outline-none"
                  style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 10px" }}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold block mb-1" style={{ color: "#92400e" }}>Thumbnail URL (optional)</label>
                <input
                  value={vmThumbUrl}
                  onChange={e => setVmThumbUrl(e.target.value)}
                  className="w-full text-[13px] outline-none"
                  style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 10px" }}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold block mb-1" style={{ color: "#92400e" }}>Title (optional)</label>
                <input
                  value={vmTitle}
                  onChange={e => setVmTitle(e.target.value)}
                  className="w-full text-[13px] outline-none"
                  style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 10px" }}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold block mb-1" style={{ color: "#92400e" }}>Recorded date (optional)</label>
                <input
                  type="date"
                  value={vmDate}
                  onChange={e => setVmDate(e.target.value)}
                  className="w-full text-[13px] outline-none"
                  style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 10px" }}
                />
              </div>

              <button
                disabled={vmSaving || !vmVimeoUrl.trim()}
                onClick={async () => {
                  setVmSaving(true);
                  try {
                    await (supabase as any).from("chapter_videos").insert({
                      chapter_id: chapterId,
                      topic_id: (vmType === "topic" || vmType === "legacy") && vmTopicId ? vmTopicId : null,
                      video_type: vmType,
                      vimeo_embed_url: vmVimeoUrl.trim(),
                      thumbnail_url: vmThumbUrl.trim() || null,
                      title: vmTitle.trim() || null,
                      recorded_at: vmDate || null,
                      is_active: true,
                    });
                    queryClient.invalidateQueries({ queryKey: ["cram-chapter-videos", chapterId] });
                    setVmVimeoUrl(""); setVmThumbUrl(""); setVmTitle(""); setVmDate(""); setVmTopicId("");
                  } catch (e) {
                    console.error("Failed to add video:", e);
                  } finally {
                    setVmSaving(false);
                  }
                }}
                className="w-full text-[13px] font-semibold text-white transition-all hover:brightness-95"
                style={{ background: "#14213D", borderRadius: 6, padding: "8px 16px", cursor: vmSaving ? "wait" : "pointer", opacity: (!vmVimeoUrl.trim() || vmSaving) ? 0.6 : 1, border: "none" }}
              >
                {vmSaving ? "Saving..." : "Add Video"}
              </button>
            </div>

            {/* Existing Videos List */}
            <p className="text-[9px] font-bold tracking-[0.15em] uppercase mt-5 mb-2" style={{ color: "#92400e" }}>Existing Videos for this Chapter</p>
            {(chapterVideos as any[] || []).length > 0 ? (
              <div className="space-y-2">
                {(chapterVideos as any[]).map((vid: any) => (
                  <div key={vid.id} className="flex items-center gap-2 text-[12px]" style={{ padding: "6px 0", borderBottom: "1px solid #fde68a" }}>
                    <span
                      className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                      style={{
                        background: vid.video_type === "intro" ? "#14213D" : vid.video_type === "topic" ? "#2563eb" : "#94a3b8",
                      }}
                    >
                      {vid.video_type}
                    </span>
                    <span className="flex-1 truncate" style={{ color: "#14213D" }}>
                      {(vid.title || vid.vimeo_embed_url || "").slice(0, 40)}
                    </span>
                    {vid.recorded_at && (
                      <span className="text-[10px] shrink-0" style={{ color: "#92400e" }}>
                        {new Date(vid.recorded_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </span>
                    )}
                    {vmDeleteConfirm === vid.id ? (
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={async () => {
                            await (supabase as any).from("chapter_videos").delete().eq("id", vid.id);
                            queryClient.invalidateQueries({ queryKey: ["cram-chapter-videos", chapterId] });
                            setVmDeleteConfirm(null);
                          }}
                          className="text-[11px] font-bold px-2 py-0.5 rounded"
                          style={{ background: "#dc2626", color: "#fff", border: "none", cursor: "pointer" }}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setVmDeleteConfirm(null)}
                          className="text-[11px] px-2 py-0.5 rounded"
                          style={{ background: "#e2e8f0", color: "#64748b", border: "none", cursor: "pointer" }}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setVmDeleteConfirm(vid.id)}
                        className="shrink-0"
                        style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px]" style={{ color: "rgba(146,64,14,0.6)" }}>No videos added yet for this chapter.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
