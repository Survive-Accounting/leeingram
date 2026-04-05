import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useVaAccount } from "@/hooks/useVaAccount";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { resolveEffectiveRole, isPathActiveForRole } from "@/lib/rolePermissions";
import { toast } from "sonner";

/** Pages that should never be blocked (auth, dashboard, etc.) */
/** Paths that are fully public (no auth needed) */
const PUBLIC_PREFIXES = [
  "/solutions", "/practice", "/tools", "/accy304", "/landing",
];

const ALWAYS_ALLOWED = [
  "/admin", "/auth", "/domains", "/va-dashboard", "/va-admin", "/dashboard",
  "/landing", "/focus", "/marketing", "/writing", "/leeingram", "/prof-ingram",
  "/travel", "/chart-of-accounts", "/style-guide", "/ideas", "/pipeline",
  "/template-manager", "/export-sets", "/tutoring", "/filming",
  "/solutions-upload", "/screenshot-capture", "/batch-run", "/bulk-fix-tool",
  "/study-tools", ...PUBLIC_PREFIXES,
];

export function RoleRouteGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isVa, vaAccount } = useVaAccount();
  const { impersonating } = useImpersonation();
  const [shown, setShown] = useState(false);

  const effectiveRole = resolveEffectiveRole(impersonating?.role, vaAccount?.role, isVa);
  const isRestricted = effectiveRole !== "admin";

  /** Routes restricted to admin only — even lead_va cannot access */
  const ADMIN_ONLY_PATHS = ["/solutions-qa-admin"];

  useEffect(() => {
    if (!isRestricted) return;

    const path = location.pathname;

    // Admin-only routes block all VAs including lead_va
    if (ADMIN_ONLY_PATHS.some(p => path === p || path.startsWith(p + "/"))) {
      if (!shown) {
        toast.error("This page is admin-only.");
        setShown(true);
        setTimeout(() => setShown(false), 3000);
      }
      navigate("/va-dashboard", { replace: true });
      return;
    }

    // Lead VA has full navigation access — never redirect
    if (effectiveRole === "lead_va") return;

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
