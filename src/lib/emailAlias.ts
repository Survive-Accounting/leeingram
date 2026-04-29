/**
 * Email alias parsing for campus simulation testing.
 *
 * Allows testing with a single inbox (lee@survivestudios.com) by using
 * +alias notation to simulate signups from different campus domains.
 *
 * Examples:
 *   lee+olemiss@survivestudios.com  → simulates olemiss.edu
 *   lee+uark@survivestudios.com     → simulates uark.edu
 *   lee+stanford@survivestudios.com → simulates stanford.edu
 *   lee@survivestudios.com          → no simulation (generic flow)
 *   student@olemiss.edu             → no simulation (real user)
 */

import { isAliasTestBase } from "./emailWhitelist";

// Explicit alias → domain overrides for short aliases that don't match
// the "{alias}.edu" convention.
const ALIAS_DOMAIN_OVERRIDES: Record<string, string> = {
  olemiss: "olemiss.edu",
  uark: "uark.edu",
};

export interface ParsedEmail {
  /** Full email exactly as entered (trimmed + lowercased). */
  realEmail: string;
  /** Local part before any "+" alias. */
  baseEmail: string;
  /** The alias between "+" and "@", or null. */
  alias: string | null;
  /** The actual domain after "@". */
  realDomain: string;
  /** The domain we should treat the user as coming from. */
  simulatedDomain: string;
  /** True iff alias-mode simulation is active. */
  isAliasMode: boolean;
}

export function parseEmail(rawEmail: string): ParsedEmail | null {
  if (!rawEmail || typeof rawEmail !== "string") return null;
  const email = rawEmail.trim().toLowerCase();
  if (!email.includes("@")) return null;

  const [localPart, realDomain] = email.split("@");
  if (!localPart || !realDomain) return null;

  let baseEmail = localPart;
  let alias: string | null = null;
  if (localPart.includes("+")) {
    const idx = localPart.indexOf("+");
    baseEmail = localPart.slice(0, idx);
    const rawAlias = localPart.slice(idx + 1).trim();
    alias = rawAlias.length > 0 ? rawAlias : null;
  }

  const isAliasMode = realDomain === TEST_DOMAIN && !!alias;
  let simulatedDomain = realDomain;
  if (isAliasMode && alias) {
    simulatedDomain = ALIAS_DOMAIN_OVERRIDES[alias] ?? `${alias}.edu`;
  }

  return {
    realEmail: email,
    baseEmail,
    alias,
    realDomain,
    simulatedDomain,
    isAliasMode,
  };
}

/** Convenience: just the simulated domain (or real domain) for a raw email. */
export function getEffectiveDomain(rawEmail: string): string {
  const parsed = parseEmail(rawEmail);
  return parsed?.simulatedDomain ?? "";
}
