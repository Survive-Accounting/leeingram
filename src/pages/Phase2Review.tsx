import { useState, useCallback, useRef, useEffect } from "react";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Loader2, Sparkles, RefreshCw, ChevronRight, ChevronDown,
  GripVertical, ExternalLink, ArrowRightLeft, Lock, Unlock, Merge, Undo2, Plus
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext, closestCenter, DragOverlay, useSensor, useSensors, PointerSensor,
  type DragStartEvent, type DragEndEvent
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Types ────────────────────────────────────────────────────────
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
  is_active: boolean;
  display_order: number;
  merged_into_topic_id: string | null;
  created_at: string;
};

type ChapterAsset = {
  id: string;
  asset_name: string;
  source_ref: string | null;
  problem_title: string | null;
  topic_id: string | null;
};

type ChapterInfo = {
  topics_locked: boolean;
  topics_locked_at: string | null;
  topics_locked_count: number | null;
};

const STATUS_OPTIONS = ["not_started", "in_progress", "complete"] as const;
const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-500/20 text-amber-400",
  complete: "bg-emerald-500/20 text-emerald-400",
};

// ── Draggable topic card wrapper ─────────────────────────────────
function DraggableTopicCard({ topic, children, disabled }: { topic: Topic; children: React.ReactNode; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: topic.id,
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="flex items-stretch">
        {!disabled && (
          <div {...listeners} className="flex items-center px-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

export default function Phase2Review() {
  const { workspace } = useActiveWorkspace();
  const qc = useQueryClient();
  const chapterId = workspace?.chapterId;

  const [openTopicId, setOpenTopicId] = useState<string | null>(null);
  const [addAssetSearch, setAddAssetSearch] = useState("");
  const [showAddAssetForTopic, setShowAddAssetForTopic] = useState<string | null>(null);
  const [regenOpen, setRegenOpen] = useState(false);
  const [mergeConfirm, setMergeConfirm] = useState<{ sourceId: string; destId: string } | null>(null);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [initialTopicCount, setInitialTopicCount] = useState(6);
  const [lockWarningOpen, setLockWarningOpen] = useState(false);
  const [renamingTopics, setRenamingTopics] = useState<Set<string>>(new Set());
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // ── Queries ──────────────────────────────────────────────────
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

  const { data: chapterInfo } = useQuery({
    queryKey: ["chapter-lock-info", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("topics_locked, topics_locked_at, topics_locked_count")
        .eq("id", chapterId!)
        .single();
      if (error) throw error;
      return data as unknown as ChapterInfo;
    },
    enabled: !!chapterId,
  });

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

  const isLocked = chapterInfo?.topics_locked ?? false;
  const activeTopics = topics.filter(t => t.is_active && !t.merged_into_topic_id);
  const dragMergedTopics = topics.filter(t => !t.is_active && !!t.merged_into_topic_id);
  const sliderCollapsedTopics = topics.filter(t => !t.is_active && !t.merged_into_topic_id);
  const sliderValue = activeTopics.length;

  // Unassigned = assets in slider-collapsed topics + assets not in any topic's codes
  const allActiveTopicCodes = activeTopics.flatMap(t => t.asset_codes || []);
  const unassignedAssets = chapterAssets.filter(a => !allActiveTopicCodes.includes(a.asset_name));

  // ── Mutations ────────────────────────────────────────────────
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
      qc.invalidateQueries({ queryKey: ["chapter-lock-info", chapterId] });
      setOpenTopicId(null);
      setRegenOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("chapter_topics").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-topics-gen", chapterId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const lockMutation = useMutation({
    mutationFn: async (lock: boolean) => {
      const updates: any = {
        topics_locked: lock,
        topics_locked_at: lock ? new Date().toISOString() : null,
        topics_locked_count: lock ? activeTopics.length : null,
      };
      const { error } = await supabase.from("chapters").update(updates).eq("id", chapterId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-lock-info", chapterId] });
      toast.success(isLocked ? "Topics unlocked" : "Topics locked");
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
      if (!asset.topic_id) {
        await supabase.from("teaching_assets").update({ topic_id: topicId } as any).eq("id", asset.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-topics-gen", chapterId] });
      qc.invalidateQueries({ queryKey: ["chapter-assets-for-topics", chapterId] });
      setShowAddAssetForTopic(null);
      setAddAssetSearch("");
    },
  });

  // Move asset between topics
  const moveAssetMutation = useMutation({
    mutationFn: async ({ fromTopicId, toTopicId, assetCode }: { fromTopicId: string; toTopicId: string; assetCode: string }) => {
      const fromTopic = topics.find(t => t.id === fromTopicId);
      const toTopic = topics.find(t => t.id === toTopicId);
      if (!fromTopic || !toTopic) return;
      // Remove from source
      const newFromCodes = (fromTopic.asset_codes || []).filter(c => c !== assetCode);
      await supabase.from("chapter_topics").update({ asset_codes: newFromCodes } as any).eq("id", fromTopicId);
      // Add to dest
      const newToCodes = [...(toTopic.asset_codes || []), assetCode];
      await supabase.from("chapter_topics").update({ asset_codes: newToCodes } as any).eq("id", toTopicId);
      // Update teaching_assets topic_id
      await supabase.from("teaching_assets").update({ topic_id: toTopicId } as any).eq("asset_name", assetCode).eq("chapter_id", chapterId!);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-topics-gen", chapterId] });
      qc.invalidateQueries({ queryKey: ["chapter-assets-for-topics", chapterId] });
    },
  });

  // ── AI rename helper ─────────────────────────────────────────
  const aiRename = useCallback(async (topicId: string, nameA: string, nameB: string) => {
    setRenamingTopics(prev => new Set(prev).add(topicId));
    try {
      const { data, error } = await supabase.functions.invoke("generate-ai-output", {
        body: {
          provider: "lovable",
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You combine two accounting topic names into a single concise topic name (4-8 words). Return ONLY the combined topic name, nothing else." },
            { role: "user", content: `Given these two merged accounting topics, suggest a single combined topic name in 4-8 words:\nTopic A: ${nameA}\nTopic B: ${nameB}\nReturn only the topic name, nothing else.` },
          ],
        },
      });
      const rawText = data?.raw || data?.parsed || "";
      const newName = String(rawText).trim().replace(/^["']|["']$/g, "");
      if (!error && newName.length > 2 && newName.length < 80) {
        await supabase.from("chapter_topics").update({ topic_name: newName } as any).eq("id", topicId);
        qc.invalidateQueries({ queryKey: ["chapter-topics-gen", chapterId] });
      }
    } catch { /* silent */ }
    setRenamingTopics(prev => {
      const next = new Set(prev);
      next.delete(topicId);
      return next;
    });
  }, [chapterId, qc]);

  // ── Merge/unmerge ────────────────────────────────────────────
  const executeMerge = useCallback(async (sourceId: string, destId: string) => {
    const source = topics.find(t => t.id === sourceId);
    const dest = topics.find(t => t.id === destId);
    if (!source || !dest) return;

    // Move assets from source to dest
    const mergedCodes = [...(dest.asset_codes || []), ...(source.asset_codes || [])];
    const uniqueCodes = [...new Set(mergedCodes)];

    await supabase.from("chapter_topics").update({
      asset_codes: uniqueCodes,
    } as any).eq("id", destId);

    await supabase.from("chapter_topics").update({
      is_active: false,
      merged_into_topic_id: destId,
      asset_codes: [],
    } as any).eq("id", sourceId);

    qc.invalidateQueries({ queryKey: ["chapter-topics-gen", chapterId] });
    toast.success(`Merged "${source.topic_name}" into "${dest.topic_name}"`);
    setMergeConfirm(null);

    // AI rename destination
    aiRename(destId, dest.topic_name, source.topic_name);
  }, [topics, chapterId, qc, aiRename]);

  const undoMerge = useCallback(async (mergedTopicId: string) => {
    const mergedTopic = topics.find(t => t.id === mergedTopicId);
    if (!mergedTopic || !mergedTopic.merged_into_topic_id) return;

    // Restore: re-activate the merged topic (assets stay as-is, user can re-tag)
    await supabase.from("chapter_topics").update({
      is_active: true,
      merged_into_topic_id: null,
    } as any).eq("id", mergedTopicId);

    qc.invalidateQueries({ queryKey: ["chapter-topics-gen", chapterId] });
    toast.success("Merge undone");
  }, [topics, chapterId, qc]);

  // ── Slider handler ───────────────────────────────────────────
  const handleSliderChange = useCallback(async (newCount: number[]) => {
    const targetCount = newCount[0];
    const currentActive = topics.filter(t => t.is_active && !t.merged_into_topic_id);
    // Only slider-collapsed topics can be reactivated (not drag-merged ones)
    const sliderInactive = topics.filter(t => !t.is_active && !t.merged_into_topic_id);
    const diff = targetCount - currentActive.length;

    if (diff < 0) {
      // Deactivate the last N active topics — assets go to unassigned (stay on topic row)
      const toDeactivate = currentActive
        .sort((a, b) => b.topic_number - a.topic_number)
        .slice(0, Math.abs(diff));

      for (const topic of toDeactivate) {
        // Keep asset_codes on the topic so they can be restored on slider-up
        await supabase.from("chapter_topics").update({
          is_active: false,
          // Do NOT set merged_into_topic_id — this is slider collapse, not merge
        } as any).eq("id", topic.id);
      }
    } else if (diff > 0) {
      // Reactivate slider-collapsed topics (lowest topic_number first)
      const toReactivate = sliderInactive
        .sort((a, b) => a.topic_number - b.topic_number)
        .slice(0, diff);

      for (const topic of toReactivate) {
        // Remove any asset codes that were manually moved to another active topic
        const currentActiveCodes = currentActive.flatMap(t => t.asset_codes || []);
        const restoredCodes = (topic.asset_codes || []).filter(c => !currentActiveCodes.includes(c));
        await supabase.from("chapter_topics").update({
          is_active: true,
          asset_codes: restoredCodes,
        } as any).eq("id", topic.id);
      }
    }

    qc.invalidateQueries({ queryKey: ["chapter-topics-gen", chapterId] });
  }, [topics, chapterId, qc]);

  // ── DnD handlers ─────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    setDragActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const sourceId = active.id as string;
    const destId = over.id as string;
    const source = topics.find(t => t.id === sourceId);
    const dest = topics.find(t => t.id === destId);
    if (!source || !dest || !source.is_active || !dest.is_active) return;
    setMergeConfirm({ sourceId, destId });
  };

  // ── Inline name editing ──────────────────────────────────────
  const startNameEdit = (topic: Topic) => {
    setEditingNameId(topic.id);
    setEditingNameValue(topic.topic_name);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const commitNameEdit = () => {
    if (editingNameId && editingNameValue.trim()) {
      saveMutation.mutate({ id: editingNameId, updates: { topic_name: editingNameValue.trim() } });
    }
    setEditingNameId(null);
  };

  // ── Render ───────────────────────────────────────────────────
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

  // Sort all topics for display: active first, then slider-collapsed, then drag-merged
  const sortedForDisplay = [
    ...activeTopics.sort((a, b) => a.topic_number - b.topic_number),
    ...sliderCollapsedTopics.sort((a, b) => a.topic_number - b.topic_number),
    ...dragMergedTopics.sort((a, b) => a.topic_number - b.topic_number),
  ];

  const draggedTopic = dragActiveId ? topics.find(t => t.id === dragActiveId) : null;

  return (
    <SurviveSidebarLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-lg font-bold text-foreground">Topic Generator</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generate up to 8 core topics per chapter. Each topic powers a video, a quiz, and chapter-wide study tools.
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
          /* ── Empty state ──────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <Sparkles className="h-12 w-12 text-primary/60" />
            <h2 className="text-xl font-bold text-foreground">No topics generated yet</h2>
            <p className="text-muted-foreground text-sm max-w-md">
              {assetCount} approved assets in Ch {workspace?.chapterNumber}. Generate 5-8 core exam topics using AI analysis of your teaching assets.
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Start with</span>
              <Input
                type="number"
                min={5}
                max={8}
                value={initialTopicCount}
                onChange={(e) => setInitialTopicCount(Math.min(8, Math.max(5, parseInt(e.target.value) || 6)))}
                className="w-16 h-8 text-center text-sm"
              />
              <span className="text-muted-foreground">topics</span>
            </div>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || assetCount === 0}
              className="mt-2"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Analyzing {assetCount} assets… ~20-30 seconds
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
          /* ── Main topic UI ────────────────────────────────────── */
          <div className="space-y-4">
            {/* Lock bar + slider */}
            <div className="flex items-center gap-4 bg-card border border-border rounded-lg p-3">
              {/* Slider */}
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Topics for this chapter</label>
                  <div className="flex-1 relative">
                    <Slider
                      min={1}
                      max={Math.min(8, topics.filter(t => !t.merged_into_topic_id).length)}
                      step={1}
                      value={[sliderValue]}
                      onValueChange={isLocked ? undefined : handleSliderChange}
                      disabled={isLocked}
                      className={isLocked ? "opacity-50" : ""}
                    />
                    {isLocked && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="absolute inset-0 cursor-not-allowed" />
                        </TooltipTrigger>
                        <TooltipContent>Unlock to change topic count</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <span className="text-2xl font-bold text-foreground tabular-nums w-8 text-center">{sliderValue}</span>
                </div>
              </div>

              {/* Lock button */}
              <div className="shrink-0">
                {isLocked ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                      <Lock className="h-3 w-3 mr-1" />
                      Topics Locked — {chapterInfo?.topics_locked_count} topics
                    </Badge>
                    <button
                      onClick={() => lockMutation.mutate(false)}
                      className="text-[10px] text-muted-foreground hover:text-foreground underline"
                      disabled={lockMutation.isPending}
                    >
                      Unlock
                    </button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-8"
                    onClick={() => {
                      if (unassignedAssets.length > 0) {
                        setLockWarningOpen(true);
                      } else {
                        lockMutation.mutate(true);
                      }
                    }}
                    disabled={lockMutation.isPending || activeTopics.length === 0}
                  >
                    <Lock className="h-3 w-3 mr-1.5" />
                    Lock Topics →
                  </Button>
                )}
              </div>
            </div>

            {/* Topic accordion list */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="space-y-2">
                {sortedForDisplay.map((topic) => {
                  const isMerged = !topic.is_active || !!topic.merged_into_topic_id;
                  const mergedIntoName = topic.merged_into_topic_id
                    ? topics.find(t => t.id === topic.merged_into_topic_id)?.topic_name || "Unknown"
                    : null;
                  const topicAssetCodes = topic.asset_codes || [];
                  const taggedAssets = chapterAssets.filter(a => topicAssetCodes.includes(a.asset_name));
                  const isOpen = openTopicId === topic.id;
                  const isRenaming = renamingTopics.has(topic.id);

                  if (isMerged) {
                    return (
                      <div key={topic.id} className="rounded-lg border border-border/50 bg-muted/20 px-4 py-2 flex items-center gap-3">
                        <Badge variant="outline" className="text-[10px] opacity-50">{topic.topic_number}</Badge>
                        <span className="text-xs text-muted-foreground line-through">{topic.topic_name}</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Merge className="h-3 w-3" /> Merged into {mergedIntoName} ↑
                        </span>
                        {!isLocked && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] ml-auto"
                            onClick={() => undoMerge(topic.id)}
                          >
                            <Undo2 className="h-3 w-3 mr-1" /> Undo merge
                          </Button>
                        )}
                      </div>
                    );
                  }

                  return (
                    <DraggableTopicCard key={topic.id} topic={topic} disabled={isLocked}>
                      <Collapsible open={isOpen} onOpenChange={(open) => setOpenTopicId(open ? topic.id : null)}>
                        <CollapsibleTrigger asChild>
                          <button className="w-full rounded-lg border border-border bg-card hover:border-primary/40 transition-colors p-3 text-left">
                            <div className="flex items-center gap-2">
                              {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                              <Badge variant="outline" className="text-[10px] shrink-0">{topic.topic_number}</Badge>
                              <div className="flex-1 min-w-0">
                                {editingNameId === topic.id ? (
                                  <Input
                                    ref={nameInputRef}
                                    value={editingNameValue}
                                    onChange={(e) => setEditingNameValue(e.target.value)}
                                    onBlur={commitNameEdit}
                                    onKeyDown={(e) => { if (e.key === "Enter") commitNameEdit(); if (e.key === "Escape") setEditingNameId(null); }}
                                    className="h-6 text-sm font-medium"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <span
                                    className="text-sm font-medium text-foreground truncate block cursor-text"
                                    onDoubleClick={(e) => { e.stopPropagation(); startNameEdit(topic); }}
                                    title="Double-click to edit"
                                  >
                                    {topic.topic_name}
                                    {isRenaming && <Sparkles className="h-3 w-3 inline ml-1.5 text-amber-400 animate-pulse" />}
                                  </span>
                                )}
                              </div>
                              <Badge variant="secondary" className="text-[10px] shrink-0">{topicAssetCodes.length} assets</Badge>
                              <Badge className={`text-[9px] h-5 ${STATUS_COLORS[topic.video_status] || STATUS_COLORS.not_started}`}>
                                Vid: {topic.video_status.replace("_", " ")}
                              </Badge>
                              <Badge className={`text-[9px] h-5 ${STATUS_COLORS[topic.quiz_status] || STATUS_COLORS.not_started}`}>
                                Quiz: {topic.quiz_status.replace("_", " ")}
                              </Badge>
                            </div>
                          </button>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="border border-t-0 border-border rounded-b-lg bg-card px-4 py-4 space-y-5">
                            {/* SUB-SECTION A: Topic Info */}
                            <div className="space-y-3">
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Topic Info</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] text-muted-foreground">Description</label>
                                  <Textarea
                                    defaultValue={topic.topic_description || ""}
                                    onBlur={(e) => saveMutation.mutate({ id: topic.id, updates: { topic_description: e.target.value } })}
                                    className="text-xs mt-1 min-h-[60px]"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground">Rationale</label>
                                  <Textarea
                                    defaultValue={topic.topic_rationale || ""}
                                    onBlur={(e) => saveMutation.mutate({ id: topic.id, updates: { topic_rationale: e.target.value } })}
                                    className="text-xs mt-1 min-h-[60px]"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] text-muted-foreground">Video URL</label>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Select
                                      value={topic.video_status}
                                      onValueChange={(v) => saveMutation.mutate({ id: topic.id, updates: { video_status: v } })}
                                    >
                                      <SelectTrigger className="h-7 text-xs w-28">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {STATUS_OPTIONS.map(s => (
                                          <SelectItem key={s} value={s} className="text-xs">{s.replace("_", " ")}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      defaultValue={topic.lw_video_link || ""}
                                      placeholder="LearnWorlds video URL"
                                      className="h-7 text-xs flex-1"
                                      onBlur={(e) => saveMutation.mutate({ id: topic.id, updates: { lw_video_link: e.target.value } })}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground">Quiz URL</label>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Select
                                      value={topic.quiz_status}
                                      onValueChange={(v) => saveMutation.mutate({ id: topic.id, updates: { quiz_status: v } })}
                                    >
                                      <SelectTrigger className="h-7 text-xs w-28">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {STATUS_OPTIONS.map(s => (
                                          <SelectItem key={s} value={s} className="text-xs">{s.replace("_", " ")}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      defaultValue={topic.lw_quiz_link || ""}
                                      placeholder="LearnWorlds quiz URL"
                                      className="h-7 text-xs flex-1"
                                      onBlur={(e) => saveMutation.mutate({ id: topic.id, updates: { lw_quiz_link: e.target.value } })}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* SUB-SECTION B: Assets Table */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                  Assets ({taggedAssets.length})
                                </h4>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-[10px]"
                                  onClick={() => setShowAddAssetForTopic(showAddAssetForTopic === topic.id ? null : topic.id)}
                                >
                                  <Plus className="h-3 w-3 mr-1" /> Add Asset
                                </Button>
                              </div>

                              {showAddAssetForTopic === topic.id && (
                                <div className="border border-border rounded-md p-2 space-y-1">
                                  <Input
                                    value={addAssetSearch}
                                    onChange={(e) => setAddAssetSearch(e.target.value)}
                                    placeholder="Search untagged assets…"
                                    className="h-7 text-xs"
                                  />
                                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                                    {(() => {
                                      const allTaggedCodes = topics.flatMap(t => t.asset_codes || []);
                                      const untagged = chapterAssets.filter(a => !allTaggedCodes.includes(a.asset_name));
                                      const filtered = addAssetSearch
                                        ? untagged.filter(a =>
                                          a.asset_name.toLowerCase().includes(addAssetSearch.toLowerCase()) ||
                                          (a.problem_title || "").toLowerCase().includes(addAssetSearch.toLowerCase())
                                        )
                                        : untagged;
                                      return filtered.length === 0 ? (
                                        <p className="text-[10px] text-muted-foreground py-2 text-center">No untagged assets found</p>
                                      ) : filtered.slice(0, 20).map(a => (
                                        <button
                                          key={a.id}
                                          className="w-full text-left px-2 py-1 rounded text-xs hover:bg-muted/30 transition-colors"
                                          onClick={() => addAssetMutation.mutate({ topicId: topic.id, asset: a })}
                                        >
                                          <span className="font-mono text-[10px] text-primary">{a.asset_name}</span>
                                          {a.problem_title && <span className="text-muted-foreground ml-2">{a.problem_title}</span>}
                                        </button>
                                      ));
                                    })()}
                                  </div>
                                </div>
                              )}

                              {taggedAssets.length > 0 ? (
                                <div className="rounded-md border border-border overflow-hidden">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="hover:bg-transparent">
                                        <TableHead className="text-[10px] h-8">Asset Code</TableHead>
                                        <TableHead className="text-[10px] h-8">Source Ref</TableHead>
                                        <TableHead className="text-[10px] h-8">Problem Title</TableHead>
                                        <TableHead className="text-[10px] h-8 w-24">Actions</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {taggedAssets.map(asset => (
                                        <TableRow key={asset.id}>
                                          <TableCell className="font-mono text-[10px] text-primary py-1.5">{asset.asset_name}</TableCell>
                                          <TableCell className="text-[10px] text-muted-foreground py-1.5">{asset.source_ref || "—"}</TableCell>
                                          <TableCell className="text-[10px] text-muted-foreground py-1.5 max-w-[200px] truncate" title={asset.problem_title || ""}>
                                            {asset.problem_title || "—"}
                                          </TableCell>
                                          <TableCell className="py-1.5">
                                            <div className="flex items-center gap-1">
                                              <a
                                                href={`https://learn.surviveaccounting.com/solutions/${asset.asset_name}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                                              >
                                                <ExternalLink className="h-3 w-3" /> View
                                              </a>
                                              <Select
                                                onValueChange={(destTopicId) => {
                                                  moveAssetMutation.mutate({
                                                    fromTopicId: topic.id,
                                                    toTopicId: destTopicId,
                                                    assetCode: asset.asset_name,
                                                  });
                                                }}
                                              >
                                                <SelectTrigger className="h-5 text-[10px] w-16 border-0 bg-transparent hover:bg-muted/30">
                                                  <ArrowRightLeft className="h-3 w-3" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {activeTopics
                                                    .filter(t => t.id !== topic.id)
                                                    .map(t => (
                                                      <SelectItem key={t.id} value={t.id} className="text-xs">
                                                        {t.topic_number}. {t.topic_name}
                                                      </SelectItem>
                                                    ))}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              ) : (
                                <p className="text-[10px] text-muted-foreground text-center py-3">No assets tagged to this topic yet</p>
                              )}
                            </div>

                            {/* SUB-SECTION C: Merge zone (unlocked only) */}
                            {!isLocked && (
                              <div className="border border-dashed border-border/50 rounded-md p-3 text-center">
                                <p className="text-[10px] text-muted-foreground">
                                  <Merge className="h-3 w-3 inline mr-1" />
                                  Drag another topic here to merge it into this one
                                </p>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </DraggableTopicCard>
                  );
                })}
              </div>

              <DragOverlay>
                {draggedTopic && (
                  <div className="rounded-lg border border-primary bg-card p-3 shadow-lg opacity-90">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{draggedTopic.topic_number}</Badge>
                      <span className="text-sm font-medium text-foreground">{draggedTopic.topic_name}</span>
                    </div>
                  </div>
                )}
              </DragOverlay>
            </DndContext>

            {/* Regenerate button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs mt-3"
              onClick={() => setRegenOpen(true)}
              disabled={generateMutation.isPending}
            >
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Regenerate Topics
            </Button>
          </div>
        )}
      </div>

      {/* Merge confirmation dialog */}
      <Dialog open={!!mergeConfirm} onOpenChange={() => setMergeConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Merge Topics?</DialogTitle>
          </DialogHeader>
          {mergeConfirm && (() => {
            const s = topics.find(t => t.id === mergeConfirm.sourceId);
            const d = topics.find(t => t.id === mergeConfirm.destId);
            return (
              <p className="text-xs text-muted-foreground">
                Merge <strong>{s?.topic_name}</strong> into <strong>{d?.topic_name}</strong>? This combines their assets.
              </p>
            );
          })()}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setMergeConfirm(null)}>Cancel</Button>
            <Button size="sm" onClick={() => mergeConfirm && executeMerge(mergeConfirm.sourceId, mergeConfirm.destId)}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate confirmation dialog */}
      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Regenerate Topics?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            This will replace all {topics.length} topics for Ch {workspace?.chapterNumber} including any manual edits, URL links, and asset assignments. This cannot be undone.
          </p>
          {isLocked && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2 text-xs text-amber-400">
              ⚠ This chapter's topics are locked. Regenerating will unlock them.
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setRegenOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? "Regenerating…" : "Yes, Regenerate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SurviveSidebarLayout>
  );
}
