import { Link, useLocation } from "react-router-dom";
import { BookOpen, LogOut, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
            <BookOpen className="h-5 w-5 text-primary" />
            <span>Survive Accounting</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              to="/"
              className={`transition-colors hover:text-foreground ${
                location.pathname === "/" ? "text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              Dashboard
            </Link>
            <Link
              to="/create-lesson"
              className={`transition-colors hover:text-foreground ${
                location.pathname === "/create-lesson" ? "text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              Create Lesson
            </Link>
            <Link
              to="/marketing"
              className={`transition-colors hover:text-foreground ${
                location.pathname.startsWith("/marketing") ? "text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              Marketing
            </Link>
            <Link
              to="/style-guide"
              className={`transition-colors hover:text-foreground ${
                location.pathname === "/style-guide" ? "text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              Style Guide
            </Link>
            <Link
              to="/roadmap"
              className={`transition-colors hover:text-foreground ${
                location.pathname === "/roadmap" ? "text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              Roadmap
            </Link>
          </nav>
          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-1 h-3.5 w-3.5" /> Sign Out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
