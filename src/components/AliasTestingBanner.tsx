import React from "react";
import { parseEmail } from "@/lib/emailAlias";

/**
 * Small subtle banner shown only for alias-mode testing emails
 * (e.g. lee+olemiss@survivestudios.com → "Testing as: olemiss.edu").
 *
 * Returns null for real users — never visible in production traffic.
 */
const AliasTestingBanner: React.FC<{ email?: string | null; className?: string }> = ({
  email,
  className,
}) => {
  if (!email) return null;
  const parsed = parseEmail(email);
  if (!parsed?.isAliasMode) return null;

  return (
    <div
      className={
        "rounded-md bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200 " +
        (className ?? "")
      }
    >
      Testing as: <span className="font-mono">{parsed.simulatedDomain}</span> (alias mode)
    </div>
  );
};

export default AliasTestingBanner;
