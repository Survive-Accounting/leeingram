import { useState } from "react";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users } from "lucide-react";
import { ProductionOverview } from "@/components/admin-dashboard/ProductionOverview";
import { VaManagement } from "@/components/admin-dashboard/VaManagement";

export default function AdminDashboard() {
  const [tab, setTab] = useState("production");

  return (
    <SurviveSidebarLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-secondary">
            <TabsTrigger value="production" className="gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" /> Production Overview
            </TabsTrigger>
            <TabsTrigger value="va" className="gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" /> VA Management
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
