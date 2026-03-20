import { useState } from "react";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users } from "lucide-react";
import { ProductionOverview } from "@/components/admin-dashboard/ProductionOverview";
import { VaManagement } from "@/components/admin-dashboard/VaManagement";
import { PipelineResetDialog } from "@/components/admin-dashboard/PipelineResetDialog";

export default function AdminDashboard() {
  const [tab, setTab] = useState("production");

  return (
    <SurviveSidebarLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
          <PipelineResetDialog />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-secondary">
            <TabsTrigger value="production" className="gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" /> Pipeline Overview
            </TabsTrigger>
            <TabsTrigger value="va" className="gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" /> VA Team
            </TabsTrigger>
          </TabsList>

          <TabsContent value="production" className="mt-4">
            <ProductionOverview />
          </TabsContent>
          <TabsContent value="va" className="mt-4">
            <VaManagement />
          </TabsContent>
        </Tabs>
      </div>
    </SurviveSidebarLayout>
  );
}
