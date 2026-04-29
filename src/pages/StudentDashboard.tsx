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
  email,
  onStudyTools,
  onShare,
  onFeedback,
  onSignOut,
}: {
  email: string | null;
  onStudyTools: () => void;
  onShare: () => void;
  onFeedback: () => void;
  onSignOut: () => void;
}) {
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!accountOpen) return;
    const handler = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [accountOpen]);

  const initial = (email?.[0] ?? "?").toUpperCase();

  const linkStyle: React.CSSProperties = {
    color: NAVY,
    fontFamily: "Inter, sans-serif",
  };

  return (
    <header
      className="sticky top-0 z-40 w-full"
      style={{
        background: "rgba(255,255,255,0.85)",
        borderBottom: "1px solid rgba(20,33,61,0.08)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: "0 4px 16px rgba(20,33,61,0.05)",
      }}
    >
      <nav className="max-w-6xl mx-auto h-16 px-5 sm:px-8 flex items-center justify-between">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-[16px] sm:text-[18px] tracking-tight"
          style={{ fontFamily: LOGO_FONT }}
          aria-label="Survive Accounting — dashboard"
        >
          <span style={{ color: RED, fontWeight: 800 }}>Survive</span>
          <span style={{ color: NAVY, fontWeight: 400 }}> Accounting</span>
        </button>

        <div className="flex items-center gap-4 sm:gap-6">
          <button
            onClick={onStudyTools}
            className="hidden sm:inline-block text-[13px] font-semibold hover:opacity-70 transition-opacity"
            style={linkStyle}
          >
            Study tools
          </button>
          <button
            onClick={onShare}
            className="hidden sm:inline-block text-[13px] font-semibold hover:opacity-70 transition-opacity"
            style={linkStyle}
          >
            Share beta
          </button>
          <button
            onClick={onFeedback}
            className="text-[13px] font-semibold hover:opacity-70 transition-opacity"
            style={linkStyle}
          >
            Feedback
          </button>

          {/* Account menu */}
          <div ref={accountRef} className="relative">
            <button
              onClick={() => setAccountOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              aria-label="Account menu"
              className="inline-flex items-center justify-center rounded-full text-[12.5px] font-semibold text-white transition-transform hover:scale-105 active:scale-95"
              style={{
                width: 34,
                height: 34,
                background: `linear-gradient(180deg, ${NAVY} 0%, #0E1830 100%)`,
                boxShadow: "0 2px 8px rgba(20,33,61,0.25)",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {initial}
            </button>
            {accountOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 min-w-[220px] rounded-lg overflow-hidden"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid rgba(20,33,61,0.10)",
                  boxShadow: "0 12px 32px rgba(20,33,61,0.16)",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <div
                  className="px-4 py-3 text-[12px]"
                  style={{ color: "#64748B", borderBottom: "1px solid rgba(20,33,61,0.08)" }}
                >
                  Signed in as
                  <div
                    className="text-[13px] font-semibold mt-0.5 truncate"
                    style={{ color: NAVY }}
                    title={email ?? ""}
                  >
                    {email ?? "—"}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setAccountOpen(false);
                    onSignOut();
                  }}
                  className="w-full text-left px-4 py-2.5 text-[13px] font-medium hover:bg-slate-50 transition-colors"
                  style={{ color: NAVY }}
                  role="menuitem"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}

/* ─── Main Page ─── */

export default function StudentDashboard() {
  const navigate = useNavigate();
  const previewerRef = useRef<HTMLDivElement | null>(null);
  const shareRef = useRef<HTMLDivElement | null>(null);
  const scrollToPreviewer = () => {
    previewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const scrollToShare = () => {
    shareRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

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

  // Breadcrumb state — driven by StudyPreviewer's onSelectionChange callback.
  const [previewerState, setPreviewerState] = useState<{
    chapter: { id: string; chapter_number: number; chapter_name: string } | null;
    activeTool: "practice" | "je" | null;
  }>({ chapter: null, activeTool: null });
  // Bumping these signals tells StudyPreviewer to reset its state.
  const [resetSignal, setResetSignal] = useState(0);
  const [closeToolSignal, setCloseToolSignal] = useState(0);


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
      <DashNavbar
        email={email}
        onStudyTools={scrollToPreviewer}
        onShare={scrollToShare}
        onFeedback={() => setFeedbackOpen(true)}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-5 sm:px-8 pt-10 md:pt-12 pb-20 space-y-12 md:space-y-14">
        {/* Welcome header */}
        <section aria-label="Welcome">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
            <div>
              <h1
                className="text-[22px] sm:text-[26px] leading-tight"
                style={{ fontFamily: LOGO_FONT, fontWeight: 400, color: NAVY }}
              >
                {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
              </h1>
              <p
                className="mt-1 text-[13px] sm:text-[14px]"
                style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
              >
                {courseLabel && campusName
                  ? `Let's Survive ${courseLabel} at ${campusName}.`
                  : courseLabel
                    ? `Let's Survive ${courseLabel}.`
                    : "Let's get you ready for finals."}
              </p>
            </div>
            <button
              type="button"
              onClick={scrollToPreviewer}
              className="self-start sm:self-end inline-flex items-center gap-1.5 text-[12.5px] font-semibold hover:underline transition-opacity"
              style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
            >
              Go to study tools <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6 items-stretch">
            <div ref={shareRef} className="md:col-span-7 scroll-mt-24">
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

        {/* Previewer entry — the centerpiece (full-bleed navy hero band) */}
        <div
          ref={previewerRef}
          className="relative scroll-mt-24"
          style={{
            // Full-bleed breakout from the constrained <main> container
            marginLeft: "calc(50% - 50vw)",
            marginRight: "calc(50% - 50vw)",
            paddingLeft: "1rem",
            paddingRight: "1rem",
            paddingTop: "5rem",
            paddingBottom: "5rem",
            background: `radial-gradient(120% 80% at 50% 0%, #1A2A4F 0%, ${NAVY} 55%, #0E1830 100%)`,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            borderBottom: "1px solid rgba(0,0,0,0.25)",
          }}
        >
          {/* Subtle top vignette */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 40% at 50% 0%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 70%)",
            }}
          />
          <div className="relative mx-auto" style={{ maxWidth: 1080 }}>
            <div className="text-center mb-16 sm:mb-20" style={{ maxWidth: 760, margin: "0 auto" }}>
              <div
                className="inline-flex items-center gap-2 text-[11px] font-bold uppercase mb-4"
                style={{ color: "#FF6B7A", letterSpacing: "0.16em" }}
              >
                <span
                  className="inline-block rounded-full"
                  style={{ width: 6, height: 6, background: RED, boxShadow: "0 0 8px rgba(206,17,38,0.6)" }}
                />
                FREE BETA · OPEN FOR FEEDBACK
              </div>
              <h2
                className="text-[28px] sm:text-[38px] leading-[1.1]"
                style={{ fontFamily: LOGO_FONT, fontWeight: 400, color: "#FFFFFF" }}
              >
                Free accounting study tools for finals.
              </h2>
              <p
                className="mt-4 text-[15px] sm:text-[16px]"
                style={{ color: "rgba(255,255,255,0.72)", fontFamily: "Inter, sans-serif" }}
              >
                Choose a course and chapter to enter your study console.
              </p>
              <p
                className="mt-3 text-[11px]"
                style={{ color: "rgba(255,255,255,0.45)", fontFamily: "Inter, sans-serif" }}
              >
                Free access expires May 31st
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
