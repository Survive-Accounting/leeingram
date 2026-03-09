import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { ProblemBankTab } from "@/components/content-factory/ProblemBankTab";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox } from "lucide-react";

export default function ReviewVariants() {
  const { workspace } = useActiveWorkspace();

  if (!workspace?.chapterId || !workspace?.courseId) {
    return (
      <SurviveSidebarLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-foreground font-medium">Select a chapter to begin reviewing.</p>
          </CardContent>
        </Card>
      </SurviveSidebarLayout>
    );
  }

  return (
    <SurviveSidebarLayout>
      <ProblemBankTab
        chapterId={workspace.chapterId}
        chapterNumber={workspace.chapterNumber ?? 0}
        courseId={workspace.courseId}
        autoReview
      />
    </SurviveSidebarLayout>
  );
}
