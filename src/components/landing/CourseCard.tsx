const NAVY = "#14213D";

interface CourseCardProps {
  name: string;
  subtext?: string;
  availability: string;
  cta: string;
  onClick: () => void;
}

export default function CourseCard({ name, subtext, availability, cta, onClick }: CourseCardProps) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl p-5 transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.98] flex flex-col h-full"
      style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <span className="text-[15px] font-semibold leading-snug" style={{ color: NAVY }}>{name}</span>
      {subtext && (
        <span className="text-[12px] block mt-0.5" style={{ color: "#9CA3AF" }}>{subtext}</span>
      )}
      <p className="text-[12px] font-medium mt-2 mb-4 flex-1" style={{ color: "#6B7280" }}>{availability}</p>
      <span
        className="inline-block rounded-lg px-4 py-2 text-[13px] font-semibold text-center w-full mt-auto"
        style={{ background: "transparent", border: `1px solid ${NAVY}33`, color: NAVY }}
      >
        {cta}
      </span>
    </button>
  );
}
