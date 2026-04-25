import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, ImageIcon, Sparkles, Wrench, Check, ArrowRight } from "lucide-react";

const HUMANSENT_URL = "https://humansent.com";
// Swap this with the real YouTube embed URL when ready
const DEMO_EMBED_URL = "https://www.youtube.com/embed/dQw4w9WgXcQ";

const FEATURES = [
  { icon: Sparkles, label: "Prompt Builder widget" },
  { icon: Mic, label: "Voice-to-prompt workflow" },
  { icon: ImageIcon, label: "Screenshot support" },
  { icon: Wrench, label: "Clean Lovable prompts" },
  { icon: Check, label: "Full setup included" },
];

export function HumanSentModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <div className="p-6 pb-4 space-y-1">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold tracking-tight">
              Stop going back and forth with AI.
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This is how I build in Lovable now.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Pain → Solution */}
        <div className="px-6 pb-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Before</div>
            <div className="text-foreground/80 leading-relaxed">
              Typing prompts.<br />Switching tabs.<br />Rewriting everything.
            </div>
          </div>
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-primary font-medium">Now</div>
            <div className="text-foreground/90 leading-relaxed">
              Talk. Drop a screenshot. Generate the prompt instantly.
            </div>
          </div>
        </div>

        {/* Demo video */}
        <div className="px-6 pb-4">
          <div className="aspect-video w-full rounded-md overflow-hidden border border-border bg-black">
            <iframe
              src={DEMO_EMBED_URL}
              title="HumanSent Prompt Builder demo"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>

        {/* What you get */}
        <div className="px-6 pb-4">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
            What you get
          </div>
          <ul className="space-y-1.5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.label} className="flex items-center gap-2 text-sm text-foreground/90">
                  <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                  {f.label}
                </li>
              );
            })}
          </ul>
        </div>

        {/* CTA */}
        <div className="px-6 pb-6 pt-2 border-t border-border bg-muted/20 space-y-2">
          <Button asChild size="lg" className="w-full">
            <a href={HUMANSENT_URL} target="_blank" rel="noopener noreferrer">
              Get this setup <ArrowRight className="ml-1.5 h-4 w-4" />
            </a>
          </Button>
          <div className="text-center text-xs text-muted-foreground">Pay what you want</div>
          <Button asChild variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
            <a href={HUMANSENT_URL} target="_blank" rel="noopener noreferrer">
              See all prompt packs
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
