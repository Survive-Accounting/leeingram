import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, FolderOpen, Package } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { TopicManager } from "@/components/content-factory/TopicManager";
import { DraftReviewMode } from "@/components/content-factory/DraftReviewMode";
import { LWExportTab } from "@/components/content-factory/LWExportTab";

export default function ExportSets() {
  const qc = useQueryClient();
  const { workspace } = useActiveWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("topics");

  // Fetch chapter info for tab props
  const { data: chapter } = useQuery({
    queryKey: ["chapter", workspace?.chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("*, courses(*)")
        .eq("id", workspace!.chapterId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!workspace?.chapterId,
  });

  const course = chapter?.courses as { course_name: string; id: string; code: string } | undefined;

  const { data: sets, isLoading } = useQuery({
    queryKey: ["export-sets", workspace?.courseId, workspace?.chapterId],
    queryFn: async () => {
      let q = supabase
        .from("export_sets")
        .select("*, export_set_items(count)")
        .order("created_at", { ascending: false });
      if (workspace?.courseId) q = q.eq("course_id", workspace.courseId);
      if (workspace?.chapterId) q = q.eq("chapter_id", workspace.chapterId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("export_sets").insert({ name } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["export-sets"] });
      setCreateOpen(false);
      setNewName("");
      toast.success("Export set created");
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("export_sets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["export-sets"] });
      setDeleteId(null);
      toast.success("Export set deleted");
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const hasChapter = !!workspace?.chapterId && !!chapter && !!course;

  return (
    <SurviveSidebarLayout>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-primary-foreground">
            <Package className="h-5 w-5 text-primary" />
            Banked — LearnWorlds Pipeline
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage topics, review LW items, export to LearnWorlds.</p>
        </div>
      </div>

      {!hasChapter ? (
        <p className="text-xs text-muted-foreground text-center py-8">
          Select a course and chapter in the sidebar pipeline to manage topics and exports.
        </p>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="topics">Topics</TabsTrigger>
            <TabsTrigger value="lw-review">LW Review</TabsTrigger>
            <TabsTrigger value="lw-export">LW Export</TabsTrigger>
            <TabsTrigger value="export-sets">Export Sets</TabsTrigger>
          </TabsList>

          <TabsContent value="topics">
            <TopicManager
              chapterId={workspace.chapterId}
              chapterNumber={chapter.chapter_number}
              courseCode={course.code || ""}
            />
          </TabsContent>

          <TabsContent value="lw-review">
            <DraftReviewMode
              chapterId={workspace.chapterId}
              courseId={course.id}
              chapterNumber={chapter.chapter_number}
            />
          </TabsContent>

          <TabsContent value="lw-export">
            <LWExportTab
              chapterId={workspace.chapterId}
              chapterNumber={chapter.chapter_number}
              courseName={chapter.chapter_name}
              courseCode={course.code || course.course_name}
            />
          </TabsContent>

          <TabsContent value="export-sets">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-foreground">Export Sets</p>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> New Set
              </Button>
            </div>

            <div className="rounded-lg overflow-hidden border border-border bg-background/95">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Assets</TableHead>
                    <TableHead className="text-xs">Created</TableHead>
                    <TableHead className="text-xs w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-foreground/80 text-xs">Loading…</TableCell></TableRow>
                  ) : !sets?.length ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-xs">No export sets yet</TableCell></TableRow>
                  ) : (
                    sets.map((s: any) => (
                      <TableRow key={s.id} className="border-border">
                        <TableCell className="text-xs font-medium">{s.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {s.export_set_items?.[0]?.count ?? 0}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(s.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <Link to={`/export-sets/${s.id}`}>
                                <FolderOpen className="h-3 w-3" />
                              </Link>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(s.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Export Set</DialogTitle>
            <DialogDescription>Create a named collection of teaching assets for export.</DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">Set Name</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Ch 8 Bonds Quiz" className="h-8 text-xs" />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => newName.trim() && createMutation.mutate(newName.trim())} disabled={createMutation.isPending || !newName.trim()}>
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Export Set</DialogTitle>
            <DialogDescription>This will remove the set and all its items. Continue?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SurviveSidebarLayout>
  );
}
