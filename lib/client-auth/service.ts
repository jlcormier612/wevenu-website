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
import { createClient, createClientPortalAuthClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured, publicAppOrigin } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import { sendEmail, type SendResult } from "@/lib/email/send";
import {
  buildClientInviteEmail,
  clientInviteAcceptUrl,
  clientInvitePreviewAcceptUrl,
  type ClientInviteEmailContent,
} from "@/lib/client-auth/client-invite-email";
import {
  invitationDeliveryFromRow,
  transmitClientInvitation,
  type InvitationDeliveryStore,
} from "@/lib/client-auth/invite-delivery";
import { beginClientInviteSend, endClientInviteSend } from "@/lib/client-auth/invite-send-lock";
import { resolveInvitationAccountEmail } from "@/lib/client-auth/resolve-invitation-email";
import type {
  ClientInvitation, ClientAuthResult, AcceptClientInvitationResult,
  AuthSessionInfo, SupportAccessGrant,
} from "./types";

function rowToInvitation(r: Record<string, unknown>): ClientInvitation {
  const delivery = invitationDeliveryFromRow(r);
  return {
    id: r.id as string, venueId: r.venue_id as string, clientId: r.client_id as string,
    email: r.email as string, token: r.token as string,
    status: r.status as ClientInvitation["status"],
    createdAt: r.created_at as string, expiresAt: r.expires_at as string,
    acceptedAt: (r.accepted_at ?? null) as string | null,
    deliveryStatus: delivery.deliveryStatus,
    providerMessageId: delivery.providerMessageId,
  };
}

function invitationDeliveryStore(supabase: Awaited<ReturnType<typeof createClient>>): InvitationDeliveryStore {
  return {
    async markSending(id) {
      const { error } = await supabase.from("client_invitations")
        .update({ delivery_status: "sending" })
        .eq("id", id);
      return error ? { error: error.message } : {};
    },
    async saveOutcome(id, patch) {
      const { error } = await supabase.from("client_invitations")
        .update({
          delivery_status: patch.deliveryStatus,
          provider_message_id: patch.providerMessageId,
          delivery_error: patch.deliveryError,
        })
        .eq("id", id);
      return error ? { error: error.message } : {};
    },
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
  const base = publicAppOrigin();
  return kind === "client" ? clientInviteAcceptUrl(token) : `${base}/client/accept-participant?token=${token}`;
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

/**
 * Build the invitation email the venue will review. Does not insert or send.
 * Uses a stand-in accept URL so preview never creates an invitation row.
 */
export async function previewClientInviteEmail(
  email: string,
  coupleName: string,
): Promise<{ ok: true; preview: ClientInviteEmailContent } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, error: "No venue found." };
  const trimmed = email.trim();
  if (!trimmed) return { ok: false, error: "An email address is required to invite the client." };
  const preview = buildClientInviteEmail({
    to: trimmed,
    coupleName,
    venue,
    acceptUrl: clientInvitePreviewAcceptUrl(),
  });
  return { ok: true, preview };
}

/**
 * Preview a resend using the existing pending invitation's real accept token.
 * Does not send.
 */
export async function previewResendClientInviteEmail(
  invitationId: string,
): Promise<{ ok: true; preview: ClientInviteEmailContent } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, error: "No venue found." };
  const supabase = await createClient();
  const { data: inv } = await supabase.from("client_invitations").select("*, clients(first_name, partner_first_name)")
    .eq("id", invitationId).eq("venue_id", venue.id).maybeSingle();
  if (!inv) return { ok: false, error: "Invitation not found." };
  if (inv.status !== "pending") return { ok: false, error: "This invitation is no longer pending." };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (inv as any).clients as { first_name: string; partner_first_name: string | null } | null;
  const coupleName = [client?.first_name, client?.partner_first_name].filter(Boolean).join(" & ") || "there";
  const preview = buildClientInviteEmail({
    to: inv.email,
    coupleName,
    venue,
    acceptUrl: clientInviteAcceptUrl(inv.token),
  });
  return { ok: true, preview };
}

