import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { buildGetAccessUrl } from "@/lib/getAccessUrl";
import { sendMagicLink } from "@/lib/sendMagicLink";
import CheckEmailPanel from "@/components/landing/CheckEmailPanel";

const NAVY = "#14213D";
const RED = "#CE1126";

interface QuickEmailGateModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional course slug to pass through to /get-access. */
  courseSlug?: string | null;
}

type Step = "email" | "sent" | "courses";

interface CourseRow {
  id: string;
  slug: string;
  code: string | null;
  course_name: string;
  local_name?: string | null;
  local_code?: string | null;
}

/**
 * Canonical course order shown in every course picker on the landing flow.
 * Intro 1 (Financial) → Intro 2 (Managerial) → Intermediate 1 → Intermediate 2.
 */
const CANONICAL_COURSE_ORDER = [
  "intro-accounting-1",
  "intro-accounting-2",
  "intermediate-accounting-1",
  "intermediate-accounting-2",
];

function sortByCanonicalOrder<T extends { slug: string }>(rows: T[]): T[] {
  return rows.slice().sort((a, b) => {
    const ai = CANONICAL_COURSE_ORDER.indexOf(a.slug);
    const bi = CANONICAL_COURSE_ORDER.indexOf(b.slug);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

/**
 * Minimal email gateway used before /get-access.
 * - Returning users with active paid access → magic login link.
 * - New users → resolve campus, then pick a course → /get-access.
 */
export default function QuickEmailGateModal({
  open,
  onClose,
  courseSlug,
}: QuickEmailGateModalProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("email");

  const [campusSlug, setCampusSlug] = useState<string>("ole-miss");
  const [campusName, setCampusName] = useState<string>("");
  const [campusKnown, setCampusKnown] = useState<boolean>(false);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setErr(null);
      setLoading(false);
      setStep("email");
      setCampusSlug("ole-miss");
      setCampusName("");
      setCampusKnown(false);
      setCourses([]);
    }
  }, [open]);

  const persistEmail = (value: string) => {
    try {
      localStorage.setItem("student_email", value);
      sessionStorage.setItem("student_email", value);
    } catch {
      /* ignore */
    }
  };

  /**
   * Load courses for the modal.
   *
   * Campus-specific course lists (with local codes/names) are ONLY shown once
   * the campus has been approved by an admin (`campuses.status = 'approved'`).
   * Until then, every visitor — even a recognized .edu domain — sees the
   * generic 4-course list so we don't expose unverified school branding.
   */
  const loadCourses = async (slug: string, useCampusOverrides: boolean) => {
    setCoursesLoading(true);
    try {
      if (useCampusOverrides) {
        const { data: campusRow } = await supabase
          .from("campuses")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();

        if (campusRow?.id) {
          const { data: cc } = await supabase
            .from("campus_courses")
            .select("local_course_code, local_course_name, display_order, courses:course_id(id, slug, code, course_name)")
            .eq("campus_id", campusRow.id)
            .eq("is_active", true)
            .order("display_order", { ascending: true });

          const mapped: CourseRow[] = (cc ?? [])
            .map((row: any) => row.courses && {
              id: row.courses.id,
              slug: row.courses.slug,
              code: row.courses.code,
              course_name: row.courses.course_name,
              local_code: row.local_course_code,
              local_name: row.local_course_name,
            })
            .filter(Boolean) as CourseRow[];

          if (mapped.length > 0) {
            setCourses(sortByCanonicalOrder(mapped));
            return;
          }
        }
      }

      // Generic global course list (always 4 courses, no local codes).
      const { data: all } = await supabase
        .from("courses")
        .select("id, slug, code, course_name");
      setCourses(sortByCanonicalOrder((all ?? []) as CourseRow[]));
    } finally {
      setCoursesLoading(false);
    }
  };

  const goToGetAccess = (slug: string) => {
    persistEmail(email);
    const base = buildGetAccessUrl({ campus: campusSlug, course: slug });
    const sep = base.includes("?") ? "&" : "?";
    navigate(`${base}${sep}email=${encodeURIComponent(email)}`);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErr("Enter a valid email address.");
      return;
    }
    setEmail(trimmed);
    setLoading(true);
    setErr(null);

    // 1. Check for active paid access. If found → send magic link.
    try {
      const { data: purchases } = await supabase
        .from("student_purchases")
        .select("expires_at")
        .eq("email", trimmed)
        .limit(20);

      const now = Date.now();
      const hasActive = (purchases ?? []).some(
        (p: any) => !p.expires_at || new Date(p.expires_at).getTime() > now,
      );

      if (hasActive) {
        const res = await sendMagicLink({ email: trimmed });
        if (!res.ok) throw new Error(res.error);
        setStep("sent");
        setLoading(false);
        return;
      }
    } catch (e) {
      // Non-fatal — fall through to course selection so user isn't blocked.
      console.warn("access check / magic link failed", e);
    }

    // 2. No access → resolve campus, then show course list.
    //    A campus is only "known" (and may show local branding/courses)
    //    once an admin has flipped its `status` to 'approved'. Until then,
    //    we show the generic 4-course list with no campus name.
    let resolvedSlug = "ole-miss";
    let resolvedName = "";
    let known = false;
    try {
      const { data, error } = await supabase.functions.invoke("resolve-campus", {
        body: { email: trimmed, course_slug: courseSlug ?? null },
      });
      if (!error) {
        const slug = (data?.campus_slug as string) || "";
        const name = (data?.campus_name as string) || "";
        if (slug && slug !== "general") {
          // Verify approval status before exposing campus-specific UI.
          const { data: campusStatusRow } = await supabase
            .from("campuses")
            .select("status")
            .eq("slug", slug)
            .maybeSingle();
          if (campusStatusRow?.status === "approved") {
            resolvedSlug = slug;
            resolvedName = name;
            known = true;
          }
        }
      }
    } catch {
      /* ignore — fallback path */
    }

    setCampusSlug(resolvedSlug);
    setCampusName(resolvedName);
    setCampusKnown(known);
    await loadCourses(resolvedSlug, known);
    setStep("courses");
    setLoading(false);
  };

  const subheader = useMemo(() => {
    if (campusKnown && campusName) return `${campusName} courses`;
    return "Choose the course you're studying";
  }, [campusKnown, campusName]);

  /** Friendly display names for known global course slugs (no abbreviations). */
  const FRIENDLY_NAMES: Record<string, { name: string; helper: string }> = {
    "intro-accounting-1": { name: "Intro to Financial Accounting", helper: "First semester · the accounting equation, journal entries, financial statements" },
    "intro-1": { name: "Intro to Financial Accounting", helper: "First semester · the accounting equation, journal entries, financial statements" },
    "accy-201": { name: "Intro to Financial Accounting", helper: "First semester · the accounting equation, journal entries, financial statements" },
    "intro-accounting-2": { name: "Intro to Managerial Accounting", helper: "Second semester · costs, budgeting, decision-making for managers" },
    "intro-2": { name: "Intro to Managerial Accounting", helper: "Second semester · costs, budgeting, decision-making for managers" },
    "accy-202": { name: "Intro to Managerial Accounting", helper: "Second semester · costs, budgeting, decision-making for managers" },
    "intermediate-accounting-1": { name: "Intermediate Accounting I", helper: "Deep dive · cash, receivables, inventory, PP&E" },
    "ia1": { name: "Intermediate Accounting I", helper: "Deep dive · cash, receivables, inventory, PP&E" },
    "accy-303": { name: "Intermediate Accounting I", helper: "Deep dive · cash, receivables, inventory, PP&E" },
    "intermediate-accounting-2": { name: "Intermediate Accounting II", helper: "Advanced · bonds, leases, pensions, EPS" },
    "ia2": { name: "Intermediate Accounting II", helper: "Advanced · bonds, leases, pensions, EPS" },
    "accy-304": { name: "Intermediate Accounting II", helper: "Advanced · bonds, leases, pensions, EPS" },
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[440px] p-0 gap-0 border-0 overflow-hidden [&>button]:hidden"
        style={{ background: "white", borderRadius: 16 }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
        >
          <X className="w-4 h-4" style={{ color: "#6B7280" }} />
        </button>

        {step === "email" && (
          <form onSubmit={handleSubmit} className="px-6 sm:px-8 pt-7 pb-7">
            <h2
              className="text-[22px] sm:text-[24px] leading-tight text-center"
              style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
            >
              Enter your school email
            </h2>
            <p
              className="mt-2 text-center text-[13px] whitespace-pre-line"
              style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
            >
              Join the beta for free study tools.{"\n"}No credit card required.
            </p>

            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (err) setErr(null);
              }}
              placeholder="your@school.edu"
              disabled={loading}
              autoFocus
              maxLength={255}
              required
              className="mt-5 w-full rounded-lg border px-4 py-3 text-[14px] outline-none transition-colors focus:border-[#14213D]"
              style={{
                borderColor: err ? RED : "#E5E7EB",
                fontFamily: "Inter, sans-serif",
                color: NAVY,
              }}
            />
            {err && (
              <p className="mt-1.5 text-[12px]" style={{ color: RED, fontFamily: "Inter, sans-serif" }}>
                {err}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-5 w-full rounded-lg py-3 text-[14px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-80 disabled:cursor-wait flex items-center justify-center gap-2"
              style={{
                background: RED,
                fontFamily: "Inter, sans-serif",
                boxShadow: "0 4px 14px rgba(206,17,38,0.3)",
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Setting things up…
                </>
              ) : (
                "Continue →"
              )}
            </button>
          </form>
        )}

        {step === "sent" && (
          <div className="px-6 sm:px-8 pt-8 pb-8 text-center">
            <h2
              className="text-[22px] sm:text-[24px] leading-tight"
              style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
            >
              Check your email
            </h2>
            <p
              className="mt-3 text-[14px]"
              style={{ color: "#4A5568", fontFamily: "Inter, sans-serif" }}
            >
              Check your email for your secure access link.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-lg py-3 text-[14px] font-semibold text-white transition-all hover:brightness-110"
              style={{ background: NAVY, fontFamily: "Inter, sans-serif" }}
            >
              Done
            </button>
          </div>
        )}

        {step === "courses" && (
          <div className="px-6 sm:px-8 pt-7 pb-7">
            <h2
              className="text-[22px] sm:text-[24px] leading-tight text-center"
              style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
            >
              Select your course
            </h2>
            <p
              className="mt-2 text-center text-[13px]"
              style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
            >
              {subheader}
            </p>

            <div className="mt-5 flex flex-col gap-2">
              {coursesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: NAVY }} />
                </div>
              ) : courses.length === 0 ? (
                <p
                  className="text-center text-[13px] py-6"
                  style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
                >
                  No courses available right now.
                </p>
              ) : (
                courses.map((c) => {
                  const friendly = FRIENDLY_NAMES[c.slug];
                  // When campus isn't known, prefer the polished friendly name; otherwise prefer campus-local label.
                  const label = campusKnown
                    ? (c.local_name || c.course_name)
                    : (friendly?.name || c.course_name);
                  // Only show secondary line for known campuses (local course code).
                  const sub = campusKnown ? (c.local_code || c.code) : null;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => goToGetAccess(c.slug)}
                      className="w-full text-left rounded-lg border px-4 py-3 transition-colors hover:border-[#14213D] hover:bg-[#F8F9FA]"
                      style={{ borderColor: "#E5E7EB", fontFamily: "Inter, sans-serif" }}
                    >
                      <div className="text-[14px] font-semibold" style={{ color: NAVY }}>
                        {label}
                      </div>
                      {sub && (
                        <div className="text-[12px] mt-0.5" style={{ color: "#6B7280" }}>
                          {sub}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => setStep("email")}
              className="mt-4 w-full text-[12px]"
              style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
            >
              ← Use a different email
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
