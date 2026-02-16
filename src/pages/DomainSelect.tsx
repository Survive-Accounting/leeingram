import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Music, Plus, Trash2, ExternalLink } from "lucide-react";

const DOMAINS = [
  {
    key: "writing",
    label: "Writing",
    tagline: "Finishing what we've started.",
    route: "/writing",
    comingSoon: false,
  },
  {
    key: "survive",
    label: "Survive Accounting",
    tagline: "Nationwide exam prep platform",
    route: "/",
    comingSoon: false,
  },
  {
    key: "leeingram",
    label: "Leeingram.co",
    tagline: "What's my next big project?",
    route: "/leeingram",
    comingSoon: false,
  },
  {
    key: "prof_ingram",
    label: "Prof Ingram",
    tagline: "Arts Entrepreneurship & Quickbooks",
    route: "/prof-ingram",
    comingSoon: true,
  },
  {
    key: "travel",
    label: "Travel",
    tagline: "Adventures & trip planning",
    route: "/travel",
    comingSoon: true,
  },
];

// Matrix rain character set
const MATRIX_CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF";

function MatrixRain() {
  const [columns, setColumns] = useState<{ x: number; chars: string[]; speed: number; opacity: number }[]>([]);

  useEffect(() => {
    const cols = Math.floor(window.innerWidth / 18);
    const generated = Array.from({ length: cols }, (_, i) => ({
      x: i * 18,
      chars: Array.from({ length: Math.floor(Math.random() * 25 + 8) }, () =>
        MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]
      ),
      speed: Math.random() * 15 + 8,
      opacity: Math.random() * 0.3 + 0.05,
    }));
    setColumns(generated);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {columns.map((col, i) => (
        <div
          key={i}
          className="absolute top-0 flex flex-col"
          style={{
            left: col.x,
            animation: `matrixFall ${col.speed}s linear infinite`,
            opacity: col.opacity,
          }}
        >
          {col.chars.map((char, j) => (
            <span
              key={j}
              className="text-xs leading-tight"
              style={{
                color: j === 0 ? "#ffffff" : `hsl(120, 100%, ${60 - j * 2}%)`,
                textShadow: j === 0 ? "0 0 8px #fff" : `0 0 5px hsl(120, 100%, 50%)`,
                fontFamily: "'Courier New', monospace",
              }}
            >
              {char}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function DomainSelect() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [hovered, setHovered] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  const [showDomains, setShowDomains] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [showMusic, setShowMusic] = useState(false);
  const [newLink, setNewLink] = useState({ title: "", url: "" });
  const fullText = "Welcome, Lee.";

  const { data: musicLinks } = useQuery({
    queryKey: ["music-links"],
    queryFn: async () => {
      const { data } = await supabase.from("music_links").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const addLink = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("music_links").insert({ user_id: user!.id, title: newLink.title, youtube_url: newLink.url });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["music-links"] }); setNewLink({ title: "", url: "" }); },
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("music_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["music-links"] }),
  });

  // Typewriter effect
  useEffect(() => {
    if (typedText.length < fullText.length) {
      const timeout = setTimeout(() => {
        setTypedText(fullText.slice(0, typedText.length + 1));
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [typedText]);

  const handleEnter = () => {
    setEntered(true);
    setTimeout(() => setShowDomains(true), 500);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: "#000000",
        fontFamily: "'Courier New', Courier, monospace",
      }}
    >
      <MatrixRain />

      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.015) 2px, rgba(0,255,0,0.015) 4px)",
        }}
      />

      {/* Sign out */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          style={{ color: "hsl(120, 60%, 35%)" }}
          className="hover:bg-green-950/50"
        >
          <LogOut className="mr-1 h-3.5 w-3.5" /> Sign Out
        </Button>
      </div>

      {!entered ? (
        <div className="flex flex-col items-center gap-10 z-10">
          {/* Typewriter welcome */}
          <div className="text-center">
            <h1
              className="text-4xl md:text-6xl font-bold"
              style={{
                color: "#00ff41",
                textShadow: "0 0 20px rgba(0,255,65,0.5), 0 0 40px rgba(0,255,65,0.2)",
              }}
            >
              {typedText}
              <span className="animate-pulse">_</span>
            </h1>
          </div>

          {/* Enter button — only show after typing finishes */}
          {typedText.length >= fullText.length && (
            <button
              onClick={handleEnter}
              className="relative px-10 py-4 text-lg font-bold uppercase tracking-[0.2em] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer animate-fade-in"
              style={{
                background: "transparent",
                color: "#00ff41",
                border: "1px solid #00ff41",
                borderRadius: "2px",
                boxShadow: "0 0 15px rgba(0,255,65,0.2), inset 0 0 15px rgba(0,255,65,0.05)",
                textShadow: "0 0 10px rgba(0,255,65,0.5)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 0 30px rgba(0,255,65,0.4), inset 0 0 20px rgba(0,255,65,0.1)";
                e.currentTarget.style.background = "rgba(0,255,65,0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 0 15px rgba(0,255,65,0.2), inset 0 0 15px rgba(0,255,65,0.05)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              Enter Your Chosen Domain
            </button>
          )}
        </div>
      ) : (
        <div
          className="flex flex-col items-center gap-8 z-10 w-full max-w-xl px-4"
          style={{
            opacity: showDomains ? 1 : 0,
            transition: "opacity 0.6s ease-out",
          }}
        >
          {showDomains && (
            <>
              <h2
                className="text-sm uppercase tracking-[0.4em] font-bold"
                style={{
                  color: "hsl(120, 80%, 40%)",
                  textShadow: "0 0 10px rgba(0,255,65,0.3)",
                }}
              >
                Select Domain
              </h2>

              {/* Focus Sprint Entry */}
              <button
                onClick={() => navigate("/focus")}
                className="w-full text-left p-5 mb-3 transition-all duration-300 cursor-pointer animate-pulse-subtle"
                style={{
                  background: "linear-gradient(135deg, rgba(255,170,0,0.08) 0%, rgba(255,120,0,0.04) 100%)",
                  border: "1px solid rgba(255,170,0,0.35)",
                  borderRadius: "2px",
                  boxShadow: "0 0 20px rgba(255,170,0,0.12), inset 0 0 30px rgba(255,170,0,0.03)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 0 35px rgba(255,170,0,0.25), inset 0 0 30px rgba(255,170,0,0.06)";
                  e.currentTarget.style.borderColor = "rgba(255,170,0,0.6)";
                  e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,170,0,0.14) 0%, rgba(255,120,0,0.08) 100%)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 0 20px rgba(255,170,0,0.12), inset 0 0 30px rgba(255,170,0,0.03)";
                  e.currentTarget.style.borderColor = "rgba(255,170,0,0.35)";
                  e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,170,0,0.08) 0%, rgba(255,120,0,0.04) 100%)";
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold tracking-wide" style={{ color: "rgba(255,170,0,0.9)", textShadow: "0 0 12px rgba(255,170,0,0.4)" }}>
                      ⚡ Focus Sprint
                    </h3>
                    <p className="text-xs mt-1 tracking-wider" style={{ color: "rgba(255,170,0,0.4)" }}>
                      Start a timed work session across any domain
                    </p>
                  </div>
                  <span className="text-xl" style={{ color: "rgba(255,170,0,0.6)", textShadow: "0 0 8px rgba(255,170,0,0.3)" }}>→</span>
                </div>
              </button>

              <div className="grid gap-3 w-full">
                {DOMAINS.map((domain) => (
                  <button
                    key={domain.key}
                    onClick={() => !domain.comingSoon && navigate(domain.route)}
                    onMouseEnter={() => setHovered(domain.key)}
                    onMouseLeave={() => setHovered(null)}
                    className={`relative w-full text-left p-5 transition-all duration-300 ${domain.comingSoon ? "cursor-default" : "cursor-pointer"}`}
                    style={{
                      background: hovered === domain.key && !domain.comingSoon ? "rgba(0,255,65,0.06)" : "rgba(0,255,65,0.015)",
                      border: `1px solid ${hovered === domain.key && !domain.comingSoon ? "rgba(0,255,65,0.6)" : "rgba(0,255,65,0.15)"}`,
                      borderRadius: "2px",
                      boxShadow: hovered === domain.key && !domain.comingSoon
                        ? "0 0 25px rgba(0,255,65,0.15), inset 0 0 15px rgba(0,255,65,0.05)"
                        : "none",
                      opacity: domain.comingSoon ? 0.45 : 1,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3
                          className="text-base font-bold tracking-wide"
                          style={{
                            color: hovered === domain.key && !domain.comingSoon ? "#00ff41" : "rgba(0,255,65,0.7)",
                            textShadow: hovered === domain.key && !domain.comingSoon ? "0 0 8px rgba(0,255,65,0.5)" : "none",
                          }}
                        >
                          {domain.label}
                        </h3>
                        <p className="text-xs mt-1 tracking-wider" style={{ color: "rgba(0,255,65,0.35)" }}>
                          {domain.comingSoon ? "Coming soon" : domain.tagline}
                        </p>
                      </div>
                      {!domain.comingSoon && (
                        <span
                          className="text-xl transition-all duration-300"
                          style={{
                            transform: hovered === domain.key ? "translateX(4px)" : "none",
                            opacity: hovered === domain.key ? 1 : 0.2,
                            color: "#00ff41",
                          }}
                        >
                          →
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <p className="text-xs text-center" style={{ color: "rgba(0,255,65,0.15)" }}>
                system v2.026 // the factory™
              </p>

              {/* Music Library Toggle */}
              <div className="w-full mt-4">
                <button
                  onClick={() => setShowMusic(!showMusic)}
                  className="flex items-center gap-2 mx-auto text-xs uppercase tracking-widest transition-colors cursor-pointer"
                  style={{ color: showMusic ? "#00ff41" : "rgba(0,255,65,0.3)" }}
                >
                  <Music className="h-3.5 w-3.5" />
                  {showMusic ? "Hide Music Library" : "Choose Your Music"}
                </button>

                {showMusic && (
                  <div className="mt-4 space-y-3 animate-fade-in">
                    <div className="flex gap-2">
                      <Input
                        value={newLink.title}
                        onChange={(e) => setNewLink((p) => ({ ...p, title: e.target.value }))}
                        placeholder="Title"
                        className="flex-1 bg-transparent text-xs"
                        style={{ borderColor: "rgba(0,255,65,0.2)", color: "#00ff41" }}
                      />
                      <Input
                        value={newLink.url}
                        onChange={(e) => setNewLink((p) => ({ ...p, url: e.target.value }))}
                        placeholder="YouTube URL"
                        className="flex-1 bg-transparent text-xs"
                        style={{ borderColor: "rgba(0,255,65,0.2)", color: "#00ff41" }}
                      />
                      <button
                        onClick={() => newLink.url && addLink.mutate()}
                        className="px-3 transition-colors cursor-pointer"
                        style={{ border: "1px solid rgba(0,255,65,0.3)", color: "#00ff41", borderRadius: "2px" }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {musicLinks && musicLinks.map((link: any) => (
                      <div
                        key={link.id}
                        className="flex items-center gap-2 p-2 text-xs"
                        style={{ border: "1px solid rgba(0,255,65,0.1)", borderRadius: "2px" }}
                      >
                        <span className="flex-1 truncate" style={{ color: "rgba(0,255,65,0.6)" }}>
                          {link.title || "Untitled"}
                        </span>
                        <a
                          href={link.youtube_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#00ff41" }}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <button
                          onClick={() => deleteLink.mutate(link.id)}
                          className="cursor-pointer"
                          style={{ color: "rgba(255,0,0,0.5)" }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes matrixFall {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes pulseSlow {
          0%, 100% { box-shadow: 0 0 20px rgba(255,170,0,0.12), inset 0 0 30px rgba(255,170,0,0.03); }
          50% { box-shadow: 0 0 28px rgba(255,170,0,0.18), inset 0 0 30px rgba(255,170,0,0.05); }
        }
        .animate-pulse-subtle { animation: pulseSlow 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
