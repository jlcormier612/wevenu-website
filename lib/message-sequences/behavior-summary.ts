/**
 * Human-readable "What will happen?" preview from an Automation config.
 * Pure — no DB. Venue-facing language only (no engine jargon).
 */
import { SEQUENCE_TRIGGER_TYPES } from "@/lib/message-sequences/constants";
import { salesStageLabel } from "@/lib/leads/sales-stages";
import type { MessageSequenceInput, SequenceStepInput } from "@/lib/message-sequences/types";

export type AutomationBehaviorSummary = {
  /** Short paragraph suitable for a preview panel. */
  paragraph: string;
  /** Structured lines for progressive disclosure. */
  lines: {
    starts: string;
    steps: string[];
    stops: string;
  };
};

function timingPhrase(offsetDays: number, isFirst: boolean): string {
  if (offsetDays === 0) {
    return isFirst ? "immediately" : "right after the previous message";
  }
  if (offsetDays === 1) {
    return isFirst ? "1 day after they join" : "1 day after the previous message";
  }
  return isFirst
    ? `${offsetDays} days after they join`
    : `${offsetDays} days after the previous message`;
}

function channelWord(channel: SequenceStepInput["channel"]): string {
  return channel === "sms" ? "SMS" : "email";
}

function startsWhen(input: MessageSequenceInput): string {
  if (!input.triggerType) {
    return "Only when you add someone yourself";
  }
  const type = SEQUENCE_TRIGGER_TYPES.find((t) => t.value === input.triggerType);
  if (input.triggerType === "lead_stage_changed") {
    const stage = input.triggerStage ? salesStageLabel(input.triggerStage) : "a pipeline stage";
    return `When a lead reaches ${stage}`;
  }
  return type?.label ?? "When the starting condition happens";
}

function stepLine(step: SequenceStepInput, index: number): string {
  const when = timingPhrase(step.offsetDays, index === 0);
  return `Send an ${channelWord(step.channel)} ${when}`;
}

function stepsNarrative(steps: SequenceStepInput[]): string {
  if (steps.length === 0) return "No messages are configured yet.";
  if (steps.length === 1) {
    const s = steps[0];
    return `we'll send one ${channelWord(s.channel)} ${timingPhrase(s.offsetDays, true)}`;
  }
  const parts = steps.map((s, i) => {
    if (i === 0) return `send the first ${channelWord(s.channel)} ${timingPhrase(s.offsetDays, true)}`;
    if (i === steps.length - 1) {
      return `then send a final ${channelWord(s.channel)} ${timingPhrase(s.offsetDays, false)}`;
    }
    return `then send another ${channelWord(s.channel)} ${timingPhrase(s.offsetDays, false)}`;
  });
  return `we'll ${parts.join(", ")}`;
}

/** Shared stop copy — matches engine exits (booked / lost / reply / manual stop / finished). */
export const AUTOMATION_STOPS_SUMMARY =
  "It stops for someone when they book, are marked Lost, reply to a message, finish every step, or you stop them.";

/**
 * Build a preview that reflects the actual configured automation.
 */
export function buildAutomationBehaviorSummary(input: MessageSequenceInput): AutomationBehaviorSummary {
  const starts = startsWhen(input);
  const stepLines = input.steps.map((s, i) => stepLine(s, i));
  const stops = AUTOMATION_STOPS_SUMMARY;

  let paragraph: string;
  if (input.steps.length === 0) {
    paragraph = `${starts}. Add at least one message step to see what will happen. ${stops}`;
  } else if (!input.triggerType) {
    paragraph = `When you add someone, ${stepsNarrative(input.steps)}. ${stops}`;
  } else {
    paragraph = `${starts}, ${stepsNarrative(input.steps)}. ${stops}`;
  }

  return {
    paragraph,
    lines: { starts, steps: stepLines, stops },
  };
}
