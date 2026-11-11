/**
 * Resolve which questionnaire family kind a planning task should send.
 * Seed "Complete your questionnaire" → client_planning (vision). Title/description
 * heuristics cover Final Details and Post-Event Feedback tasks without a second
 * parallel association system.
 */
import type { EventTask } from "@/lib/playbooks/types";
import type { QuestionnaireKind } from "@/lib/questionnaire-family/definitions";

export function isQuestionnaireLinkedTask(task: Pick<EventTask, "actionType" | "autoCompleteTrigger">): boolean {
  return task.actionType === "questionnaire" || task.autoCompleteTrigger === "questionnaire_submitted";
}

export function questionnaireKindForPlanningTask(
  task: Pick<EventTask, "title" | "description">,
): QuestionnaireKind {
  const hay = `${task.title} ${task.description ?? ""}`.toLowerCase();
  if (/\b(post[- ]?event|feedback|review)\b/.test(hay)) return "post_event_feedback";
  if (/\bfinal details?\b/.test(hay)) return "final_details";
  return "client_planning";
}
