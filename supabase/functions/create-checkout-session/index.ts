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
      email, course_id, chapter_id, product_type, return_url,
      campus_id: rawCampusId, campus_slug, course_slug,
      ui_mode, is_test_mode, email_override,
      product_id: rawProductId, semester_id,
    } = await req.json();

    const isEmbedded = ui_mode === "embedded";

    if (!email || !product_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, product_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!course_id && product_type !== "bundle" && product_type !== "lifetime") {
      return new Response(
        JSON.stringify({ error: "Missing course_id" }),
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

    // ── Resolve campus_id from slug if needed ──
    let campusId = rawCampusId || null;
    let resolvedSlug = campus_slug || "";

    if (!campusId && campus_slug) {
      const { data: campus } = await supabase
        .from("campuses")
        .select("id")
        .eq("slug", campus_slug)
        .maybeSingle();
      if (campus) campusId = campus.id;
    } else if (campusId && !resolvedSlug) {
      const { data: campus } = await supabase
        .from("campuses")
        .select("slug")
        .eq("id", campusId)
        .maybeSingle();
      if (campus) resolvedSlug = campus.slug;
    }

    // ── Resolve course slug if not provided ──
    let resolvedCourseSlug = course_slug || "";
    if (!resolvedCourseSlug && course_id) {
      const { data: courseRow } = await supabase
        .from("courses")
        .select("slug")
        .eq("id", course_id)
        .maybeSingle();
      if (courseRow) resolvedCourseSlug = courseRow.slug;
    }

    // ── Resolve product_id (course_products or bundle_products) ──
    let resolvedProductId: string | null = rawProductId || null;
    let productAnchorCents = 0;
    let productStripePriceId: string | null = null;
    let productPaymentLinkUrl: string | null = null;

    if (!resolvedProductId && product_type === "semester_pass" && course_id) {
      let q = supabase
        .from("course_products")
        .select("id, anchor_price_cents, stripe_price_id_live, stripe_price_id_test, stripe_payment_link_url")
        .eq("course_id", course_id)
        .eq("product_type", "semester_pass")
        .eq("is_active", true);
      if (semester_id) q = q.eq("semester_id", semester_id);
      const { data: cp } = await q.maybeSingle();
      if (cp) {
        resolvedProductId = cp.id;
        productAnchorCents = cp.anchor_price_cents ?? 0;
        productStripePriceId = isTest ? cp.stripe_price_id_test : cp.stripe_price_id_live;
        productPaymentLinkUrl = (cp as any).stripe_payment_link_url ?? null;
      }
    } else if (resolvedProductId && product_type === "bundle") {
      const { data: bp } = await supabase
        .from("bundle_products")
        .select("anchor_price_cents, final_price_cents, stripe_price_id_live, stripe_price_id_test")
        .eq("id", resolvedProductId)
        .maybeSingle();
      if (bp) {
        productAnchorCents = bp.final_price_cents ?? bp.anchor_price_cents ?? 0;
        productStripePriceId = isTest ? bp.stripe_price_id_test : bp.stripe_price_id_live;
      }
    } else if (resolvedProductId && product_type === "semester_pass") {
      const { data: cp } = await supabase
        .from("course_products")
        .select("anchor_price_cents, stripe_price_id_live, stripe_price_id_test, stripe_payment_link_url")
        .eq("id", resolvedProductId)
        .maybeSingle();
      if (cp) {
        productAnchorCents = cp.anchor_price_cents ?? 0;
        productStripePriceId = isTest ? cp.stripe_price_id_test : cp.stripe_price_id_live;
        productPaymentLinkUrl = (cp as any).stripe_payment_link_url ?? null;
      }
    }

    // ── Resolve coupon (best-effort; failures don't block checkout) ──
    let resolvedCoupon: any = null;
    let couponFinalCents = productAnchorCents;
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
          university_id: campusId,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        resolvedCoupon = data?.coupon_applied ?? null;
        couponFinalCents = data?.final_price_cents ?? productAnchorCents;
        couponSavingsCents = data?.savings_cents ?? 0;
      }
    } catch (e) {
      console.warn("resolve-coupon failed:", (e as Error)?.message);
    }

    const stripeCouponId = resolvedCoupon
      ? (isTest ? resolvedCoupon.stripe_coupon_id_test : resolvedCoupon.stripe_coupon_id_live)
      : null;

    // ── Legacy campus pricing (only used if we still have no product_id path) ──
    let useCampusPricing = false;
    let priceCents = 0;
    let originalCents = 0;
    let discountLabel = "";
    let courseName = "Survive Accounting";

    if (course_id) {
      const { data: courseRow } = await supabase
        .from("courses")
        .select("course_name")
        .eq("id", course_id)
        .maybeSingle();
      if (courseRow) courseName = `Survive Accounting – ${courseRow.course_name}`;
    }

    if (!resolvedProductId && (campusId || campus_slug)) {
      const slug = resolvedSlug || campus_slug || "general";
      const { data: campusPrice } = await supabase.rpc("get_campus_price", {
        p_campus_slug: slug,
        p_product_type: product_type,
      });

      if (campusPrice && campusPrice > 0) {
        priceCents = campusPrice;
        useCampusPricing = true;

        const { data: globalPrice } = await supabase.rpc("get_campus_price", {
          p_campus_slug: "general",
          p_product_type: product_type,
        });
        if (globalPrice && globalPrice > priceCents) {
          originalCents = globalPrice;
          discountLabel = "Campus Discount";
        }
      }
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });
    const baseUrl = return_url || "https://learn.surviveaccounting.com";
    const successParams = new URLSearchParams({ session_id: "{CHECKOUT_SESSION_ID}" });
    if (resolvedSlug) successParams.set("campus", resolvedSlug);
    if (resolvedCourseSlug) successParams.set("course", resolvedCourseSlug);
    const returnUrl = `${baseUrl}/checkout/complete?${successParams.toString()}`;
    const cancelUrl = resolvedSlug && resolvedCourseSlug
      ? `${baseUrl}/campus/${resolvedSlug}/${resolvedCourseSlug}`
      : baseUrl;

    const sessionMetadata: Record<string, string> = {
      email,
      course_id: course_id || "",
      chapter_id: chapter_id || "",
      product_type,
      product_id: resolvedProductId || "",
      semester_id: semester_id || "",
      campus_id: campusId || "",
      campus_slug: resolvedSlug || "",
      course_slug: resolvedCourseSlug || "",
      original_price_cents: String(originalCents || priceCents || productAnchorCents),
      discount_applied_cents: String(
        couponSavingsCents || (originalCents > priceCents ? originalCents - priceCents : 0)
      ),
      coupon_code: resolvedCoupon?.code || "",
      discount_percent: String(resolvedCoupon?.discount_percent ?? 0),
      final_price_cents: String(couponFinalCents || priceCents || productAnchorCents),
      is_test: String(isTest),
      is_test_mode: String(isSaTest),
      email_override: isSaTest ? (email_override || "lee@surviveaccounting.com") : "",
    };

    // ── PAYMENT LINK FALLBACK ──
    if (!isEmbedded && productPaymentLinkUrl) {
      const url = new URL(productPaymentLinkUrl);
      url.searchParams.set("prefilled_email", email);
      return new Response(
        JSON.stringify({ url: url.toString() }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Path A: product_id with stripe_price_id (preferred) ──
    if (resolvedProductId && productStripePriceId) {
      const sessionParams: any = {
        mode: "payment",
        line_items: [{ price: productStripePriceId, quantity: 1 }],
        customer_email: email,
        metadata: sessionMetadata,
      };
      if (stripeCouponId) sessionParams.discounts = [{ coupon: stripeCouponId }];

      if (isEmbedded) {
        sessionParams.ui_mode = "embedded";
        sessionParams.return_url = returnUrl;
      } else {
        sessionParams.success_url = returnUrl;
        sessionParams.cancel_url = cancelUrl;
      }

      const session = await stripe.checkout.sessions.create(sessionParams);
      return new Response(
        JSON.stringify(isEmbedded ? { clientSecret: session.client_secret } : { url: session.url }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Path B: legacy campus pricing (price_data) ──
    if (useCampusPricing) {
      const description = discountLabel
        ? `${discountLabel} · Was $${Math.round(originalCents / 100)}`
        : undefined;

      const sessionParams: any = {
        mode: "payment",
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: {
              name: courseName,
              ...(description ? { description } : {}),
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        }],
        customer_email: email,
        metadata: sessionMetadata,
      };
      if (stripeCouponId) sessionParams.discounts = [{ coupon: stripeCouponId }];

      if (isEmbedded) {
        sessionParams.ui_mode = "embedded";
        sessionParams.return_url = returnUrl;
      } else {
        sessionParams.success_url = returnUrl;
        sessionParams.cancel_url = cancelUrl;
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      return new Response(
        JSON.stringify(isEmbedded ? { clientSecret: session.client_secret } : { url: session.url }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Path C: legacy course_products lookup by course_id+chapter_id+product_type ──
    let query = supabase
      .from("course_products")
      .select("stripe_price_id_live, stripe_price_id_test")
      .eq("course_id", course_id)
      .eq("product_type", product_type)
      .eq("is_active", true);

    if (chapter_id) {
      query = query.eq("chapter_id", chapter_id);
    } else {
      query = query.is("chapter_id", null);
    }

    const { data: product, error: prodErr } = await query.maybeSingle();

    if (prodErr || !product) {
      return new Response(
        JSON.stringify({ error: "Product not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const priceId = isTest ? product.stripe_price_id_test : product.stripe_price_id_live;
    if (!priceId) {
      return new Response(
        JSON.stringify({ error: `No ${isTest ? "test" : "live"} price ID configured for this product` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sessionParams2: any = {
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      metadata: sessionMetadata,
    };
    if (stripeCouponId) sessionParams2.discounts = [{ coupon: stripeCouponId }];

    if (isEmbedded) {
      sessionParams2.ui_mode = "embedded";
      sessionParams2.return_url = returnUrl;
    } else {
      sessionParams2.success_url = returnUrl;
      sessionParams2.cancel_url = cancelUrl;
    }

    const session = await stripe.checkout.sessions.create(sessionParams2);

    return new Response(
      JSON.stringify(isEmbedded ? { clientSecret: session.client_secret } : { url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
