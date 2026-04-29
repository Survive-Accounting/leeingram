import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, requireLee } from "../_shared/betaEmailAuth.ts";
import { applyVars, firstNameFromEmail, type RenderVars } from "../_shared/betaEmailRender.ts";

const HARD_CAP = 500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { userId } = await requireLee(req);
    const { slug, recipient_emails, dry_run } = await req.json();
    if (!slug || !Array.isArray(recipient_emails)) {
      return new Response(JSON.stringify({ error: "slug and recipient_emails[] required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipients = Array.from(new Set(
      recipient_emails.map((e) => String(e || "").trim().toLowerCase()).filter((e) => e.includes("@"))
    ));
    if (recipients.length > HARD_CAP) {
      return new Response(JSON.stringify({ error: `Too many recipients (max ${HARD_CAP})` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: tpl, error } = await supabase
      .from("beta_email_templates").select("*").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!tpl) {
      return new Response(JSON.stringify({ error: "Template not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!tpl.enabled) {
      return new Response(JSON.stringify({ error: "Template is disabled. Enable it before sending." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find already-sent recipients to dedupe
    const { data: prior } = await supabase
      .from("beta_email_sends")
      .select("recipient_email")
      .eq("template_slug", slug)
      .eq("is_test", false)
      .eq("status", "sent")
      .in("recipient_email", recipients);
    const alreadySent = new Set((prior ?? []).map((r: any) => String(r.recipient_email).toLowerCase()));
    const eligible = recipients.filter((e) => !alreadySent.has(e));

    if (dry_run) {
      return new Response(JSON.stringify({
        dry_run: true,
        eligible_count: eligible.length,
        skipped_already_sent: recipients.length - eligible.length,
        eligible_sample: eligible.slice(0, 25),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY missing");

    // Pre-fetch onboarding for personalization
    const { data: onboarding } = await supabase
      .from("student_onboarding")
      .select("email, display_name, beta_number")
      .in("email", eligible.length ? eligible : ["__none__"]);
    const onboardingMap = new Map<string, any>();
    for (const o of onboarding ?? []) onboardingMap.set(String((o as any).email).toLowerCase(), o);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const recipient of eligible) {
      const ob = onboardingMap.get(recipient);
      const vars: RenderVars = {
        recipient_email: recipient,
        first_name: ob?.display_name ? String(ob.display_name).split(/\s+/)[0] : firstNameFromEmail(recipient),
        beta_number: ob?.beta_number ?? undefined,
      };
      const subject = applyVars(tpl.subject, vars);
      const html = applyVars(tpl.html_body, vars);
      const text = tpl.text_body ? applyVars(tpl.text_body, vars) : undefined;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: `${tpl.from_name} <${tpl.from_email}>`,
            reply_to: tpl.reply_to,
            to: [recipient],
            subject,
            html,
            ...(text ? { text } : {}),
          }),
        });
        const json = await res.json().catch(() => ({}));
        const ok = res.ok;
        await supabase.from("beta_email_sends").insert({
          template_slug: slug,
          recipient_email: recipient,
          subject,
          status: ok ? "sent" : "failed",
          is_test: false,
          resend_id: json?.id ?? null,
          error: ok ? null : (json?.message || `HTTP ${res.status}`),
          triggered_by: "manual",
          sent_by_user_id: userId,
        });
        if (ok) sent++; else { failed++; errors.push(`${recipient}: ${json?.message || res.status}`); }
      } catch (err: any) {
        failed++;
        errors.push(`${recipient}: ${err?.message ?? "error"}`);
        await supabase.from("beta_email_sends").insert({
          template_slug: slug,
          recipient_email: recipient,
          subject: tpl.subject,
          status: "failed",
          is_test: false,
          error: err?.message ?? "error",
          triggered_by: "manual",
          sent_by_user_id: userId,
        });
      }
      // Light pacing to avoid Resend rate limits
      await new Promise((r) => setTimeout(r, 60));
    }

    return new Response(JSON.stringify({
      ok: true,
      attempted: eligible.length,
      sent, failed,
      skipped_already_sent: recipients.length - eligible.length,
      errors: errors.slice(0, 10),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
