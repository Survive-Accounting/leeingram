import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowRight, X, Search } from "lucide-react";
import { toast } from "sonner";
import OnboardingModal from "@/components/dashboard/OnboardingModal";
import BetaCountdownStrip from "@/components/dashboard/BetaCountdownStrip";
import WelcomeCard from "@/components/dashboard/WelcomeCard";
import LegacyWelcomeCard from "@/components/dashboard/LegacyWelcomeCard";
import BetaToolCards from "@/components/dashboard/BetaToolCards";

const NAVY = "#14213D";
const RED = "#CE1126";
const BG_GRADIENT =
  "radial-gradient(ellipse at 50% 0%, #DBEAFE 0%, #EFF6FF 35%, #F8FAFC 70%, #F8FAFC 100%)";
const LOGO_FONT = "'DM Serif Display', serif";

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

interface LastViewed {
  asset_name: string;
  chapter_id: string | null;
  chapter_number: number | null;
  chapter_name: string | null;
}

/* ─── Helpers ─── */

async function openFirstAssetForChapter(chapterId: string) {
  const { data } = await supabase
    .from("teaching_assets")
    .select("asset_name, source_number")
    .eq("chapter_id", chapterId)
    .order("source_number", { ascending: true, nullsFirst: false })
    .order("asset_name", { ascending: true })
    .limit(1);
  const first = data?.[0];
  if (!first?.asset_name) {
    toast("This chapter is being finalized — check back soon.", { icon: "📚" });
    return;
  }
  window.open(`/v2/solutions/${encodeURIComponent(first.asset_name)}`, "_blank", "noopener,noreferrer");
}

/* ─── Navbar ─── */

