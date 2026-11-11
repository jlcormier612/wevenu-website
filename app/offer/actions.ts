"use server";

import {
  acceptOfferByToken,
  approveOfferChoicesByToken,
  selectOfferChoicesByToken,
} from "@/lib/booking-journey/offer";
import type { ClientChoiceInput } from "@/lib/commercial-proposals/types";

export async function acceptOfferAction(
  token: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await acceptOfferByToken(token);
  if (!result.ok) return result;
  return { ok: true };
}

export async function selectOfferChoicesAction(
  token: string,
  choices: ClientChoiceInput[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  return selectOfferChoicesByToken(token, choices);
}

export async function approveOfferChoicesAction(
  token: string,
  choices: ClientChoiceInput[],
): Promise<
  | { ok: true; selectionId?: string; alreadyApproved?: boolean }
  | { ok: false; message: string }
> {
  return approveOfferChoicesByToken(token, choices);
}
