/**
 * Centralized role → pipeline step permissions map.
 * Used by PipelineProgressStrip, sidebar, and route guards.
 */

export type EffectiveRole = "content_creation_va" | "sheet_prep_va" | "lead_va" | "admin";

/** Pipeline paths each role is allowed to access */
const ROLE_ACTIVE_PATHS: Record<EffectiveRole, string[]> = {
  content_creation_va: [
    "/problem-bank",
    "/content",
    "/workspace",
    "/review",
    "/assets-library",
    "/solutions-qa",
    "/inbox",
  ],
  sheet_prep_va: [
    "/assets-library",
    "/deployment",
    "/solutions-qa",
    "/inbox",
  ],
  lead_va: [
    "/problem-bank",
    "/content",
    "/workspace",
    "/review",
    "/assets-library",
    "/phase2-review",
    "/quiz-queue",
    "/video-queue",
    "/deployment",
    "/solutions-qa",
    "/solutions-qa-admin",
    "/share-leaderboard",
    "/payment-links-admin",
    "/je-debug",
    "/cram",
    "/solutions-staging",
    "/accy304",
    "/accy304-admin",
    "/chart-of-accounts",
    "/bulk-fix-tool",
  ],
  admin: [
    "/problem-bank",
    "/content",
    "/workspace",
    "/review",
    "/assets-library",
    "/question-review",
    "/quizzes-ready",
    "/video-pending",
    "/videos-ready",
    "/deployment",
    "/dashboard",
    "/va-admin",
    "/va-dashboard",
  ],
};

/** Role display labels */
export const ROLE_LABELS: Record<EffectiveRole, { role: string; phase: string }> = {
  content_creation_va: { role: "Content Creation VA", phase: "Teaching Asset Creation" },
  sheet_prep_va: { role: "Sheet Prep VA", phase: "Sheet Preparation & Deployment" },
  lead_va: { role: "Lead VA", phase: "Course Production & Deployment" },
  admin: { role: "Admin", phase: "Full Pipeline Access" },
};

export function getActivePathsForRole(role: EffectiveRole): string[] {
  return ROLE_ACTIVE_PATHS[role] ?? ROLE_ACTIVE_PATHS.admin;
}

export function isPathActiveForRole(path: string, role: EffectiveRole): boolean {
  const allowed = getActivePathsForRole(role);
  return allowed.some(p => path === p || path.startsWith(p + "/"));
}

export function resolveEffectiveRole(
  impersonatingRole: string | null | undefined,
  vaAccountRole: string | null | undefined,
  isVa: boolean
): EffectiveRole {
  const raw = impersonatingRole || (isVa ? vaAccountRole : null);
  if (raw === "va_test") return "content_creation_va";
  if (raw === "content_creation_va" || raw === "sheet_prep_va" || raw === "lead_va") return raw;
  return "admin";
}
