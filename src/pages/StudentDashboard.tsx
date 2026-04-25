import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import StagingNavbar from "@/components/landing/StagingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";

const NAVY = "#14213D";
const RED = "#CE1126";
const BG_GRADIENT =
  "radial-gradient(ellipse at 50% 0%, #DBEAFE 0%, #EFF6FF 35%, #F8FAFC 70%, #F8FAFC 100%)";

interface Purchase {
  id: string;
  course_id: string;
  chapter_id: string | null;
  purchase_type: string;
  expires_at: string | null;
  created_at: string;
}

interface Course {
  id: string;
  course_name: string;
  code: string | null;
  slug: string | null;
}

interface Chapter {
  id: string;
  chapter_number: number;
  chapter_name: string;
}

/**
 * Minimal MVP student dashboard.
 * Shows the student's active study pass and the chapters in the course
 * they purchased — pulled dynamically from the database.
 */
export default function StudentDashboard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<boolean>(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("just_paid") === "1" || p.get("checkout") === "success";
  });

  useEffect(() => {
    // Clean ?just_paid / ?checkout from the URL after we read them
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
        .select("id, course_id, chapter_id, purchase_type, expires_at, created_at")
        .eq("email", userEmail)
        .order("created_at", { ascending: false });

      if (!rows || rows.length === 0) {
        navigate("/login?message=no_purchase", { replace: true });
        return;
      }

      // Pick the most recent active pass (or just the most recent if all expired)
      const now = Date.now();
      const active = rows.find((r) => !r.expires_at || new Date(r.expires_at).getTime() > now);
      const chosen = active ?? rows[0];
      setPurchase(chosen as Purchase);

      // Fetch course and chapters in parallel
      const [{ data: courseRow }, { data: chapterRows }] = await Promise.all([
        supabase
          .from("courses")
          .select("id, course_name, code, slug")
          .eq("id", chosen.course_id)
          .maybeSingle(),
        supabase
          .from("chapters")
          .select("id, chapter_number, chapter_name")
          .eq("course_id", chosen.course_id)
          .order("chapter_number", { ascending: true }),
      ]);

      setCourse(courseRow as Course | null);
      setChapters((chapterRows ?? []) as Chapter[]);
      setLoading(false);

      // Tiny verifying overlay if just paid
      if (verifying) {
        setTimeout(() => setVerifying(false), 600);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const openChapter = (ch: Chapter) => {
    window.open(`/cram/${ch.id}`, "_blank", "noopener,noreferrer");
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
    : "Through current semester";

  const isActive = !purchase?.expires_at || new Date(purchase.expires_at).getTime() > Date.now();

  // Derive a friendly first name from the email local-part
  // e.g. "lee+test@x.com" -> "Lee", "jane.doe@x.com" -> "Jane"
  const firstName = (() => {
    if (!email) return "";
    const local = email.split("@")[0].split("+")[0];
    const raw = local.split(/[._-]/)[0] || local;
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : "";
  })();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG_GRADIENT }}>
      <StagingNavbar
        onCtaClick={() => navigate("/")}
        onPricingClick={() => navigate("/")}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-12 md:pt-16 pb-16 space-y-10">
        {/* Welcome */}
        <div className="text-center sm:text-left">
          <h1
            className="text-[34px] sm:text-[44px] md:text-[54px] leading-tight"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
          >
            {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          </h1>
          <p
            className="mt-3 text-[15px] sm:text-[16px]"
            style={{ color: "#475569", fontFamily: "Inter, sans-serif" }}
          >
            {course?.course_name ?? "Your course"}
          </p>
          <p
            className="mt-1 text-[14px] sm:text-[15px]"
            style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
          >
            Access through {expiresStr}
          </p>
          <div className="mt-3 flex justify-center sm:justify-start">
            <button
              onClick={handleSignOut}
              className="text-[12px] font-medium hover:underline"
              style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Your Chapters */}
        <section>
          <h2
            className="text-[26px] leading-tight"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
          >
            Your chapters
          </h2>
          <p className="text-[14px] mt-1 mb-4" style={{ color: "#475569", fontFamily: "Inter, sans-serif" }}>
            Start with the chapter you're studying.
          </p>

          {chapters.length === 0 ? (
            <div
              className="rounded-2xl p-6 text-center"
              style={{
                background: "#fff",
                border: "1px solid #E0E7F0",
                boxShadow: "0 24px 60px rgba(20,33,61,0.10), 0 2px 8px rgba(20,33,61,0.04)",
              }}
            >
              <p className="text-[14px]" style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}>
                We're setting up your chapter list. Check back soon.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {chapters.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => openChapter(ch)}
                  className="text-left rounded-2xl p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl group"
                  style={{
                    background: "#fff",
                    border: "1px solid #E0E7F0",
                    boxShadow: "0 8px 24px rgba(20,33,61,0.06), 0 2px 6px rgba(20,33,61,0.04)",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <div
                    className="text-[28px] sm:text-[32px] font-bold leading-none mb-2 transition-colors group-hover:text-[color:var(--accent-red)]"
                    style={{
                      color: NAVY,
                      letterSpacing: "-0.02em",
                      ["--accent-red" as any]: RED,
                    }}
                  >
                    Ch {ch.chapter_number}
                  </div>
                  <div
                    className="text-[13px] leading-snug line-clamp-2"
                    style={{ color: "#64748B" }}
                  >
                    {ch.chapter_name}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Legacy Video Library — secondary, for existing LearnWorlds students */}
        <div
          className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          style={{
            background: "rgba(255,255,255,0.6)",
            border: "1px solid #E0E7F0",
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold" style={{ color: NAVY }}>
              Legacy Video Library
            </h3>
            <p className="text-[13px] mt-0.5" style={{ color: "#64748B" }}>
              Access the previous Survive Accounting video library.
            </p>
          </div>
          <a
            href="https://player.surviveaccounting.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-white shrink-0"
            style={{ borderColor: "rgba(20,33,61,0.2)", color: NAVY }}
          >
            Open video library
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Support footer */}
        <div className="pt-2 text-center">
          <p className="text-[13px]" style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}>
            Need help?{" "}
            <a
              href="mailto:lee@surviveaccounting.com"
              className="font-semibold hover:underline"
              style={{ color: RED }}
            >
              Contact Lee
            </a>
          </p>
        </div>
      </main>

      <LandingFooter
        onScrollToCourses={() => navigate("/")}
        onScrollToContact={() => navigate("/")}
      />

      {/* Just-paid verifying overlay */}
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
