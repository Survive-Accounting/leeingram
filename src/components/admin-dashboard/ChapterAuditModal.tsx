import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Check, Loader2, RefreshCw, Copy } from "lucide-react";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────

type FindingType = "content" | "ui";

type Finding = {
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  fixType: FindingType;
};

type TabKey = "purpose" | "key_terms" | "accounts" | "memory" | "jes" | "mistakes";

type TabState = {
  status: "idle" | "loading" | "done" | "error";
  findings: Finding[];
  accepted: Record<number, boolean>;
  notes: string;
  overall: string;
  errorMsg: string;
};

const TAB_CONFIG: { key: TabKey; label: string }[] = [
  { key: "purpose", label: "Purpose" },
  { key: "key_terms", label: "Key Terms" },
  { key: "accounts", label: "Accounts" },
  { key: "memory", label: "Memory" },
  { key: "jes", label: "JEs" },
  { key: "mistakes", label: "Mistakes" },
];

function makeEmptyTab(): TabState {
  return { status: "idle", findings: [], accepted: {}, notes: "", overall: "", errorMsg: "" };
}

function makeInitialTabs(): Record<TabKey, TabState> {
  const tabs = {} as Record<TabKey, TabState>;
  TAB_CONFIG.forEach(({ key }) => { tabs[key] = makeEmptyTab(); });
  return tabs;
}

// ── Severity helpers ─────────────────────────────────────────────

