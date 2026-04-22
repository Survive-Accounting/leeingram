import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";

type ViralPass = {
  id: string;
  pass_code: string;
  asset_id: string;
  recipient_email: string | null;
  trial_type: "2hr" | "48hr";
  opened_at: string | null;
  trial_started_at: string | null;
  trial_expires_at: string | null;
  original_2hr_expires_at: string | null;
};

type Stage = "loading" | "invalid" | "ready" | "capture" | "expired_2hr" | "expired_48hr" | "starting";

export default function TrialPass() {
  const { passCode } = useParams<{ passCode: string }>();
  const navigate = useNavigate();
  const [pass, setPass] = useState<ViralPass | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [assetCode, setAssetCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!passCode) {
        setStage("invalid");
        return;
      }
      const code = passCode.toUpperCase();
      const { data, error: fetchErr } = await supabase
        .from("viral_passes")
        .select("id,pass_code,asset_id,recipient_email,trial_type,opened_at,trial_started_at,trial_expires_at,original_2hr_expires_at")
        .eq("pass_code", code)
        .maybeSingle();

      if (cancelled) return;
      if (fetchErr || !data) {
        setStage("invalid");
        return;
      }

      // Mark opened
      if (!data.opened_at) {
        await supabase.from("viral_passes").update({ opened_at: new Date().toISOString() }).eq("id", data.id);
      }

      // Get asset code
      const { data: asset } = await supabase
        .from("teaching_assets")
        .select("asset_name")
        .eq("id", data.asset_id)
        .maybeSingle();
      if (asset) setAssetCode(asset.asset_name);

      const p = data as ViralPass;
      setPass(p);

      const now = Date.now();
      const trialExp = p.trial_expires_at ? new Date(p.trial_expires_at).getTime() : null;

      if (!p.trial_started_at) {
        setStage("ready");
      } else if (trialExp && now < trialExp) {
        // Still active — go straight to the asset
        navigate(`/solutions/${p.asset_id}?trial=active&pass=${p.pass_code}`, { replace: true });
      } else if (p.trial_type === "2hr") {
        setStage("expired_2hr");
      } else {
        setStage("expired_48hr");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [passCode, navigate]);

  const startTrial = async () => {
    if (!pass) return;
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.endsWith(".edu")) {
      setError("Please use a .edu email address.");
      return;
    }
    setSubmitting(true);
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + 2 * 60 * 60 * 1000);
    const { error: updErr } = await supabase
      .from("viral_passes")
      .update({
        trial_started_at: startedAt.toISOString(),
        trial_expires_at: expiresAt.toISOString(),
        original_2hr_expires_at: expiresAt.toISOString(),
        recipient_email: pass.recipient_email ?? trimmed,
      })
      .eq("id", pass.id);
    setSubmitting(false);
    if (updErr) {
      setError("Could not start trial. Try again.");
      return;
    }
    navigate(`/solutions/${pass.asset_id}?trial=active&pass=${pass.pass_code}`);
  };

  const start48hr = async () => {
    if (!pass) return;
    setSubmitting(true);
    const now = new Date();
    const expires = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const { error: e } = await supabase
      .from("viral_passes")
      .update({
        trial_type: "48hr",
        trial_started_at: now.toISOString(),
        trial_expires_at: expires.toISOString(),
      })
      .eq("id", pass.id);
    setSubmitting(false);
    if (e) {
      setError("Could not start 48-hour trial.");
      return;
    }
    navigate(`/solutions/${pass.asset_id}?trial=active&pass=${pass.pass_code}`);
  };

  if (stage === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <Loader2 className="h-8 w-8 animate-spin text-[#CE1126]" />
      </div>
    );
  }

  if (stage === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] px-4">
        <Card className="max-w-md w-full p-8 text-center">
          <h1 className="font-serif text-2xl text-[#14213D] mb-2">Pass not found</h1>
          <p className="text-muted-foreground">This pass is invalid or expired.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F8F9FA] to-[#FFE9EC] px-4 py-12">
      <Card className="max-w-[480px] w-full p-8 text-center shadow-xl">
        <div className="text-5xl mb-3">🎉</div>

        {stage === "ready" && (
          <>
            <h1 className="font-serif text-[32px] leading-tight text-[#14213D] mb-2">You got a free pass! 🎉</h1>
            <p className="text-base text-muted-foreground mb-6">A friend shared this with you.</p>
            <div className="text-left bg-[#F8F9FA] rounded-lg p-5 mb-6 space-y-2">
              <div className="text-sm text-[#14213D]">✓ 2 hours of full access</div>
              <div className="text-sm text-[#14213D]">✓ See the video Lee recorded</div>
              <div className="text-sm text-[#14213D]">✓ Try all AI features</div>
              <div className="text-sm text-[#14213D]">✓ Access this problem fully{assetCode ? ` (${assetCode})` : ""}</div>
            </div>
            <Button
              size="lg"
              className="w-full bg-[#CE1126] hover:bg-[#a50e1f] text-white text-base h-12"
              onClick={() => setStage("capture")}
            >
              Start My 2-Hour Trial →
            </Button>
            <p className="text-xs text-muted-foreground mt-3">No credit card required. Just a .edu email to get started.</p>
          </>
        )}

        {stage === "capture" && (
          <>
            <h1 className="font-serif text-[28px] text-[#14213D] mb-2">Almost there</h1>
            <p className="text-sm text-muted-foreground mb-5">Enter your .edu email to begin.</p>
            <div className="text-left mb-3">
              <label className="text-sm font-medium text-[#14213D] block mb-1">Your .edu email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@university.edu"
                disabled={submitting}
              />
              {error && <div className="text-xs text-[#CE1126] mt-2">{error}</div>}
            </div>
            <Button
              size="lg"
              className="w-full bg-[#CE1126] hover:bg-[#a50e1f] text-white h-12"
              onClick={startTrial}
              disabled={submitting || !email}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Begin Trial →"}
            </Button>
          </>
        )}

        {stage === "expired_2hr" && (
          <>
            <h1 className="font-serif text-[26px] text-[#14213D] mb-2">Your 2-hour trial ended.</h1>
            <p className="text-sm text-muted-foreground mb-5">You tried it. Now you know it works. 🎯</p>
            <div className="bg-[#14213D] text-white rounded-lg p-5 mb-4 text-left">
              <div className="flex items-center gap-2 text-amber-300 mb-1">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wider">One-time offer</span>
              </div>
              <div className="font-serif text-xl mb-1">Try everything free for 48 hours.</div>
              <div className="text-xs text-white/70 mb-4">No catch. No credit card.</div>
              <Button
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white h-11"
                onClick={start48hr}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start 48-Hour Trial →"}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground mb-2">Or unlock full access now:</div>
            <Button className="w-full bg-[#CE1126] hover:bg-[#a50e1f] text-white h-11 mb-2" onClick={() => navigate("/")}>
              Full Access — $250 →
            </Button>
            <Button variant="outline" className="w-full h-11" onClick={() => navigate("/")}>
              This Chapter Only — $50 →
            </Button>
          </>
        )}

        {stage === "expired_48hr" && (
          <>
            <h1 className="font-serif text-[26px] text-[#14213D] mb-2">Your trial has ended.</h1>
            <p className="text-sm text-muted-foreground mb-5">Time to make it official.</p>
            <Button className="w-full bg-[#CE1126] hover:bg-[#a50e1f] text-white h-12 mb-2" onClick={() => navigate("/")}>
              Full Access — $250 →
            </Button>
            <Button variant="outline" className="w-full h-11" onClick={() => navigate("/")}>
              This Chapter Only — $50 →
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
