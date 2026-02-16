import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Factory, Mail, Lightbulb, Timer } from "lucide-react";

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
    available: true,
  },
  {
    key: "focus",
    label: "Focus Sprint",
    description: "Microfocused work sessions — now available from the domains page too",
    icon: Timer,
    route: "/focus",
    available: true,
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
