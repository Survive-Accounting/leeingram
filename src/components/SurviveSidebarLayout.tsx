import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Factory, Inbox, Library, Video, GraduationCap, LogOut, Settings, Package, ListChecks, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import aorakiBg from "@/assets/aoraki-bg.jpg";
import { NightSkyOverlay } from "@/components/NightSkyOverlay";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Asset Factory", path: "/content", icon: Factory },
  { label: "Problem Inbox", path: "/problem-bank", icon: Inbox },
  { label: "Assets Library", path: "/assets-library", icon: Library },
  { label: "Export Sets", path: "/export-sets", icon: Package },
  { label: "Filming Control Panel", path: "/filming", icon: Video },
];

const STEPS_PAGES = ["/problem-bank", "/assets-library", "/export-sets"];

const CHECKLIST_KEY = "pp-steps-checked";
const PANEL_KEY = "pp-steps-open";

const STEPS = [
  "Add Raw Problem to Problem Inbox",
  "Upload Screenshot / PDF",
  "Click Generate 3 Candidates",
  "Save Best Asset",
  "Confirm in Assets Library",
  "Add to Export Set",
  "Export CSV",
  "Import to LW Question Bank",
  "Add to Ch13 Quiz",
  "Record 3–5 min Problem Video",
];

function loadChecked(): boolean[] {
  try {
    const raw = localStorage.getItem(CHECKLIST_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return new Array(STEPS.length).fill(false);
}

export function SurviveSidebarLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const showStepsPanel = STEPS_PAGES.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + "/")
  );

  const [panelOpen, setPanelOpen] = useState(() => {
    if (!showStepsPanel) return false;
    return localStorage.getItem(PANEL_KEY) !== "false";
  });

  const [checked, setChecked] = useState<boolean[]>(loadChecked);

  const togglePanel = () => {
    const next = !panelOpen;
    setPanelOpen(next);
    localStorage.setItem(PANEL_KEY, String(next));
  };

  const toggleCheck = (idx: number) => {
    setChecked((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next));
      return next;
    });
  };

  const resetChecklist = () => {
    const fresh = new Array(STEPS.length).fill(false);
    setChecked(fresh);
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(fresh));
  };

  const doneCount = checked.filter(Boolean).length;

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${aorakiBg})` }} />
      <div className="fixed inset-0 bg-black/40" />
      <div className="fixed inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20" />
      <NightSkyOverlay />

      {/* Header */}
      <header
        className="relative z-10 border-b border-white/10"
        style={{ backdropFilter: "blur(16px)", background: "rgba(0,0,0,0.3)" }}
      >
        <div className="flex h-14 items-center gap-3 px-4">
          <button
            onClick={() => navigate("/domains")}
            className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-xs uppercase tracking-widest"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Home</span>
          </button>
          <span className="text-white/20">|</span>
          <h1 className="font-semibold text-white text-sm">Survive Accounting</h1>
          <span className="text-xs text-white/40 hidden sm:inline">Scalable Teaching Assets</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-white/50 hover:text-white hover:bg-white/10">
              <Link to="/style-guide">
                <Settings className="mr-1 h-3.5 w-3.5" /> Preferences
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-white/50 hover:text-white hover:bg-white/10">
              <LogOut className="mr-1 h-3.5 w-3.5" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex min-h-[calc(100vh-3.5rem)]">
        {/* Sidebar */}
        <nav
          className="w-56 shrink-0 border-r border-white/10 py-4 px-2 space-y-1 flex flex-col"
          style={{ backdropFilter: "blur(16px)", background: "rgba(0,0,0,0.25)" }}
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
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-white/15 text-white font-medium"
                      : "text-white/50 hover:text-white hover:bg-white/8"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Secondary links */}
            <div className="pt-4 mt-4 border-t border-white/10 space-y-1">
              <Link
                to="/marketing"
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-xs transition-colors",
                  isActive("/marketing") ? "bg-white/15 text-white font-medium" : "text-white/40 hover:text-white/70 hover:bg-white/5"
                )}
              >
                Marketing
              </Link>
              <Link
                to="/ideas?domain=survive"
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-xs transition-colors",
                  location.pathname === "/ideas" ? "bg-white/15 text-white font-medium" : "text-white/40 hover:text-white/70 hover:bg-white/5"
                )}
              >
                Ideas
              </Link>
            </div>
          </div>

          {/* Steps toggle button at bottom of sidebar */}
          {showStepsPanel && (
            <div className="pt-3 mt-3 border-t border-white/10">
              <button
                onClick={togglePanel}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-xs w-full transition-colors",
                  panelOpen
                    ? "bg-primary/20 text-primary font-medium"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                )}
              >
                <ListChecks className="h-4 w-4 shrink-0" />
                <span>PP Steps</span>
                <span className="ml-auto text-[10px] tabular-nums">
                  {doneCount}/{STEPS.length}
                </span>
              </button>
            </div>
          )}
        </nav>

        {/* Steps Panel */}
        {showStepsPanel && panelOpen && (
          <aside
            className="w-64 shrink-0 border-r border-white/10 py-4 px-3 overflow-y-auto"
            style={{ backdropFilter: "blur(16px)", background: "rgba(0,0,0,0.3)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                <ListChecks className="h-3.5 w-3.5" />
                Practice Problem Steps
              </h2>
              <button
                onClick={togglePanel}
                className="text-white/30 hover:text-white/60 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1 rounded-full bg-white/10 mb-4">
              <div
                className="h-1 rounded-full bg-primary transition-all duration-300"
                style={{ width: `${(doneCount / STEPS.length) * 100}%` }}
              />
            </div>

            <div className="space-y-1">
              {STEPS.map((step, idx) => (
                <label
                  key={idx}
                  className={cn(
                    "flex items-start gap-2.5 rounded-md px-2 py-1.5 cursor-pointer transition-colors hover:bg-white/5",
                    checked[idx] && "opacity-50"
                  )}
                >
                  <Checkbox
                    checked={checked[idx]}
                    onCheckedChange={() => toggleCheck(idx)}
                    className="mt-0.5 shrink-0"
                  />
                  <span className={cn(
                    "text-xs leading-relaxed",
                    checked[idx] ? "line-through text-white/40" : "text-white/80"
                  )}>
                    {idx + 1}. {step}
                  </span>
                </label>
              ))}
            </div>

            {doneCount > 0 && (
              <button
                onClick={resetChecklist}
                className="mt-4 text-[10px] text-white/30 hover:text-white/60 transition-colors"
              >
                Reset checklist
              </button>
            )}
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 px-6 py-6 overflow-auto">
          <div
            className="rounded-xl p-5"
            style={{
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
