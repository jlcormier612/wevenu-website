import type { FieldVisibility, InquiryFormQuestion, InquiryQuestionType } from "@/lib/inquiry-form/types";

export type { FieldVisibility, InquiryFormQuestion, InquiryQuestionType };

export type PublicFormStatus = "draft" | "published" | "archived";

/** Standard fields collected on a purpose-specific Public Form (subset of inquiry). */
export type PublicFormFieldKey =
  | "phone"
  | "event_type"
  | "preferred_event_date"
  | "guest_count";

export type PublicFormFieldConfig = Record<PublicFormFieldKey, FieldVisibility>;

export type PublicForm = {
  id: string;
  venueId: string;
  internalName: string;
  publicTitle: string;
  description: string;
  status: PublicFormStatus;
  publicKey: string;
  fieldConfig: PublicFormFieldConfig;
  createdAt: string;
  updatedAt: string;
  questions: InquiryFormQuestion[];
};

export type PublicFormListItem = Omit<PublicForm, "questions"> & {
  questionCount: number;
};

export type PublicFormVenueBrand = {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  neutralColor: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  stateRegion: string | null;
};

export type PublicFormPublicConfig = {
  form: {
    id: string;
    internalName: string;
    publicTitle: string;
    description: string;
    fieldConfig: PublicFormFieldConfig;
    publicKey: string;
  };
  venue: PublicFormVenueBrand;
  customQuestions: InquiryFormQuestion[];
};

export type PublicFormQuestionInput = {
  id?: string;
  questionText: string;
  questionType: InquiryQuestionType;
  required: boolean;
  options: string[];
};

export type CreatePublicFormInput = {
  internalName: string;
  publicTitle: string;
  description?: string;
  fieldConfig?: Partial<PublicFormFieldConfig>;
};

export type UpdatePublicFormInput = {
  internalName?: string;
  publicTitle?: string;
  description?: string;
  fieldConfig?: PublicFormFieldConfig;
  status?: PublicFormStatus;
};
