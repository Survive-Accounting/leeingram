// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { nonce, fingerprint } = await req.json().catch(() => ({}));
    if (!nonce || !fingerprint) {
      return new Response(JSON.stringify({ outcome: "invalid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error } = await admin
      .from("magic_link_nonces")
      .select("id, email, device_fingerprint, expires_at, consumed_at")
      .eq("nonce", nonce)
      .maybeSingle();

    if (error || !row) {
      return new Response(JSON.stringify({ outcome: "not_found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (row.consumed_at) {
      return new Response(JSON.stringify({ outcome: "consumed", email: row.email }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ outcome: "expired", email: row.email }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (row.device_fingerprint !== fingerprint) {
      return new Response(
        JSON.stringify({ outcome: "device_mismatch", email: row.email }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    await admin
      .from("magic_link_nonces")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);

    return new Response(JSON.stringify({ outcome: "ok", email: row.email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("verify-magic-link error", err);
    return new Response(JSON.stringify({ outcome: "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
