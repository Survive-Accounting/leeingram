import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Lightbulb, Rocket, Filter, ChevronDown } from "lucide-react";
import { CATEGORIES, PRIORITIES, STATUSES, SEMESTERS, SEED_IDEAS, IDEA_STATUS, ARCHIVED_STATUS } from "@/components/roadmap/RoadmapConstants";
import { RoadmapColumn } from "@/components/roadmap/RoadmapColumn";

export default function FeatureRoadmap() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterSemester, setFilterSemester] = useState("all");

  const [newItem, setNewItem] = useState({
    title: "", description: "", category: "general", priority: "medium", target_semester: "", status: "idea",
  });

  const [localOrder, setLocalOrder] = useState<Record<string, string[]>>({});

  const { data: items, isLoading } = useQuery({
    queryKey: ["roadmap-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roadmap_items")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (item: typeof newItem) => {
      const { error } = await supabase.from("roadmap_items").insert({ user_id: user!.id, ...item });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmap-items"] });
      toast.success("Added to roadmap!");
    },
    onError: (e) => toast.error("Failed: " + e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("roadmap_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roadmap-items"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("roadmap_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmap-items"] });
      toast.success("Removed from roadmap");
    },
  });

  const seedRoadmap = async () => {
    for (const idea of SEED_IDEAS) {
      await supabase.from("roadmap_items").insert({ user_id: user!.id, ...idea });
    }
    queryClient.invalidateQueries({ queryKey: ["roadmap-items"] });
    setShowSeed(false);
    toast.success(`${SEED_IDEAS.length} ideas added to your roadmap!`);
  };

  const handleCreate = () => {
    createMutation.mutate(newItem);
    setShowCreate(false);
    setNewItem({ title: "", description: "", category: "general", priority: "medium", target_semester: "", status: "idea" });
  };

  const handleUpdate = (id: string, updates: Record<string, any>) => {
    updateMutation.mutate({ id, updates });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((i: any) => {
      if (filterCategory !== "all" && i.category !== filterCategory) return false;
      if (filterPriority !== "all" && i.priority !== filterPriority) return false;
      if (filterSemester !== "all" && i.target_semester !== filterSemester) return false;
      return true;
    });
  }, [items, filterCategory, filterPriority, filterSemester]);

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

  const sortAndOrder = (list: any[], statusValue: string) => {
    let sorted = [...list].sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));
    const order = localOrder[statusValue];
    if (order) {
      const idMap = new Map(sorted.map((i) => [i.id, i]));
      const ordered = order.map((id) => idMap.get(id)).filter(Boolean);
      const remaining = sorted.filter((i) => !order.includes(i.id));
      sorted = [...ordered, ...remaining];
    }
    return sorted;
  };

  const plannedItems = sortAndOrder(filtered.filter((i: any) => i.status === "planned"), "planned");
  const inProgressItems = sortAndOrder(filtered.filter((i: any) => i.status === "in_progress"), "in_progress");
  const completedItems = sortAndOrder(filtered.filter((i: any) => i.status === "done"), "done");
  const ideaItems = sortAndOrder(filtered.filter((i: any) => i.status === "idea"), "idea");
  const archivedItems = sortAndOrder(filtered.filter((i: any) => i.status === "archived" || i.status === "deferred"), "archived");

  // Group planned items by semester
  const plannedBySemester = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const item of plannedItems) {
      const sem = item.target_semester || "Unscheduled";
      if (!groups[sem]) groups[sem] = [];
      groups[sem].push(item);
    }
    // Sort by semester order
    const ordered: Record<string, any[]> = {};
    for (const sem of [...SEMESTERS, "Unscheduled"]) {
      if (groups[sem]) ordered[sem] = groups[sem];
    }
    return ordered;
  }, [plannedItems]);

  const handleReorder = (statusValue: string, oldIndex: number, newIndex: number) => {
    const listMap: Record<string, any[]> = {
      planned: plannedItems,
      in_progress: inProgressItems,
      done: completedItems,
      idea: ideaItems,
      archived: archivedItems,
    };
    const list = listMap[statusValue];
    if (!list) return;
    const ids = list.map((i) => i.id);
    const newIds = [...ids];
    const [moved] = newIds.splice(oldIndex, 1);
    newIds.splice(newIndex, 0, moved);
    setLocalOrder((prev) => ({ ...prev, [statusValue]: newIds }));
  };

  const hasFilters = filterCategory !== "all" || filterPriority !== "all" || filterSemester !== "all";

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Feature Roadmap</h1>
          <p className="text-sm text-muted-foreground">Brainstorm, prioritize, and schedule your platform's future</p>
        </div>
        <div className="flex gap-2">
          {(!items || items.length === 0) && (
            <Button variant="outline" onClick={() => setShowSeed(true)}>
              <Lightbulb className="mr-1 h-4 w-4" /> Load Seed Ideas
            </Button>
          )}
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add Idea
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSemester} onValueChange={setFilterSemester}>
          <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue placeholder="Semester" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Semesters</SelectItem>
            {SEMESTERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFilterCategory("all"); setFilterPriority("all"); setFilterSemester("all"); }}>
            Clear filters
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !items?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Lightbulb className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground mb-4">No roadmap items yet.</p>
            <Button variant="outline" onClick={() => setShowSeed(true)}>
              <Lightbulb className="mr-1 h-4 w-4" /> Load brainstormed ideas
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Trello Board: 3 columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <RoadmapColumn
              label="Planned"
              items={plannedItems}
              statusValue="planned"
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onReorder={handleReorder}
              semesterGroups={plannedBySemester}
            />
            <RoadmapColumn
              label="Currently In Progress"
              items={inProgressItems}
              statusValue="in_progress"
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onReorder={handleReorder}
              variant="active"
            />
            <RoadmapColumn
              label="Completed Features"
              items={completedItems}
              statusValue="done"
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onReorder={handleReorder}
              variant="completed"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Ideas toggle */}
          <Collapsible open={ideasOpen} onOpenChange={setIdeasOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${ideasOpen ? "rotate-180" : ""}`} />
              <span className="text-sm font-semibold text-foreground">💡 Ideas</span>
              <Badge variant="secondary" className="text-xs">{ideaItems.length}</Badge>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <RoadmapColumn
                label="Ideas"
                items={ideaItems}
                statusValue="idea"
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onReorder={handleReorder}
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Archived toggle */}
          {archivedItems.length > 0 && (
            <Collapsible open={archivedOpen} onOpenChange={setArchivedOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${archivedOpen ? "rotate-180" : ""}`} />
                <span className="text-sm font-semibold text-muted-foreground">📦 Archived</span>
                <Badge variant="secondary" className="text-xs">{archivedItems.length}</Badge>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <RoadmapColumn
                  label="Archived"
                  items={archivedItems}
                  statusValue="archived"
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onReorder={handleReorder}
                />
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Feature Idea</DialogTitle>
            <DialogDescription>Brainstorm a new feature for the roadmap.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-sm pointer-events-none select-none">I want to</span>
                <Input
                  value={newItem.title}
                  onChange={(e) => setNewItem((p) => ({ ...p, title: e.target.value }))}
                  className="pl-[5.5rem]"
                  placeholder="build a video factory for promos..."
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={newItem.description} onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))} rows={3} placeholder="What does this feature do? Why is it valuable?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={newItem.category} onValueChange={(v) => setNewItem((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={newItem.priority} onValueChange={(v) => setNewItem((p) => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Target Semester</Label>
              <Select value={newItem.target_semester} onValueChange={(v) => setNewItem((p) => ({ ...p, target_semester: v }))}>
                <SelectTrigger><SelectValue placeholder="Pick a semester" /></SelectTrigger>
                <SelectContent>{SEMESTERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newItem.title.trim()}>Add to Roadmap</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seed Confirmation Dialog */}
      <Dialog open={showSeed} onOpenChange={setShowSeed}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Load Brainstormed Ideas</DialogTitle>
            <DialogDescription>
              This will add {SEED_IDEAS.length} feature ideas from your previous brainstorming sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto space-y-1.5 text-sm">
            {SEED_IDEAS.map((idea, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border p-2">
                <Badge variant="outline" className="text-xs shrink-0">{idea.category}</Badge>
                <span className="truncate">{idea.title}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSeed(false)}>Cancel</Button>
            <Button onClick={seedRoadmap}>
              <Rocket className="mr-1 h-4 w-4" /> Load All {SEED_IDEAS.length} Ideas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
