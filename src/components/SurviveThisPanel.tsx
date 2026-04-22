import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Zap, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

interface SurviveThisPanelProps {
  assetId: string;
  promptType?: "problem" | "instructions" | "journal_entry";
  studentEmail?: string | null;
}

interface PriorityConfig {
  is_active: boolean;
  price_cents: number;
  cutoff_time: string;
}

interface VideoRequestRow {
  id: string;
  question: string;
  upvote_count: number;
  status: string;
  created_at: string;
}

function formatCutoff(t: string | undefined): string {
  if (!t) return "today";
  const [hh, mm] = t.split(":");
  const d = new Date();
  d.setHours(Number(hh), Number(mm), 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function isBeforeCutoff(t: string | undefined): boolean {
  if (!t) return true;
  const [hh, mm] = t.split(":").map(Number);
  const now = new Date();
  const cutoff = new Date();
  cutoff.setHours(hh, mm, 0, 0);
  return now < cutoff;
}

export function SurviveThisPanel({ assetId, promptType = "problem", studentEmail }: SurviveThisPanelProps) {
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<VideoRequestRow[]>([]);
  const [config, setConfig] = useState<PriorityConfig | null>(null);
  const [submittingPriority, setSubmittingPriority] = useState(false);
  const [isAccountingMajor, setIsAccountingMajor] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: cfg } = await (supabase as any)
        .from("priority_queue_config")
        .select("is_active, price_cents, cutoff_time")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && cfg) setConfig(cfg as PriorityConfig);

      const { data: vr } = await (supabase as any)
        .from("video_requests")
        .select("id, question, upvote_count, status, created_at")
        .eq("asset_id", assetId)
        .order("upvote_count", { ascending: false })
        .limit(10);
      if (!cancelled && vr) setRequests(vr as VideoRequestRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  const submitQuestion = async (priority: boolean) => {
    if (!question.trim()) return;
    if (priority) setSubmittingPriority(true);
    else setSubmitting(true);

    try {
      const payload = {
        asset_id: assetId,
        student_email: studentEmail ?? null,
        question: question.trim(),
        prompt_type: promptType,
        is_accounting_major: isAccountingMajor,
        is_priority: priority,
        priority_paid_at: priority ? new Date().toISOString() : null,
      };

      const { data, error } = await (supabase as any)
        .from("video_requests")
        .insert(payload)
        .select("id, question, upvote_count, status, created_at")
        .single();

      if (error) throw error;

      setQuestion("");
      setRequests((prev) => [data as VideoRequestRow, ...prev]);

      if (priority) {
        toast.success("⚡ Priority submitted! Lee will answer today.");
      } else {
        toast.success("Question submitted — others can upvote it now.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not submit. Try again.");
    } finally {
      setSubmitting(false);
      setSubmittingPriority(false);
    }
  };

  const upvote = async (id: string) => {
    try {
      await (supabase as any).from("video_request_upvotes").insert({
        video_request_id: id,
        student_email: studentEmail ?? null,
      });
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, upvote_count: r.upvote_count + 1 } : r)));
    } catch {
      toast.error("Could not upvote.");
    }
  };

  const showPriority = !!config?.is_active && isBeforeCutoff(config.cutoff_time);
  const priorityPriceLabel = config ? `$${(config.price_cents / 100).toFixed(0)}` : "$15";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#CE1126]" />
          <h3 className="text-sm font-semibold text-foreground">Ask Lee for a video answer</h3>
        </div>
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What's confusing about this problem?"
          className="min-h-[80px] text-sm"
          disabled={submitting || submittingPriority}
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={isAccountingMajor}
            onChange={(e) => setIsAccountingMajor(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          I'm an accounting major
        </label>
        <Button
          onClick={() => submitQuestion(false)}
          disabled={!question.trim() || submitting || submittingPriority}
          className="w-full bg-[#14213D] hover:bg-[#0f1830] text-white h-10"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Question"}
        </Button>
      </div>

      {showPriority && (
        <>
          <div className="border-t border-border" />
          <div
            className="rounded-lg p-4 space-y-2"
            style={{
              border: "2px solid #F59E0B",
              background: "#FFFBEB",
            }}
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" style={{ color: "#92400E" }} />
              <span className="text-[14px] font-bold" style={{ color: "#92400E", fontFamily: "Inter, sans-serif" }}>
                Get answered today
              </span>
              <span className="ml-auto inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                {priorityPriceLabel} · Priority
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground">
              Lee is available right now. Submit your question and get a video answer today.
            </p>
            <p className="text-[12px]" style={{ color: "#92400E" }}>
              Submit by {formatCutoff(config?.cutoff_time)} today
            </p>
            <Button
              onClick={() => submitQuestion(true)}
              disabled={!question.trim() || submittingPriority || submitting}
              className="w-full bg-[#CE1126] hover:bg-[#a50e1f] text-white h-10"
            >
              {submittingPriority ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>⚡ Submit Priority Question — {priorityPriceLabel}</>
              )}
            </Button>
          </div>
        </>
      )}

      {requests.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Other students asked
          </div>
          {requests.map((r) => (
            <div key={r.id} className="flex items-start gap-2 rounded-md border border-border bg-card p-3">
              <button
                onClick={() => upvote(r.id)}
                className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-[#CE1126] transition-colors shrink-0"
                aria-label="Upvote"
              >
                <ThumbsUp className="h-4 w-4" />
                <span className="text-[11px] font-semibold">{r.upvote_count}</span>
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-foreground line-clamp-2">{r.question}</div>
                <div className="text-[11px] text-muted-foreground mt-1 capitalize">{r.status}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SurviveThisPanel;
