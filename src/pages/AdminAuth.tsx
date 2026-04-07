import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { AccessRestrictedGuard } from "@/components/AccessRestrictedGuard";

export default function AdminAuth() {
  return (
    <SurviveSidebarLayout>
      <AccessRestrictedGuard>
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-foreground">Auth &amp; Payments</h1>
          <div className="rounded-lg border border-border bg-muted/20 p-6 text-center text-muted-foreground text-sm">
            Coming soon — Auth sprint
          </div>
        </div>
      </AccessRestrictedGuard>
    </SurviveSidebarLayout>
  );
}
