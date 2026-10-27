import { createId } from "../domain/fixtures";
import type { Goal, LessonStep, Reflection, Story } from "../domain/types";
import type { GoalSuggestion, ReflectionDraft, StepSuggestion, StoryDraft } from "./contracts";

export function goalFromSuggestion(suggestion: GoalSuggestion): Goal {
  return {
    id: createId("goal"),
    text: suggestion.text,
    source: "mock-ai",
  };
}

export function stepFromSuggestion(suggestion: StepSuggestion): LessonStep {
  return {
    id: createId("step"),
    templateKey: suggestion.templateKey,
    title: suggestion.title,
    teacherInstruction: suggestion.teacherInstruction,
    interaction: suggestion.interaction,
    note: suggestion.note,
    status: "draft",
    source: "mock-ai",
  };
}

export function storyFromDraft(draft: StoryDraft): Story {
  return {
    ...draft,
    status: "draft",
    basedOnPlanRevision: 0,
  };
}

export function reflectionFromDraft(
  draft: ReflectionDraft,
  sessionId: string,
): Reflection {
  return {
    id: createId("reflection"),
    sessionId,
    ...draft,
    status: "draft",
    updatedAt: new Date().toISOString(),
  };
}
