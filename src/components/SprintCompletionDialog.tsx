import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSprint } from "@/contexts/SprintContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Target } from "lucide-react";

interface SprintCompletionDialogProps {
  open: boolean;
  timerExpired: boolean;
  onClose: () => void;
}

export function SprintCompletionDialog({ open, timerExpired, onClose }: SprintCompletionDialogProps) {
  const { user } = useAuth();
  const { sprintState, clearSprintState } = useSprint();
  const navigate = useNavigate();
  const [notes, setNotes] = useState("");
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && sprintState?.sessionId) {
      supabase
        .from("sprint_activity_log")
        .select("*")
        .eq("session_id", sprintState.sessionId)
        .order("created_at", { ascending: true })
        .then(({ data }) => setActivityLog(data || []));
    }
  }, [open, sprintState?.sessionId]);

  if (!sprintState) return null;

  const startedAt = new Date(sprintState.startedAt);
  const elapsedMinutes = Math.round((Date.now() - startedAt.getTime()) / 60000);

  const handleSubmit = async () => {
    if (!notes.trim()) {
      toast.error("Write a brief note about what you accomplished.");
      return;
    }
    setSubmitting(true);
    await supabase.from("focus_sessions").update({
      completed_at: new Date().toISOString(),
      actual_minutes: elapsedMinutes,
      duration_minutes: sprintState.totalDuration,
      notes,
    }).eq("id", sprintState.sessionId);
    toast.success("Sprint logged! Great work.");
    clearSprintState();
    setNotes("");
    setActivityLog([]);
    setSubmitting(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="border-0 p-0 max-w-md w-full overflow-hidden [&>button]:hidden"
        style={{
          background: "rgba(10,10,18,0.96)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(218,165,32,0.25)",
          borderRadius: "16px",
          boxShadow: "0 0 60px rgba(0,0,0,0.8), 0 0 30px rgba(218,165,32,0.06)",
        }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
              style={{
                background: "linear-gradient(135deg, rgba(218,165,32,0.2), rgba(184,134,11,0.08))",
                border: "1px solid rgba(218,165,32,0.4)",
                boxShadow: "0 0 20px rgba(218,165,32,0.15)",
              }}
            >
              <Target className="w-7 h-7" style={{ color: "rgba(218,165,32,0.9)" }} />
            </div>
            <h2
              className="text-xl font-bold tracking-wide"
              style={{
                color: "rgba(218,165,32,0.95)",
                textShadow: "0 0 20px rgba(218,165,32,0.3)",
              }}
            >
              {timerExpired ? "Time's Up!" : "Sprint Complete"}
            </h2>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              Log what you accomplished before continuing.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-2xl font-bold" style={{ color: "rgba(218,165,32,0.9)" }}>{elapsedMinutes}m</p>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Time Spent</p>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-2xl font-bold" style={{ color: "rgba(218,165,32,0.9)" }}>{activityLog.length}</p>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Actions</p>
            </div>
          </div>

          {/* Intention reminder */}
          <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Your Intention</p>
            <p className="text-sm italic" style={{ color: "rgba(255,255,255,0.6)" }}>"{sprintState.intention}"</p>
          </div>

          {/* Notes — required */}
          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
              What did you accomplish? <span style={{ color: "rgba(218,165,32,0.7)" }}>*</span>
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Describe what you got done..."
              className="resize-none bg-white/5 border-white/10 text-white placeholder:text-white/20"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !notes.trim()}
            className="w-full rounded-full px-6 py-3.5 text-sm font-bold text-black transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
            style={{
              background: notes.trim() ? "rgba(218,165,32,0.92)" : "rgba(218,165,32,0.3)",
              boxShadow: notes.trim() ? "0 4px 24px rgba(218,165,32,0.4), 0 0 40px rgba(218,165,32,0.15)" : "none",
            }}
          >
            {submitting ? "Saving..." : "Save Sprint Report"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
