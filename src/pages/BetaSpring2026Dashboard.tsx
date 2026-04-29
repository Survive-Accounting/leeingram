import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { AccessRestrictedGuard } from "@/components/AccessRestrictedGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, RefreshCw, Sparkles, MessageSquare, Bug, Lightbulb, Heart, AlertTriangle, ExternalLink, ArrowLeft, TrendingDown } from "lucide-react";
import { SignupsTable, type SignupRow } from "@/components/beta-dashboard/SignupsTable";
import { FeedbackInboxSection } from "@/components/beta-dashboard/FeedbackInboxSection";
import { FeedbackAISummarySection } from "@/components/beta-dashboard/FeedbackAISummarySection";
import { InsightsSections } from "@/components/beta-dashboard/InsightsSections";
import { InactiveSignupsSection } from "@/components/beta-dashboard/InactiveSignupsSection";
import { ProblemReportsSection } from "@/components/beta-dashboard/ProblemReportsSection";
import { FeatureSuggestionsSection } from "@/components/beta-dashboard/FeatureSuggestionsSection";
import { BetaSystemEmailsSection } from "@/components/beta-dashboard/BetaSystemEmailsSection";
import { CollapsibleSection } from "@/components/beta-dashboard/CollapsibleSection";
import { useEventTracking } from "@/hooks/useEventTracking";
import { BETA_EVENTS } from "@/lib/betaEvents";

const NAVY = "#14213D";
const RED = "#CE1126";

type RangeKey = "24h" | "7d" | "14d" | "30d" | "since_apr1";
const RANGE_LABELS: Record<RangeKey, string> = {
  "24h": "Last 24h",
  "7d": "Last 7 days",
  "14d": "Last 14 days",
  "30d": "Last 30 days",
  since_apr1: "Since Apr 1, 2026",
};

function rangeStart(range: RangeKey): Date {
  const now = new Date();
  switch (range) {
    case "24h": return new Date(now.getTime() - 24 * 3600 * 1000);
    case "7d": return new Date(now.getTime() - 7 * 86400 * 1000);
    case "14d": return new Date(now.getTime() - 14 * 86400 * 1000);
    case "30d": return new Date(now.getTime() - 30 * 86400 * 1000);
    case "since_apr1": return new Date("2026-04-01T00:00:00Z");
  }
}

interface FunnelStep {
  key: string;
  label: string;
  count: number;
  pctOfSignups: number;
  dropoffFromPrev: number;
  dropoffPctFromPrev: number;
}

interface Metrics {
  // Top metrics cards
  totalBetaSignups: number;
  signupsToday: number;
  loginsToday: number;
  activeUsersToday: number;
  activeUsers7d: number;
  studentsSelectedChapter: number;
  studentsOpenedHelper: number;
  feedbackSubmissions: number;
  cacheHitRate: number;
  ghostUsers: number;
  // Backwards-compatible
  signups: number;
  signupsPrev: number;
  logins7d: number;
  activeUsers: number;
  studyToolOpens: number;
  helperClicks: number;
  thumbsUp: number;
  thumbsDown: number;
  openFeedback: number;
  avgLatencyMs: number;
  topTools: Array<{ name: string; count: number }>;
  // Funnel
  funnel: FunnelStep[];
}

interface FeedbackItem {
  id: string;
  source: string;
  text: string;
  email: string | null;
  course: string | null;
  chapter: string | null;
  pageUrl: string | null;
  createdAt: string;
  rating?: string | null;
  category?: string;
  severity?: "low" | "medium" | "high";
  suggestedAction?: string;
  themeId?: string;
  addressed?: boolean;
}

interface Theme {
  id: string;
  label: string;
  summary: string;
  count: number;
  representativeIds: string[];
}

const SOURCE_ICON: Record<string, JSX.Element> = {
  chapter_questions: <MessageSquare className="h-3 w-3" />,
  problem_issue_reports: <Bug className="h-3 w-3" />,
  asset_issue_reports: <Bug className="h-3 w-3" />,
  study_tool_response_feedback: <Sparkles className="h-3 w-3" />,
  study_tool_idea_feedback: <Lightbulb className="h-3 w-3" />,
  explanation_feedback: <Sparkles className="h-3 w-3" />,
  contact_messages: <MessageSquare className="h-3 w-3" />,
  cram_feedback: <Heart className="h-3 w-3" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  bug: "#DC2626",
  confusion: "#D97706",
  feature_request: "#2563EB",
  content_gap: "#7C3AED",
  praise: "#16A34A",
  pricing: "#DB2777",
  auth_issue: "#EA580C",
  performance: "#0891B2",
  other: "#6B7280",
};

