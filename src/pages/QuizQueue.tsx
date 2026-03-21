import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useVaAccount } from "@/hooks/useVaAccount";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Package, Download, ExternalLink } from "lucide-react";

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
  const navigate = useNavigate();
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
        <p className="text-xs text-muted-foreground">Generate, review, and export multiple choice questions for LearnWorlds quizzes.</p>
        <Tabs defaultValue="mc-generator">
          <TabsList>
            <TabsTrigger value="mc-generator" className="text-xs">
              <Package className="h-3.5 w-3.5 mr-1.5" /> MC Generator
            </TabsTrigger>
            <TabsTrigger value="export" className="text-xs">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSVs
            </TabsTrigger>
          </TabsList>
          <TabsContent value="mc-generator" className="mt-4">
            <div className="rounded-lg border border-border bg-card p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">MC Generator content lives at its dedicated page.</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/question-review")}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open MC Generator
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="export" className="mt-4">
            <div className="rounded-lg border border-border bg-card p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Quiz export tools live at their dedicated page.</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/quizzes-ready")}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open Export CSVs
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SurviveSidebarLayout>
  );
}
