/**
 * Hello to Cheers protected Automation (sequence) masters.
 *
 * System-owned definitions — never stored as editable venue rows.
 * New venues receive independent copies via provisionStarterAutomations.
 * Venue edits never write back here.
 *
 * Tour Follow-Up starter remains deferred (trigger exists; starter not provisioned in P1).
 */

import type { SequenceTriggerType } from "@/lib/message-sequences/types";
import type { ScheduledMessageChannel } from "@/lib/scheduled-messages/types";
import type { StarterMessageMasterKey } from "@/lib/message-templates/starters";

export type StarterSequenceMasterKey = "SEQ-01";

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
  steps: StarterSequenceStepMaster[];
};

/**
 * New Inquiry Welcome — immediate welcome + gentle follow-up a few days later.
 * Both steps resolve to MSG-01 (the only inquiry starter master) until the
 * venue customizes step 2. Trigger: lead_created only.
 * Tour Follow-Up starter is deferred (Tour Completed trigger exists; starter not in P1).
 */
export const STARTER_SEQUENCE_MASTERS: readonly StarterSequenceMaster[] = [
  {
    key: "SEQ-01",
    name: "New Inquiry Welcome",
    triggerType: "lead_created",
    triggerStage: null,
    steps: [
      { templateMasterKey: "MSG-01", channel: "email", offsetDays: 0 },
      { templateMasterKey: "MSG-01", channel: "email", offsetDays: 3 },
    ],
  },
];

export function getStarterSequenceMaster(key: string): StarterSequenceMaster | undefined {
  return STARTER_SEQUENCE_MASTERS.find((m) => m.key === key);
}
