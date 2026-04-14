import { CampusOpsSidebarLayout } from "@/components/CampusOpsSidebarLayout";

export default function CampusOperations({ children }: { children?: React.ReactNode }) {
  return (
    <CampusOpsSidebarLayout>
      {children || (
        <div>
          <h1 className="text-lg font-semibold mb-1">Campus Operations Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview coming soon.</p>
        </div>
      )}
    </CampusOpsSidebarLayout>
  );
}
