import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

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
  "/asset-stats",
];

export function useIsLee() {
  const { user } = useAuth();
  return LEE_EMAILS.includes(user?.email ?? "");
}

export function AccessRestrictedGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const isLee = useIsLee();

  if (isLee) return <>{children}</>;

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