async function sendClientInviteEmail(
  email: string,
  coupleName: string,
  venue: Parameters<typeof buildClientInviteEmail>[0]["venue"],
  token: string,
): Promise<SendResult> {
  const content = buildClientInviteEmail({
    to: email,
    coupleName,
    venue,
    acceptUrl: clientInviteAcceptUrl(token),
  });
  return sendEmail({
    to: content.to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}

/**
 * Whether inviteClient should insert and send. Pending or accepted means
 * the client already has an active invitation — do not create another.
 * Revoked (or none) may send a new invitation. Pure; no new state machine.
 */
export function shouldSendClientInvitation(
  existing: { status: ClientInvitation["status"] } | null,
): boolean {
  if (!existing) return true;
  return existing.status !== "pending" && existing.status !== "accepted";
}

export async function inviteClient(
  clientId: string, email: string, coupleName: string,
): Promise<ClientAuthResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, error: "No venue found." };
  const lockKey = `invite:${clientId}`;
  if (!beginClientInviteSend(lockKey)) {
    return { ok: false, error: "This invitation is already sending." };
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Session expired." };

    const existing = await getClientInvitation(clientId);
    const store = invitationDeliveryStore(supabase);
    if (!shouldSendClientInvitation(existing)) {
      if (!existing) return { ok: true };
      return transmitClientInvitation({
        row: {
          id: existing.id,
          status: existing.status,
          email: existing.email,
          token: existing.token,
          deliveryStatus: existing.deliveryStatus ?? null,
          providerMessageId: existing.providerMessageId ?? null,
        },
        mode: "invite",
        store,
        send: () => sendClientInviteEmail(existing.email, coupleName, venue, existing.token),
      });
    }

    const { data, error } = await supabase.from("client_invitations").insert({
      venue_id: venue.id, client_id: clientId,
      email: email.trim().toLowerCase(), invited_by: user.id,
      delivery_status: "sending",
    }).select("id, token").single<{ id: string; token: string }>();
    if (error || !data) return { ok: false, error: error?.message ?? "The invitation could not be saved." };

    return transmitClientInvitation({
      row: {
        id: data.id,
        status: "pending",
        email: email.trim().toLowerCase(),
        token: data.token,
        deliveryStatus: "sending",
        providerMessageId: null,
      },
      mode: "invite",
      sendUnrecorded: true,
      store,
      send: () => sendClientInviteEmail(email.trim(), coupleName, venue, data.token),
    });
  } finally {
    endClientInviteSend(lockKey);
  }
}

export async function resendClientInvitation(invitationId: string): Promise<ClientAuthResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, error: "No venue found." };
  const lockKey = `resend:${invitationId}`;
  if (!beginClientInviteSend(lockKey)) {
    return { ok: false, error: "This invitation is already sending." };
  }
  try {
    const supabase = await createClient();

    const { data: inv } = await supabase.from("client_invitations").select("*, clients(first_name, partner_first_name)")
      .eq("id", invitationId).eq("venue_id", venue.id).maybeSingle();
    if (!inv) return { ok: false, error: "Invitation not found." };
    if (inv.status !== "pending") return { ok: false, error: "This invitation is no longer pending." };
    const delivery = invitationDeliveryFromRow(inv as Record<string, unknown>);
    if (delivery.deliveryStatus === "sending") {
      return { ok: false, error: "The previous invitation send did not finish. It was not sent again." };
    }

    const { error } = await supabase.from("client_invitations")
      .update({ expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString() })
      .eq("id", invitationId);
    if (error) return { ok: false, error: error.message };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (inv as any).clients as { first_name: string; partner_first_name: string | null } | null;
    const coupleName = [client?.first_name, client?.partner_first_name].filter(Boolean).join(" & ") || "there";
    return transmitClientInvitation({
      row: {
        id: inv.id as string,
        status: "pending",
        email: inv.email as string,
        token: inv.token as string,
        deliveryStatus: delivery.deliveryStatus,
        providerMessageId: delivery.providerMessageId,
      },
      mode: "resend",
      store: invitationDeliveryStore(supabase),
      send: () => sendClientInviteEmail(inv.email as string, coupleName, venue, inv.token as string),
    });
  } finally {
    endClientInviteSend(lockKey);
  }
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

  // Client auth cookies only — never replace a venue or vendor session.
  const supabase = await createClientPortalAuthClient();
  const {
    data: { user: existing },
  } = await supabase.auth.getUser();
  if (
    existing?.email &&
    existing.email.trim().toLowerCase() !== email.trim().toLowerCase()
  ) {
    await supabase.auth.signOut();
  }

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

