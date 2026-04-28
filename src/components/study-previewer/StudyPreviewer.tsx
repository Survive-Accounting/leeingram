import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import StudyToolCards, { type ToolKey } from "@/components/dashboard/StudyToolCards";

const NAVY = "#14213D";
const RED = "#CE1126";
const LOGO_FONT = "'DM Serif Display', serif";

export interface PreviewChapter {
  id: string;
  chapter_number: number;
  chapter_name: string;
}

interface StudyPreviewerProps {
  /** Chapter list for the currently active course. */
  chapters: PreviewChapter[];
  /** Header label, left side (e.g. "Your campus"). */
  headerEyebrow?: string;
  /** Campus name shown on the header (e.g. "Ole Miss"). */
  campusName?: string | null;
  /** Course label appended after the campus name. */
  courseLabel?: string | null;
  /** Called when a user clicks "Tell us what you want built" or the JE coming-soon CTA. */
  onOpenFeedback: () => void;
  /**
   * Optional gate. When provided AND it returns false, the action is blocked
   * (parent should show a paywall etc.). When omitted, the action proceeds.
   */
  onRequestUnlock?: (action: "open_workspace") => boolean;
  /** localStorage key to persist the chapter pick. Pass null/undefined to disable. */
  persistChapterKey?: string | null;
  /** Reset signal — bumping this number clears the chapter + tool selection. */
  resetSignal?: number;
}

