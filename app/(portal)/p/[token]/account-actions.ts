"use server";

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  changeMyPassword, getMyAuthSessions, revokeMyAuthSession,
  getMySupportGrants, grantSupportAccess, revokeSupportGrant,
} from "@/lib/client-auth/service";
import type { AuthSessionInfo, ClientAuthResult, SupportAccessGrant } from "@/lib/client-auth/types";

export type AccountState = {
  loggedIn: boolean;
  sessions: AuthSessionInfo[];
  grants: SupportAccessGrant[];
};

export async function getAccountStateAction(): Promise<AccountState> {
  if (!isSupabaseConfigured) return { loggedIn: false, sessions: [], grants: [] };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { loggedIn: false, sessions: [], grants: [] };
  const [sessions, grants] = await Promise.all([getMyAuthSessions(), getMySupportGrants()]);
  return { loggedIn: true, sessions, grants };
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
