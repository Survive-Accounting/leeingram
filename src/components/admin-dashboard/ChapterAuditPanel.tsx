import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, X, Copy, ChevronDown, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

type Finding = {
  category: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  lovable_prompt: string;
};

type AuditReport = {
  chapter: string;
  overall_score: number;
  overall_note: string;
  findings: Finding[];
  quick_wins: string[];
  do_not_change: string[];
};

type ContentInventory = {
  purpose: { exists: boolean; approved: boolean };
  key_terms: { total: number; approved: number; hidden: number };
  memory_items: { total: number; approved: number; hidden: number };
  formulas: { total: number; approved: number; hidden: number };
  mistakes: { total: number; approved: number; hidden: number };
  je_assets: number;
};

type AuditState = "idle" | "loading" | "done" | "error";

export function ChapterAuditPanel({
  chapterId,
  chapterName,
  onDismiss,
}: {
  chapterId: string;
  chapterName: string;
  onDismiss: () => void;
}) {
  const [state, setState] = useState<AuditState>("idle");
  const [report, setReport] = useState<AuditReport | null>(null);
  const [inventory, setInventory] = useState<ContentInventory | null>(null);
  const [costUsd, setCostUsd] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const runAudit = useCallback(async () => {
    setState("loading");
    setErrorMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("audit-chapter-content", {
        body: { chapter_id: chapterId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setReport(data.report);
      setInventory(data.inventory || null);
      setCostUsd(data.cost_usd || null);
      setState("done");
    } catch (err: any) {
      setErrorMsg(err.message || "Unknown error");
      setState("error");
    }
  }, [chapterId]);

  // Auto-run on mount
  useEffect(() => {
    runAudit();
  }, [runAudit]);

  const severityColor: Record<string, string> = {
    high: "bg-destructive/20 text-destructive border-destructive/30",
    medium: "bg-amber-500/20 text-amber-500 border-amber-500/30",
    low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };

  const categoryColor: Record<string, string> = {
    content_gap: "bg-red-500/15 text-red-400",
    tooltip_quality: "bg-purple-500/15 text-purple-400",
    cram_sequence: "bg-amber-500/15 text-amber-400",
    voice_off: "bg-orange-500/15 text-orange-400",
    missing_memory_item: "bg-pink-500/15 text-pink-400",
    formula_clarity: "bg-cyan-500/15 text-cyan-400",
    mistake_coverage: "bg-emerald-500/15 text-emerald-400",
  };

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    toast.success("Prompt copied — paste into Lovable");
  };

  if (state === "loading") {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Opus is reviewing {chapterName}...</p>
            <p className="text-xs text-muted-foreground">This takes about 15 seconds</p>
          </div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (state === "error") {
    return (
      <Card className="bg-card border-destructive/30">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">Audit failed</p>
            <p className="text-xs text-muted-foreground">{errorMsg}</p>
          </div>
          <Button variant="outline" size="sm" onClick={runAudit}>Try Again</Button>
          <Button variant="ghost" size="sm" onClick={onDismiss}><X className="h-4 w-4" /></Button>
        </CardContent>
      </Card>
    );
  }

  if (state !== "done" || !report) return null;

  // Group findings by severity
  const highFindings = report.findings.filter(f => f.severity === "high");
  const mediumFindings = report.findings.filter(f => f.severity === "medium");
  const lowFindings = report.findings.filter(f => f.severity === "low");
  const groupedFindings = [...highFindings, ...mediumFindings, ...lowFindings];

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold" style={{ color: "#14213D" }}>{report.overall_score}</p>
              <p className="text-xs text-muted-foreground font-medium">/10</p>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{report.chapter}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{report.overall_note}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onDismiss}><X className="h-4 w-4" /></Button>
        </div>

        {/* Findings */}
        {groupedFindings.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">Findings ({groupedFindings.length})</p>
            {groupedFindings.map((f, i) => (
              <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-[9px] ${severityColor[f.severity]}`}>{f.severity}</Badge>
                  <Badge className={`text-[9px] ${categoryColor[f.category] || "bg-muted text-muted-foreground"}`}>
                    {f.category.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-xs font-bold text-foreground">{f.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">{f.detail}</p>

                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline">
                    <ChevronDown className="h-3 w-3" /> Lovable Prompt →
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="bg-muted/50 rounded p-3 text-xs font-mono whitespace-pre-wrap break-words text-foreground border border-border">
                      {f.lovable_prompt}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 text-xs"
                      onClick={() => copyPrompt(f.lovable_prompt)}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copy Prompt
                    </Button>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ))}
          </div>
        )}

        {/* Quick Wins */}
        {report.quick_wins?.length > 0 && (
          <div className="rounded-lg p-4 space-y-2" style={{ backgroundColor: "rgba(20,33,61,0.08)" }}>
            <p className="text-xs font-bold text-foreground">⚡ Quick Wins — do these first</p>
            <ul className="space-y-1">
              {report.quick_wins.map((w, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Do Not Change */}
        {report.do_not_change?.length > 0 && (
          <div className="rounded-lg p-4 space-y-2 bg-emerald-500/10">
            <p className="text-xs font-bold text-emerald-600">Leave these alone ✓</p>
            <ul className="space-y-1">
              {report.do_not_change.map((d, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Info className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Cost line */}
        {costUsd !== null && (
          <p className="text-[10px] text-muted-foreground text-right">
            This audit cost approximately ${costUsd.toFixed(4)} · logged to QA Costs
          </p>
        )}
      </CardContent>
    </Card>
  );
}
