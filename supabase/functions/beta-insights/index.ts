// Beta dashboard – chapter & tool insight aggregation. Lee-only.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LEE_EMAILS = ["lee@survivestudios.com", "lee@surviveaccounting.com", "admin@surviveaccounting.com"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    const email = (user?.email ?? "").toLowerCase();
    if (!LEE_EMAILS.includes(email)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const startISO: string = body.startDate ?? new Date(Date.now() - 14 * 86400000).toISOString();

    // Pull source data in parallel.
    const [
      helperFb, responseFb, chapterQ, explanationFb,
      events, aiLog, chapters, courses,
    ] = await Promise.all([
      db.from("student_helper_feedback")
        .select("chapter_id,course_id,asset_id,tool_type,action_type,rating,comment,email,session_id,user_id,created_at")
        .gte("created_at", startISO).limit(8000),
      db.from("study_tool_response_feedback")
        .select("chapter_id,course_id,asset_id,tool_type,action_type,rating,feedback_text,session_id,user_id,created_at")
        .gte("created_at", startISO).limit(8000),
      db.from("chapter_questions")
        .select("chapter_id,question,issue_type,asset_name,student_email,created_at")
        .gte("created_at", startISO).limit(2000),
      db.from("explanation_feedback")
        .select("asset_id,asset_name,helpful,reason,note,user_email,created_at")
        .gte("created_at", startISO).limit(4000),
      db.from("student_events")
        .select("event_type,event_data,email,session_id,created_at")
        .gte("created_at", startISO).limit(20000),
      db.from("ai_request_log")
        .select("tool_type,action_type,cache_hit,latency_ms,chapter_id,asset_id,created_at")
        .gte("created_at", startISO).limit(20000),
      db.from("chapters").select("id,chapter_name,chapter_number,course_id"),
      db.from("courses").select("id,course_name,course_code"),
    ]);

    const chapterMap = new Map((chapters.data ?? []).map((c: any) => [c.id, c]));
    const courseMap = new Map((courses.data ?? []).map((c: any) => [c.id, c]));

    const courseLabel = (courseId: string | null, chapterId: string | null) => {
      const ch = chapterId ? chapterMap.get(chapterId) : null;
      const cId = courseId ?? ch?.course_id ?? null;
      const c = cId ? courseMap.get(cId) : null;
      return c?.course_code ?? c?.course_name ?? null;
    };

    // ───── CHAPTER INSIGHTS ─────
    type ChAgg = {
      chapterId: string;
      chapterLabel: string;
      courseLabel: string | null;
      thumbsDown: number;
      thumbsUp: number;
      writtenFeedback: number;
      problemReports: number;
      aiResponseDislikes: number;
      helperClicks: number;
      helperOpens: number;
      fullSolutionClicks: number;
      walkThroughClicks: number;
      issueCounts: Map<string, number>;
      sampleQuotes: string[];
    };
    const chAgg = new Map<string, ChAgg>();
    const ensureCh = (chapterId: string | null, courseId?: string | null): ChAgg | null => {
      if (!chapterId) return null;
      const ch = chapterMap.get(chapterId);
      if (!ch) return null;
      let a = chAgg.get(chapterId);
      if (!a) {
        a = {
          chapterId,
          chapterLabel: `Ch ${ch.chapter_number} ${ch.chapter_name}`,
          courseLabel: courseLabel(courseId ?? null, chapterId),
          thumbsDown: 0, thumbsUp: 0, writtenFeedback: 0,
          problemReports: 0, aiResponseDislikes: 0,
          helperClicks: 0, helperOpens: 0,
          fullSolutionClicks: 0, walkThroughClicks: 0,
          issueCounts: new Map(), sampleQuotes: [],
        };
        chAgg.set(chapterId, a);
      }
      return a;
    };
    const bumpIssue = (a: ChAgg, k: string) => {
      a.issueCounts.set(k, (a.issueCounts.get(k) ?? 0) + 1);
    };
    const pushQuote = (a: ChAgg, q: string | null | undefined) => {
      if (!q) return;
      const t = q.replace(/\s+/g, " ").trim();
      if (!t) return;
      if (a.sampleQuotes.length < 3) a.sampleQuotes.push(t.slice(0, 220));
    };

    (helperFb.data ?? []).forEach((r: any) => {
      const a = ensureCh(r.chapter_id, r.course_id);
      if (!a) return;
      if (r.rating === 1) a.thumbsUp += 1;
      if (r.rating === -1) { a.thumbsDown += 1; bumpIssue(a, "Helper thumbs-down"); }
      if (r.comment) { a.writtenFeedback += 1; pushQuote(a, r.comment); }
    });
    (responseFb.data ?? []).forEach((r: any) => {
      const a = ensureCh(r.chapter_id, r.course_id);
      if (!a) return;
      if (r.rating === "down") { a.thumbsDown += 1; a.aiResponseDislikes += 1; bumpIssue(a, "AI response dislike"); }
      if (r.rating === "up") a.thumbsUp += 1;
      if (r.feedback_text) { a.writtenFeedback += 1; pushQuote(a, r.feedback_text); }
    });
    (chapterQ.data ?? []).forEach((r: any) => {
      const a = ensureCh(r.chapter_id);
      if (!a) return;
      a.writtenFeedback += 1;
      if (r.issue_type === "issue") { a.problemReports += 1; bumpIssue(a, "Issue report"); }
      else if (r.issue_type === "question") bumpIssue(a, "Question");
      else if (r.issue_type === "feedback") bumpIssue(a, "General feedback");
      pushQuote(a, r.question);
    });

    // Events – chapter selections, helper opens, helper clicks
    (events.data ?? []).forEach((r: any) => {
      const data = (r.event_data ?? {}) as any;
      const chapterId = data.chapter_id ?? data.chapterId ?? null;
      const action = data.action ?? data.action_type ?? null;
      const a = ensureCh(chapterId);
      if (!a) return;
      const t = String(r.event_type ?? "");
      if (t === "helper_action_clicked") {
        a.helperClicks += 1;
        if (action === "full_solution") a.fullSolutionClicks += 1;
        if (action === "walk_through" || action === "walk_me_through") a.walkThroughClicks += 1;
      }
      if (t === "practice_problem_helper_opened" || t === "journal_entry_helper_opened") {
        a.helperOpens += 1;
      }
    });

    // ai_request_log – use as another helper-action signal & for full_solution / walkthrough breakdown
    (aiLog.data ?? []).forEach((r: any) => {
      const a = ensureCh(r.chapter_id);
      if (!a) return;
      a.helperClicks += 1;
      if (r.action_type === "full_solution") a.fullSolutionClicks += 1;
      if (r.action_type === "walk_through") a.walkThroughClicks += 1;
    });

    const chapterInsights = Array.from(chAgg.values()).map(a => {
      const totalRatings = a.thumbsUp + a.thumbsDown;
      const helpfulnessRatio = totalRatings > 0 ? a.thumbsUp / totalRatings : null;
      const fullVsWalk = a.walkThroughClicks > 0
        ? a.fullSolutionClicks / a.walkThroughClicks
        : (a.fullSolutionClicks > 0 ? a.fullSolutionClicks : 0);
      const topIssue = Array.from(a.issueCounts.entries())
        .sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
      const feedbackCount = a.writtenFeedback + a.thumbsDown + a.problemReports;
      // Confusion score: weighted blend.
      const confusionScore =
        a.thumbsDown * 3 +
        a.aiResponseDislikes * 3 +
        a.problemReports * 4 +
        a.writtenFeedback * 2 +
        Math.max(0, a.fullSolutionClicks - a.walkThroughClicks) * 1.5 +
        (helpfulnessRatio !== null && helpfulnessRatio < 0.5 ? 5 : 0);
      return {
        chapterId: a.chapterId,
        chapterLabel: a.chapterLabel,
        courseLabel: a.courseLabel,
        feedbackCount,
        thumbsDown: a.thumbsDown,
        thumbsUp: a.thumbsUp,
        helpfulnessRatio,
        problemReports: a.problemReports,
        helperClicks: a.helperClicks,
        helperOpens: a.helperOpens,
        fullSolutionClicks: a.fullSolutionClicks,
        walkThroughClicks: a.walkThroughClicks,
        fullVsWalkRatio: fullVsWalk,
        aiResponseDislikes: a.aiResponseDislikes,
        topIssueCategory: topIssue,
        sampleQuotes: a.sampleQuotes,
        confusionScore,
      };
    })
    .filter(c => c.feedbackCount > 0 || c.helperClicks > 0)
    .sort((a, b) => b.confusionScore - a.confusionScore)
    .slice(0, 20);

    // ───── TOOL INSIGHTS ─────
    type ToolAgg = {
      tool: string;
      opens: number;
      helperClicks: number;
      uniqueUsers: Set<string>;
      sessions: Set<string>;
      thumbsUp: number;
      thumbsDown: number;
      cacheHits: number;
      cacheTotal: number;
      actionCounts: Map<string, number>;
    };
    const toolAgg = new Map<string, ToolAgg>();
    const ensureTool = (key: string): ToolAgg => {
      let t = toolAgg.get(key);
      if (!t) {
        t = {
          tool: key,
          opens: 0, helperClicks: 0,
          uniqueUsers: new Set(), sessions: new Set(),
          thumbsUp: 0, thumbsDown: 0,
          cacheHits: 0, cacheTotal: 0,
          actionCounts: new Map(),
        };
        toolAgg.set(key, t);
      }
      return t;
    };
    const TOOL_LABEL: Record<string, string> = {
      practice_problem_helper: "Practice Problem Helper",
      journal_entry_helper: "Journal Entry Helper",
      explanation: "Explanation",
      cram: "Cram tool",
    };

    (events.data ?? []).forEach((r: any) => {
      const t = String(r.event_type ?? "");
      const data = (r.event_data ?? {}) as any;
      const userKey = (r.email ?? "").toLowerCase() || (r.session_id ? `s:${r.session_id}` : "");
      let toolKey: string | null = null;
      if (t === "practice_problem_helper_opened") toolKey = "practice_problem_helper";
      else if (t === "journal_entry_helper_opened") toolKey = "journal_entry_helper";
      else if (t === "helper_action_clicked") toolKey = data.tool_type ?? data.tool ?? "helper";
      else if (t.startsWith("study_tool_") || t.startsWith("tool_")) toolKey = data.tool_type ?? t.replace(/^(study_tool_|tool_)/, "");
      if (!toolKey) return;
      const agg = ensureTool(toolKey);
      if (t.endsWith("_opened") || t.startsWith("study_tool_") || t.startsWith("tool_")) agg.opens += 1;
      if (t === "helper_action_clicked") {
        agg.helperClicks += 1;
        const action = data.action ?? data.action_type ?? "unknown";
        agg.actionCounts.set(action, (agg.actionCounts.get(action) ?? 0) + 1);
      }
      if (userKey) agg.uniqueUsers.add(userKey);
      if (r.session_id) agg.sessions.add(r.session_id);
    });

    (helperFb.data ?? []).forEach((r: any) => {
      if (!r.tool_type) return;
      const agg = ensureTool(r.tool_type);
      if (r.rating === 1) agg.thumbsUp += 1;
      if (r.rating === -1) agg.thumbsDown += 1;
      const userKey = (r.email ?? "").toLowerCase() || (r.user_id ? `u:${r.user_id}` : (r.session_id ? `s:${r.session_id}` : ""));
      if (userKey) agg.uniqueUsers.add(userKey);
      if (r.action_type) agg.actionCounts.set(r.action_type, (agg.actionCounts.get(r.action_type) ?? 0) + 1);
    });
    (responseFb.data ?? []).forEach((r: any) => {
      if (!r.tool_type) return;
      const agg = ensureTool(r.tool_type);
      if (r.rating === "up") agg.thumbsUp += 1;
      if (r.rating === "down") agg.thumbsDown += 1;
      const userKey = (r.user_id ? `u:${r.user_id}` : (r.session_id ? `s:${r.session_id}` : ""));
      if (userKey) agg.uniqueUsers.add(userKey);
      if (r.action_type) agg.actionCounts.set(r.action_type, (agg.actionCounts.get(r.action_type) ?? 0) + 1);
    });

    (aiLog.data ?? []).forEach((r: any) => {
      if (!r.tool_type) return;
      const agg = ensureTool(r.tool_type);
      agg.cacheTotal += 1;
      if (r.cache_hit) agg.cacheHits += 1;
      agg.helperClicks += 1;
      if (r.action_type) agg.actionCounts.set(r.action_type, (agg.actionCounts.get(r.action_type) ?? 0) + 1);
    });

    const toolInsights = Array.from(toolAgg.values()).map(t => {
      const totalRatings = t.thumbsUp + t.thumbsDown;
      const fullSolution = t.actionCounts.get("full_solution") ?? 0;
      const walkThrough = (t.actionCounts.get("walk_through") ?? 0) + (t.actionCounts.get("walk_me_through") ?? 0);
      const usagePerUser = t.uniqueUsers.size > 0
        ? (t.opens + t.helperClicks) / t.uniqueUsers.size
        : 0;
      const topActions = Array.from(t.actionCounts.entries())
        .sort((a, b) => b[1] - a[1]).slice(0, 4)
        .map(([action, count]) => ({ action, count }));
      return {
        tool: t.tool,
        toolLabel: TOOL_LABEL[t.tool] ?? t.tool.replace(/_/g, " "),
        opens: t.opens,
        helperClicks: t.helperClicks,
        uniqueUsers: t.uniqueUsers.size,
        sessions: t.sessions.size,
        usagePerUser,
        thumbsUp: t.thumbsUp,
        thumbsDown: t.thumbsDown,
        helpfulnessRatio: totalRatings > 0 ? t.thumbsUp / totalRatings : null,
        cacheHitRate: t.cacheTotal > 0 ? t.cacheHits / t.cacheTotal : null,
        cacheTotal: t.cacheTotal,
        fullSolutionClicks: fullSolution,
        walkThroughClicks: walkThrough,
        topActions,
      };
    })
    .filter(t => t.opens + t.helperClicks > 0)
    .sort((a, b) => (b.opens + b.helperClicks) - (a.opens + a.helperClicks));

    return new Response(JSON.stringify({ chapterInsights, toolInsights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("beta-insights error", err);
    return new Response(JSON.stringify({ error: err?.message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
