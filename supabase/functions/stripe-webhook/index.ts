import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const BYPASS_BASE_EMAILS = [
  "lee@survivestudios.com",
  "jking.cim@gmail.com",
];

function isTestEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  const normalized = lower.replace(/\+[^@]*@/, "@");
  return BYPASS_BASE_EMAILS.includes(normalized);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const body = await req.text();

  // Verify webhook signature — use the LIVE key for constructing events
  // (Stripe webhook endpoints receive events from one mode; the webhook secret handles verification)
  let event: Stripe.Event;
  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY_LIVE")!, {
      apiVersion: "2024-12-18.acacia",
    });
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    // If LIVE key fails, try TEST key (for test mode webhooks with separate endpoint)
    try {
      const testKey = Deno.env.get("STRIPE_SECRET_KEY_TEST");
      if (testKey) {
        const stripeTest = new Stripe(testKey, { apiVersion: "2024-12-18.acacia" });
        event = await stripeTest.webhooks.constructEventAsync(body, signature, webhookSecret);
      } else {
        throw err;
      }
    } catch {
      console.error("Webhook signature verification failed:", err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }
  }

  // Only handle checkout.session.completed
  if (event.type !== "checkout.session.completed") {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = session.metadata || {};
  const email = metadata.email;
  const course_id = metadata.course_id;
  const chapter_id = metadata.chapter_id || null;
  const product_type = metadata.product_type;

  if (!email || !course_id || !product_type) {
    console.error("Missing metadata on checkout session:", session.id);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ── Resolve campus ──
  let campusId = metadata.campus_id || null;
  const campusSlug = metadata.campus_slug || null;
  const originalPriceCents = metadata.original_price_cents ? parseInt(metadata.original_price_cents) : null;
  const discountAppliedCents = metadata.discount_applied_cents ? parseInt(metadata.discount_applied_cents) : 0;
  const pricePaidCents = session.amount_total || null;

  if (!campusId && campusSlug) {
    console.log("Resolving campus_id from slug:", campusSlug);
    const { data: campus } = await supabase
      .from("campuses")
      .select("id")
      .eq("slug", campusSlug)
      .maybeSingle();
    if (campus) {
      campusId = campus.id;
      console.log("Resolved campus_id:", campusId);
    } else {
      console.log("Campus not found for slug:", campusSlug);
    }
  }

  // ── Upsert student record ──
  let studentId: string | null = null;
  try {
    const stripeCustomerId = (session.customer as string) || null;

    const { data: existingStudent } = await supabase
      .from("students")
      .select("id, campus_id")
      .eq("email", email)
      .maybeSingle();

    if (existingStudent) {
      studentId = existingStudent.id;
      const updates: Record<string, unknown> = {};
      if (stripeCustomerId) updates.stripe_customer_id = stripeCustomerId;
      if (campusId && !existingStudent.campus_id) updates.campus_id = campusId;

      if (Object.keys(updates).length > 0) {
        await supabase.from("students").update(updates).eq("id", studentId);
        console.log("Updated student:", studentId, updates);
      }
    } else {
      const { data: newStudent, error: studentErr } = await supabase
        .from("students")
        .insert({
          email,
          campus_id: campusId,
        })
        .select("id")
        .single();

      if (studentErr) {
        console.error("Failed to insert student:", studentErr);
      } else {
        studentId = newStudent.id;
        console.log("Created student:", studentId);
      }
    }
  } catch (err) {
    console.error("Student upsert error:", err);
  }

  // ── Step 1: Insert student_purchases ──
  let purchaseId: string | null = null;
  try {
    const { data: purchase, error: purchaseErr } = await supabase
      .from("student_purchases")
      .insert({
        email,
        course_id,
        chapter_id: chapter_id || null,
        purchase_type: product_type,
        stripe_customer_id: (session.customer as string) || null,
        stripe_session_id: session.id,
        expires_at: "2026-05-16T23:59:59Z",
        lw_enrollment_status: "pending",
        campus_id: campusId,
        student_id: studentId,
        price_paid_cents: pricePaidCents,
        discount_applied_cents: discountAppliedCents || 0,
      })
      .select("id")
      .single();

    if (purchaseErr) {
      console.error("Failed to insert student_purchases:", purchaseErr);
    } else {
      purchaseId = purchase.id;
      console.log("Purchase recorded:", purchaseId, { campusId, studentId, pricePaidCents });
    }
  } catch (err) {
    console.error("student_purchases insert error:", err);
  }

  // ── Step 2: Update student_emails converted flag ──
  try {
    const { error: updateErr } = await supabase
      .from("student_emails")
      .update({ converted: true })
      .eq("email", email)
      .eq("course_id", course_id);

    if (updateErr) {
      console.error("Failed to update student_emails:", updateErr);
    } else {
      console.log("student_emails marked converted for:", email);
    }
  } catch (err) {
    console.error("student_emails update error:", err);
  }

  // ── Step 3: Enroll in LearnWorlds ──
  try {
    const lwApiKey = Deno.env.get("LW_API_KEY");
    const lwBaseUrl = Deno.env.get("LW_BASE_URL");

    if (lwApiKey && lwBaseUrl) {
      const userRes = await fetch(`${lwBaseUrl}/v2/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${lwApiKey}`,
          "Lw-Client": lwApiKey,
        },
        body: JSON.stringify({ email }),
      });

      const userBody = await userRes.text();
      console.log("LW user create response:", userRes.status, userBody);

      const { data: course } = await supabase
        .from("courses")
        .select("slug")
        .eq("id", course_id)
        .single();

      if (course?.slug) {
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
          }
        );

        const enrollBody = await enrollRes.text();
        console.log("LW enrollment response:", enrollRes.status, enrollBody);

        if (purchaseId) {
          if (enrollRes.ok) {
            let enrollmentId = null;
            try {
              const parsed = JSON.parse(enrollBody);
              enrollmentId = parsed.id || parsed.enrollment_id || null;
            } catch { /* ignore parse errors */ }

            await supabase
              .from("student_purchases")
              .update({
                lw_enrollment_status: "enrolled",
                lw_enrollment_id: enrollmentId,
              })
              .eq("id", purchaseId);
          } else {
            await supabase
              .from("student_purchases")
              .update({ lw_enrollment_status: "failed" })
              .eq("id", purchaseId);
          }
        }
      } else {
        console.error("Could not find course slug for course_id:", course_id);
        if (purchaseId) {
          await supabase
            .from("student_purchases")
            .update({ lw_enrollment_status: "failed" })
            .eq("id", purchaseId);
        }
      }
    } else {
      console.error("LW_API_KEY or LW_BASE_URL not configured");
      if (purchaseId) {
        await supabase
          .from("student_purchases")
          .update({ lw_enrollment_status: "failed" })
          .eq("id", purchaseId);
      }
    }
  } catch (err) {
    console.error("LearnWorlds enrollment error:", err);
    if (purchaseId) {
      try {
        await supabase
          .from("student_purchases")
          .update({ lw_enrollment_status: "failed" })
          .eq("id", purchaseId);
      } catch { /* ignore */ }
    }
  }

  // ── Step 4: Create auth user & send welcome email via Resend ──
  try {
    // Create or find Supabase auth user (for magic link login later)
    const { data: authUser } = await supabase.auth.admin.listUsers();
    const existingAuthUser = authUser?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!existingAuthUser) {
      // Create auth user with a random password (they'll use magic link to log in)
      const { error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { source: "stripe_purchase" },
      });
      if (createErr) {
        console.error("Failed to create auth user:", createErr);
      } else {
        console.log("Created auth user for:", email);
      }
    }

    // Generate OTP magic link for the welcome email
    const { data: otpData, error: otpErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: "https://learn.surviveaccounting.com/auth/callback",
      },
    });

    let magicLink = "";
    if (otpErr) {
      console.error("Failed to generate magic link:", otpErr);
    } else if (otpData?.properties?.action_link) {
      magicLink = otpData.properties.action_link;
      console.log("Generated magic link for:", email);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const emailHtml = buildWelcomeEmail(email, magicLink);

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "Survive Accounting <lee@mail.surviveaccounting.com>",
          to: [email],
          subject: "You're in — here's your login link",
          html: emailHtml,
          reply_to: "lee@surviveaccounting.com",
        }),
      });

      const resendBody = await resendRes.text();
      console.log("Resend response:", resendRes.status, resendBody);
    } else {
      console.error("RESEND_API_KEY not configured, skipping welcome email");
    }
  } catch (err) {
    console.error("Auth user / email error:", err);
  }

  // Always return 200 to Stripe
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

function buildWelcomeEmail(email: string, magicLink: string): string {
  const buttonHtml = magicLink
    ? `<a href="${magicLink}" style="display:inline-block;background-color:#CE1126;color:#ffffff;font-family:Inter,Arial,sans-serif;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;margin:24px 0;">Log In to Survive Accounting</a>`
    : `<p style="color:#666;font-size:14px;">We're setting up your account — you'll receive a login link shortly.</p>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F8F9FA;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F9FA;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background-color:#14213D;padding:28px 32px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-family:'DM Serif Display',Georgia,serif;font-size:22px;font-weight:400;">
            Welcome to Survive Accounting
          </h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#14213D;font-size:15px;line-height:1.6;">
            Your Study Pass is confirmed! You now have full access to practice problems, explanations, and study tools.
          </p>
          <div style="text-align:center;">
            ${buttonHtml}
          </div>
          ${magicLink ? `<p style="margin:16px 0 0;color:#888;font-size:12px;text-align:center;">This link expires in 24 hours.</p>` : ''}
          <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">
          <p style="margin:0;color:#666;font-size:13px;line-height:1.5;">
            Questions? Just reply to this email — I read every message.<br>
            — Lee
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
