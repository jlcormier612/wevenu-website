/**
 * Client Identity Foundation — server-only.
 *
 * Two distinct callers use this module:
 *   - Venue-side (coordinator is signed in, RLS via current_user_venue_id()):
 *     invite / resend / revoke the primary client's invitation, view support
 *     access grants, and use an active grant to view a client's workspace.
 *   - Client-side (the client or a delegate is signed in, RLS via
 *     client_user_id = auth.uid()): accept an invitation, sign in, manage
 *     their own password/sessions, and grant/revoke temporary support access.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import { sendEmail } from "@/lib/email/send";
import type {
  ClientInvitation, ClientAuthResult, AcceptClientInvitationResult,
  AuthSessionInfo, SupportAccessGrant,
} from "./types";

function rowToInvitation(r: Record<string, unknown>): ClientInvitation {
  return {
    id: r.id as string, venueId: r.venue_id as string, clientId: r.client_id as string,
    email: r.email as string, token: r.token as string,
    status: r.status as ClientInvitation["status"],
    createdAt: r.created_at as string, expiresAt: r.expires_at as string,
    acceptedAt: (r.accepted_at ?? null) as string | null,
  };
}

function rowToGrant(r: Record<string, unknown>): SupportAccessGrant {
  return {
    id: r.id as string, venueId: r.venue_id as string, clientId: r.client_id as string,
    label: (r.label ?? null) as string | null,
    createdAt: r.created_at as string, expiresAt: r.expires_at as string,
    revokedAt: (r.revoked_at ?? null) as string | null,
  };
}

function portalAcceptUrl(kind: "client" | "participant", token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.wevenu.com";
  return kind === "client" ? `${base}/client/accept?token=${token}` : `${base}/client/accept-participant?token=${token}`;
}

// ── Venue-side: invite / resend / revoke the primary client ───────────────

export async function getClientInvitation(clientId: string): Promise<ClientInvitation | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("client_invitations").select("*")
    .eq("client_id", clientId).eq("venue_id", venue.id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ? rowToInvitation(data) : null;
}

async function sendClientInviteEmail(
  email: string, coupleName: string, venueName: string, token: string,
): Promise<void> {
  const acceptUrl = portalAcceptUrl("client", token);
  await sendEmail({
    to: email,
    subject: `You're invited to your ${venueName} planning workspace`,
    text: [
      `Hi ${coupleName},`,
      "",
      `${venueName} has invited you to create your own account for your wedding planning workspace.`,
      "",
      "Create your account here:",
      acceptUrl,
      "",
      "This link is personal to you — please don't share it.",
      "",
      venueName,
    ].join("\n"),
    html: [
      `<p>Hi ${coupleName},</p>`,
      `<p>${venueName} has invited you to create your own account for your wedding planning workspace.</p>`,
      `<p><a href="${acceptUrl}" style="background:#D8A7AA;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;">Create Your Account</a></p>`,
      `<p style="color:#888;font-size:12px;">This link is personal to you — please don't share it.</p>`,
      `<p style="color:#888;font-size:12px;">${venueName}</p>`,
    ].join(""),
  });
}

export async function inviteClient(
  clientId: string, email: string, coupleName: string,
): Promise<ClientAuthResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, error: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expired." };

  const { data, error } = await supabase.from("client_invitations").insert({
    venue_id: venue.id, client_id: clientId,
    email: email.trim().toLowerCase(), invited_by: user.id,
  }).select("token").single<{ token: string }>();
  if (error) return { ok: false, error: error.message };

  await sendClientInviteEmail(email.trim(), coupleName, venue.name ?? "Your venue", data.token);
  return { ok: true };
}

export async function resendClientInvitation(invitationId: string): Promise<ClientAuthResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, error: "No venue found." };
  const supabase = await createClient();

  const { data: inv } = await supabase.from("client_invitations").select("*, clients(first_name, partner_first_name)")
    .eq("id", invitationId).eq("venue_id", venue.id).maybeSingle();
  if (!inv) return { ok: false, error: "Invitation not found." };
  if (inv.status !== "pending") return { ok: false, error: "This invitation is no longer pending." };

  const { error } = await supabase.from("client_invitations")
    .update({ expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString() })
    .eq("id", invitationId);
  if (error) return { ok: false, error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (inv as any).clients as { first_name: string; partner_first_name: string | null } | null;
  const coupleName = [client?.first_name, client?.partner_first_name].filter(Boolean).join(" & ") || "there";
  await sendClientInviteEmail(inv.email, coupleName, venue.name ?? "Your venue", inv.token);
  return { ok: true };
}

export async function revokeClientInvitation(invitationId: string): Promise<ClientAuthResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, error: "No venue found." };
  const supabase = await createClient();
  const { error } = await supabase.from("client_invitations")
    .update({ status: "revoked" }).eq("id", invitationId).eq("venue_id", venue.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Revokes the primary client's own accepted access (their claimed portal
 * session) and any still-pending invitation. Their auth account itself is
 * untouched — this ends their access to this workspace, not their identity.
 */
