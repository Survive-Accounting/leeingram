import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { BookOpen, CheckCircle, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ── Course config ────────────────────────────────────────────────────
interface CourseConfig {
  name: string;
  code: string;
  campus: string;
  textbook: string;
  chapters: number;
  ctaUrl: string;
  color: string;
}

const COURSES: Record<string, CourseConfig> = {
  accy201: {
    name: "Financial Accounting",
    code: "ACCY 201",
    campus: "Ole Miss",
    textbook: "Financial and Managerial Accounting by Wild & Shaw",
    chapters: 12,
    ctaUrl: "https://learn.surviveaccounting.com",
    color: "#14213D",
  },
  accy202: {
    name: "Managerial Accounting",
    code: "ACCY 202",
    campus: "Ole Miss",
    textbook: "Financial and Managerial Accounting by Wild & Shaw",
    chapters: 10,
    ctaUrl: "https://learn.surviveaccounting.com",
    color: "#14213D",
  },
  accy303: {
    name: "Intermediate Accounting 1",
    code: "ACCY 303",
    campus: "Ole Miss",
    textbook: "Intermediate Accounting 18th Ed. — Kieso, Weygandt, Warfield",
    chapters: 11,
    ctaUrl: "https://learn.surviveaccounting.com",
    color: "#14213D",
  },
  accy304: {
    name: "Intermediate Accounting 2",
    code: "ACCY 304",
    campus: "Ole Miss",
    textbook: "Intermediate Accounting 18th Ed. — Kieso, Weygandt, Warfield",
    chapters: 10,
    ctaUrl: "https://learn.surviveaccounting.com",
    color: "#14213D",
  },
};

const HERO_IMG =
  "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/f10e00cd3462ea2638b6e6161236a92b.png";
const LOGO_URL =
  "https://cdn.fs.teachablecdn.com/C7m6OGDaRfOFOqXF0vLq";
const LEE_HEADSHOT =
  "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/f10e00cd3462ea2638b6e6161236a92b.png";

// ── UTM helpers ──────────────────────────────────────────────────────
function captureUtmParams() {
  const params = new URLSearchParams(window.location.search);
  const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  const utms: Record<string, string> = {};
  utmKeys.forEach((k) => {
    const v = params.get(k);
    if (v) utms[k] = v;
  });
  if (Object.keys(utms).length > 0) {
    sessionStorage.setItem("sa_utm", JSON.stringify(utms));
  }
}

function buildCtaUrl(base: string): string {
  const raw = sessionStorage.getItem("sa_utm");
  if (!raw) return base;
  try {
    const utms = JSON.parse(raw) as Record<string, string>;
    const url = new URL(base);
    Object.entries(utms).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
  } catch {
    return base;
  }
}

// ── SMS Widget (placeholder) ─────────────────────────────────────────
function SmsWidget() {
  const [phone, setPhone] = useState("");
  return (
    <div
      className="mx-auto mt-6 max-w-sm rounded-lg border border-white/20 px-5 py-4"
      style={{ background: "rgba(255,255,255,0.06)" }}
    >
      <p className="mb-3 text-center text-sm text-white/80">
        📱 Text yourself (or your mom) the $125 link →
      </p>
      <div className="flex gap-2">
        <Input
          type="tel"
          placeholder="Your phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="h-9 border-white/20 bg-white/10 text-sm text-white placeholder:text-white/40"
        />
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 border-white/30 text-white hover:bg-white/10"
          onClick={() => toast("Coming soon — check back soon!")}
        >
          Send Link
        </Button>
      </div>
      <p className="mt-2 text-center text-[10px] text-white/40">No spam. Just the link.</p>
    </div>
  );
}

// ── Coming Soon page ─────────────────────────────────────────────────
function ComingSoonPage({ campus }: { campus: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#14213D] px-6 text-center text-white">
      <Helmet>
        <title>Coming Soon — Survive Accounting</title>
      </Helmet>
      <h1 className="mb-4 font-['DM_Serif_Display',serif] text-4xl">Coming Soon</h1>
      <p className="max-w-md text-lg text-white/60">
        Survive Accounting isn't available at <span className="font-semibold text-white/80">{campus}</span> yet — but it's on the way.
      </p>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────
export default function CourseLanding() {
  const { campus, courseCode } = useParams<{ campus: string; courseCode: string }>();

  useEffect(() => {
    captureUtmParams();
  }, []);

  if (campus !== "ole-miss") {
    return <ComingSoonPage campus={campus || "this campus"} />;
  }

  const course = courseCode ? COURSES[courseCode.toLowerCase()] : null;
  if (!course) return <Navigate to="/landing" replace />;

  const ctaHref = buildCtaUrl(course.ctaUrl);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Helmet>
        <title>{course.code} Exam Prep — Survive Accounting | Ole Miss</title>
        <meta
          name="description"
          content={`2,500+ practice problems for ${course.name} at Ole Miss. Built by Lee Ingram, accounting tutor since 2015. Work through them and ace your exam.`}
        />
        <meta property="og:title" content={`${course.code} Exam Prep — Survive Accounting | Ole Miss`} />
        <meta
          property="og:description"
          content={`2,500+ practice problems for ${course.name} at Ole Miss. Built by Lee Ingram, accounting tutor since 2015. Work through them and ace your exam.`}
        />
        <meta property="og:image" content={LEE_HEADSHOT} />
        <link rel="canonical" href={`https://learn.surviveaccounting.com/ole-miss/${courseCode}`} />
      </Helmet>

      {/* ── 1. Nav bar ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-3" style={{ background: "#14213D" }}>
        <img src={LOGO_URL} alt="Survive Accounting" className="h-7" />
        <a href="/login" className="text-sm text-white/70 hover:text-white transition-colors">
          Sign in
        </a>
      </nav>

      {/* ── 2. Hero ────────────────────────────────────────────────── */}
      <section className="px-6 py-20 text-center" style={{ background: "#14213D" }}>
        <p
          className="mb-4 text-[11px] font-semibold uppercase"
          style={{ color: "#CE1126", letterSpacing: "0.1em" }}
        >
          OLE MISS · {course.code}
        </p>
        <h1
          className="mx-auto max-w-lg leading-[1.2] text-white"
          style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(32px, 5vw, 48px)" }}
        >
          Your exam is right now.
          <br />
          Let's survive it.
        </h1>
        <p className="mx-auto mt-4 max-w-[520px] text-lg text-white/70">
          2,500+ practice problems built for {course.name} at Ole Miss. Work through them and you
          don't just pass the exam — you start thinking like an accountant.
        </p>
        <img
          src={HERO_IMG}
          alt="Lee Ingram at Mt Cook"
          className="mx-auto mt-8 max-w-[480px] rounded-2xl"
          style={{ width: "100%" }}
        />
        <a
          href={ctaHref}
          className="mx-auto mt-8 block w-fit rounded-lg px-8 py-4 text-base font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "#CE1126" }}
        >
          Get Full Access — $125
        </a>
        <p className="mt-3 text-sm text-white/50">
          Covers all {course.chapters} chapters · Access through finals
        </p>
        <SmsWidget />
      </section>

      {/* ── 3. "This skill is forever" ─────────────────────────────── */}
      <section className="bg-white px-6 py-20 text-center">
        <blockquote
          className="mx-auto max-w-[600px] leading-[1.4]"
          style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(24px, 4vw, 32px)", color: "#14213D" }}
        >
          "Exams get easier when you understand what's actually happening."
        </blockquote>
        <div className="mx-auto mt-8 max-w-[560px] text-base leading-[1.8] text-gray-600">
          <p>
            Most students memorize journal entries and hope for the best. The ones who really get it
            learn to see through a transaction — what's moving, why it's moving, and what it means for
            the business.
          </p>
          <p className="mt-4">
            That's what these problems are built to teach. Work through enough of them and you'll start
            answering questions in class before the professor finishes asking. Do it. It helps.
          </p>
        </div>
      </section>

      {/* ── 4. What's included ─────────────────────────────────────── */}
      <section className="px-6 py-20" style={{ background: "#F8F8F8" }}>
        <p
          className="mb-10 text-center text-[11px] font-semibold uppercase"
          style={{ color: "#CE1126", letterSpacing: "0.1em" }}
        >
          WHAT YOU GET
        </p>
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
          {[
            {
              Icon: BookOpen,
              title: "2,500+ Practice Problems",
              body: "Every problem is original — different numbers than your textbook so you practice the concept, not memorize the answer.",
            },
            {
              Icon: CheckCircle,
              title: "Full Worked Solutions",
              body: "Step-by-step solutions with journal entries, key formulas, and explanations of exactly why each answer is right.",
            },
            {
              Icon: Zap,
              title: "Refresher Quizzes",
              body: "Quick 5-question quizzes on every major topic. Built to find your gaps before the exam does.",
            },
          ].map(({ Icon, title, body }) => (
            <div key={title} className="rounded-xl bg-white p-6 shadow-sm">
              <Icon size={28} className="mb-4" style={{ color: "#14213D" }} />
              <h3 className="mb-2 text-base font-semibold" style={{ color: "#14213D" }}>
                {title}
              </h3>
              <p className="text-sm leading-relaxed text-gray-500">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. Textbook ────────────────────────────────────────────── */}
      <section className="bg-white px-6 py-16 text-center">
        <p
          className="mb-3 text-[13px] font-semibold uppercase"
          style={{ color: "#CE1126", letterSpacing: "0.1em" }}
        >
          Built from your textbook
        </p>
        <p className="mx-auto max-w-lg text-xl font-semibold" style={{ color: "#14213D" }}>
          {course.textbook}
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-500">
          These problems are based on <em>{course.textbook}</em>. Same concepts, same structure,
          original numbers.
        </p>
      </section>

      {/* ── 6. About Lee ───────────────────────────────────────────── */}
      <section className="px-6 py-20 text-center" style={{ background: "#14213D" }}>
        <img
          src={LEE_HEADSHOT}
          alt="Lee Ingram"
          className="mx-auto mb-4 h-20 w-20 rounded-full object-cover"
        />
        <p className="text-lg font-medium text-white">Lee Ingram</p>
        <p className="text-sm text-white/60">Accounting tutor at Ole Miss since 2015</p>
        <div className="mx-auto mt-6 max-w-[500px] text-[15px] leading-[1.8] text-white/90">
          <p>Your exam is right now. Let's survive it.</p>
          <p className="mt-4">
            But here's what I've seen tutoring here since 2015 — the students who really learn this
            material don't just pass the exam. They start seeing the world differently.
          </p>
          <p className="mt-4">This skill is forever. I want to teach you it.</p>
        </div>
      </section>

      {/* ── 7. Final CTA ───────────────────────────────────────────── */}
      <section className="px-6 py-20 text-center" style={{ background: "#0D1A2D" }}>
        <h2
          className="text-white"
          style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(28px, 4vw, 36px)" }}
        >
          Ready to survive {course.code}?
        </h2>
        <p className="mt-2 text-sm text-white/60">
          $125 · All {course.chapters} chapters · Access through finals
        </p>
        <a
          href={ctaHref}
          className="mx-auto mt-8 block w-fit rounded-lg px-8 py-4 text-base font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "#CE1126" }}
        >
          Get Full Access — $125
        </a>
        <SmsWidget />
      </section>

      {/* ── 8. Footer ──────────────────────────────────────────────── */}
      <footer className="flex flex-wrap items-center justify-center gap-4 bg-[#14213D] px-6 py-6 text-xs text-white/40">
        <img src={LOGO_URL} alt="Survive Accounting" className="h-5 opacity-60" />
        <span>© 2026 Earned Wisdom LLC</span>
        <a href="https://learn.surviveaccounting.com" className="hover:text-white/60">
          learn.surviveaccounting.com
        </a>
      </footer>
    </div>
  );
}
