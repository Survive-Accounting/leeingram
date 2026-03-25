/**
 * Detects if a problem text references another problem (dependent problem).
 * Returns detection result with extracted reference if possible.
 */

// Ref format: 1-2 digit chapter number, separator, 1-2 digit problem number (optionally A/B suffix)
const REF_NUM = "\\d{1,2}[\\-\\.]\\d{1,2}[A-Za-z]?";

const DEPENDENCY_PATTERNS: { regex: RegExp; extractRef: boolean }[] = [
  // "Assume the same information as in E16.19" — most common textbook dependency phrase
  { regex: new RegExp(`assume the same (?:information|facts|data) as in\\s+([A-Z]{1,2}\\s*${REF_NUM})`, "i"), extractRef: true },
  // "Assume the same information as in Exercise 16-19"
  { regex: new RegExp(`assume the same (?:information|facts|data) as in\\s+(?:Exercise|Problem|BE|Brief Exercise)\\s*(${REF_NUM})`, "i"), extractRef: true },
  { regex: new RegExp(`using the (?:information|data|facts) (?:from|in)\\s+([A-Z]{1,2}\\s*${REF_NUM})`, "i"), extractRef: true },
  { regex: new RegExp(`using the (?:information|data|facts) (?:from|in)\\s+(?:Exercise|Problem|BE|Brief Exercise)\\s*(${REF_NUM})`, "i"), extractRef: true },
  { regex: /based on the previous (?:problem|exercise)/i, extractRef: false },
  { regex: new RegExp(`refer(?:ring)? to\\s+(?:the (?:data|information) in\\s+)?(?:Exercise|Problem|BE)\\s*(${REF_NUM})`, "i"), extractRef: true },
  { regex: new RegExp(`using the data (?:from|in)\\s+(?:Exercise|Problem|BE)\\s*(${REF_NUM})`, "i"), extractRef: true },
  // Require full word "Exercise"/"Problem" — single-letter E/P causes false positives with dollar amounts
  { regex: new RegExp(`\\bin (?:Exercise|Problem|Brief Exercise)\\s*(${REF_NUM})`, "i"), extractRef: true },
  { regex: new RegExp(`\\bsee (?:Exercise|Problem|Brief Exercise)\\s*(${REF_NUM})`, "i"), extractRef: true },
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
