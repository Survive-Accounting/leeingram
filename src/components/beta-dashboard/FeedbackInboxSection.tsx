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
  Copy, RefreshCw, ThumbsUp, ThumbsDown, CheckCircle2, Eye, Archive, MessageSquare,
} from "lucide-react";

const NAVY = "#14213D";

export interface InboxItem {
  id: string;
  source_table: string;
  source_id: string;
  created_at: string;
  email: string | null;
  student_name: string | null;
  course_id: string | null;
  course_name: string | null;
  chapter_id: string | null;
  chapter_name: string | null;
  asset_id: string | null;
  asset_code: string | null;
  tool: string | null;
  action: string | null;
  rating: "up" | "down" | "neutral" | null;
  feedback_text: string | null;
  category: string;
  issue_type: string | null;
  status: string;
  status_meta: {
    copied_at: string | null;
    reviewed_at: string | null;
    fixed_at: string | null;
    archived_at: string | null;
    notes: string | null;
  };
}

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  reviewing: "Reviewing",
  copied_to_lovable: "Copied to Lovable",
  fixed: "Fixed",
  wont_fix: "Won't Fix",
  needs_more_info: "Needs More Info",
  archived: "Archived",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 border-blue-200",
  reviewing: "bg-amber-100 text-amber-800 border-amber-200",
  copied_to_lovable: "bg-purple-100 text-purple-800 border-purple-200",
  fixed: "bg-green-100 text-green-800 border-green-200",
  wont_fix: "bg-zinc-100 text-zinc-700 border-zinc-200",
  needs_more_info: "bg-orange-100 text-orange-800 border-orange-200",
  archived: "bg-slate-100 text-slate-600 border-slate-200",
};

function buildLovablePrompt(item: InboxItem): string {
  const lines = [
    "A beta user reported this issue in Survive Accounting.",
    "",
    `Course: ${item.course_name ?? "—"}`,
    `Chapter: ${item.chapter_name ?? "—"}`,
    `Problem: ${item.asset_code ?? "—"}`,
    `Tool: ${item.tool ?? "—"}`,
    `Helper action: ${item.action ?? "—"}`,
    `Rating: ${item.rating ?? "—"}`,
    `Category: ${item.category}`,
    `Feedback: "${(item.feedback_text ?? "").trim() || "(no text)"}"`,
    "",
    "Please review this part of the student experience and improve it. Make the fix concise, student-friendly, and aligned with the Survive Accounting beta experience. Prioritize clarity, speed, and usefulness for accounting students preparing for finals.",
    "",
    "If this is about an AI helper response, improve the explanation style so it is:",
    "- concise",
    "- step-by-step",
    "- focused on accounting logic",
    "- clear about calculations and journal entries",
    "- written like Lee is tutoring the student",
    "",
    "If this is about UI/UX, improve the interface without adding clutter.",
  ];
  return lines.join("\n");
}

export function FeedbackInboxSection() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("beta-feedback-inbox", {
        body: { action: "list" },
      });
      if (error) throw error;
      setItems((data as any)?.items ?? []);
    } catch (e: any) {
      toast.error(`Failed to load feedback: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = useCallback(async (item: InboxItem, status: string) => {
    // Optimistic
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

  const copyPrompt = useCallback(async (item: InboxItem) => {
    const prompt = buildLovablePrompt(item);
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Lovable prompt copied to clipboard");
      updateStatus(item, "copied_to_lovable");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }, [updateStatus]);

  const categories = useMemo(
    () => Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(it => {
      if (statusFilter === "active" && (it.status === "archived" || it.status === "fixed" || it.status === "wont_fix")) return false;
      if (statusFilter !== "active" && statusFilter !== "all" && it.status !== statusFilter) return false;
      if (categoryFilter !== "all" && it.category !== categoryFilter) return false;
      if (ratingFilter !== "all" && (it.rating ?? "none") !== ratingFilter) return false;
      if (!q) return true;
      const hay = [
        it.feedback_text, it.email, it.course_name, it.chapter_name,
        it.asset_code, it.tool, it.action, it.category, it.issue_type,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [items, search, statusFilter, categoryFilter, ratingFilter]);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: NAVY }}>
              <MessageSquare className="h-5 w-5" /> Feedback Inbox
            </h2>
            <p className="text-xs text-muted-foreground">
              {filtered.length} of {items.length} items · combines thumbs ratings, AI response feedback, suggestions, issues, and chapter questions
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search text, email, course, chapter, asset…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[260px] h-9"
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
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Rating" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ratings</SelectItem>
                <SelectItem value="up">👍 Up</SelectItem>
                <SelectItem value="down">👎 Down</SelectItem>
                <SelectItem value="none">No rating</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        <div className="border rounded-md overflow-hidden">
          <div className="max-h-[700px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[120px]">When</TableHead>
                  <TableHead className="w-[160px]">Student</TableHead>
                  <TableHead className="w-[80px]">Course</TableHead>
                  <TableHead className="w-[160px]">Chapter</TableHead>
                  <TableHead className="w-[120px]">Asset</TableHead>
                  <TableHead className="w-[120px]">Tool / Action</TableHead>
                  <TableHead className="w-[60px]">Rating</TableHead>
                  <TableHead>Feedback</TableHead>
                  <TableHead className="w-[130px]">Category</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead className="w-[260px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-6 text-sm text-muted-foreground">Loading feedback…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-6 text-sm text-muted-foreground italic">No feedback matches your filters.</TableCell></TableRow>
                ) : filtered.map(item => (
                  <TableRow key={item.id} className="align-top">
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString()}<br />
                      <span className="text-muted-foreground">
                        {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.student_name && <div className="font-medium">{item.student_name}</div>}
                      <div className="text-muted-foreground break-all">{item.email ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-xs">{item.course_name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{item.chapter_name ?? "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{item.asset_code ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      {item.tool ?? "—"}
                      {item.action && <div className="text-muted-foreground">{item.action}</div>}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.rating === "up" ? <ThumbsUp className="h-4 w-4 text-green-600 inline" /> :
                       item.rating === "down" ? <ThumbsDown className="h-4 w-4 text-red-600 inline" /> :
                       <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs max-w-[320px]">
                      <div className="whitespace-pre-wrap break-words line-clamp-4">
                        {item.feedback_text || <span className="italic text-muted-foreground">(no text)</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] whitespace-nowrap">{item.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] border ${STATUS_COLORS[item.status] ?? STATUS_COLORS.new}`} variant="outline">
                        {STATUS_LABELS[item.status] ?? item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 justify-end">
                        <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => copyPrompt(item)}>
                          <Copy className="h-3 w-3 mr-1" /> Copy Prompt
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(item, "reviewing")}>
                          <Eye className="h-3 w-3 mr-1" /> Reviewing
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(item, "fixed")}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Fixed
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
