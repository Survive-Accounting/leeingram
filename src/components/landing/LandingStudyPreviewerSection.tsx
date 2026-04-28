import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import StudyPreviewer, { type PreviewChapter } from "@/components/study-previewer/StudyPreviewer";
import BetaPaywallModal from "./BetaPaywallModal";
import FeedbackToolModal from "@/components/dashboard/FeedbackToolModal";

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
    fullName: "Intro Accounting 1",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    slug: "intro-accounting-2",
    shortName: "Intro 2",
    fullName: "Intro Accounting 2",
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
  const [chapters, setChapters] = useState<PreviewChapter[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const selectedCourse = useMemo(
    () => COURSES.find((c) => c.id === selectedCourseId) ?? COURSES[0],
    [selectedCourseId],
  );

  // Load chapters whenever the course changes
  useEffect(() => {
    let cancelled = false;
    setChaptersLoading(true);
    setChapters([]);
    (async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name")
        .eq("course_id", selectedCourseId)
        .order("chapter_number", { ascending: true });
      if (cancelled) return;
      setChapters((data ?? []) as PreviewChapter[]);
      setChaptersLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedCourseId]);

  const handleCourseClick = (id: string) => {
    if (id === selectedCourseId) return;
    setSelectedCourseId(id);
    setResetKey((k) => k + 1);
  };

  return (
    <section
      className="relative px-4 sm:px-6 py-20 sm:py-28"
      style={{
        background:
          "radial-gradient(80% 60% at 50% 0%, #EEF2F7 0%, #F8FAFC 55%, #F8FAFC 100%)",
        borderTop: "1px solid #E5E7EB",
      }}
    >
      <div className="mx-auto" style={{ maxWidth: 1080 }}>
        <style>{`
          @keyframes sa-hero-in {
            0% { opacity: 0; transform: translateY(10px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          .sa-hero-in { animation: sa-hero-in 600ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        `}</style>
        {/* Header */}
        <div className="text-center mb-20 sm:mb-28" style={{ maxWidth: 760, margin: "0 auto" }}>
          <div
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase mb-4 sa-hero-in"
            style={{ color: RED, letterSpacing: "0.16em", animationDelay: "0ms" }}
          >
            <span
              className="inline-block rounded-full"
              style={{ width: 6, height: 6, background: RED }}
            />
            FREE BETA · OPEN FOR FEEDBACK
          </div>
          <h2
            className="text-[30px] sm:text-[42px] leading-[1.1] sa-hero-in"
            style={{ fontFamily: LOGO_FONT, fontWeight: 400, color: NAVY, animationDelay: "120ms" }}
          >
            Free accounting study tools for finals.
          </h2>
          <p
            className="mt-4 text-[15px] sm:text-[16px] sa-hero-in"
            style={{ color: "#5A6478", fontFamily: "Inter, sans-serif", animationDelay: "200ms" }}
          >
            Create a free account to unlock the beta tools and start studying.
          </p>
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

      </div>

      <BetaPaywallModal
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        onJoinBeta={() => onJoinBeta(selectedCourse.slug)}
      />

      <FeedbackToolModal
        open={feedbackOpen}
        email={null}
        onClose={() => setFeedbackOpen(false)}
      />
    </section>
  );
}
