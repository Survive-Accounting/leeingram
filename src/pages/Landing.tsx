import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import aorakiBg from "@/assets/aoraki-bg.jpg";
import { NightSkyOverlay } from "@/components/NightSkyOverlay";

export default function Landing() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

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
          <div className="space-y-4 animate-fade-in">
            <p className="text-3xl">🎉</p>
            <h2 className="text-xl font-bold text-white">You're in.</h2>
            <p className="text-sm text-white/60">Keep an eye on your inbox — the first letter is on its way.</p>
          </div>
        ) : (
          <>
            <h1
              className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-1"
              style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}
            >
              Solopreneur Journey
            </h1>
            <p className="text-sm text-white/50 mb-8">A monthly letter from Lee Ingram</p>

            <div className="text-left space-y-4 mb-8 px-2">
              <p className="text-sm text-white/80 leading-relaxed">
                For over a decade, I've been building a tutoring business — watching it fail, rebuilding it again, and slowly shaping it into something bigger.
              </p>
              <p className="text-sm text-white/80 leading-relaxed">
                Today, it supports a life built around travel, teaching, adventure, and creative freedom.
              </p>
              <p className="text-sm text-white/70 leading-relaxed">Each month, I write about:</p>
              <ul className="text-sm text-white/70 space-y-1.5 pl-1">
                <li>• A "success" story earned the hard way</li>
                <li>• The ups and downs of building solo</li>
                <li>• Designing a business around the life I actually want</li>
              </ul>
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
