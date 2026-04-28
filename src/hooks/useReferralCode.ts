import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Generates an 8-char base32 referral code (Crockford alphabet, no I/L/O/U).
 */
function generateCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
  let code = "";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 8; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

/**
 * Returns the logged-in user's referral code, creating one on first call.
 * Returns null while loading or if the user is not signed in.
 */
export function useReferralCode(userId: string | null | undefined) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setCode(null);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      // Try to fetch existing code
      const { data: existing } = await supabase
        .from("referral_codes")
        .select("code")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (existing?.code) {
        setCode(existing.code);
        setLoading(false);
        return;
      }

      // Create one — retry a couple times in case of unique-collision
      for (let attempt = 0; attempt < 3; attempt++) {
        const newCode = generateCode();
        const { error } = await supabase
          .from("referral_codes")
          .insert({ user_id: userId, code: newCode });
        if (cancelled) return;
        if (!error) {
          setCode(newCode);
          break;
        }
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { code, loading };
}
