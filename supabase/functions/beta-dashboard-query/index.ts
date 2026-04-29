// Read-only aggregator for the Spring 2026 Beta Dashboard.
// Lee-only; verifies caller email matches a hard-coded allowlist before
// using the service role key to read across feedback tables.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LEE_EMAILS = ["lee@survivestudios.com", "lee@surviveaccounting.com"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1. Auth check using caller's JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    const email = (user?.email ?? "").toLowerCase();
    if (!LEE_EMAILS.includes(email)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { startDate } = await req.json().catch(() => ({ startDate: null }));
    const startISO: string = startDate ?? new Date(Date.now() - 14 * 86400000).toISOString();
    const startDt = new Date(startISO);
    const periodMs = Date.now() - startDt.getTime();
    const prevStartISO = new Date(startDt.getTime() - periodMs).toISOString();

    // Service-role client for reads
    const db = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // ── METRICS ─────────────────────────────────────────────────────
    const [
      signupsCur, signupsPrev, profilesLogins, eventsActive,
      studyOpens, helperClicks, thumbsHelper, thumbsExpl,
      openChapterQ, openIssueRep, cacheLog, ghostUsersRows,
    ] = await Promise.all([
      db.from("student_onboarding").select("id", { count: "exact", head: true })
        .eq("is_legacy", false).gte("created_at", startISO),
      db.from("student_onboarding").select("id", { count: "exact", head: true })
        .eq("is_legacy", false).gte("created_at", prevStartISO).lt("created_at", startISO),
      db.from("profiles").select("user_id", { count: "exact", head: true })
        .gte("last_login_at", startISO),
      db.from("student_events").select("email,session_id").gte("created_at", startISO).limit(5000),
      db.from("student_events").select("event_type", { count: "exact", head: true })
        .ilike("event_type", "%study_tool%").gte("created_at", startISO),
      db.from("ai_request_log").select("tool_type,action_type").gte("created_at", startISO).limit(5000),
      db.from("student_helper_feedback").select("rating").gte("created_at", startISO).limit(5000),
      db.from("explanation_feedback").select("helpful").gte("created_at", startISO).limit(5000),
      db.from("chapter_questions").select("id", { count: "exact", head: true })
        .eq("responded", false).gte("created_at", startISO),
      db.from("problem_issue_reports").select("id", { count: "exact", head: true })
        .gte("created_at", startISO),
      db.from("ai_request_log").select("cache_hit,latency_ms").gte("created_at", startISO).limit(10000),
      db.from("student_onboarding").select("user_id,email")
        .eq("is_legacy", false).gte("created_at", startISO).limit(1000),
    ]);

    const activeSet = new Set<string>();
    (eventsActive.data ?? []).forEach((e: any) => {
      activeSet.add(e.email ?? `anon:${e.session_id ?? "x"}`);
    });

    const toolCounts = new Map<string, number>();
    (helperClicks.data ?? []).forEach((r: any) => {
      const k = r.tool_type ?? "unknown";
      toolCounts.set(k, (toolCounts.get(k) ?? 0) + 1);
    });
    const topTools = Array.from(toolCounts.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const thumbsUp = (thumbsHelper.data ?? []).filter((r: any) => r.rating === 1 || r.rating === "up").length
      + (thumbsExpl.data ?? []).filter((r: any) => r.helpful === true).length;
    const thumbsDown = (thumbsHelper.data ?? []).filter((r: any) => r.rating === -1 || r.rating === 0 || r.rating === "down").length
      + (thumbsExpl.data ?? []).filter((r: any) => r.helpful === false).length;

    const cacheRows = cacheLog.data ?? [];
    const totalCache = cacheRows.length;
    const hits = cacheRows.filter((r: any) => r.cache_hit).length;
    const cacheHitRate = totalCache > 0 ? hits / totalCache : 0;
    const avgLatencyMs = totalCache > 0
      ? Math.round(cacheRows.reduce((s: number, r: any) => s + (r.latency_ms ?? 0), 0) / totalCache)
      : 0;

    // Ghost users: signed up but no events
    const signupEmails = new Set((ghostUsersRows.data ?? []).map((r: any) => r.email?.toLowerCase()).filter(Boolean));
    const activeEmails = new Set<string>();
    (eventsActive.data ?? []).forEach((e: any) => { if (e.email) activeEmails.add(e.email.toLowerCase()); });
    let ghostCount = 0;
    signupEmails.forEach(e => { if (!activeEmails.has(e)) ghostCount++; });

    const metrics = {
      signups: signupsCur.count ?? 0,
      signupsPrev: signupsPrev.count ?? 0,
      logins7d: profilesLogins.count ?? 0,
      activeUsers: activeSet.size,
      studyToolOpens: studyOpens.count ?? 0,
      helperClicks: (helperClicks.data ?? []).length,
      thumbsUp, thumbsDown,
      openFeedback: (openChapterQ.count ?? 0) + (openIssueRep.count ?? 0),
      cacheHitRate, avgLatencyMs,
      ghostUsers: ghostCount,
      topTools,
    };

    // ── FEEDBACK INBOX ──────────────────────────────────────────────
    const [chq, strf, stif, ef, pir, air, cm, cf] = await Promise.all([
      db.from("chapter_questions").select("id,question,student_email,issue_type,asset_name,chapter_id,created_at,responded")
        .gte("created_at", startISO).order("created_at", { ascending: false }).limit(200),
      db.from("study_tool_response_feedback").select("id,feedback_text,rating,course_id,chapter_id,page_url,created_at")
        .gte("created_at", startISO).or("feedback_text.not.is.null,rating.eq.down").limit(200),
      db.from("study_tool_idea_feedback").select("id,suggestion_text,vote,idea_label,course_id,chapter_id,page_url,created_at")
        .gte("created_at", startISO).or("suggestion_text.not.is.null,vote.eq.no").limit(200),
      db.from("explanation_feedback").select("id,note,helpful,reason,asset_name,user_email,created_at")
        .gte("created_at", startISO).or("note.not.is.null,helpful.eq.false").limit(200),
      db.from("problem_issue_reports").select("id,note,issue_types,asset_name,user_email,created_at")
        .gte("created_at", startISO).limit(200),
      db.from("asset_issue_reports").select("id,message,asset_name,reporter_email,created_at")
        .gte("created_at", startISO).limit(200),
      db.from("contact_messages").select("id,message,email,subject,name,created_at")
        .gte("created_at", startISO).limit(200),
      db.from("cram_feedback").select("id,content_type,chapter_id,created_at")
        .gte("created_at", startISO).eq("content_type", "get_in_touch").limit(200),
    ]);

    const feedback: any[] = [];
    (chq.data ?? []).forEach((r: any) => feedback.push({
      id: r.id, source: "chapter_questions", text: r.question ?? "(empty)",
      email: r.student_email, course: null, chapter: r.chapter_id, pageUrl: null,
      createdAt: r.created_at, addressed: !!r.responded,
    }));
    (strf.data ?? []).forEach((r: any) => feedback.push({
      id: r.id, source: "study_tool_response_feedback", text: r.feedback_text ?? `[${r.rating}]`,
      email: null, course: r.course_id, chapter: r.chapter_id, pageUrl: r.page_url,
      createdAt: r.created_at, rating: r.rating,
    }));
    (stif.data ?? []).forEach((r: any) => feedback.push({
      id: r.id, source: "study_tool_idea_feedback",
      text: r.suggestion_text ?? `[vote: ${r.vote}] ${r.idea_label ?? ""}`,
      email: null, course: r.course_id, chapter: r.chapter_id, pageUrl: r.page_url,
      createdAt: r.created_at, rating: r.vote,
    }));
    (ef.data ?? []).forEach((r: any) => feedback.push({
      id: r.id, source: "explanation_feedback",
      text: r.note ?? `Marked ${r.helpful ? "helpful" : "not helpful"}: ${(r.reason ?? []).join(", ")}`,
      email: r.user_email, course: null, chapter: null, pageUrl: r.asset_name ? `/solutions/${r.asset_name}` : null,
      createdAt: r.created_at, rating: r.helpful ? "up" : "down",
    }));
    (pir.data ?? []).forEach((r: any) => feedback.push({
      id: r.id, source: "problem_issue_reports",
      text: r.note ?? `Issues: ${(r.issue_types ?? []).join(", ")}`,
      email: r.user_email, course: null, chapter: null,
      pageUrl: r.asset_name ? `/solutions/${r.asset_name}` : null, createdAt: r.created_at,
    }));
    (air.data ?? []).forEach((r: any) => feedback.push({
      id: r.id, source: "asset_issue_reports", text: r.message ?? "(empty)",
      email: r.reporter_email, course: null, chapter: null,
      pageUrl: r.asset_name ? `/solutions/${r.asset_name}` : null, createdAt: r.created_at,
    }));
    (cm.data ?? []).forEach((r: any) => feedback.push({
      id: r.id, source: "contact_messages", text: `${r.subject ? r.subject + ": " : ""}${r.message ?? ""}`,
      email: r.email, course: null, chapter: null, pageUrl: null, createdAt: r.created_at,
    }));
    (cf.data ?? []).forEach((r: any) => feedback.push({
      id: r.id, source: "cram_feedback", text: `Get in touch from cram tool`,
      email: null, course: null, chapter: r.chapter_id, pageUrl: null, createdAt: r.created_at,
    }));

    feedback.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // ── STUDENT SIGNUPS ─────────────────────────────────────────────
    // Full beta signup list (not range-limited) with campus, course, profile,
    // engagement counts, and paid status.
    const BETA_START_ISO = "2026-04-01T00:00:00Z";
    const [signupRows, campusRows, courseRows] = await Promise.all([
      db.from("student_onboarding")
        .select("user_id,email,display_name,campus_id,course_id,beta_number,campus_beta_number,confidence_1_10,is_in_greek_life,greek_org_other,syllabus_file_path,welcomed_at,completed_at,created_at")
        .eq("is_legacy", false)
        .order("created_at", { ascending: false })
        .limit(2000),
      db.from("campuses").select("id,name,slug"),
      db.from("courses").select("id,course_name,code,slug"),
    ]);

    const campusMap = new Map<string, any>((campusRows.data ?? []).map((c: any) => [c.id, c]));
    const courseMap = new Map<string, any>((courseRows.data ?? []).map((c: any) => [c.id, c]));

    const signupEmailsArr = Array.from(
      new Set((signupRows.data ?? []).map((r: any) => (r.email ?? "").toLowerCase()).filter(Boolean))
    );
    const signupUserIds = (signupRows.data ?? []).map((r: any) => r.user_id).filter(Boolean);

    const [profileRows, purchaseRows, eventRows] = await Promise.all([
      signupUserIds.length
        ? db.from("profiles").select("user_id,last_login_at").in("user_id", signupUserIds)
        : Promise.resolve({ data: [] as any[] }),
      signupEmailsArr.length
        ? db.from("student_purchases")
            .select("email,purchase_type,price_paid_cents,created_at,expires_at")
            .in("email", signupEmailsArr)
        : Promise.resolve({ data: [] as any[] }),
      signupEmailsArr.length
        ? db.from("student_events")
            .select("email,event_type,created_at")
            .in("email", signupEmailsArr)
            .gte("created_at", BETA_START_ISO)
            .limit(50000)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const profileMap = new Map<string, any>((profileRows.data ?? []).map((p: any) => [p.user_id, p]));
    const purchaseMap = new Map<string, any>();
    (purchaseRows.data ?? []).forEach((p: any) => {
      const k = (p.email ?? "").toLowerCase();
      const existing = purchaseMap.get(k);
      if (!existing || new Date(p.created_at) > new Date(existing.created_at)) {
        purchaseMap.set(k, p);
      }
    });

    type EvCounts = { logins: number; toolOpens: number; helperClicks: number; total: number; lastEventAt: string | null };
    const eventMap = new Map<string, EvCounts>();
    (eventRows.data ?? []).forEach((e: any) => {
      const k = (e.email ?? "").toLowerCase();
      if (!k) return;
      const c = eventMap.get(k) ?? { logins: 0, toolOpens: 0, helperClicks: 0, total: 0, lastEventAt: null };
      c.total += 1;
      const t = String(e.event_type ?? "");
      if (t === "login" || t === "session_start" || t === "magic_link_login") c.logins += 1;
      if (t.includes("study_tool") || t.startsWith("tool_")) c.toolOpens += 1;
      if (t.includes("helper")) c.helperClicks += 1;
      if (!c.lastEventAt || new Date(e.created_at) > new Date(c.lastEventAt)) c.lastEventAt = e.created_at;
      eventMap.set(k, c);
    });

    const signups = (signupRows.data ?? []).map((r: any) => {
      const k = (r.email ?? "").toLowerCase();
      const campus = r.campus_id ? campusMap.get(r.campus_id) : null;
      const course = r.course_id ? courseMap.get(r.course_id) : null;
      const profile = r.user_id ? profileMap.get(r.user_id) : null;
      const purchase = purchaseMap.get(k) ?? null;
      const ev = eventMap.get(k) ?? { logins: 0, toolOpens: 0, helperClicks: 0, total: 0, lastEventAt: null };
      return {
        userId: r.user_id,
        email: r.email,
        displayName: r.display_name,
        campusId: r.campus_id,
        campusName: campus?.name ?? null,
        campusSlug: campus?.slug ?? null,
        courseId: r.course_id,
        courseName: course?.course_name ?? null,
        courseCode: course?.code ?? null,
        courseSlug: course?.slug ?? null,
        betaNumber: r.beta_number,
        campusBetaNumber: r.campus_beta_number,
        confidence: r.confidence_1_10,
        greek: r.is_in_greek_life ? (r.greek_org_other ?? "yes") : null,
        hasSyllabus: !!r.syllabus_file_path,
        welcomedAt: r.welcomed_at,
        completedAt: r.completed_at,
        createdAt: r.created_at,
        lastLoginAt: profile?.last_login_at ?? null,
        lastEventAt: ev.lastEventAt,
        logins: ev.logins,
        toolOpens: ev.toolOpens,
        helperClicks: ev.helperClicks,
        totalEvents: ev.total,
        paid: !!purchase,
        purchaseType: purchase?.purchase_type ?? null,
        pricePaidCents: purchase?.price_paid_cents ?? null,
        purchasedAt: purchase?.created_at ?? null,
      };
    });

    return new Response(JSON.stringify({ metrics, feedback, signups }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("beta-dashboard-query error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
