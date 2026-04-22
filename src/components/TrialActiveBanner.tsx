import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shows a green banner with countdown when ?trial=active&pass=CODE is present.
 * Place near top of any page that should respect the trial.
 */
export function TrialActiveBanner() {
  const [params] = useSearchParams();
  const passCode = params.get("pass");
  const trialActive = params.get("trial") === "active";
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!trialActive || !passCode) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("viral_passes")
        .select("trial_expires_at")
        .eq("pass_code", passCode.toUpperCase())
        .maybeSingle();
      if (!cancelled && data?.trial_expires_at) {
        setExpiresAt(new Date(data.trial_expires_at));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [passCode, trialActive]);

  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000 * 30);
    return () => clearInterval(t);
  }, [expiresAt]);

  if (!trialActive || !expiresAt) return null;

  const remainingMs = Math.max(0, expiresAt.getTime() - now);
  const totalMin = Math.floor(remainingMs / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;

  return (
    <div className="w-full bg-emerald-500 text-white text-sm font-medium px-4 py-2 flex items-center justify-center gap-3">
      <span>🎉 Trial active — {hours}hr {mins}min remaining</span>
      <a href="/" className="underline hover:opacity-90">Upgrade to full access →</a>
    </div>
  );
}
