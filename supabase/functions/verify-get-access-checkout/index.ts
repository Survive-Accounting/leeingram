import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

  // FORCED TEST MODE: must match create-get-access-checkout.
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_TEST");
  if (!stripeKey) return bad("Stripe secret key not configured", 500);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return bad("Supabase env not configured", 500);
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-11-20.acacia" });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const verified =
      session.status === "complete" && session.payment_status === "paid";

    const customer_email =
      session.customer_details?.email ?? session.customer_email ?? null;

    if (!verified) {
      return new Response(
        JSON.stringify({
          verified: false,
          status: session.status,
          payment_status: session.payment_status,
          customer_email,
          email: customer_email,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!customer_email) {
      return bad("No customer email on completed session", 500);
    }

    const cleanEmail = customer_email.toLowerCase();

    // Idempotently get-or-create the auth user
    let userId: string | null = null;
    try {
      // Look up existing user by listing (admin API has no direct getByEmail)
      const { data: list } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      const found = list?.users?.find(
        (u) => (u.email || "").toLowerCase() === cleanEmail,
      );
      if (found) {
        userId = found.id;
      } else {
        const { data: created, error: createErr } =
          await admin.auth.admin.createUser({
            email: cleanEmail,
            email_confirm: true,
          });
        if (createErr) throw createErr;
        userId = created.user?.id ?? null;
      }
    } catch (err) {
      console.error("[verify-get-access-checkout] user provisioning:", err);
      return bad("Could not provision user account", 500);
    }

    // Generate a magiclink the client can immediately consume to sign in
    let actionLink: string | null = null;
    try {
      const { data: linkData, error: linkErr } =
        await admin.auth.admin.generateLink({
          type: "magiclink",
          email: cleanEmail,
        });
      if (linkErr) throw linkErr;
      actionLink = linkData?.properties?.action_link ?? null;
    } catch (err) {
      console.error("[verify-get-access-checkout] magic link:", err);
      // Non-fatal; client can fallback to /login
    }

    // Update last-login + sharing fields on profile (non-fatal on failure)
    if (userId) {
      const ua = req.headers.get("user-agent") ?? null;
      const fwd = req.headers.get("x-forwarded-for") ?? "";
      const ip = fwd.split(",")[0]?.trim() || null;
      await admin.from("profiles").upsert(
        {
          user_id: userId,
          email: cleanEmail,
          last_login_at: new Date().toISOString(),
          last_login_ip: ip,
          last_user_agent: ua,
        },
        { onConflict: "user_id" },
      );

      // Link any existing student_purchases for this email to the user
      await admin
        .from("student_purchases")
        .update({ user_id: userId })
        .eq("email", cleanEmail)
        .is("user_id", null);
    }

    return new Response(
      JSON.stringify({
        verified: true,
        status: session.status,
        payment_status: session.payment_status,
        customer_email,
        email: customer_email,
        amount_total: session.amount_total,
        metadata: session.metadata ?? {},
        user_id: userId,
        action_link: actionLink,
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
