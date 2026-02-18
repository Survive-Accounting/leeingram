export const LESSON_STATUSES = [
  "Planning",
  "Sheet Generated",
  "Filming",
  "Editing",
  "Published",
] as const;

export type LessonStatus = (typeof LESSON_STATUSES)[number];

export const STATUS_COLORS: Record<LessonStatus, string> = {
  Planning: "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Sheet Generated": "bg-blue-100 text-blue-800 border-blue-200",
  Filming: "bg-purple-100 text-purple-800 border-purple-200",
  Editing: "bg-orange-100 text-orange-800 border-orange-200",
  Published: "bg-green-100 text-green-800 border-green-200",
};

export const QUESTIONNAIRE_QUESTIONS = [
  "What topic are you teaching?",
  "How do you explain this conceptually? (Your voice & approach)",
  "Key formulas, journal entries, or steps students must memorize?",
  "Memory tricks or shortcuts you use for students?",
  "Common mistakes & exam traps to watch for?",
];

export const FILE_TYPES = [
  "textbook",
  "solutions",
] as const;
