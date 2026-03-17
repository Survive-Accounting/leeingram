import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Lock, RotateCcw, Share2, ChevronRight, Check, X, HelpCircle, ChevronDown } from "lucide-react";

const LEARNWORLDS_ENROLL_URL = "https://survivefinancialaccounting.learnworlds.com";
const PREVIEW_LIMIT = 2;

interface EntryLine {
  side: "debit" | "credit";
  account_name: string;
  account_type?: string;
  normal_balance?: string;
}

interface EntryItem {
  id: string;
  transaction_description: string;
  date_label: string | null;
  entries: EntryLine[];
  sort_order: number;
}

interface AccountOption {
  account_name: string;
  account_type: string;
  normal_balance: string;
}

type TypeFilter = "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";

const TYPE_COLORS: Record<TypeFilter, string> = {
  Asset: "bg-blue-600 hover:bg-blue-700 border-blue-500",
  Liability: "bg-red-600 hover:bg-red-700 border-red-500",
  Equity: "bg-purple-600 hover:bg-purple-700 border-purple-500",
  Revenue: "bg-green-600 hover:bg-green-700 border-green-500",
  Expense: "bg-amber-600 hover:bg-amber-700 border-amber-500",
};

export default function EntryBuilderTool() {
  const [searchParams] = useSearchParams();
  const chapterId = searchParams.get("chapter_id");
  const isPreview = searchParams.get("preview") === "true";

  const [setData, setSetData] = useState<{ id: string; plays: number; completions: number } | null>(null);
  const [items, setItems] = useState<EntryItem[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [chapterName, setChapterName] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [playTracked, setPlayTracked] = useState(false);
  const [completionTracked, setCompletionTracked] = useState(false);

  // Per-entry state: user's guesses for each line index
  const [guesses, setGuesses] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  // Which slot has the picker open
  const [activePicker, setActivePicker] = useState<number | null>(null);
  const [pickerStep, setPickerStep] = useState<"type" | "account">("type");
  const [selectedType, setSelectedType] = useState<TypeFilter | null>(null);
  const [searchText, setSearchText] = useState("");

  // Cumulative scoring
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalSlots, setTotalSlots] = useState(0);

  const effectiveItems = isPreview ? items.slice(0, PREVIEW_LIMIT) : items;
  const showPaywall = isPreview && currentIndex >= PREVIEW_LIMIT;

  // Load data
  useEffect(() => {
    async function load() {
      if (!chapterId) { setError("No chapter specified"); setLoading(false); return; }

      const { data: sets } = await supabase
        .from("entry_builder_sets")
        .select("id, plays, completions, status")
        .eq("chapter_id", chapterId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!sets || sets.length === 0) { setError("No entry builder set found"); setLoading(false); return; }
      const s = sets[0];
      setSetData({ id: s.id, plays: s.plays ?? 0, completions: s.completions ?? 0 });

      const { data: ch } = await supabase.from("chapters").select("chapter_name").eq("id", chapterId).single();
      if (ch) setChapterName(ch.chapter_name);

      const { data: entryItems } = await supabase
        .from("entry_builder_items")
        .select("id, transaction_description, date_label, entries, sort_order")
        .eq("set_id", s.id)
        .eq("deleted", false)
        .order("sort_order", { ascending: true });

      const parsed = (entryItems ?? []).map((item: any) => ({
        ...item,
        entries: Array.isArray(item.entries) ? item.entries : [],
      }));
      setItems(parsed);

      const { data: accs } = await supabase
        .from("entry_builder_accounts")
        .select("account_name, account_type, normal_balance")
        .eq("chapter_id", chapterId)
        .order("account_name");
      setAccounts(accs ?? []);

      setLoading(false);
    }
    load();
  }, [chapterId]);

  // Track plays
  useEffect(() => {
    if (!setData || playTracked) return;
    const key = `eb_played_${setData.id}`;
    if (sessionStorage.getItem(key)) { setPlayTracked(true); return; }
    sessionStorage.setItem(key, "1");
    setPlayTracked(true);
    supabase.from("entry_builder_sets").update({ plays: setData.plays + 1 }).eq("id", setData.id).then(() => {});
  }, [setData, playTracked]);

  // Track completion
  useEffect(() => {
    if (!completed || !setData || completionTracked) return;
    const key = `eb_completed_${setData.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    setCompletionTracked(true);
    supabase.from("entry_builder_sets").update({ completions: setData.completions + 1 }).eq("id", setData.id).then(() => {});
  }, [completed, setData, completionTracked]);

  const currentEntry = effectiveItems[currentIndex];
  const entryLines = currentEntry?.entries ?? [];

  const allFilled = entryLines.every((_, i) => guesses[i] !== undefined);

  const handleSelectAccount = (lineIdx: number, accountName: string) => {
    setGuesses((prev) => ({ ...prev, [lineIdx]: accountName }));
    setActivePicker(null);
    setPickerStep("type");
    setSelectedType(null);
    setSearchText("");
  };

  const handleSubmit = () => {
    if (!allFilled) return;
    let correct = 0;
    entryLines.forEach((line, i) => {
      if ((guesses[i] ?? "").toLowerCase().trim() === line.account_name.toLowerCase().trim()) correct++;
    });
    setTotalCorrect((p) => p + correct);
    setTotalSlots((p) => p + entryLines.length);
    setSubmitted(true);
  };

  const handleNext = () => {
    const nextIdx = currentIndex + 1;
    if (nextIdx >= effectiveItems.length) {
      setCompleted(true);
      return;
    }
    setCurrentIndex(nextIdx);
    setGuesses({});
    setSubmitted(false);
    setActivePicker(null);
    setPickerStep("type");
    setSelectedType(null);
    setSearchText("");
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setGuesses({});
    setSubmitted(false);
    setCompleted(false);
    setTotalCorrect(0);
    setTotalSlots(0);
    setActivePicker(null);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/tools/entry-builder?chapter_id=${chapterId}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  };

  const filteredAccounts = useCallback(() => {
    let filtered = accounts;
    if (selectedType) {
      filtered = filtered.filter((a) => a.account_type === selectedType);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      // Search ALL accounts when typing, regardless of type filter
      filtered = accounts.filter((a) => a.account_name.toLowerCase().includes(q));
    }
    return filtered.sort((a, b) => a.account_name.localeCompare(b.account_name));
  }, [accounts, selectedType, searchText]);

  // --- Render ---

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1729] flex items-center justify-center">
        <div className="text-white/60 text-sm animate-pulse">Loading Entry Builder...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f1729] flex items-center justify-center">
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1729] text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0f1729]/90 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-cyan-400">Entry Builder</span>
          {chapterName && <span className="text-white/40 text-xs ml-2">{chapterName}</span>}
        </div>
        {!completed && !showPaywall && (
          <span className="text-white/50 text-xs">
            {currentIndex + 1} / {effectiveItems.length}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        {showPaywall ? (
          <PaywallCard />
        ) : completed ? (
          <CompletionCard
            totalCorrect={totalCorrect}
            totalSlots={totalSlots}
            onRestart={handleRestart}
            onShare={handleShare}
          />
        ) : currentEntry ? (
          <div className="w-full max-w-2xl space-y-5">
            {/* Transaction description */}
            <div>
              <p className="text-white font-semibold text-base leading-snug">{currentEntry.transaction_description}</p>
              {currentEntry.date_label && (
                <p className="text-cyan-400 text-[13px] mt-1 italic">{currentEntry.date_label}</p>
              )}
            </div>

            {/* Journal entry table */}
            <div className="border border-white/10 rounded-lg overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr_80px_80px] bg-[#1a2744] text-white/80 text-xs font-semibold">
                <div className="px-3 py-2">Account</div>
                <div className="px-3 py-2 text-center">Debit</div>
                <div className="px-3 py-2 text-center">Credit</div>
              </div>

              {/* Rows */}
              {entryLines.map((line, idx) => {
                const guess = guesses[idx];
                const isCorrect = submitted && guess?.toLowerCase().trim() === line.account_name.toLowerCase().trim();
                const isWrong = submitted && guess !== undefined && !isCorrect;
                const isCredit = line.side === "credit";

                return (
                  <div key={idx} className="relative">
                    <div
                      className={`grid grid-cols-[1fr_80px_80px] border-t border-white/5 ${
                        submitted ? (isCorrect ? "bg-green-900/20" : "bg-red-900/20") : "bg-[#0f1729]"
                      }`}
                    >
                      {/* Account cell */}
                      <div className={`px-3 py-2.5 ${isCredit ? "pl-8" : ""}`}>
                        {guess === undefined ? (
                          <button
                            onClick={() => {
                              if (submitted) return;
                              setActivePicker(activePicker === idx ? null : idx);
                              setPickerStep("type");
                              setSelectedType(null);
                              setSearchText("");
                            }}
                            className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
                          >
                            <HelpCircle className="h-4 w-4" />
                            ???
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${isCorrect ? "text-green-400" : isWrong ? "text-red-400" : "text-white"}`}>
                              {guess}
                            </span>
                            {submitted && isCorrect && <Check className="h-3.5 w-3.5 text-green-400" />}
                            {submitted && isWrong && (
                              <span className="text-xs text-white/40 ml-1">→ {line.account_name}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Debit / Credit placeholders */}
                      <div className="px-3 py-2.5 text-center text-white/20 text-sm">—</div>
                      <div className="px-3 py-2.5 text-center text-white/20 text-sm">—</div>
                    </div>

                    {/* Inline picker */}
                    {activePicker === idx && !submitted && (
                      <AccountPicker
                        step={pickerStep}
                        selectedType={selectedType}
                        searchText={searchText}
                        filteredAccounts={filteredAccounts()}
                        onSelectType={(t) => { setSelectedType(t); setPickerStep("account"); }}
                        onSelectAccount={(name) => handleSelectAccount(idx, name)}
                        onSearchChange={setSearchText}
                        onClose={() => { setActivePicker(null); setPickerStep("type"); setSelectedType(null); setSearchText(""); }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              {!submitted && (
                <Button
                  onClick={handleSubmit}
                  disabled={!allFilled}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  <Check className="h-4 w-4 mr-1.5" /> Submit
                </Button>
              )}
              {submitted && (
                <>
                  <div className="flex items-center text-sm text-white/60 mr-auto">
                    {(() => {
                      let c = 0;
                      entryLines.forEach((line, i) => {
                        if ((guesses[i] ?? "").toLowerCase().trim() === line.account_name.toLowerCase().trim()) c++;
                      });
                      return `${c} of ${entryLines.length} accounts correct`;
                    })()}
                  </div>
                  <Button onClick={handleNext} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                    {currentIndex + 1 >= effectiveItems.length ? "Finish" : "Next Entry"} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="text-white/40 text-sm">No entries available.</div>
        )}
      </div>
    </div>
  );
}

// ── Account Picker ──

function AccountPicker({
  step,
  selectedType,
  searchText,
  filteredAccounts,
  onSelectType,
  onSelectAccount,
  onSearchChange,
  onClose,
}: {
  step: "type" | "account";
  selectedType: TypeFilter | null;
  searchText: string;
  filteredAccounts: AccountOption[];
  onSelectType: (t: TypeFilter) => void;
  onSelectAccount: (name: string) => void;
  onSearchChange: (s: string) => void;
  onClose: () => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "account" && searchRef.current) {
      searchRef.current.focus();
    }
  }, [step]);

  return (
    <div className="mx-3 mb-2 mt-1 bg-[#1a2744] border border-white/10 rounded-lg p-3 shadow-xl animate-in slide-in-from-top-2 duration-200">
      {step === "type" ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/50 font-medium">Select account type:</span>
            <button onClick={onClose} className="text-white/30 hover:text-white/60"><X className="h-3.5 w-3.5" /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["Asset", "Liability", "Equity", "Revenue", "Expense"] as TypeFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => onSelectType(t)}
                className={`px-3 py-2 rounded-md text-white text-xs font-semibold border transition-all ${TYPE_COLORS[t]}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/50 font-medium">
              {selectedType ? <span className="text-white/70">{selectedType}</span> : "All"} accounts:
            </span>
            <button onClick={onClose} className="text-white/30 hover:text-white/60"><X className="h-3.5 w-3.5" /></button>
          </div>
          <Input
            ref={searchRef}
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search accounts..."
            className="h-8 text-xs bg-[#0f1729] border-white/10 text-white mb-2 placeholder:text-white/30"
          />
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {filteredAccounts.length === 0 ? (
              <div className="text-white/30 text-xs py-2 text-center">No accounts found</div>
            ) : (
              filteredAccounts.map((acc) => (
                <button
                  key={acc.account_name}
                  onClick={() => onSelectAccount(acc.account_name)}
                  className="w-full text-left px-2 py-1.5 rounded text-xs text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-between"
                >
                  <span>{acc.account_name}</span>
                  <span className="text-[10px] text-white/30">{acc.account_type}</span>
                </button>
              ))
            )}
          </div>
          {/* Free text submit */}
          {searchText.trim() && !filteredAccounts.some((a) => a.account_name.toLowerCase() === searchText.toLowerCase()) && (
            <button
              onClick={() => onSelectAccount(searchText.trim())}
              className="mt-1 w-full text-left px-2 py-1.5 rounded text-xs text-cyan-400 hover:bg-cyan-900/30 transition-colors"
            >
              Use "{searchText.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Paywall Card ──

function PaywallCard() {
  return (
    <div className="w-full max-w-md text-center space-y-4 px-4">
      <div className="bg-[#1a2744] border border-white/10 rounded-xl p-8 space-y-4">
        <Lock className="h-10 w-10 text-cyan-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Preview Complete</h2>
        <p className="text-white/50 text-sm">Unlock all journal entries with full access to the course.</p>
        <a
          href={LEARNWORLDS_ENROLL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg text-sm transition-colors"
        >
          Enroll Now
        </a>
      </div>
    </div>
  );
}

// ── Completion Card ──

function CompletionCard({
  totalCorrect,
  totalSlots,
  onRestart,
  onShare,
}: {
  totalCorrect: number;
  totalSlots: number;
  onRestart: () => void;
  onShare: () => void;
}) {
  const pct = totalSlots > 0 ? Math.round((totalCorrect / totalSlots) * 100) : 0;

  return (
    <div className="w-full max-w-md text-center space-y-4 px-4">
      <div className="bg-[#1a2744] border border-white/10 rounded-xl p-8 space-y-5">
        <h2 className="text-xl font-bold text-white">All Entries Complete! 🎉</h2>
        <div className="space-y-2">
          <div className="text-4xl font-bold text-cyan-400">{pct}%</div>
          <p className="text-white/50 text-sm">
            {totalCorrect} of {totalSlots} accounts correct
          </p>
        </div>
        <div className="flex gap-3 justify-center pt-2">
          <Button onClick={onRestart} variant="outline" className="border-white/20 text-white hover:bg-white/10">
            <RotateCcw className="h-4 w-4 mr-1.5" /> Restart
          </Button>
          <Button onClick={onShare} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            <Share2 className="h-4 w-4 mr-1.5" /> Share
          </Button>
        </div>
      </div>
    </div>
  );
}
