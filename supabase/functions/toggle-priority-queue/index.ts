import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const active = !!body?.active;
    const cutoffTime: string | null = typeof body?.cutoff_time === "string" ? body.cutoff_time : null;
    const priceCents: number | null = Number.isFinite(body?.price_cents) ? Number(body.price_cents) : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Update the singleton config row (most recent)
    const { data: cfgRow } = await supabase
      .from("priority_queue_config")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const configPatch: Record<string, unknown> = {
      is_active: active,
      updated_at: new Date().toISOString(),
    };
    if (cutoffTime) configPatch.cutoff_time = cutoffTime;
    if (priceCents !== null) configPatch.price_cents = priceCents;

    if (cfgRow?.id) {
      const { error: updErr } = await supabase
        .from("priority_queue_config")
        .update(configPatch)
        .eq("id", cfgRow.id);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await supabase.from("priority_queue_config").insert({
        is_active: active,
        cutoff_time: cutoffTime ?? "14:00:00",
        price_cents: priceCents ?? 1500,
      });
      if (insErr) throw insErr;
    }

    if (active) {
      // Open a new session (close any leftover open ones first)
      await supabase
        .from("priority_queue_sessions")
        .update({ clocked_out_at: new Date().toISOString() })
        .is("clocked_out_at", null);

      const { error: sessErr } = await supabase.from("priority_queue_sessions").insert({
        clocked_in_at: new Date().toISOString(),
        cutoff_time: cutoffTime ?? "14:00:00",
      });
      if (sessErr) throw sessErr;
    } else {
      // Close any open session
      await supabase
        .from("priority_queue_sessions")
        .update({ clocked_out_at: new Date().toISOString() })
        .is("clocked_out_at", null);
    }

    return new Response(JSON.stringify({ success: true, active }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("toggle-priority-queue error:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
