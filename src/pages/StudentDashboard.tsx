import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import OnboardingModal from "@/components/dashboard/OnboardingModal";
import BetaCountdownStrip from "@/components/dashboard/BetaCountdownStrip";
import FeedbackToolModal from "@/components/dashboard/FeedbackToolModal";
import { WelcomeVideoCard, WelcomeVideoModal } from "@/components/dashboard/WelcomeVideoCard";
import EarlyBirdOptInRow from "@/components/dashboard/EarlyBirdOptInRow";
import StudyPreviewer from "@/components/study-previewer/StudyPreviewer";
import ShareWithFriendsBand from "@/components/dashboard/ShareWithFriendsBand";
import { getCourseLabel } from "@/lib/courseLabel";

const NAVY = "#14213D";
const RED = "#CE1126";
const BG_GRADIENT =
  "radial-gradient(ellipse at 50% 0%, #DBEAFE 0%, #EFF6FF 35%, #F8FAFC 70%, #F8FAFC 100%)";
const LOGO_FONT = "'DM Serif Display', serif";

const SELECTED_CHAPTER_KEY = "sa.dashboard.chapterId";

interface Purchase {
  id: string;
  course_id: string;
  expires_at: string | null;
}

interface Chapter {
  id: string;
  chapter_number: number;
  chapter_name: string;
}

/* ─── Navbar ─── */

