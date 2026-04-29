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

    return new Response(JSON.stringify({ metrics, feedback }), {
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
