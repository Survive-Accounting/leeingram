/**
 * AISolutionRegenerationPanel
 * Lee-only panel to bulk-regenerate teaching_assets.survive_solution_text
 * via the `regenerate-solution` edge function. Supports per-chapter or
 * per-course scope, dry-run preview, live progress, and full-run revert.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  ChevronDown, ChevronRight, Sparkles, Loader2, Lock, RotateCcw, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useIsLee } from "@/components/AccessRestrictedGuard";
import { useNavigate } from "react-router-dom";

type Scope = "chapter" | "course";
type Phase = "configure" | "running" | "complete";

type LogEntry = {
  ts: string;
  status: "ok" | "fail" | "skip";
  label: string;
  detail: string;
};

type AssetRow = {
  id: string;
  asset_name: string | null;
  problem_title: string | null;
  source_ref: string | null;
  source_number: string | null;
  ai_generation_status: string | null;
};

const COST_PER_ASSET_USD = 0.008;
const SECONDS_PER_ASSET = 2;
const DELAY_MS = 500;

export function AISolutionRegenerationPanel() {
  const isLee = useIsLee();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [accessDeniedOpen, setAccessDeniedOpen] = useState(false);

  const [scope, setScope] = useState<Scope>("chapter");
  const [chapterId, setChapterId] = useState<string>("");
  const [courseId, setCourseId] = useState<string>("");
  const [skipAlreadyRegenerated, setSkipAlreadyRegenerated] = useState(true);
  const [dryRun, setDryRun] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);

  const [phase, setPhase] = useState<Phase>("configure");
  const [progressIndex, setProgressIndex] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [succeeded, setSucceeded] = useState(0);
  const [failed, setFailed] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [tokensTotal, setTokensTotal] = useState(0);
  const [currentLabel, setCurrentLabel] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [chapterRunId, setChapterRunId] = useState<string>("");
  const [stopRequested, setStopRequested] = useState(false);
  const [dryPreviews, setDryPreviews] = useState<Array<{ label: string; preview: string }>>([]);
  const [reverting, setReverting] = useState(false);
  const [revertConfirmOpen, setRevertConfirmOpen] = useState(false);

  // ── Data ───────────────────────────────────────────────────────
  const { data: courses } = useQuery({
    queryKey: ["regen-courses"],
    enabled: open && isLee,
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, code, course_name")
        .order("created_at");
      return data ?? [];
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["regen-chapters"],
    enabled: open && isLee,
    queryFn: async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id")
        .order("chapter_number");
      return data ?? [];
    },
  });

  const { data: assetCounts } = useQuery({
    queryKey: ["regen-asset-counts-v2"],
    enabled: open && isLee,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      // Paginate through all rows to bypass Supabase's 1000-row default cap.
      const PAGE = 1000;
      let from = 0;
      const all: any[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("teaching_assets")
          .select("chapter_id, course_id, ai_generation_status")
          .range(from, from + PAGE - 1);
        if (error) {
          console.error("[regen-asset-counts] error", error);
          throw error;
        }
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      console.info("[regen-asset-counts] total rows received:", all.length);
      const byChapter: Record<string, { total: number; complete: number }> = {};
      const byCourse: Record<string, { total: number; complete: number }> = {};
      all.forEach((a: any) => {
        if (a.chapter_id) {
          byChapter[a.chapter_id] ??= { total: 0, complete: 0 };
          byChapter[a.chapter_id].total++;
          if (a.ai_generation_status === "complete") byChapter[a.chapter_id].complete++;
        }
        if (a.course_id) {
          byCourse[a.course_id] ??= { total: 0, complete: 0 };
          byCourse[a.course_id].total++;
          if (a.ai_generation_status === "complete") byCourse[a.course_id].complete++;
        }
      });
      const targetCh = "ff12c70e-8d9f-4a8a-bc3c-d2fd42fcf2de";
      console.info("[regen-asset-counts] Ch13 IA2 count:", byChapter[targetCh]);
      return { byChapter, byCourse };
    },
  });

  const groupedChapters = useMemo(() => {
    if (!chapters || !courses) return [];
    return courses.map((c) => ({
      ...c,
      chapters: chapters.filter((ch) => ch.course_id === c.id),
    }));
  }, [chapters, courses]);

  // ── Scope summary ──────────────────────────────────────────────
  const scopeSummary = useMemo(() => {
    if (scope === "chapter" && chapterId) {
      const ch = chapters?.find((c) => c.id === chapterId);
      const co = courses?.find((c) => c.id === ch?.course_id);
      const counts = assetCounts?.byChapter[chapterId] ?? { total: 0, complete: 0 };
      const remaining = skipAlreadyRegenerated ? counts.total - counts.complete : counts.total;
      return ch
        ? {
            id: chapterId,
            label: `Ch ${ch.chapter_number} — ${ch.chapter_name} (${co?.code ?? ""})`,
            total: counts.total,
            toProcess: remaining,
          }
        : null;
    }
    if (scope === "course" && courseId) {
      const co = courses?.find((c) => c.id === courseId);
      const counts = assetCounts?.byCourse[courseId] ?? { total: 0, complete: 0 };
      const remaining = skipAlreadyRegenerated ? counts.total - counts.complete : counts.total;
      return co
        ? {
            id: courseId,
            label: `${co.course_name} (${co.code})`,
            total: counts.total,
            toProcess: remaining,
          }
        : null;
    }
    return null;
  }, [scope, chapterId, courseId, chapters, courses, assetCounts, skipAlreadyRegenerated]);

  // ── Run handler ────────────────────────────────────────────────
  const fetchAssetsToProcess = async (): Promise<AssetRow[]> => {
    let q = supabase
      .from("teaching_assets")
      .select("id, asset_name, problem_title, source_ref, source_number, ai_generation_status")
      .limit(10000);
    if (scope === "chapter") q = q.eq("chapter_id", chapterId);
    else q = q.eq("course_id", courseId);
    const { data, error } = await q;
    if (error) throw error;
    let rows = (data ?? []) as AssetRow[];
    if (skipAlreadyRegenerated) {
      rows = rows.filter((r) => r.ai_generation_status !== "complete");
    }
    return rows;
  };

  const buildLabel = (a: AssetRow): string => {
    const parts = [a.source_ref, a.source_number].filter(Boolean).join(" ").trim();
    return parts || a.problem_title || a.asset_name || a.id.slice(0, 8);
  };

  const startRun = async () => {
    setConfirmOpen(false);
    const assets = await fetchAssetsToProcess();
    if (assets.length === 0) {
      toast.info("No assets match the current filters.");
      return;
    }

    const runId = `chapter_${scopeSummary?.id ?? "scope"}_${Date.now()}`;
    setChapterRunId(runId);
    setPhase("running");
    setTotalToProcess(assets.length);
    setProgressIndex(0);
    setSucceeded(0);
    setFailed(0);
    setSkipped(0);
    setTokensTotal(0);
    setLogs([]);
    setStopRequested(false);
    setDryPreviews([]);

    let s = 0, f = 0, sk = 0, tokens = 0;
    const previews: Array<{ label: string; preview: string }> = [];

    for (let i = 0; i < assets.length; i++) {
      if (stopRequested) {
        setLogs((l) => [
          ...l,
          { ts: new Date().toLocaleTimeString(), status: "skip" as const, label: "—", detail: "Stopped by user" },
        ]);
        break;
      }
      const asset = assets[i];
      const label = buildLabel(asset);
      setCurrentLabel(label);
      setProgressIndex(i + 1);

      try {
        const { data, error } = await supabase.functions.invoke("regenerate-solution", {
          body: {
            asset_id: asset.id,
            chapter_run_id: runId,
            dry_run: dryRun,
          },
        });
        if (error) throw new Error(error.message);
        if (data?.success === false) throw new Error(data?.error || "Unknown error");

        s++;
        tokens += data?.tokens_used ?? 0;
        setSucceeded(s);
        setTokensTotal(tokens);
        if (dryRun && previews.length < 3 && data?.generated) {
          previews.push({ label, preview: String(data.generated).slice(0, 600) });
          setDryPreviews([...previews]);
        }
        setLogs((l) => [
          ...l,
          {
            ts: new Date().toLocaleTimeString(),
            status: "ok" as const,
            label,
            detail: `complete (${data?.tokens_used ?? 0} tokens)`,
          },
        ]);
      } catch (err: any) {
        f++;
        setFailed(f);
        setLogs((l) => [
          ...l,
          {
            ts: new Date().toLocaleTimeString(),
            status: "fail" as const,
            label,
            detail: `failed: ${String(err.message ?? err).slice(0, 240)}`,
          },
        ]);
      }

      if (i < assets.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }

    setSkipped(sk);
    setPhase("complete");
  };

  const handleRevertRun = async () => {
    setRevertConfirmOpen(false);
    setReverting(true);
    try {
      const { data, error } = await supabase.functions.invoke("revert-solution", {
        body: { chapter_run_id: chapterRunId },
      });
      if (error) throw error;
      toast.success(`Reverted ${data?.reverted ?? 0} assets.`);
      setPhase("configure");
    } catch (err: any) {
      toast.error(`Revert failed: ${err.message}`);
    } finally {
      setReverting(false);
    }
  };

  const handleViewResults = () => {
    if (scopeSummary) {
      navigate(`/admin/chapter-qa?chapter=${scopeSummary.id}&filter=ai_complete`);
    }
  };

  const handleRunForReal = () => {
    setDryRun(false);
    setPhase("configure");
    setTimeout(() => setConfirmOpen(true), 100);
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => {
        if (next && !isLee) {
          setAccessDeniedOpen(true);
          return;
        }
        setOpen(next);
      }}
    >
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between text-xs">
          <span>🤖 AI Solution Regeneration</span>
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-3 space-y-4">
        {phase === "configure" && (
          <>
            {/* Scope selector */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-foreground">
                Select scope for regeneration:
              </Label>
              <RadioGroup
                value={scope}
                onValueChange={(v) => setScope(v as Scope)}
                className="space-y-2"
              >
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="chapter" id="scope-chapter" className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="scope-chapter" className="cursor-pointer text-sm">By Chapter</Label>
                    {scope === "chapter" && (
                      <Select value={chapterId} onValueChange={setChapterId}>
                        <SelectTrigger className="text-xs h-9">
                          <SelectValue placeholder="Choose a chapter…" />
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                          {groupedChapters.map((cg) => (
                            <div key={cg.id}>
                              <div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">
                                {cg.code}
                              </div>
                              {cg.chapters.map((ch) => {
                                const cnt = assetCounts?.byChapter[ch.id]?.total ?? 0;
                                return (
                                  <SelectItem key={ch.id} value={ch.id}>
                                    Ch {ch.chapter_number} — {ch.chapter_name} ({cg.code}) · {cnt} assets
                                  </SelectItem>
                                );
                              })}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <RadioGroupItem value="course" id="scope-course" className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="scope-course" className="cursor-pointer text-sm">By Course</Label>
                    {scope === "course" && (
                      <Select value={courseId} onValueChange={setCourseId}>
                        <SelectTrigger className="text-xs h-9">
                          <SelectValue placeholder="Choose a course…" />
                        </SelectTrigger>
                        <SelectContent>
                          {courses?.map((c) => {
                            const cnt = assetCounts?.byCourse[c.id]?.total ?? 0;
                            return (
                              <SelectItem key={c.id} value={c.id}>
                                {c.course_name} ({c.code}) · {cnt} total assets
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Summary card */}
            {scopeSummary && (
              <Card className="bg-muted/40 border-border">
                <CardContent className="p-4 space-y-1 text-sm">
                  <p className="font-semibold text-foreground">Ready to regenerate:</p>
                  <p className="text-foreground/90">
                    {scopeSummary.toProcess} assets in {scopeSummary.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Estimated cost: ~${(scopeSummary.toProcess * COST_PER_ASSET_USD).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Estimated time: ~{scopeSummary.toProcess * SECONDS_PER_ASSET} seconds
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Options */}
            <div className="space-y-3 border border-border/60 rounded-md p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Skip assets already regenerated</Label>
                <Switch checked={skipAlreadyRegenerated} onCheckedChange={setSkipAlreadyRegenerated} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Dry run first (preview without saving)</Label>
                <Switch checked={dryRun} onCheckedChange={setDryRun} />
              </div>
            </div>

            {/* Run button */}
            <Button
              className="w-full bg-primary hover:bg-primary/90"
              disabled={!scopeSummary || scopeSummary.toProcess === 0}
              onClick={() => setConfirmOpen(true)}
            >
              {dryRun ? "Run Dry Run →" : "Start Regeneration →"}
            </Button>
          </>
        )}

        {phase === "running" && (
          <div className="space-y-3">
            <Progress
              value={totalToProcess > 0 ? (progressIndex / totalToProcess) * 100 : 0}
              className="h-3"
            />
            <p className="text-sm font-medium text-foreground">
              {progressIndex} of {totalToProcess} complete
            </p>
            <p className="text-xs text-muted-foreground">
              {succeeded} succeeded · {failed} failed · {skipped} skipped
            </p>
            {currentLabel && (
              <p className="text-xs text-muted-foreground">Processing: {currentLabel}</p>
            )}

            <div className="bg-zinc-950 text-zinc-100 rounded-md p-2 max-h-[200px] overflow-y-auto font-mono text-[12px] leading-relaxed">
              {logs.length === 0 ? (
                <p className="text-zinc-500">Waiting…</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i}>
                    [{log.ts}]{" "}
                    {log.status === "ok" && <span className="text-emerald-400">✓</span>}
                    {log.status === "fail" && <span className="text-red-400">✗</span>}
                    {log.status === "skip" && <span className="text-zinc-400">○</span>}
                    {" "}{log.label} — {log.detail}
                  </div>
                ))
              )}
            </div>

            <Button
              variant="outline"
              className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setStopRequested(true)}
              disabled={stopRequested}
            >
              {stopRequested ? "Stopping after current…" : "Stop After Current →"}
            </Button>
          </div>
        )}

        {phase === "complete" && (
          <div className="space-y-4">
            <Card className="border-emerald-500/40 bg-emerald-500/5">
              <CardContent className="p-4 space-y-1 text-sm">
                <p className="font-semibold text-emerald-500">✓ Regeneration complete</p>
                <p className="text-foreground">{succeeded} succeeded</p>
                {failed > 0 && <p className="text-destructive">{failed} failed</p>}
                {failed === 0 && <p className="text-muted-foreground">{failed} failed</p>}
                <p className="text-muted-foreground">{skipped} skipped</p>
                <p className="text-xs text-muted-foreground pt-2">
                  Total tokens used: {tokensTotal.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Estimated cost: ${(tokensTotal * 0.000015).toFixed(4)}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono pt-1">
                  Chapter run ID: {chapterRunId}
                </p>
              </CardContent>
            </Card>

            {dryRun && dryPreviews.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Preview (first 3):</p>
                {dryPreviews.map((p, i) => (
                  <details key={i} className="border border-border rounded-md p-2 text-xs">
                    <summary className="cursor-pointer font-medium">{p.label}</summary>
                    <pre className="mt-2 whitespace-pre-wrap text-muted-foreground">{p.preview}…</pre>
                  </details>
                ))}
                <Button className="w-full" onClick={handleRunForReal}>
                  Looks good — Run for real →
                </Button>
              </div>
            )}

            {!dryRun && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  disabled={reverting}
                  onClick={() => setRevertConfirmOpen(true)}
                >
                  {reverting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
                  Revert Entire Run
                </Button>
                <Button onClick={handleViewResults}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  View Results →
                </Button>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => setPhase("configure")}
            >
              ← Start another run
            </Button>
          </div>
        )}
      </CollapsibleContent>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dryRun ? "Preview regeneration?" : "Regenerate solutions?"}</DialogTitle>
            <DialogDescription className="pt-2">
              {dryRun ? (
                <>
                  Preview regeneration for <strong>{scopeSummary?.toProcess}</strong> assets in{" "}
                  <strong>{scopeSummary?.label}</strong>?
                  <br />No changes will be saved.
                </>
              ) : (
                <>
                  Regenerate solutions for <strong>{scopeSummary?.toProcess}</strong> assets in{" "}
                  <strong>{scopeSummary?.label}</strong>?
                  <br />Current solutions will be overwritten but can be reverted.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={startRun}>
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              {dryRun ? "Confirm Preview" : "Confirm & Start"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revert confirm dialog */}
      <Dialog open={revertConfirmOpen} onOpenChange={setRevertConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revert entire run?</DialogTitle>
            <DialogDescription className="pt-2">
              Revert all <strong>{succeeded}</strong> regenerated solutions back to originals?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevertConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevertRun}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Revert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Access denied dialog */}
      <Dialog open={accessDeniedOpen} onOpenChange={setAccessDeniedOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" /> Access Restricted
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Message Lee on Slack if you'd like access.
          </p>
          <DialogFooter>
            <Button onClick={() => setAccessDeniedOpen(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}
