import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useVaAccount } from "@/hooks/useVaAccount";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VideoPending from "@/pages/VideoPending";
import VideosReady from "@/pages/VideosReady";
import { VideoOff, Video } from "lucide-react";

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
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending" className="text-xs">
              <VideoOff className="h-3.5 w-3.5 mr-1.5" /> Pending Recording
            </TabsTrigger>
            <TabsTrigger value="ready" className="text-xs">
              <Video className="h-3.5 w-3.5 mr-1.5" /> Ready to Deploy
            </TabsTrigger>
          </TabsList>
          <TabsContent value="pending">
            <VideoPending />
          </TabsContent>
          <TabsContent value="ready">
            <VideosReady />
          </TabsContent>
        </Tabs>
      </div>
    </SurviveSidebarLayout>
  );
}
