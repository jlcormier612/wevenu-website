import type { InquiryFormQuestion, InquiryQuestionType } from "@/lib/inquiry-form/types";

/** Swap a question one step up (-1) or down (+1). No-op at list ends. */
export function moveQuestionInList<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const next = index + direction;
  if (index < 0 || index >= list.length || next < 0 || next >= list.length) {
    return list;
  }
  const copy = [...list];
  const a = copy[index]!;
  const b = copy[next]!;
  copy[index] = b;
  copy[next] = a;
  return copy;
}

export type PersistableInquiryQuestion = {
  questionText: string;
  questionType: InquiryQuestionType;
  required: boolean;
  options: string[];
};

/**
 * Maps the builder question list to DB insert rows.
 * Array index is the persisted sort_order (public form loads ORDER BY sort_order).
 * Intentionally does not write question ids — historical lead answers are stored as
 * source_data snapshots with questionText, so active-form row churn does not cascade.
 */
export function buildInquiryFormQuestionInsertRows(
  venueId: string,
  questions: PersistableInquiryQuestion[],
): Array<{
  venue_id: string;
  question_text: string;
  question_type: InquiryQuestionType;
  required: boolean;
  options: string[] | null;
  sort_order: number;
}> {
  return questions.map((q, i) => ({
    venue_id: venueId,
    question_text: q.questionText.trim(),
    question_type: q.questionType,
    required: q.required,
    options: q.options.length ? q.options : null,
    sort_order: i,
  }));
}

/** Sort public/settings questions the same way the DB/RPC does. */
export function orderCustomQuestionsBySort(
  questions: InquiryFormQuestion[],
): InquiryFormQuestion[] {
  return [...questions].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Historical custom answers remain readable from the lead snapshot alone.
 * Deleting a live form question must not require the question row to still exist.
 */
export function historicalCustomAnswersRemainReadable(
  answers: Array<{ questionId?: string; questionText?: string; answer?: string | string[] }>,
  liveQuestionIds: ReadonlySet<string>,
): boolean {
  if (answers.length === 0) return true;
  return answers.every((entry) => {
    const hasLabel = typeof entry.questionText === "string" && entry.questionText.trim().length > 0;
    const hasAnswer =
      typeof entry.answer === "string"
        ? entry.answer.length > 0
        : Array.isArray(entry.answer) && entry.answer.length > 0;
    // Readability must not depend on the question still being on the live form.
    const idStillLive = entry.questionId ? liveQuestionIds.has(entry.questionId) : false;
    return hasLabel && hasAnswer && (idStillLive || hasLabel);
  });
}
