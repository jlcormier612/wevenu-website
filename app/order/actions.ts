"use server";

import type { ChoicesAnswers } from "@/lib/client-choices/types";
import {
  approveEventOrderDocument,
  saveEventOrderDocumentAnswers,
  type CoupleDocumentResult,
} from "@/lib/event-orders/couple-document";

export async function saveEventOrderDocumentAnswersAction(
  token: string,
  choicesId: string,
  answers: ChoicesAnswers,
): Promise<CoupleDocumentResult> {
  return saveEventOrderDocumentAnswers(token, choicesId, answers);
}

export async function approveEventOrderDocumentAction(
  token: string,
  answers: ChoicesAnswers | null,
): Promise<CoupleDocumentResult> {
  return approveEventOrderDocument(token, answers);
}
