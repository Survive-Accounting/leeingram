import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CheckoutPayload {
  email: string;
  campus: string;
  selectedCourse: string;
  selectedPlan: string;
  amount: number; // dollars
  includedCourses: string[];
  origin?: string;
}

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return bad("Method not allowed", 405);

  let body: CheckoutPayload;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body");
  }

  const { email, campus, selectedCourse, selectedPlan, amount, includedCourses } = body;

  if (!email || typeof email !== "string" || !email.includes("@")) return bad("Valid email required");
  if (!selectedPlan) return bad("selectedPlan required");
  if (!Number.isFinite(amount) || amount <= 0) return bad("amount must be a positive number");
  if (!Array.isArray(includedCourses)) return bad("includedCourses must be an array");

  // Prefer LIVE; fall back to TEST so the function works in both environments.
  const stripeKey =
    Deno.env.get("STRIPE_SECRET_KEY_LIVE") ||
    Deno.env.get("STRIPE_SECRET_KEY_TEST");

  if (!stripeKey) return bad("Stripe secret key not configured", 500);

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-11-20.acacia" });

  const origin =
    body.origin ||
    req.headers.get("origin") ||
    req.headers.get("referer")?.replace(/\/+$/, "") ||
    "https://learn.surviveaccounting.com";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "hosted",
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: "Survive Accounting Study Pass",
              description: includedCourses.length
                ? `Includes: ${includedCourses.join(", ")}`
                : undefined,
            },
          },
        },
      ],
      metadata: {
        email,
        campus: campus || "",
        selectedCourse: selectedCourse || "",
        selectedPlan,
        includedCourses: includedCourses.join(","),
        amount: String(amount),
      },
      success_url: `${origin}/post-checkout?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/get-access`,
    });

    return new Response(JSON.stringify({ url: session.url, id: session.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Stripe error";
    console.error("[create-get-access-checkout] Stripe error:", message);
    return bad(message, 500);
  }
});
