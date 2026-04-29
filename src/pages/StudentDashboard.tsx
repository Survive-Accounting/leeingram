import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import OnboardingModal from "@/components/dashboard/OnboardingModal";
import BetaCountdownStrip from "@/components/dashboard/BetaCountdownStrip";
import FeedbackToolModal from "@/components/dashboard/FeedbackToolModal";
import { WelcomeVideoModal } from "@/components/dashboard/WelcomeVideoCard";

import StudyPreviewer from "@/components/study-previewer/StudyPreviewer";
import { RetroBreadcrumbs, type BreadcrumbCrumb } from "@/components/study-previewer/RetroBreadcrumbs";

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
          className="text-[16px] sm:text-[18px] tracking-tight"
          style={{ fontFamily: LOGO_FONT }}
          aria-label="Survive Accounting — home"
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

/* ─── Secondary Card ─── */

function SecondaryCard({
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
  /** When set, replaces CTA label briefly (e.g. "Copied"). */
  ctaDone?: string | null;
}) {
  return (
    <div
      className="rounded-lg p-3.5 flex flex-col h-full"
      style={{
        background: "#fff",
        border: "1px solid rgba(20,33,61,0.08)",
        boxShadow: "0 1px 4px rgba(20,33,61,0.03)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div className="text-[12.5px] font-semibold" style={{ color: NAVY }}>
        {title}
      </div>
      <div
        className="mt-1 text-[11.5px] leading-snug flex-1"
        style={{ color: "#64748B" }}
      >
        {sub}
      </div>
      <button
        type="button"
        onClick={onClick}
        className="mt-2.5 self-start text-[11.5px] font-semibold hover:opacity-70 transition-opacity"
        style={{ color: ctaDone ? "#16A34A" : NAVY }}
      >
        {ctaDone ?? cta} ▸
      </button>
    </div>
  );
}

/* ─── Secondary Actions Row ─── */

function SecondaryActionsRow({
  betaNumber,
  onWatchDemo,
  onFeedback,
}: {
  betaNumber: number | null;
  onWatchDemo: () => void;
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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <SecondaryCard
        title="Watch the 60-second demo"
        sub="See how to use the beta before you start."
        cta="Watch Demo"
        onClick={onWatchDemo}
      />
      <SecondaryCard
        title="Share the beta"
        sub="Know someone taking accounting? Send them free finals access."
        cta="Copy Link"
        ctaDone={copied ? "Copied" : null}
        onClick={handleCopy}
      />
      <SecondaryCard
        title="Send Lee feedback"
        sub="Tell me what is helpful, confusing, or missing."
        cta="Share Feedback"
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

      <main className="flex-1 w-full mx-auto pt-2 sm:pt-4 pb-16">
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

            {/* Retro breadcrumbs above the terminal screen */}
            {(() => {
              const TOOL_LABEL: Record<"practice" | "je", string> = {
                practice: "practice problem helper",
                je: "journal entry helper",
              };
              const { chapter, activeTool } = previewerState;
              const hasSelection = !!chapter || !!activeTool;
              const crumbs: BreadcrumbCrumb[] = [
                {
                  label: "home",
                  ...(hasSelection
                    ? { onClick: () => setResetSignal((n) => n + 1) }
                    : {}),
                },
              ];
              if (chapter) {
                crumbs.push({
                  label: `ch ${chapter.chapter_number} ${chapter.chapter_name}`,
                  ...(activeTool
                    ? { onClick: () => setCloseToolSignal((n) => n + 1) }
                    : {}),
                });
              }
              if (activeTool) {
                crumbs.push({ label: TOOL_LABEL[activeTool] });
              }
              return (
                <div className="mb-3">
                  <RetroBreadcrumbs crumbs={crumbs} />
                </div>
              );
            })()}

            <StudyPreviewer
              chapters={chapters}
              fixedCourseLabel={courseLabel ?? null}
              campusLabel={campusName}
              dashboardMode
              betaNote="Free beta access is open through finals. Try the tools and tell us what helps."
              onOpenFeedback={() => setFeedbackOpen(true)}
              persistChapterKey={SELECTED_CHAPTER_KEY}
              welcomeName={firstName || null}
              isReturning={isReturning}
              onSelectionChange={setPreviewerState}
              resetSignal={resetSignal}
              closeToolSignal={closeToolSignal}
            />
          </div>
        </div>

        {/* Secondary actions — small, clearly secondary to the console above */}
        <section ref={secondaryRef} className="max-w-4xl mx-auto px-5 sm:px-8 mt-8 md:mt-10 scroll-mt-24">
          <SecondaryActionsRow
            betaNumber={betaNumber}
            onWatchDemo={() => setVideoOpen(true)}
            onFeedback={() => setFeedbackOpen(true)}
          />
          <p
            className="mt-6 text-center text-[12px]"
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
        </section>
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
