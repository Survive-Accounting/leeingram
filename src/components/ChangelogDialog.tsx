import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface ChangeEntry {
  prompt: number;
  date: string;
  title: string;
  subTasks: string[];
}

const CHANGELOG: ChangeEntry[] = [
  {
    prompt: 1,
    date: "2026-02-17",
    title: "Initial project setup & Survive Accounting domain",
    subTasks: ["Created course/chapter/lesson data model", "Built Content Factory page", "Added lesson creation & detail pages", "Set up authentication & protected routes"],
  },
  {
    prompt: 2,
    date: "2026-02-17",
    title: "Focus Sprint timer & domain selector",
    subTasks: ["Built Focus Sprint with Pomodoro timer", "Created domain selector (Work/Play)", "Added music library", "Implemented sprint activity logging"],
  },
  {
    prompt: 3,
    date: "2026-02-17",
    title: "Email Factory & Marketing hub",
    subTasks: ["Created Email Factory with AI refinement", "Built Marketing landing page", "Added email style guide preferences", "Implemented email series support"],
  },
  {
    prompt: 4,
    date: "2026-02-18",
    title: "Ideas Roadmap (Trello board)",
    subTasks: ["Built Trello-style board with Planned/In Progress/Completed", "Added drag-and-drop with @dnd-kit", "Created Visions section with revenue calculator", "Added domain filtering & seed ideas"],
  },
  {
    prompt: 5,
    date: "2026-02-18",
    title: "Card readability & cross-column drag",
    subTasks: ["Simplified roadmap cards", "Enabled cross-column drag-and-drop", "Added semester grouping in Planned column", "Created vision revenue calculator with tooltip"],
  },
  {
    prompt: 6,
    date: "2026-02-18",
    title: "Family domain, Ideas rename, branding",
    subTasks: ["Added Family section with Me/McKenzie/Baby/Us tabs", "Renamed Feature Roadmap → Ideas Roadmap", "Added domain column to roadmap_items", "Updated branding to Earned Wisdom, LLC"],
  },
  {
    prompt: 7,
    date: "2026-02-18",
    title: "Content Roadmap, completion celebrations, changelog",
    subTasks: [
      "Removed subtitles from IDEAS and FAMILY buttons",
      "Added card spacing for easier drag-drop targeting",
      "Built completion confirmation with confetti celebration",
      "Created Content Roadmap with auto-populated lessons",
      "Added domain-filtered Ideas Roadmap navigation",
      "Fixed Focus Sprint missing navigation bar",
      "Created changelog dialog on Lovable Prompts link",
    ],
  },
  {
    prompt: 8,
    date: "2026-02-18",
    title: "Auto-tally prompts & move music to Focus Sprint",
    subTasks: [
      "Made Lovable Prompts count auto-tally from changelog entries",
      "Moved Choose Your Music from /domains to Focus Sprint",
    ],
  },
  {
    prompt: 9,
    date: "2026-02-18",
    title: "Email Factory overhaul, Focus Sprint blink, Content Roadmap button",
    subTasks: [
      "Made Focus Sprint the only blinking button on /domains",
      "Added Create Lesson button to Content Roadmap",
      "Rebuilt Email Factory with series-based sidebar",
      "Added Plan/Journal/Refine/Finalize tab toggles",
      "Added semester start/end date with auto-calculated send dates",
      "Removed purpose/giving/hoping/local flavor fields",
      "Increased AI refinement passes to 5",
      "Added Copy HTML button for LearnWorlds pasting",
      "Added AI Suggestions dialog (subject lines, CTAs, schedule date)",
    ],
  },
];

export const PROMPT_COUNT = CHANGELOG.length;

export function ChangelogDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📋 Change Log</DialogTitle>
          <DialogDescription>Lovable Prompts = {CHANGELOG.length} — All changes made to this project</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          {[...CHANGELOG].reverse().map((entry) => (
            <Collapsible key={entry.prompt}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer text-left">
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-foreground flex-1">#{entry.prompt} — {entry.title}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{entry.date}</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="ml-8 space-y-0.5 pb-2">
                  {entry.subTasks.map((task, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{task}</span>
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
