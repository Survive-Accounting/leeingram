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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreHorizontal, StickyNote, Loader2, RefreshCw, ListPlus, Film, BookOpen, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/Tip";

const STUDENT_BASE_URL = "https://learn.surviveaccounting.com";

/** Tracks the last copied embed button so it glows yellow */
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

/* ── Add MC to Hidden_Data popover button ── */
function AddMCButton({ assetId, hasSheet }: { assetId: string; hasSheet: boolean }) {
  const [open, setOpen] = useState(false);
  const [selectedSet, setSelectedSet] = useState<string>("");
  const [syncing, setSyncing] = useState(false);

  const { data: availableSets = [] } = useQuery({
    queryKey: ["mc-export-sets-for-asset", assetId],
    queryFn: async () => {
      const { data: approvedQs } = await supabase
        .from("banked_questions")
        .select("id")
        .eq("teaching_asset_id", assetId)
        .eq("review_status", "approved");
      if (!approvedQs?.length) return [];
      const qIds = approvedQs.map(q => q.id);
      const { data: esqs } = await supabase
        .from("export_set_questions")
        .select("export_set_id, banked_question_id")
        .in("banked_question_id", qIds);
      if (!esqs?.length) return [];
      const setCountMap = new Map<string, number>();
      for (const row of esqs) {
        setCountMap.set(row.export_set_id, (setCountMap.get(row.export_set_id) || 0) + 1);
      }
      const setIds = [...setCountMap.keys()];
      const { data: sets } = await supabase
        .from("export_sets")
        .select("id, name")
        .in("id", setIds);
      if (!sets) return [];
      return sets.map(s => ({
        id: s.id,
        name: s.name,
        questionCount: setCountMap.get(s.id) || 0,
      }));
    },
    enabled: open && hasSheet,
  });

  const handleSync = async () => {
    if (!selectedSet) { toast.error("Select an export set"); return; }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-mc-to-sheet", {
        body: { teaching_asset_id: assetId, export_set_id: selectedSet },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Added ${data.questions_added} MC questions from '${data.export_set_name}' to Hidden_Data`);
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Sync MC failed");
    } finally {
      setSyncing(false);
    }
  };

  if (!hasSheet) {
    return (
      <Tip label="Create a sheet first">
        <Button variant="outline" size="sm" className="h-6 w-6 p-0 opacity-50 cursor-not-allowed" disabled>
          <ListPlus className="h-3 w-3" />
        </Button>
      </Tip>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 w-6 p-0">
          {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ListPlus className="h-3 w-3" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <p className="text-xs font-bold text-foreground mb-2">Add MC to Hidden_Data</p>
        <Select value={selectedSet} onValueChange={setSelectedSet}>
          <SelectTrigger className="h-7 text-xs mb-2"><SelectValue placeholder="Choose Export Set" /></SelectTrigger>
          <SelectContent>
            {availableSets.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name} ({s.questionCount} questions)</SelectItem>
            ))}
            {availableSets.length === 0 && (
              <SelectItem value="__none__" disabled>No export sets with approved questions</SelectItem>
            )}
          </SelectContent>
        </Select>
        <div className="flex items-center justify-between">
          <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>Cancel</button>
          <Button size="sm" className="h-7 text-xs" onClick={handleSync} disabled={syncing || !selectedSet}>
            {syncing ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Adding…</> : "Add to Sheet"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ── Slides button ── */
function SlidesButton({ assetId, hasSheet, slidesUrl, onCreated }: { assetId: string; hasSheet: boolean; slidesUrl: string | null | undefined; onCreated: () => void }) {
  const [creating, setCreating] = useState(false);

  const createSlides = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-test-slide", {
        body: { teaching_asset_id: assetId },
      });
      if (error) {
        const errMsg = data?.error || error.message || "Edge Function returned a non-2xx status code";
        throw new Error(errMsg);
      }
      if (data?.error) throw new Error(data.error);
      toast.success("Filming slides created");
      window.open(data.test_slide_url, "_blank");
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Slides creation failed");
    } finally {
      setCreating(false);
    }
  };

  if (!hasSheet) {
    return (
      <Tip label="Sync to Sheet first">
        <Button variant="outline" size="sm" className="h-6 w-6 p-0 opacity-50 cursor-not-allowed" disabled>
          <Film className="h-3 w-3" />
        </Button>
      </Tip>
    );
  }

  if (slidesUrl) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-6 w-6 p-0">
            <Film className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => window.open(slidesUrl, "_blank")}>
            Open Slides
          </DropdownMenuItem>
          <DropdownMenuItem onClick={createSlides} disabled={creating}>
            {creating ? "Creating…" : "Recreate Slides"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Tip label="Create Filming Slides">
      <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={createSlides} disabled={creating}>
        {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Film className="h-3 w-3" />}
      </Button>
    </Tip>
  );
}

export function CoreAssetsTab() {
  const [syncingAssetId, setSyncingAssetId] = useState<string | null>(null);
  const [generatingPrepDocId, setGeneratingPrepDocId] = useState<string | null>(null);
  const { workspace } = useActiveWorkspace();
  const qc = useQueryClient();
  const chapterId = workspace?.chapterId;

  const { data: coreAssets = [], isLoading } = useQuery({
    queryKey: ["core-assets", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, source_ref, core_rank, whiteboard_status, mc_status, video_production_status, ebook_status, qa_status, deployment_status, admin_notes, sheet_master_url, test_slide_url, prep_doc_url")
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
                      <Tip label={(a as any).sheet_master_url ? "Sync Hidden_Data" : "Create a sheet first"}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 w-6 p-0"
                          disabled={!(a as any).sheet_master_url || syncingAssetId === a.id}
                          onClick={async () => {
                            setSyncingAssetId(a.id);
                            try {
                              const { data, error } = await supabase.functions.invoke("sync-hidden-data", {
                                body: { teaching_asset_id: a.id },
                              });
                              if (error) throw error;
                              if (data?.error) throw new Error(data.error);
                              toast.success(`Synced ${data.fields_written?.length || 0} fields to Hidden_Data`, {
                                description: `${data.fields_skipped?.length || 0} fields already had data — skipped`,
                              });
                            } catch (err: any) {
                              toast.error(err.message || "Sync failed");
                            } finally {
                              setSyncingAssetId(null);
                            }
                          }}
                        >
                          {syncingAssetId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        </Button>
                      </Tip>
                      {/* Add MC to Hidden_Data button */}
                      <AddMCButton assetId={a.id} hasSheet={!!(a as any).sheet_master_url} />
                      {/* Slides button */}
                      <SlidesButton assetId={a.id} hasSheet={!!(a as any).sheet_master_url} slidesUrl={(a as any).test_slide_url} onCreated={() => qc.invalidateQueries({ queryKey: ["core-assets", chapterId] })} />
                      {/* Prep Doc button */}
                      {(a as any).prep_doc_url ? (
                        <Tip label="Open Prep Doc">
                          <a href={(a as any).prep_doc_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="h-6 w-6 p-0">
                              <BookOpen className="h-3 w-3" />
                            </Button>
                          </a>
                        </Tip>
                      ) : (
                        <Tip label="Generate Prep Doc">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 w-6 p-0"
                            disabled={generatingPrepDocId === a.id}
                            onClick={async () => {
                              setGeneratingPrepDocId(a.id);
                              try {
                                const { data, error } = await supabase.functions.invoke("create-prep-doc", { body: { teaching_asset_id: a.id } });
                                if (error) throw error;
                                if (data?.error) throw new Error(data.error);
                                toast.success("Prep doc created — opening now.", { description: "Add to offline in Google Drive for flight." });
                                window.open(data.doc_url, "_blank");
                                qc.invalidateQueries({ queryKey: ["core-assets", chapterId] });
                              } catch (err: any) { toast.error(err.message || "Prep doc failed"); }
                              finally { setGeneratingPrepDocId(null); }
                            }}
                          >
                            {generatingPrepDocId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
                          </Button>
                        </Tip>
                      )}
                      {/* Solutions embed dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0 relative">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => window.open(`/solutions/${a.asset_name}`, "_blank")}>
                            Preview in App →
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            navigator.clipboard.writeText(`<iframe src="${STUDENT_BASE_URL}/solutions/${a.asset_name}" width="100%" height="900" frameborder="0" style="border:none;border-radius:8px"></iframe>`);
                            toast.success("iFrame code copied — paste into LearnWorlds iFrame activity");
                          }}>
                            Copy Full Solutions iFrame
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            navigator.clipboard.writeText(`<iframe src="${STUDENT_BASE_URL}/solutions/${a.asset_name}?preview=true" width="100%" height="900" frameborder="0" style="border:none;border-radius:8px"></iframe>`);
                            toast.success("Preview iFrame copied — students will see paywall after problem");
                          }}>
                            Copy Preview iFrame
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            navigator.clipboard.writeText(`<iframe src="${STUDENT_BASE_URL}/practice/${a.asset_name}" width="100%" height="900" frameborder="0" style="border:none;border-radius:8px"></iframe>`);
                            toast.success("Practice iFrame copied");
                          }}>
                            Copy Practice iFrame
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
