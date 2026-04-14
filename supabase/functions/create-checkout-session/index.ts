import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const BYPASS_EMAILS = [
  "lee@survivestudios.com",
  "jking.cim@gmail.com",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, course_id, chapter_id, product_type, return_url } = await req.json();

    if (!email || !course_id || !product_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, course_id, product_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isTest = BYPASS_EMAILS.includes(email.trim().toLowerCase());
    const stripeKey = isTest
      ? Deno.env.get("STRIPE_SECRET_KEY_TEST")
      : Deno.env.get("STRIPE_SECRET_KEY_LIVE");

    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: `Stripe ${isTest ? "test" : "live"} key not configured` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the correct stripe_price_id from course_products
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      return_url: `${return_url || "https://learn.surviveaccounting.com"}/checkout/complete?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        email,
        course_id,
        chapter_id: chapter_id || "",
        product_type,
      },
    });

    return new Response(
      JSON.stringify({ clientSecret: session.client_secret }),
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
