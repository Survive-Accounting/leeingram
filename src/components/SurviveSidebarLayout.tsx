import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Factory, Inbox, Library, Video, LogOut, Settings, Package, Workflow, GraduationCap, PanelLeftClose, PanelLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import aorakiBg from "@/assets/aoraki-bg.jpg";
import { NightSkyOverlay } from "@/components/NightSkyOverlay";
import { WorkflowModePanel } from "@/components/WorkflowModePanel";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Problem Import", sub: "Paste source screenshots", path: "/problem-bank", icon: Inbox },
  { label: "Variant Generator", sub: "Generate exam-style variants", path: "/content", icon: Factory },
  { label: "Assets Library", sub: "Approved problems vault", path: "/assets-library", icon: Library },
  { label: "Export Sets", sub: "Bundle for LearnWorlds CSV", path: "/export-sets", icon: Package },
  { label: "Filming Queue", sub: "Video walkthrough tracking", path: "/filming", icon: Video },
  { label: "Tutoring", sub: "Pre-session review", path: "/tutoring/review", icon: GraduationCap },
];

export function SurviveSidebarLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebar-collapsed") === "true");
  const [workflowMode, setWorkflowMode] = useState(() => localStorage.getItem("wf-mode-active") !== "false");

  const toggleWorkflowMode = () => {
    setWorkflowMode((prev) => {
      const next = !prev;
      localStorage.setItem("wf-mode-active", String(next));
      return next;
    });
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${aorakiBg})` }} />
      <div className="fixed inset-0 bg-black/60" />
      <div className="fixed inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/40" />
      <NightSkyOverlay />

      {/* Header */}
      <header
        className="relative z-10 border-b border-border"
        style={{ backdropFilter: "blur(16px)", background: "rgba(5,8,18,0.85)" }}
      >
        <div className="flex h-14 items-center gap-3 px-4">
          <button
            onClick={() => navigate("/domains")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs uppercase tracking-widest"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Home</span>
          </button>
          <span className="text-muted-foreground/30">|</span>
          <h1 className="font-semibold text-foreground text-sm">Survive Accounting</h1>
          <span className="text-xs text-muted-foreground hidden sm:inline">Scalable Teaching Assets</span>
          <div className="ml-auto flex items-center gap-2">
            {!workflowMode && (
              <Button variant="ghost" size="sm" onClick={toggleSidebar} className="text-muted-foreground hover:text-foreground hover:bg-accent" title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}>
                {sidebarCollapsed ? <PanelLeft className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={toggleWorkflowMode} className="text-muted-foreground hover:text-foreground hover:bg-accent">
              <Workflow className="mr-1 h-3.5 w-3.5" /> {workflowMode ? "Dashboard View" : "Workflow View"}
            </Button>
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground hover:bg-accent">
              <Link to="/style-guide">
                <Settings className="mr-1 h-3.5 w-3.5" /> Preferences
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground hover:bg-accent">
              <LogOut className="mr-1 h-3.5 w-3.5" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex min-h-[calc(100vh-3.5rem)]">
        {workflowMode && <WorkflowModePanel />}

        {!workflowMode && !sidebarCollapsed && (
          <nav
            className="w-56 shrink-0 border-r border-border py-4 px-2 space-y-1 flex flex-col"
            style={{ backdropFilter: "blur(16px)", background: "rgba(5,8,18,0.85)" }}
          >
            <div className="space-y-1 flex-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors",
                      active
                        ? "bg-accent text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm block">{item.label}</span>
                      {item.sub && <span className="text-[10px] text-muted-foreground block leading-tight">{item.sub}</span>}
                    </div>
                  </Link>
                );
              })}

              <div className="pt-4 mt-4 border-t border-border space-y-1">
                <Link
                  to="/marketing"
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-xs transition-colors",
                    isActive("/marketing") ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  Marketing
                </Link>
                <Link
                  to="/ideas?domain=survive"
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-xs transition-colors",
                    location.pathname === "/ideas" ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  Ideas
                </Link>
              </div>
            </div>
          </nav>
        )}

        <main className="flex-1 px-6 py-6 overflow-auto relative">
          <div
            className="rounded-xl p-5"
            style={{
              background: "hsl(220 20% 7% / 0.95)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
