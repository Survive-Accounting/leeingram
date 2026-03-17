import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Copy, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveAs } from "file-saver";

interface Props {
  chapterId: string;
  courseName?: string;
  chapterName?: string;
}

const ERROR_TYPE_COLORS: Record<string, string> = {
  hallucination: "bg-destructive/15 text-destructive border-destructive/30",
  incorrect_calculation: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  wrong_account: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  missing_entry: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  wrong_debit_credit: "bg-muted text-muted-foreground border-border",
  wrong_date: "bg-muted text-muted-foreground border-border",
  formatting: "bg-muted text-muted-foreground border-border",
  other: "bg-muted text-muted-foreground border-border",
};

const ERROR_FIELD_OPTIONS = [
  "journal_entries", "worked_steps", "answer_text", "problem_text",
  "important_formulas", "concept_notes", "exam_traps",
  "numeric_values", "account_names", "other",
];

const ERROR_TYPE_OPTIONS = [
  "hallucination", "incorrect_calculation", "wrong_account",
  "missing_entry", "wrong_debit_credit", "wrong_date", "formatting", "other",
];

function label(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function Phase2DebugNotesTab({ chapterId, courseName, chapterName }: Props) {
  const qc = useQueryClient();
  const [filterField, setFilterField] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterResolved, setFilterResolved] = useState<"all" | "unresolved" | "resolved">("all");
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["debug-notes", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generation_debug_notes" as any)
        .select("*")
        .eq("chapter_id", chapterId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Fetch asset names for display
  const assetIds = useMemo(() => [...new Set(notes.map((n: any) => n.teaching_asset_id))], [notes]);
  const { data: assetMap = {} } = useQuery({
    queryKey: ["debug-notes-assets", assetIds],
    queryFn: async () => {
      if (assetIds.length === 0) return {};
      const { data, error } = await supabase
        .from("teaching_assets")
        .select("id, asset_name")
        .in("id", assetIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const a of data ?? []) map[a.id] = a.asset_name;
      return map;
    },
    enabled: assetIds.length > 0,
  });

  const filtered = useMemo(() => {
    let result = notes;
    if (filterField !== "all") result = result.filter((n: any) => n.error_field === filterField);
    if (filterType !== "all") result = result.filter((n: any) => n.error_type === filterType);
    if (filterResolved === "unresolved") result = result.filter((n: any) => !n.resolved);
    if (filterResolved === "resolved") result = result.filter((n: any) => n.resolved);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((n: any) => (n.admin_note ?? "").toLowerCase().includes(q));
    }
    return result;
  }, [notes, filterField, filterType, filterResolved, search]);

  // Summary
  const totalErrors = notes.length;
  const unresolvedCount = notes.filter((n: any) => !n.resolved).length;
  const assetsAffected = new Set(notes.map((n: any) => n.teaching_asset_id)).size;
  const mostCommon = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of notes) counts[n.error_type] = (counts[n.error_type] || 0) + 1;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || "—";
  }, [notes]);

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) => {
      const updates: any = { resolved };
      if (resolved) updates.resolved_at = new Date().toISOString();
      else updates.resolved_at = null;
      const { error } = await supabase.from("generation_debug_notes" as any).update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["debug-notes", chapterId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Export
  const generateUnresolvedBundle = () => {
    const unresolved = notes.filter((n: any) => !n.resolved);
    const date = new Date().toLocaleDateString();
    let md = `# Debug Notes — Unresolved\n\nChapter: ${chapterName || "?"} | Course: ${courseName || "?"} | Date: ${date}\n\nTotal Unresolved: ${unresolved.length}\n\n---\n`;
    const grouped: Record<string, any[]> = {};
    for (const n of unresolved) {
      const key = n.teaching_asset_id;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(n);
    }
    for (const [assetId, items] of Object.entries(grouped)) {
      const name = assetMap[assetId] || assetId;
      md += `\n## Asset: ${name}\n`;
      items.forEach((n: any, i: number) => {
        md += `\n### Error ${i + 1}\n\n- Field: ${label(n.error_field)}\n- Type: ${label(n.error_type)}\n- What was wrong: ${n.admin_note}\n- Correct answer: ${n.correct_answer || "Not provided"}\n- Annotated by: ${n.annotated_by || "?"}\n- Date: ${new Date(n.created_at).toLocaleDateString()}\n`;
      });
      md += `\n---\n`;
    }
    return md;
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const truncate = (text: string | null, id: string) => {
    if (!text) return <span className="text-muted-foreground">—</span>;
    if (text.length <= 80 || expandedIds.has(id)) {
      return (
        <span className="cursor-pointer" onClick={() => toggleExpand(id)}>
          {text}
        </span>
      );
    }
    return (
      <span className="cursor-pointer" onClick={() => toggleExpand(id)}>
        {text.slice(0, 80)}… <span className="text-primary text-[10px]">more</span>
      </span>
    );
  };

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Errors", value: totalErrors },
          { label: "Unresolved", value: unresolvedCount },
          { label: "Most Common", value: label(mostCommon) },
          { label: "Assets Affected", value: assetsAffected },
        ].map(c => (
          <Card key={c.label} className="bg-card border-border">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{c.label}</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter bar + export */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterField} onValueChange={setFilterField}>
          <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Error Field" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Fields</SelectItem>
            {ERROR_FIELD_OPTIONS.map(f => <SelectItem key={f} value={f}>{label(f)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="Error Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {ERROR_TYPE_OPTIONS.map(t => <SelectItem key={t} value={t}>{label(t)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterResolved} onValueChange={v => setFilterResolved(v as any)}>
          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unresolved">Unresolved</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search notes…"
          className="h-7 w-40 text-xs"
        />
        <div className="ml-auto flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => {
              navigator.clipboard.writeText(generateUnresolvedBundle());
              toast.success("Copied unresolved bundle");
            }}
          >
            <Copy className="h-3 w-3 mr-1" /> Copy Unresolved
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => {
              const blob = new Blob([generateUnresolvedBundle()], { type: "text/markdown;charset=utf-8" });
              saveAs(blob, `debug-unresolved-${chapterId}-${new Date().toISOString().slice(0, 10)}.md`);
            }}
          >
            <Download className="h-3 w-3 mr-1" /> Download
          </Button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">No debug notes found</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Asset</TableHead>
              <TableHead className="text-xs">Field</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">What Was Wrong</TableHead>
              <TableHead className="text-xs">Correct Answer</TableHead>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs w-16">Resolved</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((n: any) => (
              <TableRow key={n.id}>
                <TableCell className="font-mono text-xs font-bold">
                  {assetMap[n.teaching_asset_id] || n.teaching_asset_id?.slice(0, 8)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">{label(n.error_field)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] ${ERROR_TYPE_COLORS[n.error_type] || ERROR_TYPE_COLORS.other}`}>
                    {label(n.error_type)}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-foreground/80 max-w-[200px]">
                  {truncate(n.admin_note, `note-${n.id}`)}
                </TableCell>
                <TableCell className="text-xs text-foreground/70 max-w-[160px]">
                  {truncate(n.correct_answer, `ans-${n.id}`)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(n.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={!!n.resolved}
                    onCheckedChange={(checked) => resolveMutation.mutate({ id: n.id, resolved: !!checked })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
