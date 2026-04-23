import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const NAVY = "#14213D";
const RED = "#CE1126";

interface Course {
  id: string;
  name: string;
  subtext?: string;
  availability: string;
  cta: string;
  status: "live" | "upcoming" | "future";
  slug: string;
}

interface StagingCoursesSectionProps {
  courses: Course[];
  onCardClick: (course: Course) => void;
  onExpansionClick?: () => void;
}

const DISPLAY_ORDER = [
  "intro-accounting-1",
  "intro-accounting-2",
  "intermediate-accounting-1",
  "intermediate-accounting-2",
];

const SUBTEXT_BY_SLUG: Record<string, string> = {
  "intro-accounting-1": "Financial Principles",
  "intro-accounting-2": "Managerial Principles",
};

const TEXTBOOK_BY_SLUG: Record<string, string> = {
  "intro-accounting-1": "Based on Principles of Accounting (McGraw Hill)",
  "intro-accounting-2": "Based on Principles of Accounting (McGraw Hill)",
  "intermediate-accounting-1": "Based on Intermediate Accounting, 18th Ed. (Wiley)",
  "intermediate-accounting-2": "Based on Intermediate Accounting, 18th Ed. (Wiley)",
};

interface Chapter {
  id: string;
  chapter_number: number;
  chapter_name: string;
  course_id: string;
}

export default function StagingCoursesSection({
  courses,
  onCardClick,
}: StagingCoursesSectionProps) {
  const ordered = DISPLAY_ORDER
    .map((slug) => courses.find((c) => c.slug === slug))
    .filter(Boolean) as Course[];

  const [selectedSlug, setSelectedSlug] = useState<string>(ordered[0]?.slug ?? "");
  const [open, setOpen] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  const selected = ordered.find((c) => c.slug === selectedSlug) ?? ordered[0];

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id")
        .eq("course_id", selected.id)
        .order("chapter_number", { ascending: true });
      if (!cancelled) setChapters((data ?? []) as Chapter[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  if (!selected) return null;

  return (
    <section className="px-4 sm:px-6 py-12 sm:py-16" style={{ background: "#F8F8FA" }}>
      <div className="mx-auto max-w-[720px]">
        <p
          className="text-center text-[13px] sm:text-[14px] font-semibold uppercase tracking-[0.15em] mb-6"
          style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
        >
          Which course are you studying?
        </p>

        {/* Dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="w-full rounded-2xl px-5 py-4 flex items-center justify-between text-left transition-all hover:shadow-md"
            style={{
              background: "#fff",
              borderLeft: `4px solid ${NAVY}`,
              boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
              fontFamily: "Inter, sans-serif",
            }}
          >
            <div className="flex flex-col">
              <span className="text-[18px] sm:text-[20px] font-bold leading-tight" style={{ color: NAVY }}>
                {selected.name}
              </span>
              {SUBTEXT_BY_SLUG[selected.slug] && (
                <span className="text-[13px] mt-0.5" style={{ color: "#6B7280" }}>
                  {SUBTEXT_BY_SLUG[selected.slug]}
                </span>
              )}
            </div>
            <ChevronDown
              className="w-5 h-5 flex-shrink-0 transition-transform"
              style={{ color: NAVY, transform: open ? "rotate(180deg)" : "none" }}
            />
          </button>

          {open && (
            <div
              className="absolute z-20 left-0 right-0 mt-2 rounded-2xl overflow-hidden"
              style={{
                background: "#fff",
                boxShadow: "0 12px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)",
              }}
            >
              {ordered.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => {
                    setSelectedSlug(c.slug);
                    setOpen(false);
                  }}
                  className="w-full px-5 py-3 text-left transition-colors hover:bg-slate-50"
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  <div className="text-[15px] font-semibold" style={{ color: NAVY }}>
                    {c.name}
                  </div>
                  {SUBTEXT_BY_SLUG[c.slug] && (
                    <div className="text-[12px]" style={{ color: "#6B7280" }}>
                      {SUBTEXT_BY_SLUG[c.slug]}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Textbook + Chapters */}
        <div
          className="mt-5 rounded-2xl p-5 sm:p-6"
          style={{
            background: "#fff",
            boxShadow: "0 4px 20px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {TEXTBOOK_BY_SLUG[selected.slug] && (
            <p
              className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-3"
              style={{ color: "#6B7280" }}
            >
              {TEXTBOOK_BY_SLUG[selected.slug]}
            </p>
          )}

          {chapters.length === 0 ? (
            <p className="text-[13px]" style={{ color: "#9CA3AF" }}>
              Loading chapters…
            </p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mb-5">
              {chapters.map((ch) => (
                <li
                  key={ch.id}
                  className="flex items-baseline gap-2 text-[14px]"
                  style={{ color: NAVY }}
                >
                  <span className="text-[12px] font-semibold w-6 flex-shrink-0" style={{ color: "#9CA3AF" }}>
                    {ch.chapter_number}
                  </span>
                  <span>{ch.chapter_name}</span>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={() => onCardClick(selected)}
            className="w-full rounded-xl px-5 py-3 text-[14px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.99]"
            style={{ background: RED, fontFamily: "Inter, sans-serif" }}
          >
            Preview Free →
          </button>
        </div>

        <p
          className="mt-8 text-center text-[14px]"
          style={{ color: "#4A5568", fontFamily: "Inter, sans-serif" }}
        >
          Started at Ole Miss. Built for accounting students anywhere.
        </p>
      </div>
    </section>
  );
}
