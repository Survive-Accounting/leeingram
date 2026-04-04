import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, assetCode, firstName, isTest, questionId } = await req.json();

    if (!to || !subject || !assetCode) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const greeting = firstName && firstName !== "there" ? firstName : "there";
    const actualTo = isTest ? "lee@surviveaccounting.com" : to;
    const actualSubject = isTest ? `[TEST] ${subject}` : subject;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #222; line-height: 1.6; max-width: 520px; margin: 0 auto; padding: 20px;">
  <p>Hey ${greeting},</p>
  <p>Thanks for flagging that — I appreciate it. I've improved that problem and it should make more sense now.</p>
  <p>You can view the updated version here:<br>
    <a href="https://learn.surviveaccounting.com/solutions/${assetCode}" style="color: #14213D; font-weight: bold;">
      learn.surviveaccounting.com/solutions/${assetCode}
    </a>
  </p>
  <p>— Lee</p>
</body>
</html>`.trim();

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Lee <lee@mail.surviveaccounting.com>",
        reply_to: "lee@surviveaccounting.com",
        to: [actualTo],
        subject: actualSubject,
        html,
      }),
    });

    const emailData = await emailRes.json();
    if (!emailRes.ok) {
      return new Response(JSON.stringify({ error: "Resend error", detail: emailData }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If not a test, mark the chapter_question as responded
    if (!isTest && questionId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceKey);
      await sb.from("chapter_questions").update({
        responded: true,
        responded_at: new Date().toISOString(),
        status: "resolved",
      }).eq("id", questionId);
    }

    return new Response(JSON.stringify({ success: true, emailId: emailData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
