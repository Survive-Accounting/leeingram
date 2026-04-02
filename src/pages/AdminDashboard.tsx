import { useState } from "react";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users, Inbox, FlaskConical } from "lucide-react";
import { ProductionOverview } from "@/components/admin-dashboard/ProductionOverview";
import { VaManagement } from "@/components/admin-dashboard/VaManagement";
import { BackupSection } from "@/components/admin-dashboard/BackupSection";
import { StudentInbox } from "@/components/admin-dashboard/StudentInbox";
import { ChapterFormulasManager } from "@/components/admin-dashboard/ChapterFormulasManager";

export default function AdminDashboard() {
  const [tab, setTab] = useState("production");

  return (
    <SurviveSidebarLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-secondary">
            <TabsTrigger value="production" className="gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" /> Pipeline Overview
            </TabsTrigger>
            <TabsTrigger value="va" className="gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" /> VA Team
            </TabsTrigger>
            <TabsTrigger value="inbox" className="gap-1.5 text-xs">
              <Inbox className="h-3.5 w-3.5" /> Student Inbox
            </TabsTrigger>
            <TabsTrigger value="formulas" className="gap-1.5 text-xs">
              <FlaskConical className="h-3.5 w-3.5" /> Chapter Formulas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="production" className="mt-4">
            <ProductionOverview />
          </TabsContent>
          <TabsContent value="va" className="mt-4">
            <VaManagement />
          </TabsContent>
          <TabsContent value="inbox" className="mt-4">
            <StudentInbox />
          </TabsContent>
          <TabsContent value="formulas" className="mt-4">
            <ChapterFormulasManager />
          </TabsContent>
        </Tabs>

        <BackupSection />
      </div>
    </SurviveSidebarLayout>
  );
}
