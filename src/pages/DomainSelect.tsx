import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Music, Plus, Trash2, ExternalLink } from "lucide-react";
import aorakiBg from "@/assets/aoraki-bg.jpg";
import { NightSkyOverlay } from "@/components/NightSkyOverlay";

const DOMAINS = [
  {
    key: "travel",
    label: "Travel",
    tagline: "Adventures & trip planning",
    route: "/travel",
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
    key: "prof_ingram",
    label: "Prof Ingram",
    tagline: "Arts Entrepreneurship & Quickbooks",
    route: "/prof-ingram",
    comingSoon: false,
  },
  {
    key: "writing",
    label: "Writing",
    tagline: "No destination",
    route: "/writing",
    comingSoon: false,
  },
  {
    key: "leeingram",
    label: "Leeingram.co",
    tagline: "What's my next big project?",
    route: "/leeingram",
    comingSoon: false,
  },
];

export default function DomainSelect() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [hovered, setHovered] = useState<string | null>(null);
  const [showMusic, setShowMusic] = useState(false);
  const [newLink, setNewLink] = useState({ title: "", url: "" });

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${aorakiBg})` }}
      />
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
      <NightSkyOverlay />

      {/* Sign out */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="text-white/60 hover:text-white hover:bg-white/10"
        >
          <LogOut className="mr-1 h-3.5 w-3.5" /> Sign Out
        </Button>
      </div>

      <div className="flex flex-col items-center gap-6 z-10 w-full max-w-xl px-4">
        {/* Focus Sprint Entry */}
        <button
          onClick={() => navigate("/focus")}
          className="w-full text-left p-5 mb-1 transition-all duration-300 cursor-pointer animate-pulse-subtle"
          style={{
            background: "linear-gradient(135deg, rgba(218,165,32,0.12) 0%, rgba(184,134,11,0.06) 100%)",
            border: "1px solid rgba(218,165,32,0.4)",
            borderRadius: "6px",
            boxShadow: "0 0 20px rgba(218,165,32,0.1), inset 0 0 30px rgba(218,165,32,0.03)",
            backdropFilter: "blur(12px)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 0 35px rgba(218,165,32,0.25), inset 0 0 30px rgba(218,165,32,0.06)";
            e.currentTarget.style.borderColor = "rgba(218,165,32,0.65)";
            e.currentTarget.style.background = "linear-gradient(135deg, rgba(218,165,32,0.2) 0%, rgba(184,134,11,0.1) 100%)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "0 0 20px rgba(218,165,32,0.1), inset 0 0 30px rgba(218,165,32,0.03)";
            e.currentTarget.style.borderColor = "rgba(218,165,32,0.4)";
            e.currentTarget.style.background = "linear-gradient(135deg, rgba(218,165,32,0.12) 0%, rgba(184,134,11,0.06) 100%)";
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold tracking-wide" style={{ color: "rgba(218,165,32,0.95)", textShadow: "0 0 12px rgba(218,165,32,0.4)" }}>
                ⚡ Focus Sprint
              </h3>
              <p className="text-xs mt-1 tracking-wider" style={{ color: "rgba(218,165,32,0.5)" }}>
                Start a timed work session across any domain
              </p>
            </div>
            <span className="text-xl" style={{ color: "rgba(218,165,32,0.6)", textShadow: "0 0 8px rgba(218,165,32,0.3)" }}>→</span>
          </div>
        </button>

        <div className="grid gap-2.5 w-full">
          {DOMAINS.map((domain) => (
            <button
              key={domain.key}
              onClick={() => !domain.comingSoon && navigate(domain.route)}
              onMouseEnter={() => setHovered(domain.key)}
              onMouseLeave={() => setHovered(null)}
              className={`relative w-full text-left p-4 transition-all duration-300 ${domain.comingSoon ? "cursor-default" : "cursor-pointer"}`}
              style={{
                background: hovered === domain.key && !domain.comingSoon
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(255,255,255,0.04)",
                border: `1px solid ${hovered === domain.key && !domain.comingSoon ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: "6px",
                boxShadow: hovered === domain.key && !domain.comingSoon
                  ? "0 4px 20px rgba(0,0,0,0.3)"
                  : "none",
                backdropFilter: "blur(12px)",
                opacity: domain.comingSoon ? 0.45 : 1,
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3
                    className="text-sm font-semibold tracking-wide"
                    style={{
                      color: hovered === domain.key && !domain.comingSoon ? "#ffffff" : "rgba(255,255,255,0.85)",
                    }}
                  >
                    {domain.label}
                  </h3>
                  <p className="text-xs mt-0.5 tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {domain.comingSoon ? "Coming soon" : domain.tagline}
                  </p>
                </div>
                {!domain.comingSoon && (
                  <span
                    className="text-lg transition-all duration-300"
                    style={{
                      transform: hovered === domain.key ? "translateX(4px)" : "none",
                      opacity: hovered === domain.key ? 1 : 0.2,
                      color: "rgba(255,255,255,0.8)",
                    }}
                  >
                    →
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.15)" }}>
          system v2.026 // the factory™
        </p>

        {/* Music Library Toggle */}
        <div className="w-full mt-2">
          <button
            onClick={() => setShowMusic(!showMusic)}
            className="flex items-center gap-2 mx-auto text-xs uppercase tracking-widest transition-colors cursor-pointer"
            style={{ color: showMusic ? "rgba(218,165,32,0.8)" : "rgba(255,255,255,0.3)" }}
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
                  className="flex-1 bg-transparent text-xs border-white/20 text-white placeholder:text-white/30"
                />
                <Input
                  value={newLink.url}
                  onChange={(e) => setNewLink((p) => ({ ...p, url: e.target.value }))}
                  placeholder="YouTube URL"
                  className="flex-1 bg-transparent text-xs border-white/20 text-white placeholder:text-white/30"
                />
                <button
                  onClick={() => newLink.url && addLink.mutate()}
                  className="px-3 transition-colors cursor-pointer rounded border border-white/20 text-white/70 hover:text-white hover:border-white/40"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              {musicLinks && musicLinks.map((link: any) => (
                <div
                  key={link.id}
                  className="flex items-center gap-2 p-2 text-xs rounded border border-white/10"
                >
                  <span className="flex-1 truncate text-white/60">
                    {link.title || "Untitled"}
                  </span>
                  <a
                    href={link.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/70 hover:text-white"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    onClick={() => deleteLink.mutate(link.id)}
                    className="cursor-pointer text-red-400/50 hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulseSlow {
          0%, 100% { box-shadow: 0 0 20px rgba(218,165,32,0.1), inset 0 0 30px rgba(218,165,32,0.03); }
          50% { box-shadow: 0 0 28px rgba(218,165,32,0.18), inset 0 0 30px rgba(218,165,32,0.05); }
        }
        .animate-pulse-subtle { animation: pulseSlow 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
