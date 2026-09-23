"use server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { createClientPortalAuthClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  changeMyPassword, getMyAuthSessions, revokeMyAuthSession,
  getMySupportGrants, grantSupportAccess, revokeSupportGrant,
} from "@/lib/client-auth/service";
import type { AuthSessionInfo, ClientAuthResult, SupportAccessGrant } from "@/lib/client-auth/types";
import {
  normalizeSmsAddressKey,
  type CommunicationPermissionStatus,
} from "@/lib/communication/permissions";
import { smsPermissionDisplayLabel } from "@/lib/communication/sms-consent";
import { listLegalAcceptancesForCurrentUser } from "@/lib/legal/service";
import type { LegalAcceptanceHistoryItem } from "@/lib/legal/types";
import { resolvePortalContext } from "@/lib/portal/service";

export type AccountState = {
  loggedIn: boolean;
  sessions: AuthSessionInfo[];
  grants: SupportAccessGrant[];
  legalHistory: LegalAcceptanceHistoryItem[];
};

/** Read-only portal view of the canonical SMS permission (same SoT as staff). */
export type PortalSmsPermissionView = {
  hasPhone: boolean;
  status: CommunicationPermissionStatus;
  label: string;
  detail: string;
};

export async function getPortalSmsPermissionAction(
  token: string,
): Promise<PortalSmsPermissionView | null> {
  if (!isSupabaseConfigured || !token.trim()) return null;
  const ctx = await resolvePortalContext(token.trim());
  if (!ctx?.venue?.id || !ctx.client?.id) return null;

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("phone")
    .eq("id", ctx.client.id)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle<{ phone: string | null }>();

  const phone = client?.phone?.trim() ?? "";
  if (!phone) {
    return {
      hasPhone: false,
      status: "not_opted_in",
      label: "Not opted in",
      detail: "No mobile number is on file for text messages.",
    };
  }

  const addressKey = normalizeSmsAddressKey(phone);
  if (!addressKey) {
    return {
      hasPhone: false,
      status: "not_opted_in",
      label: "Not opted in",
      detail: "No mobile number is on file for text messages.",
    };
  }

  const { data } = await admin
    .from("communication_permissions")
    .select("status")
    .eq("venue_id", ctx.venue.id)
    .eq("channel", "sms")
    .eq("address_key", addressKey)
    .maybeSingle<{ status: CommunicationPermissionStatus }>();

  const status = data?.status ?? "not_opted_in";
  const label = smsPermissionDisplayLabel(status);
  const detail =
    status === "opted_in"
      ? `You gave ${ctx.venue.name} permission to send you text messages.`
      : status === "opted_out"
        ? "You have opted out of text messages from this venue."
        : status === "provider_blocked"
          ? "Text messages aren't available for this number."
          : `${ctx.venue.name} can only text you through Hello to Cheers after you opt in.`;

  return { hasPhone: true, status, label, detail };
}

export async function getAccountStateAction(): Promise<AccountState> {
  if (!isSupabaseConfigured) {
    return { loggedIn: false, sessions: [], grants: [], legalHistory: [] };
  }
  const supabase = await createClientPortalAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { loggedIn: false, sessions: [], grants: [], legalHistory: [] };
  }
  const [sessions, grants, legalHistory] = await Promise.all([
    getMyAuthSessions(),
    getMySupportGrants(),
    listLegalAcceptancesForCurrentUser("client"),
  ]);
  return { loggedIn: true, sessions, grants, legalHistory };
}

export async function changePasswordAction(newPassword: string): Promise<ClientAuthResult> {
  if (newPassword.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  return changeMyPassword(newPassword);
}

export async function revokeSessionAction(sessionId: string): Promise<ClientAuthResult> {
  return revokeMyAuthSession(sessionId);
}

export async function grantSupportAccessAction(hours: number, label?: string): Promise<ClientAuthResult> {
  return grantSupportAccess(hours, label);
}

export async function revokeSupportGrantAction(grantId: string): Promise<ClientAuthResult> {
  return revokeSupportGrant(grantId);
}
