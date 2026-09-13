/**
 * Maps Platform Events → Automation (message_sequences) trigger types.
 *
 * Sales triggers (lead_created / lead_stage_changed / tour_completed) continue
 * to enroll at their domain call sites. Client relationship triggers enroll
 * through the platform-event processor so SQL and TS emitters share one path.
 *
 * Anniversary / relationship follow-up is intentionally absent: there is no
 * trustworthy venue-side domain event today (portal anniversary observations
 * are couple-facing only). Do not invent a cron workaround here.
 */
import type { SequenceTriggerType } from "@/lib/message-sequences/types";

export type AutomationAudience = "sales" | "client" | "manual";

export const PLATFORM_EVENT_TO_SEQUENCE_TRIGGER: Record<string, SequenceTriggerType> = {
  "Contract.Signed": "contract_signed",
  "Payment.Received": "payment_received",
  "Questionnaire.Submitted": "questionnaire_submitted",
  "GuestCount.Submitted": "guest_count_submitted",
  "Event.Completed": "event_completed",
};

export const CLIENT_SEQUENCE_TRIGGERS: readonly SequenceTriggerType[] = [
  "contract_signed",
  "payment_received",
  "questionnaire_submitted",
  "guest_count_submitted",
  "event_completed",
];

export const SALES_SEQUENCE_TRIGGERS: readonly SequenceTriggerType[] = [
  "lead_created",
  "lead_stage_changed",
  "tour_completed",
];

export function sequenceTriggerForPlatformEvent(eventType: string): SequenceTriggerType | null {
  return PLATFORM_EVENT_TO_SEQUENCE_TRIGGER[eventType] ?? null;
}

export function audienceForTrigger(triggerType: SequenceTriggerType | null): AutomationAudience {
  if (!triggerType) return "manual";
  if ((CLIENT_SEQUENCE_TRIGGERS as readonly string[]).includes(triggerType)) return "client";
  if ((SALES_SEQUENCE_TRIGGERS as readonly string[]).includes(triggerType)) return "sales";
  return "manual";
}

export function isSupportedAutomationPlatformEvent(eventType: string): boolean {
  return eventType in PLATFORM_EVENT_TO_SEQUENCE_TRIGGER;
}
