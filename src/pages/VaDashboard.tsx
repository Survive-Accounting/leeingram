import { useState } from "react";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useVaAccount } from "@/hooks/useVaAccount";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { ContentCreationDashboard } from "@/components/va-dashboards/ContentCreationDashboard";
import { SheetPrepDashboard } from "@/components/va-dashboards/SheetPrepDashboard";
import { LeadVaDashboard } from "@/components/va-dashboards/LeadVaDashboard";
import { Badge } from "@/components/ui/badge";
import { VA_ROLE_LABELS } from "@/hooks/useVaAccount";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function VaDashboard() {
  const { vaAccount, isVa, primaryRole, assignedChapterIds, isLoading } = useVaAccount();
  const { impersonating } = useImpersonation();

  // If impersonating, use that VA's data
  const activeVa = impersonating || vaAccount;
  const activeIsVa = !!impersonating || isVa;
  const activeRole = impersonating?.role
    ? (impersonating.role === "va_test" ? "content_creation_va" : impersonating.role)
    : primaryRole;

  // Fetch assignments for impersonated VA
  const { data: impersonatedAssignments } = useQuery({
    queryKey: ["va-assignments-impersonated", impersonating?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("va_assignments")
        .select("chapter_id")
        .eq("va_account_id", impersonating!.id);
      if (error) throw error;
      return data?.map(a => a.chapter_id) ?? [];
    },
    enabled: !!impersonating?.id,
  });

  // For admin (no impersonation): fetch all chapters
  const isAdmin = !activeIsVa && !impersonating;
  const { data: allChapters } = useQuery({
    queryKey: ["all-chapter-ids"],
    queryFn: async () => {
      const { data } = await supabase.from("chapters").select("id");
      return data?.map(c => c.id) ?? [];
    },
    enabled: isAdmin,
  });

  const effectiveChapterIds = impersonating
    ? (impersonatedAssignments ?? [])
    : isAdmin
      ? (allChapters ?? [])
      : assignedChapterIds;

  // Fetch chapter details for display
  const displayChapterIds = impersonating ? (impersonatedAssignments ?? []) : assignedChapterIds;
  const { data: chapterDetails } = useQuery({
    queryKey: ["assigned-chapter-details", displayChapterIds],
    queryFn: async () => {
      if (!displayChapterIds.length) return [];
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id")
        .in("id", displayChapterIds);
      return data ?? [];
    },
    enabled: displayChapterIds.length > 0,
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

  const getCourse = (id: string) => courseDetails?.find(c => c.id === id);

  return (
    <SurviveSidebarLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground">
                {activeVa ? activeVa.full_name : "VA Dashboard"}
              </h1>
              <Badge variant="outline" className="text-[9px] border-primary/40 text-primary">
                {VA_ROLE_LABELS[activeRole] || activeRole}
              </Badge>
            </div>
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
        </div>

        {/* Role-specific dashboard */}
        {activeRole === "content_creation_va" && (
          <ContentCreationDashboard chapterIds={effectiveChapterIds} vaAccountId={activeVa?.id} />
        )}
        {activeRole === "sheet_prep_va" && (
          <SheetPrepDashboard chapterIds={effectiveChapterIds} />
        )}
        {(activeRole === "lead_va" || activeRole === "admin") && (
          <LeadVaDashboard chapterIds={effectiveChapterIds} />
        )}
      </div>
    </SurviveSidebarLayout>
  );
}
