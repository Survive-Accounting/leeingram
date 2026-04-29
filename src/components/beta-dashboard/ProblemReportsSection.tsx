import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Copy, RefreshCw, CheckCircle2, Eye, Archive, Bug, ExternalLink, AlertTriangle,
} from "lucide-react";
import type { InboxItem } from "./FeedbackInboxSection";

const NAVY = "#14213D";
const RED = "#CE1126";

type Severity = "critical" | "high" | "medium" | "low";

const SEVERITY_META: Record<Severity, { label: string; color: string; rank: number }> = {
  critical: { label: "Critical", color: "#7F1D1D", rank: 4 },
  high:     { label: "High",     color: "#DC2626", rank: 3 },
  medium:   { label: "Medium",   color: "#D97706", rank: 2 },
  low:      { label: "Low",      color: "#0891B2", rank: 1 },
};

const STATUS_LABELS: Record<string, string> = {
  new: "New", reviewing: "Reviewing", copied_to_lovable: "Copied to Lovable",
  fixed: "Fixed", wont_fix: "Won't Fix", archived: "Archived",
};
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 border-blue-200",
  reviewing: "bg-amber-100 text-amber-800 border-amber-200",
  copied_to_lovable: "bg-purple-100 text-purple-800 border-purple-200",
  fixed: "bg-green-100 text-green-800 border-green-200",
  wont_fix: "bg-zinc-100 text-zinc-700 border-zinc-200",
  archived: "bg-slate-100 text-slate-600 border-slate-200",
};

