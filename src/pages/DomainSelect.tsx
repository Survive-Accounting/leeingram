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

const WORK_DOMAINS = [
  { key: "survive", label: "Survive Accounting", tagline: "Nationwide exam prep platform", route: "/" },
  { key: "prof_ingram", label: "Prof Ingram", tagline: "Arts Entrepreneurship & Quickbooks", route: "/prof-ingram" },
  { key: "leeingram", label: "Leeingram.co", tagline: "What's my next big project?", route: "/leeingram" },
];

const PLAY_DOMAINS = [
  { key: "travel", label: "Travel", tagline: "Adventures & trip planning", route: "/travel" },
  { key: "writing", label: "Writing", tagline: "No destination", route: "/writing" },
];

const FAMILY_TABS = [
  { key: "me", label: "Me" },
  { key: "mckenzie", label: "McKenzie" },
  { key: "baby", label: "Baby" },
  { key: "us", label: "Us" },
];

const DomainLink = ({ domain, navigate }: { domain: typeof WORK_DOMAINS[0]; navigate: any }) => (
  <button
    onClick={() => navigate(domain.route)}
    className="w-full text-left px-4 py-2.5 transition-all duration-200 cursor-pointer rounded-md group"
    style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = "rgba(255,255,255,0.1)";
      e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = "rgba(255,255,255,0.04)";
      e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
    }}
  >
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-sm font-semibold tracking-wide text-white/85 group-hover:text-white transition-colors">
          {domain.label}
        </h3>
        <p className="text-xs mt-0.5 tracking-wider text-white/35">{domain.tagline}</p>
      </div>
      <span className="text-base text-white/20 group-hover:text-white/70 group-hover:translate-x-1 transition-all duration-200">→</span>
    </div>
  </button>
);