function DashNavbar({
  onFeedback,
  onSignOut,
}: {
  onFeedback: () => void;
  onSignOut: () => void;
}) {
  const navigate = useNavigate();
  return (
    <header
      className="sticky top-0 z-40 w-full"
      style={{
        background: "rgba(255,255,255,0.92)",
        borderBottom: "1px solid rgba(20,33,61,0.08)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <nav className="max-w-6xl mx-auto h-16 px-5 sm:px-8 flex items-center justify-between">
        <button
          onClick={() => navigate("/")}
          className="text-[16px] sm:text-[18px] tracking-tight"
          style={{ fontFamily: LOGO_FONT }}
          aria-label="Survive Accounting — home"
        >
          <span style={{ color: RED, fontWeight: 800 }}>Survive</span>
          <span style={{ color: NAVY, fontWeight: 400 }}> Accounting</span>
        </button>
        <div className="flex items-center gap-4 sm:gap-5">
          <button
            onClick={onSignOut}
            className="text-[12px] font-medium hover:underline"
            style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
          >
            Sign out
          </button>
          <button
            onClick={onFeedback}
            className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
            style={{
              background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
              boxShadow: "0 4px 12px rgba(206,17,38,0.25)",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Submit Feedback <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </nav>
    </header>
  );
}

/* ─── Main Page ─── */

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [campusId, setCampusId] = useState<string | null>(null);
  const [campusName, setCampusName] = useState<string | null>(null);
  const [courseLabel, setCourseLabel] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [welcomedAt, setWelcomedAt] = useState<string | null>(null);
  const [betaNumber, setBetaNumber] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [earlyBirdOpted, setEarlyBirdOpted] = useState(true); // default true so the row stays hidden until we know
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [verifying, setVerifying] = useState<boolean>(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("just_paid") === "1" || p.get("checkout") === "success";
  });


  // Mark this visit as "welcomed" once the dashboard renders successfully —
  // so the next visit gets "Welcome back" instead of "Thanks for joining".
  const markedWelcomedRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      toast.success("You're in! Welcome to Survive Accounting 🎉");
    }
    if (params.get("just_paid") === "1" || params.get("checkout") === "success") {
      params.delete("checkout");
      params.delete("just_paid");
      const newSearch = params.toString();
      const newUrl =
        window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
      window.history.replaceState({}, "", newUrl);
    }

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        navigate("/?login=1", { replace: true });
        return;
      }

      const userEmail = session.user.email.toLowerCase();
      setEmail(userEmail);
      setUserId(session.user.id);

      const { data: rows } = await supabase
        .from("student_purchases")
        .select("id, course_id, expires_at, created_at, campus_id")
        .eq("email", userEmail)
        .order("created_at", { ascending: false });

      if (!rows || rows.length === 0) {
        navigate("/?login=1&reason=no_purchase", { replace: true });
        return;
      }

      const now = Date.now();
      const active = rows.find((r) => !r.expires_at || new Date(r.expires_at).getTime() > now);
      const chosen = active ?? rows[0];
      setPurchase(chosen as Purchase);
      setCampusId((chosen as any).campus_id ?? null);

      // Onboarding row
      const { data: onb } = await supabase
        .from("student_onboarding")
        .select("display_name, welcomed_at, completed_at, campus_id, beta_number, early_bird_opt_in")
        .eq("user_id", session.user.id)
        .maybeSingle();

      // Campus name
      let resolvedCampusName: string | null = null;
      const cId = onb?.campus_id ?? (chosen as any).campus_id;
      let resolvedCampusSlug: string | null = null;
      if (cId) {
        const { data: c } = await supabase
          .from("campuses")
          .select("name, slug")
          .eq("id", cId)
          .maybeSingle();
        resolvedCampusName = c?.name ?? null;
        resolvedCampusSlug = (c as any)?.slug ?? null;
        setCampusName(resolvedCampusName);
      }

      // Course label — campus code if we know the campus (and it's not Catch-All), else course name.
      const { data: course } = await supabase
        .from("courses")
        .select("course_name")
        .eq("id", chosen.course_id)
        .maybeSingle();

      let localCode: string | null = null;
      if (cId) {
        const { data: cc } = await supabase
          .from("campus_courses")
          .select("local_course_code")
          .eq("course_id", chosen.course_id)
          .eq("campus_id", cId)
          .maybeSingle();
        localCode = cc?.local_course_code ?? null;
      }

      if (course) {
        setCourseLabel(getCourseLabel({
          courseName: course.course_name,
          campusSlug: resolvedCampusSlug,
          localCourseCode: localCode,
        }));
      }

      if (!onb || !onb.completed_at) {
        setNeedsOnboarding(true);
      } else {
        setWelcomedAt(onb.welcomed_at ?? null);
        setBetaNumber(onb.beta_number ?? null);
        setDisplayName(onb.display_name ?? null);
        const fromOnboarding = !!onb.early_bird_opt_in;
        const fromMeta = !!session.user.user_metadata?.early_bird_opt_in;
        setEarlyBirdOpted(fromOnboarding || fromMeta);
      }

      const { data: chapterRows } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name")
        .eq("course_id", chosen.course_id)
        .order("chapter_number", { ascending: true });

      const chapterList = (chapterRows ?? []) as Chapter[];
      setChapters(chapterList);

      setLoading(false);
      if (verifying) setTimeout(() => setVerifying(false), 600);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // On first successful load, stamp welcomed_at so the next visit greets them as returning.
  useEffect(() => {
    if (loading || markedWelcomedRef.current) return;
    if (!userId) return;
    if (welcomedAt) {
      markedWelcomedRef.current = true;
      return;
    }
    markedWelcomedRef.current = true;
    void (async () => {
      try {
        await supabase
          .from("student_onboarding")
          .update({ welcomed_at: new Date().toISOString() })
          .eq("user_id", userId);
      } catch { /* ignore */ }
    })();
  }, [loading, userId, welcomedAt]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG_GRADIENT }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: NAVY }} />
      </div>
    );
  }

  const expiresStr = purchase?.expires_at
    ? new Date(purchase.expires_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "the current semester";

  const fallbackFirstName = (() => {
    if (!email) return "";
    const local = email.split("@")[0].split("+")[0];
    const raw = local.split(/[._-]/)[0] || local;
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : "";
  })();
  const firstName = (displayName?.trim().split(/\s+/)[0]) || fallbackFirstName;

  const isReturning = !!welcomedAt;
  const greeting = isReturning
    ? (firstName ? `Welcome back, ${firstName}` : "Welcome back")
    : (firstName ? `Thanks for joining, ${firstName}` : "Thanks for joining");

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG_GRADIENT }}>
      <BetaCountdownStrip />
      <DashNavbar onFeedback={() => setFeedbackOpen(true)} onSignOut={handleSignOut} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-5 sm:px-8 pt-10 md:pt-12 pb-20 space-y-12 md:space-y-14">
        {/* Top row — Share (primary, left) + A Note From Lee (right) */}
        <section aria-label="Beta priorities">
          <div
            className="inline-flex items-center gap-2 text-[10.5px] font-bold uppercase mb-3"
            style={{ color: "#94A3B8", letterSpacing: "0.18em", fontFamily: "Inter, sans-serif" }}
          >
            <span className="inline-block rounded-full" style={{ width: 5, height: 5, background: "#CBD5E1" }} />
            Your beta · two quick things
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6 items-stretch">
            <div className="md:col-span-7">
              <ShareWithFriendsBand
                betaNumber={betaNumber}
                campusName={campusName}
                compact
              />
            </div>
            <div className="md:col-span-5">
              <WelcomeVideoCard onClick={() => setVideoOpen(true)} fullWidth />
            </div>
          </div>
        </section>

        {!earlyBirdOpted && userId && (
          <div className="text-center md:text-left">
            <EarlyBirdOptInRow
              userId={userId}
              onOptedIn={() => setEarlyBirdOpted(true)}
            />
          </div>
        )}

        {/* Previewer entry — the centerpiece */}
        <div className="space-y-6">
          <div className="text-center" style={{ maxWidth: 760, margin: "0 auto" }}>
            <div
              className="inline-flex items-center gap-2 text-[11px] font-bold uppercase mb-4"
              style={{ color: RED, letterSpacing: "0.16em" }}
            >
              <span
                className="inline-block rounded-full"
                style={{ width: 6, height: 6, background: RED }}
              />
              FREE BETA · TRY IT NOW
            </div>
            <h2
              className="text-[28px] sm:text-[38px] leading-[1.1]"
              style={{ fontFamily: LOGO_FONT, fontWeight: 400, color: NAVY }}
            >
              Free accounting study tools for finals.
            </h2>
            <p
              className="mt-2 text-[12.5px] sm:text-[13px]"
              style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
            >
              Free Beta Access through {expiresStr}
            </p>
          </div>

          <StudyPreviewer
            chapters={chapters}
            fixedCourseLabel={courseLabel ?? campusName ?? null}
            onOpenFeedback={() => setFeedbackOpen(true)}
            persistChapterKey={SELECTED_CHAPTER_KEY}
            welcomeName={firstName || null}
            isReturning={isReturning}
          />
        </div>

        {/* Support */}
        <p
          className="text-center text-[13px]"
          style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
        >
          Need help?{" "}
          <a
            href="mailto:lee@surviveaccounting.com"
            className="underline hover:opacity-80"
            style={{ color: "#64748B" }}
          >
            Lee usually replies within 1–2 business days.
          </a>
        </p>
      </main>

      <FeedbackToolModal
        open={feedbackOpen}
        email={email}
        onClose={() => setFeedbackOpen(false)}
      />

      <WelcomeVideoModal open={videoOpen} onClose={() => setVideoOpen(false)} />

      {needsOnboarding && userId && email && (
        <OnboardingModal
          userId={userId}
          email={email}
          prefillCampusId={campusId}
          prefillCourseId={purchase?.course_id ?? null}
          prefillName={fallbackFirstName}
          onComplete={(result) => {
            setBetaNumber(result.beta_number ?? null);
            setCampusName(result.campus_name ?? campusName);
            setNeedsOnboarding(false);
          }}
        />
      )}

      {verifying && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md"
          style={{ background: "rgba(234, 242, 250, 0.6)" }}
        >
          <div
            className="rounded-2xl bg-white px-8 py-6 shadow-lg flex items-center gap-3 border"
            style={{ borderColor: "#E5E7EB" }}
          >
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: NAVY }} />
            <span className="text-[14px] font-medium" style={{ color: NAVY }}>
              Verifying payment…
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
