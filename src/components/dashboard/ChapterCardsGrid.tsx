import { useNavigate } from "react-router-dom";

const NAVY = "#14213D";

interface Chapter {
  id: string;
  chapter_number: number;
  chapter_name: string;
}

export default function ChapterCardsGrid({
  chapters,
  courseName,
}: {
  chapters: Chapter[];
  courseName: string;
}) {
  const navigate = useNavigate();

  if (chapters.length === 0) return null;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2
          className="text-[20px] sm:text-[22px] leading-tight"
          style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
        >
          {courseName} — Chapter Library
        </h2>
        <span
          className="text-[11.5px]"
          style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
        >
          {chapters.length} chapters
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {chapters.map((ch) => (
          <button
            key={ch.id}
            onClick={() => navigate(`/cram/${ch.id}`)}
            className="text-left rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group"
            style={{
              background: "#fff",
              border: "1px solid #E0E7F0",
              boxShadow: "0 4px 12px rgba(20,33,61,0.04)",
              fontFamily: "Inter, sans-serif",
            }}
          >
            <div
              className="text-[20px] font-bold leading-none mb-1.5"
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
  );
}