const FlickerButton = ({
  label,
  subtitle,
  expanded,
  onClick,
}: {
  label: string;
  subtitle: string;
  expanded: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="w-full text-left p-5 transition-all duration-300 cursor-pointer candle-flicker"
    style={{
      background: expanded
        ? "linear-gradient(135deg, rgba(218,165,32,0.18) 0%, rgba(184,134,11,0.08) 100%)"
        : "linear-gradient(135deg, rgba(218,165,32,0.10) 0%, rgba(184,134,11,0.04) 100%)",
      border: `1px solid rgba(218,165,32,${expanded ? "0.55" : "0.35"})`,
      borderRadius: "6px",
      backdropFilter: "blur(12px)",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = "rgba(218,165,32,0.65)";
      e.currentTarget.style.background = "linear-gradient(135deg, rgba(218,165,32,0.2) 0%, rgba(184,134,11,0.1) 100%)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = `rgba(218,165,32,${expanded ? "0.55" : "0.35"})`;
      e.currentTarget.style.background = expanded
        ? "linear-gradient(135deg, rgba(218,165,32,0.18) 0%, rgba(184,134,11,0.08) 100%)"
        : "linear-gradient(135deg, rgba(218,165,32,0.10) 0%, rgba(184,134,11,0.04) 100%)";
    }}
  >
    <div className="flex items-center justify-between">
      <div>
        <h3
          className="text-base font-bold tracking-[0.15em] uppercase"
          style={{
            color: "rgba(218,165,32,0.95)",
            textShadow: "0 0 12px rgba(218,165,32,0.4), 0 0 30px rgba(218,165,32,0.15)",
          }}
        >
          {label}
        </h3>
        <p className="text-xs mt-1 tracking-wider" style={{ color: "rgba(218,165,32,0.45)" }}>
          {subtitle}
        </p>
      </div>
      <span
        className="text-xl transition-transform duration-300"
        style={{
          color: "rgba(218,165,32,0.5)",
          textShadow: "0 0 8px rgba(218,165,32,0.3)",
          transform: expanded ? "rotate(90deg)" : "none",
        }}
      >
        →
      </span>
    </div>
  </button>
);

export default function DomainSelect() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [workOpen, setWorkOpen] = useState(false);
  const [playOpen, setPlayOpen] = useState(false);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [familyTab, setFamilyTab] = useState<string | null>(null);
  const [showMusic, setShowMusic] = useState(false);
  const [newLink, setNewLink] = useState({ title: "", url: "" });
  const promptCount = 0; // TODO: track actual prompt count

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
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${aorakiBg})` }} />
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
      <NightSkyOverlay />

      <div className="absolute top-4 right-4 z-10">
        <Button variant="ghost" size="sm" onClick={signOut} className="text-white/60 hover:text-white hover:bg-white/10">
          <LogOut className="mr-1 h-3.5 w-3.5" /> Sign Out
        </Button>
      </div>

      <div className="flex flex-col items-center gap-4 z-10 w-full max-w-xl px-4">
        {/* Focus Sprint */}
        <FlickerButton
          label="Focus Sprint"
          subtitle="Start a timed work session across any domain"
          expanded={false}
          onClick={() => navigate("/focus")}
        />

        {/* Work */}
        <div className="w-full space-y-2">
          <FlickerButton
            label="Work"
            subtitle="Work less"
            expanded={workOpen}
            onClick={() => setWorkOpen(!workOpen)}
          />
          {workOpen && (
            <div className="space-y-1.5 pl-2 pr-1 animate-fade-in">
              {WORK_DOMAINS.map((d) => (
                <DomainLink key={d.key} domain={d} navigate={navigate} />
              ))}
            </div>
          )}
        </div>

        {/* Play */}
        <div className="w-full space-y-2">
          <FlickerButton
            label="Play"
            subtitle="Play more"
            expanded={playOpen}
            onClick={() => setPlayOpen(!playOpen)}
          />
          {playOpen && (
            <div className="space-y-1.5 pl-2 pr-1 animate-fade-in">
              {PLAY_DOMAINS.map((d) => (
                <DomainLink key={d.key} domain={d} navigate={navigate} />
              ))}
            </div>
          )}
        </div>

        {/* Ideas */}
        <FlickerButton
          label="Ideas"
          subtitle="Idea Factory → Roadmap"
          expanded={false}
          onClick={() => navigate("/ideas")}
        />

        {/* Family */}
        <div className="w-full space-y-2">
          <FlickerButton
            label="Family"
            subtitle="Coming soon"
            expanded={familyOpen}
            onClick={() => setFamilyOpen(!familyOpen)}
          />
          {familyOpen && (
            <div className="space-y-1.5 pl-2 pr-1 animate-fade-in">
              {FAMILY_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFamilyTab(tab.key)}
                  className="w-full text-left px-4 py-2.5 transition-all duration-200 cursor-pointer rounded-md group"
                  style={{
                    background: familyTab === tab.key ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${familyTab === tab.key ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = familyTab === tab.key ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)";
                    e.currentTarget.style.borderColor = familyTab === tab.key ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)";
                  }}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold tracking-wide text-white/85 group-hover:text-white transition-colors">
                      {tab.label}
                    </h3>
                    <span className="text-[10px] uppercase tracking-widest text-white/30">Coming Soon</span>
                  </div>
                </button>
              ))}
              {familyTab === "us" && (
                <div className="p-3 rounded-md text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-xs text-white/40 italic">💰 Money Meetings Dashboard — coming soon</p>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.15)" }}>
          Lovable Prompts = {promptCount} // Earned Wisdom, LLC
        </p>

        {/* Music Library */}
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
                <Input value={newLink.title} onChange={(e) => setNewLink((p) => ({ ...p, title: e.target.value }))} placeholder="Title" className="flex-1 bg-transparent text-xs border-white/20 text-white placeholder:text-white/30" />
                <Input value={newLink.url} onChange={(e) => setNewLink((p) => ({ ...p, url: e.target.value }))} placeholder="YouTube URL" className="flex-1 bg-transparent text-xs border-white/20 text-white placeholder:text-white/30" />
                <button onClick={() => newLink.url && addLink.mutate()} className="px-3 transition-colors cursor-pointer rounded border border-white/20 text-white/70 hover:text-white hover:border-white/40">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              {musicLinks && musicLinks.map((link: any) => (
                <div key={link.id} className="flex items-center gap-2 p-2 text-xs rounded border border-white/10">
                  <span className="flex-1 truncate text-white/60">{link.title || "Untitled"}</span>
                  <a href={link.youtube_url} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white"><ExternalLink className="h-3 w-3" /></a>
                  <button onClick={() => deleteLink.mutate(link.id)} className="cursor-pointer text-red-400/50 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes candleFlicker {
          0%, 100% {
            box-shadow: 0 0 15px rgba(218,165,32,0.08), inset 0 0 20px rgba(218,165,32,0.02);
          }
          10% {
            box-shadow: 0 0 22px rgba(218,165,32,0.18), inset 0 0 25px rgba(218,165,32,0.04);
          }
          20% {
            box-shadow: 0 0 12px rgba(218,165,32,0.06), inset 0 0 18px rgba(218,165,32,0.01);
          }
          35% {
            box-shadow: 0 0 28px rgba(218,165,32,0.22), inset 0 0 30px rgba(218,165,32,0.05);
          }
          45% {
            box-shadow: 0 0 14px rgba(218,165,32,0.09), inset 0 0 20px rgba(218,165,32,0.02);
          }
          60% {
            box-shadow: 0 0 25px rgba(218,165,32,0.2), inset 0 0 28px rgba(218,165,32,0.04);
          }
          75% {
            box-shadow: 0 0 10px rgba(218,165,32,0.05), inset 0 0 15px rgba(218,165,32,0.01);
          }
          85% {
            box-shadow: 0 0 20px rgba(218,165,32,0.15), inset 0 0 22px rgba(218,165,32,0.03);
          }
        }
        .candle-flicker {
          animation: candleFlicker 2.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
