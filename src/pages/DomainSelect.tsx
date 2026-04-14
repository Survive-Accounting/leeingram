import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useVaAccount } from "@/hooks/useVaAccount";
import { Button } from "@/components/ui/button";
import { LogOut, Layers, Building2 } from "lucide-react";
import { useEffect } from "react";

const NAVY = "#14213D";

const cards = [
  {
    title: "Content Studio",
    subtitle: "Quiz Queue, Asset QA, Video Pipeline, Chapter Content",
    icon: Layers,
    route: "/dashboard",
  },
  {
    title: "Campus Operations",
    subtitle: "Campuses, Students, Pricing, Analytics",
    icon: Building2,
    route: "/campus-ops",
  },
];

export default function DomainSelect() {
  const { session, signOut } = useAuth();
  const { isVa, isLoading: vaLoading } = useVaAccount();
  const navigate = useNavigate();

  useEffect(() => {
    if (!vaLoading && isVa) {
      navigate("/va-dashboard", { replace: true });
    }
  }, [isVa, vaLoading, navigate]);

  const firstName = session?.user?.user_metadata?.full_name?.split(" ")[0]
    || session?.user?.email?.split("@")[0]
    || "there";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: NAVY }}>
      {/* Sign out */}
      <div className="absolute top-4 right-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="text-white/70 hover:text-white hover:bg-white/10"
        >
          <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign Out
        </Button>
      </div>

      {/* Greeting */}
      <h1 className="text-white text-2xl font-semibold mb-8 tracking-tight">
        Welcome back, {firstName}
      </h1>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.route}
              onClick={() => navigate(card.route)}
              className="group text-left rounded-xl p-6 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              style={{
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors"
                style={{ background: "rgba(20,33,61,0.08)" }}
              >
                <Icon className="h-5 w-5" style={{ color: NAVY }} />
              </div>
              <p className="text-[15px] font-semibold mb-1" style={{ color: NAVY }}>
                {card.title}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>
                {card.subtitle}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
