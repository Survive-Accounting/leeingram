import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ExternalLink, Flag, CheckCircle2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  chapterIds: string[];
}

export function SheetPrepDashboard({ chapterIds }: Props) {
  const { data: assets, isLoading } = useQuery({
    queryKey: ["sp-va-tasks", chapterIds],
    queryFn: async () => {
      if (!chapterIds.length) return [];
      const { data, error } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, source_ref, google_sheet_status, sheet_master_url, sheet_practice_url, sheet_promo_url, chapter_id, course_id, problem_type, difficulty")
        .in("chapter_id", chapterIds)
        .in("google_sheet_status", ["auto_created", "verified_by_va"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: chapterIds.length > 0,
  });

  const { data: chapters } = useQuery({
    queryKey: ["chapters-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("chapters").select("id, chapter_number, chapter_name");
      return data ?? [];
    },
  });

  const getChapter = (id: string) => chapters?.find(c => c.id === id);

  const pending = assets?.filter(a => a.google_sheet_status === "auto_created") ?? [];
  const verified = assets?.filter(a => a.google_sheet_status === "verified_by_va") ?? [];

  const sheetEmojis: Record<string, { emoji: string; tooltip: string }> = {
    M: { emoji: "📋", tooltip: "Master: tutoring / filming" },
    P: { emoji: "✏️", tooltip: "Practice: student practice" },
    Pr: { emoji: "📣", tooltip: "Promo: shareable promo" },
  };

  const SheetBtn = ({ url, label }: { url: string | null; label: string }) => {
    if (!url) return <span className="text-muted-foreground/50">—</span>;
    const meta = sheetEmojis[label] || { emoji: "📋", tooltip: label };
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <a href={url} target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform cursor-pointer">
            {meta.emoji}
          </a>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">{meta.tooltip}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-foreground">Sheet Prep Dashboard</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Phase 2 — Verify and prepare Google Sheets for teaching assets
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
          <p className="text-2xl font-bold text-amber-400 tabular-nums">{pending.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending Verification</p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">{verified.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Verified</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : !assets?.length ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No sheets to verify in your assigned chapters.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50">
                <TableHead className="text-xs">Asset</TableHead>
                <TableHead className="text-xs">Chapter</TableHead>
                <TableHead className="text-xs">Sheets</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((a) => {
                const ch = getChapter(a.chapter_id);
                return (
                  <TableRow key={a.id} className="text-xs">
                    <TableCell className="font-mono text-foreground">{a.asset_name || a.source_ref || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">Ch {ch?.chapter_number}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <SheetBtn url={a.sheet_master_url} label="M" />
                        <SheetBtn url={a.sheet_practice_url} label="P" />
                        <SheetBtn url={a.sheet_promo_url} label="Pr" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[9px] ${
                        a.google_sheet_status === "verified_by_va"
                          ? "border-emerald-500/40 text-emerald-400"
                          : "border-amber-500/40 text-amber-400"
                      }`}>
                        {a.google_sheet_status === "verified_by_va" ? "Verified" : "Pending"}
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
