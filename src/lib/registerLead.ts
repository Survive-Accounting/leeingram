import { supabase } from "@/integrations/supabase/client";

/**
 * Registers a landing-page lead.
 *
 * Calls the `resolve-campus` edge function which:
 *  - resolves the email domain to a campus (if .edu)
 *  - idempotently inserts a row into `students` with the resolved campus_id
 *
 * The `students` table is the source of truth for lead counts on the
 * Campus Operations dashboard. A lead is "converted" once a matching
 * `student_purchases.email` row exists (the Campuses page handles that math).
 *
 * Safe to call from any landing-page modal. Failures are swallowed so the
 * caller's primary flow (waitlist insert, etc.) is never blocked.
 *
 * @param email      Raw email entered by the user.
 * @param courseSlug Optional course slug for campus matching context.
 *                   When unknown, "intermediate-accounting-2" is used as a
 *                   neutral default so the function still resolves a campus.
 */
export async function registerLead(email: string, courseSlug?: string): Promise<void> {
  const cleanEmail = (email ?? "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) return;

  try {
    await supabase.functions.invoke("resolve-campus", {
      body: {
        email: cleanEmail,
        course_slug: courseSlug || "intermediate-accounting-2",
      },
    });
  } catch (err) {
    // Non-fatal: the modal's primary capture (student_emails / landing_page_leads)
    // still succeeds. Surface to console only.
    // eslint-disable-next-line no-console
    console.warn("[registerLead] resolve-campus failed", err);
  }
}
