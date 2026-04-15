import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let email: string;
  try {
    const body = await req.json();
    email = (body.email || "").trim().toLowerCase();
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

  // Verify email exists in students or student_purchases
  const [{ data: student }, { data: purchase }] = await Promise.all([
    supabase.from("students").select("id, campus_id").eq("email", email).maybeSingle(),
    supabase.from("student_purchases").select("id").eq("email", email).limit(1).maybeSingle(),
  ]);

  if (!student && !purchase) {
    return new Response(
      JSON.stringify({ error: "No account found for this email" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Generate magic link
  const { data: otpData, error: otpErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: "https://learn.surviveaccounting.com/auth/callback",
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
            Your New Login Link
          </h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#14213D;font-size:15px;line-height:1.6;">
            Here's a fresh login link for Survive Accounting.
          </p>
          <div style="text-align:center;">
            <a href="${magicLink}" style="display:inline-block;background-color:#CE1126;color:#ffffff;font-family:Inter,Arial,sans-serif;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;margin:24px 0;">
              Log In to Survive Accounting
            </a>
          </div>
          <p style="margin:16px 0 0;color:#888;font-size:12px;text-align:center;">
            This link expires in 15 minutes.
          </p>
          <p style="margin:8px 0 0;color:#888;font-size:12px;text-align:center;">
            If it's expired, request a new one at:
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
        subject: "Your new login link",
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
      event_data: { trigger: "resend_button" },
    });
  } catch (evErr) {
    console.error("Failed to log resend event:", evErr);
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
