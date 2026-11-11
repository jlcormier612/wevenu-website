"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  acceptClientInvitation, acceptParticipantInvitation,
  signInClient, getMyPortalUrl,
} from "@/lib/client-auth/service";
import { createClientPortalAuthClient } from "@/integrations/supabase/server";
import { clientRequestMeta, recordCouplePortalLegalAcceptances } from "@/lib/legal/service";
import {
  parseLegalAcceptedFromFormData,
  requireSignupLegalAccepted,
} from "@/lib/legal/signup-consent";


export type ClientAuthFormState = { error?: string };

function validatePassword(password: string, confirm: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password !== confirm) return "Passwords do not match.";
  return null;
}

async function recordCoupleSignupLegal(input: {
  email: string;
  clientId: string;
}): Promise<void> {
  try {
    const supabase = await createClientPortalAuthClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const hdrs = await headers();
    const meta = clientRequestMeta(hdrs);
    await recordCouplePortalLegalAcceptances({
      userId: user?.id ?? null,
      email: input.email,
      relationshipId: input.clientId,
      acceptanceMethod: "Couple Invitation",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  } catch (error) {
    // Account already exists; Welcome Experience gate remains the fail-closed
    // unlock if this append fails (missing active docs / transient DB).
    console.error("[client/accept] legal acceptance record failed", error);
  }
}

export async function acceptClientInvitationAction(
  _prevState: ClientAuthFormState, formData: FormData,
): Promise<ClientAuthFormState> {
  const token = String(formData.get("token") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  const legalGate = requireSignupLegalAccepted(
    "couple",
    parseLegalAcceptedFromFormData(formData),
  );
  if (!legalGate.ok) return { error: legalGate.error };

  const passwordError = validatePassword(password, confirm);
  if (passwordError) return { error: passwordError };

  const result = await acceptClientInvitation(token, email, password, {
    legalAccepted: true,
  });
  if (!result.ok) return { error: result.error };

  await recordCoupleSignupLegal({ email, clientId: result.clientId });

  redirect(`/p/${result.accessToken}`);
}

export async function acceptParticipantInvitationAction(
  _prevState: ClientAuthFormState, formData: FormData,
): Promise<ClientAuthFormState> {
  const token = String(formData.get("token") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  const legalGate = requireSignupLegalAccepted(
    "couple",
    parseLegalAcceptedFromFormData(formData),
  );
  if (!legalGate.ok) return { error: legalGate.error };

  const passwordError = validatePassword(password, confirm);
  if (passwordError) return { error: passwordError };

  const result = await acceptParticipantInvitation(token, email, password, {
    legalAccepted: true,
  });
  if (!result.ok) return { error: result.error };

  await recordCoupleSignupLegal({ email, clientId: result.clientId });

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
