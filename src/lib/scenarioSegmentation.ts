/**
 * Scenario Segmentation Pre-processor
 * 
 * Detects multi-scenario problems (e.g. "two independent situations")
 * and splits them into labeled scenario blocks for per-scenario generation.
 */

export interface ScenarioBlock {
  label: string;
  text: string;
}

export interface ScenarioDetectionResult {
  is_multi_scenario: boolean;
  scenario_blocks: ScenarioBlock[];
  /** Original unsplit text if not multi-scenario */
  original_text: string;
}

// ── Detection patterns ──

const MULTI_SCENARIO_TRIGGERS = [
  /two\s+independent\s+(?:situations?|scenarios?|cases?)/i,
  /three\s+independent\s+(?:situations?|scenarios?|cases?)/i,
  /independent\s+scenarios?/i,
  /independent\s+situations?/i,
  /following\s+independent\s+(?:situations?|scenarios?|cases?)/i,
  /(?:case|situation|scenario)\s+(?:1|I|A)\s*(?:and|&)\s*(?:case|situation|scenario)\s+(?:2|II|B)/i,
  /unrelated\s+(?:situations?|scenarios?|transactions?)/i,
];

// ── Splitting patterns ──

// "Situation 1:", "Case A:", "Scenario 2:", etc.
const SCENARIO_HEADER = /^(?:(?:Situation|Case|Scenario)\s+(?:\d+|[A-Z]|[IVX]+))[\s:.\-–]+/im;
const SCENARIO_HEADER_GLOBAL = /(?:^|\n)(?:(?:Situation|Case|Scenario)\s+(?:\d+|[A-Z]|[IVX]+))[\s:.\-–]+/gi;

// Numbered patterns: "1.", "2.", "(1)", "(a)", etc. at the start of a significant block
const NUMBERED_BLOCK = /(?:^|\n)\s*(?:(\d+)\.|(\([a-z\d]\)))\s+/gi;

/**
 * Detect whether a problem text contains multiple independent scenarios
 * and split them into labeled blocks.
 */
export function detectAndSplitScenarios(problemText: string): ScenarioDetectionResult {
  if (!problemText?.trim()) {
    return { is_multi_scenario: false, scenario_blocks: [], original_text: problemText || "" };
  }

  const text = problemText.trim();

  // Step 1: Check if any trigger phrase exists
  const hasMultiTrigger = MULTI_SCENARIO_TRIGGERS.some(p => p.test(text));
  if (!hasMultiTrigger) {
    return { is_multi_scenario: false, scenario_blocks: [], original_text: text };
  }

  // Step 2: Try to split by explicit scenario headers
  const blocks = splitByHeaders(text);
  if (blocks.length >= 2) {
    return { is_multi_scenario: true, scenario_blocks: blocks, original_text: text };
  }

  // Step 3: Try to split by numbered paragraphs (1. ... 2. ...)
  const numberedBlocks = splitByNumberedBlocks(text);
  if (numberedBlocks.length >= 2) {
    return { is_multi_scenario: true, scenario_blocks: numberedBlocks, original_text: text };
  }

  // Step 4: Try paragraph-based splitting (double newline separated)
  const paraBlocks = splitByParagraphs(text);
  if (paraBlocks.length >= 2) {
    return { is_multi_scenario: true, scenario_blocks: paraBlocks, original_text: text };
  }

  // Trigger matched but couldn't split cleanly
  return { is_multi_scenario: false, scenario_blocks: [], original_text: text };
}

function splitByHeaders(text: string): ScenarioBlock[] {
  // Find all header positions
  const headers: { label: string; start: number; headerEnd: number }[] = [];
  const regex = /(?:^|\n)((?:Situation|Case|Scenario)\s+(?:\d+|[A-Z]|[IVX]+))[\s:.\-–]+/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    headers.push({
      label: match[1].trim(),
      start: match.index + (match[0].startsWith("\n") ? 1 : 0),
      headerEnd: match.index + match[0].length,
    });
  }

  if (headers.length < 2) return [];

  const blocks: ScenarioBlock[] = [];
  for (let i = 0; i < headers.length; i++) {
    const nextStart = i + 1 < headers.length ? headers[i + 1].start : text.length;
    const blockText = text.substring(headers[i].headerEnd, nextStart).trim();
    if (blockText) {
      blocks.push({ label: headers[i].label, text: blockText });
    }
  }
  return blocks;
}

function splitByNumberedBlocks(text: string): ScenarioBlock[] {
  // Split on "1. " "2. " etc. at line starts — only if we find ≥2
  const parts = text.split(/\n\s*(\d+)\.\s+/);
  if (parts.length < 3) return []; // Need at least: [preamble, "1", text1, "2", text2]

  const blocks: ScenarioBlock[] = [];
  // parts[0] is preamble (shared context), parts[1] is "1", parts[2] is text, etc.
  const preamble = parts[0].trim();
  for (let i = 1; i < parts.length; i += 2) {
    const num = parts[i];
    const blockText = (parts[i + 1] || "").trim();
    if (blockText) {
      // Prepend shared preamble context to each block
      const fullText = preamble ? `${preamble}\n\n${blockText}` : blockText;
      blocks.push({ label: `Situation ${num}`, text: fullText });
    }
  }
  return blocks.length >= 2 ? blocks : [];
}

function splitByParagraphs(text: string): ScenarioBlock[] {
  // Split on double newlines, assign labels
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 50);
  if (paragraphs.length < 2 || paragraphs.length > 5) return [];

  // Only split if each paragraph looks like a self-contained scenario (has numbers/amounts)
  const hasAmounts = paragraphs.every(p => /\$[\d,]+|\d{3,}/.test(p));
  if (!hasAmounts) return [];

  return paragraphs.map((p, i) => ({
    label: `Situation ${i + 1}`,
    text: p,
  }));
}

/**
 * Build scenario-aware prompt instruction block for AI generation.
 */
export function buildScenarioPromptBlock(blocks: ScenarioBlock[]): string {
  if (blocks.length === 0) return "";

  return `
MULTI-SCENARIO PROBLEM DETECTED (${blocks.length} independent scenarios):
This problem contains multiple independent scenarios that must be handled SEPARATELY.

CRITICAL RULES FOR MULTI-SCENARIO PROBLEMS:
- Generate SEPARATE journal entry sections for EACH scenario
- Label each JE section's entry_date with the scenario label prefix (e.g., "Situation 1 — Jan 1, 2025")
- Do NOT merge scenarios into a single journal entry blob
- Each scenario should include entries for: a) issuance, b) interest payment, c) accrual (if applicable)
- Keep scenario numbering consistent with the source problem

SCENARIO BLOCKS:
${blocks.map((b, i) => `--- ${b.label} ---\n${b.text}`).join("\n\n")}
`;
}
