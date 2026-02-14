import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Factory, Mail, Lightbulb, Lock } from "lucide-react";

const FACTORIES = [
  {
    key: "content",
    label: "Content Factory",
    description: "Plan lessons, manage chapters, and produce course content",
    icon: Factory,
    route: "/content",
    available: true,
  },
  {
    key: "marketing",
    label: "Marketing Factory",
    description: "Email campaigns, promo videos, and student engagement",
    icon: Mail,
    route: "/marketing",
    available: true,
  },
  {
    key: "ideas",
    label: "Idea Factory",
    description: "Brainstorm features, track roadmap items, and plan the future",
    icon: Lightbulb,
    route: "/roadmap",
    available: false,
  },
];

export default function SurviveHome() {
  return (
    <AppLayout>
      <div className="flex flex-col items-center py-12">
        <h1 className="text-2xl font-bold text-foreground mb-1">Survive Accounting</h1>
        <p className="text-sm text-muted-foreground mb-10">Enter Your Chosen Factory</p>

        <div className="grid gap-4 w-full max-w-xl">
          {FACTORIES.map((f) => {
            const Icon = f.icon;
            const inner = (
              <div className="relative flex items-center gap-4 rounded-lg border bg-card p-5 transition-colors hover:bg-accent group cursor-pointer">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-foreground">{f.label}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                </div>
                {!f.available && (
                  <span className="absolute top-2 right-3 flex items-center gap-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    <Lock className="h-3 w-3" /> Coming Soon
                  </span>
                )}
              </div>
            );

            if (!f.available) {
              return <div key={f.key} className="opacity-50 pointer-events-none">{inner}</div>;
            }

            return (
              <Link key={f.key} to={f.route}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
