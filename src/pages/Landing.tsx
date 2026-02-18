import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import aorakiBg from "@/assets/aoraki-bg.jpg";
import leeHeadshot from "@/assets/lee-headshot-styled.png";
import { NightSkyOverlay } from "@/components/NightSkyOverlay";
import { Copy, Share2, Check } from "lucide-react";

export default function Landing() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareUrl = "https://surviveaccounting.lovable.app";

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: "Solopreneur Journey", url: shareUrl });
    } else {
      handleCopy();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("newsletter_subscribers").insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
      });
      if (error) {
        if (error.code === "23505") {
          toast.info("You're already subscribed!");
        } else {
          throw error;
        }
      }
      setSubscribed(true);
      toast.success("Welcome aboard!");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${aorakiBg})` }} />
      <div className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
      <NightSkyOverlay />

      <div className="relative z-10 w-full max-w-md text-center">
        {subscribed ? (
            <div className="space-y-5 animate-fade-in">
              <h2 className="text-xl font-bold text-white">Thanks for following my journey as a Solopreneur.</h2>
              <p className="text-sm text-white/60">Keep an eye on your inbox — the first letter is coming soon.</p>
              <div className="flex gap-3 justify-center pt-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white/80 hover:text-white transition-colors"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy Link"}
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-black transition-all hover:opacity-90"
                  style={{ background: "rgba(218,165,32,0.9)" }}
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>
            </div>
        ) : (
          <>
            <h1
              className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-1"
              style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}
            >
              Solopreneur Journey
            </h1>
            <p className="text-sm text-white/50 mb-5">A monthly letter from Lee Ingram</p>

            <div className="mb-5 flex justify-center">
              <img
                src={leeHeadshot}
                alt="Lee Ingram"
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover object-top"
                style={{
                  filter: "blur(0.3px) saturate(1.05) drop-shadow(0 0 16px rgba(218,165,32,0.3))",
                  WebkitMaskImage: "radial-gradient(circle, black 40%, transparent 70%)",
                  maskImage: "radial-gradient(circle, black 40%, transparent 70%)",
                }}
              />
            </div>

            <div className="text-left space-y-4 mb-8 px-2">
              <p className="text-sm text-white/80 leading-relaxed">
                <strong className="text-white">For over a decade, I've been building a tutoring business</strong> — watching it fail, rebuilding it again, and slowly shaping it into something bigger.
              </p>
              <p className="text-sm text-white/80 leading-relaxed">
                Today, it supports a life built around travel, teaching, adventure, and creative freedom.
              </p>

              <div className="mt-2 pt-3 border-t border-white/10">
                <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Each month, I write about</p>
                <ul className="text-sm text-white/70 space-y-1.5 pl-1">
                  <li>• Designing a business around the life I actually want</li>
                  <li>• 10 years of up's &amp; down's while building solo</li>
                  <li>• A "success" story earned the hard way</li>
                </ul>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:ring-1 focus:ring-white/30"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
              />
              <input
                type="email"
                placeholder="Your Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:ring-1 focus:ring-white/30"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-black transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "rgba(218,165,32,0.9)" }}
              >
                {loading ? "Subscribing..." : "Subscribe"}
              </button>
            </form>

            <p className="text-[11px] text-white/30 mt-6 italic">Human-first writing. No AI slop.</p>
          </>
        )}
      </div>
    </div>
  );
}
