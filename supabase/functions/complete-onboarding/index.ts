// Validates onboarding payload, stores it, classifies legacy vs new beta user,
// and (for new beta users) atomically claims a global + per-campus beta number.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  display_name: string;
  campus_id: string | null;
  campus_other?: string | null;
  course_id: string | null;
  syllabus_file_path?: string | null;
  is_accounting_major: "yes" | "no" | "definitely_not";
  is_in_greek_life: boolean;
  greek_org_id?: string | null;
  greek_org_other?: string | null;
  confidence_1_10: number;
}

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validate(p: Partial<Payload>): string | null {
  if (!p.display_name || p.display_name.trim().length < 1) return "Name is required";
  if (p.display_name.length > 120) return "Name too long";
  if (!p.is_accounting_major || !["yes", "no", "definitely_not"].includes(p.is_accounting_major)) {
    return "Major answer required";
  }
  if (typeof p.is_in_greek_life !== "boolean") return "Greek-life answer required";
  if (p.is_in_greek_life && !p.greek_org_id && !(p.greek_org_other && p.greek_org_other.trim())) {
    return "Pick a fraternity/sorority or use 'Add other'";
  }
  if (typeof p.confidence_1_10 !== "number" || p.confidence_1_10 < 1 || p.confidence_1_10 > 10) {
    return "Confidence (1-10) required";
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return bad("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return bad("Authentication required", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify the user's JWT via the anon client
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !userData?.user) return bad("Invalid session", 401);

  const user = userData.user;
  const email = (user.email || "").toLowerCase();
  if (!email) return bad("No email on session", 400);

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body");
  }
  const err = validate(body);
  if (err) return bad(err);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Determine legacy: any LW-enrolled purchase that predates today
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const { data: purchases } = await admin
    .from("student_purchases")
    .select("id, lw_enrollment_status, created_at")
    .eq("email", email);

  const isLegacy =
    !!purchases &&
    purchases.some(
      (p) =>
        p.lw_enrollment_status === "enrolled" &&
        new Date(p.created_at as string) < today,
    );

  // Upsert onboarding row
  const { error: upsertErr } = await admin
    .from("student_onboarding")
    .upsert(
      {
        user_id: user.id,
        email,
        display_name: body.display_name.trim().slice(0, 120),
        campus_id: body.campus_id,
        course_id: body.course_id,
        syllabus_file_path: body.syllabus_file_path || null,
        is_accounting_major: body.is_accounting_major,
        is_in_greek_life: body.is_in_greek_life,
        greek_org_id: body.is_in_greek_life ? body.greek_org_id : null,
        greek_org_other: body.is_in_greek_life
          ? (body.greek_org_other?.trim() || null)
          : null,
        confidence_1_10: Math.round(body.confidence_1_10),
        is_legacy: isLegacy,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );

  if (upsertErr) {
    console.error("[complete-onboarding] upsert:", upsertErr);
    return bad(upsertErr.message, 500);
  }

  let beta_number: number | null = null;
  let campus_beta_number: number | null = null;

  if (!isLegacy) {
    const { data: claimed, error: claimErr } = await admin.rpc(
      "claim_beta_number",
      { p_user_id: user.id, p_campus_id: body.campus_id },
    );
    if (claimErr) {
      console.error("[complete-onboarding] claim:", claimErr);
    } else if (Array.isArray(claimed) && claimed[0]) {
      beta_number = (claimed[0] as any).beta_number ?? null;
      campus_beta_number = (claimed[0] as any).campus_beta_number ?? null;
    }
  }

  // Look up campus name for the welcome card
  let campus_name: string | null = null;
  if (body.campus_id) {
    const { data: c } = await admin
      .from("campuses")
      .select("name")
      .eq("id", body.campus_id)
      .maybeSingle();
    campus_name = c?.name ?? null;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      legacy: isLegacy,
      beta_number,
      campus_beta_number,
      campus_name,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
