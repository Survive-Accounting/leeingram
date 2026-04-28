import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = "Lee at Survive Accounting <lee@mail.surviveaccounting.com>";
const BASE_URL = "https://learn.surviveaccounting.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, assetCode, path } = await req.json();
    if (!email || !path || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "invalid input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const link = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #14213D;">
        <h2 style="margin: 0 0 12px; font-weight: 500;">Pick up where you left off</h2>
        <p style="color: #5A6478; line-height: 1.5; font-size: 14px;">
          Open this on your laptop for the best cramming experience.
        </p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="display: inline-block; background: #14213D; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Open Solutions Viewer
          </a>
        </p>
        <p style="color: #94A3B8; font-size: 12px; margin-top: 32px;">
          ${assetCode ? `Problem: ${assetCode}` : ""}
        </p>
      </div>
    `;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: "Your Survive Accounting study link",
        html,
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error("Resend failed", r.status, txt);
      return new Response(JSON.stringify({ error: "send failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
