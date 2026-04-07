import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isAllowedEmail } from "@/lib/emailWhitelist";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollUrl } from "@/hooks/useEnrollUrl";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Eye, EyeOff, ExternalLink, Calendar, Lock, Share2, Shuffle, X, AlertTriangle, Info, Target, BookOpen, LayoutGrid, FileText, Calculator } from "lucide-react";
import { JETooltip } from "@/components/JETooltip";
import { isCanonicalJE, type CanonicalJEPayload } from "@/lib/journalEntryParser";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboardFallback";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";

const LOGO_URL = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf121ac35937c4d438ca.png";
const PREVIEW_LIMIT = 3;
const SOLUTIONS_INITIAL_SHOW = 8;
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
  red: "#CE1126",
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

// ── Card definitions ──
const TOOL_CARDS = [
  { key: "whats-the-point", title: "What's the Point", icon: Target, countLabel: "bullets" },
  { key: "key-terms", title: "Key Terms", icon: BookOpen, countLabel: "terms" },
  { key: "accounts", title: "Accounts", icon: LayoutGrid, countLabel: "accounts" },
  { key: "journal-entries", title: "Journal Entries", icon: FileText, countLabel: "entries" },
  { key: "formulas", title: "Formulas", icon: Calculator, countLabel: "formulas" },
  { key: "exam-mistakes", title: "Exam Mistakes", icon: AlertTriangle, countLabel: "mistakes" },
] as const;

type CardKey = typeof TOOL_CARDS[number]["key"];

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
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && parsed !== value && (Array.isArray(parsed) || typeof parsed === "object")) { visit(parsed); return; }
      } catch {}
      trimmed.split(/\n+/).map((line) => line.trim()).filter(Boolean).forEach((line) => {
        const parts = line.split(/\s+[—–-]\s+/);
        const formulaPart = parts[0]?.trim() || "";
        const explanation = parts.slice(1).join(" — ").trim() || undefined;
        const eqIndex = formulaPart.indexOf("=");
        if (eqIndex > 0) {
          const name = formulaPart.slice(0, eqIndex).trim();
          formulas.push({ id: crypto.randomUUID(), name: name || formulaPart, expression: formulaPart, explanation });
          return;
        }
        formulas.push({ id: crypto.randomUUID(), name: formulaPart, expression: formulaPart, explanation });
      });
      return;
    }
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (record.formulas) { visit(record.formulas); return; }
      const name = record.name ?? record.formula_name ?? record.title;
      const expression = record.expression ?? record.formula_expression ?? record.formula ?? record.value;
      const explanation = record.explanation ?? record.description ?? record.note;
      if (typeof name === "string" && typeof expression === "string") {
        formulas.push({ id: crypto.randomUUID(), name: name.trim(), expression: expression.trim(), explanation: typeof explanation === "string" ? explanation.trim() : undefined });
        return;
      }
      Object.values(record).forEach(visit);
    }
  };
  visit(raw);
  return formulas.filter((formula) => formula.name.trim() && formula.expression.trim());
}

function getBELabel(courseCode: string) {
  if (courseCode === "INTRO1" || courseCode === "INTRO2" || courseCode === "FA1" || courseCode === "MA2") return "Quick Studies";
  return "Brief Exercises";
}

