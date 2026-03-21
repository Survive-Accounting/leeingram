import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useVaAccount } from "@/hooks/useVaAccount";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BankedQuestionReview from "@/pages/BankedQuestionReview";
import QuizzesReady from "@/pages/QuizzesReady";
import { Package, Download } from "lucide-react";

function VaPlaceholder({ heading, body }: { heading: string; body: string }) {
  return (
    <SurviveSidebarLayout>
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="max-w-md w-full rounded-xl p-8 text-center space-y-4" style={{ backgroundColor: "#14213D" }}>
          <h2 className="text-xl font-bold text-white">{heading}</h2>
          <p className="text-sm text-white/70 leading-relaxed">{body}</p>
          <p className="text-xs text-white/40 mt-4">— Lee Ingram</p>
        </div>
      </div>
    </SurviveSidebarLayout>
  );
}

export default function QuizQueue() {
  const { isVa } = useVaAccount();
  const { impersonating } = useImpersonation();
  const showPlaceholder = isVa || !!impersonating;

  if (showPlaceholder) {
    return (
      <VaPlaceholder
        heading="Quiz Queue"
        body="This Phase 2 step is where multiple choice questions are generated, reviewed, and exported for LearnWorlds quizzes. Tasks related to this step are coming soon! Thank you for your help building Survive Accounting."
      />
    );
  }

  return (
    <SurviveSidebarLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <h1 className="text-lg font-bold text-foreground">Quiz Queue</h1>
        <Tabs defaultValue="mc-generator">
          <TabsList>
            <TabsTrigger value="mc-generator" className="text-xs">
              <Package className="h-3.5 w-3.5 mr-1.5" /> MC Generator
            </TabsTrigger>
            <TabsTrigger value="export" className="text-xs">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSVs
            </TabsTrigger>
          </TabsList>
          <TabsContent value="mc-generator">
            <BankedQuestionReviewEmbed />
          </TabsContent>
          <TabsContent value="export">
            <QuizzesReadyEmbed />
          </TabsContent>
        </Tabs>
      </div>
    </SurviveSidebarLayout>
  );
}

// Embed wrappers — render the page content without the sidebar wrapper
// These pages already use SurviveSidebarLayout, so we need to extract just the content.
// For now, we render them directly (they'll have nested sidebars which isn't ideal).
// A cleaner approach: render the page components directly.

function BankedQuestionReviewEmbed() {
  // Re-use the existing page — it renders inside SurviveSidebarLayout already
  // So we embed it as-is; the double-sidebar is hidden by the tab structure
  return <BankedQuestionReview />;
}

function QuizzesReadyEmbed() {
  return <QuizzesReady />;
}
