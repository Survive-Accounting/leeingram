import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, GripVertical, Pencil, Check, X, Merge, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface Props {
  chapterId: string;
}

export function TopicManager({ chapterId }: Props) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [mergeSource, setMergeSource] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState("");

  const { data: topics } = useQuery({
    queryKey: ["chapter-topics", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_topics")
        .select("*")
        .eq("chapter_id", chapterId)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      const maxOrder = topics?.length ? Math.max(...topics.map(t => t.display_order)) + 1 : 0;
      const { error } = await supabase.from("chapter_topics").insert({
        chapter_id: chapterId,
        topic_name: name.trim(),
        display_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-topics", chapterId] });
      setNewName("");
      toast.success("Topic added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("chapter_topics").update({ topic_name: name.trim() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-topics", chapterId] });
      setEditId(null);
      toast.success("Topic renamed");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("chapter_topics").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapter-topics", chapterId] }),
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ sourceId, targetId }: { sourceId: string; targetId: string }) => {
      // Move all LW items from source to target
      const { error: moveErr } = await supabase
        .from("lw_items")
        .update({ topic_id: targetId })
        .eq("topic_id", sourceId);
      if (moveErr) throw moveErr;
      // Deactivate source
      const { error: deactivateErr } = await supabase
        .from("chapter_topics")
        .update({ is_active: false })
        .eq("id", sourceId);
      if (deactivateErr) throw deactivateErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-topics", chapterId] });
      qc.invalidateQueries({ queryKey: ["lw-items", chapterId] });
      setMergeSource(null);
      setMergeTarget("");
      toast.success("Topics merged");
    },
  });

  const moveUpMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!topics) return;
      const idx = topics.findIndex(t => t.id === id);
      if (idx <= 0) return;
      const prev = topics[idx - 1];
      const curr = topics[idx];
      await supabase.from("chapter_topics").update({ display_order: prev.display_order }).eq("id", curr.id);
      await supabase.from("chapter_topics").update({ display_order: curr.display_order }).eq("id", prev.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapter-topics", chapterId] }),
  });

  const activeTopics = topics?.filter(t => t.is_active) ?? [];
  const inactiveTopics = topics?.filter(t => !t.is_active) ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Chapter Topics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {activeTopics.map((topic, idx) => (
          <div key={topic.id} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
            <button
              onClick={() => idx > 0 && moveUpMutation.mutate(topic.id)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            <Badge variant="outline" className="text-[10px] shrink-0">{idx + 1}</Badge>
            {editId === topic.id ? (
              <>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-7 text-xs flex-1"
                  autoFocus
                />
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => renameMutation.mutate({ id: topic.id, name: editName })}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditId(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                <span className="text-xs font-medium flex-1">{topic.topic_name}</span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditId(topic.id); setEditName(topic.topic_name); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setMergeSource(topic.id); setMergeTarget(""); }}>
                  <Merge className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleActiveMutation.mutate({ id: topic.id, active: false })}>
                  <EyeOff className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        ))}

        {inactiveTopics.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Inactive</p>
            {inactiveTopics.map(topic => (
              <div key={topic.id} className="flex items-center gap-2 px-3 py-1.5 opacity-50">
                <span className="text-xs flex-1 line-through">{topic.topic_name}</span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleActiveMutation.mutate({ id: topic.id, active: true })}>
                  <Eye className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New topic name…"
            className="h-8 text-xs"
            onKeyDown={(e) => e.key === "Enter" && newName.trim() && addMutation.mutate(newName)}
          />
          <Button size="sm" className="h-8" onClick={() => newName.trim() && addMutation.mutate(newName)} disabled={!newName.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>

        {/* Merge Dialog */}
        <Dialog open={!!mergeSource} onOpenChange={(o) => !o && setMergeSource(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Merge Topic</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Move all LW items from "{activeTopics.find(t => t.id === mergeSource)?.topic_name}" into:
            </p>
            <Select value={mergeTarget} onValueChange={setMergeTarget}>
              <SelectTrigger><SelectValue placeholder="Select target topic…" /></SelectTrigger>
              <SelectContent>
                {activeTopics.filter(t => t.id !== mergeSource).map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.topic_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMergeSource(null)}>Cancel</Button>
              <Button onClick={() => mergeSource && mergeTarget && mergeMutation.mutate({ sourceId: mergeSource, targetId: mergeTarget })} disabled={!mergeTarget}>
                Merge & Deactivate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
