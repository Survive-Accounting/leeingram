/**
 * Emails whitelisted to bypass .edu validation on student-facing forms.
 * Includes admin + all active VA emails.
 */
export const WHITELISTED_EMAILS = [
  "lee@survivestudios.com",
  "jking.cim@gmail.com",
  "valinonorlynmae@gmail.com",
  "theacarmellesumagaysay@gmail.com",
  "ronavalino.26@gmail.com",
  "noellamaniego@gmail.com",
  "cromwellleon204@gmail.com",
];

export function isWhitelistedEmail(email: string): boolean {
  return WHITELISTED_EMAILS.includes(email.trim().toLowerCase());
}

export function isAllowedEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  return trimmed.endsWith(".edu") || isWhitelistedEmail(trimmed);
}
