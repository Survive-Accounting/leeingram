import { Link, useLocation } from "react-router-dom";
import { BookOpen, LogOut, Home, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import aorakiBg from "@/assets/aoraki-bg.jpg";
import { NightSkyOverlay } from "@/components/NightSkyOverlay";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${aorakiBg})` }} />
      <div className="fixed inset-0 bg-black/60" />
      <div className="fixed inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/40" />
      <NightSkyOverlay />
      <header className="relative z-10 border-b border-border" style={{ backdropFilter: "blur(16px)", background: "rgba(5,8,18,0.95)" }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link to="/domains" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs uppercase tracking-widest">
            <Home className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <span className="text-muted-foreground/30">|</span>
          <Link to="/" className="flex items-center gap-2 font-semibold text-foreground text-sm">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span>Survive Accounting</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground hover:bg-muted">
              <Link to="/style-guide">
                <Settings className="mr-1 h-3.5 w-3.5" /> Preferences
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground hover:bg-muted">
              <LogOut className="mr-1 h-3.5 w-3.5" /> Sign Out
            </Button>
          </div>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6">
        <div className="rounded-xl p-5 bg-card border border-border" style={{ boxShadow: "0 4px 24px -4px rgba(0,0,0,0.4)" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
