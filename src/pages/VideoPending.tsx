import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { VideoOff } from "lucide-react";

export default function VideoPending() {
  return (
    <SurviveSidebarLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
          <VideoOff className="h-6 w-6 text-primary" />
          Video Pending
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Teaching assets that still need walkthrough videos recorded.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card/50 p-12 text-center">
        <p className="text-muted-foreground">
          Coming soon: queue of assets awaiting video recording.
        </p>
      </div>
    </SurviveSidebarLayout>
  );
}
