/**
 * Detects if a problem text references another problem (dependent problem).
 * Returns detection result with extracted reference if possible.
 */

const DEPENDENCY_PATTERNS: { regex: RegExp; extractRef: boolean }[] = [
  // "Assume the same information as in E16.19" — most common textbook dependency phrase
  { regex: /assume the same (?:information|facts|data) as in\s+([A-Z]{1,2}\s*\d+[\-\.]\d+)/i, extractRef: true },
  // "Assume the same information as in Exercise 16-19"
  { regex: /assume the same (?:information|facts|data) as in\s+(?:Exercise|Problem|BE|Brief Exercise)\s*(\d+[\-\.]\d+)/i, extractRef: true },
  { regex: /using the (?:information|data|facts) (?:from|in)\s+([A-Z]{1,2}\s*\d+[\-\.]\d+)/i, extractRef: true },
  { regex: /using the (?:information|data|facts) (?:from|in)\s+(?:Exercise|Problem|BE|Brief Exercise)\s*(\d+[\-\.]\d+)/i, extractRef: true },
  { regex: /based on the previous (?:problem|exercise)/i, extractRef: false },
  { regex: /refer(?:ring)? to\s+(?:the data in\s+)?(?:Exercise|Problem|BE|E|P)\s*(\d+[\-\.]\d+)/i, extractRef: true },
  { regex: /using the data (?:from|in)\s+(?:Exercise|Problem|BE|E|P)\s*(\d+[\-\.]\d+)/i, extractRef: true },
  { regex: /in (?:Exercise|Problem|BE|E|P)\s*(\d+[\-\.]\d+)/i, extractRef: true },
  { regex: /see (?:Exercise|Problem|BE|E|P)\s*(\d+[\-\.]\d+)/i, extractRef: true },
];

export interface DependencyDetectionResult {
  isDependentProblem: boolean;
  detectedRef: string;
  matchedPattern: string;
}

export function detectDependentProblem(problemText: string): DependencyDetectionResult {
  if (!problemText) return { isDependentProblem: false, detectedRef: "", matchedPattern: "" };

  // Only check the first ~500 chars (dependency refs are always at the start)
  const searchText = problemText.slice(0, 500);

  for (const { regex, extractRef } of DEPENDENCY_PATTERNS) {
    const match = searchText.match(regex);
    if (match) {
      return {
        isDependentProblem: true,
        detectedRef: extractRef && match[1] ? match[1].trim() : "",
        matchedPattern: match[0],
      };
    }
  }

  return { isDependentProblem: false, detectedRef: "", matchedPattern: "" };
}
