/**
 * youPerspective — render-time text transform for the V2 Solutions Viewer.
 *
 * Goals:
 *   1. Strip noisy role parentheticals like "(the seller)", "(the buyer)".
 *   2. Promote the primary entity ("Survive Company A") into the second person —
 *      "you" / "your" — so the student is in the driver's seat.
 *   3. Keep multi-entity problems readable by renaming counterparties
 *      (Company B/C/...) to their stripped role label (e.g., "the buyer").
 *
 * This is a PURE display transform. The underlying database fields
 * (survive_problem_text, instruction_1..5) are untouched, and the function
 * leaves tables, monospace blocks, and numeric parentheticals (like
 * "(costing $5,100)" or "(8% interest)") alone.
 */

// Allowed role words inside parentheticals we'll strip / re-use as labels.
// Keep this list specific so we never accidentally strip math / financial parens.
const ROLE_WORDS = [
  "seller",
  "buyer",
  "manufacturer",
  "borrower",
  "lender",
  "lessee",
  "lessor",
  "company",
  "service provider",
  "customer",
  "client",
  "investor",
  "issuer",
  "purchaser",
  "vendor",
  "supplier",
  "employer",
  "employee",
  "parent",
  "subsidiary",
];

const ROLE_PATTERN = ROLE_WORDS.map((w) => w.replace(/\s+/g, "\\s+")).join("|");

// "(the seller)" / "( the seller )" — case-insensitive.
const PAREN_ROLE_RE = new RegExp(`\\s*\\(\\s*the\\s+(${ROLE_PATTERN})\\s*\\)`, "gi");

// Letter suffixes A..E we treat as distinct entities.
const ENTITY_LETTERS = ["A", "B", "C", "D", "E"];

// Verb agreement when "Survive Company A" → "You". Only the high-frequency
// auxiliaries / 3rd-person-singular cases that change form.
const VERB_AGREEMENT: Array<[RegExp, string]> = [
  [/\bYou\s+reports\b/g, "You report"],
  [/\byou\s+reports\b/g, "you report"],
  [/\bYou\s+has\b/g, "You have"],
  [/\byou\s+has\b/g, "you have"],
  [/\bYou\s+is\b/g, "You are"],
  [/\byou\s+is\b/g, "you are"],
  [/\bYou\s+was\b/g, "You were"],
  [/\byou\s+was\b/g, "you were"],
  [/\bYou\s+does\b/g, "You do"],
  [/\byou\s+does\b/g, "you do"],
  [/\bYou\s+pays\b/g, "You pay"],
  [/\byou\s+pays\b/g, "you pay"],
  [/\bYou\s+owns\b/g, "You own"],
  [/\byou\s+owns\b/g, "you own"],
  [/\bYou\s+owes\b/g, "You owe"],
  [/\byou\s+owes\b/g, "you owe"],
  [/\bYou\s+holds\b/g, "You hold"],
  [/\byou\s+holds\b/g, "you hold"],
  [/\bYou\s+sells\b/g, "You sell"],
  [/\byou\s+sells\b/g, "you sell"],
  [/\bYou\s+buys\b/g, "You buy"],
  [/\byou\s+buys\b/g, "you buy"],
  [/\bYou\s+receives\b/g, "You receive"],
  [/\byou\s+receives\b/g, "you receive"],
  [/\bYou\s+issues\b/g, "You issue"],
  [/\byou\s+issues\b/g, "you issue"],
  [/\bYou\s+grants\b/g, "You grant"],
  [/\byou\s+grants\b/g, "you grant"],
  [/\bYou\s+expects\b/g, "You expect"],
  [/\byou\s+expects\b/g, "you expect"],
  [/\bYou\s+estimates\b/g, "You estimate"],
  [/\byou\s+estimates\b/g, "you estimate"],
  [/\bYou\s+calculates\b/g, "You calculate"],
  [/\byou\s+calculates\b/g, "you calculate"],
  [/\bYou\s+chooses\b/g, "You choose"],
  [/\byou\s+chooses\b/g, "you choose"],
  [/\bYou\s+decides\b/g, "You decide"],
  [/\byou\s+decides\b/g, "you decide"],
  [/\bYou\s+uses\b/g, "You use"],
  [/\byou\s+uses\b/g, "you use"],
  [/\bYou\s+earns\b/g, "You earn"],
  [/\byou\s+earns\b/g, "you earn"],
  [/\bYou\s+records\b/g, "You record"],
  [/\byou\s+records\b/g, "you record"],
  [/\bYou\s+prepares\b/g, "You prepare"],
  [/\byou\s+prepares\b/g, "you prepare"],
];

