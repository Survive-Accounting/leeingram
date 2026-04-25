import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const NAVY = "#14213D";
const RED = "#CE1126";
const BG_GRADIENT =
  "radial-gradient(ellipse at 50% 0%, #DBEAFE 0%, #EFF6FF 35%, #F8FAFC 70%, #F8FAFC 100%)";

type State =
  | { phase: "loading" }
  | { phase: "verified"; email: string | null }
  | { phase: "failed"; reason: string };

export default function PostCheckout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get("session_id");
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!sessionId) {
        setState({
          phase: "failed",
          reason:
            "We couldn't find your checkout session. Head back and try again.",
        });
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke(
          "verify-get-access-checkout",
          { body: { session_id: sessionId } },
        );
        if (cancelled) return;
        if (error) throw error;
        const result = data as {
          verified?: boolean;
          email?: string | null;
          customer_email?: string | null;
          payment_status?: string;
          amount_total?: number | null;
          metadata?: Record<string, string> | null;
          action_link?: string | null;
          user_id?: string | null;
        } | null;

        if (result?.verified) {
          const email = (result.customer_email ?? result.email ?? "").toLowerCase() || null;
          const md = result.metadata ?? {};
          const includedCourses = (md.includedCourses ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const purchase = {
            email,
            campus: md.campus ?? null,
            selectedCourse: md.selectedCourse ?? null,
            selectedPlan: md.selectedPlan ?? null,
            includedCourses,
            amountPaid:
              typeof result.amount_total === "number"
                ? result.amount_total / 100
                : md.amount
                  ? Number(md.amount)
                  : null,
            verifiedAt: new Date().toISOString(),
          };
          if (email) sessionStorage.setItem("student_email", email);
          try {
            localStorage.setItem("sa_purchase_context", JSON.stringify(purchase));
          } catch {
            // storage may be full or disabled — non-fatal
          }
          setState({ phase: "verified", email });

          // Auto-login: hand the action_link to Supabase auth.
          // The magic link contains the access token in the URL hash;
          // navigating to it lets supabase-js pick up the session.
          if (result.action_link) {
            // Redirect immediately — magic link establishes session, then lands on /my-dashboard.
            if (cancelled) return;
            try {
              const u = new URL(result.action_link!);
              u.searchParams.set(
                "redirect_to",
                `${window.location.origin}/auth/callback?next=/my-dashboard`,
              );
              window.location.replace(u.toString());
            } catch {
              window.location.replace(result.action_link!);
            }
          } else {
            // Fallback: send them to login if action_link missing
            if (!cancelled) navigate("/login", { replace: true });
          }
        } else {
          setState({
            phase: "failed",
            reason:
              result?.payment_status === "unpaid"
                ? "Your payment didn't go through. No charge was made."
                : "We couldn't confirm your payment just yet.",
          });
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[post-checkout verify]", err);
        setState({
          phase: "failed",
          reason: "Something went wrong while confirming your payment.",
        });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: BG_GRADIENT, fontFamily: "Inter, sans-serif" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center"
        style={{
          background: "#fff",
          border: "1px solid rgba(20,33,61,0.08)",
          boxShadow: "0 16px 48px rgba(20,33,61,0.12)",
        }}
      >
        {state.phase === "loading" && (
          <>
            <Loader2
              className="w-10 h-10 mx-auto mb-4 animate-spin"
              style={{ color: NAVY }}
            />
            <h1
              className="text-[22px] mb-2"
              style={{
                color: NAVY,
                fontFamily: "'DM Serif Display', serif",
                fontWeight: 400,
              }}
            >
              Verifying your payment...
            </h1>
            <p className="text-[14px]" style={{ color: "#64748B" }}>
              Hang tight — this only takes a moment.
            </p>
          </>
        )}

        {state.phase === "verified" && (
          <>
            <CheckCircle2
              className="w-12 h-12 mx-auto mb-4"
              style={{ color: "#16A34A" }}
            />
            <h1
              className="text-[24px] mb-2"
              style={{
                color: NAVY,
                fontFamily: "'DM Serif Display', serif",
                fontWeight: 400,
              }}
            >
              You're in!
            </h1>
            <p className="text-[14px]" style={{ color: "#64748B" }}>
              Redirecting to your dashboard...
            </p>
            <p
              className="mt-4 text-[11px] leading-snug"
              style={{ color: "#94A3B8" }}
            >
              Individual access only. Account activity is monitored to prevent sharing.
            </p>
          </>
        )}

        {state.phase === "failed" && (
          <>
            <AlertCircle
              className="w-10 h-10 mx-auto mb-4"
              style={{ color: RED }}
            />
            <h1
              className="text-[22px] mb-2"
              style={{
                color: NAVY,
                fontFamily: "'DM Serif Display', serif",
                fontWeight: 400,
              }}
            >
              We couldn't confirm your payment
            </h1>
            <p className="text-[14px] mb-5" style={{ color: "#64748B" }}>
              {state.reason} If you were charged, email{" "}
              <a
                href="mailto:lee@surviveaccounting.com"
                className="underline"
                style={{ color: NAVY }}
              >
                lee@surviveaccounting.com
              </a>{" "}
              and we'll sort it out fast.
            </p>
            <button
              onClick={() => navigate("/get-access")}
              className="w-full rounded-xl py-3 text-[15px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.99]"
              style={{
                background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.2), 0 8px 24px rgba(206,17,38,0.3)",
              }}
            >
              Back to Get Access
            </button>
          </>
        )}
      </div>
    </div>
  );
}
