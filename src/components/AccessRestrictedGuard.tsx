import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const LEE_EMAILS = ["lee@survivestudios.com", "lee@surviveaccounting.com"];

/** Pages restricted to Lee only */
const RESTRICTED_PATHS = [
  "/admin/landing-pages",
  "/admin/auth",
  "/admin/greek",
  "/admin/analytics/launch",
  "/admin/analytics/content",
  "/admin/chapter-qa",
  "/admin/legacy-links",
  "/admin/ai-features",
  "/asset-stats",
];

/** Paths additionally accessible to lead VAs */
const LEAD_VA_PATHS = ["/admin/ai-features"];

export function useIsLee() {
  const { user } = useAuth();
  return LEE_EMAILS.includes(user?.email ?? "");
}

function useIsLeadVa() {
  const { user } = useAuth();
  const [isLead, setIsLead] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const email = user?.email;
    if (!email) { setIsLead(false); return; }
    (async () => {
      const { data } = await (supabase as any)
        .from("va_accounts")
        .select("role")
        .eq("email", email)
        .maybeSingle();
      if (!cancelled) setIsLead(data?.role === "lead_va");
    })();
    return () => { cancelled = true; };
  }, [user?.email]);
  return isLead;
}

export function AccessRestrictedGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isLee = useIsLee();
  const isLeadVa = useIsLeadVa();

  if (isLee) return <>{children}</>;
  if (isLeadVa && LEAD_VA_PATHS.some((p) => location.pathname.startsWith(p))) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <Dialog open onOpenChange={() => {}}>
        <DialogContent
          className="max-w-sm [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" /> Access Restricted
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You don't have permission to view this page.
          </p>
          <p className="text-sm text-muted-foreground">
            Message Lee on Slack if you'd like access.
          </p>
          <DialogFooter>
            <Button size="sm" onClick={() => navigate(-1)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
