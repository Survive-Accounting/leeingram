import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DomainLayout } from "@/components/DomainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Video, ChevronDown, Trash2, Users } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";

const EPISODE_STATUSES = [
  { value: "idea", label: "💡 Idea" },
  { value: "scripted", label: "📝 Scripted" },
  { value: "filmed", label: "🎬 Filmed" },
  { value: "edited", label: "✂️ Edited" },
  { value: "published", label: "✅ Published" },
];

export default function Leeingram() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateSeason, setShowCreateSeason] = useState(false);
  const [showCreateEpisode, setShowCreateEpisode] = useState<string | null>(null);
  const [showSubscribers, setShowSubscribers] = useState(false);
  const [newSeason, setNewSeason] = useState({ title: "", description: "", season_number: 1 });
  const [newEpisode, setNewEpisode] = useState({ title: "", description: "", episode_number: 1 });

  const { data: seasons, isLoading } = useQuery({
    queryKey: ["vlog-seasons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vlog_seasons").select("*").order("season_number");
      if (error) throw error;
      return data;
    },
  });

  const { data: episodes } = useQuery({
    queryKey: ["vlog-episodes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vlog_episodes").select("*").order("episode_number");
      if (error) throw error;
      return data;
    },
  });

  const { data: subscribers } = useQuery({
    queryKey: ["newsletter-subscribers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("newsletter_subscribers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createSeasonMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vlog_seasons").insert({ user_id: user!.id, ...newSeason });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vlog-seasons"] });
      toast.success("Season created!");
      setShowCreateSeason(false);
      setNewSeason({ title: "", description: "", season_number: (seasons?.length ?? 0) + 2 });
    },
    onError: (e) => toast.error(e.message),
  });

  const createEpisodeMutation = useMutation({
    mutationFn: async (seasonId: string) => {
      const seasonEps = episodes?.filter((e) => e.season_id === seasonId) ?? [];
      const { error } = await supabase.from("vlog_episodes").insert({
        user_id: user!.id, season_id: seasonId,
        episode_number: newEpisode.episode_number || seasonEps.length + 1,
        title: newEpisode.title, description: newEpisode.description,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vlog-episodes"] });
      toast.success("Episode created!");
      setShowCreateEpisode(null);
      setNewEpisode({ title: "", description: "", episode_number: 1 });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateEpisodeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("vlog_episodes").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vlog-episodes"] }),
  });

  const deleteSeasonMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vlog_seasons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["vlog-seasons"] }); toast.success("Season deleted"); },
  });

  const getSeasonEpisodes = (seasonId: string) => episodes?.filter((e) => e.season_id === seasonId) ?? [];

  return (
    <DomainLayout
      title="Leeingram.co"
      tagline="What's my next big project?"
      actions={<Button size="sm" className="bg-white/10 border border-white/20 text-white hover:bg-white/20" onClick={() => setShowCreateSeason(true)}><Plus className="mr-1 h-3.5 w-3.5" /> New Season</Button>}
    >
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">Earned Wisdom</h2>
          <p className="text-sm text-white/50">My Solopreneur Journey — VLOG Series</p>
        </div>

        {isLoading ? (
          <p className="text-sm text-white/50">Loading...</p>
        ) : !seasons?.length ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Video className="h-12 w-12 text-white/20 mb-4" />
            <p className="text-white/50 mb-4">No seasons yet.</p>
            <Button className="bg-white/10 border border-white/20 text-white hover:bg-white/20" onClick={() => setShowCreateSeason(true)}>
              <Plus className="mr-1 h-4 w-4" /> Create Season 1
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {seasons.map((season) => {
              const eps = getSeasonEpisodes(season.id);
              return (
                <Collapsible key={season.id} defaultOpen>
                  <div className="rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
                    <CollapsibleTrigger className="w-full text-left p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-white">Season {season.season_number}: {season.title}</h3>
                          {season.description && <p className="text-xs text-white/50 mt-0.5">{season.description}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">{eps.length} ep{eps.length !== 1 ? "s" : ""}</span>
                          <ChevronDown className="h-4 w-4 text-white/40" />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 space-y-1.5">
                        {eps.map((ep) => (
                          <div key={ep.id} className="flex items-center justify-between rounded-md px-3 py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                            <div className="flex-1">
                              <span className="text-xs font-medium text-white">Ep {ep.episode_number}: {ep.title}</span>
                              {ep.description && <p className="text-xs text-white/40">{ep.description}</p>}
                            </div>
                            <Select value={ep.status} onValueChange={(v) => updateEpisodeStatus.mutate({ id: ep.id, status: v })}>
                              <SelectTrigger className="h-7 text-xs w-[120px] bg-transparent border-white/20 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {EPISODE_STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                        <Button variant="ghost" size="sm" className="w-full text-xs text-white/40 hover:text-white hover:bg-white/5"
                          onClick={() => { setNewEpisode({ title: "", description: "", episode_number: eps.length + 1 }); setShowCreateEpisode(season.id); }}>
                          <Plus className="mr-1 h-3 w-3" /> Add Episode
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>

      {/* Newsletter Subscribers */}
      <div className="max-w-2xl mx-auto mt-8">
        <button
          onClick={() => setShowSubscribers(true)}
          className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
        >
          <Users className="h-4 w-4" />
          <span>Newsletter Subscribers</span>
          {subscribers && <Badge variant="secondary" className="text-xs">{subscribers.length}</Badge>}
        </button>
      </div>

      {/* Subscribers Dialog */}
      <Dialog open={showSubscribers} onOpenChange={setShowSubscribers}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Newsletter Subscribers</DialogTitle>
            <DialogDescription>{subscribers?.length ?? 0} total signups</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {subscribers?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No subscribers yet. Share your landing page!</p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Name</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Email</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Signed Up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers?.map((sub) => (
                      <tr key={sub.id} className="border-b last:border-0">
                        <td className="px-3 py-2 text-foreground">{sub.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{sub.email}</td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{format(new Date(sub.created_at), "MMM d, yyyy")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateSeason} onOpenChange={setShowCreateSeason}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Season</DialogTitle><DialogDescription>Add a new season to Earned Wisdom</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Season Number</Label><Input type="number" value={newSeason.season_number} onChange={(e) => setNewSeason((p) => ({ ...p, season_number: parseInt(e.target.value) || 1 }))} /></div>
            <div className="space-y-1.5"><Label>Title</Label><Input value={newSeason.title} onChange={(e) => setNewSeason((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. The Beginning" /></div>
            <div className="space-y-1.5"><Label>Description (optional)</Label><Textarea value={newSeason.description} onChange={(e) => setNewSeason((p) => ({ ...p, description: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={() => createSeasonMutation.mutate()} disabled={!newSeason.title.trim()}>Create Season</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showCreateEpisode} onOpenChange={() => setShowCreateEpisode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Episode</DialogTitle><DialogDescription>Add an episode to this season</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Episode Number</Label><Input type="number" value={newEpisode.episode_number} onChange={(e) => setNewEpisode((p) => ({ ...p, episode_number: parseInt(e.target.value) || 1 }))} /></div>
            <div className="space-y-1.5"><Label>Title</Label><Input value={newEpisode.title} onChange={(e) => setNewEpisode((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Why I Quit My Job" /></div>
            <div className="space-y-1.5"><Label>Description (optional)</Label><Textarea value={newEpisode.description} onChange={(e) => setNewEpisode((p) => ({ ...p, description: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={() => showCreateEpisode && createEpisodeMutation.mutate(showCreateEpisode)} disabled={!newEpisode.title.trim()}>Add Episode</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DomainLayout>
  );
}
