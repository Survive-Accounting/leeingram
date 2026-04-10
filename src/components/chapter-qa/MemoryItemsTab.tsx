import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Brain, Check, Loader2, Sparkles, Trash2, X } from "lucide-react";

type MemoryPoint = {
  label: string;
  tooltip: string;
  order: number;
};

type MemoryItemRow = {
  id: string;
  chapter_id: string | null;
  created_at?: string | null;
  generated_at?: string | null;
  is_approved: boolean | null;
  is_rejected: boolean | null;
  item_type: string;
  items: unknown;
  sort_order: number | null;
  subtitle: string | null;
  title: string;
};

function formatItemType(value: string) {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeMemoryPoints(value: unknown): MemoryPoint[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry, index) => {
      if (typeof entry === "string") {
        return {
          label: entry,
          tooltip: "",
          order: index + 1,
        };
      }

      if (!entry || typeof entry !== "object") return null;
      const point = entry as Record<string, unknown>;

      return {
        label: typeof point.label === "string" && point.label.trim() ? point.label : `Point ${index + 1}`,
        tooltip: typeof point.tooltip === "string" ? point.tooltip : "",
        order: typeof point.order === "number" ? point.order : index + 1,
      };
    })
    .filter((entry): entry is MemoryPoint => !!entry)
    .sort((a, b) => a.order - b.order);
}

export function MemoryItemsTab({
  chapterId,
  chapterName,
  courseCode,
}: {
  chapterId: string;
  chapterName: string;
  courseCode: string;
}) {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState("");

  const { data: memoryItems, refetch } = useQuery({
    queryKey: ["cqa-memory-items", chapterId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapter_memory_items")
        .select("*")
        .eq("chapter_id", chapterId)
        .order("sort_order");

      return (data || []) as MemoryItemRow[];
    },
  });

  const invalidate = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["cqa-memory-counts"] });
    qc.invalidateQueries({ queryKey: ["memory-batch-chapters"] });
  };

  const handleGenerate = async (extra?: string) => {
    setGenerating(true);
    try {
      const body: Record<string, unknown> = {
        chapterId,
        chapterName,
        courseCode,
        only: "memory_items",
      };
      if (extra) body.extraPrompt = extra;

      const { error } = await supabase.functions.invoke("generate-chapter-content-suite", { body });
      if (error) throw error;

      toast.success(extra ? "New memory items added." : "Memory items generated.");
      setExtraPrompt("");
      invalidate();
    } catch (err: any) {
      toast.error(err.message || "Generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const approve = async (id: string) => {
    await supabase.from("chapter_memory_items").update({ is_approved: true, is_rejected: false }).eq("id", id);
    invalidate();
  };

  const reject = async (id: string) => {
    await supabase.from("chapter_memory_items").update({ is_rejected: true, is_approved: false }).eq("id", id);
    invalidate();
  };

  const remove = async (id: string) => {
    await supabase.from("chapter_memory_items").delete().eq("id", id);
    invalidate();
  };

  const approveAll = async () => {
    await supabase.from("chapter_memory_items").update({ is_approved: true, is_rejected: false }).eq("chapter_id", chapterId);
    invalidate();
    toast.success("All memory items approved");
  };

  const rejectAll = async () => {
    await supabase.from("chapter_memory_items").update({ is_rejected: true, is_approved: false }).eq("chapter_id", chapterId);
    invalidate();
    toast.success("All memory items rejected");
  };

  const swap = async (current: MemoryItemRow, target: MemoryItemRow) => {
    await Promise.all([
      supabase.from("chapter_memory_items").update({ sort_order: target.sort_order }).eq("id", current.id),
      supabase.from("chapter_memory_items").update({ sort_order: current.sort_order }).eq("id", target.id),
    ]);
    invalidate();
  };

  if (!memoryItems?.length && !generating) {
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-sm text-muted-foreground">No memory items generated yet.</p>
        <Button onClick={() => handleGenerate()} disabled={generating}>
          <Brain className="h-4 w-4 mr-2" /> Generate Memory Items →
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-20">
      {memoryItems?.map((memoryItem, index) => (
        <MemoryItemRowBlock
          key={memoryItem.id}
          item={memoryItem}
          onApprove={() => approve(memoryItem.id)}
          onReject={() => reject(memoryItem.id)}
          onDelete={() => remove(memoryItem.id)}
          onMoveUp={index > 0 ? () => swap(memoryItem, memoryItems[index - 1]) : undefined}
          onMoveDown={index < memoryItems.length - 1 ? () => swap(memoryItem, memoryItems[index + 1]) : undefined}
        />
      ))}

      <div className="rounded-lg border border-border p-4 space-y-3 mt-3">
        <p className="text-sm font-semibold text-foreground">Something missing? Add a prompt:</p>
        <Textarea
          value={extraPrompt}
          onChange={(event) => setExtraPrompt(event.target.value)}
          placeholder="e.g. Add a memory item comparing operating vs finance leases and another for pension expense components."
          className="text-sm"
          rows={3}
        />
        <Button size="sm" onClick={() => handleGenerate(extraPrompt.trim())} disabled={generating || !extraPrompt.trim()}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
          Run Again with This Prompt →
        </Button>
      </div>

      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border py-2 px-3 flex gap-2 -mx-3">
        <Button size="sm" variant="outline" className="text-xs" onClick={approveAll}>
          <Check className="h-3 w-3 mr-1" /> Approve All ✓
        </Button>
        <Button size="sm" variant="outline" className="text-xs text-destructive" onClick={rejectAll}>
          <X className="h-3 w-3 mr-1" /> Reject All ✗
        </Button>
        <Button size="sm" variant="ghost" className="text-xs ml-auto" onClick={() => handleGenerate()} disabled={generating}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Brain className="h-3.5 w-3.5 mr-1" />}
          Regenerate All
        </Button>
      </div>
    </div>
  );
}

