import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, requireLee } from "../_shared/betaEmailAuth.ts";
import { applyVars, firstNameFromEmail, type RenderVars } from "../_shared/betaEmailRender.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    await requireLee(req);
    const { slug, sample_recipient_email } = await req.json();
    if (!slug) {
      return new Response(JSON.stringify({ error: "slug required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: tpl, error } = await supabase
      .from("beta_email_templates")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!tpl) {
      return new Response(JSON.stringify({ error: "Template not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vars: RenderVars = {};
    if (sample_recipient_email) {
      const email = String(sample_recipient_email).trim().toLowerCase();
      vars.recipient_email = email;
      vars.first_name = firstNameFromEmail(email);
      const { data: ob } = await supabase
        .from("student_onboarding")
        .select("display_name, beta_number, course_id, campus_id")
        .eq("email", email)
        .maybeSingle();
      if (ob?.display_name) vars.first_name = ob.display_name.split(/\s+/)[0];
      if (ob?.beta_number) vars.beta_number = ob.beta_number;
    }

    return new Response(
      JSON.stringify({
        slug: tpl.slug,
        from_name: tpl.from_name,
        from_email: tpl.from_email,
        reply_to: tpl.reply_to,
        subject: applyVars(tpl.subject, vars),
        preheader: tpl.preheader ? applyVars(tpl.preheader, vars) : null,
        html: applyVars(tpl.html_body, vars),
        text: tpl.text_body ? applyVars(tpl.text_body, vars) : null,
        is_managed: tpl.is_managed,
        enabled: tpl.enabled,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    if (e instanceof Response) return e;
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
