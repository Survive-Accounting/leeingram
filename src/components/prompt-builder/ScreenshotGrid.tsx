import { Button } from "@/components/ui/button";
import { Copy, Trash2, Camera } from "lucide-react";
import { toast } from "sonner";
import { useShots, screenshotStore } from "./screenshotStore";
import { copyImageToClipboard } from "./clipboardImage";

interface Props {
  onCapture: () => void;
}

/** 10-slot grid showing numbered, marked-up screenshots. */
export function ScreenshotGrid({ onCapture }: Props) {
  const shots = useShots();

  const copy = async (n: number, dataUrl: string) => {
    const ok = await copyImageToClipboard(dataUrl);
    if (ok) toast.success(`#${n} copied — paste into Lovable`);
    else toast.error("Copy failed (browser may not support image copy)");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          Screenshots ({shots.length}/10)
        </span>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCapture}>
          <Camera className="h-3 w-3 mr-1" /> Capture page
        </Button>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const shot = shots.find((s) => s.n === n);
          return (
            <div
              key={n}
              className="relative aspect-square rounded border border-border bg-muted/30 flex items-center justify-center overflow-hidden group"
            >
              {shot ? (
                <>
                  <img src={shot.dataUrl} alt={`Screenshot ${n}`} className="w-full h-full object-cover" />
                  <span className="absolute top-0.5 left-0.5 text-[10px] font-bold text-white bg-primary rounded px-1 py-0.5 leading-none">
                    #{n}
                  </span>
                  <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    <button
                      onClick={() => copy(n, shot.dataUrl)}
                      className="rounded bg-primary text-primary-foreground p-1 hover:scale-110 transition-transform"
                      title={`Copy #${n}`}
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => screenshotStore.remove(n)}
                      className="rounded bg-destructive text-destructive-foreground p-1 hover:scale-110 transition-transform"
                      title={`Delete #${n}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </>
              ) : (
                <span className="text-[10px] text-muted-foreground">#{n}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
