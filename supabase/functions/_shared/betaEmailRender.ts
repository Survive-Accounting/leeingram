// Shared variable substitution for beta system emails.
export type RenderVars = {
  first_name?: string;
  recipient_email?: string;
  magic_link_url?: string;
  beta_number?: string | number;
  course_name?: string;
  campus_name?: string;
  dashboard_url?: string;
};

const DEFAULTS: Required<RenderVars> = {
  first_name: "there",
  recipient_email: "you@example.com",
  magic_link_url: "https://learn.surviveaccounting.com/auth/callback?preview=1",
  beta_number: "—",
  course_name: "your course",
  campus_name: "your campus",
  dashboard_url: "https://learn.surviveaccounting.com/dashboard",
};

export function applyVars(input: string, vars: RenderVars): string {
  const merged: Record<string, string> = { ...DEFAULTS, ...Object.fromEntries(
    Object.entries(vars).filter(([_, v]) => v !== undefined && v !== null && v !== "")
  )} as any;
  return input.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(merged[k] ?? `{{${k}}}`));
}

export function firstNameFromEmail(email: string): string {
  const local = (email.split("@")[0] || "").split(/[._+-]/)[0] || "";
  if (!local) return "there";
  return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
}