function MemoryItemRowBlock({
  item,
  onApprove,
  onReject,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  item: MemoryItemRow;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const points = normalizeMemoryPoints(item.items);
  const statusPill = item.is_approved ? (
    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] h-5">Approved ✓</Badge>
  ) : item.is_rejected ? (
    <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px] h-5">Rejected ✗</Badge>
  ) : (
    <Badge variant="secondary" className="text-[10px] h-5">Pending</Badge>
  );

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-3 bg-muted/20 border-b border-border/50">
        <div className="flex items-start gap-2">
          <div className="flex flex-col gap-0.5 shrink-0 mt-0.5">
            <button onClick={onMoveUp} disabled={!onMoveUp} className="p-0.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-20 transition-colors">
              <ArrowUp className="h-3 w-3" />
            </button>
            <button onClick={onMoveDown} disabled={!onMoveDown} className="p-0.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-20 transition-colors">
              <ArrowDown className="h-3 w-3" />
            </button>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <Badge variant="outline" className="text-[10px] h-5 capitalize">{formatItemType(item.item_type)}</Badge>
              <Badge variant="outline" className="text-[10px] h-5">{points.length} points</Badge>
              {statusPill}
            </div>
            {item.subtitle && <p className="text-[11px] text-muted-foreground leading-relaxed">{item.subtitle}</p>}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onApprove} className="p-1 rounded hover:bg-emerald-500/20 text-emerald-500 transition-colors" title="Approve">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={onReject} className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors" title="Reject">
              <X className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors" title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-3 grid gap-2 sm:grid-cols-2">
        {points.length > 0 ? (
          points.map((point) => (
            <div key={`${item.id}-${point.order}-${point.label}`} className="rounded-md border border-border bg-background p-3 space-y-1.5">
              <div className="flex items-start gap-2">
                <Badge variant="secondary" className="text-[9px] h-4 shrink-0">{point.order}</Badge>
                <p className="text-xs font-semibold text-foreground leading-relaxed">{point.label}</p>
              </div>
              {point.tooltip && <p className="text-[11px] text-muted-foreground leading-relaxed pl-7">{point.tooltip}</p>}
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">No points saved for this memory item yet.</p>
        )}
      </div>
    </div>
  );
}
