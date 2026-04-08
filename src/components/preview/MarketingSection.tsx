export default function MarketingSection() {
  return (
    <div>
      <div
        className="rounded-xl"
        style={{
          background: "rgba(255,255,255,0.04)",
          borderTop: "3px solid #F59E0B",
          border: "1px solid rgba(255,255,255,0.08)",
          borderTopWidth: 3,
          borderTopColor: "#F59E0B",
          borderRadius: 12,
          padding: 32,
        }}
      >
        <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold mb-4" style={{ background: "#F59E0B", color: "#14213D" }}>
          🚧 Coming Soon
        </span>
        <h3 className="text-[22px] font-bold text-white mb-4" style={{ fontFamily: "Inter" }}>
          Marketing Tools & Strategy
        </h3>
        <div className="text-[15px] leading-[1.7]" style={{ color: "rgba(255,255,255,0.8)", fontFamily: "Inter" }}>
          <p className="mb-4">
            Lee and King will strategize about which marketing tools to use soon.
          </p>
          <p className="mb-4">
            First, let's finish setting up the infrastructure so we can handle adding more campuses, more students, more Greek orgs, and the virality we're working towards.
          </p>
          <p className="mb-4">
            Once the foundation is solid, building the marketing layer becomes a lot more fun — and a lot more effective.
          </p>
          <p>
            I look forward to building this marketing team alongside King!
          </p>
        </div>
        <p className="text-[14px] italic mt-4" style={{ color: "rgba(255,255,255,0.4)" }}>— Lee</p>
      </div>

      <div className="mt-4 space-y-2">
        {[
          { emoji: "📣", label: "Social Media & Content Strategy" },
          { emoji: "📧", label: "Email Marketing & Nurture Sequences" },
          { emoji: "🔗", label: "Referral & Viral Growth Tools" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-[12px] italic" style={{ color: "rgba(255,255,255,0.3)" }}>
            <span>{item.emoji}</span>
            <span>{item.label}</span>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold not-italic ml-1" style={{ background: "#F59E0B", color: "#14213D" }}>
              🚧 Coming Soon
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
