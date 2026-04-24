import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

/**
 * Requires:
 *  1. Authenticated Supabase session
 *  2. Active student_purchases row (matched by user_id OR email, not expired)
 * Otherwise redirects to /get-access (preserves intended path).
 */
export default function ProtectedDashboardRoute({ children }: Props) {
  const location = useLocation();
  const [state, setState] = useState<"checking" | "ok" | "redirect">("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (!cancelled) setState("redirect");
        return;
      }
      const email = (session.user.email || "").toLowerCase();
      try {
        const { data, error } = await supabase
          .from("student_purchases")
          .select("id, expires_at, user_id, email")
          .or(`user_id.eq.${session.user.id},email.eq.${email}`)
          .limit(20);
        if (error) throw error;
        const now = new Date();
        const active = (data || []).some(
          (p) => !p.expires_at || new Date(p.expires_at) > now,
        );
        if (cancelled) return;
        setState(active ? "ok" : "redirect");
      } catch {
        if (!cancelled) setState("redirect");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (state === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
      </div>
    );
  }
  if (state === "redirect") {
    const returnTo = encodeURIComponent(
      location.pathname + location.search,
    );
    return <Navigate to={`/get-access?returnTo=${returnTo}`} replace />;
  }
  return <>{children}</>;
}
