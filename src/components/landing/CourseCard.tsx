const NAVY = "#14213D";

interface CourseCardProps {
  name: string;
  subtext?: string;
  badge: string;
  badgeColor: string;
  subtitle: string;
  cta: string;
  isLive?: boolean;
  onClick: () => void;
}

export default function CourseCard({ name, subtext, badge, badgeColor, subtitle, cta, isLive, onClick }: CourseCardProps) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl p-5 transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col h-full"
      style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-[15px] font-semibold leading-snug" style={{ color: NAVY }}>{name}</span>
        <span
          className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap text-white shrink-0 mt-0.5"
          style={{ background: badgeColor }}
        >
          {badge}
        </span>
      </div>
      {subtext && (
        <span className="text-[12px] block mt-0.5 mb-2" style={{ color: "#9CA3AF" }}>{subtext}</span>
      )}
      <p className="text-[13px] mb-4 mt-1 flex-1" style={{ color: "#6B7280" }}>{subtitle}</p>
      <span
        className="inline-block rounded-lg px-4 py-2 text-[13px] font-semibold text-center w-full mt-auto"
        style={{ background: "transparent", border: `1px solid ${NAVY}33`, color: NAVY }}
      >
        {cta}
      </span>
    </button>
  );
}
