import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sparkles, Copy, RefreshCw, History, AlertTriangle, Lightbulb,
  Target, Zap, FileText, Loader2,
} from "lucide-react";

const NAVY = "#14213D";
const RED = "#CE1126";

interface SummaryRecord {
  id?: string;
  created_at?: string;
  date_range_start?: string;
  date_range_end?: string;
  feedback_count?: number;
  model_used?: string;
  summary_text?: string;
  categories?: Record<string, number>;
  top_issues?: Array<{ title: string; count_estimate: number; example_quote: string; affected_area: string }>;
  top_features?: Array<{ title: string; count_estimate: number; example_quote: string }>;
  top_chapters?: Array<{ label: string; why_confusing: string; example_quote?: string }>;
  quick_wins?: Array<{ title: string; why: string; effort: "small" | "medium" | "large" }>;
  suggested_prompts?: Array<{ title: string; target_area: string; prompt: string }>;
}

interface PastListItem {
  id: string;
  created_at: string;
  date_range_start: string;
  date_range_end: string;
  feedback_count: number;
  model_used: string;
  filters: any;
}

const EFFORT_COLORS: Record<string, string> = {
  small: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  large: "bg-red-100 text-red-800 border-red-200",
};

export function FeedbackAISummarySection() {
  const [running, setRunning] = useState(false);
  const [range, setRange] = useState<"24h" | "7d">("7d");
  const [summary, setSummary] = useState<SummaryRecord | null>(null);
  const [past, setPast] = useState<PastListItem[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);

  const loadPast = useCallback(async () => {
    setLoadingPast(true);
    try {
      const { data, error } = await supabase.functions.invoke("beta-feedback-summarize", {
        body: { action: "list_past" },
      });
      if (error) throw error;
      setPast((data as any)?.summaries ?? []);
    } catch (e: any) {
      // silent
    } finally {
      setLoadingPast(false);
    }
  }, []);

  useEffect(() => { loadPast(); }, [loadPast]);

  const runSummary = useCallback(async (r: "24h" | "7d") => {
    setRunning(true);
    setRange(r);
    try {
      const { data, error } = await supabase.functions.invoke("beta-feedback-summarize", {
        body: { action: "summarize", range: r },
      });
      if (error) throw error;
      const payload = data as any;
      if (payload?.error) {
        toast.error(payload.error);
        return;
      }
      setSummary(payload.summary);
      toast.success(`Summarized ${payload.feedback_count} feedback items`);
      loadPast();
    } catch (e: any) {
      toast.error(`Summary failed: ${e?.message ?? e}`);
    } finally {
      setRunning(false);
    }
  }, [loadPast]);

  const loadPastSummary = useCallback(async (id: string) => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("beta-feedback-summarize", {
        body: { action: "get_summary", id },
      });
      if (error) throw error;
      setSummary((data as any)?.summary ?? null);
    } catch (e: any) {
      toast.error(`Load failed: ${e?.message ?? e}`);
    } finally {
      setRunning(false);
    }
  }, []);

  const copyPrompt = useCallback(async (text: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied: ${label ?? "prompt"}`);
    } catch {
      toast.error("Could not copy");
    }
  }, []);

  const copyFixList = useCallback(() => {
    if (!summary?.quick_wins?.length) return;
    const text = [
      "Prioritized fix list (Survive Accounting beta):",
      "",
      ...summary.quick_wins.map((q, i) => `${i + 1}. [${q.effort}] ${q.title} — ${q.why}`),
    ].join("\n");
    copyPrompt(text, "fix list");
  }, [summary, copyPrompt]);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: NAVY }}>
              <Sparkles className="h-5 w-5" /> AI Feedback Summary
            </h2>
            <p className="text-xs text-muted-foreground">
              Categorize, surface top issues, and generate ready-to-paste Lovable prompts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => runSummary("24h")}
              disabled={running}
              variant={range === "24h" ? "default" : "outline"}
            >
              {running && range === "24h" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Last 24 hours
            </Button>
            <Button
              size="sm"
              onClick={() => runSummary("7d")}
              disabled={running}
              variant={range === "7d" ? "default" : "outline"}
            >
              {running && range === "7d" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Last 7 days
            </Button>
            <Button size="sm" variant="outline" onClick={copyFixList} disabled={!summary?.quick_wins?.length}>
              <FileText className="h-4 w-4 mr-2" /> Copy Fix List
            </Button>
            <Select onValueChange={loadPastSummary}>
              <SelectTrigger className="w-[220px] h-9">
                <History className="h-4 w-4 mr-2" />
                <SelectValue placeholder={loadingPast ? "Loading…" : "Past summaries"} />
              </SelectTrigger>
              <SelectContent>
                {past.length === 0 && <SelectItem value="__none" disabled>None yet</SelectItem>}
                {past.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {new Date(p.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · {p.feedback_count} items
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={loadPast} disabled={loadingPast}>
              <RefreshCw className={`h-4 w-4 ${loadingPast ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {!summary ? (
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Sparkles className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Run a summary to see top issues, requested features, confusing chapters, quick wins, and Lovable prompts.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Header / executive summary */}
            <div className="rounded-lg border p-4" style={{ background: "rgba(20,33,61,0.04)" }}>
              <div className="flex flex-wrap items-center gap-2 mb-2 text-xs text-muted-foreground">
                {summary.created_at && <span>Generated {new Date(summary.created_at).toLocaleString()}</span>}
                {summary.date_range_start && summary.date_range_end && (
                  <span>· {new Date(summary.date_range_start).toLocaleDateString()} → {new Date(summary.date_range_end).toLocaleDateString()}</span>
                )}
                {summary.feedback_count !== undefined && <span>· {summary.feedback_count} items</span>}
                {summary.model_used && <Badge variant="outline" className="text-[10px]">{summary.model_used}</Badge>}
              </div>
              <p className="text-sm whitespace-pre-wrap">{summary.summary_text}</p>
            </div>

            {/* Categories */}
            {summary.categories && (
              <div>
                <h3 className="text-sm font-bold mb-2" style={{ color: NAVY }}>Category breakdown</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(summary.categories)
                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                    .map(([cat, count]) => (
                      <Badge key={cat} variant="outline" className="text-xs">
                        {cat}: <span className="font-bold ml-1">{count as number}</span>
                      </Badge>
                    ))}
                </div>
              </div>
            )}

            {/* Two columns: issues + features */}
            <div className="grid md:grid-cols-2 gap-4">
              <SectionList
                title="Top recurring issues"
                icon={<AlertTriangle className="h-4 w-4" style={{ color: RED }} />}
                items={summary.top_issues ?? []}
                renderItem={(it: any) => (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm">{it.title}</div>
                      <Badge variant="outline" className="text-[10px]">×{it.count_estimate}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{it.affected_area}</div>
                    {it.example_quote && (
                      <div className="text-xs italic mt-1 border-l-2 pl-2" style={{ borderColor: NAVY }}>
                        “{it.example_quote}”
                      </div>
                    )}
                  </>
                )}
              />
              <SectionList
                title="Most requested features"
                icon={<Lightbulb className="h-4 w-4 text-amber-500" />}
                items={summary.top_features ?? []}
                renderItem={(it: any) => (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm">{it.title}</div>
                      <Badge variant="outline" className="text-[10px]">×{it.count_estimate}</Badge>
                    </div>
                    {it.example_quote && (
                      <div className="text-xs italic mt-1 border-l-2 pl-2 border-amber-400">
                        “{it.example_quote}”
                      </div>
                    )}
                  </>
                )}
              />
            </div>

            {/* Confusing chapters */}
            {summary.top_chapters && summary.top_chapters.length > 0 && (
              <SectionList
                title="Confusing chapters / problems"
                icon={<Target className="h-4 w-4" style={{ color: NAVY }} />}
                items={summary.top_chapters}
                renderItem={(it: any) => (
                  <>
                    <div className="font-medium text-sm">{it.label}</div>
                    <div className="text-xs mt-1">{it.why_confusing}</div>
                    {it.example_quote && (
                      <div className="text-xs italic mt-1 border-l-2 pl-2" style={{ borderColor: NAVY }}>
                        “{it.example_quote}”
                      </div>
                    )}
                  </>
                )}
              />
            )}

            {/* Quick wins */}
            {summary.quick_wins && summary.quick_wins.length > 0 && (
              <div>
                <h3 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: NAVY }}>
                  <Zap className="h-4 w-4 text-amber-500" /> Quick wins (ship next)
                </h3>
                <ol className="space-y-2">
                  {summary.quick_wins.map((q, i) => (
                    <li key={i} className="border rounded-md p-3 flex items-start gap-3">
                      <div className="text-xs font-bold w-5 text-muted-foreground">{i + 1}.</div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-sm">{q.title}</div>
                          <Badge variant="outline" className={`text-[10px] border ${EFFORT_COLORS[q.effort] ?? ""}`}>
                            {q.effort}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{q.why}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Suggested Lovable prompts */}
            {summary.suggested_prompts && summary.suggested_prompts.length > 0 && (
              <div>
                <h3 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: NAVY }}>
                  <Sparkles className="h-4 w-4" /> Suggested Lovable prompts
                </h3>
                <div className="space-y-2">
                  {summary.suggested_prompts.map((p, i) => (
                    <div key={i} className="border rounded-md p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <div className="font-medium text-sm">{p.title}</div>
                          <div className="text-xs text-muted-foreground">{p.target_area}</div>
                        </div>
                        <Button size="sm" variant="default" className="h-7 text-xs shrink-0"
                          onClick={() => copyPrompt(p.prompt, p.title)}>
                          <Copy className="h-3 w-3 mr-1" /> Copy Fix Prompt
                        </Button>
                      </div>
                      <pre className="text-xs whitespace-pre-wrap bg-muted/40 rounded p-2 mt-2 font-mono leading-relaxed">
                        {p.prompt}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionList({
  title, icon, items, renderItem,
}: {
  title: string; icon: React.ReactNode; items: any[]; renderItem: (it: any) => React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: NAVY }}>
        {icon} {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">None identified.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="border rounded-md p-3">{renderItem(it)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
