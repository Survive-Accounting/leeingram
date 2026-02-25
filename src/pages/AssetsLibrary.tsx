import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Library } from "lucide-react";

export default function AssetsLibrary() {
  return (
    <SurviveSidebarLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Library className="h-6 w-6 text-primary" />
          Assets Library
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and search all teaching assets across courses and chapters.
        </p>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-8 text-center">
        <p className="text-muted-foreground text-sm">
          Your teaching assets will appear here as you build them in the Asset Factory and Problem Inbox.
        </p>
      </div>
    </SurviveSidebarLayout>
  );
}