function buildLovablePrompt(item: FeedbackItem): string {
  return `Context: Spring 2026 beta feedback from Survive Accounting.

Source: ${item.source}
Course: ${item.course ?? "—"} · Chapter: ${item.chapter ?? "—"} · Page: ${item.pageUrl ?? "—"}
Student: ${item.email ?? "anonymous"}
Submitted: ${item.createdAt}

Student said:
"${item.text}"

AI category: ${item.category ?? "uncategorized"}
AI severity: ${item.severity ?? "—"}
AI suggested action: ${item.suggestedAction ?? "—"}

Please implement the smallest change that addresses this feedback.
Constraints: keep dark navy + brand red, do not break existing student dashboard layout, follow project memory rules.`;
}

function buildClusterPrompt(theme: Theme, items: FeedbackItem[]): string {
  const reps = items.filter(i => theme.representativeIds.includes(i.id)).slice(0, 8);
  return `Context: Spring 2026 beta feedback cluster from Survive Accounting.

Theme: ${theme.label}
Volume: ${theme.count} feedback items
Synthesis: ${theme.summary}

Representative quotes:
${reps.map((r, idx) => `${idx + 1}. [${r.source}] "${r.text}" — ${r.email ?? "anonymous"}, ${r.course ?? "—"} ${r.chapter ?? ""}`).join("\n")}

Please implement the smallest change that addresses this cluster of feedback.
Constraints: keep dark navy + brand red, do not break existing student dashboard layout, follow project memory rules.`;
}

const BETA_END = new Date("2026-05-15T23:59:59-05:00");

