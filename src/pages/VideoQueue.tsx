import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useVaAccount } from "@/hooks/useVaAccount";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { VideoOff, Video, ExternalLink } from "lucide-react";

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

export default function VideoQueue() {
  const { isVa } = useVaAccount();
  const { impersonating } = useImpersonation();
  const navigate = useNavigate();
  const showPlaceholder = isVa || !!impersonating;

  if (showPlaceholder) {
    return (
      <VaPlaceholder
        heading="Video Queue"
        body="This Phase 2 step is where instructional videos are recorded, edited, and attached to LearnWorlds lessons. Tasks related to this step are coming soon! Thank you for your help building Survive Accounting."
      />
    );
  }

  return (
    <SurviveSidebarLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <h1 className="text-lg font-bold text-foreground">Video Queue</h1>
        <p className="text-xs text-muted-foreground">Record, edit, and attach instructional videos to LearnWorlds lessons.</p>
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending" className="text-xs">
              <VideoOff className="h-3.5 w-3.5 mr-1.5" /> Pending Recording
            </TabsTrigger>
            <TabsTrigger value="ready" className="text-xs">
              <Video className="h-3.5 w-3.5 mr-1.5" /> Ready to Deploy
            </TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-4">
            <div className="rounded-lg border border-border bg-card p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Video recording queue lives at its dedicated page.</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/video-pending")}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open Video Pending
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="ready" className="mt-4">
            <div className="rounded-lg border border-border bg-card p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Completed videos ready for deployment live at their dedicated page.</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/videos-ready")}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open Videos Ready
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SurviveSidebarLayout>
  );
}
