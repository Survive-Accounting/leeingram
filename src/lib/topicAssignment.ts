/**
 * Deterministic topic assignment for LW items.
 * Uses topic_rules (regex patterns) and item-type fallback.
 */

export interface TopicRule {
  topic_name: string;
  pattern: string;
  priority: number;
  match_field: string;
}

export interface ChapterTopic {
  id: string;
  topic_name: string;
  display_order: number;
  is_active: boolean;
}

interface MatchContext {
  problem_text: string;
  problem_title: string;
  lw_question_text: string;
}

/**
 * Apply topic_rules against text fields and return the best-matching topic_id.
 * Returns { topicId, usedFallback }.
 */
export function assignTopicByRules(
  rules: TopicRule[],
  topics: ChapterTopic[],
  context: MatchContext,
  itemLabel: string // "Calc X" | "Calc Y" | "JE/Entry" | "Concept"
): { topicId: string | null; usedFallback: boolean } {
  // Sort rules by priority descending
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    const fieldValue = getFieldValue(context, rule.match_field);
    if (!fieldValue) continue;

    try {
      const regex = new RegExp(rule.pattern, "i");
      if (regex.test(fieldValue)) {
        const matchingTopic = topics.find(
          (t) => t.is_active && t.topic_name === rule.topic_name
        );
        if (matchingTopic) {
          return { topicId: matchingTopic.id, usedFallback: false };
        }
      }
    } catch {
      // Invalid regex pattern, skip
      continue;
    }
  }

  // Fallback: item-type based assignment
  return assignByItemType(topics, itemLabel);
}

function getFieldValue(context: MatchContext, field: string): string {
  switch (field) {
    case "problem_text":
      return context.problem_text;
    case "problem_title":
      return context.problem_title;
    case "lw_question_text":
      return context.lw_question_text;
    default:
      return context.problem_text;
  }
}

function assignByItemType(
  topics: ChapterTopic[],
  itemLabel: string
): { topicId: string | null; usedFallback: boolean } {
  const activeTopics = topics.filter((t) => t.is_active);
  if (activeTopics.length === 0) return { topicId: null, usedFallback: true };

  const first = activeTopics.sort((a, b) => a.display_order - b.display_order)[0];

  if (itemLabel === "JE/Entry") {
    const jeTopic = activeTopics.find(
      (t) =>
        t.topic_name.toLowerCase().includes("journal") ||
        t.topic_name.toLowerCase().includes("entries") ||
        t.topic_name.toLowerCase().includes("entry")
    );
    return {
      topicId: jeTopic?.id ?? first.id,
      usedFallback: !jeTopic,
    };
  }

  // CX1, CY1, C1 all go to first topic as fallback
  return { topicId: first.id, usedFallback: true };
}
