import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { AccessRestrictedGuard } from "@/components/AccessRestrictedGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PLACEHOLDER_CARDS = [
  { label: "Students Signed Up", value: "—" },
  { label: "Active Study Passes", value: "—" },
  { label: "Revenue This Month", value: "—" },
  { label: "Greek Orgs Licensed", value: "—" },
  { label: "Campus Pages Live", value: "—" },
  { label: "Avg Time to Purchase", value: "—" },
];

export default function LaunchAnalytics() {
  return (
    <SurviveSidebarLayout>
      <AccessRestrictedGuard>
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-foreground">Launch Analytics</h1>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
          Full launch analytics coming soon — student signups, conversion rates, campus traffic, Greek org purchases.
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {PLACEHOLDER_CARDS.map((c) => (
            <Card key={c.label} className="bg-muted/30 border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                <p className="text-2xl font-bold text-foreground/40">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-xs text-muted-foreground italic">
          These will populate automatically once Auth &amp; Payments are live.
        </p>
      </div>
      </AccessRestrictedGuard>
    </SurviveSidebarLayout>
  );
}
