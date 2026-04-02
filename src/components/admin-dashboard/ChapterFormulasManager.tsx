import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Download, Upload, RefreshCw, CheckCircle2, ChevronDown, FlaskConical, Image, RotateCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function ChapterFormulasManager() {
  const queryClient = useQueryClient();
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [regeneratingImageId, setRegeneratingImageId] = useState<string | null>(null);
  const [confirmRegenOpen, setConfirmRegenOpen] = useState(false);
  const [confirmImagesOpen, setConfirmImagesOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [lastReasoning, setLastReasoning] = useState<string | null>(null);

  const { data: chapters } = useQuery({
    queryKey: ["formula-mgr-chapters"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id, courses!chapters_course_id_fkey(code, course_name)")
        .order("chapter_number");
      return (data || []).sort((a: any, b: any) => {
        const codeA = a.courses?.code || "";
        const codeB = b.courses?.code || "";
        if (codeA !== codeB) return codeA.localeCompare(codeB);
        return a.chapter_number - b.chapter_number;
      });
    },
  });

  const { data: formulas, isLoading: formulasLoading } = useQuery({
    queryKey: ["chapter-formulas", selectedChapterId],
    queryFn: async () => {
      if (!selectedChapterId) return [];
      const { data } = await supabase
        .from("chapter_formulas")
        .select("*")
        .eq("chapter_id", selectedChapterId)
        .order("sort_order");
      return data || [];
    },
    enabled: !!selectedChapterId,
  });

  const selectedChapter = chapters?.find((c: any) => c.id === selectedChapterId);
  const approvedCount = formulas?.filter((f: any) => f.is_approved).length || 0;
  const totalCount = formulas?.length || 0;
  const lastGenerated = formulas?.[0]?.generated_at;
  const needsImageCount = formulas?.filter((f: any) => f.is_approved && !f.image_url).length || 0;
  const allApproved = totalCount > 0 && approvedCount === totalCount;

  const handleGenerate = async () => {
    setConfirmRegenOpen(false);
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-chapter-formulas", {
        body: { chapter_id: selectedChapterId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLastReasoning(data.reasoning || null);
      setReasoningOpen(true);
      toast.success(`Generated ${data.count} formulas`);
      queryClient.invalidateQueries({ queryKey: ["chapter-formulas", selectedChapterId] });
    } catch (e: any) {
      toast.error("Generation failed", { description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateImages = async () => {
    setConfirmImagesOpen(false);
    setGeneratingImages(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-formula-images", {
        body: { chapter_id: selectedChapterId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const msg = `Generated ${data.generated} images`;
      if (data.errors?.length) {
        toast.warning(msg, { description: `${data.errors.length} errors occurred` });
      } else {
        toast.success(msg);
      }
      queryClient.invalidateQueries({ queryKey: ["chapter-formulas", selectedChapterId] });
    } catch (e: any) {
      toast.error("Image generation failed", { description: e.message });
    } finally {
      setGeneratingImages(false);
    }
  };

  const handleRegenerateImage = async (formulaId: string) => {
    setRegeneratingImageId(formulaId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-formula-images", {
        body: { chapter_id: selectedChapterId, formula_id: formulaId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data.errors?.length) {
        toast.error("Image failed", { description: data.errors[0] });
      } else {
        toast.success("Image regenerated");
      }
      queryClient.invalidateQueries({ queryKey: ["chapter-formulas", selectedChapterId] });
    } catch (e: any) {
      toast.error("Regeneration failed", { description: e.message });
    } finally {
      setRegeneratingImageId(null);
    }
  };

  const handleExportJson = () => {
    if (!formulas?.length) return;
    const exportData = formulas.map((f: any) => ({
      formula_name: f.formula_name,
      formula_expression: f.formula_expression,
      formula_explanation: f.formula_explanation,
      sort_order: f.sort_order,
    }));
    const courseCode = (selectedChapter as any)?.courses?.code || "UNK";
    const chNum = String(selectedChapter?.chapter_number || 0).padStart(2, "0");
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${courseCode}-Ch${chNum}-formulas.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported JSON");
  };

  const handleImport = async () => {
    try {
      const parsed = JSON.parse(importJson);
      if (!Array.isArray(parsed)) throw new Error("JSON must be an array");
      for (const f of parsed) {
        if (!f.formula_name || !f.formula_expression) throw new Error("Each formula must have formula_name and formula_expression");
      }
      await supabase.from("chapter_formulas").delete().eq("chapter_id", selectedChapterId);
      const rows = parsed.map((f: any, i: number) => ({
        chapter_id: selectedChapterId,
        formula_name: f.formula_name,
        formula_expression: f.formula_expression,
        formula_explanation: f.formula_explanation || null,
        sort_order: f.sort_order ?? i + 1,
        is_approved: false,
      }));
      const { error } = await supabase.from("chapter_formulas").insert(rows);
      if (error) throw error;
      setImportOpen(false);
      setImportJson("");
      toast.success(`Imported ${rows.length} formulas`);
      queryClient.invalidateQueries({ queryKey: ["chapter-formulas", selectedChapterId] });
    } catch (e: any) {
      toast.error("Import failed", { description: e.message });
    }
  };

  const handleToggleApproved = async (id: string, current: boolean) => {
    const { error } = await supabase.from("chapter_formulas").update({ is_approved: !current }).eq("id", id);
    if (error) {
      toast.error("Update failed");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["chapter-formulas", selectedChapterId] });
  };

  const handleApproveAll = async () => {
    const { error } = await supabase
      .from("chapter_formulas")
      .update({ is_approved: true })
      .eq("chapter_id", selectedChapterId);
    if (error) {
      toast.error("Failed to approve all");
      return;
    }
    toast.success(`Approved all ${totalCount} formulas`);
    queryClient.invalidateQueries({ queryKey: ["chapter-formulas", selectedChapterId] });
  };

  const handleSortChange = async (id: string, newSort: number) => {
    await supabase.from("chapter_formulas").update({ sort_order: newSort }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["chapter-formulas", selectedChapterId] });
  };

  return (
    <div className="space-y-4">
      {/* Chapter selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedChapterId} onValueChange={setSelectedChapterId}>
          <SelectTrigger className="w-[360px] bg-card">
            <SelectValue placeholder="Select a chapter..." />
          </SelectTrigger>
          <SelectContent>
            {(chapters || []).map((ch: any) => (
              <SelectItem key={ch.id} value={ch.id}>
                {ch.courses?.code} Ch {ch.chapter_number} — {ch.chapter_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedChapterId && (
        <p className="text-sm text-muted-foreground py-8 text-center">Select a chapter to manage formulas.</p>
      )}

      {selectedChapterId && (
        <>
          {/* Header row */}
          <div className="flex items-center gap-3 flex-wrap justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold text-foreground">
                {(selectedChapter as any)?.courses?.code} Ch {selectedChapter?.chapter_number}: {selectedChapter?.chapter_name}
              </h3>
              <p className="text-xs text-muted-foreground">
                {totalCount} formulas · {approvedCount} approved
                {lastGenerated && ` · Generated ${formatDistanceToNow(new Date(lastGenerated), { addSuffix: true })}`}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => totalCount > 0 ? setConfirmRegenOpen(true) : handleGenerate()}
                disabled={generating}
              >
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                {totalCount > 0 ? "Regenerate" : "Generate"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportJson} disabled={totalCount === 0}>
                <Download className="h-3.5 w-3.5 mr-1" /> Export JSON
              </Button>
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Import JSON
              </Button>
              {totalCount > 0 && approvedCount < totalCount && (
                <Button size="sm" onClick={handleApproveAll}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve All ({totalCount})
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmImagesOpen(true)}
                disabled={!allApproved || generatingImages || needsImageCount === 0}
              >
                {generatingImages ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Image className="h-3.5 w-3.5 mr-1" />}
                Generate Images ({needsImageCount})
              </Button>
            </div>
          </div>

          {/* Formula list */}
          {formulasLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : totalCount === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No formulas yet. Click "Generate" to create them from approved assets.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(formulas || []).map((f: any) => (
                <Card key={f.id} className={`border-border ${f.is_approved ? "border-l-4 border-l-green-500" : ""}`}>
                  <CardContent className="py-3 px-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {/* Sort order */}
                      <input
                        type="number"
                        min={1}
                        max={20}
                        defaultValue={f.sort_order}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v) && v !== f.sort_order) handleSortChange(f.id, v);
                        }}
                        onChange={() => {}}
                        className="w-10 h-8 text-center text-xs bg-secondary border border-border rounded"
                      />

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-foreground">{f.formula_name}</p>
                        <p className="text-sm font-mono bg-secondary/50 rounded px-2 py-1 text-foreground">
                          {f.formula_expression}
                        </p>
                        {f.formula_explanation && (
                          <p className="text-xs text-muted-foreground">{f.formula_explanation}</p>
                        )}
                      </div>

                      {/* Approve toggle + Regen image */}
                      <div className="flex items-center gap-3 shrink-0">
                        {f.is_approved && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            disabled={regeneratingImageId === f.id}
                            onClick={() => handleRegenerateImage(f.id)}
                          >
                            {regeneratingImageId === f.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <RotateCcw className="h-3 w-3 mr-1" />
                            )}
                            {f.image_url ? "Regen Image" : "Gen Image"}
                          </Button>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{f.is_approved ? "Approved" : "Draft"}</span>
                          <Switch
                            checked={f.is_approved}
                            onCheckedChange={() => handleToggleApproved(f.id, f.is_approved)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Image preview */}
                    {f.image_url && (
                      <div className="ml-13">
                        <img
                          src={f.image_url}
                          alt={f.formula_name}
                          className="rounded-lg border border-border max-w-full h-auto"
                          style={{ maxHeight: 200 }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Reasoning panel */}
          {lastReasoning && (
            <Collapsible open={reasoningOpen} onOpenChange={setReasoningOpen}>
              <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${reasoningOpen ? "rotate-0" : "-rotate-90"}`} />
                AI Reasoning
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card className="mt-2 border-border">
                  <CardContent className="py-3 px-4">
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{lastReasoning}</p>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}

      {/* Confirm regenerate dialog */}
      <Dialog open={confirmRegenOpen} onOpenChange={setConfirmRegenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate Formulas?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will replace all {totalCount} existing formulas for{" "}
            <span className="font-medium text-foreground">{selectedChapter?.chapter_name}</span>. Continue?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRegenOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerate} variant="destructive">Replace & Regenerate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm generate images dialog */}
      <Dialog open={confirmImagesOpen} onOpenChange={setConfirmImagesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Formula Images?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will generate <span className="font-medium text-foreground">{needsImageCount} images</span> at approximately{" "}
            <span className="font-medium text-foreground">${(needsImageCount * 0.002).toFixed(3)}</span> cost. Continue?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmImagesOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerateImages}>Generate Images</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import JSON dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Formulas JSON</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={12}
            placeholder='[{"formula_name":"...","formula_expression":"...","formula_explanation":"...","sort_order":1}]'
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Paste a JSON array of formula objects. This will replace all existing formulas for this chapter.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={!importJson.trim()}>Import & Replace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
