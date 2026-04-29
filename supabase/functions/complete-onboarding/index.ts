// Validates onboarding payload, stores it, classifies legacy vs new beta user,
// and (for new beta users) atomically claims a global + per-campus beta number.
//
// Spring 2026 beta v1: drastically simplified. Only first/last name and a role
// question are required. Accounting major question is asked only when role is
// "student". Greek question removed. Campus is never typed in here.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UserRole = "student" | "parent" | "professor" | "cpa_professional" | "other";
type MajorStatus = "yes" | "no" | "not_sure";

interface Payload {
  // New v1 fields
  first_name?: string;
  last_name?: string;
  user_role?: UserRole;
  accounting_major_status?: MajorStatus | null;
  onboarding_version?: string;

  // Legacy fields (kept for back-compat with anything still posting them)
  display_name?: string;
  campus_id?: string | null;
  campus_other?: string | null;
  course_id?: string | null;
  syllabus_file_path?: string | null;
  is_accounting_major?: "yes" | "no" | "definitely_not" | "not_sure";
  is_in_greek_life?: boolean;
  greek_org_id?: string | null;
  greek_org_other?: string | null;
  confidence_1_10?: number;
}

const VALID_ROLES: UserRole[] = ["student", "parent", "professor", "cpa_professional", "other"];
const VALID_MAJOR: MajorStatus[] = ["yes", "no", "not_sure"];

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validate(p: Payload): string | null {
  const first = (p.first_name ?? "").trim();
  if (!first) return "First name is required";
  if (first.length > 80) return "First name too long";
  if ((p.last_name ?? "").length > 80) return "Last name too long";
  if (!p.user_role || !VALID_ROLES.includes(p.user_role)) return "Please pick who you are";
  if (p.user_role === "student") {
    if (!p.accounting_major_status || !VALID_MAJOR.includes(p.accounting_major_status)) {
      return "Please answer the accounting major question";
    }
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

  const firstName = (body.first_name ?? "").trim().slice(0, 80);
  const lastName = (body.last_name ?? "").trim().slice(0, 80);
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || firstName;
  const role = body.user_role!;
  const majorStatus = role === "student" ? (body.accounting_major_status ?? null) : null;
  const version = body.onboarding_version || "spring_2026_beta_v1";
  const campusId = body.campus_id ?? null;

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

  // Map new major status to legacy is_accounting_major for back-compat
  // ('not_sure' is now allowed by the relaxed CHECK constraint)
  const legacyMajor =
    majorStatus === "yes" ? "yes" :
    majorStatus === "no" ? "no" :
    majorStatus === "not_sure" ? "not_sure" : null;

  const { error: upsertErr } = await admin
    .from("student_onboarding")
    .upsert(
      {
        user_id: user.id,
        email,
        first_name: firstName || null,
        last_name: lastName || null,
        display_name: displayName || null,
        user_role: role,
        accounting_major_status: majorStatus,
        is_accounting_major: legacyMajor,
        campus_id: campusId,
        onboarding_version: version,
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
      { p_user_id: user.id, p_campus_id: campusId },
    );
    if (claimErr) {
      console.error("[complete-onboarding] claim:", claimErr);
    } else if (Array.isArray(claimed) && claimed[0]) {
      beta_number = (claimed[0] as any).beta_number ?? null;
      campus_beta_number = (claimed[0] as any).campus_beta_number ?? null;
    }
  }

  let campus_name: string | null = null;
  if (campusId) {
    const { data: c } = await admin
      .from("campuses")
      .select("name")
      .eq("id", campusId)
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
