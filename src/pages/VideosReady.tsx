import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Video } from "lucide-react";

export default function VideosReady() {
  return (
    <SurviveSidebarLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
          <Video className="h-6 w-6 text-primary" />
          Videos Ready
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Teaching assets with completed walkthrough videos ready for deployment.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card/50 p-12 text-center">
        <p className="text-muted-foreground">
          Coming soon: assets with finished videos ready to deploy.
        </p>
      </div>
    </SurviveSidebarLayout>
  );
}
