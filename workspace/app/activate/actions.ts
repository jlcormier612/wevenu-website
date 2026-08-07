"use server";

import { redirect } from "next/navigation";

import { recordOwnerActivationCredential } from "@shared/product-sync";
import { completeAccountActivation } from "@shared/relationships";

import { completeVenueActivateLegalViaProduct } from "@/lib/legal/product-legal";
import { hashPassword } from "@/lib/program4/password";

function productLoginUrl(): string {
  const base = (
    process.env.NEXT_PUBLIC_PRODUCT_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${base}/login`;
}

export async function activateAccountAction(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const token = String(formData.get("token") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  const relationshipId = String(formData.get("relationshipId") || "").trim();
  const legalAccepted =
    String(formData.get("legalAccepted") || "").toLowerCase() === "true";

  if (!token) {
    return { error: "This activation link is invalid or has already been used." };
  }
  if (!legalAccepted) {
    return {
      error: "Please agree to the Terms of Service and Privacy Policy to continue.",
    };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

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

  const result = await completeAccountActivation({ token });
  if (!result.ok) {
    return { error: result.message };
  }

  // Simulated product sync: persist password hash locally so the enroll →
  // activate loop is testable without a real product Auth user.
  try {
    await recordOwnerActivationCredential({
      relationshipId: result.relationship.id,
      email: result.relationship.owner.email,
      passwordHash: hashPassword(password),
      ownerAccountId: result.relationship.productSync?.ownerAccountId,
    });
  } catch (error) {
    console.error("[activate] failed to record local owner credential", error);
    // Relationship is already marked activated — still send them to login.
  }

  redirect(`${productLoginUrl()}?activated=1`);
}
