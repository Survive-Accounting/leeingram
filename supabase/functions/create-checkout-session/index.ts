const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const BYPASS_BASE_EMAILS = [
  "lee@survivestudios.com",
  "jking.cim@gmail.com",
];

function isTestEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  const normalized = lower.replace(/\+[^@]*@/, "@");
  return BYPASS_BASE_EMAILS.includes(normalized);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      email,
      course_id,
      semester_id,
      product_type,
      bundle_id,
      university_id,
      return_url,
      is_test_mode,
      email_override,
    } = await req.json();

    if (!email || !product_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, product_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isSaTest = is_test_mode === true || email.trim().toLowerCase().startsWith("satest@");
    const isTest = isTestEmail(email) || isSaTest;
    const stripeKey = isTest
      ? Deno.env.get("STRIPE_SECRET_KEY_TEST")
      : Deno.env.get("STRIPE_SECRET_KEY_LIVE");

    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: `Stripe ${isTest ? "test" : "live"} key not configured` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Look up Stripe price ──
    let stripePriceId: string | null = null;
    let resolvedProductId: string | null = null;
    let anchorCents = 0;

    if (product_type === "semester_pass") {
      if (!course_id) {
        return new Response(
          JSON.stringify({ error: "Missing course_id for semester_pass" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      let q = supabase
        .from("course_products")
        .select("id, anchor_price_cents, stripe_price_id_live, stripe_price_id_test")
        .eq("course_id", course_id)
        .eq("product_type", "semester_pass")
        .eq("is_active", true);
      if (semester_id) q = q.eq("semester_id", semester_id);
      const { data: cp } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (cp) {
        resolvedProductId = cp.id;
        anchorCents = cp.anchor_price_cents ?? 0;
        stripePriceId = isTest ? cp.stripe_price_id_test : cp.stripe_price_id_live;
      }
    } else if (product_type === "bundle") {
      if (!bundle_id) {
        return new Response(
          JSON.stringify({ error: "Missing bundle_id for bundle" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: bp } = await supabase
        .from("bundle_products")
        .select("id, anchor_price_cents, final_price_cents, stripe_price_id_live, stripe_price_id_test")
        .eq("id", bundle_id)
        .maybeSingle();
      if (bp) {
        resolvedProductId = bp.id;
        anchorCents = bp.final_price_cents ?? bp.anchor_price_cents ?? 0;
        stripePriceId = isTest ? bp.stripe_price_id_test : bp.stripe_price_id_live;
      }
    }

    if (!stripePriceId) {
      return new Response(
        JSON.stringify({ error: `No ${isTest ? "test" : "live"} Stripe price ID found for this product` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Resolve coupon (best-effort) ──
    let resolvedCoupon: any = null;
    let couponFinalCents = anchorCents;
    let couponSavingsCents = 0;
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/resolve-coupon`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
        },
        body: JSON.stringify({
          email,
          product_id: resolvedProductId,
          product_type,
          university_id: university_id || null,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        resolvedCoupon = data?.coupon_applied ?? null;
        couponFinalCents = data?.final_price_cents ?? anchorCents;
        couponSavingsCents = data?.savings_cents ?? 0;
      }
    } catch (e) {
      console.warn("resolve-coupon failed:", (e as Error)?.message);
    }

    const stripeCouponId = resolvedCoupon
      ? (isTest ? resolvedCoupon.stripe_coupon_id_test : resolvedCoupon.stripe_coupon_id_live)
      : null;

    // ── Build hosted Checkout session ──
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });
    const baseUrl = return_url || "https://learn.surviveaccounting.com";

    const sessionMetadata: Record<string, string> = {
      email,
      course_id: course_id || "",
      semester_id: semester_id || "",
      product_type,
      product_id: resolvedProductId || "",
      bundle_id: bundle_id || "",
      university_id: university_id || "",
      coupon_code: resolvedCoupon?.code || "",
      discount_percent: String(resolvedCoupon?.discount_percent ?? 0),
      original_price_cents: String(anchorCents),
      discount_applied_cents: String(couponSavingsCents),
      final_price_cents: String(couponFinalCents),
      is_test: String(isTest),
      is_test_mode: String(isSaTest),
      email_override: isSaTest ? (email_override || "lee@surviveaccounting.com") : "",
    };

    const sessionParams: any = {
      mode: "payment",
      line_items: [{ price: stripePriceId, quantity: 1 }],
      customer_email: email,
      payment_method_types: ["card", "link", "affirm"],
      success_url: `${baseUrl}/my-dashboard?checkout=success`,
      cancel_url: `${baseUrl}/checkout/cancelled`,
      metadata: sessionMetadata,
    };
    if (stripeCouponId) sessionParams.discounts = [{ coupon: stripeCouponId }];

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(
      JSON.stringify({ checkout_url: session.url, url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
