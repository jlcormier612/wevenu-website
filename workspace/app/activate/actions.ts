"use server";

import { redirect } from "next/navigation";

import { productPostActivationLoginUrl } from "@shared/email";
import { activateVenueAccount } from "@shared/product-account";
import { completeAccountActivation } from "@shared/relationships";

import { completeVenueActivateLegalViaProduct } from "@/lib/legal/product-legal";
import { gateActivateAccountSubmission } from "@/lib/program4/activate-account-form";

export async function activateAccountAction(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const gated = gateActivateAccountSubmission(formData);
  if (!gated.ok) {
    return { error: gated.error };
  }
  const { token, email, password, relationshipId } = gated;

  // Record legal acceptances immediately before completing CRM account activation.
  if (email) {
    const legal = await completeVenueActivateLegalViaProduct({
      email,
      relationshipId: relationshipId || null,
      legalAccepted: true,
    });
    if (!legal.ok) {
      return { error: legal.message };
    }
  }

  // Real account first: creates/finds the auth.users row, sets the real
  // password, and creates the venues row (see
  // docs/postgres-auth-architecture-findings.md §6). Runs before the local
  // Relationship is marked activated below, so a failure here leaves both
  // sides consistently "not yet activated" and safely retryable — the
  // activation token is only consumed on real success.
  const bridged = await activateVenueAccount({ token, password });
  if (!bridged.ok) {
    console.error("[activate] product account bridge failed", bridged.error);
    return { error: "We couldn't set up your account just now. Please try again in a moment." };
  }

  // Real account already exists at this point — a failure here (including
  // a thrown error, e.g. the local file store's directory not being
  // writable in this container) is not a reason to block the owner from
  // signing in; the local Relationship record is a CRM/sales-ops concern,
  // not the auth boundary. Must not throw past this point.
  try {
    const result = await completeAccountActivation({ token });
    if (!result.ok) {
      console.error("[activate] local relationship activation failed after real account succeeded", result.message);
    }
  } catch (error) {
    console.error("[activate] local relationship activation threw after real account succeeded", error);
  }

  redirect(productPostActivationLoginUrl());
}
