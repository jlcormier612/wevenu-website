export type InquiryMode = "request_information" | "schedule_tour";

export type InquiryEventDateMode = "choose_available" | "request_preferred";

export type FieldVisibility = "required" | "optional" | "hidden";

export type StandardFieldKey =
  | "phone"
  | "partner"
  | "guest_count"
  | "estimated_budget"
  | "preferred_event_date"
  | "event_details";

export type InquiryFormFieldsConfig = Record<StandardFieldKey, FieldVisibility>;

export type InquiryQuestionType =
  | "short_answer"
  | "long_answer"
  | "single_select"
  | "multiple_select";

export type InquiryFormQuestion = {
  id: string;
  questionText: string;
  questionType: InquiryQuestionType;
  required: boolean;
  options: string[];
  sortOrder: number;
};

export type PublicInquiryVenue = {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  stateRegion: string | null;
};

export type PublicInquiryFormConfig = {
  venue: PublicInquiryVenue;
  tourSchedulingEnabled: boolean;
  tourEmbedKey: string | null;
  inquiryEventDateMode: InquiryEventDateMode;
  inquiryFormFields: InquiryFormFieldsConfig;
  /** Subset of PUBLIC_INQUIRY_EVENT_TYPES this venue accepts. Never empty. */
  acceptedEventTypes: string[];
  customQuestions: InquiryFormQuestion[];
  /**
   * Optional per-venue GA4 Measurement ID (Phase 2C). Null = analytics no-op.
   * Never an HTC marketing property ID.
   */
  ga4MeasurementId: string | null;
};

export type InquiryFormSettings = {
  inquiryEventDateMode: InquiryEventDateMode;
  inquiryFormFields: InquiryFormFieldsConfig;
  /** Subset of PUBLIC_INQUIRY_EVENT_TYPES this venue accepts. Never empty. */
  acceptedEventTypes: string[];
  customQuestions: InquiryFormQuestion[];
};

export type TourBookingConfirmation = {
  scheduledAt: string;
  duration: number;
  email: string;
  venueName: string;
  venuePhone: string | null;
  addressLine1: string | null;
  city: string | null;
  stateRegion: string | null;
};