function accessTokenFromAcceptRpc(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const token = row.accessToken ?? row.access_token;
  return typeof token === "string" && token.trim() ? token.trim() : null;
}

function clientIdFromAcceptRpc(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const id = row.clientId ?? row.client_id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export async function acceptClientInvitation(
  token: string, email: string, password: string,
): Promise<AcceptClientInvitationResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };

  // Invitation email is authoritative. A disabled <input> does not submit,
  // which previously left `email` empty and failed auth createUser with
  // "Cannot create a user without either an email or phone".
  const invitation = await peekClientInvitation(token);
  if (!invitation || invitation.status !== "pending" || invitation.expired) {
    return { ok: false, error: "Invalid or expired invitation." };
  }
  const resolved = resolveInvitationAccountEmail({
    invitationEmail: invitation.email,
    submittedEmail: email,
  });
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const signIn = await createAndSignInAccount(resolved.email, password);
  if (!signIn.ok) return { ok: false, error: signIn.error };

  const supabase = await createClientPortalAuthClient();
  const { data, error } = await supabase.rpc("accept_client_invitation", { p_token: token });
  if (error) return { ok: false, error: error.message };
  if (!data || (data as { ok?: boolean }).ok === false) {
    return {
      ok: false,
      error: (data as { error?: string } | null)?.error ?? "Invalid or expired invitation.",
    };
  }
  const accessToken = accessTokenFromAcceptRpc(data);
  const clientId = clientIdFromAcceptRpc(data);
  if (!accessToken || !clientId) {
    return { ok: false, error: "Invitation accepted, but the planning workspace link was missing. Try signing in." };
  }
  return { ok: true, clientId, accessToken };
}

export async function acceptParticipantInvitation(
  token: string, email: string, password: string,
): Promise<AcceptClientInvitationResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };

  const invitation = await peekParticipantInvitation(token);
  if (!invitation || invitation.inviteStatus !== "pending") {
    return { ok: false, error: "Invalid or expired invitation." };
  }
  const resolved = resolveInvitationAccountEmail({
    invitationEmail: invitation.email,
    submittedEmail: email,
  });
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const signIn = await createAndSignInAccount(resolved.email, password);
  if (!signIn.ok) return { ok: false, error: signIn.error };

  const supabase = await createClientPortalAuthClient();
  const { data, error } = await supabase.rpc("accept_couple_participant_invitation", { p_token: token });
  if (error) return { ok: false, error: error.message };
  if (!data || (data as { ok?: boolean }).ok === false) {
    return {
      ok: false,
      error: (data as { error?: string } | null)?.error ?? "Invalid or expired invitation.",
    };
  }
  const accessToken = accessTokenFromAcceptRpc(data);
  const clientId = clientIdFromAcceptRpc(data);
  if (!accessToken || !clientId) {
    return { ok: false, error: "Invitation accepted, but the planning workspace link was missing. Try signing in." };
  }
  return { ok: true, clientId, accessToken };
}

// ── Client-side: sign in, own account management ────────────────────────────

export async function signInClient(email: string, password: string): Promise<ClientAuthResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClientPortalAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** The portal URL for whichever account (primary client or delegate) is signed in. */
export async function getMyPortalUrl(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClientPortalAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("client_portal_sessions").select("access_token")
    .eq("client_user_id", user.id).order("created_at", { ascending: true }).limit(1)
    .maybeSingle<{ access_token: string }>();
  return data ? `/p/${data.access_token}` : null;
}

export async function changeMyPassword(newPassword: string): Promise<ClientAuthResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClientPortalAuthClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getMyAuthSessions(): Promise<AuthSessionInfo[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClientPortalAuthClient();
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
  const supabase = await createClientPortalAuthClient();
  const { data, error } = await supabase.rpc("revoke_my_auth_session", { p_session_id: sessionId });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error ?? "Could not revoke session." };
  return { ok: true };
}

// ── Client-side: temporary support access (grant / revoke) ─────────────────

export async function getMySupportGrants(): Promise<SupportAccessGrant[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClientPortalAuthClient();
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
  const supabase = await createClientPortalAuthClient();
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
  const supabase = await createClientPortalAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expired." };
  const { error } = await supabase.from("client_support_access_grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", grantId).eq("granted_by_client_user_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
