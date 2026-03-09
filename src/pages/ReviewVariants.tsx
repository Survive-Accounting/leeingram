import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Inbox } from "lucide-react";

export default function ReviewVariants() {
  const { workspace } = useActiveWorkspace();

  const { data: pendingCount } = useQuery({
    queryKey: ["review-pending-count", workspace?.chapterId],
    queryFn: async () => {
      const { count } = await supabase
        .from("chapter_problems")
        .select("id", { count: "exact", head: true })
        .eq("chapter_id", workspace!.chapterId)
        .eq("pipeline_status", "generated");
      return count ?? 0;
    },
    enabled: !!workspace?.chapterId,
  });

  return (
    <SurviveSidebarLayout>
      <div className="mb-4">
        <h1 className="text-xl font-bold flex items-center gap-2 text-primary-foreground">
          <FileCheck className="h-5 w-5 text-primary" />
          Review Generated Variants
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Review AI-generated Survive Teaching Assets — approve or send back for regeneration.
        </p>
      </div>

      {workspace?.chapterId && pendingCount !== undefined && pendingCount > 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Badge variant="outline" className="text-xs mb-3">
              {pendingCount} {pendingCount === 1 ? "variant" : "variants"} pending review
            </Badge>
            <p className="text-sm text-muted-foreground">
              Use the Generate step to produce variants first, then review them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-foreground font-medium">No generated variants to review yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Generate variants from imported sources first — they'll appear here for approval.
            </p>
          </CardContent>
        </Card>
      )}
    </SurviveSidebarLayout>
  );
}
