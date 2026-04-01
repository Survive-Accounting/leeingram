import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { QuizDeployPanel } from "@/components/va-dashboards/QuizDeployPanel";

export default function QuizzesReady() {
  return (
    <SurviveSidebarLayout>
      <div className="pb-12">
        <QuizDeployPanel />
      </div>
    </SurviveSidebarLayout>
  );
}
