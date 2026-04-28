import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let email: string;
  let fingerprint: string | null = null;
  let userAgent: string | null = null;
  let next: string | null = null;
  let allowNew = false;
  try {
    const body = await req.json();
    email = (body.email || "").trim().toLowerCase();
    fingerprint = body.fingerprint ? String(body.fingerprint).trim() : null;
    userAgent = body.userAgent ? String(body.userAgent).slice(0, 500) : null;
    next = body.next ? String(body.next).slice(0, 500) : null;
    allowNew = !!body.allow_new;
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify email exists in students or student_purchases (unless caller opts out)
  const [{ data: student }, { data: purchase }] = await Promise.all([
    supabase.from("students").select("id, campus_id").eq("email", email).maybeSingle(),
    supabase.from("student_purchases").select("id").eq("email", email).limit(1).maybeSingle(),
  ]);

  if (!student && !purchase && !allowNew) {
    return new Response(
      JSON.stringify({ error: "No account found for this email" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Build the redirect URL — embed a nonce if we have a fingerprint to bind.
  let nonce: string | null = null;
  const callbackUrl = new URL(`${SITE_URL}/auth/callback`);
  if (fingerprint && fingerprint.length >= 4) {
    nonce = genNonce();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const { error: nErr } = await supabase.from("magic_link_nonces").insert({
      email,
      nonce,
      device_fingerprint: fingerprint,
      user_agent: userAgent,
      ip,
      expires_at: expiresAt,
    });
    if (nErr) {
      console.error("nonce insert failed", nErr);
      // Don't hard-fail — fall back to non-bound link
      nonce = null;
    } else {
      callbackUrl.searchParams.set("n", nonce);
    }
  }
  if (next) callbackUrl.searchParams.set("next", next);

  // Generate magic link
  const { data: otpData, error: otpErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });

  let magicLink = "";
  if (otpErr) {
    console.error("Failed to generate magic link:", otpErr);
    return new Response(
      JSON.stringify({ error: "Failed to generate login link" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  magicLink = otpData?.properties?.action_link || "";

  if (!magicLink) {
    return new Response(
      JSON.stringify({ error: "Could not generate login link" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Send via Resend
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F8F9FA;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F9FA;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background-color:#14213D;padding:28px 32px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-family:'DM Serif Display',Georgia,serif;font-size:22px;font-weight:400;">
            Your Login Link
          </h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#14213D;font-size:15px;line-height:1.6;">
            Here's your secure login link for Survive Accounting. Open it on the same device where you requested it.
          </p>
          <div style="text-align:center;">
            <a href="${magicLink}" style="display:inline-block;background-color:#CE1126;color:#ffffff;font-family:Inter,Arial,sans-serif;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;margin:24px 0;">
              Log In to Survive Accounting
            </a>
          </div>
          <p style="margin:16px 0 0;color:#888;font-size:12px;text-align:center;">
            This link expires in 15 minutes and only works on the device that requested it.
          </p>
          <p style="margin:8px 0 0;color:#888;font-size:12px;text-align:center;">
            Need a new one? Request it at:
            <a href="https://learn.surviveaccounting.com/login" style="color:#CE1126;">learn.surviveaccounting.com/login</a>
          </p>
          <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">
          <p style="margin:0;color:#666;font-size:13px;line-height:1.5;">
            Questions? Just reply to this email — I read every message.<br>
            — Lee
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Survive Accounting <lee@mail.surviveaccounting.com>",
        to: [email],
        subject: "Your login link (expires in 15 minutes)",
        html: emailHtml,
        reply_to: "lee@surviveaccounting.com",
      }),
    });

    const resendBody = await resendRes.text();
    console.log("Resend response:", resendRes.status, resendBody);

    if (!resendRes.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("Resend error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Log event (non-blocking)
  try {
    await supabase.from("student_events").insert({
      email,
      student_id: student?.id || null,
      campus_id: student?.campus_id || null,
      event_type: "magic_link_resent",
      event_data: { trigger: "resend_button", bound: !!nonce },
    });
  } catch (evErr) {
    console.error("Failed to log resend event:", evErr);
  }

  return new Response(
    JSON.stringify({ success: true, expires_in_minutes: 15 }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
