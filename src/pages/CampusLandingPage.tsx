import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import CampusHeader from "@/components/campus/CampusHeader";
import PreviewPurchaseBar from "@/components/PreviewPurchaseBar";
import { useEventTracking } from "@/hooks/useEventTracking";
import heroBg from "@/assets/staging-hero.jpg";

const NAVY = "#14213D";
const RED = "#CE1126";

const COURSE_SLUG_MAP: Record<string, string> = {
  "intermediate-accounting-2": "44444444-4444-4444-4444-444444444444",
  "intermediate-accounting-1": "33333333-3333-3333-3333-333333333333",
  "intro-accounting-1": "11111111-1111-1111-1111-111111111111",
  "intro-accounting-2": "22222222-2222-2222-2222-222222222222",
};

const COURSE_NAMES: Record<string, string> = {
  "intermediate-accounting-2": "Intermediate Accounting 2",
  "intermediate-accounting-1": "Intermediate Accounting 1",
  "intro-accounting-1": "Introductory Accounting 1",
  "intro-accounting-2": "Introductory Accounting 2",
};

export default function CampusLandingPage() {
  const { campusSlug = "general", courseSlug = "intermediate-accounting-2" } = useParams();
  const navigate = useNavigate();
  const courseId = COURSE_SLUG_MAP[courseSlug] || COURSE_SLUG_MAP["intermediate-accounting-2"];
  const courseName = COURSE_NAMES[courseSlug] || "Intermediate Accounting 2";
  const { trackEvent, trackPageView } = useEventTracking();

  const [campusName, setCampusName] = useState("");
  const [priceCents, setPriceCents] = useState(12500);
  const [loading, setLoading] = useState(true);
  const [problemCount, setProblemCount] = useState<number | null>(null);
  const [firstChapterId, setFirstChapterId] = useState<string | null>(null);

  useEffect(() => {
    trackPageView("campus_landing", { campus_slug: campusSlug, course_slug: courseSlug });
  }, [campusSlug, courseSlug, trackPageView]);

  useEffect(() => {
    const load = async () => {
      if (campusSlug !== "general") {
        const { data: campus } = await supabase
          .from("campuses")
          .select("id, name")
          .eq("slug", campusSlug)
          .maybeSingle();
        if (campus) setCampusName(campus.name);
      }

      const { data: priceData } = await supabase.rpc("get_campus_price", {
        p_campus_slug: campusSlug,
        p_product_type: "semester_pass",
      });
      if (priceData && priceData > 0) setPriceCents(priceData);

      const { data: chData } = await supabase
        .from("chapters")
        .select("id, chapter_number")
        .eq("course_id", courseId)
        .order("chapter_number");

      if (chData && chData.length > 0) {
        setFirstChapterId(chData[0].id);
        const chapterIds = chData.map((c) => c.id);
        const { count } = await (supabase as any)
          .from("teaching_assets")
          .select("id", { count: "exact", head: true })
          .in("chapter_id", chapterIds)
          .eq("status", "approved");
        if (typeof count === "number") setProblemCount(count);
      }

      setLoading(false);
    };
    load();
  }, [campusSlug, courseSlug, courseId]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-white text-sm" style={{ background: NAVY }}>Loading...</div>;
  }

  const problemLabel = problemCount && problemCount > 0 ? `${problemCount}` : "Hundreds of";

  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: NAVY }}>
      {/* Background video + overlay (matches /staging hero) */}
      <video
        ref={(el) => {
          if (!el) return;
          el.muted = true;
          const tryPlay = () => el.play().catch(() => {});
          tryPlay();
          const onInteract = () => { tryPlay(); document.removeEventListener("touchstart", onInteract); document.removeEventListener("click", onInteract); };
          document.addEventListener("touchstart", onInteract, { once: true, passive: true });
          document.addEventListener("click", onInteract, { once: true });
        }}
        className="fixed inset-0 z-0 w-full h-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        // @ts-ignore
        webkit-playsinline="true"
        disablePictureInPicture
        disableRemotePlayback
        preload="auto"
        poster={heroBg}
      >
        <source src="/videos/hero-loop.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 z-0" style={{ background: `linear-gradient(to right, ${NAVY}cc 0%, ${NAVY}99 40%, ${NAVY}80 100%)` }} />
      <div className="fixed inset-0 z-0" style={{ background: "rgba(0,0,0,0.35)" }} />

      <div className="relative z-10 flex-1 flex flex-col">
        <CampusHeader campusName={campusName} courseName={courseName} />

        {/* Header */}
        <div className="max-w-[1100px] mx-auto w-full px-4 sm:px-6 pt-10 pb-8 text-center">
          <h1
            className="text-[32px] sm:text-[44px] md:text-[52px] font-bold leading-tight text-white"
            style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, textShadow: "2px 2px 8px rgba(0,0,0,0.6)" }}
          >
            Ace {courseName}
          </h1>
          <p
            className="mt-3 text-[15px] sm:text-[17px]"
            style={{ color: "rgba(255,255,255,0.8)", fontFamily: "Inter, sans-serif", textShadow: "1px 1px 4px rgba(0,0,0,0.5)" }}
          >
            Get AI-enabled study tools created by a real accounting tutor
          </p>
        </div>

        {/* Cards */}
        <div className="max-w-[1100px] mx-auto w-full px-4 sm:px-6 pb-32">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
            {/* Card 1 — Cram Tools */}
            <Card
              title="Cram Tools"
              body="Brain blast through flashcards, journal entries, formulas and more."
              buttonLabel="Explore Cram Tools →"
              onClick={() => {
                trackEvent("preview_cram_click", { campus_slug: campusSlug, course_slug: courseSlug });
                if (firstChapterId) navigate(`/cram/${firstChapterId}?preview=true`);
              }}
            />

            {/* Card 2 — Practice Problems */}
            <Card
              title={`${problemLabel} Practice Problems`}
              body="Check your work with Lee's interactive solutions."
              buttonLabel="Browse Problems →"
              onClick={() => {
                trackEvent("preview_problems_click", { campus_slug: campusSlug, course_slug: courseSlug });
                if (firstChapterId) navigate(`/campus/${campusSlug}/${courseSlug}/chapter-1`);
              }}
            />

            {/* Card 3 — Lee on Demand */}
            <Card
              title="Lee on Demand (New!)"
              body="Submit a question—Lee sends back a personal video answer."
              buttonLabel="Learn More →"
              disabled
            />
          </div>
        </div>
      </div>

      <PreviewPurchaseBar
        priceCents={priceCents}
        campusSlug={campusSlug}
        courseSlug={courseSlug}
        email={sessionStorage.getItem("student_email") || undefined}
      />
    </div>
  );
}

