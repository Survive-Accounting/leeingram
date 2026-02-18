import { Link } from "react-router-dom";
import { DomainLayout } from "@/components/DomainLayout";
import { Factory, Mail, Lightbulb } from "lucide-react";

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
];

export default function SurviveHome() {
  return (
    <DomainLayout title="Survive Accounting" tagline="Nationwide exam prep platform">
      <div className="flex flex-col items-center py-8">
        <div className="grid gap-4 w-full max-w-xl">
          {FACTORIES.map((f) => {
            const Icon = f.icon;
            const inner = (
              <div
                className="relative flex items-center gap-4 rounded-lg p-5 transition-all cursor-pointer"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backdropFilter: "blur(12px)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <Icon className="h-5 w-5 text-white/80" />
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-white">{f.label}</h2>
                  <p className="text-xs text-white/50 mt-0.5">{f.description}</p>
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
    </DomainLayout>
  );
}
