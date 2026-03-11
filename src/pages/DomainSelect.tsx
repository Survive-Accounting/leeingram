import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChangelogDialog, PROMPT_COUNT } from "@/components/ChangelogDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useVaAccount } from "@/hooks/useVaAccount";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import aorakiBg from "@/assets/aoraki-bg.jpg";


const WORK_DOMAINS = [
  { key: "survive", label: "Survive Accounting", route: "/dashboard" },
  { key: "prof_ingram", label: "Prof Ingram", route: "/prof-ingram" },
  { key: "leeingram", label: "Leeingram.co", route: "/leeingram" },
];
const PLAY_DOMAINS = [
  { key: "travel", label: "Travel", route: "/travel" },
  { key: "writing", label: "Writing", route: "/writing" },
];
const FAMILY_TABS = ["Me", "McKenzie", "Baby", "Us"];

const SubLink = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full text-left px-3 py-2 rounded-md transition-all duration-200 group"
    style={{
      background: "rgba(60,50,40,0.3)",
      border: "1px solid rgba(180,160,130,0.15)",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = "rgba(80,65,45,0.45)";
      e.currentTarget.style.borderColor = "rgba(218,165,32,0.4)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = "rgba(60,50,40,0.3)";
      e.currentTarget.style.borderColor = "rgba(180,160,130,0.15)";
    }}
  >
    <span className="text-xs font-semibold tracking-wide" style={{ color: "rgba(255,250,240,0.95)" }}>
      {label}
    </span>
  </button>
);

export default function DomainSelect() {
  const { signOut } = useAuth();
  const { isVa, isLoading: vaLoading } = useVaAccount();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [changelogOpen, setChangelogOpen] = useState(false);

  useEffect(() => {
    if (!vaLoading && isVa) {
      navigate("/va-dashboard", { replace: true });
    }
  }, [isVa, vaLoading, navigate]);

  const toggle = (key: string) => setExpanded(expanded === key ? null : key);

  const MountainBtn = ({
    label,
    onClick,
    className = "",
    style = {},
    flicker = false,
  }: {
    label: string;
    onClick: () => void;
    className?: string;
    style?: React.CSSProperties;
    flicker?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={`relative cursor-pointer transition-all duration-300 ${flicker ? "candle-flicker" : ""} ${className}`}
      style={{
        background: "rgba(60,50,40,0.35)",
        border: "1px solid rgba(180,160,130,0.25)",
        backdropFilter: "blur(8px)",
        borderRadius: "8px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(80,65,45,0.5)";
        e.currentTarget.style.borderColor = "rgba(218,165,32,0.5)";
        e.currentTarget.style.boxShadow = "0 6px 30px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.12), 0 0 20px rgba(218,165,32,0.1)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = style.background as string || "rgba(60,50,40,0.35)";
        e.currentTarget.style.borderColor = style.borderColor as string || "rgba(180,160,130,0.25)";
        e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.08)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <span
        className="font-bold tracking-[0.18em] uppercase text-sm"
        style={{
          color: "rgba(255,255,255,1)",
          textShadow: "0 2px 8px rgba(0,0,0,0.5), 0 0 20px rgba(218,165,32,0.15)",
        }}
      >
        {label}
      </span>
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${aorakiBg})` }} />
      {/* Clear sky — sunlight warmth from upper-right */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 75% 15%, rgba(255,220,140,0.18) 0%, transparent 50%), linear-gradient(to bottom, rgba(120,180,240,0.12) 0%, transparent 40%)" }} />
      {/* Gentle vignette */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(0,0,0,0.1) 100%)" }} />
      {/* Water shimmer */}
      <div className="absolute bottom-0 left-0 right-0 h-[18%]" style={{ background: "linear-gradient(to top, rgba(100,140,180,0.1) 0%, transparent 100%)", animation: "waterShimmer 4s ease-in-out infinite" }} />

      <div className="absolute top-4 right-4 z-10">
        <Button variant="ghost" size="sm" onClick={signOut} className="text-white/80 hover:text-white hover:bg-white/10">
          <LogOut className="mr-1 h-3.5 w-3.5" /> Sign Out
        </Button>
      </div>

      {/* Mountain-shaped button layout */}
      <div className="z-10 flex flex-col items-center gap-3 w-full max-w-md px-4">
        {/* Peak — Ideas */}
        <div className="flex justify-center">
          <MountainBtn label="Ideas" onClick={() => navigate("/ideas")} className="px-12 py-4" />
        </div>

        {/* Mid-range — Family / Play / Work */}
        <div className="flex justify-center gap-2.5 w-full">
          <MountainBtn
            label="Family"
            onClick={() => toggle("family")}
            className="flex-1 py-4"
            style={{ borderRadius: "8px 4px 8px 12px" }}
          />
          <MountainBtn
            label="Play"
            onClick={() => toggle("play")}
            className="flex-1 py-4"
          />
          <MountainBtn
            label="Work"
            onClick={() => toggle("work")}
            className="flex-1 py-4"
            style={{ borderRadius: "4px 8px 12px 8px" }}
          />
        </div>

        {/* Expand panel */}
        {expanded && (
          <div className="w-full space-y-1.5 animate-fade-in px-1">
            {expanded === "work" &&
              WORK_DOMAINS.map((d) => (
                <SubLink key={d.key} label={d.label} onClick={() => navigate(d.route)} />
              ))}
            {expanded === "play" &&
              PLAY_DOMAINS.map((d) => (
                <SubLink key={d.key} label={d.label} onClick={() => navigate(d.route)} />
              ))}
            {expanded === "family" &&
              FAMILY_TABS.map((t) => (
                <SubLink key={t} label={t} onClick={() => {}} />
              ))}
          </div>
        )}

        {/* Foundation — Focus Sprint */}
        <MountainBtn
          label="Focus Sprint"
          onClick={() => navigate("/focus")}
          className="w-full py-5"
          flicker
          style={{
            borderRadius: "4px 4px 16px 16px",
            background: "linear-gradient(135deg, rgba(100,75,40,0.4) 0%, rgba(60,50,40,0.35) 100%)",
            borderColor: "rgba(218,165,32,0.35)",
          }}
        />
      </div>

      {/* Footer */}
      <div className="z-10 mt-6">
        <button
          onClick={() => setChangelogOpen(true)}
          className="text-xs text-center cursor-pointer hover:underline"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          Lovable Prompts = {PROMPT_COUNT} // Earned Wisdom, LLC
        </button>
      </div>

      <ChangelogDialog open={changelogOpen} onOpenChange={setChangelogOpen} />

      <style>{`
        @keyframes candleFlicker {
          0%, 100% { box-shadow: 0 0 15px rgba(218,165,32,0.08), inset 0 0 20px rgba(218,165,32,0.02); }
          10% { box-shadow: 0 0 22px rgba(218,165,32,0.18), inset 0 0 25px rgba(218,165,32,0.04); }
          35% { box-shadow: 0 0 28px rgba(218,165,32,0.22), inset 0 0 30px rgba(218,165,32,0.05); }
          60% { box-shadow: 0 0 25px rgba(218,165,32,0.2), inset 0 0 28px rgba(218,165,32,0.04); }
          75% { box-shadow: 0 0 10px rgba(218,165,32,0.05), inset 0 0 15px rgba(218,165,32,0.01); }
        }
        .candle-flicker { animation: candleFlicker 2.5s ease-in-out infinite; }
        @keyframes waterShimmer {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
