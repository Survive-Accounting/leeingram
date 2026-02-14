import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Video, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const [newSeason, setNewSeason] = useState({ title: "", description: "", season_number: 1 });
  const [newEpisode, setNewEpisode] = useState({ title: "", description: "", episode_number: 1 });

  const { data: seasons, isLoading } = useQuery({
    queryKey: ["vlog-seasons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vlog_seasons")
        .select("*")
        .order("season_number");
      if (error) throw error;
      return data;
    },
  });

  const { data: episodes } = useQuery({
    queryKey: ["vlog-episodes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vlog_episodes")
        .select("*")
        .order("episode_number");
      if (error) throw error;
      return data;
    },
  });

  const createSeasonMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vlog_seasons").insert({
        user_id: user!.id,
        ...newSeason,
      });
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
        user_id: user!.id,
        season_id: seasonId,
        episode_number: newEpisode.episode_number || seasonEps.length + 1,
        title: newEpisode.title,
        description: newEpisode.description,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vlog-seasons"] });
      toast.success("Season deleted");
    },
  });

  const getSeasonEpisodes = (seasonId: string) =>
    episodes?.filter((e) => e.season_id === seasonId) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4">
          <Link to="/domains" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-semibold text-foreground">Leeingram.co</h1>
          <span className="text-xs text-muted-foreground">What's my next big project?</span>
          <div className="ml-auto">
            <Button size="sm" onClick={() => setShowCreateSeason(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> New Season
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground">Earned Wisdom</h2>
          <p className="text-sm text-muted-foreground">My Solopreneur Journey — VLOG Series</p>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !seasons?.length ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Video className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground mb-4">No seasons yet.</p>
            <Button onClick={() => setShowCreateSeason(true)}>
              <Plus className="mr-1 h-4 w-4" /> Create Season 1
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {seasons.map((season) => {
              const eps = getSeasonEpisodes(season.id);
              return (
                <Collapsible key={season.id} defaultOpen>
                  <Card>
                    <CollapsibleTrigger className="w-full text-left p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">
                            Season {season.season_number}: {season.title}
                          </h3>
                          {season.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{season.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {eps.length} ep{eps.length !== 1 ? "s" : ""}
                          </Badge>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-1.5">
                        {eps.map((ep) => (
                          <div
                            key={ep.id}
                            className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2"
                          >
                            <div className="flex-1">
                              <span className="text-xs font-medium text-foreground">
                                Ep {ep.episode_number}: {ep.title}
                              </span>
                              {ep.description && (
                                <p className="text-xs text-muted-foreground">{ep.description}</p>
                              )}
                            </div>
                            <Select
                              value={ep.status}
                              onValueChange={(v) =>
                                updateEpisodeStatus.mutate({ id: ep.id, status: v })
                              }
                            >
                              <SelectTrigger className="h-7 text-xs w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {EPISODE_STATUSES.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs text-muted-foreground"
                          onClick={() => {
                            setNewEpisode({
                              title: "",
                              description: "",
                              episode_number: eps.length + 1,
                            });
                            setShowCreateEpisode(season.id);
                          }}
                        >
                          <Plus className="mr-1 h-3 w-3" /> Add Episode
                        </Button>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Season Dialog */}
      <Dialog open={showCreateSeason} onOpenChange={setShowCreateSeason}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Season</DialogTitle>
            <DialogDescription>Add a new season to Earned Wisdom</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Season Number</Label>
              <Input
                type="number"
                value={newSeason.season_number}
                onChange={(e) => setNewSeason((p) => ({ ...p, season_number: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={newSeason.title}
                onChange={(e) => setNewSeason((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. The Beginning"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea
                value={newSeason.description}
                onChange={(e) => setNewSeason((p) => ({ ...p, description: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createSeasonMutation.mutate()} disabled={!newSeason.title.trim()}>
              Create Season
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Episode Dialog */}
      <Dialog open={!!showCreateEpisode} onOpenChange={() => setShowCreateEpisode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Episode</DialogTitle>
            <DialogDescription>Add an episode to this season</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Episode Number</Label>
              <Input
                type="number"
                value={newEpisode.episode_number}
                onChange={(e) => setNewEpisode((p) => ({ ...p, episode_number: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={newEpisode.title}
                onChange={(e) => setNewEpisode((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Why I Quit My Job"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea
                value={newEpisode.description}
                onChange={(e) => setNewEpisode((p) => ({ ...p, description: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => showCreateEpisode && createEpisodeMutation.mutate(showCreateEpisode)}
              disabled={!newEpisode.title.trim()}
            >
              Add Episode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