const SMALL_LETTER_TO_LABEL: Record<string, string> = {
  the: "the",
  The: "The",
};

/**
 * Build a per-text map of "Survive Company X" → role label, scanning the raw
 * text BEFORE we strip parens. So "Survive Company B (the buyer)" lets us
 * later replace bare "Survive Company B" with "the buyer".
 */
function buildEntityRoleMap(text: string): Record<string, string> {
  const map: Record<string, string> = {};
  const re = new RegExp(
    `Survive\\s+Company\\s+([A-E])(?:'s)?\\s*\\(\\s*the\\s+(${ROLE_PATTERN})\\s*\\)`,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const letter = m[1].toUpperCase();
    const role = m[2].toLowerCase().replace(/\s+/g, " ").trim();
    // First occurrence wins.
    if (!map[letter]) map[letter] = role;
  }
  return map;
}

/**
 * Apply the transform to a single line that is NOT a table row / fenced block.
 */
function transformLine(line: string, roles: Record<string, string>): string {
  let out = line;

  // 1. Possessive form first — "Survive Company A's" → "your".
  out = out.replace(/\bSurvive\s+Company\s+A's\b/g, "your");
  // After possessive, also handle the plain "Survive Company A".
  // Capitalize "You" only at the start of the string or after sentence-ending
  // punctuation; otherwise lowercase "you".
  out = out.replace(/(^|[.!?]\s+|\n)Survive\s+Company\s+A\b/g, (_m, pre) => `${pre}You`);
  out = out.replace(/\bSurvive\s+Company\s+A\b/g, "you");

  // 2. Counterparties B..E — replace with "the {role}" if we have one,
  //    otherwise leave a clean "Company X" fallback.
  for (const letter of ENTITY_LETTERS.slice(1)) {
    const possRe = new RegExp(`\\bSurvive\\s+Company\\s+${letter}'s\\b`, "g");
    const plainRe = new RegExp(`\\bSurvive\\s+Company\\s+${letter}\\b`, "g");
    const role = roles[letter];
    if (role) {
      out = out.replace(possRe, `the ${role}'s`);
      out = out.replace(plainRe, `the ${role}`);
    } else {
      // Drop the "Survive " prefix only — keeps the problem unambiguous.
      out = out.replace(possRe, `Company ${letter}'s`);
      out = out.replace(plainRe, `Company ${letter}`);
    }
  }

  // 3. Strip any remaining "(the <role>)" parentheticals.
  out = out.replace(PAREN_ROLE_RE, "");

  // 4. Verb agreement cleanup for the new "you" subject.
  for (const [re, replacement] of VERB_AGREEMENT) {
    out = out.replace(re, replacement);
  }

  // 5. Light whitespace cleanup left behind by the stripped parens.
  out = out.replace(/[ \t]{2,}/g, " ");
  out = out.replace(/\s+([.,;:!?])/g, "$1");

  // 6. Re-capitalize first letter if a sentence now starts with "you".
  out = out.replace(/(^|[.!?]\s+)you\b/g, (_m, pre) => `${pre}You`);

  // Avoid ESLint complaint about unused map.
  void SMALL_LETTER_TO_LABEL;

  return out;
}

/**
 * Public entry point. Skips lines that look like markdown table rows or
 * fenced code blocks so structured data renders untouched.
 */
export function toYouPerspective(input: string | null | undefined): string {
  if (!input) return "";
  const roles = buildEntityRoleMap(input);

  const lines = input.split("\n");
  let inFence = false;
  return lines
    .map((raw) => {
      const trimmed = raw.trimStart();
      if (trimmed.startsWith("```")) {
        inFence = !inFence;
        return raw;
      }
      if (inFence) return raw;
      // Markdown table row or separator — leave alone.
      if (trimmed.startsWith("|")) return raw;
      return transformLine(raw, roles);
    })
    .join("\n");
}
