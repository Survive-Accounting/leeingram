import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowRight, Menu } from "lucide-react";
import { toast } from "sonner";
import OnboardingModal from "@/components/dashboard/OnboardingModal";

import ShareFeedbackModal from "@/components/dashboard/ShareFeedbackModal";
import { WelcomeVideoModal } from "@/components/dashboard/WelcomeVideoCard";

import StudyPreviewer from "@/components/study-previewer/StudyPreviewer";


import { getCourseLabel } from "@/lib/courseLabel";
import { useDevToolFlag, setDevToolFlag } from "@/lib/devToolFlags";
import { useIsStaff } from "@/hooks/useIsStaff";

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

  const BETA_END = new Date("2026-05-15T23:59:59Z").getTime();
  const [betaDaysLeft, setBetaDaysLeft] = useState<number>(() =>
    Math.max(0, Math.ceil((BETA_END - Date.now()) / (1000 * 60 * 60 * 24))),
  );
  useEffect(() => {
    const t = setInterval(() => {
      setBetaDaysLeft(Math.max(0, Math.ceil((BETA_END - Date.now()) / (1000 * 60 * 60 * 24))));
    }, 60_000);
    return () => clearInterval(t);
  }, [BETA_END]);

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
          onClick={() => navigate("/")}
          className="flex items-baseline gap-2 hover:opacity-80 transition-opacity text-left"
          style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
          aria-label="Spring 2026 Beta — home"
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] whitespace-nowrap">
            Spring 2026 Beta
          </span>
          <span
            className="hidden sm:inline text-[11px]"
            style={{ color: "rgba(20,33,61,0.35)" }}
          >
            ·
          </span>
          <span
            className="hidden sm:inline text-[11.5px]"
            style={{ color: "rgba(20,33,61,0.65)", fontWeight: 500 }}
          >
            Expires May 15, 2026
          </span>
          <span
            className="hidden sm:inline text-[11px]"
            style={{ color: "rgba(20,33,61,0.35)" }}
          >
            ·
          </span>
          <span
            className="hidden sm:inline text-[11.5px] font-semibold"
            style={{ color: RED }}
          >
            {betaDaysLeft} {betaDaysLeft === 1 ? "day" : "days"} left
          </span>
        </button>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            onClick={onShare}
            className="hidden sm:inline-flex items-center rounded-md text-[12.5px] sm:text-[13px] font-semibold transition-all hover:bg-slate-100 active:scale-95"
            style={{
              color: NAVY,
              padding: "8px 12px",
              fontFamily: "Inter, sans-serif",
              border: "1px solid rgba(20,33,61,0.12)",
              background: "#fff",
            }}
          >
            Share with a friend
          </button>

          <button
            onClick={onFeedback}
            className="inline-flex items-center rounded-md text-[12.5px] sm:text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-95"
            style={{
              background: NAVY,
              padding: "8px 14px",
              fontFamily: "Inter, sans-serif",
              boxShadow: "0 2px 8px rgba(20,33,61,0.18)",
            }}
          >
            Send feedback
          </button>

          {/* Hamburger menu — sign out only */}
          <div ref={accountRef} className="relative">
            <button
              onClick={() => setAccountOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              aria-label="Open menu"
              className="inline-flex items-center justify-center rounded-md transition-colors hover:bg-slate-100 active:scale-95"
              style={{
                width: 38,
                height: 38,
                color: NAVY,
                border: "1px solid rgba(20,33,61,0.10)",
              }}
            >
              <Menu className="h-5 w-5" strokeWidth={2} />
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

/* ─── Secondary Card (dark navy band variant) ─── */

function SecondaryDarkCard({
  title,
  sub,
  cta,
  onClick,
  ctaDone,
}: {
  title: string;
  sub: string;
  cta: string;
  onClick: () => void;
  ctaDone?: string | null;
  variant?: "share" | "feedback";
}) {
  const accent = RED;
  return (
    <div
      className="group relative rounded-xl p-5 text-left transition-all"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 8px 22px rgba(0,0,0,0.25)",
        fontFamily: "Inter, sans-serif",
        color: "#fff",
      }}
    >
      <div
        aria-hidden
        className="absolute left-0 top-4 bottom-4 rounded-r"
        style={{ width: 3, background: accent, boxShadow: `0 0 12px ${accent}80` }}
      />
      <div
        className="text-[16px] sm:text-[17px] font-bold leading-snug pl-3"
        style={{ color: "#fff" }}
      >
        {title}
      </div>
      <div
        className="mt-1.5 text-[13px] leading-relaxed pl-3"
        style={{ color: "rgba(255,255,255,0.72)" }}
      >
        {sub}
      </div>
      <div className="mt-4 pl-3">
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
          style={{
            background: ctaDone ? "#16A34A" : accent,
            boxShadow: `0 6px 16px ${ctaDone ? "#16A34A" : accent}55`,
          }}
        >
          {ctaDone ?? cta}
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}

