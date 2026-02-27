import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, CheckCircle2, ChevronDown, MessageSquareWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { format } from "date-fns";

const NOTE_TYPES = [
  { value: "math_fix", label: "Math Fix" },
  { value: "format_fix", label: "Format Fix" },
  { value: "wording_fix", label: "Wording Fix" },
  { value: "missing_step", label: "Missing Step" },
  { value: "wrong_topic", label: "Wrong Topic" },
  { value: "other", label: "Other" },
];

const TYPE_COLORS: Record<string, string> = {
  math_fix: "bg-destructive/20 text-destructive border-destructive/30",
  format_fix: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  wording_fix: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  missing_step: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  wrong_topic: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  other: "bg-muted text-muted-foreground",
};

interface Props {
  sourceProblemId: string;
  latestPackageId?: string;
}

export function RepairNotesPanel({ sourceProblemId, latestPackageId }: Props) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [noteType, setNoteType] = useState("other");
  const [whatWrong, setWhatWrong] = useState("");
  const [desiredFix, setDesiredFix] = useState("");
  const [doNotChange, setDoNotChange] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  const { data: notes, isLoading } = useQuery({
    queryKey: ["repair-notes", sourceProblemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repair_notes")
        .select("*")
        .eq("source_problem_id", sourceProblemId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!sourceProblemId,
  });

  const openNotes = notes?.filter((n) => n.status === "open") ?? [];
  const resolvedNotes = notes?.filter((n) => n.status === "resolved") ?? [];

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!whatWrong.trim()) throw new Error("Describe what was wrong");
      if (!latestPackageId) throw new Error("No answer package to attach note to");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("repair_notes").insert({
        source_problem_id: sourceProblemId,
        answer_package_id: latestPackageId,
        created_by: user?.id ?? null,
        note_type: noteType as any,
        what_was_wrong: whatWrong,
        desired_fix: desiredFix,
        do_not_change: doNotChange || null,
      } as any);
      if (error) throw error;
      await logActivity({
        actor_type: "user",
        entity_type: "source_problem",
        entity_id: sourceProblemId,
        event_type: "REPAIR_NOTE_CREATED",
        payload_json: { note_type: noteType, what_was_wrong: whatWrong, package_id: latestPackageId },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repair-notes"] });
      setAddOpen(false);
      setWhatWrong("");
      setDesiredFix("");
      setDoNotChange("");
      setNoteType("other");
      toast.success("Repair note added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolveMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from("repair_notes").update({
        status: "resolved" as any,
        resolved_at: new Date().toISOString(),
      } as any).eq("id", noteId);
      if (error) throw error;
      await logActivity({
        actor_type: "user",
        entity_type: "source_problem",
        entity_id: sourceProblemId,
        event_type: "REPAIR_NOTE_RESOLVED",
        payload_json: { note_id: noteId },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repair-notes"] });
      toast.success("Note resolved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold flex items-center gap-1">
          <MessageSquareWarning className="h-3.5 w-3.5 text-amber-400" />
          Repair Notes {openNotes.length > 0 && <Badge variant="outline" className="text-[9px] ml-1 bg-amber-500/20 text-amber-400">{openNotes.length} open</Badge>}
        </h3>
        <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setAddOpen(true)} disabled={!latestPackageId}>
          <Plus className="h-3 w-3 mr-1" /> Add Repair Note
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : openNotes.length === 0 && resolvedNotes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No repair notes yet.</p>
      ) : (
        <div className="space-y-1.5">
          {openNotes.map((note) => (
            <div key={note.id} className="rounded border border-amber-500/20 bg-amber-500/5 p-2 space-y-1">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className={cn("text-[9px]", TYPE_COLORS[note.note_type])}>{note.note_type.replace("_", " ")}</Badge>
                <span className="text-[10px] text-muted-foreground">{format(new Date(note.created_at), "MMM d HH:mm")}</span>
                <Button variant="ghost" size="sm" className="h-5 text-[9px] ml-auto" onClick={() => resolveMutation.mutate(note.id)}>
                  <CheckCircle2 className="h-3 w-3 mr-0.5" /> Resolve
                </Button>
              </div>
              <p className="text-xs"><span className="font-semibold text-muted-foreground">Wrong:</span> {note.what_was_wrong}</p>
              {note.desired_fix && <p className="text-xs"><span className="font-semibold text-muted-foreground">Fix:</span> {note.desired_fix}</p>}
              {note.do_not_change && <p className="text-xs"><span className="font-semibold text-muted-foreground">Keep:</span> {note.do_not_change}</p>}
            </div>
          ))}

          {resolvedNotes.length > 0 && (
            <Collapsible open={showResolved} onOpenChange={setShowResolved}>
              <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                <ChevronDown className={cn("h-3 w-3 transition-transform", showResolved && "rotate-180")} />
                {resolvedNotes.length} resolved note(s)
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 space-y-1">
                {resolvedNotes.map((note) => (
                  <div key={note.id} className="rounded border border-border bg-muted/20 p-2 opacity-60">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[9px]">{note.note_type.replace("_", " ")}</Badge>
                      <span className="text-[10px] text-muted-foreground">Resolved {note.resolved_at ? format(new Date(note.resolved_at), "MMM d") : ""}</span>
                    </div>
                    <p className="text-xs mt-0.5">{note.what_was_wrong}</p>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}

      {/* Add Repair Note Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Repair Note</DialogTitle>
            <DialogDescription>Describe what's wrong and how to fix it. This will guide regeneration.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Note Type</Label>
              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NOTE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">What was wrong? *</Label>
              <Textarea value={whatWrong} onChange={(e) => setWhatWrong(e.target.value)} placeholder="The interest calculation uses simple interest instead of effective interest method…" className="text-xs min-h-[60px]" />
            </div>
            <div>
              <Label className="text-xs">Desired fix</Label>
              <Textarea value={desiredFix} onChange={(e) => setDesiredFix(e.target.value)} placeholder="Recalculate using effective interest; update JE amounts…" className="text-xs min-h-[50px]" />
            </div>
            <div>
              <Label className="text-xs">Do NOT change (preserve)</Label>
              <Textarea value={doNotChange} onChange={(e) => setDoNotChange(e.target.value)} placeholder="Keep the question wording and JE formatting…" className="text-xs min-h-[40px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !whatWrong.trim()}>
              {createMutation.isPending ? "Saving…" : "Save Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