export async function revokeClientAccess(clientId: string): Promise<ClientAuthResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, error: "No venue found." };
  const supabase = await createClient();
  await supabase.from("client_invitations")
    .update({ status: "revoked" }).eq("client_id", clientId).eq("venue_id", venue.id).eq("status", "pending");
  const { error } = await supabase.from("client_portal_sessions")
    .delete().eq("client_id", clientId).eq("venue_id", venue.id).is("participant_id", null);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Venue-side: temporary support access ───────────────────────────────────

export async function getSupportAccessGrants(clientId: string): Promise<SupportAccessGrant[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("client_support_access_grants").select("*")
    .eq("client_id", clientId).eq("venue_id", venue.id).order("created_at", { ascending: false });
  return (data ?? []).map(rowToGrant);
}

export async function openSupportAccess(
  grantId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("use_client_support_access", { p_grant_id: grantId });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error ?? "Access grant is not active." };
  return { ok: true, url: `/p/${data.accessToken}` };
}

// ── Client-side: accept invitation, create account ─────────────────────────

export async function peekClientInvitation(token: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_client_invitation_by_token", { p_token: token });
  return data as { email: string; status: string; expired: boolean; coupleName: string; venueName: string } | null;
}

export async function peekParticipantInvitation(token: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_couple_participant_invitation_by_token", { p_token: token });
  return data as { email: string; firstName: string; inviteStatus: string; coupleName: string; venueName: string } | null;
}

async function createAndSignInAccount(email: string, password: string): Promise<ClientAuthResult> {
  const admin = createAdminClient();
  const { error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr && !createErr.message.toLowerCase().includes("already been registered")) {
    return { ok: false, error: createErr.message };
  }

  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) {
    return {
      ok: false,
      error: createErr
        ? "An account with this email already exists. Please sign in instead."
        : signInErr.message,
    };
  }
  return { ok: true };
}

export async function acceptClientInvitation(
  token: string, email: string, password: string,
): Promise<AcceptClientInvitationResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const signIn = await createAndSignInAccount(email, password);
  if (!signIn.ok) return { ok: false, error: signIn.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_client_invitation", { p_token: token });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error ?? "Invalid or expired invitation." };
  return { ok: true, clientId: data.clientId, accessToken: data.accessToken };
}

export async function acceptParticipantInvitation(
  token: string, email: string, password: string,
): Promise<AcceptClientInvitationResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const signIn = await createAndSignInAccount(email, password);
  if (!signIn.ok) return { ok: false, error: signIn.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_couple_participant_invitation", { p_token: token });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error ?? "Invalid or expired invitation." };
  return { ok: true, clientId: data.clientId, accessToken: data.accessToken };
}

// ── Client-side: sign in, own account management ────────────────────────────

export async function signInClient(email: string, password: string): Promise<ClientAuthResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** The portal URL for whichever account (primary client or delegate) is signed in. */
export async function getMyPortalUrl(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("client_portal_sessions").select("access_token")
    .eq("client_user_id", user.id).order("created_at", { ascending: true }).limit(1)
    .maybeSingle<{ access_token: string }>();
  return data ? `/p/${data.access_token}` : null;
}

export async function changeMyPassword(newPassword: string): Promise<ClientAuthResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getMyAuthSessions(): Promise<AuthSessionInfo[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_auth_sessions");
  if (error) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id, createdAt: r.createdAt, updatedAt: r.updatedAt, notAfter: r.notAfter,
    userAgent: r.userAgent ?? null, ip: r.ip ?? null, isCurrent: !!r.isCurrent,
  }));
}

export async function revokeMyAuthSession(sessionId: string): Promise<ClientAuthResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_my_auth_session", { p_session_id: sessionId });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error ?? "Could not revoke session." };
  return { ok: true };
}

// ── Client-side: temporary support access (grant / revoke) ─────────────────

export async function getMySupportGrants(): Promise<SupportAccessGrant[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("client_support_access_grants").select("*")
    .eq("granted_by_client_user_id", user.id).order("created_at", { ascending: false });
  return (data ?? []).map(rowToGrant);
}

export async function grantSupportAccess(
  hours: number, label?: string,
): Promise<ClientAuthResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expired." };

  const { data: session } = await supabase.from("client_portal_sessions")
    .select("venue_id, client_id").eq("client_user_id", user.id).limit(1)
    .maybeSingle<{ venue_id: string; client_id: string }>();
  if (!session) return { ok: false, error: "No workspace found for this account." };

  const { error } = await supabase.from("client_support_access_grants").insert({
    venue_id: session.venue_id, client_id: session.client_id,
    granted_by_client_user_id: user.id,
    label: label?.trim() || null,
    expires_at: new Date(Date.now() + hours * 3_600_000).toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function revokeSupportGrant(grantId: string): Promise<ClientAuthResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expired." };
  const { error } = await supabase.from("client_support_access_grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", grantId).eq("granted_by_client_user_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
