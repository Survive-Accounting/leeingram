import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Star, Pause, Bug, SkipForward, Undo2, StickyNote,
  ChevronRight, Zap, CheckCircle2,
} from "lucide-react";
import type { JournalEntryGroup } from "@/lib/journalEntryParser";
import { JournalEntryTable } from "@/components/JournalEntryTable";

/* ── Output pill (production stream status) ── */
const OUTPUT_FIELDS = [
  { key: "whiteboard_status", label: "WB" },
  { key: "video_production_status", label: "Vid" },
  { key: "mc_status", label: "MC" },
  { key: "ebook_status", label: "EB" },
  { key: "qa_status", label: "QA" },
  { key: "deployment_status", label: "Dep" },
] as const;

function OutputDot({ status, label }: { status: string; label: string }) {
  const colors: Record<string, string> = {
    not_started: "bg-muted-foreground/40",
    in_progress: "bg-blue-400",
    complete: "bg-emerald-400",
  };
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      {status === "complete"
        ? <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
        : <span className={`h-1.5 w-1.5 rounded-full ${colors[status] || colors.not_started}`} />}
      {label}
    </span>
  );
}

/* ── Props ── */
interface Phase2SpeedReviewPanelProps {
  asset: any;
  assetIndex: number;
  totalAssets: number;
  isPending: boolean;
  undoCount: number;
  noteOpen: boolean;
  noteText: string;
  onNoteOpenChange: (open: boolean) => void;
  onNoteTextChange: (text: string) => void;
  onNoteSave: () => void;
  noteSaving: boolean;
  onAction: (status: string, rank?: number | null) => void;
  onUndo: () => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}

