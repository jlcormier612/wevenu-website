import { effectivePublicCommunicationSettings, type InquiryCommunicationSettings } from "@/lib/communication/sms-consent";
import { filterValidAcceptedEventTypes } from "@/lib/event-types/canonical";
import type {
  InquiryEventDateMode,
  InquiryFormFieldsConfig,
  InquiryFormQuestion,
  PublicInquiryFormConfig,
} from "@/lib/inquiry-form/types";

/** Current builder draft — may include unsaved changes. */
export type InquiryFormBuilderDraft = {
  inquiryEventDateMode: InquiryEventDateMode;
  inquiryFormFields: InquiryFormFieldsConfig;
  acceptedEventTypes: string[];
  customQuestions: InquiryFormQuestion[];
  inquiryCommunicationSettings: InquiryCommunicationSettings;
};

/**
 * Overlay builder draft onto the saved public form shell (venue brand, tour flags).
 * Preview must never invent analytics or mutate the persisted Direct Link config.
 */
export function applyInquiryFormDraftToPublicConfig(
  base: PublicInquiryFormConfig,
  draft: InquiryFormBuilderDraft,
): PublicInquiryFormConfig {
  const accepted = filterValidAcceptedEventTypes(draft.acceptedEventTypes);
  return {
    ...base,
    inquiryEventDateMode: draft.inquiryEventDateMode,
    inquiryFormFields: { ...draft.inquiryFormFields },
    acceptedEventTypes: accepted.length > 0 ? accepted : [...base.acceptedEventTypes],
    customQuestions: draft.customQuestions.map((q, i) => ({
      ...q,
      sortOrder: typeof q.sortOrder === "number" ? q.sortOrder : i,
    })),
    inquiryCommunicationSettings: effectivePublicCommunicationSettings(draft.inquiryCommunicationSettings),
    // Preview must not initialize GA4 or imply a real inquiry surface.
    ga4MeasurementId: null,
  };
}

export const INQUIRY_FORM_PREVIEW_BANNER =
  "This is a preview. Form submissions are disabled.";
