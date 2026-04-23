import { useNavigate } from "react-router-dom";

/**
 * Returns true only on staging/dev environments (lovable.dev/lovable.app preview)
 * and never on the live production domain (learn.surviveaccounting.com).
 */
export function useIsStaging(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  if (host === "learn.surviveaccounting.com") return false;
  if (host === "leeingram.lovable.app") return false;
  return (
    host.includes("lovable.dev") ||
    host.includes("lovable.app") ||
    host === "localhost" ||
    host.startsWith("127.")
  );
}

interface DevShortcutProps {
  label: string;
  to: string;
  onClick?: () => void;
  className?: string;
}

export function DevShortcut({ label, to, onClick, className = "" }: DevShortcutProps) {
  const navigate = useNavigate();
  const isStaging = useIsStaging();
  if (!isStaging) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
        navigate(to);
      }}
      className={`text-[12px] text-[#999] hover:text-[#666] hover:underline transition-colors bg-transparent border-0 cursor-pointer ${className}`}
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      {label}
    </button>
  );
}
