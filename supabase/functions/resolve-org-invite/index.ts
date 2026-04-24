import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { code?: string; email?: string; mode?: "lookup" | "claim" };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const code = (body.code ?? "").trim();
  const mode = body.mode ?? "lookup";
  if (!code) return json({ error: "Missing invite code" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // ---- Resolve code → org_account_id ----
  let orgAccountId: string | null = null;

  if (UUID_RE.test(code)) {
    orgAccountId = code;
  } else {
    // Lookup token in app_settings (key = "org_invite_token:<uuid>", value = token)
    const { data: row } = await supabase
      .from("app_settings")
      .select("key")
      .like("key", "org_invite_token:%")
      .eq("value", code)
      .maybeSingle();
    if (row?.key) {
      orgAccountId = row.key.replace("org_invite_token:", "");
    }
  }

  if (!orgAccountId) {
    return json({ error: "Invite link not found" }, 404);
  }

  // ---- Load account + display info ----
  const { data: account } = await supabase
    .from("org_accounts")
    .select("id, status, auto_reup_enabled, campus_id, greek_org_id, org_name_manual")
    .eq("id", orgAccountId)
    .maybeSingle();

  if (!account) return json({ error: "Org not found" }, 404);

  const [{ data: campus }, { data: greekOrg }] = await Promise.all([
    account.campus_id
      ? supabase.from("campuses").select("name, slug").eq("id", account.campus_id).maybeSingle()
      : Promise.resolve({ data: null }),
    account.greek_org_id
      ? supabase
          .from("greek_orgs")
          .select("org_name, council")
          .eq("id", account.greek_org_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Aggregate seats remaining
  const { data: purchases } = await supabase
    .from("org_license_purchases")
    .select("seats_purchased, seats_used, payment_status")
    .eq("org_account_id", orgAccountId);

  const paid = (purchases ?? []).filter(
    (p) => p.payment_status === "paid" || p.payment_status === "manual",
  );
  const seats_remaining = paid.reduce(
    (s, p) => s + Math.max(0, (p.seats_purchased ?? 0) - (p.seats_used ?? 0)),
    0,
  );

  const orgInfo = {
    org_account_id: orgAccountId,
    org_name: greekOrg?.org_name ?? account.org_name_manual ?? "Your Organization",
    campus_name: campus?.name ?? null,
    council: greekOrg?.council ?? null,
    status: account.status,
    auto_reup_enabled: account.auto_reup_enabled,
    seats_remaining,
  };

  // ---- Lookup mode: just return org info ----
  if (mode === "lookup") {
    return json({ ok: true, org: orgInfo });
  }

  // ---- Claim mode: requires email; calls claim_org_seat RPC ----
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return json({ error: "Valid email required" }, 400);
  }
  if (account.status !== "active") {
    return json({ ok: false, outcome: "org_inactive", org: orgInfo });
  }

  const { data: rpcResult, error: rpcErr } = await supabase.rpc("claim_org_seat", {
    p_org_account_id: orgAccountId,
    p_email: email,
  });

  if (rpcErr) {
    console.error("[resolve-org-invite] claim_org_seat error", rpcErr);
    return json({ error: rpcErr.message }, 500);
  }

  return json({ ok: true, org: orgInfo, ...(rpcResult as Record<string, unknown>) });
});