// Keyword pattern for written comments suggesting a problem
const PROBLEM_RX = /\b(broken|wrong|incorrect|missing|confusing|confused|typo|not loading|won'?t load|doesn'?t load|error|bug|crash|stuck|frozen|blank|can'?t (?:see|access|open|login|log in)|paywall|payment|charged|locked out|404|500)\b/i;
const CRITICAL_RX = /\b(login|log in|sign in|locked out|paywall|payment|charged|can'?t access|404|500|crash|won'?t load|blank|stuck|access denied|forbidden)\b/i;
const HIGH_RX = /\b(wrong|incorrect|broken|bug|error|missing|won'?t open|doesn'?t work|not working|freezes?)\b/i;
const MEDIUM_RX = /\b(confusing|confused|unclear|hard to follow|formatting|alignment|cut off|cropped|overlap)\b/i;
const LOW_RX = /\b(typo|spelling|punctuation|capitalization|grammar)\b/i;

function classifySeverity(item: InboxItem): Severity | null {
  const text = (item.feedback_text ?? "").trim();
  const issue = (item.issue_type ?? "").toLowerCase();
  const cat = (item.category ?? "").toLowerCase();
  const isThumbsDown = item.rating === "down";
  const isExplicitIssue = issue === "issue" || cat.includes("issue");

  // Hard signals first
  if (text && CRITICAL_RX.test(text)) return "critical";
  if (text && LOW_RX.test(text) && !HIGH_RX.test(text) && !MEDIUM_RX.test(text)) return "low";
  if (text && HIGH_RX.test(text)) return "high";
  if (text && MEDIUM_RX.test(text)) return "medium";

  // Structured signals
  if (isExplicitIssue) return "high";
  if (cat === "explanation feedback" && isThumbsDown) return "medium";
  if (cat === "ai response" && isThumbsDown) return "medium";
  if (cat === "helper rating" && isThumbsDown) return "medium";

  // Generic problem-keyword fallback
  if (text && PROBLEM_RX.test(text)) return "medium";

  return null; // not a problem report
}

function buildBugPrompt(item: InboxItem, severity: Severity): string {
  return [
    "A beta user reported a possible issue.",
    "",
    `Course: ${item.course_name ?? "—"}`,
    `Chapter: ${item.chapter_name ?? "—"}`,
    `Problem: ${item.asset_code ?? "—"}`,
    `Page/tool: ${item.tool ?? "—"}${item.action ? ` · ${item.action}` : ""}`,
    `Severity: ${SEVERITY_META[severity].label}`,
    `Report: "${(item.feedback_text ?? "").trim() || "(no text — flagged via thumbs-down or issue category)"}"`,
    "",
    "Please investigate and fix this issue. Prioritize correctness, student clarity, and a fast beta experience. If the issue is with an accounting explanation, verify the accounting logic before changing the UI. If the issue is UI-related, fix it without adding clutter.",
  ].join("\n");
}

export function ProblemReportsSection() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("beta-feedback-inbox", {
        body: { action: "list" },
      });
      if (error) throw error;
      setItems((data as any)?.items ?? []);
    } catch (e: any) {
      toast.error(`Failed to load problem reports: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = useCallback(async (item: InboxItem, status: string) => {
    setItems(prev => prev.map(it => it.id === item.id
      ? {
          ...it, status,
          status_meta: {
            ...it.status_meta,
            copied_at: status === "copied_to_lovable" ? new Date().toISOString() : it.status_meta.copied_at,
            reviewed_at: status === "reviewing" ? new Date().toISOString() : it.status_meta.reviewed_at,
            fixed_at: status === "fixed" ? new Date().toISOString() : it.status_meta.fixed_at,
            archived_at: status === "archived" ? new Date().toISOString() : it.status_meta.archived_at,
          },
        }
      : it));
    try {
      const { error } = await supabase.functions.invoke("beta-feedback-inbox", {
        body: {
          action: "update_status",
          source_table: item.source_table,
          source_id: item.source_id,
          status,
        },
      });
      if (error) throw error;
    } catch (e: any) {
      toast.error(`Failed to update status: ${e?.message ?? e}`);
      load();
    }
  }, [load]);

  // Classify + filter to problem reports only
  const problems = useMemo(() => {
    return items
      .map(it => ({ item: it, severity: classifySeverity(it) }))
      .filter((x): x is { item: InboxItem; severity: Severity } => x.severity !== null);
  }, [items]);

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    problems.forEach(p => { c[p.severity] += 1; });
    return c;
  }, [problems]);

  const copyPrompt = useCallback(async (item: InboxItem, severity: Severity) => {
    try {
      await navigator.clipboard.writeText(buildBugPrompt(item, severity));
      toast.success("Lovable prompt copied");
      updateStatus(item, "copied_to_lovable");
    } catch {
      toast.error("Could not copy");
    }
  }, [updateStatus]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return problems
      .filter(({ item, severity }) => {
        if (statusFilter === "active" && (item.status === "archived" || item.status === "fixed" || item.status === "wont_fix")) return false;
        if (statusFilter !== "active" && statusFilter !== "all" && item.status !== statusFilter) return false;
        if (severityFilter !== "all" && severity !== severityFilter) return false;
        if (!q) return true;
        const hay = [
          item.feedback_text, item.email, item.course_name, item.chapter_name,
          item.asset_code, item.tool, item.action, item.category, item.issue_type,
        ].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      })
      // Sort: severity DESC, then created_at DESC
      .sort((a, b) => {
        const s = SEVERITY_META[b.severity].rank - SEVERITY_META[a.severity].rank;
        if (s !== 0) return s;
        return a.item.created_at < b.item.created_at ? 1 : -1;
      });
  }, [problems, search, statusFilter, severityFilter]);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: NAVY }}>
              <Bug className="h-5 w-5" /> Problem Reports
            </h2>
            <p className="text-xs text-muted-foreground">
              {filtered.length} of {problems.length} problems · auto-classified from thumbs-down, explicit issues, and keyword scans
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search text, email, course, chapter, asset…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[260px] h-9"
            />
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[170px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active (open)</SelectItem>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* Severity summary chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(["critical", "high", "medium", "low"] as Severity[]).map(sev => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className="rounded-md border px-2.5 py-1 text-[11px] hover:bg-muted/50 transition flex items-center gap-1.5"
              style={{
                borderColor: severityFilter === sev ? SEVERITY_META[sev].color : undefined,
                color: SEVERITY_META[sev].color,
              }}
            >
              {sev === "critical" && <AlertTriangle className="h-3 w-3" />}
              <span className="font-semibold">{counts[sev]}</span>
              <span className="text-foreground/70">{SEVERITY_META[sev].label}</span>
            </button>
          ))}
        </div>

        <div className="border rounded-md overflow-hidden">
          <div className="max-h-[700px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[110px]">When</TableHead>
                  <TableHead className="w-[90px]">Severity</TableHead>
                  <TableHead className="w-[80px]">Course</TableHead>
                  <TableHead className="w-[160px]">Chapter</TableHead>
                  <TableHead className="w-[120px]">Asset</TableHead>
                  <TableHead className="w-[140px]">Page / tool</TableHead>
                  <TableHead>Student comment</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead className="w-[280px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-6 text-sm text-muted-foreground">Loading reports…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-6 text-sm text-muted-foreground italic">No problem reports match your filters.</TableCell></TableRow>
                ) : filtered.map(({ item, severity }) => {
                  const meta = SEVERITY_META[severity];
                  const assetHref = item.asset_code ? `/solutions/${item.asset_code}` : null;
                  return (
                    <TableRow key={item.id} className="align-top">
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(item.created_at).toLocaleDateString()}<br />
                        <span className="text-muted-foreground">
                          {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold"
                          style={{ borderColor: meta.color, color: meta.color }}
                        >
                          {severity === "critical" && <AlertTriangle className="h-3 w-3 mr-1 inline" />}
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{item.course_name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{item.chapter_name ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{item.asset_code ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {item.tool ?? "—"}
                        {item.action && <div className="text-muted-foreground">{item.action}</div>}
                      </TableCell>
                      <TableCell className="text-xs max-w-[360px]">
                        <div className="whitespace-pre-wrap break-words line-clamp-4">
                          {item.feedback_text || (
                            <span className="italic text-muted-foreground">
                              (no text — {item.category}: {item.issue_type ?? "flagged"})
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] border ${STATUS_COLORS[item.status] ?? STATUS_COLORS.new}`} variant="outline">
                          {STATUS_LABELS[item.status] ?? item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 justify-end">
                          <Button
                            size="sm" variant="default" className="h-7 text-xs"
                            style={{ background: RED, color: "white" }}
                            onClick={() => copyPrompt(item, severity)}
                          >
                            <Copy className="h-3 w-3 mr-1" /> Copy Prompt
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(item, "reviewing")}>
                            <Eye className="h-3 w-3 mr-1" /> Reviewing
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(item, "fixed")}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Fixed
                          </Button>
                          {assetHref && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                              <Link to={assetHref} target="_blank" rel="noopener">
                                <ExternalLink className="h-3 w-3 mr-1" /> Open
                              </Link>
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => updateStatus(item, "archived")}>
                            <Archive className="h-3 w-3 mr-1" /> Archive
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
