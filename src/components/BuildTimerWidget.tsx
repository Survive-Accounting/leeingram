import { useState, useEffect } from "react";
import { useBuildRun } from "@/hooks/useBuildRun";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Timer, Square, RotateCcw, Play } from "lucide-react";
import { toast } from "sonner";

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function BuildTimerWidget() {
  const { activeRun, isRunning, endRun, startRun } = useBuildRun();
  const [elapsed, setElapsed] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);

  useEffect(() => {
    if (!activeRun || activeRun.status !== "running") {
      setElapsed(0);
      return;
    }
    const startMs = new Date(activeRun.started_at).getTime();
    const tick = () => setElapsed((Date.now() - startMs) / 1000);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeRun?.id, activeRun?.status]);

  if (!activeRun) return null;

  // Running view
  if (isRunning) {
    const avgPerDone = activeRun.terminal_count > 0 ? elapsed / activeRun.terminal_count : 0;
    return (
      <div className="px-3 py-2.5 border-t border-border space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
            <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold">Build Timer</span>
          </div>
          <span className="text-sm font-bold tabular-nums text-foreground">{formatElapsed(elapsed)}</span>
        </div>
        <div className="text-[10px] text-muted-foreground space-y-0.5">
          <div className="flex justify-between">
            <span>Progress</span>
            <span className="text-foreground font-medium">{activeRun.terminal_count} / {activeRun.import_count}</span>
          </div>
          {activeRun.terminal_count > 0 && (
            <div className="flex justify-between">
              <span>Avg per done</span>
              <span className="text-foreground font-medium">{formatElapsed(avgPerDone)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Approved: {activeRun.approved_count} | Needs Fix: {activeRun.needs_fix_count}</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive flex-1" onClick={() => setConfirmEnd(true)}>
            <Square className="h-3 w-3 mr-1" /> End Run
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[10px] text-muted-foreground flex-1" onClick={() => {
            endRun.mutate("abandoned");
            toast.info("Build run abandoned");
          }}>
            <RotateCcw className="h-3 w-3 mr-1" /> Reset
          </Button>
        </div>

        <Dialog open={confirmEnd} onOpenChange={setConfirmEnd}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>End Build Run?</DialogTitle>
              <DialogDescription>This will stop the timer and save results. {activeRun.terminal_count < activeRun.import_count && `${activeRun.import_count - activeRun.terminal_count} source(s) are not yet terminal.`}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setConfirmEnd(false)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={() => {
                endRun.mutate("abandoned");
                setConfirmEnd(false);
                toast.info("Build run ended");
              }}>End Run</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Completed view
  if (activeRun.status === "completed" || activeRun.status === "abandoned") {
    return (
      <div className="px-3 py-2.5 border-t border-border space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Last Run {activeRun.status === "abandoned" ? "(abandoned)" : ""}
            </span>
          </div>
          <span className="text-sm font-bold tabular-nums text-foreground">
            {activeRun.total_seconds ? formatElapsed(activeRun.total_seconds) : "—"}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground space-y-0.5">
          <div className="flex justify-between">
            <span>Imported</span>
            <span className="text-foreground">{activeRun.import_count}</span>
          </div>
          <div className="flex justify-between">
            <span>Approved</span>
            <span className="text-foreground">{activeRun.approved_count}</span>
          </div>
          <div className="flex justify-between">
            <span>Needs Fix</span>
            <span className="text-foreground">{activeRun.needs_fix_count}</span>
          </div>
          {activeRun.avg_seconds_per_terminal != null && (
            <div className="flex justify-between">
              <span>Avg per done</span>
              <span className="text-foreground">{formatElapsed(activeRun.avg_seconds_per_terminal)}</span>
            </div>
          )}
        </div>
        <Button size="sm" variant="ghost" className="h-6 text-[10px] w-full" onClick={() => {
          startRun.mutate();
          toast.success("New build run started");
        }}>
          <Play className="h-3 w-3 mr-1" /> Start New Run
        </Button>
      </div>
    );
  }

  return null;
}

// Start modal shown before first import when no active run
export function StartBuildRunModal({ open, onOpenChange, onStarted }: { open: boolean; onOpenChange: (o: boolean) => void; onStarted: () => void }) {
  const { startRun } = useBuildRun();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Start Chapter Build Timer?</DialogTitle>
          <DialogDescription>
            Start tracking time from your first import until all imported sources are Approved or Needs Fix.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => {
            onOpenChange(false);
            onStarted(); // proceed without timer
          }}>Not now</Button>
          <Button size="sm" onClick={async () => {
            await startRun.mutateAsync();
            onOpenChange(false);
            onStarted();
            toast.success("Build timer started!");
          }} disabled={startRun.isPending}>
            Start Timer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
