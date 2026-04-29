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
  "ejking232002@gmail.com",
  "nrrvm1995@icloud.com",
];

/**
 * Test inboxes that support `+alias` campus simulation
 * (e.g. ejking232002+olemiss@gmail.com → simulates olemiss.edu).
 * Gmail/iCloud forward `+aliases` to the base inbox automatically.
 */
export const ALIAS_TEST_BASE_EMAILS = [
  "lee@survivestudios.com",
  "jking.cim@gmail.com",
  "valinonorlynmae@gmail.com",
  "ronavalino.26@gmail.com",
  "ejking232002@gmail.com",
  "nrrvm1995@icloud.com",
];

export function isWhitelistedEmail(email: string): boolean {
  return WHITELISTED_EMAILS.includes(email.trim().toLowerCase());
}

export function isAllowedEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  return trimmed.endsWith(".edu") || isWhitelistedEmail(trimmed);
}

/** True if `base@domain` (no +alias) is a registered test inbox. */
export function isAliasTestBase(baseEmail: string): boolean {
  return ALIAS_TEST_BASE_EMAILS.includes(baseEmail.trim().toLowerCase());
}
