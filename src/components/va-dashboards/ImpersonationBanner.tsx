import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Button } from "@/components/ui/button";
import { UserX, Shield } from "lucide-react";
import { VA_ROLE_LABELS } from "@/hooks/useVaAccount";

export function ImpersonationBanner() {
  const { impersonating, stopImpersonating } = useImpersonation();
  if (!impersonating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600 text-white px-4 py-1.5 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4" />
        <span className="font-medium">
          Impersonating: {impersonating.full_name} — {VA_ROLE_LABELS[impersonating.role] || impersonating.role}
        </span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="h-6 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
        onClick={stopImpersonating}
      >
        <UserX className="h-3 w-3 mr-1" /> Exit Impersonation
      </Button>
    </div>
  );
}
