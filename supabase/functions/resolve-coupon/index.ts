const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const PRIORITY: Record<string, number> = {
  campus: 40,
  greek_org: 30,
  bundle: 20,
  semester: 10,
  global_promo: 0,
};

interface ResolveInput {
  email: string;
  product_id: string;
  product_type: "semester_pass" | "bundle" | "lifetime";
  university_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, product_id, product_type, university_id } =
      (await req.json()) as ResolveInput;

    if (!email || !product_id || !product_type) {
      return json({ error: "Missing required fields: email, product_id, product_type" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Fetch anchor price ──
    let anchorCents = 0;
    if (product_type === "bundle") {
      const { data } = await supabase
        .from("bundle_products")
        .select("anchor_price_cents, final_price_cents")
        .eq("id", product_id)
        .maybeSingle();
      if (data) anchorCents = data.final_price_cents ?? data.anchor_price_cents ?? 0;
    } else if (product_type === "lifetime") {
      const { data } = await supabase
        .from("lifetime_products")
        .select("anchor_price_cents")
        .eq("id", product_id)
        .maybeSingle();
      if (data) anchorCents = data.anchor_price_cents ?? 0;
    } else {
      const { data } = await supabase
        .from("course_products")
        .select("anchor_price_cents")
        .eq("id", product_id)
        .maybeSingle();
      if (data) anchorCents = data.anchor_price_cents ?? 0;
    }

    // ── Fetch active coupons ──
    const nowIso = new Date().toISOString();
    const { data: allCoupons, error: cErr } = await supabase
      .from("coupons")
      .select("*")
      .eq("is_active", true);

    if (cErr) throw cErr;

    const considered: any[] = [];
    const eligible: any[] = [];

    for (const c of allCoupons ?? []) {
      const reasons: string[] = [];
      let ok = true;

      if (c.valid_from && c.valid_from > nowIso) { ok = false; reasons.push("not_yet_valid"); }
      if (c.valid_until && c.valid_until < nowIso) { ok = false; reasons.push("expired"); }

      // applicable_to: 'all' | JSON array of product_ids
      if (c.applicable_to && c.applicable_to !== "all") {
        try {
          const list = typeof c.applicable_to === "string"
            ? JSON.parse(c.applicable_to)
            : c.applicable_to;
          if (Array.isArray(list) && !list.includes(product_id)) {
            ok = false; reasons.push("product_not_applicable");
          }
        } catch {
          // if not parseable, treat as not applicable unless equal to product_id
          if (c.applicable_to !== product_id) { ok = false; reasons.push("applicable_to_invalid"); }
        }
      }

      // university scoping
      if (c.university_id) {
        if (!university_id || c.university_id !== university_id) {
          ok = false; reasons.push("university_mismatch");
        }
      }

      considered.push({
        id: c.id,
        code: c.code,
        type: c.type,
        priority: c.priority ?? PRIORITY[c.type] ?? 0,
        eligible: ok,
        reasons,
      });

      if (ok) eligible.push(c);
    }

    // ── Sort: priority desc, then discount_percent desc ──
    eligible.sort((a, b) => {
      const pa = a.priority ?? PRIORITY[a.type] ?? 0;
      const pb = b.priority ?? PRIORITY[b.type] ?? 0;
      if (pb !== pa) return pb - pa;
      return (b.discount_percent ?? 0) - (a.discount_percent ?? 0);
    });

    const winner = eligible[0] ?? null;

    const discountPct = winner?.discount_percent ?? 0;
    const savings = Math.round((anchorCents * discountPct) / 100);
    const finalCents = Math.max(0, anchorCents - savings);

    const reason = winner
      ? `Selected ${winner.code} (type=${winner.type}, priority=${winner.priority ?? PRIORITY[winner.type] ?? 0}, discount=${discountPct}%)`
      : "No eligible coupons";

    // ── Log resolution ──
    await supabase.from("coupon_resolutions").insert({
      email,
      product_id,
      coupons_considered: considered,
      coupon_applied: winner?.id ?? null,
      resolution_reason: reason,
    });

    return json({
      coupon_applied: winner
        ? {
            id: winner.id,
            code: winner.code,
            stripe_coupon_id_live: winner.stripe_coupon_id_live,
            stripe_coupon_id_test: winner.stripe_coupon_id_test,
            discount_percent: winner.discount_percent,
            name: winner.name,
          }
        : null,
      final_price_cents: finalCents,
      anchor_price_cents: anchorCents,
      savings_cents: savings,
    }, 200);
  } catch (err: any) {
    console.error("resolve-coupon error:", err);
    return json({ error: err?.message ?? "Internal server error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