interface CardProps {
  title: string;
  body: string;
  buttonLabel?: string;
  onClick?: () => void;
  comingSoon?: boolean;
  disabled?: boolean;
}

function Card({ title, body, buttonLabel, onClick, comingSoon, disabled }: CardProps) {
  return (
    <div
      className="bg-white rounded-2xl px-5 py-4 flex flex-col"
      style={{
        boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)",
      }}
    >
      <h3
        className="text-[20px] font-bold mb-2"
        style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
      >
        {title}
      </h3>
      <p
        className="text-[13px] leading-snug mb-4 flex-1"
        style={{ color: "#4B5563", fontFamily: "Inter, sans-serif" }}
      >
        {body}
      </p>
      {buttonLabel && (
        <button
          onClick={disabled ? undefined : onClick}
          disabled={disabled}
          aria-disabled={disabled}
          className={`w-full rounded-lg py-3 text-[14px] font-semibold text-white transition-all ${disabled ? "cursor-not-allowed opacity-70" : "hover:brightness-110 active:scale-[0.99]"}`}
          style={{ background: RED, fontFamily: "Inter, sans-serif", boxShadow: "0 4px 14px rgba(206,17,38,0.3)" }}
        >
          {buttonLabel}
        </button>
      )}
      {comingSoon && (
        <p
          className="text-[12px] font-medium text-center mt-2"
          style={{ color: "#9CA3AF", fontFamily: "Inter, sans-serif" }}
        >
          Coming soon
        </p>
      )}
    </div>
  );
}
