import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Factory, FileCheck, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

interface Props {
  chapterIds: string[];
}

export function ContentCreationDashboard({ chapterIds }: Props) {
  const { data: assets, isLoading } = useQuery({
    queryKey: ["cc-va-tasks", chapterIds],
    queryFn: async () => {
      if (!chapterIds.length) return [];
      const { data, error } = await supabase
        .from("chapter_problems")
        .select("id, title, source_code, source_label, pipeline_status, chapter_id, course_id")
        .in("chapter_id", chapterIds)
        .in("pipeline_status", ["imported", "generated", "approved"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: chapterIds.length > 0,
  });

  const { data: chapters } = useQuery({
    queryKey: ["chapters-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("chapters").select("id, chapter_number, chapter_name, course_id");
      return data ?? [];
    },
  });

  const { data: courses } = useQuery({
    queryKey: ["courses-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, code");
      return data ?? [];
    },
  });

  const getChapter = (id: string) => chapters?.find(c => c.id === id);
  const getCourse = (id: string) => courses?.find(c => c.id === id);

  const statusColor: Record<string, string> = {
    imported: "border-blue-500/40 text-blue-400",
    generated: "border-amber-500/40 text-amber-400",
    approved: "border-emerald-500/40 text-emerald-400",
  };

  const imported = assets?.filter(a => a.pipeline_status === "imported") ?? [];
  const generated = assets?.filter(a => a.pipeline_status === "generated") ?? [];
  const approved = assets?.filter(a => a.pipeline_status === "approved") ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-foreground">Content Creation Dashboard</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Phase 1 — Import, generate, review, and approve teaching assets
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
          <p className="text-2xl font-bold text-blue-400 tabular-nums">{imported.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Imported</p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
          <p className="text-2xl font-bold text-amber-400 tabular-nums">{generated.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Generated</p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">{approved.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Approved</p>
        </div>
      </div>

      {/* Task table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading tasks…
        </div>
      ) : !assets?.length ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No tasks in your assigned chapters yet.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50">
                <TableHead className="text-xs">Source Code</TableHead>
                <TableHead className="text-xs">Title</TableHead>
                <TableHead className="text-xs">Course</TableHead>
                <TableHead className="text-xs">Chapter</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((a) => {
                const ch = getChapter(a.chapter_id);
                const co = getCourse(a.course_id);
                return (
                  <TableRow key={a.id} className="text-xs">
                    <TableCell className="font-mono text-foreground">{a.source_code || a.source_label || "—"}</TableCell>
                    <TableCell className="text-foreground max-w-[200px] truncate">{a.title || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{co?.code || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">Ch {ch?.chapter_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[9px] ${statusColor[a.pipeline_status] || ""}`}>
                        {a.pipeline_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