// ── Section Report Link ──
function SectionReportLink({ sectionLabel, onClick }: { sectionLabel: string; onClick: (section: string) => void }) {
  return (
    <div className="flex justify-end mt-3">
      <button
        type="button"
        onClick={() => onClick(sectionLabel)}
        className="text-[11px] transition-colors hover:underline"
        style={{ color: theme.label, background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        Report an issue →
      </button>
    </div>
  );
}

// ── Drawer Content Components ──

import { TAccountCard, FIVE_GROUPS, DEBIT_NORMAL_TYPES as DEBIT_NORMAL_TYPES_CARD } from "@/components/TAccountCard";
import type { TAccountData } from "@/components/TAccountCard";

function DrawerPurposeContent({ purpose }: { purpose: any }) {
  if (!purpose) return <p className="text-[13px]" style={{ color: theme.textMuted }}>No content yet.</p>;
  return (
    <div className="space-y-4">
      {Array.isArray(purpose.purpose_bullets) && purpose.purpose_bullets.map((b: string, i: number) => (
        <p key={i} className="text-[14px] leading-[1.7]" style={{ color: theme.text }}>{b}</p>
      ))}
      {!Array.isArray(purpose.purpose_bullets) && purpose.purpose_text && (
        <p className="text-[14px] leading-[1.7]" style={{ color: theme.text }}>{purpose.purpose_text}</p>
      )}
      {(Array.isArray(purpose.consequence_bullets) ? purpose.consequence_bullets : [purpose.consequence_text]).filter(Boolean).length > 0 && (
        <div className="mt-4 rounded-lg p-4" style={{ background: "#FEF2F2" }}>
          <p className="text-[11px] font-semibold mb-1" style={{ color: "rgba(206,17,38,0.8)" }}>⚠ What goes wrong if you don't:</p>
          {(Array.isArray(purpose.consequence_bullets) ? purpose.consequence_bullets : [purpose.consequence_text]).filter(Boolean).map((c: string, i: number) => (
            <p key={i} className="text-[13px] leading-[1.6] italic" style={{ color: "rgba(206,17,38,0.8)" }}>{c}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function DrawerAccountsContent({ accounts }: { accounts: TAccountData[] }) {
  const [openGroup, setOpenGroup] = useState<string | null>(FIVE_GROUPS[0].label);
  const grouped = FIVE_GROUPS.map(g => ({
    label: g.label,
    items: accounts.filter(a => g.subTypes.includes(a.account_type)),
    isDebitNormal: g.subTypes.some(st => DEBIT_NORMAL_TYPES_CARD.has(st)),
  })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-3">
      {grouped.map((group) => {
        const isOpen = openGroup === group.label;
        return (
          <div key={group.label}>
            <button
              onClick={() => setOpenGroup(isOpen ? null : group.label)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors"
              style={{ background: isOpen ? theme.navy : theme.mutedBg, color: isOpen ? "#FFFFFF" : theme.heading }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.1em]">{group.label}</span>
                <span className="text-[10px] font-normal" style={{ opacity: 0.6 }}>({group.items.length}) · {group.isDebitNormal ? "Dr normal" : "Cr normal"}</span>
              </div>
              <span className="text-[10px]">{isOpen ? "▼" : "▶"}</span>
            </button>
            {isOpen && (
              <div className="mt-2 grid grid-cols-1 gap-3">
                {group.items.map((acc: TAccountData) => (
                  <div key={acc.id} className="rounded-xl p-3" style={{ background: theme.cardBg, border: `1px solid ${theme.border}` }}>
                    <TAccountCard account={acc} mode="student" theme={theme} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DrawerKeyTermsContent({ terms, chapterId }: { terms: any[]; chapterId: string }) {
  const [termIndex, setTermIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [seenSet, setSeenSet] = useState<Set<string>>(() => {
    try { const stored = sessionStorage.getItem(`sa_terms_seen_${chapterId}`); return stored ? new Set(JSON.parse(stored)) : new Set(); } catch { return new Set(); }
  });
  const currentTerm = terms[termIndex];
  const seenCount = terms.filter(t => seenSet.has(t.id)).length;
  const handleSeen = useCallback((termId: string) => {
    setSeenSet(prev => { const next = new Set(prev).add(termId); try { sessionStorage.setItem(`sa_terms_seen_${chapterId}`, JSON.stringify([...next])); } catch {} return next; });
  }, [chapterId]);
  useEffect(() => { setFlipped(false); }, [termIndex]);
  if (!currentTerm) return <p className="text-[13px]" style={{ color: theme.textMuted }}>No key terms yet.</p>;

  return (
    <div>
      <div className="mb-3 rounded-xl border px-4 py-2.5" style={{ background: theme.mutedBg, borderColor: theme.border }}>
        <p className="text-[13px] font-semibold" style={{ color: theme.text }}>{seenCount} ✓ / {terms.length}</p>
      </div>
      {currentTerm.category && (
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: theme.textMuted }}>{currentTerm.category}</p>
      )}
      <div className="relative cursor-pointer" style={{ perspective: 1000, minHeight: 200 }} onClick={() => setFlipped(f => !f)}>
        <div style={{ transformStyle: "preserve-3d", transition: "transform 0.5s ease", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)", position: "relative", minHeight: 200 }}>
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl px-8 py-10" style={{ backfaceVisibility: "hidden", background: theme.navy, border: `1px solid ${theme.border}` }}>
            <p className="text-[22px] font-bold text-white text-center leading-tight" style={{ fontFamily: "'DM Serif Display', serif" }}>{currentTerm.term}</p>
            <p className="mt-3 text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>Tap to reveal definition</p>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl px-8 py-10" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: theme.cardBg, border: `1px solid ${theme.border}` }}>
            <p className="text-[12px] font-bold uppercase tracking-wider mb-3" style={{ color: theme.textMuted }}>{currentTerm.term}</p>
            <p className="text-[15px] leading-[1.7] text-center" style={{ color: theme.text }}>{currentTerm.definition}</p>
            <p className="mt-3 text-[11px]" style={{ color: theme.label }}>Tap to flip back</p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <button type="button" disabled={termIndex === 0} onClick={() => setTermIndex(i => i - 1)} className="inline-flex items-center gap-1 rounded-md px-4 py-2 text-[13px] font-semibold disabled:opacity-30" style={{ color: theme.navy, border: `1px solid ${theme.navy}`, background: "transparent" }}>
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => handleSeen(currentTerm.id)} disabled={seenSet.has(currentTerm.id)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold" style={{ background: seenSet.has(currentTerm.id) ? theme.successBg : "#DCFCE7", color: seenSet.has(currentTerm.id) ? "#15803D" : theme.successText, border: `1px solid ${seenSet.has(currentTerm.id) ? theme.successBorder : "#86EFAC"}`, cursor: seenSet.has(currentTerm.id) ? "default" : "pointer" }}>
            <CheckCircle className="h-3.5 w-3.5" />
            {seenSet.has(currentTerm.id) ? "Got It ✓" : "Got It"}
          </button>
          <span className="text-[13px]" style={{ color: theme.textMuted }}>{termIndex + 1} / {terms.length}</span>
        </div>
        <button type="button" disabled={termIndex >= terms.length - 1} onClick={() => setTermIndex(i => i + 1)} className="inline-flex items-center gap-1 rounded-md px-4 py-2 text-[13px] font-semibold disabled:opacity-30" style={{ color: theme.navy, border: `1px solid ${theme.navy}`, background: "transparent" }}>
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function DrawerFormulasContent({ formulas, chapterId, isAdmin, isItemHidden, toggleItemHidden }: { formulas: FormulaCard[]; chapterId: string; isAdmin: boolean; isItemHidden: (s: string, id: string) => boolean; toggleItemHidden: (s: string, id: string) => Promise<void> }) {
  const [formulaIndex, setFormulaIndex] = useState(0);
  const [seenSet, setSeenSet] = useState<Set<string>>(() => {
    try { const stored = sessionStorage.getItem(`sa_formulas_seen_${chapterId}`); return stored ? new Set(JSON.parse(stored)) : new Set(); } catch { return new Set(); }
  });
  const currentFormula = formulas[formulaIndex];
  const seenCount = formulas.filter(f => seenSet.has(f.id)).length;
  const handleSeen = useCallback((id: string) => {
    setSeenSet(prev => { const next = new Set(prev).add(id); try { sessionStorage.setItem(`sa_formulas_seen_${chapterId}`, JSON.stringify([...next])); } catch {} return next; });
  }, [chapterId]);

  useEffect(() => { setFormulaIndex(0); }, [formulas.length]);

  if (!currentFormula) return <p className="text-[13px]" style={{ color: theme.textMuted }}>No formulas to memorize yet.</p>;

  const hidden = isItemHidden("formulas", currentFormula.id);

  return (
    <div>
      <div className="mb-4 rounded-xl border px-4 py-3" style={{ background: theme.mutedBg, borderColor: theme.border }}>
        <p className="text-[13px] font-semibold" style={{ color: theme.text }}>{seenCount} ✓ / {formulas.length}</p>
      </div>
      <div className="relative rounded-xl overflow-hidden" style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, opacity: hidden ? 0.5 : 1 }}>
        {isAdmin && (
          <button type="button" onClick={() => toggleItemHidden("formulas", currentFormula.id)} className="absolute right-3 top-3 z-10 inline-flex h-6 w-6 items-center justify-center rounded-md" style={{ background: hidden ? theme.warningBg : "rgba(255,255,255,0.9)", color: hidden ? theme.warningText : theme.textMuted, border: `1px solid ${theme.border}` }}>
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        )}
        {currentFormula.image_url ? (
          <>
            <div className="px-5 pt-4 pb-2">
              <p className="text-[16px] font-bold" style={{ color: theme.heading, fontFamily: "'DM Serif Display', serif" }}>{currentFormula.name}</p>
            </div>
            <div className="px-4 pb-4">
              <img src={currentFormula.image_url} alt={currentFormula.name} style={{ width: "100%", maxWidth: 800, aspectRatio: "2 / 1", objectFit: "contain", margin: "0 auto", borderRadius: 12, display: "block" }} />
            </div>
          </>
        ) : (
          <div style={{ padding: "24px 32px" }}>
            <p className="text-[18px] font-bold" style={{ color: theme.heading, marginBottom: 12, fontFamily: "'DM Serif Display', serif" }}>{currentFormula.name}</p>
            <p className="text-[20px] font-medium" style={{ color: theme.red, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace" }}>{currentFormula.expression}</p>
            {currentFormula.explanation && <p className="text-[13px] leading-[1.7]" style={{ color: theme.textMuted, marginTop: 12 }}>{currentFormula.explanation}</p>}
          </div>
        )}
        <div className="flex items-center gap-3 px-5 pb-4">
          <button type="button" onClick={() => handleSeen(currentFormula.id)} disabled={seenSet.has(currentFormula.id)} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold" style={{ background: seenSet.has(currentFormula.id) ? theme.successBg : "#DCFCE7", color: seenSet.has(currentFormula.id) ? "#15803D" : theme.successText, border: `1px solid ${seenSet.has(currentFormula.id) ? theme.successBorder : "#86EFAC"}`, cursor: seenSet.has(currentFormula.id) ? "default" : "pointer" }}>
            <CheckCircle className="h-3.5 w-3.5" />
            {seenSet.has(currentFormula.id) ? "Got It ✓" : "Got It"}
          </button>
        </div>
      </div>
      {formulas.length > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button type="button" disabled={formulaIndex === 0} onClick={() => setFormulaIndex(i => i - 1)} className="inline-flex items-center gap-1 rounded-md px-4 py-2 text-[13px] font-semibold disabled:opacity-30" style={{ color: theme.navy, border: `1px solid ${theme.navy}`, background: "transparent" }}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <span className="text-[13px]" style={{ color: theme.textMuted }}>{formulaIndex + 1} / {formulas.length}</span>
          <button type="button" disabled={formulaIndex >= formulas.length - 1} onClick={() => setFormulaIndex(i => i + 1)} className="inline-flex items-center gap-1 rounded-md px-4 py-2 text-[13px] font-semibold disabled:opacity-30" style={{ color: theme.navy, border: `1px solid ${theme.navy}`, background: "transparent" }}>
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function DrawerJournalEntriesContent({ categories, entries }: { categories: { id: string; category_name: string; sort_order: number }[]; entries: { id: string; category_id: string | null; transaction_label: string; je_lines: any; sort_order: number }[] }) {
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
            <button onClick={() => setOpenCat(catOpen ? null : cat.id)} className="w-full flex items-center justify-between px-2 py-2 rounded-md text-left transition-colors text-[13px] font-semibold" style={{ color: theme.text, background: catOpen ? theme.mutedBg : "transparent" }}>
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
                      <button onClick={() => setOpenEntry(entryOpen ? null : entry.id)} className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors text-[12px] font-medium" style={{ color: theme.text, background: entryOpen ? theme.mutedBg : "transparent" }}>
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
                                    <td className="text-right px-3 py-1.5 text-[12px] font-mono" style={{ color: theme.textMuted }}>{!isCredit ? "???" : ""}</td>
                                    <td className="text-right px-3 py-1.5 text-[12px] font-mono" style={{ color: theme.textMuted }}>{isCredit ? "???" : ""}</td>
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
      {grouped.length === 0 && <p className="text-[13px]" style={{ color: theme.textMuted }}>No journal entries available yet.</p>}
    </div>
  );
}

function DrawerMistakesContent({ mistakes }: { mistakes: any[] }) {
  if (mistakes.length === 0) return <p className="text-[13px]" style={{ color: theme.textMuted }}>No exam mistakes yet.</p>;
  const borderColors = ["#CE1126", "#F59E0B", "#FBBF24"];
  const rankLabels = ["#1 · Most Dangerous", "#2 · Common", "#3 · Subtle"];
  const rankBgColors = ["#FEF2F2", "#FFFBEB", "#FFFBEB"];
  const rankTextColors = ["#CE1126", "#92400E", "#92400E"];

  return (
    <div className="space-y-3">
      {mistakes.map((m: any, mi: number) => (
        <div key={m.id} className="rounded-xl border-l-4 px-5 py-4" style={{ borderLeftColor: borderColors[mi] || borderColors[2], borderTop: `1px solid ${theme.border}`, borderRight: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}`, background: theme.cardBg }}>
          <div className="flex items-start gap-3">
            <span className="shrink-0 mt-0.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ background: rankBgColors[mi] || rankBgColors[2], color: rankTextColors[mi] || rankTextColors[2] }}>{rankLabels[mi] || `#${mi + 1}`}</span>
            <div className="min-w-0">
              <p className="text-[14px] font-bold leading-[1.4]" style={{ color: theme.text }}>{m.mistake}</p>
              {m.explanation && <p className="text-[13px] mt-1.5 leading-[1.7]" style={{ color: theme.textMuted }}>{m.explanation}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Paywall Card ──
function TieredPaywallCard({ enrollUrl, chapterNumber, fullPassLink, chapterLink }: { enrollUrl: string; chapterNumber: number | null; fullPassLink?: any; chapterLink?: any }) {
  const now = new Date();
  const saleActive = fullPassLink?.sale_expires_at ? now < new Date(fullPassLink.sale_expires_at) : false;
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;
  const fullPassUrl = fullPassLink?.url || enrollUrl;
  const singleChapterUrl = chapterLink?.url || enrollUrl;

  return (
    <div className="rounded-xl p-5" style={{ background: "#FFFBF0", border: `1px solid ${theme.amberBorder}` }}>
      <div className="text-center">
        <Lock className="mx-auto h-5 w-5" style={{ color: theme.navy }} />
        <p className="mt-2 text-[15px] font-bold" style={{ color: theme.navy }}>Unlock the full chapter with a Study Pass</p>
      </div>
      <div className="relative mt-4 rounded-xl px-6 py-6" style={{ background: theme.navy, border: "2px solid rgba(212,175,55,0.45)" }}>
        <span className="absolute right-0 top-0 rounded-bl-xl rounded-tr-xl px-3 py-1.5 text-[10px] font-bold" style={{ background: "#CE1126", color: "#FFFFFF" }}>Best Value</span>
        <p className="text-[16px] font-bold text-white">Full Study Pass</p>
        <div className="mt-2 flex items-baseline gap-2">
          {saleActive && fullPassLink?.original_price_cents && <span className="text-[14px] line-through" style={{ color: "rgba(255,255,255,0.45)" }}>{formatPrice(fullPassLink.original_price_cents)}</span>}
          <span className="text-[24px] font-bold text-white">{formatPrice(fullPassLink?.price_cents || 12500)}</span>
        </div>
        <a href={fullPassUrl} target="_blank" rel="noopener noreferrer" className="mt-4 block rounded-lg px-6 py-3 text-center text-[15px] font-bold text-white transition-all hover:brightness-90" style={{ background: "#CE1126" }}>Get Full Access →</a>
      </div>
      {chapterNumber && (
        <div className="mt-4 rounded-xl px-6 py-5" style={{ background: theme.cardBg, border: `1px solid ${theme.border}` }}>
          <p className="text-[15px] font-bold" style={{ color: theme.text }}>Chapter {chapterNumber} Only</p>
          <p className="mt-1 text-[22px] font-bold" style={{ color: theme.text }}>{formatPrice(chapterLink?.price_cents || 3000)}</p>
          <a href={singleChapterUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block rounded-lg px-6 py-3 text-center text-[15px] font-bold text-white transition-all hover:brightness-90" style={{ background: "#006BA6" }}>Buy Chapter {chapterNumber} →</a>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──

export default function ChapterCramTool() {
  const { chapterId: routeChapterId } = useParams<{ chapterId: string }>();
  const [searchParams] = useSearchParams();
  const chapterId = routeChapterId || searchParams.get("chapter_id") || "";
  const isPreview = searchParams.get("preview") === "true";
  const enrollUrl = useEnrollUrl();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();

  const [solutionsTab, setSolutionsTab] = useState<"be" | "ex" | "p" | null>(null);
  const [expandedTabs, setExpandedTabs] = useState<Record<string, boolean>>({});
  const [feedbackSection, setFeedbackSection] = useState("");
  const [openDrawer, setOpenDrawer] = useState<CardKey | null>(null);

  const { data: isAdmin = false } = useQuery({
    queryKey: ["cram-admin-check", user?.id],
    enabled: !authLoading,
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase.from("va_accounts").select("role").eq("user_id", user.id).maybeSingle();
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
      const { data, error } = await supabase.from("chapters").select("id, chapter_number, chapter_name, course_id, courses!chapters_course_id_fkey(code, course_name)").eq("id", chapterId).single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: approvedAssets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ["cram-approved-assets", chapterId],
    enabled: !!chapterId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("teaching_assets").select("id, asset_name, source_ref, asset_type, problem_title, supplementary_je_json, journal_entry_completed_json, important_formulas").eq("chapter_id", chapterId).not("asset_approved_at", "is", null).order("source_ref");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: chapterFormulas = [] } = useQuery({
    queryKey: ["cram-chapter-formulas", chapterId],
    enabled: !!chapterId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("chapter_formulas").select("id, formula_name, formula_expression, formula_explanation, image_url, is_approved, sort_order").eq("chapter_id", chapterId).eq("is_approved", true).order("sort_order");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: sectionConfigs = [] } = useQuery({
    queryKey: ["cram-section-config", chapterId],
    enabled: !!chapterId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("chapter_section_config").select("*").eq("chapter_id", chapterId);
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

  const { data: chapterJEData } = useQuery({
    queryKey: ["cram-chapter-je", chapterId],
    enabled: !!chapterId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: cats } = await supabase.from("chapter_je_categories").select("id, category_name, sort_order").eq("chapter_id", chapterId!).order("sort_order");
      const { data: entries } = await supabase.from("chapter_journal_entries").select("id, category_id, transaction_label, je_lines, sort_order").eq("chapter_id", chapterId!).eq("is_approved", true).order("sort_order");
      return { categories: cats || [], entries: entries || [] };
    },
  });

  const { data: contentSuite } = useQuery({
    queryKey: ["cram-content-suite", chapterId],
    enabled: !!chapterId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [purposeRes, termsRes, mistakesRes, accountsRes] = await Promise.all([
        supabase.from("chapter_purpose").select("*").eq("chapter_id", chapterId!).maybeSingle(),
        supabase.from("chapter_key_terms").select("*").eq("chapter_id", chapterId!).eq("is_approved", true).order("sort_order"),
        supabase.from("chapter_exam_mistakes").select("*").eq("chapter_id", chapterId!).eq("is_approved", true).order("sort_order"),
        supabase.from("chapter_accounts").select("*").eq("chapter_id", chapterId!).eq("is_approved", true).order("sort_order"),
      ]);
      return {
        purpose: purposeRes.data as any,
        keyTerms: (termsRes.data || []) as any[],
        examMistakes: (mistakesRes.data || []) as any[],
        accounts: (accountsRes.data || []) as any[],
      };
    },
  });

  const sectionConfigMap = useMemo(() => {
    const map: Record<string, SectionConfigRow> = {};
    sectionConfigs.forEach((config) => { map[config.section_name] = config; });
    return map;
  }, [sectionConfigs]);

  const isSectionVisible = useCallback((sectionName: string) => {
    const config = sectionConfigMap[sectionName];
    return config ? config.is_visible : true;
  }, [sectionConfigMap]);

  const isItemHidden = useCallback((sectionName: string, itemId: string) => {
    const config = sectionConfigMap[sectionName];
    return config ? (config.hidden_item_ids || []).includes(itemId) : false;
  }, [sectionConfigMap]);

  const toggleItemHidden = useCallback(async (sectionName: string, itemId: string) => {
    const config = sectionConfigMap[sectionName];
    const currentHidden = config?.hidden_item_ids || [];
    const nextHidden = currentHidden.includes(itemId) ? currentHidden.filter((v) => v !== itemId) : [...currentHidden, itemId];
    if (config) {
      await (supabase as any).from("chapter_section_config").update({ hidden_item_ids: nextHidden, updated_at: new Date().toISOString() }).eq("id", config.id);
    } else {
      await (supabase as any).from("chapter_section_config").insert({ chapter_id: chapterId, section_name: sectionName, is_visible: true, hidden_item_ids: nextHidden });
    }
    await queryClient.invalidateQueries({ queryKey: ["cram-section-config", chapterId] });
  }, [chapterId, queryClient, sectionConfigMap]);

  // Formulas
  const chapterImageFormulas = useMemo(() => chapterFormulas.filter((f: any) => f.image_url).map((f: any): FormulaCard => ({ id: f.id, name: f.formula_name, expression: f.formula_expression, explanation: f.formula_explanation || undefined, image_url: f.image_url })), [chapterFormulas]);
  const perAssetFormulas = useMemo(() => {
    if (chapterImageFormulas.length > 0) return [];
    const all: FormulaCard[] = [];
    approvedAssets.forEach((asset) => { if (asset.important_formulas) all.push(...parseImportantFormulas(asset.important_formulas)); });
    return all;
  }, [approvedAssets, chapterImageFormulas.length]);
  const structuredFormulas = chapterImageFormulas.length > 0 ? chapterImageFormulas : perAssetFormulas;
  const visibleFormulas = useMemo(() => structuredFormulas.filter((f) => isAdmin || !isItemHidden("formulas", f.id)), [structuredFormulas, isAdmin, isItemHidden]);

  // Solutions
  const solutionsFiltered = useMemo(() => {
    if (!solutionsTab) return [];
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

  const purpose = contentSuite?.purpose;
  const keyTerms = contentSuite?.keyTerms || [];
  const examMistakes = contentSuite?.examMistakes || [];
  const chapterAccounts = contentSuite?.accounts || [];
  const chapterJEEntries = chapterJEData?.entries || [];
  const chapterJECategories = chapterJEData?.categories || [];

  // Card counts
  const cardCounts: Record<CardKey, number> = {
    "whats-the-point": purpose ? (Array.isArray(purpose.purpose_bullets) ? purpose.purpose_bullets.length : purpose.purpose_text ? 1 : 0) : 0,
    "key-terms": keyTerms.length,
    "accounts": chapterAccounts.length,
    "journal-entries": chapterJEEntries.length,
    "formulas": visibleFormulas.length,
    "exam-mistakes": examMistakes.length,
  };

  const isTabExpanded = (key: string) => !!expandedTabs[key];
  const toggleTab = (key: string) => setExpandedTabs((prev) => ({ ...prev, [key]: !prev[key] }));

  const openFeedbackForSection = useCallback((sectionLabel: string) => {
    setFeedbackSection(sectionLabel);
    setOpenDrawer(null);
    setTimeout(() => document.getElementById("feedback")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, []);

  // Drawer navigation
  const currentDrawerIndex = openDrawer ? TOOL_CARDS.findIndex(c => c.key === openDrawer) : -1;
  const goToPrevCard = useCallback(() => {
    if (currentDrawerIndex > 0) setOpenDrawer(TOOL_CARDS[currentDrawerIndex - 1].key);
  }, [currentDrawerIndex]);
  const goToNextCard = useCallback(() => {
    if (currentDrawerIndex < TOOL_CARDS.length - 1) setOpenDrawer(TOOL_CARDS[currentDrawerIndex + 1].key);
  }, [currentDrawerIndex]);

  useEffect(() => {
    if (!chapter) return;
    document.title = `Ch ${chapter.chapter_number} — ${chapter.chapter_name} — Survive Accounting`;
    return () => { document.title = "Survive Accounting"; };
  }, [chapter]);

  if (!chapterId) {
    return <div className="flex min-h-screen items-center justify-center" style={{ background: theme.pageBg }}><p style={{ color: theme.text }}>No chapter specified.</p></div>;
  }

  if (chapterLoading || assetsLoading || authLoading) {
    return <div className="flex min-h-screen items-center justify-center" style={{ background: theme.pageBg }}><div className="h-8 w-8 animate-spin rounded-full border-4" style={{ borderColor: theme.border, borderTopColor: theme.heading }} /></div>;
  }

  const courseCode = chapter?.courses?.code || "";
  const beLabel = getBELabel(courseCode);
  const courseDisplayName = courseCode === "IA2" ? "Intermediate Accounting 2" : courseCode === "IA1" ? "Intermediate Accounting 1" : courseCode === "MA2" ? "Managerial Accounting" : courseCode === "FA1" ? "Financial Accounting" : chapter?.courses?.course_name || courseCode;
  const chapterNum = chapter?.chapter_number;
  const fullPassLink = paymentLinks.find((link: any) => link.link_type === "full_pass" && link.course_id === chapter?.course_id);
  const chapterLink = paymentLinks.find((link: any) => link.link_type === "chapter" && link.chapter_id === chapterId);

  // Drawer content renderer
  const renderDrawerContent = (key: CardKey) => {
    switch (key) {
      case "whats-the-point":
        return <DrawerPurposeContent purpose={purpose} />;
      case "key-terms":
        return <DrawerKeyTermsContent terms={keyTerms} chapterId={chapterId} />;
      case "accounts":
        return <DrawerAccountsContent accounts={chapterAccounts} />;
      case "journal-entries":
        return <DrawerJournalEntriesContent categories={chapterJECategories} entries={chapterJEEntries} />;
      case "formulas":
        return <DrawerFormulasContent formulas={visibleFormulas} chapterId={chapterId} isAdmin={isAdmin} isItemHidden={isItemHidden} toggleItemHidden={toggleItemHidden} />;
      case "exam-mistakes":
        return <DrawerMistakesContent mistakes={examMistakes} />;
      default:
        return null;
    }
  };

  const drawerTitle = openDrawer ? TOOL_CARDS.find(c => c.key === openDrawer)?.title || "" : "";

  return (
    <div className="min-h-screen" style={{ background: theme.pageBg }}>
      {/* ── Static Nav Bar ── */}
      <header style={{ background: theme.navy, height: 56 }}>
        <div className="mx-auto flex h-full max-w-[1200px] items-center px-4 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img src={LOGO_URL} alt="Survive Accounting" className="h-7 object-contain sm:h-8 shrink-0" />
            <span className="text-[11px] sm:text-[12px] truncate" style={{ color: "rgba(255,255,255,0.5)" }}>
              Created by Lee Ingram · Tutor since 2015
            </span>
          </div>
        </div>
      </header>

      {/* ── Hero Header ── */}
      <div style={{ background: theme.navy }}>
        <div className="mx-auto max-w-[780px] px-4 py-8 sm:px-6 sm:py-10">
          {courseDisplayName && (
            <p className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.5)" }}>
              {courseDisplayName}
            </p>
          )}
          <h1 className="mt-2 text-[28px] sm:text-[32px] font-bold text-white leading-tight">
            Ch {chapterNum} — {chapter?.chapter_name}
          </h1>
          <div className="mt-3">
            <span className="inline-block rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: "rgba(34,197,94,0.15)", color: "#4ADE80" }}>
              Your exam is coming. Let's survive it.
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <main className="mx-auto max-w-[780px] px-4 py-6 sm:px-6 sm:py-8">
        {/* ──── Practice Problems ──── */}
        <section className="mb-8">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-3" style={{ color: theme.label }}>
            PRACTICE PROBLEMS · CH {chapterNum || "?"}
          </p>

          <div className="flex flex-wrap gap-2">
            {([["be", beLabel], ["ex", "Exercises"], ["p", "Problems"]] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSolutionsTab(prev => prev === key ? null : key)}
                className="rounded-full px-4 py-1.5 text-[12px] font-semibold transition-colors"
                style={{ background: solutionsTab === key ? theme.navy : theme.mutedBg, color: solutionsTab === key ? "#FFFFFF" : theme.textMuted, border: "none" }}
              >
                {label}
              </button>
            ))}
          </div>

          {solutionsTab && (
            <div className="mt-3 rounded-xl border" style={{ borderColor: theme.border, background: theme.cardBg }}>
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
                        <span className="min-w-[64px] shrink-0 font-mono text-[11px]" style={{ color: theme.heading }}>{asset.source_ref || "—"}</span>
                        <span className="min-w-0 flex-1 truncate" style={{ color: theme.text }}>{asset.problem_title || asset.asset_name}</span>
                        <a href={`https://learn.surviveaccounting.com/solutions/${asset.asset_name}`} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[12px] font-semibold" style={{ color: "#2563EB" }}>View →</a>
                      </div>
                    );
                  })}
                  {!isPreview && solutionsFiltered.length > SOLUTIONS_INITIAL_SHOW && (
                    <div className="px-4 py-3 sm:px-5" style={{ borderTop: `1px solid ${theme.border}` }}>
                      <button type="button" onClick={() => toggleTab(solutionsTab)} className="text-[12px] font-semibold" style={{ color: "#2563EB", background: "none", border: "none", cursor: "pointer" }}>
                        {isTabExpanded(solutionsTab) ? "Show less ↑" : `Show more → (${solutionsFiltered.length - SOLUTIONS_INITIAL_SHOW} more)`}
                      </button>
                    </div>
                  )}
                  {isPreview && solutionsFiltered.length > PREVIEW_LIMIT && (
                    <div className="border-t p-4 sm:p-5" style={{ borderColor: theme.border }}>
                      <TieredPaywallCard enrollUrl={enrollUrl} chapterNumber={chapter?.chapter_number || null} fullPassLink={fullPassLink} chapterLink={chapterLink} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-4 py-4 sm:px-5">
                  <p className="text-[13px]" style={{ color: theme.textMuted }}>No solutions in this tab yet.</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ──── Chapter Tools Card Grid ──── */}
        <section className="mb-10">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-4" style={{ color: theme.label }}>
            CHAPTER TOOLS
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TOOL_CARDS.map((card) => {
              const Icon = card.icon;
              const count = cardCounts[card.key];
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => setOpenDrawer(card.key)}
                  className="group relative text-left rounded-lg p-6 transition-all duration-200 cursor-pointer hover:-translate-y-0.5"
                  style={{
                    background: theme.navy,
                    border: "2px solid transparent",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderLeftColor = theme.red; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderLeftColor = "transparent"; }}
                >
                  <Icon className="h-5 w-5 mb-3" style={{ color: "rgba(255,255,255,0.6)" }} />
                  <p className="text-[14px] font-bold text-white">{card.title}</p>
                  {count > 0 && (
                    <span
                      className="absolute bottom-4 right-4 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white"
                      style={{ background: theme.red }}
                    >
                      {count} {card.countLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* ──── Feedback ──── */}
        <section id="feedback" className="mb-10">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-3" style={{ color: theme.label }}>SHARE FEEDBACK</p>
          <CramFeedbackForm
            chapterId={chapterId}
            chapterNumber={chapter?.chapter_number}
            chapterName={chapter?.chapter_name || ""}
            courseDisplayName={courseDisplayName}
            isVisible={true}
            prefillSection={feedbackSection}
          />
        </section>
      </main>

      {/* ── Content Drawer ── */}
      <Sheet open={!!openDrawer} onOpenChange={(open) => { if (!open) setOpenDrawer(null); }}>
        <SheetContent side="right" className="w-full sm:w-[480px] sm:max-w-[480px] p-0 flex flex-col overflow-hidden [&>button.absolute]:hidden">
          {/* Drawer header */}
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: theme.border, background: theme.mutedBg }}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentDrawerIndex <= 0}
                onClick={goToPrevCard}
                className="inline-flex items-center gap-0.5 text-[12px] font-semibold disabled:opacity-30 transition-opacity"
                style={{ color: theme.navy, background: "none", border: "none", cursor: currentDrawerIndex <= 0 ? "default" : "pointer" }}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </button>
            </div>
            <SheetTitle className="text-[15px] font-bold" style={{ color: theme.heading }}>{drawerTitle}</SheetTitle>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentDrawerIndex >= TOOL_CARDS.length - 1}
                onClick={goToNextCard}
                className="inline-flex items-center gap-0.5 text-[12px] font-semibold disabled:opacity-30 transition-opacity"
                style={{ color: theme.navy, background: "none", border: "none", cursor: currentDrawerIndex >= TOOL_CARDS.length - 1 ? "default" : "pointer" }}
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => setOpenDrawer(null)} className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-gray-100" style={{ color: theme.textMuted }}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Drawer content */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {openDrawer && renderDrawerContent(openDrawer)}
            {openDrawer && (
              <SectionReportLink sectionLabel={drawerTitle} onClick={openFeedbackForSection} />
            )}
          </div>
        </SheetContent>
      </Sheet>

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

// ── Feedback Form ──
const CRAM_ISSUE_TYPES = ["Something looks wrong", "Missing content", "I have a question", "Just saying hello", "Other"];

function CramFeedbackForm({ chapterId, chapterNumber, chapterName, courseDisplayName, isVisible, prefillSection = "" }: { chapterId: string; chapterNumber?: number; chapterName: string; courseDisplayName: string; isVisible: boolean; prefillSection?: string }) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [name, setName] = useState("");
  const [issueType, setIssueType] = useState(CRAM_ISSUE_TYPES[0]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (prefillSection) { setMessage(prev => prev ? prev : `Issue in "${prefillSection}" section: `); setIssueType("Something looks wrong"); }
  }, [prefillSection]);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!isAllowedEmail(trimmedEmail)) { setEmailError("Please use your .edu school email address."); return; }
    setEmailError("");
    if (!message.trim()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await (supabase as any).from("chapter_questions").insert({ chapter_id: chapterId, student_email: email.trim(), question: message.trim(), issue_type: issueType === "Just saying hello" ? "feedback" : "issue", status: "new", student_name: name.trim() || null });
      supabase.functions.invoke("send-issue-report", { body: { student_email: email.trim(), message: message.trim(), issue_type_label: issueType, course_name: courseDisplayName, chapter_number: chapterNumber || null, chapter_name: chapterName } }).catch(() => {});
      setSent(true);
    } catch { setSubmitError("Something went wrong — email lee@surviveaccounting.com directly"); } finally { setSubmitting(false); }
  };

  return (
    <div className="rounded-xl border p-4 sm:p-5" style={{ borderColor: theme.border, background: theme.cardBg, opacity: isVisible ? 1 : 0.4 }}>
      {sent ? (
        <div className="text-center py-5">
          <CheckCircle className="h-6 w-6 mx-auto" style={{ color: "#22c55e" }} />
          <p className="text-[15px] font-bold mt-3" style={{ color: theme.heading }}>Got it — thank you!</p>
          <p className="text-[13px] mt-1" style={{ color: theme.textMuted }}>I'll reply to {email} if needed.</p>
          <p className="text-[13px] italic mt-1" style={{ color: theme.heading }}>— Lee</p>
        </div>
      ) : (
        <>
          <p className="text-[14px] font-semibold" style={{ color: theme.heading }}>Share Feedback</p>
          <p className="mt-0.5 text-[12px]" style={{ color: theme.textMuted }}>Ask a question, share feedback, or just say hello.</p>
          <p className="mt-1 mb-3 text-[12px] italic" style={{ color: theme.label }}>I read and reply to every message personally.</p>
          <div className="space-y-2.5">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ border: `1px solid ${theme.border}`, background: theme.pageBg, color: theme.text }} />
            <div>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setEmailError(""); }} placeholder="your@university.edu" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ border: `1px solid ${emailError ? "#dc2626" : theme.border}`, background: theme.pageBg, color: theme.text }} />
              {emailError && <p className="text-[11px] mt-1" style={{ color: "#dc2626" }}>{emailError}</p>}
            </div>
            <select value={issueType} onChange={e => setIssueType(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ border: `1px solid ${theme.border}`, background: theme.pageBg, color: theme.text }}>
              {CRAM_ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <textarea value={message} onChange={e => { setMessage(e.target.value); setSubmitError(""); }} placeholder="What's on your mind?" rows={3} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ border: `1px solid ${theme.border}`, background: theme.pageBg, color: theme.text, resize: "vertical" }} />
          </div>
          <button disabled={submitting || !email.trim() || !message.trim()} onClick={handleSubmit} className="w-full mt-3 py-2.5 rounded-lg text-[13px] font-bold text-white transition-all hover:brightness-95" style={{ background: theme.navy, opacity: (submitting || !email.trim() || !message.trim()) ? 0.5 : 1, cursor: submitting ? "wait" : "pointer" }}>
            {submitting ? "Sending…" : "Send to Lee →"}
          </button>
          {submitError && <p className="text-[11px] mt-2" style={{ color: "#dc2626" }}>{submitError}</p>}
        </>
      )}
    </div>
  );
}

// ── About Lee Modal ──
function CramAboutLeeModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-6 sm:p-8" style={{ borderRadius: 16 }}>
        <DialogHeader className="sr-only">
          <DialogTitle>About Lee Ingram</DialogTitle>
          <DialogDescription>Bio and contact info</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">
          <img
            src={LEE_HERO_URL}
            alt="Lee Ingram"
            className="w-full sm:w-[200px] shrink-0 object-cover rounded-lg"
            style={{ maxHeight: 220, aspectRatio: "3/4", objectPosition: "top" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[20px] font-bold" style={{ color: theme.heading }}>Lee Ingram</p>
            <p className="text-[13px] mt-0.5" style={{ color: theme.textMuted }}>Accounting Tutor · Since 2015</p>
            <div className="my-3 h-px" style={{ background: theme.border }} />
            <p className="text-[13px] leading-[1.7]" style={{ color: theme.text }}>
              I loved accounting so much in college that I decided to become a full-time tutor. During the pandemic I went fully virtual and created SurviveAccounting.com — and haven't looked back. Now I travel the world while helping thousands of college students actually understand accounting, not just memorize it. Thanks for stopping by. Best of luck on your exam!
            </p>
            <p className="text-[11px] mt-3 leading-[1.5]" style={{ color: theme.label }}>
              B.A. &amp; M.Acc. in Accounting · University of Mississippi · 3.75 GPA
            </p>
            <div className="mt-3 flex flex-col gap-1.5 text-[12px]">
              <a href="mailto:lee@surviveaccounting.com" className="flex items-center gap-1.5 hover:underline" style={{ color: "#3B82F6" }}>
                ✉ lee@surviveaccounting.com
              </a>
              <a href="https://app.squareup.com/appointments/book/30fvidwxlwh9vt/LY1BCZ6Q74JRF/start" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:underline font-semibold" style={{ color: "#3B82F6" }}>
                📅 Book 1-on-1 Tutoring →
              </a>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Floating Action Bar ──
function CramFloatingActionBar({ chapterId, chapterNumber, chapterName, courseDisplayName }: { chapterId: string; chapterNumber?: number; chapterName: string; courseDisplayName: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const shareUrl = `${STUDENT_BASE_URL}/cram/${chapterId}?preview=true`;

  return (
    <>
      <div className="block sm:hidden fixed z-30" style={{ bottom: 20, right: 16 }}>
        <button onClick={() => { copyToClipboard(shareUrl).then(() => toast.success("Preview link copied — share with classmates!")); }} className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[12px] font-bold shadow-lg" style={{ background: "#FFFFFF", color: "#3B82F6", border: `1px solid ${theme.border}` }}>
          <Share2 className="h-3.5 w-3.5" /> Share
        </button>
      </div>
      <div className="hidden sm:block fixed z-30" style={{ top: 64, right: 16 }}>
        <div className="rounded-xl overflow-hidden" style={{ background: "#FFFFFF", border: `1px solid ${theme.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)" }}>
          <div className="flex items-center">
            {!collapsed && (
              <>
                <button onClick={() => { copyToClipboard(shareUrl).then(() => toast.success("Preview link copied — share with classmates!")); }} className="text-[11px] font-bold px-3 py-2 transition-all hover:scale-[1.03] active:scale-[0.97] whitespace-nowrap flex items-center gap-1.5" style={{ color: "#3B82F6" }}>
                  <Share2 className="h-3 w-3" /> Share This
                </button>
                <div className="w-px h-5" style={{ background: theme.border }} />
                <button onClick={() => setAboutOpen(true)} className="text-[11px] font-semibold px-3 py-2 transition-colors hover:bg-gray-50 whitespace-nowrap" style={{ color: theme.text }}>About Lee Ingram</button>
                <div className="w-px h-5" style={{ background: theme.border }} />
                <button onClick={() => setFeedbackOpen(true)} className="text-[11px] font-semibold px-3 py-2 transition-colors hover:bg-gray-50 whitespace-nowrap flex items-center gap-1" style={{ color: theme.textMuted }}>⚠ Report Issue →</button>
                <div className="w-px h-5" style={{ background: theme.border }} />
              </>
            )}
            <button onClick={() => setCollapsed(!collapsed)} className="px-2.5 py-2 text-[10px] transition-colors hover:bg-gray-50 flex items-center gap-0.5" style={{ color: theme.textMuted }}>
              {collapsed ? <>Show <ChevronDown className="h-3 w-3" /></> : <ChevronUp className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>
      <CramAboutLeeModal open={aboutOpen} onOpenChange={setAboutOpen} />
      {feedbackOpen && (
        <>
          <div onClick={() => setFeedbackOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "#ffffff", borderRadius: 12, padding: 24, width: "min(480px, 90vw)", maxHeight: "90vh", overflowY: "auto", zIndex: 101, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <CramFeedbackFormInline chapterId={chapterId} chapterNumber={chapterNumber} chapterName={chapterName} courseDisplayName={courseDisplayName} onClose={() => setFeedbackOpen(false)} />
          </div>
        </>
      )}
    </>
  );
}

// ── Inline Feedback Form (for modal) ──
function CramFeedbackFormInline({ chapterId, chapterNumber, chapterName, courseDisplayName, onClose }: { chapterId: string; chapterNumber?: number; chapterName: string; courseDisplayName: string; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [name, setName] = useState("");
  const [issueType, setIssueType] = useState(CRAM_ISSUE_TYPES[0]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!isAllowedEmail(trimmedEmail)) { setEmailError("Please use your .edu school email address."); return; }
    setEmailError("");
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await (supabase as any).from("chapter_questions").insert({ chapter_id: chapterId, student_email: email.trim(), question: message.trim(), issue_type: issueType === "General feedback" ? "feedback" : "issue", status: "new", student_name: name.trim() || null });
      supabase.functions.invoke("send-issue-report", { body: { student_email: email.trim(), message: message.trim(), issue_type_label: issueType, course_name: courseDisplayName, chapter_number: chapterNumber || null, chapter_name: chapterName } }).catch(() => {});
      setSent(true);
      setTimeout(onClose, 2000);
    } catch { toast.error("Something went wrong — try again"); } finally { setSubmitting(false); }
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
        <p className="text-[12px]" style={{ color: "#64748b" }}>Course: {courseDisplayName}<br />Chapter: Ch {chapterNumber || "?"} — {chapterName}</p>
      </div>
      <div className="space-y-3">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ border: "1px solid #e0e0e0" }} />
        <div>
          <input type="email" value={email} onChange={e => { setEmail(e.target.value); setEmailError(""); }} placeholder="your@university.edu" className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ border: `1px solid ${emailError ? "#dc2626" : "#e0e0e0"}` }} />
          {emailError && <p className="text-[11px] mt-1" style={{ color: "#dc2626" }}>{emailError}</p>}
        </div>
        <select value={issueType} onChange={e => setIssueType(e.target.value)} className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ border: "1px solid #e0e0e0", background: "#fff" }}>
          {CRAM_ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={`What's on your mind about Ch ${chapterNumber || ""} — ${chapterName}?`} rows={4} className="w-full px-3 py-2 rounded-md text-[13px] outline-none" style={{ border: "1px solid #e0e0e0", resize: "vertical" }} />
      </div>
      <button onClick={handleSubmit} disabled={submitting || !email.trim() || !message.trim()} className="w-full mt-4 py-2.5 rounded-md text-[13px] font-bold text-white transition-opacity" style={{ background: "#14213D", opacity: submitting || !email.trim() || !message.trim() ? 0.5 : 1 }}>
        {submitting ? "Sending…" : "Send to Lee →"}
      </button>
    </>
  );
}
