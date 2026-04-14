import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink } from "lucide-react";

const NAVY = "#14213D";
const RED = "#CE1126";
const LW_BASE = "https://player.surviveaccounting.com";

interface Purchase {
  id: string;
  course_id: string;
  chapter_id: string | null;
  purchase_type: string;
  expires_at: string | null;
  course_name?: string;
  chapter_name?: string;
}

const COURSES = [
  {
    id: "44444444-4444-4444-4444-444444444444",
    code: "IA2",
    name: "Intermediate Accounting 2",
    slug: "intermediate-2",
    status: "live" as const,
    badge: null,
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    code: "INTRO2",
    name: "Introductory Accounting 2",
    slug: "managerial-accounting",
    status: "upcoming" as const,
    badge: "Launching April 24, 2026",
  },
  {
    id: "11111111-1111-1111-1111-111111111111",
    code: "INTRO1",
    name: "Introductory Accounting 1",
    slug: "financial-accounting",
    status: "future" as const,
    badge: "Available Fall 2026",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    code: "IA1",
    name: "Intermediate Accounting 1",
    slug: "intermediate-1",
    status: "future" as const,
    badge: "Available Fall 2026",
  },
];

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        navigate("/login", { replace: true });
        return;
      }

      const userEmail = session.user.email.toLowerCase();
      setEmail(userEmail);

      const now = new Date().toISOString();
      const { data: rows } = await supabase
        .from("student_purchases")
        .select("id, course_id, chapter_id, purchase_type, expires_at")
        .eq("email", userEmail);

      if (!rows || rows.length === 0) {
        navigate("/login?message=no_purchase", { replace: true });
        return;
      }

      // Enrich with course/chapter names
      const enriched = rows.map((r) => {
        const course = COURSES.find((c) => c.id === r.course_id);
        return { ...r, course_name: course?.name ?? "Course" };
      });

      setPurchases(enriched);
      setLoading(false);
    };

    init();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const activePasses = purchases.filter(
    (p) => !p.expires_at || new Date(p.expires_at) > new Date()
  );
  const allExpired = purchases.length > 0 && activePasses.length === 0;
  const purchasedCourseIds = new Set(activePasses.map((p) => p.course_id));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8F9FA" }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#999" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F8F9FA" }}>
      {/* Header */}
      <header
        className="border-b px-4 sm:px-6 h-14 flex items-center justify-between"
        style={{ background: "#fff", borderColor: "#E5E7EB" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
            style={{ background: NAVY, fontFamily: "'DM Serif Display', Georgia, serif" }}
          >
            SA
          </div>
          <span className="text-[15px] font-semibold" style={{ color: NAVY }}>
            Survive Accounting
          </span>
        </div>
        <button
          onClick={handleSignOut}
          className="text-[13px] font-medium hover:underline"
          style={{ color: "#999" }}
        >
          Sign Out →
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* 1. Welcome */}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>
            Welcome back.
          </h1>
          <p className="text-[14px] mt-0.5" style={{ color: "#999" }}>
            {email}
          </p>
        </div>

        {/* 2. Active Study Passes */}
        <section className="space-y-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "#999" }}>
            Active Study Passes
          </h2>

          {allExpired ? (
            <div
              className="rounded-xl border p-6 text-center space-y-2"
              style={{ background: "#fff", borderColor: "#E5E7EB" }}
            >
              <p className="text-[15px] font-semibold" style={{ color: NAVY }}>
                Your study pass has expired.
              </p>
              <p className="text-[13px]" style={{ color: "#999" }}>
                Purchase a new pass to regain access.
              </p>
              <a
                href="/accy304"
                className="inline-block mt-2 rounded-lg px-5 py-2.5 text-white text-[14px] font-semibold"
                style={{ background: RED }}
              >
                Get a New Pass →
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {activePasses.map((p) => {
                const course = COURSES.find((c) => c.id === p.course_id);
                const expiresStr = p.expires_at
                  ? new Date(p.expires_at).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : null;

                return (
                  <div
                    key={p.id}
                    className="rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    style={{ background: "#fff", borderColor: "#E5E7EB" }}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[15px] font-semibold" style={{ color: NAVY }}>
                          {p.course_name}
                        </span>
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white"
                          style={{
                            background: p.purchase_type === "full_pass" ? "#16A34A" : "#2563EB",
                          }}
                        >
                          {p.purchase_type === "full_pass" ? "Full Pass" : "Chapter Pass"}
                        </span>
                      </div>
                      {expiresStr && (
                        <p className="text-[13px]" style={{ color: "#999" }}>
                          Access expires {expiresStr}
                        </p>
                      )}
                      <p className="text-[12px]" style={{ color: "#CCC" }}>
                        Study time tracking coming soon
                      </p>
                    </div>
                    {course && (
                      <a
                        href={`${LW_BASE}/course/${course.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg px-4 py-2.5 text-white text-[14px] font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap"
                        style={{ background: NAVY, minHeight: 44 }}
                      >
                        Go to Course <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. Available Courses */}
        <section className="space-y-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "#999" }}>
            Available Courses
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {COURSES.map((c) => {
              const isActive = purchasedCourseIds.has(c.id);

              return (
                <div
                  key={c.id}
                  className="rounded-xl border p-5 flex flex-col justify-between gap-3"
                  style={{ background: "#fff", borderColor: "#E5E7EB" }}
                >
                  <div>
                    <p className="text-[15px] font-semibold" style={{ color: NAVY }}>
                      {c.name}
                    </p>
                    <p className="text-[12px] font-medium mt-0.5" style={{ color: "#999" }}>
                      {c.code}
                    </p>
                  </div>

                  {c.status === "live" && isActive && (
                    <span
                      className="text-[12px] font-semibold px-2.5 py-1 rounded-full self-start"
                      style={{ background: "#DCFCE7", color: "#16A34A" }}
                    >
                      Active ✓
                    </span>
                  )}

                  {c.status === "live" && !isActive && (
                    <a
                      href="/accy304"
                      className="rounded-lg px-4 py-2.5 text-white text-[14px] font-semibold text-center"
                      style={{ background: NAVY, minHeight: 44 }}
                    >
                      Get Access →
                    </a>
                  )}

                  {c.status === "upcoming" && (
                    <>
                      <span
                        className="text-[12px] font-semibold px-2.5 py-1 rounded-full self-start"
                        style={{ background: "#FEF3C7", color: "#92400E" }}
                      >
                        {c.badge}
                      </span>
                      <button
                        className="text-[13px] font-medium self-start hover:underline"
                        style={{ color: "#999" }}
                      >
                        Notify Me →
                      </button>
                    </>
                  )}

                  {c.status === "future" && (
                    <>
                      <span
                        className="text-[12px] font-semibold px-2.5 py-1 rounded-full self-start"
                        style={{ background: "#F3F4F6", color: "#6B7280" }}
                      >
                        {c.badge}
                      </span>
                      <button
                        className="text-[13px] font-medium self-start hover:underline"
                        style={{ color: "#999" }}
                      >
                        Request Early Access →
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. Quick Links */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 text-[13px]" style={{ color: "#999" }}>
          <a href="mailto:lee@surviveaccounting.com" className="hover:underline">
            Get in Touch with Lee →
          </a>
          <a href="/accy304#refund" className="hover:underline">
            7-day refund policy →
          </a>
        </div>
      </main>
    </div>
  );
}
