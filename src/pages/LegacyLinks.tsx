import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Link } from "react-router-dom";

const LEGACY_LINKS = [
  { label: "Import", path: "/problem-bank" },
  { label: "Review", path: "/review" },
  { label: "Teaching Assets", path: "/assets-library" },
  { label: "Topic Generator", path: "/phase2-review" },
  { label: "Quiz Queue", path: "/quiz-queue" },
  { label: "QA Admin", path: "/solutions-qa-admin" },
  { label: "Asset Page Fixer", path: "/inbox" },
  { label: "Bulk Fix Tool", path: "/bulk-fix-tool" },
  { label: "QA Costs", path: "/qa-costs" },
  { label: "ACCY 304 Beta", path: "/accy304-admin" },
  { label: "Asset Stats", path: "/asset-stats" },
];

export default function LegacyLinks() {
  return (
    <SurviveSidebarLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Legacy Links</h1>
          <p className="text-sm text-muted-foreground mt-1">All admin pages — kept for reference.</p>
        </div>

        <div className="space-y-1">
          {LEGACY_LINKS.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm text-foreground">{link.label}</span>
              <span className="text-xs text-muted-foreground">{link.path}</span>
            </Link>
          ))}
        </div>
      </div>
    </SurviveSidebarLayout>
  );
}
