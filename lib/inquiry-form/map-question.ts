import type { InquiryFormQuestion, InquiryQuestionType } from "@/lib/inquiry-form/types";

/**
 * DB selects use snake_case; get_public_inquiry_form RPC returns camelCase.
 * Accept either so public form labels/order are not blanked.
 */
export type InquiryQuestionRowLike = {
  id: string;
  question_text?: string;
  questionText?: string;
  question_type?: InquiryQuestionType;
  questionType?: InquiryQuestionType;
  required?: boolean;
  options?: string[] | null;
  sort_order?: number;
  sortOrder?: number;
};

export function mapInquiryFormQuestion(row: InquiryQuestionRowLike): InquiryFormQuestion {
  const questionType = row.questionType ?? row.question_type ?? "short_answer";
  return {
    id: row.id,
    questionText: String(row.questionText ?? row.question_text ?? "").trim(),
    questionType,
    required: row.required === true,
    options: Array.isArray(row.options) ? row.options : [],
    sortOrder:
      typeof row.sortOrder === "number"
        ? row.sortOrder
        : typeof row.sort_order === "number"
          ? row.sort_order
          : 0,
  };
}
