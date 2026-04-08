import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import aorakiBg from "@/assets/aoraki-bg.jpg";
import { NightSkyOverlay } from "@/components/NightSkyOverlay";

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [suspended, setSuspended] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuspended(false);
    try {
      if (!isSignUp) {
        // Check if account is suspended before attempting auth
        const { data: vaRow } = await supabase
          .from("va_accounts")
          .select("account_status")
          .eq("email", email.trim().toLowerCase())
          .maybeSingle();
        if (vaRow?.account_status === "suspended") {
          setSuspended(true);
          setLoading(false);
          return;
        }
      }
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${aorakiBg})` }} />
      <div className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
      <NightSkyOverlay />

      <div className="relative z-10 w-full max-w-sm">
        <div
          className="rounded-xl p-6 space-y-6"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(16px)" }}
        >
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">{isSignUp ? "Create Account" : "Sign In"}</h1>
            <p className="text-xs text-white/40 mt-1">Earned Wisdom, LLC</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-white/60">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:ring-1 focus:ring-white/30"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/60">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:ring-1 focus:ring-white/30"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-black transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "rgba(218,165,32,0.9)" }}
            >
              {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Sign In"}
            </button>
          </form>

          <p className="text-center text-xs text-white/40">
            {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-amber-400/80 hover:underline">
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