function DashNavbar({
  onStart,
  onSignOut,
}: {
  onStart: () => void;
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
          onClick={() => navigate("/my-dashboard")}
          className="text-[16px] sm:text-[18px] tracking-tight"
          style={{ fontFamily: LOGO_FONT }}
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
            onClick={onStart}
            className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
            style={{
              background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
              boxShadow: "0 4px 12px rgba(206,17,38,0.25)",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Start Studying <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </nav>
    </header>
  );
}

/* ─── Chapter Picker Modal ─── */

function ChapterPickerModal({
  open,
  chapters,
  onClose,
}: {
  open: boolean;
  chapters: Chapter[];
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return chapters;
    return chapters.filter(
      (c) =>
        c.chapter_name.toLowerCase().includes(s) ||
        `ch ${c.chapter_number}`.includes(s) ||
        String(c.chapter_number) === s,
    );
  }, [q, chapters]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6"
      style={{ background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
        style={{ border: "1px solid #E0E7F0", fontFamily: "Inter, sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "#EEF2F7" }}>
          <h2 className="text-[16px] font-semibold" style={{ color: NAVY }}>
            Pick a chapter
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="h-4 w-4" style={{ color: "#64748B" }} />
          </button>
        </div>
        <div className="px-5 pt-4">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
          >
            <Search className="h-4 w-4" style={{ color: "#94A3B8" }} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search chapters…"
              className="flex-1 bg-transparent text-[14px] outline-none"
              style={{ color: NAVY }}
            />
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <p className="text-[13px] text-center py-8" style={{ color: "#94A3B8" }}>
              No chapters match.
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "#F1F5F9" }}>
              {filtered.map((ch) => (
                <li key={ch.id}>
                  <button
                    onClick={() => {
                      onClose();
                      openFirstAssetForChapter(ch.id);
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-lg hover:bg-slate-50 text-left"
                  >
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold" style={{ color: "#94A3B8" }}>
                        Ch {ch.chapter_number}
                      </div>
                      <div className="text-[14px] font-medium truncate" style={{ color: NAVY }}>
                        {ch.chapter_name}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0" style={{ color: "#CBD5E1" }} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lastViewed, setLastViewed] = useState<LastViewed | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [campusId, setCampusId] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboarding, setOnboarding] = useState<{
    is_legacy: boolean;
    beta_number: number | null;
    campus_beta_number: number | null;
    campus_name: string | null;
    display_name: string | null;
    welcomed_at: string | null;
  } | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [verifying, setVerifying] = useState<boolean>(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("just_paid") === "1" || p.get("checkout") === "success";
  });

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
        navigate("/login", { replace: true });
        return;
      }

      const userEmail = session.user.email.toLowerCase();
      setEmail(userEmail);

      const { data: rows } = await supabase
        .from("student_purchases")
        .select("id, course_id, expires_at, created_at")
        .eq("email", userEmail)
        .order("created_at", { ascending: false });

      if (!rows || rows.length === 0) {
        navigate("/login?message=no_purchase", { replace: true });
        return;
      }

      const now = Date.now();
      const active = rows.find((r) => !r.expires_at || new Date(r.expires_at).getTime() > now);
      const chosen = active ?? rows[0];
      setPurchase(chosen as Purchase);

      const { data: chapterRows } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name")
        .eq("course_id", chosen.course_id)
        .order("chapter_number", { ascending: true });

      const chapterList = (chapterRows ?? []) as Chapter[];
      setChapters(chapterList);

      // Last viewed problem (most recent asset_event for this email)
      const { data: events } = await supabase
        .from("asset_events")
        .select("asset_name, chapter_id, created_at")
        .eq("lw_email", userEmail)
        .not("asset_name", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);

      const ev = events?.[0];
      if (ev?.asset_name) {
        const ch = chapterList.find((c) => c.id === ev.chapter_id);
        setLastViewed({
          asset_name: ev.asset_name,
          chapter_id: ev.chapter_id,
          chapter_number: ch?.chapter_number ?? null,
          chapter_name: ch?.chapter_name ?? null,
        });
      }

      setLoading(false);
      if (verifying) setTimeout(() => setVerifying(false), 600);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const openStartStudying = () => {
    if (chapters.length === 0) {
      toast("No chapters available yet — check back soon.", { icon: "📚" });
      return;
    }
    setPickerOpen(true);
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

  const firstName = (() => {
    if (!email) return "";
    const local = email.split("@")[0].split("+")[0];
    const raw = local.split(/[._-]/)[0] || local;
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : "";
  })();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG_GRADIENT }}>
      <DashNavbar onStart={openStartStudying} onSignOut={handleSignOut} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-12 md:pt-16 pb-16 space-y-10">
        {/* Welcome */}
        <div className="text-center sm:text-left">
          <h1
            className="text-[34px] sm:text-[44px] md:text-[54px] leading-tight"
            style={{ color: NAVY, fontFamily: LOGO_FONT, fontWeight: 400 }}
          >
            {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          </h1>
          <p
            className="mt-2 text-[13px] sm:text-[14px]"
            style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
          >
            Access through {expiresStr}
          </p>
        </div>

        {/* Continue where you left off */}
        {lastViewed && (
          <section
            className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            style={{
              background: "#fff",
              border: "1px solid #E0E7F0",
              boxShadow: "0 8px 24px rgba(20,33,61,0.06), 0 2px 6px rgba(20,33,61,0.04)",
              fontFamily: "Inter, sans-serif",
            }}
          >
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold" style={{ color: NAVY }}>
                Continue where you left off
              </h3>
              {lastViewed.chapter_number != null && lastViewed.chapter_name && (
                <p className="text-[13px] mt-0.5 truncate" style={{ color: "#64748B" }}>
                  Ch {lastViewed.chapter_number} — {lastViewed.chapter_name}
                </p>
              )}
            </div>
            <button
              onClick={() =>
                window.open(
                  `/v2/solutions/${encodeURIComponent(lastViewed.asset_name)}`,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
              className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] shrink-0"
              style={{
                background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
                boxShadow: "0 4px 12px rgba(206,17,38,0.25)",
              }}
            >
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </section>
        )}

        {/* All chapters grid */}
        <section>
          <h2
            className="text-[22px] leading-tight mb-4"
            style={{ color: NAVY, fontFamily: LOGO_FONT, fontWeight: 400 }}
          >
            Chapters
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {chapters.map((ch) => (
              <button
                key={ch.id}
                onClick={() => openFirstAssetForChapter(ch.id)}
                className="text-left rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group"
                style={{
                  background: "#fff",
                  border: "1px solid #E0E7F0",
                  boxShadow: "0 4px 12px rgba(20,33,61,0.04)",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <div
                  className="text-[20px] font-bold leading-none mb-1.5 transition-colors"
                  style={{ color: NAVY, letterSpacing: "-0.02em" }}
                >
                  Ch {ch.chapter_number}
                </div>
                <div className="text-[12px] leading-snug line-clamp-2" style={{ color: "#64748B" }}>
                  {ch.chapter_name}
                </div>
              </button>
            ))}
          </div>
        </section>

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

      <ChapterPickerModal
        open={pickerOpen}
        chapters={chapters}
        onClose={() => setPickerOpen(false)}
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
