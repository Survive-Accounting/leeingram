import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Copy, Globe, GlobeLock, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";

interface DissectorRow {
  assetId: string;
  assetCode: string;
  assetName: string;
  rank: string | null;
  dissectorId: string | null;
  highlightsCount: number;
  status: string; // "not_generated" | "draft" | "published"
  plays: number;
  completions: number;
}

export default function StudyToolsProblemDissector() {
  const { workspace } = useActiveWorkspace();
  const qc = useQueryClient();
  const chapterId = workspace?.chapterId;

  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkPublishing, setBulkPublishing] = useState(false);

  // Fetch approved teaching assets for chapter
  const { data: rows, isLoading } = useQuery({
    queryKey: ["dissector-admin", chapterId],
    queryFn: async () => {
      // Get teaching assets
      const { data: assets, error: aErr } = await (supabase
        .from("teaching_assets")
        .select("id, asset_code, asset_name, rank")
        .eq("chapter_id", chapterId!) as any)
        .eq("status", "approved")
        .order("asset_code");
      if (aErr) throw aErr;

      if (!assets || assets.length === 0) return [];

      // Get dissector problems for these assets
      const assetIds = assets.map((a: any) => a.id);
      const { data: problems } = await supabase
        .from("dissector_problems")
        .select("id, teaching_asset_id, highlights, status, plays, completions")
        .in("teaching_asset_id", assetIds);

      const problemMap = new Map<string, any>();
      for (const p of problems ?? []) {
        // Keep the latest per asset
        const existing = problemMap.get(p.teaching_asset_id);
        if (!existing) problemMap.set(p.teaching_asset_id, p);
      }

      const result: DissectorRow[] = assets.map((a: any) => {
        const p = problemMap.get(a.id);
        const highlights = p ? (Array.isArray(p.highlights) ? p.highlights : []) : [];
        return {
          assetId: a.id,
          assetCode: a.asset_code || "",
          assetName: a.asset_name || "",
          rank: a.rank || null,
          dissectorId: p?.id ?? null,
          highlightsCount: highlights.length,
          status: p ? (p.status || "draft") : "not_generated",
          plays: p?.plays ?? 0,
          completions: p?.completions ?? 0,
        };
      });

      return result;
    },
    enabled: !!chapterId,
  });

  const generateOne = async (assetId: string) => {
    setGenerating((prev) => new Set(prev).add(assetId));
    try {
      const { data, error } = await supabase.functions.invoke("generate-dissector-highlights", {
        body: { teaching_asset_id: assetId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Generated ${data.highlights_found} highlights`);
      qc.invalidateQueries({ queryKey: ["dissector-admin", chapterId] });
    } catch (e: any) {
      toast.error("Generation failed: " + e.message);
    } finally {
      setGenerating((prev) => { const n = new Set(prev); n.delete(assetId); return n; });
    }
  };

  const togglePublish = async (row: DissectorRow) => {
    if (!row.dissectorId) return;
    const newStatus = row.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("dissector_problems").update({ status: newStatus }).eq("id", row.dissectorId);
    if (error) { toast.error(error.message); return; }
    toast.success(newStatus === "published" ? "Published" : "Unpublished");
    qc.invalidateQueries({ queryKey: ["dissector-admin", chapterId] });
  };

  const copyEmbed = (assetId: string) => {
    const url = `${window.location.origin}/tools/problem-dissector?asset_id=${assetId}`;
    const html = `<iframe src="${url}" width="100%" height="700" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(html);
    toast.success("Embed HTML copied");
  };

  const handleBulkGenerate = async () => {
    if (!rows) return;
    const toGenerate = rows.filter((r) => r.status === "not_generated");
    if (toGenerate.length === 0) { toast.info("All assets already have highlights"); return; }

    setBulkGenerating(true);
    let success = 0;
    let failed = 0;

    for (const row of toGenerate) {
      try {
        const { data, error } = await supabase.functions.invoke("generate-dissector-highlights", {
          body: { teaching_asset_id: row.assetId },
        });
        if (error || data?.error) { failed++; continue; }
        success++;
      } catch {
        failed++;
      }
    }

    setBulkGenerating(false);
    toast.success(`Generated: ${success}, Failed: ${failed}`);
    qc.invalidateQueries({ queryKey: ["dissector-admin", chapterId] });
  };

  const handleBulkPublish = async () => {
    if (!rows) return;
    const toPublish = rows.filter((r) => r.dissectorId && r.status === "draft");
    if (toPublish.length === 0) { toast.info("No draft problems to publish"); return; }

    setBulkPublishing(true);
    const ids = toPublish.map((r) => r.dissectorId!);
    const { error } = await supabase.from("dissector_problems").update({ status: "published" }).in("id", ids);
    setBulkPublishing(false);

    if (error) { toast.error(error.message); return; }
    toast.success(`Published ${ids.length} problems`);
    qc.invalidateQueries({ queryKey: ["dissector-admin", chapterId] });
  };

  const statusBadge = (status: string) => {
    if (status === "published") return <Badge variant="default" className="text-[10px]">Published</Badge>;
    if (status === "draft") return <Badge variant="secondary" className="text-[10px]">Draft</Badge>;
    return <Badge variant="outline" className="text-[10px] text-muted-foreground">Not Generated</Badge>;
  };

  return (
    <SurviveSidebarLayout>
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-foreground">Problem Dissector</h1>

        {!chapterId ? (
          <p className="text-muted-foreground text-sm">Select a course and chapter to manage dissector problems.</p>
        ) : isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : !rows || rows.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-12">No approved teaching assets in this chapter.</p>
        ) : (
          <>
            {/* Bulk actions */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleBulkGenerate} disabled={bulkGenerating}>
                {bulkGenerating ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Generating...</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Generate All</>
                )}
              </Button>
              <Button size="sm" variant="outline" onClick={handleBulkPublish} disabled={bulkPublishing}>
                {bulkPublishing ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Publishing...</>
                ) : (
                  <><Globe className="h-3.5 w-3.5 mr-1.5" /> Publish All</>
                )}
              </Button>
              <span className="text-xs text-muted-foreground/60 self-center ml-2">
                {rows.length} assets · {rows.filter((r) => r.status !== "not_generated").length} generated · {rows.filter((r) => r.status === "published").length} published
              </span>
            </div>

            {/* Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset Code</TableHead>
                    <TableHead className="w-16 text-center">Rank</TableHead>
                    <TableHead className="w-20 text-center">Highlights</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-24 text-center">Plays</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.assetId}>
                      <TableCell className="text-xs font-medium">{row.assetCode || row.assetName}</TableCell>
                      <TableCell className="text-center">
                        {row.rank ? (
                          <Badge variant="outline" className="text-[10px]">{row.rank}</Badge>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {row.status !== "not_generated" ? row.highlightsCount : "—"}
                      </TableCell>
                      <TableCell>{statusBadge(row.status)}</TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {row.status !== "not_generated" ? `${row.plays} ▶ · ${row.completions} ✓` : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          {row.status === "not_generated" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => generateOne(row.assetId)}
                              disabled={generating.has(row.assetId)}
                            >
                              {generating.has(row.assetId) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <><Zap className="h-3 w-3 mr-1" /> Generate</>
                              )}
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => togglePublish(row)}
                              >
                                {row.status === "published" ? (
                                  <GlobeLock className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => copyEmbed(row.assetId)}
                              >
                                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </SurviveSidebarLayout>
  );
}
