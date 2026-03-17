import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Lock, RotateCcw, Share2, ChevronRight, Eye, Check, Minus, X } from "lucide-react";

const LEARNWORLDS_ENROLL_URL = "https://survivefinancialaccounting.learnworlds.com";

interface FormulaData {
  id: string;
  formula_name: string;
  formula_text: string;
  hint: string | null;
  sort_order: number;
}

type Rating = "got_it" | "almost" | "missed";

export default function FormulaRecallTool() {
  const [searchParams] = useSearchParams();
  const chapterId = searchParams.get("chapter_id");
  const isPreview = searchParams.get("preview") === "true";

  const [setData, setSetData] = useState<{ id: string; plays: number; completions: number } | null>(null);
  const [formulas, setFormulas] = useState<FormulaData[]>([]);
  const [chapterName, setChapterName] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playTracked, setPlayTracked] = useState(false);
  const [completionTracked, setCompletionTracked] = useState(false);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [currentRated, setCurrentRated] = useState(false);

  const PREVIEW_LIMIT = 3;
  const effectiveFormulas = isPreview ? formulas.slice(0, PREVIEW_LIMIT) : formulas;
  const showPaywall = isPreview && currentIndex >= PREVIEW_LIMIT;
  const totalVisible = isPreview ? Math.min(formulas.length, PREVIEW_LIMIT + 1) : formulas.length;

  useEffect(() => {
    async function load() {
      if (!chapterId) { setError("No chapter specified"); setLoading(false); return; }

      const { data: sets } = await supabase
        .from("formula_sets")
        .select("id, plays, completions, status")
        .eq("chapter_id", chapterId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!sets || sets.length === 0) { setError("No formula set found for this chapter"); setLoading(false); return; }
      const s = sets[0];
      setSetData({ id: s.id, plays: s.plays ?? 0, completions: s.completions ?? 0 });

      const { data: ch } = await supabase.from("chapters").select("chapter_name").eq("id", chapterId).single();
      if (ch) setChapterName(ch.chapter_name);

      const { data: items } = await supabase
        .from("formula_items")
        .select("id, formula_name, formula_text, hint, sort_order")
        .eq("set_id", s.id)
        .eq("deleted", false)
        .order("sort_order", { ascending: true });

      setFormulas(items || []);
      setLoading(false);
    }
    load();
  }, [chapterId]);

  // Track play
  useEffect(() => {
    if (!setData || playTracked || formulas.length === 0) return;
    const key = `fr_played_${setData.id}`;
    if (sessionStorage.getItem(key)) { setPlayTracked(true); return; }
    sessionStorage.setItem(key, "1");
    setPlayTracked(true);
    supabase.from("formula_sets").update({ plays: setData.plays + 1 } as any).eq("id", setData.id).then(() => {});
  }, [setData, formulas, playTracked]);

  // Track completion
  useEffect(() => {
    if (!completed || !setData || completionTracked) return;
    const key = `fr_completed_${setData.id}`;
    if (sessionStorage.getItem(key)) { setCompletionTracked(true); return; }
    sessionStorage.setItem(key, "1");
    setCompletionTracked(true);
    supabase.from("formula_sets").update({ completions: setData.completions + 1 } as any).eq("id", setData.id).then(() => {});
  }, [completed, setData, completionTracked]);

  const reveal = useCallback(() => setRevealed(true), []);

  const rate = useCallback((r: Rating) => {
    const current = effectiveFormulas[currentIndex];
    if (current) setRatings(prev => ({ ...prev, [current.id]: r }));
    setCurrentRated(true);
  }, [currentIndex, effectiveFormulas]);

  const goNext = useCallback(() => {
    setRevealed(false);
    setUserInput("");
    setCurrentRated(false);
    if (currentIndex >= effectiveFormulas.length - 1) {
      if (isPreview) setCurrentIndex(PREVIEW_LIMIT);
      else setCompleted(true);
    } else {
      setCurrentIndex(i => i + 1);
    }
  }, [currentIndex, effectiveFormulas.length, isPreview]);

  const restart = useCallback(() => {
    setCurrentIndex(0);
    setRevealed(false);
    setUserInput("");
    setCurrentRated(false);
    setCompleted(false);
    setRatings({});
  }, []);

  const shareLink = useCallback(() => {
    const url = `${window.location.origin}/tools/formula-recall?chapter_id=${chapterId}&preview=true`;
    navigator.clipboard.writeText(url);
    toast.success("Preview link copied — share with friends!");
  }, [chapterId]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); if (!revealed) reveal(); }
      else if (e.key === "ArrowRight" && (revealed || currentRated)) goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reveal, goNext, revealed, currentRated]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#131E35" }}>
        <div className="text-white/60 text-lg animate-pulse">Loading formulas...</div>
      </div>
    );
  }

  if (error || !setData || formulas.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#131E35" }}>
        <div className="text-white/60 text-lg">{error || "No formulas available"}</div>
      </div>
    );
  }

  const currentFormula = !completed && !showPaywall ? effectiveFormulas[currentIndex] : null;
  const progress = completed ? 1 : (currentIndex + 1) / totalVisible;

  const gotIt = Object.values(ratings).filter(r => r === "got_it").length;
  const almost = Object.values(ratings).filter(r => r === "almost").length;
  const missed = Object.values(ratings).filter(r => r === "missed").length;

  return (
    <div className="min-h-screen flex flex-col select-none" style={{ background: "#131E35" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-white font-bold text-sm tracking-wide">Survive Accounting</span>
        <span className="text-white/60 text-xs text-center flex-1 truncate px-2">{chapterName || "Formula Recall"}</span>
        <span className="text-white/40 text-xs font-mono">
          {completed ? formulas.length : currentIndex + 1} / {isPreview ? totalVisible : formulas.length}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6">
        {completed ? (
          <div className="flex flex-col items-center gap-6 text-center animate-in fade-in duration-500">
            <div className="text-5xl">🧠</div>
            <h2 className="text-white text-2xl font-bold">Formula Review Complete!</h2>
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-400">{gotIt}</div>
                <div className="text-white/50">Got it</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-400">{almost}</div>
                <div className="text-white/50">Almost</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{missed}</div>
                <div className="text-white/50">Missed</div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={restart} className="border-cyan-400 text-cyan-400 hover:bg-cyan-400/10">
                <RotateCcw className="w-4 h-4 mr-2" /> Restart
              </Button>
              <Button variant="outline" onClick={shareLink} className="border-cyan-400 text-cyan-400 hover:bg-cyan-400/10">
                <Share2 className="w-4 h-4 mr-2" /> Share
              </Button>
            </div>
          </div>
        ) : showPaywall ? (
          <div className="w-full max-w-lg">
            <div
              className="rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-5 min-h-[320px]"
              style={{ background: "#1A2E55", border: "2px solid rgba(0,255,255,0.3)" }}
            >
              <Lock className="w-12 h-12 text-cyan-400" />
              <h3 className="text-white text-xl font-bold">Want all {formulas.length} formulas?</h3>
              <p className="text-white/60 text-sm">Get full access with a Survive Accounting Study Pass →</p>
              <a
                href={LEARNWORLDS_ENROLL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-6 py-3 rounded-lg font-semibold text-sm transition-colors"
                style={{ background: "#00FFFF", color: "#0A0A0A" }}
              >
                Get Full Access
              </a>
            </div>
          </div>
        ) : currentFormula ? (
          <div className="w-full max-w-lg space-y-5">
            {/* Formula card */}
            <div
              className="rounded-2xl p-8 min-h-[280px] flex flex-col gap-4"
              style={{ background: "#1A2E55", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <h3 className="text-white text-xl font-bold text-center">{currentFormula.formula_name}</h3>

              {currentFormula.hint && (
                <p className="text-center text-sm italic" style={{ color: "#00FFFF" }}>
                  Hint: {currentFormula.hint}
                </p>
              )}

              <div className="mt-2">
                <Input
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  readOnly={revealed}
                  placeholder="Write the formula from memory, then reveal..."
                  className="bg-white text-black border-none text-sm h-12"
                />
              </div>

              {revealed && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                  <div className="rounded-lg p-3 text-center" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
                    <p className="text-emerald-400 font-medium text-sm">{currentFormula.formula_text}</p>
                  </div>

                  {!currentRated && (
                    <div className="text-center space-y-2">
                      <p className="text-white/50 text-xs">How did you do?</p>
                      <div className="flex justify-center gap-2">
                        <Button size="sm" onClick={() => rate("got_it")} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3">
                          <Check className="w-3 h-3 mr-1" /> Got it
                        </Button>
                        <Button size="sm" onClick={() => rate("almost")} className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 px-3">
                          <Minus className="w-3 h-3 mr-1" /> Almost
                        </Button>
                        <Button size="sm" onClick={() => rate("missed")} className="bg-red-600 hover:bg-red-700 text-white text-xs h-8 px-3">
                          <X className="w-3 h-3 mr-1" /> Missed
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-3">
              {!revealed ? (
                <Button onClick={reveal} className="px-6" style={{ background: "#00FFFF", color: "#0A0A0A" }}>
                  <Eye className="w-4 h-4 mr-2" /> Reveal Formula
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={goNext}
                  disabled={!revealed}
                  className="text-white/60 hover:text-white hover:bg-white/10"
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full" style={{ background: "rgba(255,255,255,0.1)" }}>
        <div className="h-full transition-all duration-300" style={{ width: `${progress * 100}%`, background: "#00FFFF" }} />
      </div>
    </div>
  );
}
