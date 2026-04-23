import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function addMonths(date: Date, months: number): string {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const { email, course_slug } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Valid email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!course_slug || typeof course_slug !== "string") {
      return new Response(
        JSON.stringify({ error: "course_slug is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const isTestMode = cleanEmail.startsWith("satest@");
    // Test bypass: lee+anything@survivestudios.com is treated as if it were @olemiss.edu
    const isLeeTestEmail = /^lee\+[^@]+@survivestudios\.com$/.test(cleanEmail);
    const domain = isLeeTestEmail ? "olemiss.edu" : cleanEmail.split("@")[1];

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_LIVE") ?? Deno.env.get("STRIPE_SECRET_KEY_TEST");
    const stripeKeyTest = Deno.env.get("STRIPE_SECRET_KEY_TEST");

    async function createStripeCoupon(key: string, code: string, name: string, percent: number): Promise<string | null> {
      try {
        const body = new URLSearchParams({
          id: code,
          name,
          percent_off: String(percent),
          duration: "once",
        });
        const r = await fetch("https://api.stripe.com/v1/coupons", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
        if (r.ok) {
          const j = await r.json();
          return j.id as string;
        }
        // Already exists
        if (r.status === 400) {
          const j = await r.json().catch(() => null);
          if (j?.error?.code === "resource_already_exists") return code;
        }
        console.error("Stripe coupon create failed", r.status, await r.text());
        return null;
      } catch (e) {
        console.error("Stripe coupon create error", e);
        return null;
      }
    }

    async function ensureFoundingCoupon(campusSlug: string, campusName: string, campusId: string) {
      const code = `FOUNDING_${campusSlug.toUpperCase().replace(/-/g, "_")}`;
      const { data: existing } = await sb.from("coupons").select("*").eq("code", code).maybeSingle();
      if (existing) return existing;

      let liveId: string | null = null;
      let testId: string | null = null;
      if (stripeKey) liveId = await createStripeCoupon(stripeKey, code, `Founding Student — ${campusName}`, 50);
      if (stripeKeyTest && stripeKeyTest !== stripeKey) {
        testId = await createStripeCoupon(stripeKeyTest, code, `Founding Student — ${campusName}`, 50);
      } else if (stripeKeyTest === stripeKey) {
        testId = liveId;
      }

      const validUntil = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const { data: inserted } = await sb
        .from("coupons")
        .insert({
          code,
          name: `Founding Student — ${campusName}`,
          type: "campus",
          discount_percent: 50,
          applicable_to: "all",
          university_id: campusId,
          valid_until: validUntil,
          stripe_coupon_id_live: liveId,
          stripe_coupon_id_test: testId,
          priority: 50,
          is_active: true,
        })
        .select()
        .maybeSingle();
      return inserted;
    }

    // Resolve course_id from slug
    const { data: course, error: courseErr } = await sb
      .from("courses")
      .select("id")
      .eq("slug", course_slug)
      .maybeSingle();

    if (courseErr || !course) {
      return new Response(
        JSON.stringify({ error: "Course not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const courseId = course.id;

    // 0. Check email_campus_overrides first
    const { data: override } = await sb
      .from("email_campus_overrides")
      .select("campus_id, note")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (override) {
      const { data: overrideCampus } = await sb
        .from("campuses")
        .select("id, slug, name")
        .eq("id", override.campus_id)
        .single();

      if (overrideCampus) {
        console.log(`Override match: ${cleanEmail} → ${overrideCampus.slug} (${override.note})`);

        // Save lead + student record
        await sb.from("student_emails").upsert(
          { email: cleanEmail, course_id: courseId, attempted_at: new Date().toISOString() },
          { onConflict: "email,course_id" }
        );
        const { data: existingStudent } = await sb.from("students").select("id").eq("email", cleanEmail).maybeSingle();
        if (!existingStudent) {
          await sb.from("students").insert({ email: cleanEmail, campus_id: overrideCampus.id });
        }

        return new Response(
          JSON.stringify({
            campus_slug: overrideCampus.slug,
            campus_name: overrideCampus.name,
            is_new: false,
            source: "override",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 1. Check if domain matches an existing campus
    const { data: existingCampuses } = await sb
      .from("campuses")
      .select("id, slug, name")
      .contains("domains", [domain]);

    let campusId: string;
    let campusSlug: string;
    let campusName: string;
    let isNew = false;

    if (existingCampuses && existingCampuses.length > 0) {
      const campus = existingCampuses[0];
      campusId = campus.id;
      campusSlug = campus.slug;
      campusName = campus.name;
    } else {
      // 2. Try HIPOLABS API, then fall back to domain-based name
      let hipoResult: { name: string } | null = null;
      try {
        const hipoResp = await fetch(
          `http://universities.hipolabs.com/search?domain=${encodeURIComponent(domain)}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (hipoResp.ok) {
          const hipoData = await hipoResp.json();
          if (Array.isArray(hipoData) && hipoData.length > 0 && hipoData[0].name) {
            hipoResult = { name: hipoData[0].name };
          }
        }
      } catch {
        // HIPOLABS unavailable — fall through to domain-based fallback
      }

      // If HIPOLABS failed/returned nothing but domain is .edu, derive a name
      if (!hipoResult && domain.endsWith(".edu")) {
        const baseName = domain.replace(/\.edu$/, "").split(".").pop() || "";
        if (baseName.length >= 2) {
          // Capitalize: "lsu" → "LSU" (if ≤4 chars, treat as acronym), else title-case
          const displayName = baseName.length <= 4
            ? baseName.toUpperCase()
            : baseName.charAt(0).toUpperCase() + baseName.slice(1);
          hipoResult = { name: displayName };
          console.log(`HIPOLABS unavailable — derived campus name "${displayName}" from domain ${domain}`);
        }
      }

      if (hipoResult) {
        // Create new campus
        const newSlug = slugify(hipoResult.name);
        const today = new Date();
        const semesterEnd = addMonths(today, 4);

        const { data: newCampus, error: insertErr } = await sb
          .from("campuses")
          .insert({
            name: hipoResult.name,
            slug: newSlug,
            domains: [domain],
            is_active: true,
            semester_start: today.toISOString().split("T")[0],
            semester_end: semesterEnd,
          })
          .select("id, slug, name")
          .single();

        if (insertErr) {
          // Slug conflict — try with domain suffix
          const fallbackSlug = `${newSlug}-${domain.split(".")[0]}`;
          const { data: retried, error: retryErr } = await sb
            .from("campuses")
            .insert({
              name: hipoResult.name,
              slug: fallbackSlug,
              domains: [domain],
              is_active: true,
              semester_start: today.toISOString().split("T")[0],
              semester_end: semesterEnd,
            })
            .select("id, slug, name")
            .single();

          if (retryErr || !retried) {
            // Can't create — use general fallback
            campusId = "";
            campusSlug = "general";
            campusName = "Survive Accounting";
          } else {
            campusId = retried.id;
            campusSlug = retried.slug;
            campusName = retried.name;
            isNew = true;
          }
        } else {
          campusId = newCampus!.id;
          campusSlug = newCampus!.slug;
          campusName = newCampus!.name;
          isNew = true;
        }

        // Link course to new campus
        if (isNew && campusId) {
          await sb
            .from("campus_courses")
            .insert({ campus_id: campusId, course_id: courseId })
            .select()
            .maybeSingle();
        }
      } else {
        // No HIPOLABS result and not a .edu — general fallback
        campusId = "";
        campusSlug = "general";
        campusName = "Survive Accounting";
      }
    }

    // If we landed on the general fallback, hydrate campusId from the real row.
    if (!campusId && campusSlug === "general") {
      const { data: generalCampus } = await sb
        .from("campuses")
        .select("id, name")
        .eq("slug", "general")
        .maybeSingle();
      if (generalCampus) {
        campusId = generalCampus.id;
        campusName = generalCampus.name;
      }
    }

    // Determine paid student count + founding status
    let paidCount = 0;
    let mascotCheer: string | null = null;
    let foundingStudent = false;
    let foundingCouponCode: string | null = null;

    if (campusId) {
      const { count } = await sb
        .from("student_purchases")
        .select("email", { count: "exact", head: true })
        .eq("campus_id", campusId);
      paidCount = count ?? 0;

      const { data: campusRow } = await sb
        .from("campuses")
        .select("mascot_cheer")
        .eq("id", campusId)
        .maybeSingle();
      mascotCheer = (campusRow as any)?.mascot_cheer ?? null;

      // Founding = first paid student at a non-Ole-Miss campus with zero paid purchases yet
      if (paidCount === 0 && campusSlug !== "ole-miss" && campusSlug !== "general") {
        foundingStudent = true;
        const couponRow = await ensureFoundingCoupon(campusSlug, campusName, campusId);
        if (couponRow) foundingCouponCode = (couponRow as any).code;
      }
    }

    // Save to student_emails (lead capture) — upsert by email + course_id
    await sb
      .from("student_emails")
      .upsert(
        {
          email: cleanEmail,
          course_id: courseId,
          attempted_at: new Date().toISOString(),
          founding_student: foundingStudent,
        } as any,
        { onConflict: "email,course_id" }
      );

    // Create student record if doesn't exist
    if (campusId) {
      const { data: existingStudent } = await sb
        .from("students")
        .select("id")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (!existingStudent) {
        await sb.from("students").insert({
          email: cleanEmail,
          campus_id: campusId,
        });
      }
    }

    return new Response(
      JSON.stringify({
        campus_slug: campusSlug,
        campus_name: campusName,
        is_new: isNew,
        is_test_mode: isTestMode,
        email_override: isTestMode ? "lee@surviveaccounting.com" : null,
        paid_student_count: paidCount,
        student_number: paidCount + 1,
        mascot_cheer: mascotCheer,
        founding_student: foundingStudent,
        founding_coupon_code: foundingCouponCode,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("resolve-campus error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
