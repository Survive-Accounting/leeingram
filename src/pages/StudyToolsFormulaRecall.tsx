import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Trash2, Copy, RefreshCw, Globe, GlobeLock, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function StudyToolsFormulaRecall() {
  const { workspace } = useActiveWorkspace();
  const qc = useQueryClient();
  const [confirmRegen, setConfirmRegen] = useState(false);
  const chapterId = workspace?.chapterId;

  const { data: formulaSet, isLoading } = useQuery({
    queryKey: ["formula-set", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("formula_sets")
        .select("*")
        .eq("chapter_id", chapterId!)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!chapterId,
  });

  const { data: items } = useQuery({
    queryKey: ["formula-items", formulaSet?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("formula_items")
        .select("id, formula_name, formula_text, hint, sort_order, source_asset_id, deleted")
        .eq("set_id", formulaSet!.id)
        .eq("deleted", false)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!formulaSet?.id,
  });

  const generateMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-formula-set", {
        body: { chapter_id: chapterId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Formula set generated — ${data.formulas_found} formulas`);
      qc.invalidateQueries({ queryKey: ["formula-set", chapterId] });
    },
    onError: (e: Error) => toast.error("Generation failed: " + e.message),
  });

  const regenerateMut = useMutation({
    mutationFn: async () => {
      if (formulaSet?.id) {
        await supabase.from("formula_sets").delete().eq("id", formulaSet.id);
      }
      const { data, error } = await supabase.functions.invoke("generate-formula-set", {
        body: { chapter_id: chapterId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Regenerated — ${data.formulas_found} formulas`);
      setConfirmRegen(false);
      qc.invalidateQueries({ queryKey: ["formula-set", chapterId] });
    },
    onError: (e: Error) => toast.error("Regeneration failed: " + e.message),
  });

  const togglePublishMut = useMutation({
    mutationFn: async () => {
      const newStatus = formulaSet?.status === "published" ? "draft" : "published";
      const { error } = await supabase.from("formula_sets").update({ status: newStatus }).eq("id", formulaSet!.id);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (status) => {
      toast.success(status === "published" ? "Set published" : "Set unpublished");
      qc.invalidateQueries({ queryKey: ["formula-set", chapterId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteItemMut = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("formula_items").update({ deleted: true }).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Formula removed");
      qc.invalidateQueries({ queryKey: ["formula-items", formulaSet?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyEmbed = () => {
    const url = `${window.location.origin}/tools/formula-recall?chapter_id=${chapterId}`;
    const html = `<iframe src="${url}" width="100%" height="600" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(html);
    toast.success("Embed HTML copied to clipboard");
  };

  const isGenerating = generateMut.isPending || regenerateMut.isPending;

  return (
    <SurviveSidebarLayout>
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-foreground">Formula Recall Sets</h1>

        {!chapterId ? (
          <p className="text-muted-foreground text-sm">Select a course and chapter to manage formula sets.</p>
        ) : isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : !formulaSet ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-muted-foreground text-sm">No formula set generated yet for this chapter.</p>
            <Button onClick={() => generateMut.mutate()} disabled={isGenerating}>
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Generate Formula Set</>
              )}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={formulaSet.status === "published" ? "default" : "secondary"} className="text-xs">
                {formulaSet.status === "published" ? "Published" : "Draft"}
              </Badge>
              <span className="text-sm text-muted-foreground">{items?.length ?? 0} formulas</span>
              <span className="text-xs text-muted-foreground/60">▶ {formulaSet.plays ?? 0} plays</span>
              <span className="text-xs text-muted-foreground/60">✓ {formulaSet.completions ?? 0} completions</span>

              <div className="flex gap-2 ml-auto flex-wrap">
                <Button variant="outline" size="sm" onClick={() => togglePublishMut.mutate()} disabled={togglePublishMut.isPending}>
                  {formulaSet.status === "published" ? (
                    <><GlobeLock className="h-3.5 w-3.5 mr-1.5" /> Unpublish</>
                  ) : (
                    <><Globe className="h-3.5 w-3.5 mr-1.5" /> Publish</>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={copyEmbed}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Get Embed URL
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setConfirmRegen(true)} disabled={isGenerating}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Regenerate
                </Button>
              </div>
            </div>

            {items && items.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Formula Name</TableHead>
                      <TableHead>Formula</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs font-medium">{item.formula_name}</TableCell>
                        <TableCell className="text-xs max-w-[300px] truncate">{item.formula_text?.slice(0, 60)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => deleteItemMut.mutate(item.id)}
                            disabled={deleteItemMut.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-6">No active formulas in this set.</p>
            )}
          </>
        )}
      </div>

      <Dialog open={confirmRegen} onOpenChange={setConfirmRegen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Regenerate Formula Set?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will delete the current set and all its formulas, then generate a fresh set from chapter assets.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmRegen(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => regenerateMut.mutate()} disabled={regenerateMut.isPending}>
              {regenerateMut.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Regenerating...</>
              ) : "Confirm Regenerate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SurviveSidebarLayout>
  );
}
