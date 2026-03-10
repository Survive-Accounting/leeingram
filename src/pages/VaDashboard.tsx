import { useState } from "react";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useVaAccount } from "@/hooks/useVaAccount";
import { ContentCreationDashboard } from "@/components/va-dashboards/ContentCreationDashboard";
import { SheetPrepDashboard } from "@/components/va-dashboards/SheetPrepDashboard";
import { LeadVaDashboard } from "@/components/va-dashboards/LeadVaDashboard";
import { AdminRoleSwitcher } from "@/components/va-dashboards/AdminRoleSwitcher";
import { Badge } from "@/components/ui/badge";
import { VA_ROLE_LABELS } from "@/hooks/useVaAccount";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function VaDashboard() {
  const { vaAccount, isVa, primaryRole, assignedChapterIds, isLoading } = useVaAccount();
  const [previewRole, setPreviewRole] = useState<string | null>(null);

  const isAdmin = !isVa;
  const activeRole = previewRole || primaryRole;

  // For admin preview: fetch all chapters if no assignments
  const { data: allChapters } = useQuery({
    queryKey: ["all-chapter-ids"],
    queryFn: async () => {
      const { data } = await supabase.from("chapters").select("id");
      return data?.map(c => c.id) ?? [];
    },
    enabled: isAdmin,
  });

  // Also fetch chapter details for display
  const { data: chapterDetails } = useQuery({
    queryKey: ["assigned-chapter-details", assignedChapterIds],
    queryFn: async () => {
      if (!assignedChapterIds.length) return [];
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id")
        .in("id", assignedChapterIds);
      return data ?? [];
    },
    enabled: assignedChapterIds.length > 0,
  });

  const { data: courseDetails } = useQuery({
    queryKey: ["courses-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, code");
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <SurviveSidebarLayout>
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      </SurviveSidebarLayout>
    );
  }

  const effectiveChapterIds = isAdmin ? (allChapters ?? []) : assignedChapterIds;
  const getCourse = (id: string) => courseDetails?.find(c => c.id === id);

  return (
    <SurviveSidebarLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground">
                {isVa ? `${vaAccount?.full_name}` : "VA Dashboard Preview"}
              </h1>
              <Badge variant="outline" className="text-[9px] border-primary/40 text-primary">
                {VA_ROLE_LABELS[activeRole] || activeRole}
              </Badge>
            </div>
            {/* Assigned chapters */}
            {chapterDetails && chapterDetails.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-muted-foreground">Assigned:</span>
                {chapterDetails.map(ch => {
                  const co = getCourse(ch.course_id);
                  return (
                    <Badge key={ch.id} variant="secondary" className="text-[9px]">
                      {co?.code} Ch{ch.chapter_number}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Admin role switcher */}
          {isAdmin && (
            <AdminRoleSwitcher
              previewRole={previewRole || "admin"}
              onRoleChange={(r) => setPreviewRole(r === "admin" ? null : r)}
            />
          )}
        </div>

        {/* Role-specific dashboard */}
        {activeRole === "content_creation_va" && (
          <ContentCreationDashboard chapterIds={effectiveChapterIds} />
        )}
        {activeRole === "sheet_prep_va" && (
          <SheetPrepDashboard chapterIds={effectiveChapterIds} />
        )}
        {activeRole === "lead_va" && (
          <LeadVaDashboard chapterIds={effectiveChapterIds} />
        )}
        {activeRole === "admin" && (
          <LeadVaDashboard chapterIds={effectiveChapterIds} />
        )}
      </div>
    </SurviveSidebarLayout>
  );
}
