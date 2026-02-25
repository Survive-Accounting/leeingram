import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Image, ClipboardPaste, X } from "lucide-react";
import { toast } from "sonner";

const MAX_BATCH = 20;

interface BatchRow {
  type: "Exercise" | "Problem";
  number: string;
  description: string;
  problemFile: File | null;
  solutionFile: File | null;
}

const emptyRow = (): BatchRow => ({
  type: "Exercise",
  number: "",
  description: "",
  problemFile: null,
  solutionFile: null,
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapterId: string;
  chapterNumber: number;
}

export function BatchAddDialog({ open, onOpenChange, chapterId, chapterNumber }: Props) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<BatchRow[]>([emptyRow(), emptyRow(), emptyRow()]);

  const updateRow = useCallback((idx: number, patch: Partial<BatchRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }, []);

  const addRow = () => {
    if (rows.length >= MAX_BATCH) {
      toast.error(`Max ${MAX_BATCH} pairs per batch`);
      return;
    }
    setRows((prev) => [...prev, emptyRow()]);
  };

  const removeRow = (idx: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePaste = (idx: number, field: "problemFile" | "solutionFile") => (e: React.ClipboardEvent) => {
    const imgs = Array.from(e.clipboardData.items)
      .filter((i) => i.type.startsWith("image/"))
      .map((i) => i.getAsFile())
      .filter(Boolean) as File[];
    if (imgs.length) {
      e.preventDefault();
      updateRow(idx, { [field]: imgs[0] });
    }
  };

  const uploadImage = async (pairId: string, file: File, assetType: string) => {
    const path = `${chapterId}/${pairId}/${assetType}_0_${Date.now()}.${file.name.split(".").pop() || "png"}`;
    const { error: upErr } = await supabase.storage.from("problem-assets").upload(path, file);
    if (upErr) throw upErr;
    const { data: urlData } = supabase.storage.from("problem-assets").getPublicUrl(path);
    const { error: dbErr } = await supabase.from("problem_assets").insert({
      problem_pair_id: pairId,
      asset_type: assetType,
      file_url: urlData.publicUrl,
      file_name: file.name,
      page_index: 0,
    });
    if (dbErr) throw dbErr;
  };

  const batchMutation = useMutation({
    mutationFn: async () => {
      const valid = rows.filter((r) => r.number.trim() !== "");
      if (!valid.length) throw new Error("Enter at least one problem number");

      for (const row of valid) {
        const num = parseInt(row.number);
        if (isNaN(num)) throw new Error(`Invalid number: ${row.number}`);
        const code = `${row.type === "Exercise" ? "E" : "P"}${chapterNumber}-${num}`;
        const { data: pair, error } = await supabase
          .from("problem_pairs")
          .insert({ chapter_id: chapterId, type: row.type, number: num, problem_code: code, description: row.description })
          .select()
          .single();
        if (error) throw error;
        if (row.problemFile) await uploadImage(pair.id, row.problemFile, "problem_image");
        if (row.solutionFile) await uploadImage(pair.id, row.solutionFile, "solution_image");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["problem-pairs", chapterId] });
      qc.invalidateQueries({ queryKey: ["problem-assets", chapterId] });
      const count = rows.filter((r) => r.number.trim() !== "").length;
      toast.success(`${count} problem pair${count > 1 ? "s" : ""} added`);
      setRows([emptyRow(), emptyRow(), emptyRow()]);
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const validCount = rows.filter((r) => r.number.trim() !== "").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Batch Add — up to {MAX_BATCH} pairs</DialogTitle>
        </DialogHeader>

        {/* Header */}
        <div className="grid grid-cols-[60px_70px_1fr_80px_80px_32px] gap-1.5 items-center text-[10px] text-muted-foreground uppercase tracking-wider px-1 mb-1">
          <span>Type</span>
          <span>#</span>
          <span>Description</span>
          <span className="text-center">Prob img</span>
          <span className="text-center">Sol img</span>
          <span />
        </div>

        {/* Rows */}
        <div className="space-y-1.5">
          {rows.map((row, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[60px_70px_1fr_80px_80px_32px] gap-1.5 items-center"
            >
              <Select value={row.type} onValueChange={(v) => updateRow(idx, { type: v as "Exercise" | "Problem" })}>
                <SelectTrigger className="h-8 text-[11px] px-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Exercise">E</SelectItem>
                  <SelectItem value="Problem">P</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="number"
                value={row.number}
                onChange={(e) => updateRow(idx, { number: e.target.value })}
                placeholder="#"
                className="h-8 text-xs"
              />

              <Input
                value={row.description}
                onChange={(e) => updateRow(idx, { description: e.target.value })}
                placeholder="optional desc..."
                className="h-8 text-xs"
              />

              {/* Problem image cell */}
              <div
                className="h-8 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors relative"
                tabIndex={0}
                onPaste={handlePaste(idx, "problemFile")}
                title="Click & Ctrl+V to paste"
              >
                {row.problemFile ? (
                  <div className="flex items-center gap-0.5">
                    <Image className="h-3 w-3 text-primary" />
                    <button
                      onClick={(e) => { e.stopPropagation(); updateRow(idx, { problemFile: null }); }}
                      className="text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <ClipboardPaste className="h-3 w-3 text-muted-foreground/40" />
                )}
              </div>

              {/* Solution image cell */}
              <div
                className="h-8 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors relative"
                tabIndex={0}
                onPaste={handlePaste(idx, "solutionFile")}
                title="Click & Ctrl+V to paste"
              >
                {row.solutionFile ? (
                  <div className="flex items-center gap-0.5">
                    <Image className="h-3 w-3 text-primary" />
                    <button
                      onClick={(e) => { e.stopPropagation(); updateRow(idx, { solutionFile: null }); }}
                      className="text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <ClipboardPaste className="h-3 w-3 text-muted-foreground/40" />
                )}
              </div>

              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => removeRow(idx)}
                disabled={rows.length <= 1}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={addRow} disabled={rows.length >= MAX_BATCH} className="mt-2">
          <Plus className="mr-1 h-3 w-3" /> Add Row ({rows.length}/{MAX_BATCH})
        </Button>

        <DialogFooter className="mt-4">
          <p className="text-xs text-muted-foreground mr-auto">{validCount} pair{validCount !== 1 ? "s" : ""} ready</p>
          <Button onClick={() => batchMutation.mutate()} disabled={batchMutation.isPending || validCount === 0}>
            {batchMutation.isPending ? "Saving..." : `Save ${validCount} Pair${validCount !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
