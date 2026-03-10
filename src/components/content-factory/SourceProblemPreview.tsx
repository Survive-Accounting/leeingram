import { useState, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActivityLogPanel } from "./ActivityLogPanel";

export interface SourceProblemPreviewData {
  id?: string;
  source_label?: string;
  title?: string;
  problem_type?: string;
  status?: string;
  problem_screenshot_url?: string | null;
  solution_screenshot_url?: string | null;
  problem_screenshot_urls?: string[];
  solution_screenshot_urls?: string[];
  problem_text?: string;
  solution_text?: string;
  chapter_id?: string;
}

interface Props {
  problem: SourceProblemPreviewData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ImageGallery({ urls, label }: { urls: string[]; label: string }) {
  const [current, setCurrent] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  if (urls.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</h3>
        {urls.length > 1 && (
          <span className="text-[10px] text-muted-foreground">
            {current + 1} / {urls.length}
          </span>
        )}
      </div>

      <div className="relative group rounded-lg border border-border bg-card overflow-hidden">
        <img
          src={urls[current]}
          alt={`${label} ${current + 1}`}
          className="w-full object-contain max-h-[60vh] cursor-zoom-in"
          onClick={() => setZoomed(true)}
        />

        <button
          className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => setZoomed(true)}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>

        {urls.length > 1 && (
          <>
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
              onClick={() => setCurrent((c) => c - 1)}
              disabled={current === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
              onClick={() => setCurrent((c) => c + 1)}
              disabled={current === urls.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {urls.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {urls.map((url, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={cn(
                "flex-shrink-0 h-12 w-16 rounded border object-cover overflow-hidden transition-all",
                i === current
                  ? "border-primary ring-1 ring-primary/50"
                  : "border-border opacity-60 hover:opacity-100"
              )}
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {zoomed && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center cursor-zoom-out"
          onClick={() => setZoomed(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-md text-white/70 hover:text-white"
            onClick={() => setZoomed(false)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={urls[current]}
            alt=""
            className="max-w-[95vw] max-h-[95vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {urls.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-md bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"
                onClick={(e) => { e.stopPropagation(); setCurrent((c) => c - 1); }}
                disabled={current === 0}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-md bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"
                onClick={(e) => { e.stopPropagation(); setCurrent((c) => c + 1); }}
                disabled={current === urls.length - 1}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function SourceProblemPreview({ problem, open, onOpenChange }: Props) {
  const [activeTab, setActiveTab] = useState("preview");

  if (!problem) return null;

  const problemUrls = problem.problem_screenshot_urls?.length
    ? problem.problem_screenshot_urls
    : problem.problem_screenshot_url
      ? [problem.problem_screenshot_url]
      : [];

  const solutionUrls = problem.solution_screenshot_urls?.length
    ? problem.solution_screenshot_urls
    : problem.solution_screenshot_url
      ? [problem.solution_screenshot_url]
      : [];

  const hasProblems = problemUrls.length > 0;
  const hasSolutions = solutionUrls.length > 0;
  const hasImages = hasProblems || hasSolutions;
  const bothSides = hasProblems && hasSolutions;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "max-h-[90vh] overflow-y-auto p-0",
        "max-w-5xl"
      )}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border px-5 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            {problem.source_label && (
              <span className="text-sm font-mono font-semibold text-foreground">{problem.source_label}</span>
            )}
            {problem.title && (
              <span className="text-sm text-foreground">{problem.title}</span>
            )}
            {!problem.source_label && !problem.title && (
              <span className="text-sm text-muted-foreground italic">Untitled source problem</span>
            )}
            {problem.problem_type && (
              <Badge variant="outline" className="text-[10px] capitalize">{problem.problem_type}</Badge>
            )}
            {problem.status && (
              <Badge variant="outline" className="text-[10px] capitalize">{problem.status}</Badge>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pb-5">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-3">
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="answer">Answer Package</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="preview">
              {hasImages ? (
                <div className={cn("gap-5", bothSides ? "grid grid-cols-2" : "")}>
                  {hasProblems && <ImageGallery urls={problemUrls} label="Problem Screenshots" />}
                  {hasSolutions && <ImageGallery urls={solutionUrls} label="Solution Screenshots" />}
                </div>
              ) : (
                <div className={cn("gap-5", problem.problem_text && problem.solution_text ? "grid grid-cols-2" : "")}>
                  {problem.problem_text && (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Problem</h3>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{problem.problem_text}</p>
                    </div>
                  )}
                  {problem.solution_text && (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Solution</h3>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{problem.solution_text}</p>
                    </div>
                  )}
                  {!problem.problem_text && !problem.solution_text && (
                    <p className="text-sm text-muted-foreground text-center py-8">No screenshots or text available.</p>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="answer">
              {problem.id ? (
                <AnswerPackagePanel sourceProblemId={problem.id} problemText={problem.problem_text} solutionText={problem.solution_text} chapterId={problem.chapter_id} />
              ) : (
                <p className="text-xs text-muted-foreground">No problem ID available.</p>
              )}
            </TabsContent>

            <TabsContent value="activity">
              {problem.id ? (
                <ActivityLogPanel entityType="source_problem" entityId={problem.id} />
              ) : (
                <p className="text-xs text-muted-foreground">No problem ID available.</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
