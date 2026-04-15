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
  // Strip plus-alias: lee+test1@survivestudios.com → lee@survivestudios.com
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
      campus_id: rawCampusId, campus_slug,
    } = await req.json();

    if (!email || !course_id || !product_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, course_id, product_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isTest = isTestEmail(email);
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

    // ── Price resolution ──
    // Try campus-specific pricing first via get_campus_price RPC
    let useCampusPricing = false;
    let priceCents = 0;
    let originalCents = 0;
    let discountLabel = "";
    let courseName = "Survive Accounting";

    // Fetch course name for Stripe product description
    const { data: courseRow } = await supabase
      .from("courses")
      .select("course_name")
      .eq("id", course_id)
      .maybeSingle();
    if (courseRow) courseName = `Survive Accounting – ${courseRow.course_name}`;

    if (campusId || campus_slug) {
      const slug = resolvedSlug || campus_slug || "general";
      const { data: campusPrice } = await supabase.rpc("get_campus_price", {
        p_campus_slug: slug,
        p_product_type: product_type,
      });

      if (campusPrice && campusPrice > 0) {
        priceCents = campusPrice;
        useCampusPricing = true;

        // Check for original/anchor price (global pricing as anchor)
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

    // ── Campus pricing path: use price_data (dynamic) ──
    if (useCampusPricing) {
      const description = discountLabel
        ? `${discountLabel} · Was $${Math.round(originalCents / 100)}`
        : undefined;

      const returnUrl = `${return_url || "https://learn.surviveaccounting.com"}/checkout/complete?session_id={CHECKOUT_SESSION_ID}`;

      const session = await stripe.checkout.sessions.create({
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
        success_url: returnUrl,
        cancel_url: `${return_url || "https://learn.surviveaccounting.com"}/campus/${resolvedSlug || "general"}/${campus_slug || "intermediate-accounting-2"}`,
        metadata: {
          email,
          course_id,
          chapter_id: chapter_id || "",
          product_type,
          campus_id: campusId || "",
          campus_slug: resolvedSlug || "",
          original_price_cents: String(originalCents || priceCents),
          discount_applied_cents: String(originalCents > priceCents ? originalCents - priceCents : 0),
        },
      });

      return new Response(
        JSON.stringify({ url: session.url }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Existing path: look up stripe_price_id from course_products ──
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

    const returnUrl = `${return_url || "https://learn.surviveaccounting.com"}/checkout/complete?session_id={CHECKOUT_SESSION_ID}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      success_url: returnUrl,
      cancel_url: `${return_url || "https://learn.surviveaccounting.com"}`,
      metadata: {
        email,
        course_id,
        chapter_id: chapter_id || "",
        product_type,
        campus_id: campusId || "",
        campus_slug: resolvedSlug || "",
      },
    });

    return new Response(
      JSON.stringify({ url: session.url }),
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
