import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generatePassCode(): string {
  // 8-char uppercase alphanumeric
  return (Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6))
    .toUpperCase()
    .padEnd(8, "X")
    .slice(0, 8);
}

function buildPassEmail(passCode: string, assetCode: string | null): string {
  const shareUrl = `https://learn.surviveaccounting.com/trial/${passCode}`;
  return `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F8F9FA;font-family:Inter,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#14213D;padding:28px;text-align:center;">
<h1 style="margin:0;color:#fff;font-family:'DM Serif Display',Georgia,serif;font-size:24px;">Lee answered your question! 🎉</h1>
</td></tr>
<tr><td style="padding:32px;color:#14213D;font-size:15px;line-height:1.6;">
<p>The question you upvoted just got a video answer from Lee.</p>
<div style="text-align:center;margin:24px 0;">
<a href="${shareUrl}" style="display:inline-block;background:#CE1126;color:#fff;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">Watch the video →</a>
</div>
<hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">
<p style="margin:0 0 12px;"><strong>We're also giving you a free pass to share with a friend:</strong></p>
<div style="background:#F8F9FA;border:1px dashed #CE1126;border-radius:8px;padding:16px;text-align:center;margin:16px 0;">
<div style="font-size:12px;color:#666;text-transform:uppercase;letter-spacing:1px;">Your pass code</div>
<div style="font-family:'DM Serif Display',Georgia,serif;font-size:28px;color:#CE1126;letter-spacing:2px;margin:6px 0;">${passCode}</div>
<div style="font-size:13px;color:#666;word-break:break-all;">${shareUrl}</div>
</div>
<p>Your friend gets <strong>2 hours of full access — free</strong>.</p>
<p>Share it in your group chat, GroupMe, or wherever your study group hangs out. 🚀</p>
<hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">
<p style="color:#666;font-size:13px;">— Lee</p>
</td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { video_request_id, asset_id } = await req.json();
    if (!video_request_id || !asset_id) {
      return new Response(JSON.stringify({ error: "Missing video_request_id or asset_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Fetch all upvoters with email
    const { data: upvoters, error: upErr } = await supabase
      .from("video_request_upvotes")
      .select("student_email")
      .eq("video_request_id", video_request_id)
      .not("student_email", "is", null);

    if (upErr) throw upErr;

    // Get asset code for share link context (best-effort)
    const { data: assetRow } = await supabase
      .from("teaching_assets")
      .select("asset_name")
      .eq("id", asset_id)
      .maybeSingle();
    const assetCode = assetRow?.asset_name ?? null;

    const recipients = Array.from(
      new Set((upvoters ?? []).map((u: any) => (u.student_email as string).trim().toLowerCase()).filter(Boolean)),
    );

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let passesSent = 0;

    for (const recipient of recipients) {
      const passCode = generatePassCode();

      const { error: insErr } = await supabase.from("viral_passes").insert({
        video_request_id,
        asset_id,
        recipient_email: recipient,
        pass_code: passCode,
        trial_type: "2hr",
      });
      if (insErr) {
        console.error("Failed to insert pass for", recipient, insErr);
        continue;
      }

      if (resendApiKey) {
        try {
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: "Survive Accounting <lee@mail.surviveaccounting.com>",
              to: [recipient],
              subject: "Lee answered your question! 🎉",
              html: buildPassEmail(passCode, assetCode),
              reply_to: "lee@surviveaccounting.com",
            }),
          });
          if (!r.ok) console.error("Resend error:", await r.text());
        } catch (e) {
          console.error("Email send failed for", recipient, e);
        }
      }
      passesSent++;
    }

    // 4. Mark video request as slayer
    await supabase
      .from("video_requests")
      .update({ status: "slayer" })
      .eq("id", video_request_id);

    return new Response(JSON.stringify({ success: true, passes_sent: passesSent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-viral-pass error:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