/* ─── Secondary Actions Row ─── */

function SecondaryActionsRow({
  betaNumber,
  onFeedback,
}: {
  betaNumber: number | null;
  onFeedback: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl = betaNumber
    ? `https://learn.surviveaccounting.com/?ref=${betaNumber}`
    : "https://learn.surviveaccounting.com/";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied — share with a friend");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Long-press to copy manually.");
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      <SecondaryDarkCard
        variant="share"
        
        title="Share the beta with a friend"
        sub="Know someone taking accounting? Send them free finals access."
        cta="Copy your share link"
        ctaDone={copied ? "Link copied" : null}
        onClick={handleCopy}
      />
      <SecondaryDarkCard
        variant="feedback"
        
        title="Send Lee feedback"
        sub="Tell me what's helpful, confusing, or missing — I read every note."
        cta="Share feedback"
        onClick={onFeedback}
      />
    </div>
  );
}

/* ─── Main Page ─── */

export default function StudentDashboard() {
  const navigate = useNavigate();
  const previewerRef = useRef<HTMLDivElement | null>(null);
  const secondaryRef = useRef<HTMLDivElement | null>(null);
  const scrollToPreviewer = () => {
    previewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const scrollToShare = () => {
    secondaryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
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
  const [signedOut, setSignedOut] = useState(false);
  const [signOutCopied, setSignOutCopied] = useState(false);
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
    setSignedOut(true);
  };

  const signOutShareUrl = betaNumber
    ? `https://learn.surviveaccounting.com/?ref=${betaNumber}`
    : "https://learn.surviveaccounting.com/";

  const handleSignOutShare = async () => {
    try {
      await navigator.clipboard.writeText(signOutShareUrl);
      setSignOutCopied(true);
      toast.success("Link copied — share with a friend");
      setTimeout(() => setSignOutCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Long-press to copy manually.");
    }
  };

  const dismissSignOut = () => {
    setSignedOut(false);
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
      <DashNavbar
        email={email}
        onStudyTools={scrollToPreviewer}
        onShare={scrollToShare}
        onFeedback={() => setFeedbackOpen(true)}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 w-full mx-auto pt-2 sm:pt-4 pb-16">
        {/* Welcome heading — sits above the retro console */}
        <div className="px-5 sm:px-8 pt-4 sm:pt-6 pb-3 sm:pb-4 max-w-6xl mx-auto w-full">
          <h1
            className="text-[22px] sm:text-[28px] font-bold leading-tight"
            style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
          >
            {greeting}.
          </h1>
          <p
            className="mt-1 text-[14px] sm:text-[15px]"
            style={{ color: "rgba(20,33,61,0.7)", fontFamily: "Inter, sans-serif" }}
          >
            Test out the free study tools below.
          </p>

          <a
            href="https://surviveaccounting.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] sm:text-[14px] font-semibold transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{
              background: "#fff",
              border: `1px solid rgba(20,33,61,0.15)`,
              color: NAVY,
              fontFamily: "Inter, sans-serif",
            }}
          >
            <span style={{ color: "rgba(20,33,61,0.6)", fontWeight: 500 }}>Existing student?</span>
            <span>Log in to the old course platform →</span>
          </a>
        </div>

        {/* Previewer entry — the centerpiece (full-bleed navy hero band) */}
        <div
          ref={previewerRef}
          className="relative scroll-mt-24 px-3 sm:px-4 pt-3 sm:pt-6 pb-8 sm:pb-12"
          style={{
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
            <StudyPreviewer
              chapters={chapters}
              fixedCourseLabel={courseLabel ?? null}
              campusLabel={campusName}
              dashboardMode
              betaNote="Free beta access is open through finals. Try the tools and tell us what helps."
              onOpenFeedback={() => setFeedbackOpen(true)}
              persistChapterKey={SELECTED_CHAPTER_KEY}
              welcomeName={null}
              isReturning={isReturning}
              onSelectionChange={setPreviewerState}
              resetSignal={resetSignal}
              closeToolSignal={closeToolSignal}
            />

            {/* Divider between console and secondary actions */}
            <div
              ref={secondaryRef}
              className="mt-10 sm:mt-14 mb-6 sm:mb-8 scroll-mt-24"
              aria-hidden
              style={{
                height: 1,
                background:
                  "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0) 100%)",
              }}
            />

            {/* Secondary actions — share + feedback, on the navy hero band */}
            <SecondaryActionsRow
              betaNumber={betaNumber}
              onFeedback={() => setFeedbackOpen(true)}
            />
          </div>
        </div>
      </main>

      <ShareFeedbackModal
        open={feedbackOpen}
        email={email}
        onClose={() => setFeedbackOpen(false)}
      />

      <WelcomeVideoModal open={videoOpen} onClose={() => setVideoOpen(false)} />

      {signedOut && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          style={{ background: "rgba(15,23,42,0.72)", backdropFilter: "blur(6px)" }}
          onClick={dismissSignOut}
          role="dialog"
          aria-modal="true"
          aria-labelledby="signout-title"
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white p-7 sm:p-8"
            style={{
              fontFamily: "Inter, sans-serif",
              boxShadow: "0 24px 60px rgba(15,23,42,0.35)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={dismissSignOut}
              aria-label="Close"
              className="absolute top-3 right-3 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              style={{ width: 32, height: 32 }}
            >
              ×
            </button>

            <h2
              id="signout-title"
              className="text-[20px] sm:text-[22px] font-bold leading-snug pr-6"
              style={{ color: NAVY }}
            >
              Thanks for trying our free study tools.
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
              Tell a friend so they can survive finals too — or send Lee feedback to help shape what comes next.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                onClick={handleSignOutShare}
                className="w-full inline-flex items-center justify-center rounded-md text-[14px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.99]"
                style={{
                  background: NAVY,
                  padding: "12px 18px",
                  boxShadow: "0 2px 10px rgba(20,33,61,0.22)",
                }}
              >
                {signOutCopied ? "Link copied" : "Share with a friend"}
              </button>
              <button
                onClick={() => setFeedbackOpen(true)}
                className="w-full inline-flex items-center justify-center rounded-md text-[14px] font-semibold transition-colors hover:bg-slate-50"
                style={{
                  color: NAVY,
                  border: "1px solid rgba(20,33,61,0.18)",
                  background: "#FFFFFF",
                  padding: "12px 18px",
                }}
              >
                Share feedback
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Staff-only onboarding simulator. Toggled via the Admin Tools menu
          (Simulate Onboarding). Skips all validation, never writes to the DB —
          purely for QA-ing the modal's UI/UX. */}
      <OnboardingSimulator
        userId={userId}
        email={email}
        campusId={campusId}
        courseId={purchase?.course_id ?? null}
        fallbackFirstName={fallbackFirstName}
      />

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

/* ─── Onboarding Simulator (staff-only, /my-dashboard QA tool) ─── */

function OnboardingSimulator({
  userId,
  email,
  campusId,
  courseId,
  fallbackFirstName,
}: {
  userId: string | null;
  email: string | null;
  campusId: string | null;
  courseId: string | null;
  fallbackFirstName: string;
}) {
  const isStaff = useIsStaff();
  const flagOn = useDevToolFlag("simulateOnboarding");
  // Force-remount the modal each time the flag flips on so internal state
  // (current step, name, etc.) starts fresh — letting Lee replay it freely.
  const [runId, setRunId] = useState(0);
  useEffect(() => {
    if (flagOn) setRunId((n) => n + 1);
  }, [flagOn]);

  if (!isStaff || !flagOn || !userId || !email) return null;

  const close = () => setDevToolFlag("simulateOnboarding", false);

  return (
    <OnboardingModal
      key={`sim-${runId}`}
      simulate
      userId={userId}
      email={email}
      prefillCampusId={campusId}
      prefillCourseId={courseId}
      prefillName={fallbackFirstName}
      onComplete={() => close()}
      onClose={close}
    />
  );
}
