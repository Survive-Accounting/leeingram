import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Video } from "lucide-react";

export default function FilmingControlPanel() {
  return (
    <SurviveSidebarLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-primary-foreground">
          <Video className="h-6 w-6 text-primary" />
          Filming Control Panel
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track which approved problems are ready to be recorded as walkthrough videos.</p>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-12 text-center">
        <p className="text-muted-foreground">
          Coming soon: connected workflows built from Teaching Assets.
        </p>
      </div>
    </SurviveSidebarLayout>);

}