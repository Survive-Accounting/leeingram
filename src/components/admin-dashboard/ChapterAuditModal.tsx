import { useState, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Check, Loader2 } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────

type Finding = {
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
};

type TabKey = "purpose" | "key_terms" | "accounts" | "memory" | "jes" | "mistakes";

type TabState = {
  status: "idle" | "loading" | "done";
  findings: Finding[];
  accepted: Record<number, boolean>;
  notes: string;
};

const TAB_CONFIG: { key: TabKey; label: string }[] = [
  { key: "purpose", label: "Purpose" },
  { key: "key_terms", label: "Key Terms" },
  { key: "accounts", label: "Accounts" },
  { key: "memory", label: "Memory" },
  { key: "jes", label: "JEs" },
  { key: "mistakes", label: "Mistakes" },
];

// Mock data for layout testing
const MOCK_FINDINGS: Finding[] = [
  {
    severity: "high",
    title: "Missing pension expense formulas",
    description:
      "Chapter has no formulas for pension expense calculation or funded status. Students need these cold for every pension problem.",
  },
  {
    severity: "medium",
    title: "Explanation voice too textbook-generic",
    description:
      "Current explanations read like a textbook. Need second-person tutor voice throughout.",
  },
];

function makeInitialTabs(): Record<TabKey, TabState> {
  const tabs = {} as Record<TabKey, TabState>;
  TAB_CONFIG.forEach(({ key }) => {
    // Give "purpose" tab mock data so layout is testable
    if (key === "purpose") {
      const accepted: Record<number, boolean> = {};
      MOCK_FINDINGS.forEach((_, i) => { accepted[i] = true; });
      tabs[key] = { status: "done", findings: MOCK_FINDINGS, accepted, notes: "" };
    } else {
      tabs[key] = { status: "idle", findings: [], accepted: {}, notes: "" };
    }
  });
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
  onToggleFinding,
  notes,
  onNotesChange,
}: {
  tab: TabState;
  onToggleFinding: (idx: number) => void;
  notes: string;
  onNotesChange: (v: string) => void;
}) {
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

  const { high, medium, low, total } = countBySeverity(tab.findings);
  const acceptedCount = Object.values(tab.accepted).filter(Boolean).length;

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
            disabled={acceptedCount === 0}
          >
            Generate Lovable Prompt →
          </Button>
          {/* Placeholder for generated prompt — hidden until prompt generated */}
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
}: {
  open: boolean;
  onClose: () => void;
  chapterNumber: number;
  chapterName: string;
  chapterId: string;
}) {
  const [tabs, setTabs] = useState<Record<TabKey, TabState>>(makeInitialTabs);
  const [activeTab, setActiveTab] = useState<TabKey>("purpose");

  // Reset state when modal opens
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      onClose();
      // Reset on close
      setTabs(makeInitialTabs());
      setActiveTab("purpose");
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
              {TAB_CONFIG.map(({ key }) => (
                <TabsContent key={key} value={key} className="mt-0">
                  <TabPanel
                    tab={tabs[key]}
                    onToggleFinding={(idx) => toggleFinding(key, idx)}
                    notes={tabs[key].notes}
                    onNotesChange={(v) => setNotes(key, v)}
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
