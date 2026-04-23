import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ verified: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return bad("Method not allowed", 405);

  let body: { session_id?: string };
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body");
  }

  const sessionId = body.session_id;
  if (!sessionId || typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
    return bad("Valid session_id required");
  }

  const stripeKey =
    Deno.env.get("STRIPE_SECRET_KEY_LIVE") ||
    Deno.env.get("STRIPE_SECRET_KEY_TEST");
  if (!stripeKey) return bad("Stripe secret key not configured", 500);

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-11-20.acacia" });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const verified =
      session.status === "complete" && session.payment_status === "paid";

    return new Response(
      JSON.stringify({
        verified,
        status: session.status,
        payment_status: session.payment_status,
        email: session.customer_details?.email ?? session.customer_email ?? null,
        amount_total: session.amount_total,
        metadata: session.metadata ?? {},
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Stripe error";
    console.error("[verify-get-access-checkout]", message);
    return bad(message, 500);
  }
});
