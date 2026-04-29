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

    // "Today" window in UTC for daily counters.
    const now = new Date();
    const todayStartISO = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    const sevenDaysAgoISO = new Date(now.getTime() - 7 * 86400000).toISOString();

    // Service-role client for reads
    const db = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Event name constants (mirrors src/lib/betaEvents.ts).
    const EV = {
      LOGIN_COMPLETED: "login_completed",
      BETA_DASHBOARD_VIEWED: "beta_dashboard_viewed",
      CHAPTER_SELECTED: "chapter_selected",
      PRACTICE_HELPER_OPENED: "practice_problem_helper_opened",
      JE_HELPER_OPENED: "journal_entry_helper_opened",
      HELPER_ACTION_CLICKED: "helper_action_clicked",
      FEEDBACK_SUBMITTED: "feedback_submitted",
      FEATURE_SUGGESTION_SUBMITTED: "feature_suggestion_submitted",
      PROBLEM_REPORT_SUBMITTED: "problem_report_submitted",
    };
    const HELPER_OPEN_NAMES = [EV.PRACTICE_HELPER_OPENED, EV.JE_HELPER_OPENED];
    const FEEDBACK_SUBMIT_NAMES = [
      EV.FEEDBACK_SUBMITTED, EV.FEATURE_SUGGESTION_SUBMITTED, EV.PROBLEM_REPORT_SUBMITTED,
    ];
    const LOGIN_NAMES = [EV.LOGIN_COMPLETED, "magic_link_login", "session_start"];

    // Helper for distinct-actor counts on student_events.
    const distinctActor = (rows: any[]) => {
      const s = new Set<string>();
      rows.forEach(r => {
        const k = (r.email ?? "").toLowerCase() || (r.session_id ? `s:${r.session_id}` : "");
        if (k) s.add(k);
      });
      return s.size;
    };

    // ── METRICS + FUNNEL FETCHES ────────────────────────────────────
    const [
      signupsRange, signupsPrev, signupsToday, signupsTotal,
      eventsRange, eventsToday, events7d,
      thumbsHelper, thumbsExpl, openChapterQ, openIssueRep,
      cacheLog, allSignupsForGhost,
    ] = await Promise.all([
      db.from("student_onboarding").select("id", { count: "exact", head: true })
        .eq("is_legacy", false).gte("created_at", startISO),
      db.from("student_onboarding").select("id", { count: "exact", head: true })
        .eq("is_legacy", false).gte("created_at", prevStartISO).lt("created_at", startISO),
      db.from("student_onboarding").select("id", { count: "exact", head: true })
        .eq("is_legacy", false).gte("created_at", todayStartISO),
      db.from("student_onboarding").select("id", { count: "exact", head: true })
        .eq("is_legacy", false),
      db.from("student_events").select("email,session_id,event_type,created_at")
        .gte("created_at", startISO).limit(20000),
      db.from("student_events").select("email,session_id,event_type")
        .gte("created_at", todayStartISO).limit(10000),
      db.from("student_events").select("email,session_id,event_type")
        .gte("created_at", sevenDaysAgoISO).limit(20000),
      db.from("student_helper_feedback").select("rating").gte("created_at", startISO).limit(5000),
      db.from("explanation_feedback").select("helpful").gte("created_at", startISO).limit(5000),
      db.from("chapter_questions").select("id", { count: "exact", head: true })
        .eq("responded", false).gte("created_at", startISO),
      db.from("problem_issue_reports").select("id", { count: "exact", head: true })
        .gte("created_at", startISO),
      db.from("ai_request_log").select("cache_hit,latency_ms,tool_type").gte("created_at", startISO).limit(20000),
      db.from("student_onboarding").select("user_id,email")
        .eq("is_legacy", false).limit(2000),
    ]);

    const evRangeRows = eventsRange.data ?? [];
    const evTodayRows = eventsToday.data ?? [];
    const ev7dRows = events7d.data ?? [];

    // Event-name index for the range window (powers funnel + several cards).
    const byName = new Map<string, any[]>();
    evRangeRows.forEach(r => {
      const arr = byName.get(r.event_type) ?? [];
      arr.push(r);
      byName.set(r.event_type, arr);
    });
    const rowsFor = (names: string[]) => names.flatMap(n => byName.get(n) ?? []);

    // ── DAILY + 7-DAY COUNTS ────────────────────────────────────────
    const loginsTodayRows = evTodayRows.filter(r => LOGIN_NAMES.includes(r.event_type));
    const loginsToday = distinctActor(loginsTodayRows);
    const activeUsersToday = distinctActor(evTodayRows);
    const activeUsers7d = distinctActor(ev7dRows);

    // ── RANGE-SCOPED EVENT-DRIVEN METRICS ───────────────────────────
    const chapterSelectedRows = rowsFor([EV.CHAPTER_SELECTED]);
    const studentsSelectedChapter = distinctActor(chapterSelectedRows);

    const helperOpenRowsRange = rowsFor(HELPER_OPEN_NAMES);
    const studentsOpenedHelper = distinctActor(helperOpenRowsRange);

    // Helper clicks: prefer the standardized event; fall back to ai_request_log volume.
    const helperActionRows = rowsFor([EV.HELPER_ACTION_CLICKED]);
    const helperClicksRange = helperActionRows.length > 0
      ? helperActionRows.length
      : (cacheLog.data ?? []).length;

    // Study tool opens: helper opens + any legacy "study_tool_*" event names.
    const legacyStudyToolRows = evRangeRows.filter(r => /study_tool|^tool_/.test(r.event_type));
    const studyToolOpens = helperOpenRowsRange.length + legacyStudyToolRows.length;

    // Feedback submissions: prefer the standardized events; supplement with
    // raw submission tables already used by the inbox.
    const feedbackEventRows = rowsFor(FEEDBACK_SUBMIT_NAMES);
    const feedbackSubmissionsCount = feedbackEventRows.length;

    // ── THUMBS / CACHE / GHOSTS ─────────────────────────────────────
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

    const toolCounts = new Map<string, number>();
    cacheRows.forEach((r: any) => {
      const k = r.tool_type ?? "unknown";
      toolCounts.set(k, (toolCounts.get(k) ?? 0) + 1);
    });
    const topTools = Array.from(toolCounts.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Ghost users: ALL signups (not range-limited) with zero activity ever recorded
    // in student_events. Uses the range event window as a proxy for "any activity".
    const allSignupEmails = new Set(
      (allSignupsForGhost.data ?? []).map((r: any) => r.email?.toLowerCase()).filter(Boolean)
    );
    const everActiveEmails = new Set<string>();
    evRangeRows.forEach(r => { if (r.email) everActiveEmails.add(r.email.toLowerCase()); });
    let ghostCount = 0;
    allSignupEmails.forEach(e => { if (!everActiveEmails.has(e)) ghostCount++; });

    // ── LAUNCH FUNNEL ───────────────────────────────────────────────
    // Step 1 (Signed up): signups in the selected range.
    // Steps 2+: distinct actors per event in the same range.
    const totalBetaSignups = signupsTotal.count ?? 0;
    const rangeSignups = signupsRange.count ?? 0;

    const funnelSteps = [
      { key: "signed_up", label: "Signed up", count: rangeSignups },
      { key: "logged_in", label: "Logged in", count: distinctActor(rowsFor(LOGIN_NAMES)) },
      { key: "viewed_dashboard", label: "Viewed dashboard", count: distinctActor(rowsFor([EV.BETA_DASHBOARD_VIEWED])) },
      { key: "selected_chapter", label: "Selected textbook chapter", count: studentsSelectedChapter },
      { key: "opened_study_tool", label: "Opened study tool", count: studentsOpenedHelper },
      { key: "clicked_helper_action", label: "Clicked helper action", count: distinctActor(helperActionRows) },
      { key: "submitted_feedback", label: "Submitted feedback", count: distinctActor(feedbackEventRows) },
    ];
    const funnelBase = funnelSteps[0].count || 1;
    const funnel = funnelSteps.map((s, i) => {
      const prev = i === 0 ? s.count : funnelSteps[i - 1].count;
      const dropoff = i === 0 ? 0 : Math.max(0, prev - s.count);
      return {
        ...s,
        pctOfSignups: funnelBase > 0 ? s.count / funnelBase : 0,
        dropoffFromPrev: dropoff,
        dropoffPctFromPrev: prev > 0 ? dropoff / prev : 0,
      };
    });

    const metrics = {
      // Top metrics cards (10)
      totalBetaSignups,
      signupsToday: signupsToday.count ?? 0,
      loginsToday,
      activeUsersToday,
      activeUsers7d,
      studentsSelectedChapter,
      studentsOpenedHelper,
      feedbackSubmissions: feedbackSubmissionsCount,
      cacheHitRate,
      ghostUsers: ghostCount,

      // Backwards-compatible fields (used elsewhere in the page)
      signups: rangeSignups,
      signupsPrev: signupsPrev.count ?? 0,
      logins7d: distinctActor(ev7dRows.filter(r => LOGIN_NAMES.includes(r.event_type))),
      activeUsers: distinctActor(evRangeRows),
      studyToolOpens,
      helperClicks: helperClicksRange,
      thumbsUp, thumbsDown,
      openFeedback: (openChapterQ.count ?? 0) + (openIssueRep.count ?? 0),
      avgLatencyMs,
      topTools,

      // Funnel
      funnel,
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

    type EvCounts = {
      logins: number; toolOpens: number; helperClicks: number; total: number;
      lastEventAt: string | null;
      viewedDashboard: boolean; selectedChapter: boolean;
      openedHelper: boolean; clickedHelperAction: boolean;
    };
    const eventMap = new Map<string, EvCounts>();
    (eventRows.data ?? []).forEach((e: any) => {
      const k = (e.email ?? "").toLowerCase();
      if (!k) return;
      const c = eventMap.get(k) ?? {
        logins: 0, toolOpens: 0, helperClicks: 0, total: 0, lastEventAt: null,
        viewedDashboard: false, selectedChapter: false, openedHelper: false, clickedHelperAction: false,
      };
      c.total += 1;
      const t = String(e.event_type ?? "");
      if (t === "login" || t === "session_start" || t === "magic_link_login" || t === "login_completed") c.logins += 1;
      if (t.includes("study_tool") || t.startsWith("tool_") || t === "practice_problem_helper_opened" || t === "journal_entry_helper_opened") c.toolOpens += 1;
      if (t === "helper_action_clicked") c.helperClicks += 1;
      if (t === "study_console_viewed" || t === "course_viewed" || t === "beta_dashboard_viewed") c.viewedDashboard = true;
      if (t === "chapter_selected") c.selectedChapter = true;
      if (t === "practice_problem_helper_opened" || t === "journal_entry_helper_opened") c.openedHelper = true;
      if (t === "helper_action_clicked") c.clickedHelperAction = true;
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
        viewedDashboard: ev.viewedDashboard,
        selectedChapter: ev.selectedChapter,
        openedHelper: ev.openedHelper,
        clickedHelperAction: ev.clickedHelperAction,
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
