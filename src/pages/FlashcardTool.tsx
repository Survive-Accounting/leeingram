import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Lock, RotateCcw, Share2, ChevronLeft, ChevronRight, FlipHorizontal } from "lucide-react";

const LEARNWORLDS_ENROLL_URL = "https://survivefinancialaccounting.learnworlds.com";

const CARD_TYPE_COLORS: Record<string, string> = {
  concept: "bg-blue-600 text-white",
  journal_entry: "bg-green-600 text-white",
  account_classification: "bg-amber-500 text-white",
  formula: "bg-purple-600 text-white",
  analysis: "bg-cyan-500 text-black",
};

const CARD_TYPE_LABELS: Record<string, string> = {
  concept: "Concept",
  journal_entry: "Journal Entry",
  account_classification: "Classification",
  formula: "Formula",
  analysis: "Analysis",
};

interface FlashcardData {
  id: string;
  card_type: string;
  front: string;
  back: string;
  sort_order: number;
}

interface DeckData {
  id: string;
  chapter_number: number | null;
  course_code: string | null;
  total_cards: number;
  status: string;
}

export default function FlashcardTool() {
  const [searchParams] = useSearchParams();
  const chapterId = searchParams.get("chapter_id");
  const isPreview = searchParams.get("preview") === "true";

  const [deck, setDeck] = useState<DeckData | null>(null);
  const [cards, setCards] = useState<FlashcardData[]>([]);
  const [chapterName, setChapterName] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playTracked, setPlayTracked] = useState(false);
  const [completionTracked, setCompletionTracked] = useState(false);

  // Determine max cards for preview
  const PREVIEW_LIMIT = 3;
  const effectiveCards = isPreview ? cards.slice(0, PREVIEW_LIMIT) : cards;
  const showPaywall = isPreview && currentIndex >= PREVIEW_LIMIT;
  const totalVisible = isPreview ? Math.min(cards.length, PREVIEW_LIMIT + 1) : cards.length;

  // Fetch deck and cards
  useEffect(() => {
    async function load() {
      if (!chapterId) {
        setError("No chapter specified");
        setLoading(false);
        return;
      }

      // Fetch deck
      const { data: decks, error: dErr } = await supabase
        .from("flashcard_decks")
        .select("id, chapter_number, course_code, total_cards, status")
        .eq("chapter_id", chapterId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (dErr || !decks || decks.length === 0) {
        setError("No flashcard deck found for this chapter");
        setLoading(false);
        return;
      }

      const d = decks[0];
      setDeck(d);

      // Fetch chapter name
      const { data: ch } = await supabase
        .from("chapters")
        .select("chapter_name")
        .eq("id", chapterId)
        .single();
      if (ch) setChapterName(ch.chapter_name);

      // Fetch cards
      const { data: cardData, error: cErr } = await supabase
        .from("flashcards")
        .select("id, card_type, front, back, sort_order")
        .eq("deck_id", d.id)
        .eq("deleted", false)
        .order("sort_order", { ascending: true });

      if (cErr) {
        setError("Failed to load cards");
        setLoading(false);
        return;
      }

      setCards(cardData || []);
      setLoading(false);
    }

    load();
  }, [chapterId]);

  // Track play on first card view
  useEffect(() => {
    if (!deck || playTracked || cards.length === 0) return;
    const key = `fc_played_${deck.id}`;
    if (sessionStorage.getItem(key)) {
      setPlayTracked(true);
      return;
    }
    sessionStorage.setItem(key, "1");
    setPlayTracked(true);
    supabase
      .from("flashcard_decks")
      .update({ plays: (deck as any).plays + 1 } as any)
      .eq("id", deck.id)
      .then(() => {});
  }, [deck, cards, playTracked]);

  // Track completion
  useEffect(() => {
    if (!completed || !deck || completionTracked) return;
    const key = `fc_completed_${deck.id}`;
    if (sessionStorage.getItem(key)) {
      setCompletionTracked(true);
      return;
    }
    sessionStorage.setItem(key, "1");
    setCompletionTracked(true);
    supabase
      .from("flashcard_decks")
      .update({ completions: (deck as any).completions + 1 } as any)
      .eq("id", deck.id)
      .then(() => {});
  }, [completed, deck, completionTracked]);

  const flip = useCallback(() => setFlipped((f) => !f), []);

  const goNext = useCallback(() => {
    setFlipped(false);
    if (currentIndex >= effectiveCards.length - 1) {
      if (isPreview) {
        setCurrentIndex(PREVIEW_LIMIT); // show paywall
      } else {
        setCompleted(true);
      }
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, effectiveCards.length, isPreview]);

  const goPrev = useCallback(() => {
    setFlipped(false);
    setCurrentIndex((i) => Math.max(0, i - 1));
    if (completed) setCompleted(false);
  }, [completed]);

  const restart = useCallback(() => {
    setCurrentIndex(0);
    setFlipped(false);
    setCompleted(false);
  }, []);

  const shareLink = useCallback(() => {
    const url = `${window.location.origin}/tools/flashcards?chapter_id=${chapterId}&preview=true`;
    navigator.clipboard.writeText(url);
    toast.success("Preview link copied — share with friends to show them what they're missing!");
  }, [chapterId]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        flip();
      } else if (e.key === "ArrowRight") {
        goNext();
      } else if (e.key === "ArrowLeft") {
        goPrev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flip, goNext, goPrev]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#131E35" }}>
        <div className="text-white/60 text-lg animate-pulse">Loading flashcards...</div>
      </div>
    );
  }

  if (error || !deck || cards.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#131E35" }}>
        <div className="text-white/60 text-lg">{error || "No cards available"}</div>
      </div>
    );
  }

  const currentCard = !completed && !showPaywall ? effectiveCards[currentIndex] : null;
  const progress = completed ? 1 : (currentIndex + 1) / totalVisible;

  return (
    <div className="min-h-screen flex flex-col select-none" style={{ background: "#131E35" }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-white font-bold text-sm tracking-wide">Survive Accounting</span>
        <span className="text-white/60 text-xs text-center flex-1 truncate px-2">
          {chapterName || `Chapter ${deck.chapter_number}`}
        </span>
        <div className="flex items-center gap-2">
          {currentCard && (
            <Badge className={`${CARD_TYPE_COLORS[currentCard.card_type] || "bg-gray-600 text-white"} text-[10px] px-1.5 py-0.5`}>
              {CARD_TYPE_LABELS[currentCard.card_type] || currentCard.card_type}
            </Badge>
          )}
          <span className="text-white/40 text-xs font-mono">
            {completed ? cards.length : currentIndex + 1} / {isPreview ? totalVisible : cards.length}
          </span>
        </div>
      </div>

      {/* Card area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6">
        {completed ? (
          /* Completion screen */
          <div className="flex flex-col items-center gap-6 text-center animate-in fade-in duration-500">
            <div className="text-5xl">🎉</div>
            <h2 className="text-white text-2xl font-bold">Deck Complete!</h2>
            <p className="text-white/50 text-sm">{cards.length} cards reviewed</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={restart}
                className="border-cyan-400 text-cyan-400 hover:bg-cyan-400/10"
              >
                <RotateCcw className="w-4 h-4 mr-2" /> Restart
              </Button>
              <Button
                variant="outline"
                onClick={shareLink}
                className="border-cyan-400 text-cyan-400 hover:bg-cyan-400/10"
              >
                <Share2 className="w-4 h-4 mr-2" /> Share this deck
              </Button>
            </div>
          </div>
        ) : showPaywall ? (
          /* Paywall card */
          <div className="w-full max-w-lg">
            <div
              className="rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-5 min-h-[320px]"
              style={{ background: "#1A2E55", border: "2px solid rgba(0,255,255,0.3)" }}
            >
              <Lock className="w-12 h-12 text-cyan-400" />
              <h3 className="text-white text-xl font-bold">Want all {cards.length} cards?</h3>
              <p className="text-white/60 text-sm">
                Get full access with a Survive Accounting Study Pass →
              </p>
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
        ) : currentCard ? (
          /* Flashcard with flip */
          <div className="w-full max-w-lg" style={{ perspective: "1200px" }}>
            <div
              onClick={flip}
              className="cursor-pointer relative w-full min-h-[320px] transition-transform duration-500"
              style={{
                transformStyle: "preserve-3d",
                transform: flipped ? "rotateY(180deg)" : "rotateY(0)",
              }}
            >
              {/* Front face */}
              <div
                className="absolute inset-0 rounded-2xl p-8 flex items-center justify-center text-center"
                style={{
                  backfaceVisibility: "hidden",
                  background: "#1A2E55",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <p className="text-white text-lg leading-relaxed font-medium">{currentCard.front}</p>
              </div>
              {/* Back face */}
              <div
                className="absolute inset-0 rounded-2xl p-8 flex items-center justify-center text-center"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  background: "#00FFFF",
                }}
              >
                <p className="text-base leading-relaxed font-medium" style={{ color: "#0A0A0A" }}>
                  {currentCard.back}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Navigation buttons (hidden on completion/paywall) */}
        {!completed && !showPaywall && (
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              onClick={flip}
              className="border-cyan-400 text-cyan-400 hover:bg-cyan-400/10 px-6"
            >
              <FlipHorizontal className="w-4 h-4 mr-2" /> Flip
            </Button>
            <Button
              variant="ghost"
              onClick={goNext}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full" style={{ background: "rgba(255,255,255,0.1)" }}>
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${progress * 100}%`, background: "#00FFFF" }}
        />
      </div>
    </div>
  );
}
