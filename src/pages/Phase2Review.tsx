import { useState } from "react";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, RefreshCw, X, Plus, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Topic = {
  id: string;
  chapter_id: string;
  course_id: string | null;
  topic_number: number;
  topic_name: string;
  topic_description: string;
  topic_rationale: string;
  asset_codes: string[];
  lw_video_link: string | null;
  lw_quiz_link: string | null;
  video_status: string;
  quiz_status: string;
  generated_by_ai: boolean;
  created_at: string;
};

type ChapterAsset = {
  id: string;
  asset_name: string;
  source_ref: string | null;
  problem_title: string | null;
  topic_id: string | null;
};

const STATUS_OPTIONS = ["not_started", "in_progress", "complete"] as const;
const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-500/20 text-amber-400",
  complete: "bg-emerald-500/20 text-emerald-400",
};

export default function Phase2Review() {
  const { workspace } = useActiveWorkspace();
  const qc = useQueryClient();
  const chapterId = workspace?.chapterId;
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editRationale, setEditRationale] = useState("");
  const [addAssetSearch, setAddAssetSearch] = useState("");
  const [showAddAsset, setShowAddAsset] = useState(false);

  // Fetch topics
  const { data: topics = [], isLoading: topicsLoading } = useQuery({
    queryKey: ["chapter-topics-gen", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_topics")
        .select("*")
        .eq("chapter_id", chapterId!)
        .order("topic_number" as any);
      if (error) throw error;
      return (data as any[]) as Topic[];
    },
    enabled: !!chapterId,
  });

  // Fetch chapter assets for tagging
  const { data: chapterAssets = [] } = useQuery({
    queryKey: ["chapter-assets-for-topics", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, source_ref, problem_title, topic_id")
        .eq("chapter_id", chapterId!)
        .not("asset_approved_at", "is", null)
        .order("asset_name");
      if (error) throw error;
      return (data as any[]) as ChapterAsset[];
    },
    enabled: !!chapterId,
  });

  // Count assets for display
  const { data: assetCount = 0 } = useQuery({
    queryKey: ["chapter-asset-count", chapterId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("teaching_assets")
        .select("id", { count: "exact", head: true })
        .eq("chapter_id", chapterId!)
        .not("asset_approved_at", "is", null);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!chapterId,
  });

  const selectedTopic = topics.find((t) => t.id === selectedTopicId) ?? null;

  // Generate topics mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-chapter-topics", {
        body: { chapter_id: chapterId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Generated ${data.topic_count} topics`);
      qc.invalidateQueries({ queryKey: ["chapter-topics-gen", chapterId] });
      qc.invalidateQueries({ queryKey: ["chapter-assets-for-topics", chapterId] });
      setSelectedTopicId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Save topic edits
  const saveMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("chapter_topics").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["chapter-topics-gen", chapterId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Remove asset from topic
  const removeAssetMutation = useMutation({
    mutationFn: async ({ topicId, assetCode }: { topicId: string; assetCode: string }) => {
      const topic = topics.find((t) => t.id === topicId);
      if (!topic) return;
      const newCodes = (topic.asset_codes || []).filter((c) => c !== assetCode);
      await supabase.from("chapter_topics").update({ asset_codes: newCodes } as any).eq("id", topicId);
      // Clear topic_id on the asset
      await supabase.from("teaching_assets").update({ topic_id: null } as any).eq("asset_name", assetCode).eq("chapter_id", chapterId!);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-topics-gen", chapterId] });
      qc.invalidateQueries({ queryKey: ["chapter-assets-for-topics", chapterId] });
    },
  });

  // Add asset to topic
  const addAssetMutation = useMutation({
    mutationFn: async ({ topicId, asset }: { topicId: string; asset: ChapterAsset }) => {
      const topic = topics.find((t) => t.id === topicId);
      if (!topic) return;
      const newCodes = [...(topic.asset_codes || []), asset.asset_name];
      await supabase.from("chapter_topics").update({ asset_codes: newCodes } as any).eq("id", topicId);
      // Set topic_id if not set
      if (!asset.topic_id) {
        await supabase.from("teaching_assets").update({ topic_id: topicId } as any).eq("id", asset.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-topics-gen", chapterId] });
      qc.invalidateQueries({ queryKey: ["chapter-assets-for-topics", chapterId] });
      setShowAddAsset(false);
      setAddAssetSearch("");
    },
  });

  // Select topic and populate edit fields
  const selectTopic = (topic: Topic) => {
    setSelectedTopicId(topic.id);
    setEditName(topic.topic_name);
    setEditDesc(topic.topic_description || "");
    setEditRationale(topic.topic_rationale || "");
    setShowAddAsset(false);
  };

  if (!chapterId) {
    return (
      <SurviveSidebarLayout>
        <div className="text-center py-16">
          <h2 className="text-lg font-semibold text-foreground mb-2">Topic Generator</h2>
          <p className="text-muted-foreground text-sm">Select a course and chapter to begin.</p>
        </div>
      </SurviveSidebarLayout>
    );
  }

  const taggedAssetsForTopic = selectedTopic
    ? chapterAssets.filter((a) => (selectedTopic.asset_codes || []).includes(a.asset_name))
    : [];

  const untaggedAssets = selectedTopic
    ? chapterAssets.filter(
        (a) => !(selectedTopic.asset_codes || []).includes(a.asset_name)
      )
    : [];

  const filteredUntagged = addAssetSearch
    ? untaggedAssets.filter(
        (a) =>
          a.asset_name.toLowerCase().includes(addAssetSearch.toLowerCase()) ||
          (a.problem_title || "").toLowerCase().includes(addAssetSearch.toLowerCase())
      )
    : untaggedAssets;

  return (
    <SurviveSidebarLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-lg font-bold text-foreground">Topic Generator</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generate 5 core topics per chapter. Each topic powers a video, a quiz, and chapter-wide study tools.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {workspace?.courseName} · Ch {workspace?.chapterNumber} — {workspace?.chapterName}
          </p>
        </div>

        {topicsLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : topics.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <Sparkles className="h-12 w-12 text-primary/60" />
            <h2 className="text-xl font-bold text-foreground">No topics generated yet</h2>
            <p className="text-muted-foreground text-sm max-w-md">
              {assetCount} approved assets in Ch {workspace?.chapterNumber}. Generate 5 core exam topics using AI analysis of your teaching assets.
            </p>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || assetCount === 0}
              className="mt-2"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Analyzing {assetCount} assets in Ch {workspace?.chapterNumber}… this takes about 20-30 seconds
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" /> Generate Topics →
                </>
              )}
            </Button>
            {assetCount === 0 && (
              <p className="text-xs text-destructive">No approved assets found — approve some assets first.</p>
            )}
          </div>
        ) : (
          /* Two-column layout */
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Left panel — Topic list (40%) */}
            <div className="lg:col-span-2 space-y-2">
              {topics.map((topic) => {
                const assetTagCount = (topic.asset_codes || []).length;
                const isSelected = selectedTopicId === topic.id;
                return (
                  <button
                    key={topic.id}
                    onClick={() => selectTopic(topic)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">
                        {topic.topic_number}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{topic.topic_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">{assetTagCount} assets tagged</span>
                          <Badge className={`text-[9px] h-4 ${STATUS_COLORS[topic.video_status] || STATUS_COLORS.not_started}`}>
                            Vid: {topic.video_status.replace("_", " ")}
                          </Badge>
                          <Badge className={`text-[9px] h-4 ${STATUS_COLORS[topic.quiz_status] || STATUS_COLORS.not_started}`}>
                            Quiz: {topic.quiz_status.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs mt-3"
                onClick={() => {
                  if (confirm("This will replace all existing topics for this chapter. Continue?")) {
                    generateMutation.mutate();
                  }
                }}
                disabled={generateMutation.isPending}
              >
                <RefreshCw className="h-3 w-3 mr-1.5" />
                {generateMutation.isPending ? "Regenerating…" : "Regenerate Topics"}
              </Button>
            </div>

            {/* Right panel — Topic detail (60%) */}
            <div className="lg:col-span-3">
              {selectedTopic ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Topic {selectedTopic.topic_number} Detail</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Editable fields */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Topic Name</label>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 text-sm mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</label>
                        <Textarea
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="text-xs mt-1 min-h-[60px]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rationale</label>
                        <Textarea
                          value={editRationale}
                          onChange={(e) => setEditRationale(e.target.value)}
                          className="text-xs mt-1 min-h-[40px]"
                        />
                      </div>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={saveMutation.isPending}
                        onClick={() =>
                          saveMutation.mutate({
                            id: selectedTopic.id,
                            updates: {
                              topic_name: editName,
                              topic_description: editDesc,
                              topic_rationale: editRationale,
                            },
                          })
                        }
                      >
                        Save Changes
                      </Button>
                    </div>

                    <div className="border-t border-border pt-3 space-y-3">
                      {/* Video slot */}
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">LearnWorlds Video</label>
                        <div className="flex items-center gap-2 mt-1">
                          <Select
                            value={selectedTopic.video_status}
                            onValueChange={(v) =>
                              saveMutation.mutate({ id: selectedTopic.id, updates: { video_status: v } })
                            }
                          >
                            <SelectTrigger className="h-7 text-xs w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">
                                  {s.replace("_", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={selectedTopic.lw_video_link || ""}
                            placeholder="Paste LearnWorlds video activity URL"
                            className="h-7 text-xs flex-1"
                            onChange={(e) =>
                              saveMutation.mutate({ id: selectedTopic.id, updates: { lw_video_link: e.target.value } })
                            }
                          />
                        </div>
                      </div>

                      {/* Quiz slot */}
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">LearnWorlds Quiz</label>
                        <div className="flex items-center gap-2 mt-1">
                          <Select
                            value={selectedTopic.quiz_status}
                            onValueChange={(v) =>
                              saveMutation.mutate({ id: selectedTopic.id, updates: { quiz_status: v } })
                            }
                          >
                            <SelectTrigger className="h-7 text-xs w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">
                                  {s.replace("_", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={selectedTopic.lw_quiz_link || ""}
                            placeholder="Paste LearnWorlds quiz activity URL"
                            className="h-7 text-xs flex-1"
                            onChange={(e) =>
                              saveMutation.mutate({ id: selectedTopic.id, updates: { lw_quiz_link: e.target.value } })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tagged Assets */}
                    <div className="border-t border-border pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Tagged Assets ({taggedAssetsForTopic.length})
                        </label>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px]"
                          onClick={() => setShowAddAsset(!showAddAsset)}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add Asset
                        </Button>
                      </div>

                      {showAddAsset && (
                        <div className="mb-3 space-y-1 border border-border rounded-md p-2">
                          <Input
                            value={addAssetSearch}
                            onChange={(e) => setAddAssetSearch(e.target.value)}
                            placeholder="Search assets…"
                            className="h-7 text-xs"
                          />
                          <div className="max-h-32 overflow-y-auto space-y-0.5">
                            {filteredUntagged.slice(0, 20).map((a) => (
                              <button
                                key={a.id}
                                className="w-full text-left px-2 py-1 rounded text-xs hover:bg-muted/30 transition-colors"
                                onClick={() => addAssetMutation.mutate({ topicId: selectedTopic.id, asset: a })}
                              >
                                <span className="font-mono text-[10px] text-primary">{a.asset_name}</span>
                                {a.problem_title && (
                                  <span className="text-muted-foreground ml-2">{a.problem_title}</span>
                                )}
                              </button>
                            ))}
                            {filteredUntagged.length === 0 && (
                              <p className="text-[10px] text-muted-foreground py-2 text-center">No untagged assets found</p>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        {taggedAssetsForTopic.map((asset) => (
                          <div key={asset.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 group">
                            <span className="font-mono text-[10px] text-primary shrink-0">{asset.asset_name}</span>
                            <span className="text-[10px] text-muted-foreground truncate">{asset.source_ref}</span>
                            <span className="text-[10px] text-muted-foreground truncate flex-1">{asset.problem_title}</span>
                            <a
                              href={`/solutions/${asset.asset_name}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground shrink-0"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <button
                              onClick={() => removeAssetMutation.mutate({ topicId: selectedTopic.id, assetCode: asset.asset_name })}
                              className="text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        {taggedAssetsForTopic.length === 0 && (
                          <p className="text-[10px] text-muted-foreground text-center py-3">No assets tagged to this topic yet</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                  Select a topic to view details
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </SurviveSidebarLayout>
  );
}
