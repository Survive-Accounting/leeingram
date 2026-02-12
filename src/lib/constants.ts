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
  "What topic are you trying to teach?",
  "How do you explain this concept conceptually?",
  "What formulas, journal entries, or steps must students memorize?",
  "What common mistakes should students watch for?",
  "What textbook problems should this lesson focus on?",
  "Why are these problems tricky on exams?",
  "Any additional teaching notes?",
];

export const FILE_TYPES = [
  "textbook",
  "solutions",
  "tutoring",
  "transcript",
  "other",
] as const;
