import { useEffect, useMemo, useRef, useState } from "react";
// (useMemo used via useMemoSafe helper at bottom of file)
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowRight, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import OnboardingModal from "@/components/dashboard/OnboardingModal";
import BetaCountdownStrip from "@/components/dashboard/BetaCountdownStrip";
import FeedbackToolModal from "@/components/dashboard/FeedbackToolModal";
import { WelcomeVideoCard, WelcomeVideoModal } from "@/components/dashboard/WelcomeVideoCard";
import EarlyBirdOptInRow from "@/components/dashboard/EarlyBirdOptInRow";
import StudyToolCards, { type ToolKey } from "@/components/dashboard/StudyToolCards";
import ShareWithFriendsBand from "@/components/dashboard/ShareWithFriendsBand";

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
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolKey | null>(null);
  const [viewerAssetCode, setViewerAssetCode] = useState<string | null>(null);
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

  const chapterDropdownRef = useRef<HTMLSelectElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

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
      if (cId) {
        const { data: c } = await supabase.from("campuses").select("name").eq("id", cId).maybeSingle();
        resolvedCampusName = c?.name ?? null;
        setCampusName(resolvedCampusName);
      }

      // Course label
      const { data: course } = await supabase
        .from("courses")
        .select("course_name, code")
        .eq("id", chosen.course_id)
        .maybeSingle();
      if (course) {
        setCourseLabel(course.code ? `${course.code} · ${course.course_name}` : course.course_name);
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

      // Restore last selected chapter from local storage
      try {
        const stored = localStorage.getItem(SELECTED_CHAPTER_KEY);
        if (stored && chapterList.some((c) => c.id === stored)) {
          setSelectedChapterId(stored);
        }
      } catch { /* ignore */ }

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

  const handleChapterChange = async (chId: string) => {
    if (!chId) {
      setSelectedChapterId(null);
      setViewerAssetCode(null);
      try { localStorage.removeItem(SELECTED_CHAPTER_KEY); } catch { /* ignore */ }
      return;
    }
    setChapterLoading(true);
    setViewerAssetCode(null);

    const ch = chapters.find((c) => c.id === chId);

    // Resolve first asset for that chapter
    const { data } = await supabase
      .from("teaching_assets")
      .select("asset_name, source_number")
      .eq("chapter_id", chId)
      .order("source_number", { ascending: true, nullsFirst: false })
      .order("asset_name", { ascending: true })
      .limit(1);
    const first = data?.[0]?.asset_name ?? null;

    // Hold the shimmer briefly so it actually feels like loading.
    await new Promise((r) => setTimeout(r, 750));

    setSelectedChapterId(chId);
    setViewerAssetCode(first);
    setChapterLoading(false);
    try { localStorage.setItem(SELECTED_CHAPTER_KEY, chId); } catch { /* ignore */ }

    if (ch) {
      toast.success(`Ch. ${ch.chapter_number} study tools are loaded!`);
    }
  };

  const handleSelectTool = (key: ToolKey) => {
    setActiveTool(key);
    // Smooth scroll the workspace into view
    setTimeout(() => {
      workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleNudgeChapter = () => {
    toast("Pick a chapter first 👇");
    chapterDropdownRef.current?.focus();
    chapterDropdownRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
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

  const selectedChapter = useMemoSafe(
    () => chapters.find((c) => c.id === selectedChapterId) ?? null,
    [chapters, selectedChapterId],
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG_GRADIENT }}>
      <BetaCountdownStrip />
      <DashNavbar onFeedback={() => setFeedbackOpen(true)} onSignOut={handleSignOut} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-5 sm:px-8 pt-12 md:pt-16 pb-20 space-y-10">
        {/* Welcome heading + video */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 md:gap-10">
          <div className="text-center md:text-left">
            <h1
              className="text-[34px] sm:text-[44px] md:text-[54px] leading-tight"
              style={{ color: NAVY, fontFamily: LOGO_FONT, fontWeight: 400 }}
            >
              {greeting}
            </h1>
            <p
              className="mt-2 text-[13px] sm:text-[14px]"
              style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
            >
              Free Beta Access through {expiresStr}
            </p>

            {!earlyBirdOpted && userId && (
              <EarlyBirdOptInRow
                userId={userId}
                onOptedIn={() => setEarlyBirdOpted(true)}
              />
            )}
          </div>
          <div className="md:shrink-0 flex justify-center md:justify-end">
            <WelcomeVideoCard onClick={() => setVideoOpen(true)} />
          </div>
        </div>

        {/* Course + Chapter selector */}
        <section
          className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
          style={{
            background: "#fff",
            border: "1px solid #E0E7F0",
            boxShadow: "0 4px 14px rgba(20,33,61,0.05)",
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div className="min-w-0 flex-1">
            <p
              className="text-[10.5px] uppercase tracking-widest font-semibold"
              style={{ color: "#94A3B8" }}
            >
              Your course
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
              disabled={chapterLoading}
              className="w-full appearance-none rounded-lg px-4 py-2.5 pr-10 text-[14px] font-medium outline-none transition-colors"
              style={{
                background: "#F8FAFC",
                border: `1px solid ${selectedChapterId ? NAVY : "#E2E8F0"}`,
                color: NAVY,
                cursor: chapterLoading ? "wait" : "pointer",
              }}
            >
              <option value="">Choose chapter…</option>
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
          onOpenFeedback={() => setFeedbackOpen(true)}
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
            fontFamily: "Inter, sans-serif",
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
                onClick={() => setFeedbackOpen(true)}
                className="mt-5 inline-flex items-center gap-1.5 rounded-md px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:brightness-110"
                style={{
                  background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
                  boxShadow: "0 4px 12px rgba(206,17,38,0.25)",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Tell us what you'd want <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </section>

        {/* Share with friends */}
        <ShareWithFriendsBand betaNumber={betaNumber} campusName={campusName} />

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

// Tiny inlined `useMemo` shim that takes a deps array — keeps the body tidy.
import { useMemo as _useMemo } from "react";
function useMemoSafe<T>(factory: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return _useMemo(factory, deps);
}
