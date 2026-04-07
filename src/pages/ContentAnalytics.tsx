import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function ContentAnalytics() {
  const { data: assetCounts } = useQuery({
    queryKey: ["content-analytics-assets"],
    queryFn: async () => {
      const { count: total } = await supabase
        .from("teaching_assets")
        .select("id", { count: "exact", head: true });

      const { count: clean } = await supabase
        .from("teaching_assets")
        .select("id", { count: "exact", head: true })
        .eq("qa_status", "clean");

      const { count: issues } = await supabase
        .from("teaching_assets")
        .select("id", { count: "exact", head: true })
        .eq("qa_status", "has_issues");

      return {
        total: total ?? 0,
        clean: clean ?? 0,
        issues: issues ?? 0,
      };
    },
    staleTime: 60 * 1000,
  });

  const cards = [
    { label: "Total Assets", value: assetCounts?.total?.toLocaleString() ?? "—" },
    { label: "Assets QA'd Clean", value: assetCounts?.clean?.toLocaleString() ?? "—" },
    { label: "Assets with Issues", value: assetCounts?.issues?.toLocaleString() ?? "—" },
    { label: "Chapters with Content", value: "—" },
    { label: "Formula Images Live", value: "—" },
    { label: "Student Reports (30d)", value: "—" },
  ];

  return (
    <SurviveSidebarLayout>
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-foreground">Content Analytics</h1>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
          Full content analytics coming soon — page views, solution engagement, QA progress, chapter completion rates.
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {cards.map((c) => (
            <Card key={c.label} className="bg-muted/30 border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                <p className="text-2xl font-bold text-foreground">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-xs text-muted-foreground italic">
          Engagement metrics will populate once student auth is live.
        </p>
      </div>
    </SurviveSidebarLayout>
  );
}
