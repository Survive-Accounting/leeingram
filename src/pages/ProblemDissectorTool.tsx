import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Lock, Share2, ChevronRight, Eye, Clock, Sparkles } from "lucide-react";

const LEARNWORLDS_ENROLL_URL = "https://survivefinancialaccounting.learnworlds.com";
const READ_TIMER_SECONDS = 30;

interface Highlight {
  text: string;
  color: string;
  label: string;
  category: string;
}

type Phase = "read" | "identify" | "complete";

const CATEGORY_ORDER = ["amount", "rate", "date", "term", "method", "entity", "account", "other"];

export default function ProblemDissectorTool() {
  const [searchParams] = useSearchParams();
  const assetId = searchParams.get("asset_id");
  const isPreview = searchParams.get("preview") === "true";

  const [problemData, setProblemData] = useState<{
    id: string;
    problem_text: string;
    highlights: Highlight[];
    plays: number;
    completions: number;
    chapter_id: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assetName, setAssetName] = useState("");

  // Phase state
  const [phase, setPhase] = useState<Phase>("read");
  const [timeLeft, setTimeLeft] = useState(READ_TIMER_SECONDS);
  const [notes, setNotes] = useState("");
  const [clickedHighlights, setClickedHighlights] = useState<Set<number>>(new Set());
  const [activePopover, setActivePopover] = useState<number | null>(null);
  const [playTracked, setPlayTracked] = useState(false);
  const [completionTracked, setCompletionTracked] = useState(false);

  // Next asset in chapter
  const [nextAssetId, setNextAssetId] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    async function load() {
      if (!assetId) { setError("No asset specified"); setLoading(false); return; }

      const { data: problems } = await supabase
        .from("dissector_problems")
        .select("id, problem_text, highlights, plays, completions, chapter_id, teaching_asset_id")
        .eq("teaching_asset_id", assetId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!problems || problems.length === 0) {
        setError("No dissector problem found for this asset");
        setLoading(false);
        return;
      }

      const p = problems[0];
      const highlights = Array.isArray(p.highlights) ? (p.highlights as unknown as Highlight[]) : [];
      setProblemData({
        id: p.id,
        problem_text: p.problem_text,
        highlights,
        plays: p.plays ?? 0,
        completions: p.completions ?? 0,
        chapter_id: p.chapter_id,
      });

      // Fetch asset name
      const { data: asset } = await supabase
        .from("teaching_assets")
        .select("asset_name")
        .eq("id", assetId)
        .single();
      if (asset) setAssetName(asset.asset_name || "");

      // Find next asset in same chapter
      if (p.chapter_id) {
        const { data: nextProblems } = await supabase
          .from("dissector_problems")
          .select("teaching_asset_id")
          .eq("chapter_id", p.chapter_id)
          .neq("teaching_asset_id", assetId)
          .eq("status", "published")
          .limit(1);
        if (nextProblems && nextProblems.length > 0) {
          setNextAssetId(nextProblems[0].teaching_asset_id);
        }
      }

      setLoading(false);
    }
    load();
  }, [assetId]);

  // Track plays
  useEffect(() => {
    if (!problemData || playTracked) return;
    const key = `pd_played_${problemData.id}`;
    if (sessionStorage.getItem(key)) { setPlayTracked(true); return; }
    sessionStorage.setItem(key, "1");
    setPlayTracked(true);
    supabase.from("dissector_problems").update({ plays: problemData.plays + 1 }).eq("id", problemData.id).then(() => {});
  }, [problemData, playTracked]);

  // Track completion
  useEffect(() => {
    if (phase !== "complete" || !problemData || completionTracked) return;
    const key = `pd_completed_${problemData.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    setCompletionTracked(true);
    supabase.from("dissector_problems").update({ completions: problemData.completions + 1 }).eq("id", problemData.id).then(() => {});
  }, [phase, problemData, completionTracked]);

  // Countdown timer for Phase 1
  useEffect(() => {
    if (phase !== "read" || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, timeLeft]);

  // Auto-advance when timer hits 0
  useEffect(() => {
    if (phase === "read" && timeLeft === 0) {
      setPhase("identify");
    }
  }, [phase, timeLeft]);

  const highlights = problemData?.highlights ?? [];
  const exploredCount = clickedHighlights.size;
  const totalHighlights = highlights.length;
  const canAdvanceFromIdentify = exploredCount >= Math.ceil(totalHighlights * 0.5);

  const handleHighlightClick = (idx: number) => {
    if (isPreview) return; // paywall blocks
    setClickedHighlights((prev) => new Set(prev).add(idx));
    setActivePopover(activePopover === idx ? null : idx);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/tools/problem-dissector?asset_id=${assetId}&preview=true`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  };

  // Build highlighted text segments
  const buildSegments = useCallback(() => {
    if (!problemData) return [];
    const text = problemData.problem_text;
    if (!highlights.length) return [{ type: "text" as const, content: text }];

    // Find all highlight positions, sort by position
    const positions: { start: number; end: number; idx: number }[] = [];
    for (let i = 0; i < highlights.length; i++) {
      const h = highlights[i];
      const start = text.indexOf(h.text);
      if (start >= 0) {
        positions.push({ start, end: start + h.text.length, idx: i });
      }
    }
    positions.sort((a, b) => a.start - b.start);

    // Remove overlaps
    const cleaned: typeof positions = [];
    for (const p of positions) {
      const last = cleaned[cleaned.length - 1];
      if (!last || p.start >= last.end) cleaned.push(p);
    }

    const segments: { type: "text" | "highlight"; content: string; idx?: number }[] = [];
    let cursor = 0;
    for (const p of cleaned) {
      if (p.start > cursor) {
        segments.push({ type: "text", content: text.slice(cursor, p.start) });
      }
      segments.push({ type: "highlight", content: text.slice(p.start, p.end), idx: p.idx });
      cursor = p.end;
    }
    if (cursor < text.length) {
      segments.push({ type: "text", content: text.slice(cursor) });
    }
    return segments;
  }, [problemData, highlights]);

  // Group highlights by category for summary
  const groupedHighlights = useCallback(() => {
    const groups: Record<string, Highlight[]> = {};
    for (const h of highlights) {
      const cat = h.category || "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(h);
    }
    return CATEGORY_ORDER
      .filter((c) => groups[c]?.length)
      .map((c) => ({ category: c, items: groups[c] }));
  }, [highlights]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1729] flex items-center justify-center">
        <div className="text-white/60 text-sm animate-pulse">Loading Problem Dissector...</div>
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
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <span className="text-lg font-bold tracking-tight text-cyan-400">Problem Dissector</span>
          {assetName && <span className="text-white/40 text-xs ml-2 max-w-[200px] truncate">{assetName}</span>}
        </div>
        <PhaseIndicator phase={phase} />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center p-4 md:p-6">
        <div className="w-full max-w-3xl">
          {phase === "read" && (
            <ReadPhase
              problemText={problemData?.problem_text ?? ""}
              timeLeft={timeLeft}
              notes={notes}
              onNotesChange={setNotes}
              onReady={() => setPhase("identify")}
            />
          )}

          {phase === "identify" && (
            <IdentifyPhase
              segments={buildSegments()}
              highlights={highlights}
              clickedHighlights={clickedHighlights}
              activePopover={activePopover}
              onHighlightClick={handleHighlightClick}
              exploredCount={exploredCount}
              totalHighlights={totalHighlights}
              canAdvance={canAdvanceFromIdentify}
              onAdvance={() => setPhase("complete")}
              isPreview={isPreview}
            />
          )}

          {phase === "complete" && (
            <CompletePhase
              grouped={groupedHighlights()}
              onShare={handleShare}
              nextAssetId={nextAssetId}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Phase Indicator ──

function PhaseIndicator({ phase }: { phase: Phase }) {
  const labels: Record<Phase, string> = {
    read: "Phase 1: Read",
    identify: "Phase 2: Identify",
    complete: "Complete",
  };
  return (
    <span className="text-xs text-white/40 font-medium">{labels[phase]}</span>
  );
}

// ── Phase 1: Read ──

function ReadPhase({
  problemText,
  timeLeft,
  notes,
  onNotesChange,
  onReady,
}: {
  problemText: string;
  timeLeft: number;
  notes: string;
  onNotesChange: (v: string) => void;
  onReady: () => void;
}) {
  const pct = (timeLeft / READ_TIMER_SECONDS) * 100;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div className="space-y-5">
      {/* Instruction bar */}
      <div className="bg-[#1a2744] border border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white">Phase 1: Read the problem carefully</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-white/40" />
            <span className="text-sm font-mono text-white/60">{mins}:{secs.toString().padStart(2, "0")}</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-cyan-500 transition-all duration-1000 ease-linear rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Problem text */}
      <div className="bg-[#1a2744]/50 border border-white/5 rounded-lg p-5">
        <p className="text-[15px] leading-relaxed text-white/90 whitespace-pre-wrap">{problemText}</p>
      </div>

      {/* Notes area */}
      <div className="space-y-2">
        <p className="text-white/40 text-xs italic">Jot down the key information you notice...</p>
        <Textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Your notes (local only, not saved)..."
          className="bg-[#0f1729] border-white/10 text-white/80 text-sm min-h-[80px] placeholder:text-white/20 resize-none"
        />
      </div>

      {/* Ready button */}
      <div className="flex justify-end">
        <Button onClick={onReady} className="bg-cyan-600 hover:bg-cyan-700 text-white">
          I'm Ready <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ── Phase 2: Identify ──

function IdentifyPhase({
  segments,
  highlights,
  clickedHighlights,
  activePopover,
  onHighlightClick,
  exploredCount,
  totalHighlights,
  canAdvance,
  onAdvance,
  isPreview,
}: {
  segments: { type: "text" | "highlight"; content: string; idx?: number }[];
  highlights: Highlight[];
  clickedHighlights: Set<number>;
  activePopover: number | null;
  onHighlightClick: (idx: number) => void;
  exploredCount: number;
  totalHighlights: number;
  canAdvance: boolean;
  onAdvance: () => void;
  isPreview: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Instruction bar */}
      <div className="bg-[#1a2744] border border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white">Click each highlight to see what it's used for</span>
          </div>
          <span className="text-xs text-white/40">
            Explored {exploredCount} of {totalHighlights} key pieces
          </span>
        </div>
        {/* Mini progress */}
        <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-cyan-500 transition-all duration-300 rounded-full"
            style={{ width: totalHighlights > 0 ? `${(exploredCount / totalHighlights) * 100}%` : "0%" }}
          />
        </div>
      </div>

      {/* Problem text with highlights */}
      <div className="bg-[#1a2744]/50 border border-white/5 rounded-lg p-5 relative">
        <p className="text-[15px] leading-relaxed text-white/90 whitespace-pre-wrap">
          {segments.map((seg, si) => {
            if (seg.type === "text") return <span key={si}>{seg.content}</span>;

            const idx = seg.idx!;
            const h = highlights[idx];
            const isClicked = clickedHighlights.has(idx);
            const isActive = activePopover === idx;

            return (
              <span key={si} className="relative inline">
                <span
                  onClick={() => onHighlightClick(idx)}
                  className="cursor-pointer rounded px-0.5 transition-all"
                  style={{
                    backgroundColor: `${h.color}30`,
                    borderBottom: `2px solid ${h.color}`,
                    opacity: isClicked ? 1 : 0.8,
                  }}
                >
                  {seg.content}
                </span>

                {/* Popover */}
                {isActive && !isPreview && (
                  <span className="absolute z-50 left-0 top-full mt-1 w-64 bg-[#1a2744] border border-white/20 rounded-lg p-3 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
                    style={{ marginLeft: "-20px" }}
                  >
                    <span className="flex items-center gap-2 mb-1.5">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                        style={{ backgroundColor: `${h.color}40`, color: h.color }}
                      >
                        {h.category}
                      </span>
                    </span>
                    <span className="text-xs text-white/70 leading-relaxed block">{h.label}</span>
                  </span>
                )}

                {/* Preview paywall blur overlay on click */}
                {isActive && isPreview && (
                  <span className="absolute z-50 left-0 top-full mt-1 w-64 bg-[#1a2744] border border-white/20 rounded-lg p-4 shadow-xl text-center">
                    <Lock className="h-5 w-5 text-cyan-400 mx-auto mb-2" />
                    <span className="text-xs text-white/60 block mb-2">Unlock full explanations</span>
                    <a
                      href={LEARNWORLDS_ENROLL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded text-xs transition-colors"
                    >
                      Enroll Now
                    </a>
                  </span>
                )}
              </span>
            );
          })}
        </p>
      </div>

      {/* Advance */}
      {canAdvance && !isPreview && (
        <div className="flex justify-end">
          <Button onClick={onAdvance} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            I've reviewed all highlights <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Phase 3: Complete ──

function CompletePhase({
  grouped,
  onShare,
  nextAssetId,
}: {
  grouped: { category: string; items: Highlight[] }[];
  onShare: () => void;
  nextAssetId: string | null;
}) {
  return (
    <div className="space-y-5">
      <div className="text-center py-4">
        <h2 className="text-xl font-bold text-white mb-1">Nice work! You've dissected this problem. 🔍</h2>
        <p className="text-white/40 text-sm">Here's a summary of all key information.</p>
      </div>

      {/* Summary by category */}
      <div className="space-y-3">
        {grouped.map(({ category, items }) => (
          <div key={category} className="bg-[#1a2744] border border-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: `${items[0]?.color ?? "#D3D3D3"}40`,
                  color: items[0]?.color ?? "#D3D3D3",
                }}
              >
                {category}
              </span>
              <span className="text-white/30 text-xs">{items.length} item{items.length > 1 ? "s" : ""}</span>
            </div>
            <div className="space-y-2">
              {items.map((h, i) => (
                <div key={i} className="flex gap-3">
                  <span
                    className="text-xs font-medium shrink-0 px-1 rounded"
                    style={{ backgroundColor: `${h.color}20`, color: h.color }}
                  >
                    {h.text.length > 40 ? h.text.slice(0, 40) + "…" : h.text}
                  </span>
                  <span className="text-xs text-white/50">{h.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center pt-2">
        {nextAssetId && (
          <a
            href={`/tools/problem-dissector?asset_id=${nextAssetId}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            Try a similar problem <ChevronRight className="h-4 w-4" />
          </a>
        )}
        <Button onClick={onShare} variant="outline" className="border-white/20 text-white hover:bg-white/10">
          <Share2 className="h-4 w-4 mr-1.5" /> Share this tool
        </Button>
      </div>
    </div>
  );
}
