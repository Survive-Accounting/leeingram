import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DomainLayout } from "@/components/DomainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Plus, ChevronDown, Users, Pencil, Trash2, Filter, FolderPlus } from "lucide-react";
import { format } from "date-fns";
import { ContentBoard } from "@/components/leeingram/ContentBoard";
import { CONTENT_TAGS } from "@/components/leeingram/LeeingramConstants";
import { SEMESTERS } from "@/components/roadmap/RoadmapConstants";

export default function Leeingram() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Toggle states (all collapsed by default)
  const [subscribersOpen, setSubscribersOpen] = useState(false);
  const [openSeries, setOpenSeries] = useState<Record<string, boolean>>({});

  // Dialog states
  const [showCreateSeries, setShowCreateSeries] = useState(false);
  const [editingSeries, setEditingSeries] = useState<any>(null);
  const [showCreateItem, setShowCreateItem] = useState<string | null>(null);

  // Filter states
  const [filterTag, setFilterTag] = useState("all");
  const [filterSemester, setFilterSemester] = useState("all");

  // Form states
  const [newSeries, setNewSeries] = useState({ title: "", description: "", target_semester: "" });
  const [newItem, setNewItem] = useState({ title: "", description: "", content_tags: [] as string[], target_semester: "" });

  // Queries
  const { data: series, isLoading } = useQuery({
    queryKey: ["leeingram-series"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vlog_seasons")
        .select("*")
        .order("season_number");
      if (error) throw error;
      return data;
    },
  });

  const { data: contentItems } = useQuery({
    queryKey: ["leeingram-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roadmap_items")
        .select("*")
        .eq("domain", "leeingram")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: subscribers } = useQuery({
    queryKey: ["newsletter-subscribers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_subscribers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Mutations
  const createSeriesMutation = useMutation({
    mutationFn: async () => {
      const nextNumber = (series?.length ?? 0) + 1;
      const { error } = await supabase.from("vlog_seasons").insert({
        user_id: user!.id,
        title: newSeries.title,
        description: newSeries.description,
        season_number: nextNumber,
        target_semester: newSeries.target_semester,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leeingram-series"] });
      toast.success("Series created!");
      setShowCreateSeries(false);
      setNewSeries({ title: "", description: "", target_semester: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateSeriesMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("vlog_seasons").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leeingram-series"] });
      toast.success("Series updated!");
      setEditingSeries(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteSeriesMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vlog_seasons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leeingram-series"] });
      toast.success("Series deleted");
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (seriesId: string) => {
      const { error } = await supabase.from("roadmap_items").insert({
        user_id: user!.id,
        title: newItem.title,
        description: newItem.description,
        domain: "leeingram",
        status: "idea",
        category: "content",
        priority: "medium",
        series_id: seriesId,
        content_tags: newItem.content_tags,
        target_semester: newItem.target_semester,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leeingram-content"] });
      toast.success("Content item added!");
      setShowCreateItem(null);
      setNewItem({ title: "", description: "", content_tags: [], target_semester: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("roadmap_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leeingram-content"] }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("roadmap_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leeingram-content"] });
      toast.success("Item removed");
    },
  });

  // Filtering
  const getSeriesItems = (seriesId: string) => {
    if (!contentItems) return [];
    return contentItems.filter((item: any) => {
      if (item.series_id !== seriesId) return false;
      if (filterTag !== "all" && !(item.content_tags || []).includes(filterTag)) return false;
      if (filterSemester !== "all" && item.target_semester !== filterSemester) return false;
      return true;
    });
  };

  const hasFilters = filterTag !== "all" || filterSemester !== "all";

  const toggleTag = (tag: string) => {
    setNewItem((prev) => ({
      ...prev,
      content_tags: prev.content_tags.includes(tag)
        ? prev.content_tags.filter((t) => t !== tag)
        : [...prev.content_tags, tag],
    }));
  };

  return (
    <DomainLayout
      title="Leeingram.co"
      tagline="Solopreneur Journey"
      actions={
        <Button size="sm" className="bg-white/10 border border-white/20 text-white hover:bg-white/20" onClick={() => setShowCreateSeries(true)}>
          <FolderPlus className="mr-1 h-3.5 w-3.5" /> New Series
        </Button>
      }
    >
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="mb-2">
          <h2 className="text-xl font-bold text-white">Solopreneur Journey</h2>
          <p className="text-sm text-white/50">Helpful blog posts and videos</p>
        </div>

        {/* Newsletter Subscribers - top, collapsible */}
        <Collapsible open={subscribersOpen} onOpenChange={setSubscribersOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 rounded-lg transition-colors cursor-pointer" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${subscribersOpen ? "rotate-180" : ""}`} />
            <Users className="h-4 w-4 text-white/60" />
            <span className="text-sm font-medium text-white">Newsletter Subscribers</span>
            {subscribers && <Badge variant="secondary" className="text-xs ml-1">{subscribers.length}</Badge>}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {!subscribers?.length ? (
                <p className="text-sm text-white/40 text-center py-6">No subscribers yet. Share your landing page!</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-3 py-2 text-xs font-medium text-white/50">Name</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-white/50">Email</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-white/50">Signed Up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map((sub) => (
                      <tr key={sub.id} className="border-b border-white/5 last:border-0">
                        <td className="px-3 py-2 text-white/80">{sub.name}</td>
                        <td className="px-3 py-2 text-white/60">{sub.email}</td>
                        <td className="px-3 py-2 text-white/40 text-xs">{format(new Date(sub.created_at), "MMM d, yyyy")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-white/40" />
          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="h-8 text-xs w-[140px] bg-white/5 border-white/20 text-white">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {CONTENT_TAGS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSemester} onValueChange={setFilterSemester}>
            <SelectTrigger className="h-8 text-xs w-[140px] bg-white/5 border-white/20 text-white">
              <SelectValue placeholder="Semester" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Semesters</SelectItem>
              {SEMESTERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-white/50 hover:text-white" onClick={() => { setFilterTag("all"); setFilterSemester("all"); }}>
              Clear filters
            </Button>
          )}
        </div>

        {/* Series List */}
        {isLoading ? (
          <p className="text-sm text-foreground/80">Loading...</p>
        ) : !series?.length ? (
          <div className="flex flex-col items-center py-16 text-center">
            <FolderPlus className="h-12 w-12 text-white/20 mb-4" />
            <p className="text-white/50 mb-4">No series yet. Create your first one!</p>
            <Button className="bg-white/10 border border-white/20 text-white hover:bg-white/20" onClick={() => setShowCreateSeries(true)}>
              <Plus className="mr-1 h-4 w-4" /> Create First Series
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {series.map((s: any) => {
              const seriesItems = getSeriesItems(s.id);
              const isOpen = openSeries[s.id] ?? false;
              return (
                <Collapsible key={s.id} open={isOpen} onOpenChange={(open) => setOpenSeries((prev) => ({ ...prev, [s.id]: open }))}>
                  <div className="rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
                    <CollapsibleTrigger className="w-full text-left p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-white">{s.title}</h3>
                          {s.description && <p className="text-xs text-white/50 mt-0.5">{s.description}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          {(s as any).target_semester && (
                            <Badge variant="secondary" className="text-[10px]">{(s as any).target_semester}</Badge>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                            {seriesItems.length} item{seriesItems.length !== 1 ? "s" : ""}
                          </span>
                          <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4">
                        {/* Series action buttons */}
                        <div className="flex gap-1 mb-3">
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] text-white/40 hover:text-white" onClick={(e) => { e.stopPropagation(); setEditingSeries(s); }}>
                            <Pencil className="mr-1 h-2.5 w-2.5" /> Edit Series
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] text-white/40 hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteSeriesMutation.mutate(s.id); }}>
                            <Trash2 className="mr-1 h-2.5 w-2.5" /> Delete
                          </Button>
                        </div>
                        <ContentBoard
                          items={seriesItems}
                          onUpdate={(id, updates) => updateItemMutation.mutate({ id, updates })}
                          onDelete={(id) => deleteItemMutation.mutate(id)}
                          onAddItem={() => { setNewItem({ title: "", description: "", content_tags: [], target_semester: "" }); setShowCreateItem(s.id); }}
                        />
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Series Dialog */}
      <Dialog open={showCreateSeries} onOpenChange={setShowCreateSeries}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Series</DialogTitle>
            <DialogDescription>Add a new content series</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={newSeries.title} onChange={(e) => setNewSeries((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Building in Public" />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea value={newSeries.description} onChange={(e) => setNewSeries((p) => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Target Semester</Label>
              <Select value={newSeries.target_semester} onValueChange={(v) => setNewSeries((p) => ({ ...p, target_semester: v }))}>
                <SelectTrigger><SelectValue placeholder="Pick a semester" /></SelectTrigger>
                <SelectContent>{SEMESTERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createSeriesMutation.mutate()} disabled={!newSeries.title.trim()}>Create Series</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Series Dialog */}
      <Dialog open={!!editingSeries} onOpenChange={(o) => !o && setEditingSeries(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Series</DialogTitle>
            <DialogDescription>Update series details</DialogDescription>
          </DialogHeader>
          {editingSeries && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={editingSeries.title} onChange={(e) => setEditingSeries((p: any) => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={editingSeries.description || ""} onChange={(e) => setEditingSeries((p: any) => ({ ...p, description: e.target.value }))} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Target Semester</Label>
                <Select value={editingSeries.target_semester || ""} onValueChange={(v) => setEditingSeries((p: any) => ({ ...p, target_semester: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pick a semester" /></SelectTrigger>
                  <SelectContent>{SEMESTERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => updateSeriesMutation.mutate({ id: editingSeries.id, updates: { title: editingSeries.title, description: editingSeries.description, target_semester: editingSeries.target_semester } })}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Content Item Dialog */}
      <Dialog open={!!showCreateItem} onOpenChange={() => setShowCreateItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Content Item</DialogTitle>
            <DialogDescription>Add a blog post or video idea to this series</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={newItem.title} onChange={(e) => setNewItem((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Why I Quit My Job" />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea value={newItem.description} onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {CONTENT_TAGS.map((tag) => (
                  <label key={tag.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={newItem.content_tags.includes(tag.value)}
                      onCheckedChange={() => toggleTag(tag.value)}
                    />
                    {tag.label}
                  </label>
                ))}
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
            <Button onClick={() => showCreateItem && createItemMutation.mutate(showCreateItem)} disabled={!newItem.title.trim()}>Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DomainLayout>
  );
}
