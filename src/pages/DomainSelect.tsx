import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const DOMAINS = [
  {
    key: "writing",
    label: "Writing [for Ben]",
    tagline: "No destination",
    color: "hsl(45, 90%, 50%)",
    glowColor: "hsl(45, 90%, 65%)",
    route: "/writing",
  },
  {
    key: "survive",
    label: "Survive Accounting",
    tagline: "Nationwide exam prep platform",
    color: "hsl(220, 70%, 55%)",
    glowColor: "hsl(220, 70%, 70%)",
    route: "/",
  },
  {
    key: "leeingram",
    label: "Leeingram.co",
    tagline: "What's my next big project?",
    color: "hsl(160, 60%, 45%)",
    glowColor: "hsl(160, 60%, 60%)",
    route: "/leeingram",
  },
];

export default function DomainSelect() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  const [showDomains, setShowDomains] = useState(false);
  const [stars, setStars] = useState<{ x: number; y: number; size: number; delay: number }[]>([]);

  useEffect(() => {
    const generated = Array.from({ length: 80 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2.5 + 0.5,
      delay: Math.random() * 3,
    }));
    setStars(generated);
  }, []);

  const handleEnter = () => {
    setEntered(true);
    setTimeout(() => setShowDomains(true), 600);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #0a0a1a 0%, #1a1a3e 40%, #0d0d2b 100%)",
        fontFamily: "'Courier New', Courier, monospace",
      }}
    >
      {/* Stars */}
      {stars.map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            background: "white",
            opacity: 0.6,
            animation: `twinkle ${2 + star.delay}s ease-in-out infinite`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}

      {/* Sign out */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="text-white/50 hover:text-white hover:bg-white/10"
        >
          <LogOut className="mr-1 h-3.5 w-3.5" /> Sign Out
        </Button>
      </div>

      {!entered ? (
        <div className="flex flex-col items-center gap-8 animate-fade-in z-10">
          {/* Retro logo */}
          <div
            className="text-center"
            style={{
              textShadow: "0 0 20px hsl(220, 70%, 55%), 0 0 40px hsl(220, 70%, 55%), 0 0 80px hsl(280, 60%, 50%)",
            }}
          >
            <h1
              className="text-5xl md:text-7xl font-bold tracking-tight"
              style={{ color: "hsl(0, 0%, 100%)" }}
            >
              THE FACTORY
            </h1>
            <p className="mt-2 text-lg tracking-[0.3em] uppercase" style={{ color: "hsl(220, 70%, 70%)" }}>
              Content Production Hub
            </p>
          </div>

          {/* Visitor counter */}
          <div
            className="border px-4 py-1.5 text-xs"
            style={{
              borderColor: "hsl(45, 80%, 50%)",
              color: "hsl(45, 80%, 60%)",
              background: "rgba(0,0,0,0.5)",
            }}
          >
            🔥 VISITOR #{Math.floor(Math.random() * 9000 + 1000)} 🔥 YOU ARE THE CHOSEN ONE
          </div>

          {/* Enter button */}
          <button
            onClick={handleEnter}
            className="relative px-12 py-4 text-xl font-bold uppercase tracking-widest transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, hsl(280, 60%, 50%), hsl(220, 70%, 55%))",
              color: "white",
              border: "2px solid hsl(280, 60%, 70%)",
              borderRadius: "4px",
              boxShadow: "0 0 30px hsl(280, 60%, 50% / 0.5), inset 0 0 20px hsl(280, 60%, 50% / 0.2)",
              textShadow: "0 0 10px white",
            }}
          >
            ⚡ ENTER YOUR DOMAIN ⚡
          </button>

          {/* Under construction */}
          <p
            className="text-xs animate-pulse"
            style={{ color: "hsl(0, 80%, 60%)" }}
          >
            🚧 UNDER CONSTRUCTION — BEST VIEWED AT 800x600 🚧
          </p>
        </div>
      ) : (
        <div
          className="flex flex-col items-center gap-10 z-10 w-full max-w-2xl px-4"
          style={{
            animation: showDomains ? "none" : "fadeIn 0.5s ease-out",
            opacity: showDomains ? 1 : 0,
            transition: "opacity 0.5s ease-out",
          }}
        >
          {showDomains && (
            <>
              <div className="text-center">
                <h2
                  className="text-2xl md:text-3xl font-bold uppercase tracking-wider"
                  style={{
                    color: "white",
                    textShadow: "0 0 15px hsl(220, 70%, 55%)",
                  }}
                >
                  Choose Your Domain
                </h2>
                <div
                  className="mt-2 h-px w-48 mx-auto"
                  style={{
                    background: "linear-gradient(90deg, transparent, hsl(220, 70%, 55%), transparent)",
                  }}
                />
              </div>

              <div className="grid gap-4 w-full">
                {DOMAINS.map((domain) => (
                  <button
                    key={domain.key}
                    onClick={() => navigate(domain.route)}
                    onMouseEnter={() => setHovered(domain.key)}
                    onMouseLeave={() => setHovered(null)}
                    className="relative w-full text-left p-6 transition-all duration-300 cursor-pointer"
                    style={{
                      background:
                        hovered === domain.key
                          ? `linear-gradient(135deg, ${domain.color}20, ${domain.glowColor}10)`
                          : "rgba(255,255,255,0.03)",
                      border: `1px solid ${hovered === domain.key ? domain.color : "rgba(255,255,255,0.1)"}`,
                      borderRadius: "6px",
                      boxShadow:
                        hovered === domain.key
                          ? `0 0 25px ${domain.color}40, inset 0 0 15px ${domain.color}10`
                          : "none",
                      transform: hovered === domain.key ? "translateX(4px)" : "none",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3
                          className="text-lg font-bold"
                          style={{
                            color: hovered === domain.key ? domain.glowColor : "white",
                            textShadow: hovered === domain.key ? `0 0 10px ${domain.color}` : "none",
                          }}
                        >
                          {domain.label}
                        </h3>
                        <p
                          className="text-sm mt-0.5"
                          style={{ color: "rgba(255,255,255,0.5)" }}
                        >
                          {domain.tagline}
                        </p>
                      </div>
                      <span
                        className="text-2xl transition-transform duration-300"
                        style={{
                          transform: hovered === domain.key ? "translateX(4px)" : "none",
                          opacity: hovered === domain.key ? 1 : 0.3,
                          color: domain.color,
                        }}
                      >
                        →
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <p
                className="text-xs text-center"
                style={{ color: "rgba(255,255,255,0.25)" }}
              >
                © 2026 The Factory™ — All Rights Reserved — Made with ☕ and 🎸
              </p>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 1s ease-out;
        }
      `}</style>
    </div>
  );
}
