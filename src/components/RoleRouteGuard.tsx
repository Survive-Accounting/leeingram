import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useVaAccount } from "@/hooks/useVaAccount";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { resolveEffectiveRole, isPathActiveForRole } from "@/lib/rolePermissions";
import { toast } from "sonner";

/** Pages that should never be blocked (auth, dashboard, etc.) */
const ALWAYS_ALLOWED = [
  "/admin", "/auth", "/domains", "/va-dashboard", "/va-admin", "/dashboard",
  "/landing", "/focus", "/marketing", "/writing", "/leeingram", "/prof-ingram",
  "/travel", "/chart-of-accounts", "/style-guide", "/ideas", "/pipeline",
  "/template-manager", "/export-sets", "/tutoring", "/filming",
  "/solutions-upload", "/screenshot-capture", "/batch-run",
];

export function RoleRouteGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isVa, vaAccount } = useVaAccount();
  const { impersonating } = useImpersonation();
  const [shown, setShown] = useState(false);

  const effectiveRole = resolveEffectiveRole(impersonating?.role, vaAccount?.role, isVa);
  const isRestricted = effectiveRole !== "admin";

  useEffect(() => {
    if (!isRestricted) return;

    const path = location.pathname;

    // Check always-allowed paths
    if (ALWAYS_ALLOWED.some(p => path === p || path.startsWith(p + "/"))) return;

    // Check role permissions
    if (!isPathActiveForRole(path, effectiveRole)) {
      if (!shown) {
        toast.error("This step belongs to another role in the pipeline.");
        setShown(true);
        setTimeout(() => setShown(false), 3000);
      }
      navigate("/va-dashboard", { replace: true });
    }
  }, [location.pathname, isRestricted, effectiveRole, navigate, shown]);

  return null;
}
