"use server";

import { redirect } from "next/navigation";

import {
  acceptClientInvitation, acceptParticipantInvitation,
  signInClient, getMyPortalUrl,
} from "@/lib/client-auth/service";

export type ClientAuthFormState = { error?: string };

const INITIAL_STATE: ClientAuthFormState = {};
export { INITIAL_STATE as CLIENT_AUTH_INITIAL_STATE };

function validatePassword(password: string, confirm: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password !== confirm) return "Passwords do not match.";
  return null;
}

export async function acceptClientInvitationAction(
  _prevState: ClientAuthFormState, formData: FormData,
): Promise<ClientAuthFormState> {
  const token = String(formData.get("token") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  const passwordError = validatePassword(password, confirm);
  if (passwordError) return { error: passwordError };

  const result = await acceptClientInvitation(token, email, password);
  if (!result.ok) return { error: result.error };

  redirect(`/p/${result.accessToken}`);
}

export async function acceptParticipantInvitationAction(
  _prevState: ClientAuthFormState, formData: FormData,
): Promise<ClientAuthFormState> {
  const token = String(formData.get("token") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  const passwordError = validatePassword(password, confirm);
  if (passwordError) return { error: passwordError };

  const result = await acceptParticipantInvitation(token, email, password);
  if (!result.ok) return { error: result.error };

  redirect(`/p/${result.accessToken}`);
}

export async function signInClientAction(
  _prevState: ClientAuthFormState, formData: FormData,
): Promise<ClientAuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const result = await signInClient(email, password);
  if (!result.ok) return { error: result.error };

  const url = await getMyPortalUrl();
  if (!url) return { error: "No planning workspace is linked to this account." };

  redirect(url);
}
