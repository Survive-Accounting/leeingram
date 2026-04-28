// Background LearnWorlds enrollment.
// Called fire-and-forget after login or checkout. Returns 202 immediately;
// the actual LW API calls run via EdgeRuntime.waitUntil so the client never waits.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// deno-lint-ignore no-explicit-any
const waitUntil = (p: Promise<unknown>) => {
  try {
    // deno-lint-ignore no-explicit-any
    (globalThis as any).EdgeRuntime?.waitUntil?.(p);
  } catch { /* noop */ }
};

async function enrollOne(
  supabase: ReturnType<typeof createClient>,
  email: string,
  purchase: { id: string; course_id: string; lw_enrollment_status: string | null },
) {
  if (purchase.lw_enrollment_status === "enrolled") return;

  const lwApiKey = Deno.env.get("LW_API_KEY");
  const lwBaseUrl = Deno.env.get("LW_BASE_URL");
  if (!lwApiKey || !lwBaseUrl) {
    console.error("[enroll-lw-background] LW env not configured");
    return;
  }

  try {
    // Ensure LW user exists (idempotent — LW returns 409 if already exists)
    const userRes = await fetch(`${lwBaseUrl}/v2/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lwApiKey}`,
        "Lw-Client": lwApiKey,
      },
      body: JSON.stringify({ email }),
    });
    console.log(
      `[enroll-lw-background] LW user upsert: ${userRes.status} for ${email}`,
    );

    // Look up course slug -> LW courseId
    const { data: course } = await supabase
      .from("courses")
      .select("slug")
      .eq("id", purchase.course_id)
      .single();

    if (!course?.slug) {
      console.error(
        `[enroll-lw-background] No course slug for course_id ${purchase.course_id}`,
      );
      await supabase
        .from("student_purchases")
        .update({ lw_enrollment_status: "failed" })
        .eq("id", purchase.id);
      return;
    }

    const enrollRes = await fetch(
      `${lwBaseUrl}/v2/users/${encodeURIComponent(email)}/enrollment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${lwApiKey}`,
          "Lw-Client": lwApiKey,
        },
        body: JSON.stringify({ courseId: course.slug }),
      },
    );

    const body = await enrollRes.text();
    console.log(
      `[enroll-lw-background] enrollment: ${enrollRes.status} for ${email}/${course.slug}`,
    );

    if (enrollRes.ok || enrollRes.status === 409) {
      let enrollmentId: string | null = null;
      try {
        const parsed = JSON.parse(body);
        enrollmentId = parsed.id || parsed.enrollment_id || null;
      } catch { /* noop */ }
      await supabase
        .from("student_purchases")
        .update({
          lw_enrollment_status: "enrolled",
          lw_enrollment_id: enrollmentId,
        })
        .eq("id", purchase.id);
    } else {
      await supabase
        .from("student_purchases")
        .update({ lw_enrollment_status: "failed" })
        .eq("id", purchase.id);
    }
  } catch (err) {
    console.error("[enroll-lw-background] error:", err);
    try {
      await supabase
        .from("student_purchases")
        .update({ lw_enrollment_status: "failed" })
        .eq("id", purchase.id);
    } catch { /* noop */ }
  }
}

async function processEmail(email: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: purchases, error } = await supabase
    .from("student_purchases")
    .select("id, course_id, lw_enrollment_status, expires_at")
    .eq("email", email)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString());

  if (error) {
    console.error("[enroll-lw-background] purchase lookup:", error);
    return;
  }
  if (!purchases || purchases.length === 0) {
    console.log(`[enroll-lw-background] no active purchases for ${email}`);
    return;
  }

  for (const p of purchases) {
    if (!p.course_id) continue;
    await enrollOne(supabase, email, p as any);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return new Response(JSON.stringify({ error: "Valid email required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Kick off in background, return 202 immediately.
  waitUntil(processEmail(email));

  return new Response(
    JSON.stringify({ accepted: true }),
    { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