export default function StudyPreviewer({
  chapters,
  headerEyebrow = "Your course",
  campusName,
  courseLabel,
  onOpenFeedback,
  onRequestUnlock,
  persistChapterKey,
  resetSignal,
}: StudyPreviewerProps) {
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolKey | null>(null);
  const [viewerAssetCode, setViewerAssetCode] = useState<string | null>(null);

  const chapterDropdownRef = useRef<HTMLSelectElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // Restore from localStorage on mount + when chapters arrive
  useEffect(() => {
    if (!persistChapterKey) return;
    try {
      const stored = localStorage.getItem(persistChapterKey);
      if (stored && chapters.some((c) => c.id === stored)) {
        setSelectedChapterId(stored);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistChapterKey, chapters.length]);

  // External reset (e.g. course changed on landing page)
  useEffect(() => {
    if (resetSignal === undefined) return;
    setSelectedChapterId(null);
    setActiveTool(null);
    setViewerAssetCode(null);
  }, [resetSignal]);

  const handleChapterChange = async (chId: string) => {
    if (!chId) {
      setSelectedChapterId(null);
      setViewerAssetCode(null);
      setActiveTool(null);
      if (persistChapterKey) {
        try { localStorage.removeItem(persistChapterKey); } catch { /* ignore */ }
      }
      return;
    }
    setChapterLoading(true);
    setViewerAssetCode(null);

    const ch = chapters.find((c) => c.id === chId);

    const { data } = await supabase
      .from("teaching_assets")
      .select("asset_name, source_number")
      .eq("chapter_id", chId)
      .order("source_number", { ascending: true, nullsFirst: false })
      .order("asset_name", { ascending: true })
      .limit(1);
    const first = data?.[0]?.asset_name ?? null;

    await new Promise((r) => setTimeout(r, 600));

    setSelectedChapterId(chId);
    setViewerAssetCode(first);
    setChapterLoading(false);
    if (persistChapterKey) {
      try { localStorage.setItem(persistChapterKey, chId); } catch { /* ignore */ }
    }

    if (ch) toast.success(`Ch. ${ch.chapter_number} study tools are loaded!`);
  };

  const handleSelectTool = (key: ToolKey) => {
    // For the practice tool we want to gate the workspace (real content).
    // JE is "coming soon" + just a feedback nudge — never gated.
    if (key === "practice" && onRequestUnlock && !onRequestUnlock("open_workspace")) {
      return;
    }
    setActiveTool(key);
    setTimeout(() => {
      workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleNudgeChapter = () => {
    toast("Pick a chapter first 👇");
    chapterDropdownRef.current?.focus();
    chapterDropdownRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const selectedChapter = useMemo(
    () => chapters.find((c) => c.id === selectedChapterId) ?? null,
    [chapters, selectedChapterId],
  );

  return (
    <div className="space-y-10" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Course + Chapter selector */}
      <section
        className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
        style={{
          background: "#fff",
          border: "1px solid #E0E7F0",
          boxShadow: "0 4px 14px rgba(20,33,61,0.05)",
        }}
      >
        <div className="min-w-0 flex-1">
          <p
            className="text-[10.5px] uppercase tracking-widest font-semibold"
            style={{ color: "#94A3B8" }}
          >
            {headerEyebrow}
          </p>
          <p
            className="mt-1 text-[16px] sm:text-[17px] font-semibold truncate"
            style={{ color: NAVY }}
          >
            {campusName ? `${campusName}` : "Your campus"}
            {courseLabel ? <span style={{ color: "#64748B", fontWeight: 500 }}> · {courseLabel}</span> : null}
          </p>
        </div>
        <div className="relative w-full sm:w-[340px]">
          <select
            ref={chapterDropdownRef}
            value={selectedChapterId ?? ""}
            onChange={(e) => handleChapterChange(e.target.value)}
            disabled={chapterLoading || chapters.length === 0}
            className="w-full appearance-none rounded-lg px-4 py-2.5 pr-10 text-[14px] font-medium outline-none transition-colors"
            style={{
              background: "#F8FAFC",
              border: `1px solid ${selectedChapterId ? NAVY : "#E2E8F0"}`,
              color: NAVY,
              cursor: chapterLoading ? "wait" : "pointer",
            }}
          >
            <option value="">
              {chapters.length === 0 ? "Pick a course first…" : "Choose chapter…"}
            </option>
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                Ch {ch.chapter_number} — {ch.chapter_name}
              </option>
            ))}
          </select>
          <ArrowRight
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 rotate-90 pointer-events-none"
            style={{ color: "#94A3B8" }}
          />
        </div>
      </section>

      {/* Tool cards */}
      <StudyToolCards
        active={activeTool}
        loading={chapterLoading}
        chapterChosen={!!selectedChapterId && !chapterLoading}
        onSelect={handleSelectTool}
        onOpenFeedback={onOpenFeedback}
        onNudgeChapter={handleNudgeChapter}
      />

      {/* Workspace pane */}
      <section
        ref={workspaceRef}
        className="rounded-2xl overflow-hidden"
        style={{
          background: "#fff",
          border: "1px solid #E0E7F0",
          boxShadow: "0 8px 24px rgba(20,33,61,0.06), 0 2px 6px rgba(20,33,61,0.04)",
          minHeight: 600,
        }}
      >
        {!activeTool && (
          <div className="flex items-center justify-center text-center px-6 py-24">
            <div className="max-w-sm">
              <p className="text-[15px] font-semibold" style={{ color: NAVY }}>
                Pick a tool above to start studying
              </p>
              <p className="text-[13px] mt-1.5" style={{ color: "#64748B" }}>
                Your workspace loads right here — no new tabs needed.
              </p>
            </div>
          </div>
        )}

        {activeTool === "practice" && viewerAssetCode && (
          <div className="relative">
            <div
              className="px-5 py-2.5 flex items-center justify-between gap-3 text-[12px]"
              style={{ background: "#fff", borderBottom: "1px solid #EEF2F7", color: "#64748B" }}
            >
              <span className="truncate font-medium" style={{ color: NAVY }}>
                {selectedChapter
                  ? `Ch ${selectedChapter.chapter_number} — ${selectedChapter.chapter_name}`
                  : "Practice Problem Helper"}
              </span>
              <button
                onClick={() =>
                  window.open(
                    `/v2/solutions/${encodeURIComponent(viewerAssetCode)}`,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
                className="inline-flex items-center gap-1 hover:underline"
                style={{ color: NAVY, fontWeight: 600 }}
              >
                Open in new tab <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
            <iframe
              key={viewerAssetCode}
              src={`/v2/solutions/${encodeURIComponent(viewerAssetCode)}`}
              title="Practice Problem Helper"
              className="w-full block border-0"
              style={{ height: "min(85vh, 980px)", background: "#fff" }}
            />
          </div>
        )}

        {activeTool === "practice" && !viewerAssetCode && (
          <div className="flex items-center justify-center text-center px-6 py-24">
            <p className="text-[14px]" style={{ color: "#64748B" }}>
              This chapter is being finalized — check back soon.
            </p>
          </div>
        )}

        {activeTool === "je" && (
          <div className="px-6 py-16 sm:py-20 max-w-2xl mx-auto text-center">
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-widest"
              style={{ background: "#FEF3C7", color: "#92400E" }}
            >
              Coming soon
            </div>
            <h3
              className="mt-3 text-[26px] leading-tight"
              style={{ color: NAVY, fontFamily: LOGO_FONT, fontWeight: 400 }}
            >
              Journal Entry Helper is being built
            </h3>
            <p className="mt-2 text-[14px]" style={{ color: "#64748B" }}>
              Tell us exactly how you'd want this to work and we'll build it
              straight from your feedback.
            </p>
            <button
              type="button"
              onClick={onOpenFeedback}
              className="mt-5 inline-flex items-center gap-1.5 rounded-md px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:brightness-110"
              style={{
                background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
                boxShadow: "0 4px 12px rgba(206,17,38,0.25)",
              }}
            >
              Tell us what you'd want <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </section>

      {/* Hidden import to keep tree-shaking honest if Lock is needed by callers later */}
      <span className="hidden"><Lock className="h-3 w-3" /></span>
    </div>
  );
}
