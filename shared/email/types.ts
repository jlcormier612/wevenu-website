/**
 * Shared product email types — Hello to Cheers Relationship Workspace.
 */

export const EMAIL_TEMPLATE_IDS = [
  "welcome",
  "founder_welcome",
  "welcome_back",
  "welcome_back_verified",
  "welcome_back_rejected",
  "kickoff",
  "payment_receipt",
  "white_glove_scheduling",
  "trial_reminder",
  "renewal_reminder",
  "luv_suggestion",
] as const;

export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

/** Templates that are fully rendered and wired to at least one send path. */
export type EmailTemplateStatus = "live" | "registry";

export type EmailTemplateVars = Record<string, string | number | boolean | null | undefined>;

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
  /** Short preview for timeline / ops logs */
  preview: string;
  /** Human title for the Relationship timeline event */
  timelineTitle: string;
};

export type EmailTemplateDefinition = {
  id: EmailTemplateId;
  name: string;
  description: string;
  status: EmailTemplateStatus;
  render: (vars: EmailTemplateVars) => RenderedEmail;
};

export type SendDeliveryStatus = "sent" | "simulated" | "failed";

export type RawSendResult =
  | {
      ok: true;
      delivery: "sent" | "simulated";
      providerId?: string;
    }
  | {
      ok: false;
      delivery: "failed";
      message: string;
    };

export type RelationshipEmailResult = {
  ok: boolean;
  delivery: SendDeliveryStatus;
  templateId: EmailTemplateId | "custom";
  subject: string;
  preview: string;
  providerId?: string;
  message?: string;
  timelineEventId?: string;
  communicationId?: string;
};
