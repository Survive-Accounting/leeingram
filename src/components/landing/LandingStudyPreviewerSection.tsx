import { useEffect, useMemo, useState } from "react";
import StudyPreviewer, { type PreviewChapter } from "@/components/study-previewer/StudyPreviewer";
import { useChapters, usePrefetchStudyConsole } from "@/hooks/useStudyConsoleData";
import BetaPaywallModal from "./BetaPaywallModal";
import ShareFeedbackModal from "@/components/dashboard/ShareFeedbackModal";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import teamMeetingImg from "@/assets/team-meeting.png";

const NAVY = "#14213D";
const RED = "#CE1126";
const LOGO_FONT = "'DM Serif Display', serif";

interface CoursePill {
  id: string;
  slug: string;
  shortName: string;
  fullName: string;
}

const COURSES: CoursePill[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "intro-accounting-1",
    shortName: "Intro 1",
    fullName: "Intro Accounting 1 - Financial Principles",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    slug: "intro-accounting-2",
    shortName: "Intro 2",
    fullName: "Intro Accounting 2 - Managerial Principles",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    slug: "intermediate-accounting-1",
    shortName: "Intermediate 1",
    fullName: "Intermediate Accounting 1",
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    slug: "intermediate-accounting-2",
    shortName: "Intermediate 2",
    fullName: "Intermediate Accounting 2",
  },
];

interface LandingStudyPreviewerSectionProps {
  /** Called when the visitor accepts the beta paywall — same flow as the rest of the landing page. */
  onJoinBeta: (courseSlug: string) => void;
}

/**
 * The dashboard study previewer, mounted on the landing page and gated by
 * the BetaPaywallModal. Visitors can browse courses + chapters freely;
 * the workspace (real content iframe) is the gated step.
 */
export default function LandingStudyPreviewerSection({
  onJoinBeta,
}: LandingStudyPreviewerSectionProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(COURSES[3].id); // default IA2
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const { data: chaptersData, isLoading: chaptersLoading } = useChapters(selectedCourseId);
  const chapters: PreviewChapter[] = chaptersData ?? [];

  const { prefetchChapters, prefetchChapterEntryAssets } = usePrefetchStudyConsole();

  const selectedCourse = useMemo(
    () => COURSES.find((c) => c.id === selectedCourseId) ?? COURSES[0],
    [selectedCourseId],
  );

  // Prefetch chapter lists for the other courses on idle so toggling courses
  // is instant after the first one loads.
  useEffect(() => {
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    const run = () => {
      COURSES.forEach((c) => {
        if (c.id !== selectedCourseId) prefetchChapters(c.id);
      });
    };
    let idleId: number | undefined;
    let timeoutId: number | undefined;
    if (ric) idleId = ric(run, { timeout: 2500 });
    else timeoutId = window.setTimeout(run, 1500);
    return () => {
      if (idleId !== undefined && (window as any).cancelIdleCallback) {
        (window as any).cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [selectedCourseId, prefetchChapters]);

  // Prefetch first-asset RPC for the first chapter as soon as chapters arrive.
  useEffect(() => {
    if (chapters.length > 0) {
      prefetchChapterEntryAssets(chapters[0].id);
    }
  }, [chapters, prefetchChapterEntryAssets]);

  const handleCourseClick = (id: string) => {
    if (id === selectedCourseId) return;
    setSelectedCourseId(id);
    setResetKey((k) => k + 1);
  };

  return (
    <section
      className="relative px-4 sm:px-6 py-24 sm:py-32"
      style={{
        background: `radial-gradient(120% 80% at 50% 0%, #1A2A4F 0%, ${NAVY} 55%, #0E1830 100%)`,
        borderTop: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "1px solid rgba(0,0,0,0.25)",
      }}
    >
      {/* Subtle top vignette to feel hero-like */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 70%)",
        }}
      />
      <div className="relative mx-auto" style={{ maxWidth: 1080 }}>
        <style>{`
          @keyframes sa-hero-in {
            0% { opacity: 0; transform: translateY(10px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          .sa-hero-in { animation: sa-hero-in 600ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        `}</style>
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10" style={{ maxWidth: 760, margin: "0 auto" }}>
          <div
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase mb-4 sa-hero-in"
            style={{ color: "#FF6B7A", letterSpacing: "0.16em", animationDelay: "0ms" }}
          >
            <span
              className="inline-block rounded-full"
              style={{ width: 6, height: 6, background: RED, boxShadow: "0 0 8px rgba(206,17,38,0.6)" }}
            />
            FREE BETA · OPEN FOR FEEDBACK
          </div>
          <h2
            className="text-[30px] sm:text-[42px] leading-[1.1] sa-hero-in mb-4 sm:mb-5"
            style={{ fontFamily: LOGO_FONT, fontWeight: 400, color: "#FFFFFF", animationDelay: "120ms" }}
          >
            Free accounting study tools for finals.
          </h2>
        </div>

        {/* Previewer (course selector lives inside) */}
        <StudyPreviewer
          chapters={chapters}
          courses={COURSES.map((c) => ({
            id: c.id,
            shortName: c.shortName,
            fullName: c.fullName,
          }))}
          selectedCourseId={selectedCourseId}
          onCourseChange={handleCourseClick}
          onOpenFeedback={() => setFeedbackOpen(true)}
          onRequestUnlock={() => {
            // Demo mode: let visitors open any tool on the landing page so they
            // can see what they're getting. Action-level paywalls live inside
            // the product itself.
            return true;
          }}
          persistChapterKey={null}
          resetSignal={resetKey}
        />

        {/* Meet the team link */}
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => setTeamOpen(true)}
            className="text-[12px] uppercase tracking-[0.18em] font-semibold transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Meet the team building this together →
          </button>
        </div>

      </div>

      <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-transparent border-0">
          <img
            src={teamMeetingImg}
            alt="Team meeting"
            className="w-full h-auto block"
          />
        </DialogContent>
      </Dialog>

      <BetaPaywallModal
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        onJoinBeta={() => onJoinBeta(selectedCourse.slug)}
      />

      <ShareFeedbackModal
        open={feedbackOpen}
        email={null}
        onClose={() => setFeedbackOpen(false)}
      />
    </section>
  );
}
