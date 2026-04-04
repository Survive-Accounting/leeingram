import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { StudentInbox } from "@/components/admin-dashboard/StudentInbox";

export default function StudentInboxPage() {
  return (
    <SurviveSidebarLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">Student Inbox</h1>
        <StudentInbox />
      </div>
    </SurviveSidebarLayout>
  );
}
