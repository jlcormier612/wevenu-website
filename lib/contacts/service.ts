import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import { sendEmail } from "@/lib/email/send";
import type { ClientContact, ClientContactInput } from "@/lib/contacts/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapContact(r: any): ClientContact {
  return {
    id: r.id, venueId: r.venue_id, clientId: r.client_id,
    firstName: r.first_name, lastName: r.last_name ?? null,
    email: r.email ?? null, phone: r.phone ?? null,
    relationship: r.relationship ?? null, roleLabel: r.role_label ?? null,
    portalRole: r.portal_role ?? null, receivesReminders: r.receives_reminders,
    isPrimary: r.is_primary, notes: r.notes ?? null,
    sortOrder: r.sort_order,
    status: r.status ?? "active",
    lastActivityAt: r.last_activity_at ?? null,
    isPayer: r.is_payer ?? false,
    isDecisionMaker: r.is_decision_maker ?? false,
    isEmergencyContact: r.is_emergency_contact ?? false,
    invitedAt: r.invited_at ?? null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export async function getClientContacts(clientId: string): Promise<ClientContact[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_contacts")
    .select("*")
    .eq("client_id", clientId)
    .eq("venue_id", venue.id)
    .order("sort_order")
    .order("created_at");
  return (data ?? []).map(mapContact);
}

export async function createClientContact(
  clientId: string,
  input: ClientContactInput,
): Promise<ClientContact | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_contacts")
    .insert({
      venue_id: venue.id, client_id: clientId,
      first_name: input.firstName.trim(),
      last_name: input.lastName?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      relationship: input.relationship || null,
      role_label: input.roleLabel?.trim() || null,
      portal_role: input.portalRole || null,
      receives_reminders: input.receivesReminders ?? false,
      is_primary: input.isPrimary ?? false,
      notes: input.notes?.trim() || null,
      is_payer: input.isPayer ?? false,
      is_decision_maker: input.isDecisionMaker ?? false,
      is_emergency_contact: input.isEmergencyContact ?? false,
    })
    .select("*")
    .single();
  if (error) { console.error("[contacts] create error:", error.message); return null; }
  return mapContact(data);
}

export async function updateClientContact(
  contactId: string,
  input: Partial<ClientContactInput>,
): Promise<ClientContact | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.firstName !== undefined) patch.first_name = input.firstName.trim();
  if (input.lastName !== undefined) patch.last_name = input.lastName?.trim() || null;
  if (input.email !== undefined) patch.email = input.email?.trim() || null;
  if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
  if (input.relationship !== undefined) patch.relationship = input.relationship || null;
  if (input.roleLabel !== undefined) patch.role_label = input.roleLabel?.trim() || null;
  if (input.portalRole !== undefined) patch.portal_role = input.portalRole || null;
  if (input.receivesReminders !== undefined) patch.receives_reminders = input.receivesReminders;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  if (input.isPayer !== undefined) patch.is_payer = input.isPayer;
  if (input.isDecisionMaker !== undefined) patch.is_decision_maker = input.isDecisionMaker;
  if (input.isEmergencyContact !== undefined) patch.is_emergency_contact = input.isEmergencyContact;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("client_contacts") as any)
    .update(patch).eq("id", contactId).eq("venue_id", venue.id).select("*").single();
  if (error) return null;
  return mapContact(data);
}

export async function deleteClientContact(contactId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const venue = await getCurrentVenue();
  if (!venue) return;
  const supabase = await createClient();
  await supabase.from("client_contacts").delete().eq("id", contactId).eq("venue_id", venue.id);
}

/** Generate a portal link for a specific contact. */
export async function createContactPortalSession(
  clientId: string,
  contactId: string,
  label: string,
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_portal_sessions")
    .insert({
      venue_id: venue.id, client_id: clientId,
      contact_id: contactId, label,
      access_level: "couple", // overridden by contact.portal_role at runtime
    })
    .select("access_token")
    .single<{ access_token: string }>();
  if (error) return null;
  return data.access_token;
}

/**
 * Send a portal invitation email to a contact and mark them as invited.
 * Returns the portal URL so the caller can display it as a fallback.
 */
export async function sendContactPortalInvite(
  clientId: string,
  contactId: string,
  contact: { firstName: string; email: string; roleLabel?: string | null },
  coupleName: string,
): Promise<{ ok: boolean; portalUrl?: string; message?: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };

  const venueName = venue.name ?? "Your venue";
  const label = contact.roleLabel ?? contact.firstName;
  const token = await createContactPortalSession(clientId, contactId, label);
  if (!token) return { ok: false, message: "Could not create portal session." };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.wevenu.com";
  const portalUrl = `${baseUrl}/p/${token}`;

  const emailResult = await sendEmail({
    to: contact.email,
    subject: `You're invited to the ${coupleName} wedding portal`,
    text: [
      `Hi ${contact.firstName},`,
      "",
      `${coupleName} have invited you to access their wedding planning portal through ${venueName}.`,
      "",
      "You can view their planning details, documents, and more at:",
      portalUrl,
      "",
      "This is a personal link — please don't share it.",
      "",
      venueName,
    ].join("\n"),
    html: [
      `<p>Hi ${contact.firstName},</p>`,
      `<p>${coupleName} have invited you to access their wedding planning portal through <strong>${venueName}</strong>.</p>`,
      `<p><a href="${portalUrl}" style="background:#D8A7AA;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;">Open Planning Portal</a></p>`,
      `<p style="color:#888;font-size:12px;">This is a personal link — please don't share it.</p>`,
      `<p style="color:#888;font-size:12px;">${venueName}</p>`,
    ].join(""),
  });

  if (!emailResult.ok) return { ok: false, message: emailResult.message };

  // Mark as invited
  const supabase = await createClient();
  await supabase
    .from("client_contacts")
    .update({ status: "invited", invited_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", contactId)
    .eq("venue_id", venue.id);

  return { ok: true, portalUrl };
}

/** Revoke all portal sessions for a specific contact. */
export async function revokeContactPortalAccess(
  contactId: string,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const venue = await getCurrentVenue();
  if (!venue) return;
  const supabase = await createClient();
  await supabase.from("client_portal_sessions").delete().eq("contact_id", contactId);
  await supabase
    .from("client_contacts")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("id", contactId)
    .eq("venue_id", venue.id);
}
