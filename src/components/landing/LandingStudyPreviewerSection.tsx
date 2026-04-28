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
      className="relative px-4 sm:px-6 py-20 sm:py-24"
      style={{ background: "#F8FAFC", borderTop: "1px solid #E5E7EB" }}
    >
      <div className="mx-auto" style={{ maxWidth: 1080 }}>
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14" style={{ maxWidth: 720, margin: "0 auto" }}>
          <div
            className="inline-block text-[11px] font-bold uppercase mb-3"
            style={{ color: RED, letterSpacing: "0.12em" }}
          >
            Free Beta · Try it now
          </div>
          <h2
            className="text-[28px] sm:text-[36px] leading-tight"
            style={{ fontFamily: LOGO_FONT, fontWeight: 400, color: NAVY }}
          >
            Built for last-minute accounting studying.
          </h2>
          <p
            className="mt-3 sm:mt-4 text-[15px] sm:text-[16px]"
            style={{ fontFamily: "Inter, sans-serif", color: "#64748B", lineHeight: 1.6 }}
          >
            Pick a course, choose a chapter, and explore the tools built to help you cram smarter for finals.
          </p>
        </div>

        {/* Course pills */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8" style={{ fontFamily: "Inter, sans-serif" }}>
          {COURSES.map((c) => {
            const active = c.id === selectedCourseId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleCourseClick(c.id)}
                className="rounded-full px-4 py-2 text-[13px] font-semibold transition-all"
                style={{
                  background: active ? NAVY : "#fff",
                  color: active ? "#fff" : NAVY,
                  border: `1px solid ${active ? NAVY : "#E2E8F0"}`,
                  boxShadow: active ? "0 6px 16px rgba(20,33,61,0.18)" : "none",
                }}
              >
                {c.shortName}
              </button>
            );
          })}
        </div>

        {/* Previewer */}
        <StudyPreviewer
          chapters={chapters}
          headerEyebrow="Previewing"
          campusName={selectedCourse.fullName}
          courseLabel={chaptersLoading ? "Loading chapters…" : null}
          onOpenFeedback={() => setFeedbackOpen(true)}
          onRequestUnlock={(action) => {
            if (action === "open_workspace") {
              setPaywallOpen(true);
              return false;
            }
            return true;
          }}
          persistChapterKey={null}
          resetSignal={resetKey}
        />

        {/* Microcopy */}
        <p
          className="mt-8 text-center text-[12.5px]"
          style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
        >
          Free during finals. No credit card needed. Help us improve it with your feedback.
        </p>
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
