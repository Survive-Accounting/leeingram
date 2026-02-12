import { Link, useLocation } from "react-router-dom";
import { BookOpen } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

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
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