const SEV_COLORS: Record<string, string> = {
  high: "bg-destructive/20 text-destructive border-destructive/30",
  medium: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

function countBySeverity(findings: Finding[]) {
  let high = 0, medium = 0, low = 0;
  findings.forEach((f) => {
    if (f.severity === "high") high++;
    else if (f.severity === "medium") medium++;
    else low++;
  });
  return { high, medium, low, total: findings.length };
}

// ── Tab badge ────────────────────────────────────────────────────

function TabBadge({ tab }: { tab: TabState }) {
  if (tab.status === "loading" || tab.status === "idle") {
    return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1.5" />;
  }
  if (tab.status === "error") {
    return <X className="h-3 w-3 text-destructive ml-1.5" />;
  }
  const { high, medium, total } = countBySeverity(tab.findings);
  if (total === 0) {
    return <Check className="h-3 w-3 text-emerald-500 ml-1.5" />;
  }
  if (high > 0) {
    return (
      <Badge className="ml-1.5 h-4 min-w-[18px] px-1 text-[10px] bg-destructive/20 text-destructive border-destructive/30">
        {total}
      </Badge>
    );
  }
  return (
    <Badge className="ml-1.5 h-4 min-w-[18px] px-1 text-[10px] bg-amber-500/20 text-amber-500 border-amber-500/30">
      {total}
    </Badge>
  );
}

// ── Finding card ─────────────────────────────────────────────────

function FindingCard({
  finding,
  isAccepted,
  onToggle,
}: {
  finding: Finding;
  isAccepted: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`rounded-lg border p-4 space-y-2 transition-colors ${isAccepted ? "border-border bg-card" : "border-border/50 bg-muted/30 opacity-60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <Badge className={`text-[10px] shrink-0 mt-0.5 ${SEV_COLORS[finding.severity]}`}>
            {finding.severity}
          </Badge>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-foreground leading-tight">{finding.title}</p>
            <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{finding.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isAccepted ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-muted-foreground/30 text-muted-foreground hover:text-destructive"
              onClick={onToggle}
            >
              <X className="h-3 w-3 mr-1" /> Dismiss
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
              onClick={onToggle}
            >
              <Check className="h-3 w-3 mr-1" /> Accept
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab content ──────────────────────────────────────────────────

function TabPanel({
  tab,
  tabLabel,
  chapterLabel,
  courseCode,
  onToggleFinding,
  notes,
  onNotesChange,
  onRetry,
}: {
  tab: TabState;
  tabLabel: string;
  chapterLabel: string;
  courseCode: string;
  onToggleFinding: (idx: number) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  onRetry: () => void;
}) {
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [copied, setCopied] = useState(false);

  if (tab.status === "loading" || tab.status === "idle") {
    return (
      <div className="space-y-3 py-2">
        <Skeleton className="h-4 w-48" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (tab.status === "error") {
    return (
      <div className="py-4 space-y-3">
        <p className="text-sm text-destructive font-medium">Audit failed</p>
        <p className="text-xs text-muted-foreground">{tab.errorMsg}</p>
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
          <RefreshCw className="h-3 w-3" /> Retry
        </Button>
      </div>
    );
  }

  const { high, medium, low, total } = countBySeverity(tab.findings);
  const acceptedCount = Object.values(tab.accepted).filter(Boolean).length;

  const acceptedFindings = tab.findings.filter((_, i) => tab.accepted[i]);

  const generatePrompt = async () => {
    setGenerating(true);
    setGenError("");
    try {
      const findingsList = acceptedFindings
        .map((f, i) => `${i + 1}. [${f.severity}] ${f.title}\n   ${f.description}`)
        .join("\n");

      const { data, error } = await supabase.functions.invoke("generate-audit-prompt", {
        body: {
          chapter_name: chapterLabel,
          course_code: courseCode,
          tab_name: tabLabel,
          findings: findingsList,
          admin_notes: notes.trim() || "None",
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setGeneratedPrompt(data.prompt || "");
    } catch (err: any) {
      console.error("Generate prompt failed:", err);
      setGenError(err.message || "Unknown error");
    } finally {
      setGenerating(false);
    }
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    toast.success("Prompt copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 py-2">
      {/* Summary line */}
      {total === 0 ? (
        <p className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
          <Check className="h-4 w-4" /> Content looks strong
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{total} findings</span>
          {high > 0 && <> · <span className="text-destructive font-medium">{high} high</span></>}
          {medium > 0 && <> · <span className="text-amber-500 font-medium">{medium} medium</span></>}
          {low > 0 && <> · <span className="text-muted-foreground">{low} low</span></>}
        </p>
      )}

      {/* Finding cards */}
      {tab.findings.map((f, i) => (
        <FindingCard
          key={i}
          finding={f}
          isAccepted={!!tab.accepted[i]}
          onToggle={() => onToggleFinding(i)}
        />
      ))}

      {/* Notes + generate button */}
      {total > 0 && (
        <div className="space-y-3 pt-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Your notes</p>
            <Textarea
              rows={4}
              placeholder="Any overrides or additions? Accepted findings above will be included automatically."
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
            />
          </div>
          <Button
            className="w-full text-sm font-semibold text-white"
            style={{ backgroundColor: "#14213D" }}
            disabled={acceptedCount === 0 || generating}
            onClick={generatePrompt}
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</>
            ) : (
              "Generate Lovable Prompt →"
            )}
          </Button>

          {genError && (
            <p className="text-xs text-destructive">Generation failed — try again</p>
          )}

          {/* Generated prompt display */}
          {generating && !generatedPrompt && (
            <Skeleton className="h-40 w-full rounded-lg" />
          )}

          {generatedPrompt && (
            <div className="space-y-2">
              <div className="relative rounded-lg overflow-hidden" style={{ backgroundColor: "#14213D" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-7 text-[11px] text-white/70 hover:text-white hover:bg-white/10 z-10"
                  onClick={copyPrompt}
                >
                  {copied ? (
                    <><Check className="h-3 w-3 mr-1" /> Copied ✓</>
                  ) : (
                    <><Copy className="h-3 w-3 mr-1" /> Copy →</>
                  )}
                </Button>
                <pre
                  className="text-[13px] font-mono text-white whitespace-pre-wrap break-words p-4 pr-24 max-h-[300px] overflow-y-auto"
                >
                  {generatedPrompt}
                </pre>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={generatePrompt}
                disabled={generating}
              >
                <RefreshCw className="h-3 w-3" /> Regenerate
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────

export function ChapterAuditModal({
  open,
  onClose,
  chapterNumber,
  chapterName,
  chapterId,
  courseCode,
}: {
  open: boolean;
  onClose: () => void;
  chapterNumber: number;
  chapterName: string;
  chapterId: string;
  courseCode: string;
}) {
  const [tabs, setTabs] = useState<Record<TabKey, TabState>>(makeInitialTabs);
  const [activeTab, setActiveTab] = useState<TabKey>("purpose");
  const hasStartedRef = useRef(false);

  const auditTab = useCallback(async (tabKey: TabKey) => {
    setTabs((prev) => ({
      ...prev,
      [tabKey]: { ...makeEmptyTab(), status: "loading" },
    }));

    try {
      const { data, error } = await supabase.functions.invoke("audit-chapter-tab", {
        body: {
          chapter_id: chapterId,
          tab: tabKey,
          chapter_name: `Ch ${chapterNumber} — ${chapterName}`,
          course_code: courseCode,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const findings: Finding[] = (data.findings || []).map((f: any) => ({
        severity: f.severity || "low",
        title: f.title || "Untitled",
        description: f.description || "",
      }));

      const accepted: Record<number, boolean> = {};
      findings.forEach((_, i) => { accepted[i] = true; });

      setTabs((prev) => ({
        ...prev,
        [tabKey]: {
          status: "done",
          findings,
          accepted,
          notes: "",
          overall: data.overall || "",
          errorMsg: "",
        },
      }));
    } catch (err: any) {
      console.error(`Audit tab ${tabKey} failed:`, err);
      setTabs((prev) => ({
        ...prev,
        [tabKey]: {
          ...makeEmptyTab(),
          status: "error",
          errorMsg: err.message || "Unknown error",
        },
      }));
    }
  }, [chapterId, chapterNumber, chapterName, courseCode]);

  // Fire all 6 audits on open
  useEffect(() => {
    if (open && !hasStartedRef.current) {
      hasStartedRef.current = true;
      const allTabs: TabKey[] = ["purpose", "key_terms", "accounts", "memory", "jes", "mistakes"];
      // Set all to loading, then fire all simultaneously
      setTabs(() => {
        const t = makeInitialTabs();
        allTabs.forEach((k) => { t[k].status = "loading"; });
        return t;
      });
      // Fire all — Promise.allSettled ensures none block others
      Promise.allSettled(allTabs.map((k) => auditTab(k)));
    }
  }, [open, auditTab]);

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      onClose();
      setTabs(makeInitialTabs());
      setActiveTab("purpose");
      hasStartedRef.current = false;
    }
  };

  const toggleFinding = (tabKey: TabKey, idx: number) => {
    setTabs((prev) => ({
      ...prev,
      [tabKey]: {
        ...prev[tabKey],
        accepted: {
          ...prev[tabKey].accepted,
          [idx]: !prev[tabKey].accepted[idx],
        },
      },
    }));
  };

  const setNotes = (tabKey: TabKey, value: string) => {
    setTabs((prev) => ({
      ...prev,
      [tabKey]: { ...prev[tabKey], notes: value },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold text-foreground">
            Chapter Audit — Ch {chapterNumber} — {chapterName}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabKey)}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="px-6 pt-3 pb-0 shrink-0">
            <TabsList className="w-full justify-start">
              {TAB_CONFIG.map(({ key, label }) => (
                <TabsTrigger key={key} value={key} className="flex items-center">
                  {label}
                  <TabBadge tab={tabs[key]} />
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="px-6 pb-6">
              {TAB_CONFIG.map(({ key, label }) => (
                <TabsContent key={key} value={key} className="mt-0">
                  <TabPanel
                    tab={tabs[key]}
                    tabLabel={label}
                    chapterLabel={`Ch ${chapterNumber} — ${chapterName}`}
                    courseCode={courseCode}
                    onToggleFinding={(idx) => toggleFinding(key, idx)}
                    notes={tabs[key].notes}
                    onNotesChange={(v) => setNotes(key, v)}
                    onRetry={() => auditTab(key)}
                  />
                </TabsContent>
              ))}
            </div>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
