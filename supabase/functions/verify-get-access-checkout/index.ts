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

// EdgeRuntime.waitUntil shim for local dev
// deno-lint-ignore no-explicit-any
const waitUntil = (p: Promise<unknown>) => {
  try {
    // deno-lint-ignore no-explicit-any
    (globalThis as any).EdgeRuntime?.waitUntil?.(p);
  } catch { /* noop */ }
};

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

    // Provision user (fast path: profile lookup, fallback: createUser)
    let userId: string | null = null;
    try {
      const { data: profileRow } = await admin
        .from("profiles")
        .select("user_id")
        .eq("email", cleanEmail)
        .maybeSingle();
      if (profileRow?.user_id) {
        userId = profileRow.user_id as string;
      } else {
        const { data: created, error: createErr } =
          await admin.auth.admin.createUser({
            email: cleanEmail,
            email_confirm: true,
          });
        if (createErr) {
          const { data: linkProbe } = await admin.auth.admin.generateLink({
            type: "magiclink",
            email: cleanEmail,
          });
          userId = linkProbe?.user?.id ?? null;
          if (!userId) throw createErr;
        } else {
          userId = created.user?.id ?? null;
        }
      }
    } catch (err) {
      console.error("[verify-get-access-checkout] user provisioning:", err);
      return bad("Could not provision user account", 500);
    }

    const ua = req.headers.get("user-agent") ?? null;
    const fwd = req.headers.get("x-forwarded-for") ?? "";
    const ip = fwd.split(",")[0]?.trim() || null;

    const md = (session.metadata ?? {}) as Record<string, string>;
    const productType = md.purchase_type || md.selectedPlan || "semester_pass";
    const courseSlug = md.selectedCourse || md.course;

    // Parallelize all independent post-provision work.
    const [linkResult, , campusRowRes, courseRowRes, existingRes] =
      await Promise.all([
        admin.auth.admin.generateLink({ type: "magiclink", email: cleanEmail }),
        userId
          ? admin.from("profiles").upsert(
              {
                user_id: userId,
                email: cleanEmail,
                last_login_at: new Date().toISOString(),
                last_login_ip: ip,
                last_user_agent: ua,
              },
              { onConflict: "user_id" },
            )
          : Promise.resolve({ data: null, error: null }),
        md.campus
          ? admin
              .from("campuses")
              .select("id")
              .eq("slug", md.campus)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        courseSlug
          ? admin
              .from("courses")
              .select("id")
              .eq("slug", courseSlug)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        admin
          .from("student_purchases")
          .select("id, user_id")
          .eq("stripe_session_id", sessionId)
          .maybeSingle(),
      ]);

    let actionLink: string | null = null;
    if (linkResult.error) {
      console.error("[verify-get-access-checkout] magic link:", linkResult.error);
    } else {
      actionLink = linkResult.data?.properties?.action_link ?? null;
    }

    const campusId = (campusRowRes?.data as { id?: string } | null)?.id ?? null;
    const courseId = (courseRowRes?.data as { id?: string } | null)?.id ?? null;
    const existing = existingRes?.data as { id: string; user_id: string | null } | null;

    // Insert purchase (or backfill user_id if webhook beat us)
    if (!existing) {
      const pricePaidCents =
        typeof session.amount_total === "number" ? session.amount_total : null;

      const { error: insertErr } = await admin
        .from("student_purchases")
        .insert({
          email: cleanEmail,
          user_id: userId,
          course_id: courseId,
          chapter_id: null,
          purchase_type: productType,
          stripe_customer_id: (session.customer as string) || null,
          stripe_session_id: sessionId,
          campus_id: campusId,
          price_paid_cents: pricePaidCents,
          lw_enrollment_status: "pending",
        });
      if (insertErr) {
        console.error(
          "[verify-get-access-checkout] purchase insert failed:",
          insertErr,
        );
      }
    } else if (userId && !existing.user_id) {
      await admin
        .from("student_purchases")
        .update({ user_id: userId })
        .eq("id", existing.id);
    }

    // Defer the cross-purchase backfill — not needed for redirect.
    if (userId) {
      waitUntil(
        admin
          .from("student_purchases")
          .update({ user_id: userId })
          .eq("email", cleanEmail)
          .is("user_id", null)
          .then(({ error }) => {
            if (error) {
              console.error(
                "[verify-get-access-checkout] backfill (deferred):",
                error,
              );
            }
          }),
      );
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
    const message = err instanceof Error ? (err as any).message : "Unknown Stripe error";
    console.error("[verify-get-access-checkout]", message);
    return bad(message, 500);
  }
});
