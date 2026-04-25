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

function generateInviteToken(): string {
  // 24-char URL-safe token
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return bad("Method not allowed", 405);

  let body: { session_id?: string; org_account_id?: string };
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body");
  }

  const { session_id, org_account_id } = body;

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_TEST");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!stripeKey || !supabaseUrl || !serviceKey) return bad("Server env missing", 500);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let orgAccountId = org_account_id ?? null;
  let stripeVerified = false;
  let stripeStatus: string | null = null;
  let paymentStatus: string | null = null;
  let isManual = false;

  // ---- If we have a Stripe session, verify it ----
  if (session_id && session_id.startsWith("cs_")) {
    try {
      const stripe = new Stripe(stripeKey, { apiVersion: "2024-11-20.acacia" });
      const session = await stripe.checkout.sessions.retrieve(session_id);
      stripeStatus = session.status ?? null;
      paymentStatus = session.payment_status ?? null;
      stripeVerified =
        session.status === "complete" && session.payment_status === "paid";

      if (!orgAccountId) {
        orgAccountId = (session.metadata?.org_account_id as string) ?? null;
      }

      if (stripeVerified && orgAccountId) {
        // Mark purchase as paid
        await supabase
          .from("org_license_purchases")
          .update({ payment_status: "paid" })
          .eq("stripe_session_id", session_id);

        // Activate org_account
        await supabase
          .from("org_accounts")
          .update({
            status: "active",
            stripe_customer_id:
              (typeof session.customer === "string"
                ? session.customer
                : session.customer?.id) ?? null,
          })
          .eq("id", orgAccountId);
      }
    } catch (err) {
      console.error("[verify-org-access-checkout] Stripe error", err);
      return bad(err instanceof Error ? (err as any).message : "Stripe error", 500);
    }
  } else if (orgAccountId) {
    // Manual invoice path — no session_id, just load by account id
    isManual = true;
  } else {
    return bad("session_id or org_account_id required");
  }

  if (!orgAccountId) return bad("Could not resolve org_account_id", 500);

  // ---- Load org_account + most recent purchase ----
  const { data: account, error: accountErr } = await supabase
    .from("org_accounts")
    .select(
      "id, campus_id, greek_org_id, org_name_manual, contact_email, status, payment_method, auto_reup_enabled, weekly_seat_limit",
    )
    .eq("id", orgAccountId)
    .maybeSingle();

  if (accountErr || !account) {
    return bad("Org account not found", 404);
  }

  const [{ data: purchases }, { data: campus }, { data: greekOrg }] = await Promise.all([
    supabase
      .from("org_license_purchases")
      .select(
        "id, seats_purchased, seats_used, price_per_seat, total_paid, payment_status, stripe_session_id, created_at",
      )
      .eq("org_account_id", orgAccountId)
      .order("created_at", { ascending: false }),
    account.campus_id
      ? supabase.from("campuses").select("id, name, slug").eq("id", account.campus_id).maybeSingle()
      : Promise.resolve({ data: null }),
    account.greek_org_id
      ? supabase
          .from("greek_orgs")
          .select("id, org_name, council, org_slug")
          .eq("id", account.greek_org_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // ---- Ensure invite token exists (idempotent on app_settings) ----
  const tokenKey = `org_invite_token:${orgAccountId}`;
  let inviteToken: string | null = null;
  try {
    const { data: existing } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", tokenKey)
      .maybeSingle();
    if (existing?.value) {
      inviteToken = existing.value;
    } else if (account.status === "active") {
      inviteToken = generateInviteToken();
      await supabase.from("app_settings").upsert({
        key: tokenKey,
        value: inviteToken,
      });
    }
  } catch (err) {
    console.error("[verify-org-access-checkout] token error", err);
  }

  // ---- Ensure contact_email is registered as an org_admin (owner) ----
  if (account.status === "active") {
    try {
      await supabase
        .from("org_admins")
        .upsert(
          {
            org_account_id: orgAccountId,
            user_email: account.contact_email,
            role: "owner",
          },
          { onConflict: "org_account_id,user_email" },
        );
    } catch (err) {
      console.error("[verify-org-access-checkout] org_admin upsert error", err);
    }
  }

  // ---- Aggregate seat totals across all paid purchases ----
  const paidPurchases = (purchases ?? []).filter(
    (p) => p.payment_status === "paid" || p.payment_status === "manual",
  );
  const seats_purchased = paidPurchases.reduce((s, p) => s + (p.seats_purchased ?? 0), 0);
  const seats_used = paidPurchases.reduce((s, p) => s + (p.seats_used ?? 0), 0);
  const seats_remaining = Math.max(0, seats_purchased - seats_used);

  return new Response(
    JSON.stringify({
      verified: stripeVerified || isManual || account.status === "active",
      status: account.status,
      stripe_status: stripeStatus,
      payment_status: paymentStatus,
      org_account_id: orgAccountId,
      account: {
        id: account.id,
        contact_email: account.contact_email,
        org_name: greekOrg?.org_name ?? account.org_name_manual ?? "Your Organization",
        campus_name: campus?.name ?? null,
        campus_slug: campus?.slug ?? null,
        council: greekOrg?.council ?? null,
        payment_method: account.payment_method,
        auto_reup_enabled: account.auto_reup_enabled,
        weekly_seat_limit: account.weekly_seat_limit,
      },
      seats: {
        purchased: seats_purchased,
        used: seats_used,
        remaining: seats_remaining,
      },
      purchases: purchases ?? [],
      invite_token: inviteToken,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
