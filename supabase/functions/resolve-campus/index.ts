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
    const domain = cleanEmail.split("@")[1];

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
      // 2. Try HIPOLABS API
      let hipoResult: { name: string } | null = null;
      try {
        const hipoResp = await fetch(
          `https://universities.hipolabs.com/search?domain=${encodeURIComponent(domain)}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (hipoResp.ok) {
          const hipoData = await hipoResp.json();
          if (Array.isArray(hipoData) && hipoData.length > 0 && hipoData[0].name) {
            hipoResult = { name: hipoData[0].name };
          }
        }
      } catch {
        // HIPOLABS unavailable — fall through to general
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
            campusName = "Your School";
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
        // No HIPOLABS result — general fallback
        campusId = "";
        campusSlug = "general";
        campusName = "Your School";
      }
    }

    // Save to student_emails (lead capture) — upsert by email + course_id
    await sb
      .from("student_emails")
      .upsert(
        { email: cleanEmail, course_id: courseId, attempted_at: new Date().toISOString() },
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
