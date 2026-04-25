import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X } from "lucide-react";

const HIDDEN_KEY = "testFlowToolbar.hidden.v1";

/**
 * Top-of-page testing strip:
 *   1) Visual student-flow progress path (Landing → .edu email → Checkout → Dashboard → LearnWorlds)
 *   2) "Reset test session" button (signs out + clears local/sessionStorage, then hard reloads)
 *
 * Internal tool — visible to anyone but only useful while testing.
 */

const STEPS = [
  { key: "landing", label: "Landing", match: (p: string) => p === "/" || p === "/staging" || p.startsWith("/campus/") },
  { key: "email", label: ".edu Email", match: (_p: string) => false }, // modal step (transient)
  { key: "checkout", label: "Checkout", match: (p: string) => p.startsWith("/get-access") || p.startsWith("/checkout") },
  { key: "dashboard", label: "Dashboard", match: (p: string) => p.startsWith("/dashboard") || p.startsWith("/my-dashboard") },
  { key: "learnworlds", label: "LearnWorlds", match: (_p: string) => false }, // external
];

export default function TestFlowToolbar() {
  const { pathname } = useLocation();
  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(HIDDEN_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(HIDDEN_KEY, hidden ? "1" : "0"); } catch { /* noop */ }
  }, [hidden]);

  const activeIdx = (() => {
    for (let i = STEPS.length - 1; i >= 0; i--) {
      if (STEPS[i].match(pathname)) return i;
    }
    return 0;
  })();

  const handleReset = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      /* non-fatal */
    }
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* non-fatal */
    }
    toast.success("Test session reset — reloading…");
    setTimeout(() => {
      window.location.replace("/");
    }, 350);
  };

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        className="fixed bottom-2 left-2 z-[100] rounded-full px-2.5 py-1 text-[10px] font-semibold transition hover:opacity-90"
        style={{
          background: "#FFF8E1",
          color: "#92400E",
          border: "1px solid #F4D58D",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          fontFamily: "Inter, sans-serif",
        }}
        title="Show test flow toolbar"
      >
        🧪 Show test bar
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[100] w-full border-t"
      style={{
        background: "#FFF8E1",
        borderColor: "#F4D58D",
        fontFamily: "Inter, sans-serif",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.08)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2">
        {/* Progress path */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
            Student flow
          </span>
          {STEPS.map((step, i) => {
            const isActive = i === activeIdx;
            const isPast = i < activeIdx;
            return (
              <div key={step.key} className="flex items-center gap-1.5">
                <div
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{
                    background: isActive ? "#14213D" : isPast ? "#D1FAE5" : "transparent",
                    color: isActive ? "#FFFFFF" : isPast ? "#065F46" : "#92400E",
                    border: isActive
                      ? "1px solid #14213D"
                      : isPast
                      ? "1px solid #6EE7B7"
                      : "1px solid #F4D58D",
                  }}
                >
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                    style={{
                      background: isActive ? "#CE1126" : isPast ? "#10B981" : "#F4D58D",
                      color: "#FFFFFF",
                    }}
                  >
                    {isPast ? "✓" : i + 1}
                  </span>
                  {step.label}
                </div>
                {i < STEPS.length - 1 && (
                  <span aria-hidden className="text-amber-700/60">
                    →
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Reset button */}
        <button
          type="button"
          onClick={handleReset}
          className="rounded-md px-3 py-1.5 text-[11px] font-semibold transition hover:opacity-90"
          style={{
            background: "#CE1126",
            color: "#FFFFFF",
            boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
          }}
        >
          ↻ Reset test session
        </button>
      </div>
    </div>
  );
}
