import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PaymentMethod = "ach" | "card" | "manual";

interface Payload {
  contact_email: string;
  campus_id: string | null;
  campus_slug?: string | null;
  greek_org_id: string | null;
  org_name: string;
  seats: number;
  price_per_seat_cents: number; // integer cents per seat
  total_cents: number; // integer cents (seats * price_per_seat_cents)
  is_promo?: boolean;
  tier_id?: string | null;
  payment_method: PaymentMethod;
  auto_reup_enabled: boolean;
  weekly_seat_limit: number | null;
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

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body");
  }

  const {
    contact_email,
    campus_id,
    greek_org_id,
    org_name,
    seats,
    price_per_seat_cents,
    total_cents,
    payment_method,
    auto_reup_enabled,
    weekly_seat_limit,
    is_promo,
    tier_id,
  } = body;

  // ---- Validation ----
  if (!contact_email || typeof contact_email !== "string" || !contact_email.includes("@")) {
    return bad("Valid contact_email required");
  }
  if (!org_name || typeof org_name !== "string") return bad("org_name required");
  if (!Number.isFinite(seats) || seats <= 0) return bad("seats must be > 0");
  if (!Number.isFinite(price_per_seat_cents) || price_per_seat_cents <= 0) {
    return bad("price_per_seat_cents must be > 0");
  }
  if (!Number.isFinite(total_cents) || total_cents <= 0) return bad("total_cents must be > 0");
  if (!["ach", "card", "manual"].includes(payment_method)) return bad("Invalid payment_method");

  // ---- Supabase service client ----
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return bad("Supabase service env not configured", 500);
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- Upsert org_account ----
  const status = payment_method === "manual" ? "pending_manual_payment" : "pending_payment";
  const email = contact_email.trim().toLowerCase();

  // Try to find an existing draft/pending account for this contact + greek_org_id
  let orgAccountId: string | null = null;
  try {
    const { data: existing } = await supabase
      .from("org_accounts")
      .select("id, status")
      .eq("contact_email", email)
      .eq("greek_org_id", greek_org_id ?? "")
      .in("status", ["draft", "pending_payment", "pending_manual_payment"])
      .maybeSingle();

    if (existing?.id) {
      orgAccountId = existing.id;
      await supabase
        .from("org_accounts")
        .update({
          campus_id,
          greek_org_id,
          org_name_manual: org_name,
          status,
          payment_method,
          auto_reup_enabled,
          weekly_seat_limit,
        })
        .eq("id", existing.id);
    } else {
      const { data: created, error: insertErr } = await supabase
        .from("org_accounts")
        .insert({
          campus_id,
          greek_org_id,
          contact_email: email,
          org_name_manual: org_name,
          status,
          payment_method,
          auto_reup_enabled,
          weekly_seat_limit,
        })
        .select("id")
        .single();
      if (insertErr) {
        console.error("[create-org-access-checkout] org_accounts insert error", insertErr);
        return bad(`Failed to create org account: ${insertErr.message}`, 500);
      }
      orgAccountId = created.id;
    }
  } catch (err) {
    console.error("[create-org-access-checkout] org_accounts error", err);
    return bad("Failed to upsert org account", 500);
  }

  if (!orgAccountId) return bad("Could not resolve org account id", 500);

  const origin =
    body.origin ||
    req.headers.get("origin") ||
    req.headers.get("referer")?.replace(/\/+$/, "") ||
    "https://learn.surviveaccounting.com";

  // ---- Manual invoice / check: skip Stripe, return manual outcome ----
  if (payment_method === "manual") {
    // Record a placeholder purchase row in pending state (no stripe session)
    try {
      await supabase.from("org_license_purchases").insert({
        org_account_id: orgAccountId,
        seats_purchased: seats,
        seats_used: 0,
        price_per_seat: price_per_seat_cents / 100,
        total_paid: total_cents / 100,
        payment_status: "pending_manual",
        stripe_session_id: null,
      });
    } catch (err) {
      console.error("[create-org-access-checkout] manual purchase log error", err);
      // Non-fatal; proceed.
    }

    return new Response(
      JSON.stringify({
        outcome: "manual",
        org_account_id: orgAccountId,
        redirect_url: `/get-org-access?manual=1&org_account_id=${orgAccountId}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ---- Stripe Checkout (ACH or Card) ----
  // FORCED TEST MODE for prototype, matching /get-access flow.
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_TEST");
  if (!stripeKey) return bad("Stripe secret key not configured", 500);
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-11-20.acacia" });

  // Payment methods per preference
  const payment_method_types: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
    payment_method === "ach" ? ["us_bank_account", "card"] : ["card", "link"];

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types,
      customer_email: email,
      line_items: [
        {
          quantity: seats,
          price_data: {
            currency: "usd",
            unit_amount: price_per_seat_cents,
            product_data: {
              name: "Survive Accounting — Chapter Seats",
              description: `${seats} student passes for ${org_name}`,
            },
          },
        },
      ],
      metadata: {
        flow: "org_access",
        org_account_id: orgAccountId,
        campus_id: campus_id ?? "",
        greek_org_id: greek_org_id ?? "",
        org_name,
        seats_purchased: String(seats),
        price_per_seat: String(price_per_seat_cents / 100),
        total_paid: String(total_cents / 100),
        is_promo: is_promo ? "true" : "false",
        tier_id: tier_id ?? "",
        payment_method,
        auto_reup_enabled: auto_reup_enabled ? "true" : "false",
        weekly_seat_limit: weekly_seat_limit != null ? String(weekly_seat_limit) : "",
      },
      success_url: `${origin}/org-dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/get-org-access`,
    });

    // Log a pending purchase row (will be reconciled by webhook later)
    try {
      await supabase.from("org_license_purchases").insert({
        org_account_id: orgAccountId,
        seats_purchased: seats,
        seats_used: 0,
        price_per_seat: price_per_seat_cents / 100,
        total_paid: total_cents / 100,
        payment_status: "pending",
        stripe_session_id: session.id,
      });
    } catch (err) {
      console.error("[create-org-access-checkout] pending purchase log error", err);
      // Non-fatal.
    }

    return new Response(
      JSON.stringify({
        outcome: "checkout",
        url: session.url,
        id: session.id,
        org_account_id: orgAccountId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? (err as any).message : "Unknown Stripe error";
    console.error("[create-org-access-checkout] Stripe error:", message);
    return bad(message, 500);
  }
});
