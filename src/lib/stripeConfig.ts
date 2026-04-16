/**
 * Stripe publishable keys — these are PUBLIC keys safe to include in client code.
 * They cannot be used to make charges or access sensitive data.
 */
export const STRIPE_PK_TEST = "pk_test_51TM9RCHyiFzd8XWggqI14jVV69b6HvGUcXqXYAGg3wyRP3RxjZeD97lLxQVl9uTCyWG8JirXbdLemCkOloJhgOnu00lyllwa8U";
export const STRIPE_PK_LIVE = "pk_live_51TM9RCHyiFzd8XWgLpXxLYqnHwsVnXYVOxmhflhBQZXKxO0gZXxfkWxGkxJkpwJ0JaP3F1jJxn0jLpVN1i1bTc3g00DNYHxw6";

/**
 * Returns the correct Stripe publishable key based on test mode.
 * Test mode is determined by sessionStorage flag or bypass email.
 */
export function getStripePk(isTestMode?: boolean): string {
  const test = isTestMode ?? sessionStorage.getItem("sa_test_mode") === "true";
  return test ? STRIPE_PK_TEST : STRIPE_PK_LIVE;
}
