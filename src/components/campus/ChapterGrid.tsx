import { useNavigate } from "react-router-dom";

interface Chapter {
  id: string;
  chapter_number: number;
  chapter_name: string;
}

interface ChapterGridProps {
  chapters: Chapter[];
  campusSlug?: string;
  courseSlug?: string;
}

export default function ChapterGrid({ chapters, campusSlug, courseSlug }: ChapterGridProps) {
  const navigate = useNavigate();

  return (
    <div className="mt-8 animate-in fade-in slide-in-from-top-2 duration-300">
      <h3 className="text-xl font-bold mb-4" style={{ color: "#14213D" }}>
        Choose a chapter to explore
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {chapters.map((ch) => (
          <div
            key={ch.id}
            onClick={() => {
              if (campusSlug && courseSlug) {
                navigate(`/campus/${campusSlug}/${courseSlug}/chapter-${ch.chapter_number}`);
              } else {
                navigate(`/survive-this-chapter/${ch.id}?preview=true`);
              }
            }}
            className="bg-white rounded-lg p-4 cursor-pointer transition-all hover:shadow-md"
            style={{ border: "1px solid #E5E7EB" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#14213D";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#E5E7EB";
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#9CA3AF" }}>
              Chapter {ch.chapter_number}
            </p>
            <p className="text-[14px] font-semibold" style={{ color: "#14213D" }}>
              {ch.chapter_name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
