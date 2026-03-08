import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Download } from "lucide-react";

export default function QuizzesReady() {
  return (
    <SurviveSidebarLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
          <Download className="h-6 w-6 text-primary" />
          Quizzes Ready
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Download generated quiz CSV files for import into LearnWorlds.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card/50 p-12 text-center">
        <p className="text-muted-foreground">
          Coming soon: downloadable CSV quiz banks ready for LearnWorlds import.
        </p>
      </div>
    </SurviveSidebarLayout>
  );
}
