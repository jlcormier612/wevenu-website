import type { ClientChoicesStatus } from "@/lib/client-choices/constants";

export type SelectionMode = "single" | "multi";

export type ChoicesDefinitionSection = {
  id: string;
  name: string;
  guidance: string | null;
  sortOrder: number;
};

export type ChoicesDefinitionGroup = {
  id: string;
  sectionId: string | null;
  name: string;
  instructions: string | null;
  selectionMode: SelectionMode;
  minSelect: number;
  maxSelect: number | null;
  allowQuantity: boolean;
  sortOrder: number;
};

export type ChoicesDefinitionOption = {
  id: string;
  groupId: string;
  offeringId: string | null;
  label: string;
  description: string | null;
  isIncluded: boolean;
  /** Snapshotted at create/send. Null = unpriced / included. */
  unitPrice: number | null;
  sortOrder: number;
};

export type ChoicesDefinition = {
  sections: ChoicesDefinitionSection[];
  groups: ChoicesDefinitionGroup[];
  options: ChoicesDefinitionOption[];
};

/** Working / submitted answers keyed by group id. */
export type ChoicesGroupAnswer = {
  optionIds: string[];
  /** optionId → quantity when allowQuantity */
  quantities?: Record<string, number>;
  notes?: string;
};

export type ChoicesAnswers = Record<string, ChoicesGroupAnswer>;

export type ClientChoices = {
  id: string;
  venueId: string;
  eventId: string;
  clientId: string | null;
  templateId: string | null;
  name: string;
  status: ClientChoicesStatus;
  accessKey: string;
  definition: ChoicesDefinition;
  answers: ChoicesAnswers;
  sentAt: string | null;
  openedAt: string | null;
  submittedAt: string | null;
  changesRequestedAt: string | null;
  changesRequestedNote: string | null;
  finalizedAt: string | null;
  eventOrderId: string | null;
  appliedLineIds: string[];
  finalizedSubmissionNumber: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientChoicesSubmission = {
  id: string;
  venueId: string;
  clientChoicesId: string;
  eventId: string;
  submissionNumber: number;
  outcomeStatus: "submitted" | "resubmitted" | "finalized";
  snapshot: {
    definition: ChoicesDefinition;
    answers: ChoicesAnswers;
    name: string;
    appliedLineIds?: string[];
    financialDelta?: number;
  };
  submittedBy: "client" | "venue";
  createdAt: string;
};

export type ClientChoicesActivity = {
  id: string;
  venueId: string;
  clientChoicesId: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
};

export type ClientChoicesWithHistory = ClientChoices & {
  submissions: ClientChoicesSubmission[];
  activities: ClientChoicesActivity[];
};

export type ClientChoicesActionResult =
  | { ok: true }
  | { ok: false; message?: string; errors?: Record<string, string> };

export type CreateClientChoicesResult =
  | { ok: true; choicesId: string }
  | { ok: false; message?: string };

export type FinalizeClientChoicesResult =
  | {
      ok: true;
      eventOrderId: string;
      financialDelta: number;
      appliedLineIds: string[];
    }
  | { ok: false; message?: string };
