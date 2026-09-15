/**
 * Hello to Cheers protected Automation masters.
 *
 * System-owned definitions — never stored as editable venue rows.
 * New venues receive independent copies via provisionStarterAutomations.
 * Venue edits never write back here.
 *
 * New opt-in starters (SEQ-02 / SEQ-03) provision paused so a venue must
 * turn them on after reviewing the message — safe default.
 */
import type { SequenceTriggerType } from "@/lib/message-sequences/types";
import type { ScheduledMessageChannel } from "@/lib/scheduled-messages/types";
import type { StarterMessageMasterKey } from "@/lib/message-templates/starters";

export type StarterSequenceMasterKey = "SEQ-01" | "SEQ-02" | "SEQ-03" | "SEQ-04";

export type StarterSequenceStepMaster = {
  /** Resolves to the venue's provisioned message template copy. */
  templateMasterKey: StarterMessageMasterKey;
  channel: ScheduledMessageChannel;
  offsetDays: number;
};

export type StarterSequenceMaster = {
  key: StarterSequenceMasterKey;
  name: string;
  triggerType: SequenceTriggerType;
  triggerStage: string | null;
  /** active = enroll immediately when trigger fires; paused = venue must resume first. */
  initialStatus: "active" | "paused";
  steps: StarterSequenceStepMaster[];
};

/**
 * SEQ-01 New Inquiry Welcome — immediate welcome + gentle follow-up.
 * Both steps resolve to MSG-01 until the venue customizes step 2.
 *
 * SEQ-02 Tour Follow-Up — after a completed tour (MSG-04), next morning.
 *
 * SEQ-03 Proposal Follow-Up — when a lead reaches Proposal Sent (MSG-05).
 *
 * SEQ-04 Post-Event Thank You — when an event is marked complete (MSG-11).
 * Paused by default so venues review the message before enabling.
 *
 * No starters for contract signed / payment received / questionnaire /
 * guest count — those triggers are supported, but no matching starter
 * message template exists yet (do not invent incomplete copy).
 *
 * Anniversary / relationship follow-up has no trustworthy domain event yet.
 */
export const STARTER_SEQUENCE_MASTERS: readonly StarterSequenceMaster[] = [
  {
    key: "SEQ-01",
    name: "New Inquiry Welcome",
    triggerType: "lead_created",
    triggerStage: null,
    initialStatus: "active",
    steps: [
      { templateMasterKey: "MSG-01", channel: "email", offsetDays: 0 },
      { templateMasterKey: "MSG-01", channel: "email", offsetDays: 3 },
    ],
  },
  {
    key: "SEQ-02",
    name: "Tour Follow-Up",
    triggerType: "tour_completed",
    triggerStage: null,
    initialStatus: "paused",
    steps: [
      { templateMasterKey: "MSG-04", channel: "email", offsetDays: 1 },
    ],
  },
  {
    key: "SEQ-03",
    name: "Proposal Follow-Up",
    triggerType: "lead_stage_changed",
    triggerStage: "proposal_sent",
    initialStatus: "paused",
    steps: [
      { templateMasterKey: "MSG-05", channel: "email", offsetDays: 3 },
    ],
  },
  {
    key: "SEQ-04",
    name: "Post-Event Thank You",
    triggerType: "event_completed",
    triggerStage: null,
    initialStatus: "paused",
    steps: [
      { templateMasterKey: "MSG-11", channel: "email", offsetDays: 3 },
    ],
  },
];

export function getStarterSequenceMaster(key: string): StarterSequenceMaster | undefined {
  return STARTER_SEQUENCE_MASTERS.find((m) => m.key === key);
}
