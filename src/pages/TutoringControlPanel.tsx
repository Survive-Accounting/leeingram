import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { GraduationCap } from "lucide-react";

export default function TutoringControlPanel() {
  return (
    <SurviveSidebarLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          Tutoring Control Panel
        </h1>
      </div>
      <div className="rounded-lg border border-border bg-muted p-12 text-center">
        <p className="text-muted-foreground">
          Coming soon: connected workflows built from Teaching Assets.
        </p>
      </div>
    </SurviveSidebarLayout>
  );
}
