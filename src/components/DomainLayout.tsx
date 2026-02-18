import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";
import aorakiBg from "@/assets/aoraki-bg.jpg";

interface DomainLayoutProps {
  children: React.ReactNode;
  title: string;
  tagline?: string;
  actions?: React.ReactNode;
}

export function DomainLayout({ children, title, tagline, actions }: DomainLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative">
      {/* Mountain background */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${aorakiBg})` }}
      />
      <div className="fixed inset-0 bg-black/60" />
      <div className="fixed inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />

      {/* Nav bar */}
      <header className="relative z-10 border-b border-white/10" style={{ backdropFilter: "blur(16px)", background: "rgba(0,0,0,0.3)" }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <button
            onClick={() => navigate("/domains")}
            className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-xs uppercase tracking-widest"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Home</span>
          </button>
          <span className="text-white/20">|</span>
          <h1 className="font-semibold text-white text-sm">{title}</h1>
          {tagline && <span className="text-xs text-white/40 hidden sm:inline">{tagline}</span>}
          {actions && <div className="ml-auto">{actions}</div>}
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 mx-auto max-w-5xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