export function Phase2SpeedReviewPanel({
  asset,
  assetIndex,
  totalAssets,
  isPending,
  undoCount,
  noteOpen,
  noteText,
  onNoteOpenChange,
  onNoteTextChange,
  onNoteSave,
  noteSaving,
  onAction,
  onUndo,
  onPrev,
  onNext,
  canPrev,
  canNext,
}: Phase2SpeedReviewPanelProps) {
  const [showProblem, setShowProblem] = useState(true);
  const [showJE, setShowJE] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const hasJE = !!asset.journal_entry_completed_json;
  const hasSolution = !!asset.survive_solution_text;
  const hasContext = !!asset.problem_context;
  const hasNotes = Array.isArray(asset.admin_notes) && asset.admin_notes.length > 0;

  return (
    <div className="space-y-3">
      {/* ── Metadata Bar ── */}
      <div className="flex items-center gap-2 flex-wrap px-3 py-2 rounded-md border border-border bg-muted/10">
        <Badge variant="outline" className="text-[10px] font-mono font-bold">
          {assetIndex + 1}/{totalAssets}
        </Badge>
        <span className="text-xs font-bold text-foreground font-mono">{asset.asset_name}</span>
        {asset.source_ref && (
          <Badge variant="secondary" className="text-[10px]">{asset.source_ref}</Badge>
        )}
        {asset.problem_type && (
          <Badge variant="outline" className="text-[10px]">{asset.problem_type}</Badge>
        )}
        {asset.difficulty && (
          <Badge variant="outline" className="text-[10px] capitalize">{asset.difficulty}</Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          {OUTPUT_FIELDS.map(f => (
            <OutputDot key={f.key} status={(asset as any)[f.key] || "not_started"} label={f.label} />
          ))}
          <div className="w-px h-4 bg-border mx-1" />
          <Zap className="h-3 w-3 text-primary" />
          <span className="text-[9px] text-muted-foreground font-medium">Speed Review</span>
        </div>
      </div>

      {/* ── Collapsible Sections ── */}
      <div className="space-y-0 rounded-lg border border-border bg-background overflow-hidden">

        {/* Problem Text */}
        <CollapsibleSection title="Problem Text" open={showProblem} onOpenChange={setShowProblem}>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {asset.survive_problem_text || "No problem text available."}
          </p>
        </CollapsibleSection>

        {/* Context */}
        {hasContext && (
          <CollapsibleSection title="Problem Context" open={showContext} onOpenChange={setShowContext} borderBottom>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{asset.problem_context}</p>
          </CollapsibleSection>
        )}

        {/* Journal Entries */}
        {hasJE && (
          <CollapsibleSection title="Journal Entries" open={showJE} onOpenChange={setShowJE} borderBottom>
            <JournalEntryTable completedJson={asset.journal_entry_completed_json as unknown as JournalEntryGroup[] | null} />
          </CollapsibleSection>
        )}

        {/* Solution / Answer */}
        {hasSolution && (
          <CollapsibleSection title="Answer Summary" open={showSolution} onOpenChange={setShowSolution} borderBottom>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{asset.survive_solution_text}</p>
          </CollapsibleSection>
        )}

        {/* Admin Notes */}
        {hasNotes && (
          <CollapsibleSection title={`Notes (${asset.admin_notes.length})`} open={showNotes} onOpenChange={setShowNotes}>
            <div className="space-y-1">
              {(asset.admin_notes as any[]).map((n: any) => (
                <p key={n.id} className="text-xs text-foreground/70">
                  <span className="text-muted-foreground">{new Date(n.date).toLocaleDateString()}</span> — {n.text}
                </p>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>

      {/* ── Action Bar ── */}
      <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg border border-border bg-muted/10">
        {/* Nav */}
        <Button size="sm" variant="ghost" disabled={!canPrev} onClick={onPrev} className="h-8 text-xs">
          ← Prev
        </Button>

        {/* Primary: Core Rank 1 */}
        <Button
          size="lg"
          onClick={() => onAction("core_asset", 1)}
          disabled={isPending}
          className="h-11 px-6 text-sm font-semibold shadow-sm shadow-primary/20"
        >
          <Star className="h-4 w-4 mr-1.5" /> Core Rank 1
          <kbd className="ml-2 text-[9px] opacity-60 bg-primary-foreground/15 px-1.5 py-0.5 rounded border border-primary-foreground/30">1</kbd>
        </Button>

        {/* Secondary ranks */}
        <Button size="sm" variant="outline" onClick={() => onAction("core_asset", 2)} disabled={isPending} className="h-8 text-xs">
          R2 <kbd className="ml-1 text-[9px] opacity-60">2</kbd>
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAction("core_asset", 3)} disabled={isPending} className="h-8 text-xs">
          R3 <kbd className="ml-1 text-[9px] opacity-60">3</kbd>
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Hold */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => onAction("hold")}
          disabled={isPending}
          className="h-8 text-xs text-amber-500 hover:text-amber-400 border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/5"
        >
          <Pause className="h-3.5 w-3.5 mr-1" /> Hold
          <kbd className="ml-1 text-[9px] opacity-60">H</kbd>
        </Button>

        {/* Debug */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => onAction("needs_debugging")}
          disabled={isPending}
          className="h-8 text-xs text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/50 hover:bg-destructive/5"
        >
          <Bug className="h-3.5 w-3.5 mr-1" /> Debug
          <kbd className="ml-1 text-[9px] opacity-60">D</kbd>
        </Button>

        {/* Skip */}
        <button onClick={() => onAction("skip")} disabled={isPending} className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors ml-1">
          Skip <kbd className="ml-1 text-[9px] opacity-60">(S)</kbd>
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Undo */}
        <Button size="sm" variant="outline" disabled={undoCount === 0 || isPending} onClick={onUndo} className="h-8 text-xs">
          <Undo2 className="h-3.5 w-3.5 mr-1" /> Undo
          <kbd className="ml-1 text-[9px] opacity-60">Z</kbd>
        </Button>

        {/* Note */}
        <Button size="sm" variant="outline" onClick={() => onNoteOpenChange(!noteOpen)} className="h-8 text-xs ml-auto">
          <StickyNote className="h-3.5 w-3.5 mr-1" /> Note
        </Button>

        {/* Next */}
        <Button size="sm" variant="ghost" disabled={!canNext} onClick={onNext} className="h-8 text-xs">
          Next →
        </Button>
      </div>

      {/* ── Inline Note ── */}
      <div className={cn("overflow-hidden transition-all duration-200", noteOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0")}>
        <div className="flex items-start gap-2 p-3 rounded-lg border border-border bg-card">
          <Textarea
            autoFocus={noteOpen}
            value={noteText}
            onChange={e => onNoteTextChange(e.target.value)}
            placeholder="Add an admin note…"
            className="text-sm min-h-[56px] flex-1"
          />
          <Button size="sm" disabled={!noteText.trim() || noteSaving} onClick={onNoteSave}>Save</Button>
        </div>
      </div>
    </div>
  );
}

/* ── Reusable collapsible section ── */
function CollapsibleSection({
  title, open, onOpenChange, children, borderBottom = true,
}: {
  title: string; open: boolean; onOpenChange: (v: boolean) => void; children: React.ReactNode; borderBottom?: boolean;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className={cn(
        "flex items-center gap-2 w-full py-2 px-3 cursor-pointer hover:bg-accent/30 transition-colors",
        borderBottom && "border-b border-border"
      )}>
        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")} />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pt-3 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
