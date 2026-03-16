import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MoreHorizontal, StickyNote, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_CYCLE = ["not_started", "in_progress", "complete"] as const;
type OutputStatus = (typeof STATUS_CYCLE)[number];

const STATUS_COLUMNS = [
  { key: "whiteboard_status", label: "Whiteboard" },
  { key: "mc_status", label: "MC" },
  { key: "video_production_status", label: "Video" },
  { key: "ebook_status", label: "Ebook" },
  { key: "qa_status", label: "QA" },
  { key: "deployment_status", label: "Deploy" },
] as const;

function StatusPill({ status, onClick, disabled }: { status: OutputStatus; onClick: () => void; disabled?: boolean }) {
  if (status === "complete") {
    return (
      <button onClick={onClick} disabled={disabled} className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors">
        ✓
      </button>
    );
  }
  if (status === "in_progress") {
    return (
      <button onClick={onClick} disabled={disabled} className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors">
        In Progress
      </button>
    );
  }
  return (
    <button onClick={onClick} disabled={disabled} className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground border border-border hover:bg-muted/80 transition-colors">
      —
    </button>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const styles: Record<number, string> = {
    1: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    2: "bg-zinc-400/20 text-zinc-300 border-zinc-400/40",
    3: "bg-zinc-600/20 text-zinc-500 border-zinc-600/40",
  };
  return (
    <Badge variant="outline" className={cn("text-[10px] font-bold", styles[rank] || styles[3])}>
      R{rank}
    </Badge>
  );
}

export function CoreAssetsTab() {
  const [syncingAssetId, setSyncingAssetId] = useState<string | null>(null);
  const { workspace } = useActiveWorkspace();
  const qc = useQueryClient();
  const chapterId = workspace?.chapterId;

  const { data: coreAssets = [], isLoading } = useQuery({
    queryKey: ["core-assets", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, source_ref, core_rank, whiteboard_status, mc_status, video_production_status, ebook_status, qa_status, deployment_status, admin_notes")
        .eq("chapter_id", chapterId!)
        .eq("phase2_status", "core_asset")
        .order("core_rank", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!chapterId,
  });

  // ── Metrics ────────────────────────────────────────────────────
  const totalCore = coreAssets.length;
  const mcComplete = coreAssets.filter((a: any) => a.mc_status === "complete").length;
  const videoComplete = coreAssets.filter((a: any) => a.video_production_status === "complete").length;

  // ── Status cycle mutation ──────────────────────────────────────
  const cycleMutation = useMutation({
    mutationFn: async ({ assetId, column, currentStatus }: { assetId: string; column: string; currentStatus: string }) => {
      const idx = STATUS_CYCLE.indexOf(currentStatus as OutputStatus);
      const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
      const { error } = await supabase
        .from("teaching_assets")
        .update({ [column]: next } as any)
        .eq("id", assetId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["core-assets", chapterId] }),
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Rank / remove mutation ─────────────────────────────────────
  const actionMutation = useMutation({
    mutationFn: async ({ assetId, updates }: { assetId: string; updates: Record<string, any> }) => {
      const { error } = await supabase
        .from("teaching_assets")
        .update(updates)
        .eq("id", assetId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["core-assets", chapterId] });
      qc.invalidateQueries({ queryKey: ["teaching-assets"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!chapterId) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Select a chapter to view core assets.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Total Core</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">{totalCore}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">MC Complete</p>
            <p className="text-2xl font-bold text-emerald-400 tabular-nums">{mcComplete}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Videos Complete</p>
            <p className="text-2xl font-bold text-emerald-400 tabular-nums">{videoComplete}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden border border-border bg-background/95">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-xs w-14">Rank</TableHead>
              <TableHead className="text-xs">Asset Code</TableHead>
              <TableHead className="text-xs">Ref</TableHead>
              {STATUS_COLUMNS.map((col) => (
                <TableHead key={col.key} className="text-xs text-center w-20">{col.label}</TableHead>
              ))}
              <TableHead className="text-xs w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9 + STATUS_COLUMNS.length} className="text-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…
                </TableCell>
              </TableRow>
            ) : coreAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9 + STATUS_COLUMNS.length} className="text-center text-muted-foreground text-xs py-8">
                  No core assets selected for this chapter yet. Use Phase 2 Review to select assets.
                </TableCell>
              </TableRow>
            ) : (
              coreAssets.map((a: any) => (
                <TableRow key={a.id} className="border-border">
                  <TableCell><RankBadge rank={a.core_rank ?? 3} /></TableCell>
                  <TableCell className="text-xs font-mono font-medium text-foreground">{a.asset_name}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{a.source_ref || "—"}</TableCell>
                  {STATUS_COLUMNS.map((col) => (
                    <TableCell key={col.key} className="text-center">
                      <StatusPill
                        status={(a[col.key] || "not_started") as OutputStatus}
                        disabled={cycleMutation.isPending}
                        onClick={() => cycleMutation.mutate({ assetId: a.id, column: col.key, currentStatus: a[col.key] || "not_started" })}
                      />
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {/* Admin notes popover */}
                      {Array.isArray(a.admin_notes) && a.admin_notes.length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <StickyNote className="h-3 w-3 text-amber-400" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3">
                            <p className="text-xs font-bold text-foreground mb-2">Admin Notes</p>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto">
                              {(a.admin_notes as any[]).map((n: any) => (
                                <div key={n.id} className="text-xs">
                                  <span className="text-muted-foreground">{new Date(n.date).toLocaleDateString()}</span>{" "}
                                  <span className="text-foreground/80">{n.text}</span>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                      {/* Actions dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {[1, 2, 3].filter(r => r !== a.core_rank).map(r => (
                            <DropdownMenuItem key={r} onClick={() => actionMutation.mutate({ assetId: a.id, updates: { core_rank: r } })}>
                              Change to Rank {r}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuItem onClick={() => actionMutation.mutate({ assetId: a.id, updates: { phase2_status: "hold", core_rank: null } })}>
                            Move to Hold
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => actionMutation.mutate({ assetId: a.id, updates: { phase2_status: null, core_rank: null } })}>
                            Remove from Phase 2
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
