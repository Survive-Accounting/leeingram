import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { StudentInbox } from "@/components/admin-dashboard/StudentInbox";
import { useVaAccount } from "@/hooks/useVaAccount";
import { useImpersonation } from "@/contexts/ImpersonationContext";

export default function StudentInboxPage() {
  const { vaAccount, isVa } = useVaAccount();
  const { impersonating } = useImpersonation();
  const activeRole = impersonating?.role || (isVa ? vaAccount?.role : null);
  const canEdit = !activeRole || activeRole === "admin" || activeRole === "lead_va";

  return (
    <SurviveSidebarLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">Issues to Fix</h1>
        <StudentInbox readOnly={!canEdit} />
      </div>
    </SurviveSidebarLayout>
  );
}
