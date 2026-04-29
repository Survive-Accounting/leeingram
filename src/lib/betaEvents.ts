// Single source of truth for Spring 2026 beta event names.
// Used by the frontend tracking helper and the dashboard aggregator.

export const BETA_EVENTS = {
  BETA_DASHBOARD_VIEWED: "beta_dashboard_viewed",
  SIGNUP_COMPLETED: "signup_completed",
  LOGIN_COMPLETED: "login_completed",
  COURSE_VIEWED: "course_viewed",
  CHAPTER_SELECTED: "chapter_selected",
  STUDY_CONSOLE_VIEWED: "study_console_viewed",
  PRACTICE_PROBLEM_HELPER_OPENED: "practice_problem_helper_opened",
  JOURNAL_ENTRY_HELPER_OPENED: "journal_entry_helper_opened",
  HELPER_ACTION_CLICKED: "helper_action_clicked",
  HELPER_RESPONSE_LOADED: "helper_response_loaded",
  HELPER_RESPONSE_CACHE_HIT: "helper_response_cache_hit",
  HELPER_RESPONSE_CACHE_MISS: "helper_response_cache_miss",
  FEEDBACK_SUBMITTED: "feedback_submitted",
  FEATURE_SUGGESTION_SUBMITTED: "feature_suggestion_submitted",
  PROBLEM_REPORT_SUBMITTED: "problem_report_submitted",
} as const;

export type BetaEventName = typeof BETA_EVENTS[keyof typeof BETA_EVENTS];

// Convenience groupings used by the dashboard aggregator.
export const HELPER_OPEN_EVENTS: BetaEventName[] = [
  BETA_EVENTS.PRACTICE_PROBLEM_HELPER_OPENED,
  BETA_EVENTS.JOURNAL_ENTRY_HELPER_OPENED,
];

export const FEEDBACK_SUBMIT_EVENTS: BetaEventName[] = [
  BETA_EVENTS.FEEDBACK_SUBMITTED,
  BETA_EVENTS.FEATURE_SUGGESTION_SUBMITTED,
  BETA_EVENTS.PROBLEM_REPORT_SUBMITTED,
];
