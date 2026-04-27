// Free Beta claim — creates student/purchase records, creates auth user,
// and returns a magic link the client navigates to so the user lands
// authenticated on /my-dashboard.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FREE_BETA_EXPIRES_AT = "2026-05-16T23:59:59Z"; // Spring '26 finals
const DEFAULT_COURSE_SLUG = "intro-accounting-2";

interface Payload {
  email: string;
  campus?: string | null;
  course?: string | null;
  earlyBirdOptIn?: boolean;
  origin?: string;
}

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return bad("Method not allowed", 405);

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body");
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return bad("Valid email required");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const origin =
    body.origin || req.headers.get("origin") || "https://learn.surviveaccounting.com";

  // Resolve campus
  let campusId: string | null = null;
  if (body.campus) {
    const { data: campus } = await supabase
      .from("campuses")
      .select("id")
      .eq("slug", body.campus)
      .maybeSingle();
    campusId = campus?.id ?? null;
  }

  // Resolve course
  const courseSlug = body.course || DEFAULT_COURSE_SLUG;
  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("slug", courseSlug)
    .maybeSingle();
  const courseId = course?.id ?? null;
  if (!courseId) return bad("Course not found", 404);

  // Upsert student
  let studentId: string | null = null;
  try {
    const { data: existing } = await supabase
      .from("students")
      .select("id, campus_id")
      .eq("email", email)
      .maybeSingle();
    if (existing) {
      studentId = existing.id;
      if (campusId && !existing.campus_id) {
        await supabase.from("students").update({ campus_id: campusId }).eq("id", existing.id);
      }
    } else {
      const { data: created, error } = await supabase
        .from("students")
        .insert({ email, campus_id: campusId })
        .select("id")
        .single();
      if (error) console.error("[claim-free-beta] student insert:", error);
      studentId = created?.id ?? null;
    }
  } catch (err) {
    console.error("[claim-free-beta] student upsert:", err);
  }

  // Insert student_purchases — skip if already active for this course
  try {
    const { data: existingPurchase } = await supabase
      .from("student_purchases")
      .select("id")
      .eq("email", email)
      .eq("course_id", courseId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!existingPurchase) {
      const { error: purchaseErr } = await supabase
        .from("student_purchases")
        .insert({
          email,
          course_id: courseId,
          purchase_type: "free_beta",
          stripe_session_id: `free-beta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          expires_at: FREE_BETA_EXPIRES_AT,
          lw_enrollment_status: "pending",
          campus_id: campusId,
          student_id: studentId,
          price_paid_cents: 0,
          discount_applied_cents: 0,
        });
      if (purchaseErr) console.error("[claim-free-beta] purchase insert:", purchaseErr);
    }
  } catch (err) {
    console.error("[claim-free-beta] purchase error:", err);
  }

  // Track event (best effort)
  try {
    await supabase.from("student_events").insert({
      email,
      student_id: studentId,
      campus_id: campusId,
      course_slug: courseSlug,
      event_type: "free_beta_claimed",
      event_data: { early_bird_opt_in: !!body.earlyBirdOptIn },
    });
  } catch (err) {
    console.error("[claim-free-beta] event insert:", err);
  }

  // Mark student_emails as converted
  try {
    await supabase.from("student_emails").update({ converted: true }).eq("email", email);
  } catch { /* ignore */ }

  // Ensure auth user, then mint magic link
  let magicLink: string | null = null;
  try {
    const { data: list } = await supabase.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);
    if (!existing) {
      const { error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { source: "free_beta", early_bird_opt_in: !!body.earlyBirdOptIn },
      });
      if (createErr) console.error("[claim-free-beta] create auth user:", createErr);
    }

    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/my-dashboard?free_beta=1")}`;
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (linkErr) console.error("[claim-free-beta] generateLink:", linkErr);
    magicLink = linkData?.properties?.action_link ?? null;
  } catch (err) {
    console.error("[claim-free-beta] auth error:", err);
  }

  return new Response(
    JSON.stringify({ ok: true, magicLink }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
