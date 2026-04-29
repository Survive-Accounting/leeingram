import { useCallback, useEffect, useMemo, useState } from "react";
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
  Copy, RefreshCw, CheckCircle2, Eye, Archive, Lightbulb, ThumbsUp, ThumbsDown,
} from "lucide-react";
import type { InboxItem } from "./FeedbackInboxSection";

const NAVY = "#14213D";
const RED = "#CE1126";

const STATUS_LABELS: Record<string, string> = {
  new: "New", reviewing: "Reviewing", copied_to_lovable: "Copied to Lovable",
  fixed: "Shipped", wont_fix: "Won't Build", archived: "Archived",
};
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 border-blue-200",
  reviewing: "bg-amber-100 text-amber-800 border-amber-200",
  copied_to_lovable: "bg-purple-100 text-purple-800 border-purple-200",
  fixed: "bg-green-100 text-green-800 border-green-200",
  wont_fix: "bg-zinc-100 text-zinc-700 border-zinc-200",
  archived: "bg-slate-100 text-slate-600 border-slate-200",
};

const SUGGESTION_RX = /\b(could you|can you|would be (?:nice|great|cool|helpful)|should (?:add|have)|wish (?:there|it|you)|please add|feature|suggestion|idea|i'?d love|it would help|maybe add|why (?:not|don'?t)|how about)\b/i;

function isSuggestion(item: InboxItem): boolean {
  if (item.category === "Feature suggestion") return true;
  const text = (item.feedback_text ?? "").trim();
  if (!text) return false;
  return SUGGESTION_RX.test(text);
}

function buildSuggestionPrompt(item: InboxItem): string {
  return [
    "A beta user suggested a feature or improvement for Survive Accounting.",
    "",
    `Course: ${item.course_name ?? "—"}`,
    `Chapter: ${item.chapter_name ?? "—"}`,
    `Tool / area: ${item.tool ?? "—"}${item.action ? ` · ${item.action}` : ""}`,
    `Suggestion: "${(item.feedback_text ?? "").trim() || "(no text — voted on an idea card)"}"`,
    "",
    "Please evaluate this suggestion. If it's a quick, high-value win that fits the existing student dashboard and beta scope, implement it. Keep the navy + red brand. Do not add clutter — prefer extending an existing surface over creating a new one. If it would require significant new infrastructure or is out of scope for the beta, propose the smallest possible v1 instead.",
  ].join("\n");
}

export function FeatureSuggestionsSection() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("beta-feedback-inbox", {
        body: { action: "list" },
      });
      if (error) throw error;
      setItems((data as any)?.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
      toast.error(`Failed to load suggestions: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = useCallback(async (item: InboxItem, status: string) => {
    setItems(prev => prev.map(it => it.id === item.id ? { ...it, status } : it));
    try {
      const { error } = await supabase.functions.invoke("beta-feedback-inbox", {
        body: { action: "update_status", source_table: item.source_table, source_id: item.source_id, status },
      });
      if (error) throw error;
    } catch (e: any) {
      toast.error(`Failed to update status: ${e?.message ?? e}`);
      load();
    }
  }, [load]);

  const copyPrompt = useCallback(async (item: InboxItem) => {
    try {
      await navigator.clipboard.writeText(buildSuggestionPrompt(item));
      toast.success("Lovable prompt copied");
      updateStatus(item, "copied_to_lovable");
    } catch {
      toast.error("Could not copy");
    }
  }, [updateStatus]);

  const suggestions = useMemo(() => items.filter(isSuggestion), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suggestions.filter(item => {
      if (statusFilter === "active" && (item.status === "archived" || item.status === "fixed" || item.status === "wont_fix")) return false;
      if (statusFilter !== "active" && statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        item.feedback_text, item.email, item.course_name, item.chapter_name,
        item.asset_code, item.tool, item.action,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [suggestions, search, statusFilter]);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: NAVY }}>
              <Lightbulb className="h-5 w-5" /> Feature Suggestions
            </h2>
            <p className="text-xs text-muted-foreground">
              {filtered.length} of {suggestions.length} suggestions · pulled from idea votes and request-style comments
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[220px] h-9"
            />
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

        <div className="border rounded-md overflow-hidden">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[110px]">When</TableHead>
                  <TableHead className="w-[80px]">Course</TableHead>
                  <TableHead className="w-[160px]">Chapter</TableHead>
                  <TableHead className="w-[140px]">Area</TableHead>
                  <TableHead className="w-[60px]">Vote</TableHead>
                  <TableHead>Suggestion</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead className="w-[260px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-6 text-sm text-muted-foreground">Loading suggestions…</TableCell></TableRow>
                ) : error ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-6 text-sm text-destructive">{error}</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-sm text-muted-foreground italic">
                    {suggestions.length === 0
                      ? "No feature suggestions yet — students haven't requested anything."
                      : "No suggestions match your filters."}
                  </TableCell></TableRow>
                ) : filtered.map(item => (
                  <TableRow key={item.id} className="align-top">
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-xs">{item.course_name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{item.chapter_name ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      {item.tool ?? "—"}
                      {item.action && <div className="text-muted-foreground">{item.action}</div>}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.rating === "up" ? <ThumbsUp className="h-4 w-4 text-green-600 inline" /> :
                       item.rating === "down" ? <ThumbsDown className="h-4 w-4 text-red-600 inline" /> :
                       <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs max-w-[400px]">
                      <div className="whitespace-pre-wrap break-words line-clamp-4">
                        {item.feedback_text || <span className="italic text-muted-foreground">(voted on idea card)</span>}
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
                          onClick={() => copyPrompt(item)}
                        >
                          <Copy className="h-3 w-3 mr-1" /> Copy Prompt
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(item, "reviewing")}>
                          <Eye className="h-3 w-3 mr-1" /> Reviewing
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(item, "fixed")}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Shipped
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => updateStatus(item, "archived")}>
                          <Archive className="h-3 w-3 mr-1" /> Archive
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
