import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, requireLee } from "../_shared/betaEmailAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    await requireLee(req);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: templates, error } = await supabase
      .from("beta_email_templates")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;

    const slugs = (templates ?? []).map((t: any) => t.slug);
    const since = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
    const { data: sends } = await supabase
      .from("beta_email_sends")
      .select("template_slug, status, is_test, created_at")
      .in("template_slug", slugs.length ? slugs : ["__none__"])
      .gte("created_at", since);

    const stats: Record<string, { sent7d: number; tests7d: number; lastSentAt: string | null }> = {};
    for (const s of sends ?? []) {
      const k = (s as any).template_slug;
      stats[k] ??= { sent7d: 0, tests7d: 0, lastSentAt: null };
      if ((s as any).status === "sent") {
        if ((s as any).is_test) stats[k].tests7d++;
        else {
          stats[k].sent7d++;
          if (!stats[k].lastSentAt || (s as any).created_at > stats[k].lastSentAt!) {
            stats[k].lastSentAt = (s as any).created_at;
          }
        }
      }
    }

    return new Response(JSON.stringify({ templates: templates ?? [], stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
