import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { AccessRestrictedGuard } from "@/components/AccessRestrictedGuard";

export default function AdminGreek() {
  return (
    <SurviveSidebarLayout>
      <AccessRestrictedGuard>
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-foreground">Greek Portal</h1>
          <div className="rounded-lg border border-border bg-muted/20 p-6 text-center text-muted-foreground text-sm">
            Coming soon — Greek portal sprint
          </div>
        </div>
      </AccessRestrictedGuard>
    </SurviveSidebarLayout>
  );
}
