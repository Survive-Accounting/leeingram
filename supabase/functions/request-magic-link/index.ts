// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE_URL = "https://learn.surviveaccounting.com";

function genNonce() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const fingerprint = String(body.fingerprint || "").trim();
    const userAgent = String(body.userAgent || req.headers.get("user-agent") || "").slice(0, 500);
    const next = body.next ? String(body.next).slice(0, 500) : null;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "invalid_email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!fingerprint || fingerprint.length < 4) {
      return new Response(JSON.stringify({ error: "invalid_fingerprint" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Generate a nonce row
    const nonce = genNonce();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: insertErr } = await admin.from("magic_link_nonces").insert({
      email,
      nonce,
      device_fingerprint: fingerprint,
      user_agent: userAgent,
      ip,
      expires_at: expiresAt,
    });
    if (insertErr) throw insertErr;

    // Build the redirect URL with the nonce + optional next
    const callbackUrl = new URL(`${SITE_URL}/auth/callback`);
    callbackUrl.searchParams.set("n", nonce);
    if (next) callbackUrl.searchParams.set("next", next);

    // Trigger Supabase's built-in magiclink email by calling signInWithOtp
    // through the auth REST API with our redirect.
    const authRes = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/auth/v1/otp`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
        },
        body: JSON.stringify({
          email,
          create_user: true,
          options: { email_redirect_to: callbackUrl.toString() },
          // Top-level redirect is what Supabase actually honors here:
          gotrue_meta_security: {},
          // Some clients put it at the top level too:
          email_redirect_to: callbackUrl.toString(),
        }),
      },
    );

    if (!authRes.ok) {
      const txt = await authRes.text();
      console.error("auth/v1/otp failed", authRes.status, txt);
      return new Response(JSON.stringify({ error: "send_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, expiresAt }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("request-magic-link error", err);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
