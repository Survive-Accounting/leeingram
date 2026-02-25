import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Plus, Check, Image, Filter, Layers } from "lucide-react";
import { toast } from "sonner";
import { ImagePasteArea } from "./ImagePasteArea";
import { BatchAddDialog } from "./BatchAddDialog";

interface Props {
  chapterId: string;
  chapterNumber: number;
}

export function ProblemBankTab({ chapterId, chapterNumber }: Props) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  // Form state
  const [type, setType] = useState<"Exercise" | "Problem">("Exercise");
  const [number, setNumber] = useState("");
  const [description, setDescription] = useState("");
  const [problemFiles, setProblemFiles] = useState<File[]>([]);
  const [solutionFiles, setSolutionFiles] = useState<File[]>([]);

  const { data: pairs } = useQuery({
    queryKey: ["problem-pairs", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("problem_pairs")
        .select("*")
        .eq("chapter_id", chapterId)
        .order("type")
        .order("number");
      if (error) throw error;
      return data;
    },
  });

  const { data: assets } = useQuery({
    queryKey: ["problem-assets", chapterId],
    queryFn: async () => {
      if (!pairs?.length) return [];
      const ids = pairs.map((p) => p.id);
      const { data, error } = await supabase
        .from("problem_assets")
        .select("*")
        .in("problem_pair_id", ids);
      if (error) throw error;
      return data;
    },
    enabled: !!pairs?.length,
  });

  const { data: lessonPairs } = useQuery({
    queryKey: ["lesson-problem-pairs", chapterId],
    queryFn: async () => {
      if (!pairs?.length) return [];
      const ids = pairs.map((p) => p.id);
      const { data, error } = await supabase
        .from("lesson_problem_pairs")
        .select("problem_pair_id")
        .in("problem_pair_id", ids);
      if (error) throw error;
      return data;
    },
    enabled: !!pairs?.length,
  });

  const assignedIds = new Set(lessonPairs?.map((lp) => lp.problem_pair_id) ?? []);

  const uploadImages = useCallback(async (pairId: string, files: File[], assetType: string) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = `${chapterId}/${pairId}/${assetType}_${i}_${Date.now()}.${file.name.split(".").pop() || "png"}`;
      const { error: upErr } = await supabase.storage.from("problem-assets").upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("problem-assets").getPublicUrl(path);
      const { error: dbErr } = await supabase.from("problem_assets").insert({
        problem_pair_id: pairId,
        asset_type: assetType,
        file_url: urlData.publicUrl,
        file_name: file.name,
        page_index: i,
      });
      if (dbErr) throw dbErr;
    }
  }, [chapterId]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const num = parseInt(number);
      if (!num) throw new Error("Enter a valid number");
      const code = `${type === "Exercise" ? "E" : "P"}${chapterNumber}-${num}`;
      const { data: pair, error } = await supabase
        .from("problem_pairs")
        .insert({ chapter_id: chapterId, type, number: num, problem_code: code, description })
        .select()
        .single();
      if (error) throw error;
      if (problemFiles.length) await uploadImages(pair.id, problemFiles, "problem_image");
      if (solutionFiles.length) await uploadImages(pair.id, solutionFiles, "solution_image");
      return pair;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["problem-pairs", chapterId] });
      qc.invalidateQueries({ queryKey: ["problem-assets", chapterId] });
      toast.success("Problem pair added");
      resetForm();
      setDialogOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const reviewMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("problem_pairs").update({ status: "reviewed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["problem-pairs", chapterId] });
      toast.success("Marked reviewed");
    },
  });

  const resetForm = () => {
    setType("Exercise");
    setNumber("");
    setDescription("");
    setProblemFiles([]);
    setSolutionFiles([]);
  };

  const filtered = pairs?.filter((p) => {
    if (filter === "exercise") return p.type === "Exercise";
    if (filter === "problem") return p.type === "Problem";
    if (filter === "reviewed") return p.status === "reviewed" || p.status === "assigned";
    if (filter === "unassigned") return !assignedIds.has(p.id);
    if (filter === "assigned") return assignedIds.has(p.id);
    return true;
  });

  const getAssets = (pairId: string, assetType: string) =>
    assets?.filter((a) => a.problem_pair_id === pairId && a.asset_type === assetType) ?? [];

  const detailPair = pairs?.find((p) => p.id === detailId);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="exercise">Exercises</SelectItem>
              <SelectItem value="problem">Problems</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setBatchOpen(true)}>
            <Layers className="mr-1 h-3.5 w-3.5" /> Batch Add
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Pair
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Code</TableHead>
              <TableHead className="w-20">Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-16 text-center">Prob</TableHead>
              <TableHead className="w-16 text-center">Sol</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-20 text-center">Used</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!filtered?.length && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No problem pairs yet. Click "+ Add Pair" to start.
                </TableCell>
              </TableRow>
            )}
            {filtered?.map((p) => (
              <TableRow
                key={p.id}
                className="cursor-pointer"
                onClick={() => setDetailId(p.id)}
              >
                <TableCell className="font-mono text-xs font-medium">{p.problem_code}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">{p.type}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {p.description || "—"}
                </TableCell>
                <TableCell className="text-center">
                  {getAssets(p.id, "problem_image").length > 0 ? (
                    <Image className="h-3.5 w-3.5 text-primary mx-auto" />
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {getAssets(p.id, "solution_image").length > 0 ? (
                    <Image className="h-3.5 w-3.5 text-primary mx-auto" />
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      p.status === "reviewed"
                        ? "border-green-500/30 text-green-400"
                        : p.status === "assigned"
                        ? "border-primary/30 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-center text-xs">
                  {assignedIds.has(p.id) ? <Check className="h-3.5 w-3.5 text-green-400 mx-auto" /> : "—"}
                </TableCell>
                <TableCell>
                  {p.status === "uploaded" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={(e) => { e.stopPropagation(); reviewMutation.mutate(p.id); }}
                    >
                      Review
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Exercise / Problem Pair</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as "Exercise" | "Problem")}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Exercise">Exercise</SelectItem>
                    <SelectItem value="Problem">Problem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Number</Label>
                <Input
                  type="number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="e.g. 4"
                  className="h-9"
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Code: <span className="font-mono font-medium text-foreground">{type === "Exercise" ? "E" : "P"}{chapterNumber}-{number || "?"}</span>
            </div>
            <div>
              <Label className="text-xs">Description (optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description..."
                className="min-h-[50px]"
              />
            </div>
            <ImagePasteArea
              label="Paste Problem Screenshot(s) — Ctrl+V or drag"
              files={problemFiles}
              onAdd={(f) => setProblemFiles((prev) => [...prev, ...f])}
              onRemove={(i) => setProblemFiles((prev) => prev.filter((_, idx) => idx !== i))}
            />
            <ImagePasteArea
              label="Paste Solution Screenshot(s) — Ctrl+V or drag"
              files={solutionFiles}
              onAdd={(f) => setSolutionFiles((prev) => [...prev, ...f])}
              onRemove={(i) => setSolutionFiles((prev) => prev.filter((_, idx) => idx !== i))}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Save Pair"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Dialog */}
      <BatchAddDialog open={batchOpen} onOpenChange={setBatchOpen} chapterId={chapterId} chapterNumber={chapterNumber} />

      {/* Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailPair && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono">{detailPair.problem_code}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="text-sm">{detailPair.description || "No description"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <NotesEditor pairId={detailPair.id} initial={detailPair.notes ?? ""} chapterId={chapterId} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Problem Images</p>
                  <div className="grid grid-cols-2 gap-2">
                    {getAssets(detailPair.id, "problem_image").map((a) => (
                      <img key={a.id} src={a.file_url} alt="" className="rounded border border-border w-full" />
                    ))}
                    {getAssets(detailPair.id, "problem_image").length === 0 && (
                      <p className="text-xs text-muted-foreground col-span-2">None uploaded</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Solution Images</p>
                  <div className="grid grid-cols-2 gap-2">
                    {getAssets(detailPair.id, "solution_image").map((a) => (
                      <img key={a.id} src={a.file_url} alt="" className="rounded border border-border w-full" />
                    ))}
                    {getAssets(detailPair.id, "solution_image").length === 0 && (
                      <p className="text-xs text-muted-foreground col-span-2">None uploaded</p>
                    )}
                  </div>
                </div>
                {detailPair.status === "uploaded" && (
                  <Button size="sm" onClick={() => { reviewMutation.mutate(detailPair.id); setDetailId(null); }}>
                    <Check className="mr-1 h-3.5 w-3.5" /> Mark Reviewed
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotesEditor({ pairId, initial, chapterId }: { pairId: string; initial: string; chapterId: string }) {
  const [notes, setNotes] = useState(initial);
  const qc = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("problem_pairs").update({ notes }).eq("id", pairId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["problem-pairs", chapterId] });
      toast.success("Notes saved");
    },
  });

  return (
    <div className="space-y-1">
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes..."
        className="min-h-[60px] text-sm"
        onBlur={() => notes !== initial && saveMutation.mutate()}
      />
    </div>
  );
}
