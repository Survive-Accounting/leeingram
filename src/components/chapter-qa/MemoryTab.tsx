import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Check, X, Trash2, Edit3, Loader2, Sparkles, RefreshCw, Plus, Info,
  ArrowUp, ArrowDown,
} from "lucide-react";

const ITEM_TYPES = ["list", "criteria", "classification", "rule", "mnemonic", "steps", "mapping"] as const;
type ItemType = typeof ITEM_TYPES[number];

const TYPE_COLORS: Record<ItemType, string> = {
  list: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  criteria: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  classification: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  rule: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  mnemonic: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  steps: "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/30",
  mapping: "bg-muted text-muted-foreground border-border",
};

type MemoryItemRow = {
  id: string;
  chapter_id: string;
  title: string;
  item_type: string;
  subtitle: string | null;
  items: any[];
  sort_order: number;
  is_approved: boolean;
  is_rejected: boolean;
  generated_at: string | null;
};

type SubItem = { label: string; tooltip: string; order: number };

export function MemoryTab({ chapterId, chapterName, courseCode }: { chapterId: string; chapterName: string; courseCode: string }) {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [regenId, setRegenId] = useState<string | null>(null);
  const [regenConfirmId, setRegenConfirmId] = useState<string | null>(null);
  const [regenResult, setRegenResult] = useState<{ original: MemoryItemRow; updated: any } | null>(null);

  const { data: memoryItems, refetch } = useQuery({
    queryKey: ["cqa-memory", chapterId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapter_memory_items")
        .select("*")
        .eq("chapter_id", chapterId)
        .order("sort_order");
      return (data || []) as MemoryItemRow[];
    },
  });

  const invalidate = () => { refetch(); };

  const items = memoryItems || [];

  const handleGenerate = async (extra?: string) => {
    setGenerating(true);
    try {
      if (extra) {
        const { error } = await supabase.functions.invoke("generate-chapter-content-suite", { 
          body: { chapterId, chapterName, courseCode, extraPrompt: extra, mode: "add_memory_items" } 
        });
        if (error) throw error;
        toast.success("New memory items added.");
      } else {
        const { error } = await supabase.functions.invoke("run-memory-items-batch", { 
          body: { chapterId } 
        });
        if (error) throw error;
        toast.success("Memory items generated.");
      }
      setExtraPrompt("");
      invalidate();
    } catch (err: any) { toast.error(err.message); }
    finally { setGenerating(false); }
  };

  const approve = async (id: string) => {
    await supabase.from("chapter_memory_items").update({ is_approved: true, is_rejected: false }).eq("id", id);
    invalidate();
  };
  const reject = async (id: string) => {
    await supabase.from("chapter_memory_items").update({ is_rejected: true, is_approved: false }).eq("id", id);
    invalidate();
  };
  const deleteItem = async (id: string) => {
    await supabase.from("chapter_memory_items").delete().eq("id", id);
    invalidate();
  };
  const approveAll = async () => {
    await supabase.from("chapter_memory_items").update({ is_approved: true, is_rejected: false }).eq("chapter_id", chapterId).eq("is_rejected", false);
    invalidate();
    toast.success("All memory items approved");
  };

  const moveItem = async (id: string, direction: "up" | "down") => {
    const idx = items.findIndex(i => i.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const a = items[idx], b = items[swapIdx];
    await Promise.all([
      supabase.from("chapter_memory_items").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("chapter_memory_items").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    invalidate();
  };

  const handleRegenSingle = async (item: MemoryItemRow) => {
    setRegenId(item.id);
    setRegenConfirmId(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-chapter-content-suite", {
        body: { 
          chapterId, 
          chapterName, 
          courseCode, 
          mode: "regen_single_memory_item",
          itemId: item.id,
          itemTitle: item.title
        },
      });
      if (error) throw error;
      
      const { data: updatedItem } = await supabase
        .from("chapter_memory_items")
        .select("*")
        .eq("id", data.newId)
        .single();

      if (updatedItem) {
        setRegenResult({ original: item, updated: updatedItem });
      } else {
        invalidate();
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setRegenId(null); }
  };

  const acceptRegen = async () => {
    if (!regenResult) return;
    await supabase.from("chapter_memory_items").delete().eq("id", regenResult.original.id);
    await supabase.from("chapter_memory_items").update({
      sort_order: regenResult.original.sort_order,
      is_approved: true,
    }).eq("id", regenResult.updated.id);
    setRegenResult(null);
    invalidate();
    toast.success("New version approved");
  };

  const rejectRegen = async () => {
    if (!regenResult) return;
    await supabase.from("chapter_memory_items").delete().eq("id", regenResult.updated.id);
    setRegenResult(null);
    invalidate();
    toast.info("Original version restored");
  };

  if (items.length === 0 && !generating) {
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-sm text-muted-foreground">No memory items generated yet.</p>
        <Button onClick={() => handleGenerate()} disabled={generating}>
          <Sparkles className="h-4 w-4 mr-2" /> Generate Memory Items →
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-3 pb-10">
        {items.map((item, idx) => (
          editingId === item.id ? (
            <MemoryItemEditor key={item.id} item={item} onSave={() => { setEditingId(null); invalidate(); }} onCancel={() => setEditingId(null)} />
          ) : (
            <Card key={item.id} className={`border-border ${item.is_rejected ? "opacity-40" : ""}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">{item.title}</span>
                    <Badge className={`text-[10px] h-5 ${TYPE_COLORS[item.item_type as ItemType] || TYPE_COLORS.mapping}`}>
                      {item.item_type}
                    </Badge>
                    {item.is_approved && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] h-5">Approved ✓</Badge>}
                    {item.is_rejected && <Badge variant="destructive" className="text-[10px] h-5">Rejected</Badge>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveItem(item.id, "up")} disabled={idx === 0}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveItem(item.id, "down")} disabled={idx === items.length - 1}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    {!item.is_approved && (
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-emerald-400" onClick={() => approve(item.id)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => reject(item.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingId(item.id)}>
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-6 w-6 p-0"
                      disabled={regenId === item.id}
                      onClick={() => setRegenConfirmId(item.id)}
                    >
                      {regenId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive/60" onClick={() => deleteItem(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {item.subtitle && (
                  <p className="text-xs text-muted-foreground italic">{item.subtitle}</p>
                )}

                <div className="space-y-1.5">
                  {(Array.isArray(item.items) ? item.items : []).sort((a: SubItem, b: SubItem) => (a.order || 0) - (b.order || 0)).map((sub: SubItem, si: number) => (
                    <div key={si} className="flex items-start gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-[hsl(var(--primary))] text-primary-foreground text-[10px] font-bold flex items-center justify-center mt-0.5">
                        {sub.order || si + 1}
                      </span>
                      <span className="text-sm font-medium text-foreground">{sub.label}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="shrink-0 mt-0.5">
                            <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="right"
                          className="max-w-[280px] bg-[hsl(var(--primary))] text-primary-foreground border-[hsl(var(--primary))] rounded-md text-xs p-3"
                        >
                          {sub.tooltip}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ))}
                </div>

                {regenResult && regenResult.original.id === item.id && (
                  <div className="mt-3 p-3 rounded-md border border-amber-500/30 bg-amber-500/5 space-y-2">
                    <p className="text-xs font-semibold text-amber-400">New Version:</p>
                    <div className="space-y-1">
                      {(Array.isArray(regenResult.updated.items) ? regenResult.updated.items : []).map((sub: SubItem, si: number) => (
                        <div key={si} className="flex items-center gap-2 text-xs">
                          <span className="font-medium">{sub.order}. {sub.label}</span>
                          <span className="text-muted-foreground truncate">— {sub.tooltip?.slice(0, 60)}…</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs" onClick={acceptRegen}><Check className="h-3 w-3 mr-1" /> Accept New</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={rejectRegen}><X className="h-3 w-3 mr-1" /> Keep Original</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        ))}

        {items.some(i => !i.is_approved) && (
          <Button size="sm" variant="outline" onClick={approveAll} className="w-full">
            <Check className="h-3.5 w-3.5 mr-1" /> Approve All
          </Button>
        )}

        <div className="space-y-2 pt-4 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground">Something missing?</p>
          <Textarea
            value={extraPrompt}
            onChange={e => setExtraPrompt(e.target.value)}
            placeholder="Describe what to add — e.g. 'Add a mnemonic for the 5 components of pension expense'..."
            className="text-sm min-h-[60px]"
          />
          <Button
            size="sm"
            onClick={() => handleGenerate(extraPrompt || undefined)}
            disabled={generating}
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
            {extraPrompt ? "Run Again (add new)" : "Run Again (regenerate unapproved)"}
          </Button>
        </div>

        <Dialog open={!!regenConfirmId} onOpenChange={o => { if (!o) setRegenConfirmId(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm">Regenerate this item?</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">Current version will be replaced. You'll see a before/after comparison to approve or reject.</p>
            <DialogFooter>
              <Button size="sm" variant="outline" onClick={() => setRegenConfirmId(null)}>Cancel</Button>
              <Button size="sm" onClick={() => {
                const item = items.find(i => i.id === regenConfirmId);
                if (item) handleRegenSingle(item);
              }}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function MemoryItemEditor({ item, onSave, onCancel }: { item: MemoryItemRow; onSave: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [subtitle, setSubtitle] = useState(item.subtitle || "");
  const [itemType, setItemType] = useState(item.item_type);
  const [subItems, setSubItems] = useState<SubItem[]>(
    (Array.isArray(item.items) ? item.items : []).map((s: any, i: number) => ({
      label: s.label || "",
      tooltip: s.tooltip || "",
      order: s.order || i + 1,
    }))
  );
  const [saving, setSaving] = useState(false);

  const addSubItem = () => {
    setSubItems(prev => [...prev, { label: "", tooltip: "", order: prev.length + 1 }]);
  };

  const removeSubItem = (idx: number) => {
    setSubItems(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
  };

  const updateSubItem = (idx: number, field: keyof SubItem, value: string | number) => {
    setSubItems(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const moveSubItem = (idx: number, direction: "up" | "down") => {
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= subItems.length) return;
    const newItems = [...subItems];
    [newItems[idx], newItems[swapIdx]] = [newItems[swapIdx], newItems[idx]];
    setSubItems(newItems.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("chapter_memory_items").update({
        title,
        subtitle: subtitle || null,
        item_type: itemType,
        items: subItems as any,
      }).eq("id", item.id);
      if (error) throw error;
      toast.success("Memory item saved");
      onSave();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Title</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="text-sm h-8" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Type</label>
            <Select value={itemType} onValueChange={setItemType}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground">Subtitle</label>
          <Input value={subtitle} onChange={e => setSubtitle(e.target.value)} className="text-sm h-8" placeholder="Why this matters on exams..." />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-medium text-muted-foreground">Items</label>
          {subItems.map((sub, si) => (
            <div key={si} className="flex items-start gap-2 p-2 rounded bg-background border border-border">
              <div className="flex flex-col gap-0.5 shrink-0 pt-1">
                <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => moveSubItem(si, "up")} disabled={si === 0}>
                  <ArrowUp className="h-2.5 w-2.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => moveSubItem(si, "down")} disabled={si === subItems.length - 1}>
                  <ArrowDown className="h-2.5 w-2.5" />
                </Button>
              </div>
              <div className="flex-1 space-y-1">
                <Input value={sub.label} onChange={e => updateSubItem(si, "label", e.target.value)} className="text-xs h-7" placeholder="Label (max 6 words)" />
                <Textarea value={sub.tooltip} onChange={e => updateSubItem(si, "tooltip", e.target.value)} className="text-xs min-h-[40px]" placeholder="Tooltip..." />
              </div>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive/60 shrink-0" onClick={() => removeSubItem(si)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" className="text-xs" onClick={addSubItem}>
            <Plus className="h-3 w-3 mr-1" /> Add Item
          </Button>
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
