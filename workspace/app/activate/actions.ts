"use server";

import { redirect } from "next/navigation";

import { recordOwnerActivationCredential } from "@shared/product-sync";
import { completeAccountActivation } from "@shared/relationships";

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
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (!token) {
    return { error: "This activation link is invalid or has already been used." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
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
