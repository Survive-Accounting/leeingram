import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import CampusHeader from "@/components/campus/CampusHeader";
import PreviewPurchaseBar from "@/components/PreviewPurchaseBar";
import { useEventTracking } from "@/hooks/useEventTracking";
import { toast } from "sonner";

const NAVY = "#14213D";
const RED = "#CE1126";
const GREEN = "#16A34A";
// Powder blue gradient that converges toward the center, drawing the eye to the CTA in the sticky bar.
const BG_GRADIENT =
  "radial-gradient(ellipse at 50% 95%, #BFDBFE 0%, #DBEAFE 35%, #EFF6FF 65%, #F8FAFC 100%)";

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

const WAITLIST_TAG = "tutoring_on_demand_waitlist";

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

  // On-demand videos waitlist state
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistLoading, setWaitlistLoading] = useState(false);

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

  const submitWaitlist = async (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Enter a valid email");
      return;
    }
    setWaitlistLoading(true);
    try {
      const { error } = await (supabase as any).from("waitlist_signups").upsert(
        { email: trimmed, tag: WAITLIST_TAG, campus_slug: campusSlug, course_slug: courseSlug },
        { onConflict: "email,tag" },
      );
      if (error) throw error;
      sessionStorage.setItem("student_email", trimmed);
      setWaitlistJoined(true);
      setShowEmailInput(false);
      trackEvent("waitlist_join", { tag: WAITLIST_TAG, campus_slug: campusSlug });
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setWaitlistLoading(false);
    }
  };

  const handleOnDemandClick = () => {
    if (waitlistJoined) return;
    const existing = sessionStorage.getItem("student_email");
    if (existing) {
      submitWaitlist(existing);
    } else {
      setShowEmailInput(true);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm" style={{ background: BG_GRADIENT, color: NAVY }}>Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: BG_GRADIENT }}>
      <div className="relative z-10 flex-1 flex flex-col">
        <CampusHeader campusName={campusName} courseName={courseName} />

        {/* Header */}
        <div className="max-w-[1100px] mx-auto w-full px-4 sm:px-6 pt-10 pb-8 text-center">
          <h1
            className="text-[32px] sm:text-[44px] md:text-[52px] font-bold leading-tight"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
          >
            Your exam is closer than you think.
          </h1>
          <p
            className="mt-3 text-[15px] sm:text-[17px]"
            style={{ color: "#475569", fontFamily: "Inter, sans-serif" }}
          >
            Everything you need to stop panicking and start studying.
          </p>
        </div>

        {/* Cards */}
        <div className="max-w-[1100px] mx-auto w-full px-4 sm:px-6 pb-32">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
            <Card
              title="Survival Tools"
              body="Built for late night cramming. Flashcards, journal entries, formulas — optimized for speed."
              buttonLabel="Browse Tools →"
              onClick={() => {
                trackEvent("preview_cram_click", { campus_slug: campusSlug, course_slug: courseSlug });
                if (firstChapterId) navigate(`/cram/${firstChapterId}?preview=true`);
              }}
            />

            <Card
              title="Practice Problems"
              body="Your solutions manual sucks. Ours actually teaches you something."
              buttonLabel="Browse Problems →"
              onClick={() => {
                trackEvent("preview_problems_click", { campus_slug: campusSlug, course_slug: courseSlug });
                if (firstChapterId) navigate(`/campus/${campusSlug}/${courseSlug}/chapter-1`);
              }}
            />

            <Card
              title="On Demand Videos"
              body="Lee's full video library, 24/7. Binge what's there, request what's not. New videos drop every week."
              buttonLabel={waitlistJoined ? "You're on the list 👍" : "Request Early Access"}
              onClick={handleOnDemandClick}
              disabled={waitlistJoined}
              buttonBg={waitlistJoined ? GREEN : NAVY}
              extra={
                showEmailInput && !waitlistJoined ? (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="email"
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      placeholder="your@university.edu"
                      disabled={waitlistLoading}
                      className="flex-1 rounded-lg px-3 text-[13px] outline-none focus:ring-2"
                      style={{
                        minHeight: 40,
                        background: "#F8F9FA",
                        border: "1px solid #E5E7EB",
                        color: NAVY,
                        fontFamily: "Inter, sans-serif",
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitWaitlist(waitlistEmail);
                      }}
                    />
                    <button
                      onClick={() => submitWaitlist(waitlistEmail)}
                      disabled={waitlistLoading}
                      className="rounded-lg px-4 text-[13px] font-semibold text-white disabled:opacity-60"
                      style={{ background: NAVY, fontFamily: "Inter, sans-serif" }}
                    >
                      {waitlistLoading ? "..." : "Join →"}
                    </button>
                  </div>
                ) : null
              }
            />

            <Card
              title="On Demand Videos"
              body="Lee's full video library, 24/7. Binge what's there, request what's not. New videos drop every week."
              buttonLabel={waitlistJoined ? "You're on the list 👍" : "Request Early Access →"}
              onClick={handleOnDemandClick}
              disabled={waitlistJoined}
              buttonBg={waitlistJoined ? GREEN : RED}
              extra={
                showEmailInput && !waitlistJoined ? (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="email"
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      placeholder="your@university.edu"
                      disabled={waitlistLoading}
                      className="flex-1 rounded-lg px-3 text-[13px] outline-none focus:ring-2"
                      style={{
                        minHeight: 40,
                        background: "#F8F9FA",
                        border: "1px solid #E5E7EB",
                        color: NAVY,
                        fontFamily: "Inter, sans-serif",
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitWaitlist(waitlistEmail);
                      }}
                    />
                    <button
                      onClick={() => submitWaitlist(waitlistEmail)}
                      disabled={waitlistLoading}
                      className="rounded-lg px-4 text-[13px] font-semibold text-white disabled:opacity-60"
                      style={{ background: NAVY, fontFamily: "Inter, sans-serif" }}
                    >
                      {waitlistLoading ? "..." : "Join →"}
                    </button>
                  </div>
                ) : null
              }
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
  buttonBg?: string;
  extra?: React.ReactNode;
}

function Card({ title, body, buttonLabel, onClick, comingSoon, disabled, buttonBg, extra }: CardProps) {
  const bg = buttonBg || NAVY;
  const isGreen = bg === GREEN;
  return (
    <div
      className="bg-white rounded-2xl px-5 py-4 flex flex-col"
      style={{
        boxShadow: "0 12px 40px rgba(20,33,61,0.10), 0 2px 6px rgba(20,33,61,0.06)",
        border: "1px solid rgba(20,33,61,0.06)",
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
          className={`self-start rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-all ${disabled ? "cursor-not-allowed" : "hover:brightness-110 active:scale-[0.99]"}`}
          style={{
            background: bg,
            fontFamily: "Inter, sans-serif",
            boxShadow: disabled ? "none" : `0 2px 8px ${isGreen ? "rgba(22,163,74,0.25)" : "rgba(20,33,61,0.20)"}`,
          }}
        >
          {buttonLabel}
        </button>
      )}
      {extra}
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
