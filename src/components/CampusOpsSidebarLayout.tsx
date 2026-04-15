import { useState, useCallback, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home, LogOut, PanelLeftClose, PanelLeft,
  LayoutDashboard, Building2, Plus, DollarSign,
  Users, ShoppingCart, GraduationCap, BarChart3,
  ArrowLeft, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import aorakiBg from "@/assets/aoraki-bg.jpg";
import { NightSkyOverlay } from "@/components/NightSkyOverlay";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

function useNavSection(key: string, childPaths: string[], pathname: string) {
  const storageKey = `campus_nav_${key}_expanded`;
  const isChildActive = childPaths.some(p => pathname === p || pathname.startsWith(p + "/"));
  const [open, setOpen] = useState(() => {
    if (isChildActive) return true;
    return localStorage.getItem(storageKey) === "true";
  });
  const toggle = useCallback(() => {
    setOpen(prev => {
      const next = !prev;
      localStorage.setItem(storageKey, String(next));
      return next;
    });
  }, [storageKey]);
  return { open, toggle };
}

export function CampusOpsSidebarLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("campus-sidebar-collapsed") === "true");
  const [warningCount, setWarningCount] = useState(0);

  useEffect(() => {
    (supabase as any).from("sharing_warnings").select("id", { count: "exact", head: true }).eq("is_reviewed", false).then(({ count }: any) => {
      setWarningCount(count || 0);
    });
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("campus-sidebar-collapsed", String(next));
      return next;
    });
  };

  const isActive = (path: string) => location.pathname === path;

  const renderItem = (label: string, path: string, Icon: any, opts?: { disabled?: boolean; disabledTooltip?: string }) => {
    const active = isActive(path);
    if (opts?.disabled) {
      return (
        <Tooltip key={path}>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-white/30 cursor-not-allowed",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span className="text-sm">{label}</span>}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="text-xs">{opts.disabledTooltip || "Coming soon"}</p>
          </TooltipContent>
        </Tooltip>
      );
    }
    return (
      <Link
        key={path}
        to={path}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-3 py-2.5 transition-colors",
          active
            ? "bg-primary/20 text-white font-medium border border-primary/30"
            : "text-white/90 hover:text-white hover:bg-muted/30"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!sidebarCollapsed && <span className="text-sm">{label}</span>}
      </Link>
    );
  };

  const renderTopLabel = (label: string) => {
    if (sidebarCollapsed) return null;
    return (
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary px-3 pb-1.5 pt-1">{label}</p>
    );
  };

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
        style={{ backdropFilter: "blur(16px)", background: "rgba(2,4,12,0.95)" }}
      >
        <div className="flex h-12 items-center gap-3 px-4">
          <button
            onClick={() => navigate("/domains")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs uppercase tracking-widest"
          >
            <Home className="h-3.5 w-3.5" />
          </button>
          <span className="text-muted-foreground/30">|</span>
          <h1 className="font-semibold text-white text-sm">Campus Operations</h1>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleSidebar} className="text-muted-foreground hover:text-foreground h-7 w-7 p-0">
              {sidebarCollapsed ? <PanelLeft className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground h-7 w-7 p-0">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex min-h-[calc(100vh-3rem)]">
        {/* Sidebar */}
        <nav
          className={cn(
            "shrink-0 border-r border-border py-3 px-2 flex flex-col overflow-y-auto transition-all",
            sidebarCollapsed ? "w-14" : "w-48"
          )}
          style={{ backdropFilter: "blur(16px)", background: "rgba(2,4,12,0.95)" }}
        >
          {/* OVERVIEW */}
          {renderTopLabel("Overview")}
          <div className="space-y-0.5">
            {renderItem("Dashboard", "/campus-ops", LayoutDashboard)}
          </div>

          {/* CAMPUSES */}
          <div className="border-t border-border my-3" />
          {renderTopLabel("Campuses")}
          <div className="space-y-0.5">
            {renderItem("All Campuses", "/campus-ops/campuses", Building2)}
            {renderItem("Add Campus", "/campus-ops/campuses/new", Plus)}
            {renderItem("Pricing", "/campus-ops/pricing", DollarSign)}
          </div>

          {/* STUDENTS */}
          <div className="border-t border-border my-3" />
          {renderTopLabel("Students")}
          <div className="space-y-0.5">
            {renderItem(warningCount > 0 ? `All Students (${warningCount})` : "All Students", "/campus-ops/students", Users)}
            {renderItem("Purchases", "/campus-ops/purchases", ShoppingCart)}
          </div>

          {/* PROFESSORS */}
          <div className="border-t border-border my-3" />
          {renderTopLabel("Professors")}
          <div className="space-y-0.5">
            {renderItem("Partners", "/campus-ops/professors", GraduationCap, { disabled: true, disabledTooltip: "Coming soon" })}
          </div>

          {/* ANALYTICS */}
          <div className="border-t border-border my-3" />
          {renderTopLabel("Analytics")}
          <div className="space-y-0.5">
            {renderItem("Overview", "/campus-ops/analytics", BarChart3)}
          </div>

          {/* BACK */}
          <div className="mt-auto pt-3 border-t border-border">
            <Link
              to="/domains"
              className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-white/70 hover:text-white hover:bg-muted/30 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span className="text-sm">Back to Selector</span>}
            </Link>
          </div>
        </nav>

        <main className="flex-1 overflow-auto relative">
          <div
            className="mx-4 sm:mx-6 mb-6 mt-4 rounded-xl p-5 bg-card border border-border"
            style={{ boxShadow: "0 4px 24px -4px rgba(0,0,0,0.4)" }}
          >
            <ErrorBoundary
              resetKey={`${location.pathname}${location.search}`}
              title="This panel hit a runtime error"
              description="Try reloading this component."
            >
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
