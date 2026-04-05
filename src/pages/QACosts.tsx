import { useState, useMemo } from "react";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { DollarSign, TrendingUp, Zap, Download, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useVaAccount } from "@/hooks/useVaAccount";
import { format, formatDistanceToNow, startOfMonth, startOfWeek, subDays } from "date-fns";

const OP_COLORS: Record<string, string> = {
  quiz_generation: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  asset_fix: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  bulk_fix: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  formula_generation: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  image_generation: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  supplementary_je: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  chapter_formula_generation: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  split_decision: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

type DateRange = "this_week" | "this_month" | "all_time";

function getDateFilter(range: DateRange): string | null {
  if (range === "this_week") return startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
  if (range === "this_month") return startOfMonth(new Date()).toISOString();
  return null;
}

export default function QACosts() {
  const { user } = useAuth();
  const { vaAccount } = useVaAccount();
  const isVa = !!vaAccount && vaAccount.role !== "admin";
  const [dateRange, setDateRange] = useState<DateRange>("this_month");
  const [opFilter, setOpFilter] = useState<string>("all");

  const dateFrom = getDateFilter(dateRange);

  // Fetch all cost logs (filtered)
  const { data: costLogs = [], isLoading } = useQuery({
    queryKey: ["ai-cost-logs", dateRange, opFilter],
    queryFn: async () => {
      let query = supabase
        .from("ai_cost_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (opFilter !== "all") query = query.eq("operation_type", opFilter);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Summary stats
  const summary = useMemo(() => {
    const monthStart = startOfMonth(new Date()).toISOString();
    const monthLogs = costLogs.filter((l: any) => l.created_at >= monthStart);
    const totalMonth = monthLogs.reduce((s: number, l: any) => s + (Number(l.estimated_cost_usd) || 0), 0);
    const totalAll = costLogs.reduce((s: number, l: any) => s + (Number(l.estimated_cost_usd) || 0), 0);

    // Most expensive op this month
    const opTotals: Record<string, number> = {};
    monthLogs.forEach((l: any) => {
      opTotals[l.operation_type] = (opTotals[l.operation_type] || 0) + (Number(l.estimated_cost_usd) || 0);
    });
    const topOp = Object.entries(opTotals).sort((a, b) => b[1] - a[1])[0];

    // Avg cost per quiz
    const quizLogs = monthLogs.filter((l: any) => l.operation_type === "quiz_generation");
    const avgQuiz = quizLogs.length > 0
      ? quizLogs.reduce((s: number, l: any) => s + (Number(l.estimated_cost_usd) || 0), 0) / quizLogs.length
      : 0;

    // Avg cost per fix
    const fixLogs = monthLogs.filter((l: any) => l.operation_type === "asset_fix");
    const avgFix = fixLogs.length > 0
      ? fixLogs.reduce((s: number, l: any) => s + (Number(l.estimated_cost_usd) || 0), 0) / fixLogs.length
      : 0;

    return { totalMonth, totalAll, topOp, avgQuiz, avgFix };
  }, [costLogs]);

  // Chart data — by operation type
  const chartData = useMemo(() => {
    const byOp: Record<string, number> = {};
    costLogs.forEach((l: any) => {
      byOp[l.operation_type] = (byOp[l.operation_type] || 0) + (Number(l.estimated_cost_usd) || 0);
    });
    return Object.entries(byOp)
      .map(([name, cost]) => ({ name: name.replace(/_/g, " "), cost: Number(cost.toFixed(4)) }))
      .sort((a, b) => b.cost - a.cost);
  }, [costLogs]);

  // Unique operation types for filter
  const opTypes = useMemo(() => {
    const set = new Set(costLogs.map((l: any) => l.operation_type));
    return Array.from(set).sort();
  }, [costLogs]);

  const exportCsv = () => {
    const headers = ["created_at", "operation_type", "asset_code", "model", "input_tokens", "output_tokens", "image_count", "estimated_cost_usd"];
    const rows = costLogs.map((l: any) => headers.map(h => l[h] ?? "").join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-costs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SurviveSidebarLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground">QA & AI Costs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Estimated costs for all AI operations across the platform. Updates in real time.
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Costs are estimates based on token usage and current Anthropic/HCTI pricing. Actual billed amounts may vary slightly.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="all_time">All Time</SelectItem>
            </SelectContent>
          </Select>

          <Select value={opFilter} onValueChange={setOpFilter}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder="All Operations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Operations</SelectItem>
              {opTypes.map(op => (
                <SelectItem key={op} value={op}>{op.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!isVa && (
            <Button variant="outline" size="sm" onClick={exportCsv} className="h-8 text-xs gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Month Spend</p>
              <p className="text-lg font-bold text-foreground mt-1">${summary.totalMonth.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">All Time</p>
              <p className="text-lg font-bold text-foreground mt-1">${summary.totalAll.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Top Op (Month)</p>
              <p className="text-sm font-bold text-foreground mt-1 truncate">
                {summary.topOp ? summary.topOp[0].replace(/_/g, " ") : "—"}
              </p>
              {summary.topOp && (
                <p className="text-[10px] text-muted-foreground">${summary.topOp[1].toFixed(2)}</p>
              )}
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg / Quiz</p>
              <p className="text-lg font-bold text-foreground mt-1">${summary.avgQuiz.toFixed(4)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg / Fix</p>
              <p className="text-lg font-bold text-foreground mt-1">${summary.avgFix.toFixed(4)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground">Cost by Operation</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 120, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={110} />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                  />
                  <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                {isLoading ? "Loading..." : "No cost data yet"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Log Table */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground">
              Recent AI Calls ({Math.min(costLogs.length, 50)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">Time</th>
                    <th className="text-left py-2 px-2 font-medium">Operation</th>
                    <th className="text-left py-2 px-2 font-medium">Context</th>
                    <th className="text-right py-2 px-2 font-medium">In Tokens</th>
                    <th className="text-right py-2 px-2 font-medium">Out Tokens</th>
                    <th className="text-right py-2 px-2 font-medium">Cost</th>
                    <th className="text-left py-2 px-2 font-medium">Model</th>
                  </tr>
                </thead>
                <tbody>
                  {costLogs.slice(0, 50).map((log: any) => (
                    <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </td>
                      <td className="py-1.5 px-2">
                        <Badge variant="outline" className={`text-[9px] ${OP_COLORS[log.operation_type] || "bg-muted text-muted-foreground"}`}>
                          {log.operation_type?.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="py-1.5 px-2 text-muted-foreground max-w-[200px] truncate">
                        {log.asset_code || (log.topic_id ? `topic:${log.topic_id.slice(0, 8)}` : log.chapter_id ? `ch:${log.chapter_id.slice(0, 8)}` : "—")}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">
                        {log.input_tokens?.toLocaleString() || (log.image_count ? `${log.image_count} img` : "—")}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">
                        {log.output_tokens?.toLocaleString() || "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-medium text-foreground">
                        {log.estimated_cost_usd ? `$${Number(log.estimated_cost_usd).toFixed(4)}` : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-muted-foreground text-[10px] font-mono truncate max-w-[120px]">
                        {log.model?.replace("claude-", "").replace("-20250514", "") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {costLogs.length === 0 && !isLoading && (
                <p className="text-center text-muted-foreground text-sm py-8">No cost logs recorded yet. Costs will appear here after AI operations run.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </SurviveSidebarLayout>
  );
}