export default function BetaSpring2026Dashboard() {
  const [range, setRange] = useState<RangeKey>("7d");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [signups, setSignups] = useState<SignupRow[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [slackTesting, setSlackTesting] = useState(false);
  const [auditSending, setAuditSending] = useState(false);

  const sendEmailAuditDigest = useCallback(async () => {
    setAuditSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email-audit-digest");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Audit digest sent to lee@survivestudios.com (${(data as any)?.count ?? "?"} emails)`);
    } catch (e: any) {
      toast.error(`Audit digest failed: ${e?.message ?? e}`);
    } finally {
      setAuditSending(false);
    }
  }, []);

  const sendSlackTest = useCallback(async () => {
    setSlackTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("beta-slack-test");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Test ping sent — check Slack");
    } catch (e: any) {
      toast.error(`Slack test failed: ${e?.message ?? e}`);
    } finally {
      setSlackTesting(false);
    }
  }, []);

  const daysLeft = Math.max(0, Math.ceil((BETA_END.getTime() - Date.now()) / 86400000));

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const start = rangeStart(range).toISOString();
    try {
      const { data, error } = await supabase.functions.invoke("beta-dashboard-query", {
        body: { startDate: start },
      });
      if (error) throw error;
      setMetrics(data.metrics);
      setFeedback(data.feedback);
      setSignups(data.signups ?? []);
    } catch (e: any) {
      console.error(e);
      const msg = e?.message ?? "unknown error";
      setFetchError(msg);
      toast.error("Failed to load dashboard: " + msg);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { trackEvent } = useEventTracking();
  useEffect(() => {
    trackEvent(BETA_EVENTS.BETA_DASHBOARD_VIEWED, { source: "internal_admin" });
  }, [trackEvent]);

  const runClustering = async (force = false) => {
    if (!feedback.length) return;
    setAiLoading(true);
    try {
      const items = feedback.slice(0, 200).map(f => ({
        id: f.id,
        source: f.source,
        text: f.text,
        course: f.course,
        chapter: f.chapter,
        created_at: f.createdAt,
      }));
      const { data, error } = await supabase.functions.invoke("beta-dashboard-summarize", {
        body: { items, force },
      });
      if (error) throw error;
      const byId = new Map<string, any>(data.items.map((i: any) => [i.id, i]));
      setFeedback(prev => prev.map(f => {
        const m = byId.get(f.id);
        return m ? { ...f, category: m.category, severity: m.severity, suggestedAction: m.suggested_action, themeId: m.theme_id } : f;
      }));
      setThemes(data.themes ?? []);
      toast.success(`Categorized ${data.items.length} items into ${data.themes?.length ?? 0} themes`);
    } catch (e: any) {
      console.error(e);
      toast.error("AI clustering failed: " + (e?.message ?? "unknown"));
    } finally {
      setAiLoading(false);
    }
  };

  const copyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Lovable prompt copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const filteredFeedback = useMemo(() => {
    return feedback.filter(f => {
      if (filterSource !== "all" && f.source !== filterSource) return false;
      if (filterSeverity !== "all" && f.severity !== filterSeverity) return false;
      if (search && !f.text.toLowerCase().includes(search.toLowerCase()) &&
          !(f.email ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [feedback, filterSource, filterSeverity, search]);

  const sources = useMemo(() => Array.from(new Set(feedback.map(f => f.source))), [feedback]);

  return (
    <AccessRestrictedGuard>
      <div className="min-h-screen bg-muted/20">
        <div className="border-b bg-white">
          <div className="max-w-[1400px] mx-auto px-6 py-2 flex items-center justify-between">
            <div className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ color: NAVY }}>
              Spring 2026 Beta Dashboard · Internal
            </div>
            <Link
              to="/domains"
              className="text-[11px] inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Exit
            </Link>
          </div>
        </div>
        <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="space-y-6 pb-20">
          {/* Header */}
          <div
            className="rounded-xl p-5 text-white"
            style={{ background: NAVY, boxShadow: "0 8px 24px rgba(20,33,61,0.18)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold tracking-[0.18em] uppercase opacity-70">
                  Internal · Lee Only
                </div>
                <h1 className="mt-1 text-2xl font-bold">Spring 2026 Beta Dashboard</h1>
                <p className="text-sm opacity-80 mt-1">
                  {daysLeft} days left · ends May 15, 2026
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
                  <SelectTrigger className="w-[180px] bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RANGE_LABELS) as RangeKey[]).map(k => (
                      <SelectItem key={k} value={k}>{RANGE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={fetchData}
                  disabled={loading}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {/* Fetch error banner */}
          {fetchError && (
            <Card className="border-2" style={{ borderColor: RED }}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4" style={{ color: RED }} />
                  <span><strong>Dashboard failed to load:</strong> {fetchError}</span>
                </div>
                <Button size="sm" variant="outline" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Retry
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Top Metrics Cards */}
          <MetricsGrid metrics={metrics} loading={loading} />

          {/* Launch Funnel */}
          <LaunchFunnel metrics={metrics} loading={loading} />

          {/* Student Signups — pinned at top per Lee's request */}
          <CollapsibleSection
            title="Student Signups"
            subtitle="Everyone who has completed onboarding"
            defaultOpen
            rightLabel={`${signups.length} total`}
          >
            <SignupsTable signups={signups} loading={loading} />
          </CollapsibleSection>

          {/* Slack notifications utility */}
          <CollapsibleSection
            title="Slack Notifications"
            subtitle="New beta signups post to #beta-signups via the existing webhook"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Click to send a test ping to Slack and confirm wiring.
              </p>
              <Button
                size="sm"
                onClick={sendSlackTest}
                disabled={slackTesting}
                style={{ background: RED, color: "white" }}
              >
                {slackTesting ? "Sending…" : "Send test ping"}
              </Button>
            </div>
          </CollapsibleSection>

          {/* AI Themes */}
          <CollapsibleSection
            title="AI Themes"
            subtitle="Claude clusters free-text feedback into themes you can act on."
            rightLabel={themes.length ? `${themes.length} themes` : undefined}
          >
            <div className="flex items-center justify-end mb-3">
              <Button
                size="sm"
                onClick={() => runClustering(true)}
                disabled={aiLoading || !feedback.length}
                style={{ background: RED, color: "white" }}
              >
                <Sparkles className={`h-4 w-4 mr-1 ${aiLoading ? "animate-pulse" : ""}`} />
                {aiLoading ? "Analyzing…" : themes.length ? "Re-run" : "Run AI clustering"}
              </Button>
            </div>
            {themes.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No themes yet. Click "Run AI clustering" to analyze {feedback.length} feedback items.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {themes.map(t => (
                  <div key={t.id} className="rounded-lg border border-border p-3 bg-muted/20">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="text-sm font-bold" style={{ color: NAVY }}>{t.label}</div>
                        <div className="text-[11px] text-muted-foreground">{t.count} item{t.count !== 1 ? "s" : ""}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyPrompt(buildClusterPrompt(t, feedback))}
                      >
                        <Copy className="h-3 w-3 mr-1" /> Prompt
                      </Button>
                    </div>
                    <p className="text-xs text-foreground/80">{t.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* System Emails (preview/test/send beta nurture emails) */}
          <CollapsibleSection
            title="System Emails"
            subtitle="Preview, test, and send beta nurture emails"
          >
            <BetaSystemEmailsSection
              candidateRecipients={signups.map((s) => ({ email: s.email, label: s.email }))}
            />
          </CollapsibleSection>

          {/* Problem Reports */}
          <CollapsibleSection
            title="Problem Reports"
            subtitle="Auto-classified bug/issue queue"
          >
            <ProblemReportsSection />
          </CollapsibleSection>

          {/* Feature Suggestions */}
          <CollapsibleSection
            title="Feature Suggestions"
            subtitle="Ideas students submitted"
          >
            <FeatureSuggestionsSection />
          </CollapsibleSection>

          {/* Feedback Inbox */}
          <CollapsibleSection
            title="Feedback Inbox"
            subtitle="Raw feedback from students"
          >
            <FeedbackInboxSection />
          </CollapsibleSection>

          {/* AI Feedback Summary */}
          <CollapsibleSection
            title="AI Feedback Summary"
            subtitle="Claude-generated digest of recent feedback"
          >
            <FeedbackAISummarySection />
          </CollapsibleSection>

          {/* Insights */}
          <CollapsibleSection
            title="Top Confusing Chapters & Top Used Tools"
            subtitle="What's tripping students up and what they're using"
          >
            <InsightsSections startDate={rangeStart(range).toISOString()} />
          </CollapsibleSection>

          {/* Inactive Signups */}
          <CollapsibleSection
            title="Inactive Signups"
            subtitle="Signed up but haven't engaged"
          >
            <InactiveSignupsSection signups={signups} />
          </CollapsibleSection>
        </div>
        </div>
      </div>
    </AccessRestrictedGuard>
  );
}

function MetricsGrid({ metrics, loading }: { metrics: Metrics | null; loading: boolean }) {
  const pct = (n?: number) => n != null ? `${Math.round(n * 100)}%` : undefined;
  const cards = [
    { label: "Total beta signups", value: metrics?.totalBetaSignups },
    { label: "New signups today", value: metrics?.signupsToday, accent: (metrics?.signupsToday ?? 0) > 0 },
    { label: "Logins today", value: metrics?.loginsToday },
    { label: "Active users today", value: metrics?.activeUsersToday },
    { label: "Active users (7d)", value: metrics?.activeUsers7d },
    { label: "Selected a chapter", value: metrics?.studentsSelectedChapter, sub: "in selected range" },
    { label: "Opened a helper", value: metrics?.studentsOpenedHelper, sub: "in selected range" },
    { label: "Feedback submissions", value: metrics?.feedbackSubmissions, sub: "in selected range" },
    {
      label: "AI cache hit rate",
      value: pct(metrics?.cacheHitRate),
      sub: metrics ? `${metrics.avgLatencyMs}ms avg` : undefined,
    },
    {
      label: "Signed up but inactive",
      value: metrics?.ghostUsers,
      sub: "no events recorded",
      accent: (metrics?.ghostUsers ?? 0) > 0,
    },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {cards.map((c, i) => (
        <Card key={i} className={c.accent ? "border-2" : ""} style={c.accent ? { borderColor: RED } : undefined}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ color: NAVY }}>
              {loading ? "…" : (c.value ?? "—")}
            </p>
            {c.sub && <p className="text-[10px] text-muted-foreground mt-1">{c.sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LaunchFunnel({ metrics, loading }: { metrics: Metrics | null; loading: boolean }) {
  const steps = metrics?.funnel ?? [];
  const max = steps.reduce((m, s) => Math.max(m, s.count), 0) || 1;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: NAVY }}>Launch Funnel</h2>
            <p className="text-xs text-muted-foreground">
              Distinct students at each step within the selected date range. Drop-off is from the previous step.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : steps.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No funnel data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-2 w-6">#</th>
                  <th className="py-2 pr-2">Step</th>
                  <th className="py-2 pr-2 w-[35%]">Volume</th>
                  <th className="py-2 pr-2 text-right">Count</th>
                  <th className="py-2 pr-2 text-right">% of signups</th>
                  <th className="py-2 pr-2 text-right">Drop-off from prev</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((s, i) => {
                  const widthPct = (s.count / max) * 100;
                  const dropoffPct = Math.round(s.dropoffPctFromPrev * 100);
                  const dropoffBad = i > 0 && s.dropoffPctFromPrev >= 0.5;
                  return (
                    <tr key={s.key} className="border-b hover:bg-muted/30">
                      <td className="py-2 pr-2 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-2 font-medium" style={{ color: NAVY }}>{s.label}</td>
                      <td className="py-2 pr-2">
                        <div className="h-3 rounded bg-muted overflow-hidden">
                          <div
                            className="h-full rounded"
                            style={{
                              width: `${Math.max(2, widthPct)}%`,
                              background: i === 0 ? NAVY : RED,
                              opacity: i === 0 ? 1 : 0.85,
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums font-bold" style={{ color: NAVY }}>
                        {s.count}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums text-xs">
                        {Math.round(s.pctOfSignups * 100)}%
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums text-xs">
                        {i === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 ${dropoffBad ? "font-bold" : ""}`}
                            style={{ color: dropoffBad ? RED : "#6B7280" }}
                          >
                            <TrendingDown className="h-3 w-3" />
                            {s.dropoffFromPrev} ({dropoffPct}%)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeedbackRow({ item, onCopy }: { item: FeedbackItem; onCopy: (t: string) => void }) {
  const ago = useMemo(() => {
    const diff = Date.now() - new Date(item.createdAt).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }, [item.createdAt]);

  const sevColor = item.severity === "high" ? RED : item.severity === "medium" ? "#D97706" : "#6B7280";
  const catColor = item.category ? CATEGORY_COLORS[item.category] ?? "#6B7280" : null;

  return (
    <div className="rounded-lg border border-border p-3 bg-card hover:bg-muted/30 transition">
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <Badge variant="outline" className="text-[10px] gap-1">
          {SOURCE_ICON[item.source] ?? <MessageSquare className="h-3 w-3" />}
          {item.source.replace(/_/g, " ")}
        </Badge>
        {item.category && catColor && (
          <Badge style={{ background: catColor, color: "white" }} className="text-[10px]">
            {item.category}
          </Badge>
        )}
        {item.severity && (
          <Badge style={{ background: sevColor, color: "white" }} className="text-[10px]">
            {item.severity}
          </Badge>
        )}
        {item.rating === "down" && (
          <Badge variant="outline" className="text-[10px] gap-1">
            <AlertTriangle className="h-3 w-3" /> 👎
          </Badge>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">{ago}</span>
      </div>
      <p className="text-sm text-foreground/90 leading-snug whitespace-pre-wrap">{item.text}</p>
      <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground flex-wrap">
        <span>{item.email ?? "anonymous"}</span>
        {item.course && <><span>·</span><span>{item.course}</span></>}
        {item.chapter && <><span>·</span><span>Ch {item.chapter}</span></>}
        {item.pageUrl && (
          <a href={item.pageUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 hover:underline">
            <ExternalLink className="h-3 w-3" /> open
          </a>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          onClick={() => onCopy(buildLovablePrompt(item))}
          style={{ background: RED, color: "white" }}
          className="h-7 text-[11px]"
        >
          <Copy className="h-3 w-3 mr-1" /> Copy Lovable Prompt
        </Button>
      </div>
    </div>
  );
}
