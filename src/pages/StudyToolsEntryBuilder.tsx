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

export default function StudyToolsEntryBuilder() {
  const { workspace } = useActiveWorkspace();
  const qc = useQueryClient();
  const [confirmRegen, setConfirmRegen] = useState(false);
  const chapterId = workspace?.chapterId;

  // Fetch set
  const { data: builderSet, isLoading } = useQuery({
    queryKey: ["entry-builder-set", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entry_builder_sets")
        .select("*")
        .eq("chapter_id", chapterId!)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!chapterId,
  });

  // Fetch items
  const { data: items } = useQuery({
    queryKey: ["entry-builder-items", builderSet?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entry_builder_items")
        .select("id, transaction_description, date_label, entries, sort_order, source_asset_id, deleted")
        .eq("set_id", builderSet!.id)
        .eq("deleted", false)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!builderSet?.id,
  });

  // Fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ["entry-builder-accounts", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entry_builder_accounts")
        .select("id, account_name, account_type, normal_balance")
        .eq("chapter_id", chapterId!)
        .order("account_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!chapterId,
  });

  const generateMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-entry-builder-set", {
        body: { chapter_id: chapterId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Entry builder set generated — ${data.entries_found} entries, ${data.accounts_found} accounts`);
      qc.invalidateQueries({ queryKey: ["entry-builder-set", chapterId] });
      qc.invalidateQueries({ queryKey: ["entry-builder-accounts", chapterId] });
    },
    onError: (e: Error) => toast.error("Generation failed: " + e.message),
  });

  const regenerateMut = useMutation({
    mutationFn: async () => {
      if (builderSet?.id) {
        await supabase.from("entry_builder_sets").delete().eq("id", builderSet.id);
      }
      const { data, error } = await supabase.functions.invoke("generate-entry-builder-set", {
        body: { chapter_id: chapterId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Regenerated — ${data.entries_found} entries`);
      setConfirmRegen(false);
      qc.invalidateQueries({ queryKey: ["entry-builder-set", chapterId] });
      qc.invalidateQueries({ queryKey: ["entry-builder-accounts", chapterId] });
    },
    onError: (e: Error) => toast.error("Regeneration failed: " + e.message),
  });

  const togglePublishMut = useMutation({
    mutationFn: async () => {
      const newStatus = builderSet?.status === "published" ? "draft" : "published";
      const { error } = await supabase.from("entry_builder_sets").update({ status: newStatus }).eq("id", builderSet!.id);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (status) => {
      toast.success(status === "published" ? "Set published" : "Set unpublished");
      qc.invalidateQueries({ queryKey: ["entry-builder-set", chapterId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteItemMut = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("entry_builder_items").update({ deleted: true }).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entry removed");
      qc.invalidateQueries({ queryKey: ["entry-builder-items", builderSet?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteAccountMut = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase.from("entry_builder_accounts").delete().eq("id", accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account removed");
      qc.invalidateQueries({ queryKey: ["entry-builder-accounts", chapterId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyEmbed = () => {
    const url = `${window.location.origin}/tools/entry-builder?chapter_id=${chapterId}`;
    const html = `<iframe src="${url}" width="100%" height="700" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(html);
    toast.success("Embed HTML copied to clipboard");
  };

  const isGenerating = generateMut.isPending || regenerateMut.isPending;

  const getAccountCount = (item: any) => {
    const entries = Array.isArray(item.entries) ? item.entries : [];
    return entries.length;
  };

  return (
    <SurviveSidebarLayout>
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-foreground">Entry Builder Sets</h1>

        {!chapterId ? (
          <p className="text-muted-foreground text-sm">Select a course and chapter to manage entry builder sets.</p>
        ) : isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : !builderSet ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-muted-foreground text-sm">No entry builder set generated yet for this chapter.</p>
            <Button onClick={() => generateMut.mutate()} disabled={isGenerating}>
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Generate Entry Builder Set</>
              )}
            </Button>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={builderSet.status === "published" ? "default" : "secondary"} className="text-xs">
                {builderSet.status === "published" ? "Published" : "Draft"}
              </Badge>
              <span className="text-sm text-muted-foreground">{items?.length ?? 0} entries</span>
              <span className="text-xs text-muted-foreground/60">▶ {builderSet.plays ?? 0} plays</span>
              <span className="text-xs text-muted-foreground/60">✓ {builderSet.completions ?? 0} completions</span>

              <div className="flex gap-2 ml-auto flex-wrap">
                <Button variant="outline" size="sm" onClick={() => togglePublishMut.mutate()} disabled={togglePublishMut.isPending}>
                  {builderSet.status === "published" ? (
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

            {/* Entries table */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2">Entries</h2>
              {items && items.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transaction</TableHead>
                        <TableHead className="w-28">Date</TableHead>
                        <TableHead className="w-20 text-center">Accounts</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs font-medium max-w-[300px] truncate">
                            {item.transaction_description}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.date_label || "—"}</TableCell>
                          <TableCell className="text-xs text-center">{getAccountCount(item)}</TableCell>
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
                <p className="text-muted-foreground text-sm text-center py-4">No entries in this set.</p>
              )}
            </div>

            {/* Accounts table */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2">
                Chapter Accounts <span className="text-muted-foreground font-normal">({accounts?.length ?? 0})</span>
              </h2>
              {accounts && accounts.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account Name</TableHead>
                        <TableHead className="w-28">Type</TableHead>
                        <TableHead className="w-28">Normal Balance</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.map((acc) => (
                        <TableRow key={acc.id}>
                          <TableCell className="text-xs font-medium">{acc.account_name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{acc.account_type}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{acc.normal_balance}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => deleteAccountMut.mutate(acc.id)}
                              disabled={deleteAccountMut.isPending}
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
                <p className="text-muted-foreground text-sm text-center py-4">No accounts for this chapter.</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Regenerate confirmation */}
      <Dialog open={confirmRegen} onOpenChange={setConfirmRegen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Regenerate Entry Builder Set?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will delete the current set and all its entries, then generate a fresh set from chapter assets using AI.
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
