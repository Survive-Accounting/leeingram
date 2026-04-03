import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + "_preview_salt_2026");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { email, asset_ids, asset_codes } = await req.json();

    // 1. Validate email — must be @olemiss.edu or test exception
    const trimmedEmail = (email || "").trim().toLowerCase();
    const allowedExceptions = ["lee@survivestudios.com", "jking.cim@gmail.com", "valinonorlynmae@gmail.com", "theacarmellesumagaysay@gmail.com"];
    if (
      !trimmedEmail.endsWith("@olemiss.edu") &&
      !allowedExceptions.includes(trimmedEmail)
    ) {
      return new Response(
        JSON.stringify({
          error: "invalid_email",
          message:
            "This tool is for Ole Miss students only. Please use your @olemiss.edu email address.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Validate asset_ids
    if (
      !Array.isArray(asset_ids) ||
      asset_ids.length !== 3 ||
      !Array.isArray(asset_codes) ||
      asset_codes.length !== 3
    ) {
      return new Response(
        JSON.stringify({ error: "invalid_input", message: "Exactly 3 problems are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Rate limit by IP
    const clientIP =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    const ipHash = await hashIP(clientIP);

    const { data: rateRow } = await supabase
      .from("preview_rate_limits")
      .select("*")
      .eq("ip_hash", ipHash)
      .maybeSingle();

    if (rateRow) {
      const firstAttempt = new Date(rateRow.first_attempt_at).getTime();
      const now = Date.now();
      const windowMs = 24 * 60 * 60 * 1000;

      if (now - firstAttempt > windowMs) {
        // Reset window
        await supabase
          .from("preview_rate_limits")
          .update({
            attempt_count: 1,
            first_attempt_at: new Date().toISOString(),
            last_attempt_at: new Date().toISOString(),
          })
          .eq("ip_hash", ipHash);
      } else if (rateRow.attempt_count >= 5) {
        return new Response(
          JSON.stringify({
            error: "rate_limited",
            message:
              "Too many attempts from this device. Please try again tomorrow or get full access with a Study Pass.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        await supabase
          .from("preview_rate_limits")
          .update({
            attempt_count: rateRow.attempt_count + 1,
            last_attempt_at: new Date().toISOString(),
          })
          .eq("ip_hash", ipHash);
      }
    } else {
      await supabase.from("preview_rate_limits").insert({ ip_hash: ipHash });
    }

    // 4. Check duplicate email
    const { data: existing } = await supabase
      .from("edu_preview_sessions")
      .select("id")
      .eq("email", trimmedEmail)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          error: "already_used",
          message: "This email has already been used for a free preview.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Create session
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const { data: session, error: insertErr } = await supabase
      .from("edu_preview_sessions")
      .insert({
        email: trimmedEmail,
        asset_ids,
        asset_codes,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") {
        return new Response(
          JSON.stringify({
            error: "already_used",
            message: "This email has already been used for a free preview.",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw insertErr;
    }

    return new Response(
      JSON.stringify({ session_id: session.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "server_error", message: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
