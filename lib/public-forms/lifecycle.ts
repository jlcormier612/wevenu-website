/**
 * Wave 2 — operational Public Form lifecycle helpers.
 * Pure. No DB. Preview/public availability is derived from status only.
 */

import type { PublicForm, PublicFormQuestionInput, PublicFormStatus } from "@/lib/public-forms/types";

export function isPublicFormLive(status: PublicFormStatus): boolean {
  return status === "published";
}

export function publicFormUnavailableCopy(status: PublicFormStatus | null): {
  title: string;
  body: string;
} {
  if (status === "archived") {
    return {
      title: "This form is no longer available",
      body: "This form is archived and is not accepting new responses. Please contact the venue directly if you still need to get in touch.",
    };
  }
  if (status === "draft") {
    return {
      title: "This form is not available",
      body: "This form is not open for submissions yet. Please contact the venue directly, or check back later.",
    };
  }
  return {
    title: "This form is not available",
    body: "Please contact the venue directly, or check for an updated link.",
  };
}

export function nextDuplicateInternalName(name: string): string {
  const base = name.trim() || "Untitled form";
  return `${base} (copy)`;
}

export type DuplicatedPublicFormDraft = {
  internalName: string;
  publicTitle: string;
  description: string;
  fieldConfig: PublicForm["fieldConfig"];
  questions: PublicFormQuestionInput[];
  status: "draft";
};

/** Copy configuration only — never submissions, leads, QR, or the public key. */
export function projectDuplicatedPublicForm(source: PublicForm): DuplicatedPublicFormDraft {
  return {
    internalName: nextDuplicateInternalName(source.internalName),
    publicTitle: source.publicTitle,
    description: source.description,
    fieldConfig: { ...source.fieldConfig },
    status: "draft",
    questions: source.questions.map((q) => ({
      questionText: q.questionText,
      questionType: q.questionType,
      required: q.required,
      options: [...q.options],
    })),
  };
}

export function formLeadAttributionFilter(formId: string): { public_form_id: string } {
  return { public_form_id: formId };
}
