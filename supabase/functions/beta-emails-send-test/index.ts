import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, requireLee } from "../_shared/betaEmailAuth.ts";
import { applyVars, firstNameFromEmail, type RenderVars } from "../_shared/betaEmailRender.ts";

const TEST_FALLBACK = "lee@surviveaccounting.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { userId } = await requireLee(req);
    const { slug, to } = await req.json();
    if (!slug) {
      return new Response(JSON.stringify({ error: "slug required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const recipient = (to && String(to).trim()) || TEST_FALLBACK;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY missing");

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

    const vars: RenderVars = {
      recipient_email: recipient,
      first_name: firstNameFromEmail(recipient),
    };
    const subject = `[TEST] ${applyVars(tpl.subject, vars)}`;
    const html = applyVars(tpl.html_body, vars);
    const text = tpl.text_body ? applyVars(tpl.text_body, vars) : undefined;

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

    const status = res.ok ? "sent" : "failed";
    await supabase.from("beta_email_sends").insert({
      template_slug: slug,
      recipient_email: recipient,
      subject,
      status,
      is_test: true,
      resend_id: json?.id ?? null,
      error: res.ok ? null : (json?.message || `HTTP ${res.status}`),
      triggered_by: "manual",
      sent_by_user_id: userId,
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: json?.message || `HTTP ${res.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, resend_id: json?.id ?? null, recipient }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
