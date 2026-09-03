/**
 * Operational guest-list cutover — writes into canonical couple_guests
 * (same table the couple portal uses). Quiet: never sends invitations/emails.
 */

import type { createClient } from "@/integrations/supabase/server";
import { resolveEventForMigration } from "@/lib/migration/resolve-refs";

type DbClient = Awaited<ReturnType<typeof createClient>>;

const RSVP = new Set(["pending", "attending", "declined", "maybe"]);

export type NormalizedGuestListEntry = {
  eventId?: string | null;
  clientEmail?: string | null;
  clientId?: string | null;
  eventDate?: string | null;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  household?: string | null;
  rsvpStatus?: string | null;
  mealChoice?: string | null;
  dietaryRestrictions?: string | null;
  isChild?: boolean;
  isWeddingParty?: boolean;
  notes?: string | null;
  sourceId?: string | null;
};

export type GuestCommitResult =
  | { ok: true; guestId: string; alreadyExisted?: boolean; clientId: string; eventId: string }
  | { ok: false; error: string };

export function validateGuestListEntry(n: NormalizedGuestListEntry): string | null {
  if (!n.firstName?.trim()) return "Guest first name is required.";
  if (!n.eventId?.trim() && !n.clientEmail?.trim() && !n.clientId?.trim()) {
    return "Guest rows need eventId, or client email / client id (with eventDate).";
  }
  if (n.rsvpStatus?.trim() && !RSVP.has(n.rsvpStatus.trim().toLowerCase())) {
    return `Invalid rsvpStatus "${n.rsvpStatus}" — use pending, attending, declined, or maybe.`;
  }
  return null;
}

async function resolveOrCreateHousehold(
  client: DbClient,
  venueId: string,
  clientId: string,
  householdName: string | null | undefined,
): Promise<string | null> {
  const name = householdName?.trim();
  if (!name) return null;
  const { data: existing } = await client.from("couple_households")
    .select("id")
    .eq("venue_id", venueId)
    .eq("client_id", clientId)
    .ilike("name", name)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (existing?.id) return existing.id;
  const { data, error } = await client.from("couple_households")
    .insert({ venue_id: venueId, client_id: clientId, name })
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

async function findExistingGuest(
  client: DbClient,
  venueId: string,
  clientId: string,
  n: NormalizedGuestListEntry,
): Promise<string | null> {
  if (n.sourceId?.trim()) {
    const marker = `[migration:${n.sourceId.trim()}]`;
    const { data } = await client.from("couple_guests")
      .select("id, notes")
      .eq("venue_id", venueId)
      .eq("client_id", clientId)
      .ilike("notes", `%${marker}%`)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (data?.id) return data.id;
  }
  if (n.email?.trim()) {
    const { data } = await client.from("couple_guests")
      .select("id")
      .eq("venue_id", venueId)
      .eq("client_id", clientId)
      .ilike("email", n.email.trim())
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (data?.id) return data.id;
  }
  const first = n.firstName.trim().toLowerCase();
  const last = (n.lastName ?? "").trim().toLowerCase();
  const { data: rows } = await client.from("couple_guests")
    .select("id, first_name, last_name, household_id")
    .eq("venue_id", venueId)
    .eq("client_id", clientId);
  const householdId = n.household?.trim()
    ? await resolveOrCreateHousehold(client, venueId, clientId, n.household)
    : null;
  for (const row of (rows ?? []) as { id: string; first_name: string; last_name: string | null; household_id: string | null }[]) {
    if (row.first_name.trim().toLowerCase() !== first) continue;
    if ((row.last_name ?? "").trim().toLowerCase() !== last) continue;
    if (householdId && row.household_id !== householdId) continue;
    return row.id;
  }
  return null;
}

/**
 * Quietly create one couple_guests row for an active Event's Client.
 * Never sends invitations or emails. Idempotent on email / sourceId / name+household.
 */
export async function commitOperationalGuest(
  client: DbClient,
  venueId: string,
  n: NormalizedGuestListEntry,
): Promise<GuestCommitResult> {
  const validationError = validateGuestListEntry(n);
  if (validationError) return { ok: false, error: validationError };

  const resolved = await resolveEventForMigration(client, venueId, n);
  if (!resolved.ok) return resolved;

  // Active / future only — past Events are historical archive, not live guest continuity.
  if (resolved.eventDate) {
    const today = new Date().toISOString().slice(0, 10);
    if (resolved.eventDate < today) {
      return { ok: false, error: "Guest lists for past Events are not imported as active business — use archive/source material." };
    }
  }

  const existingId = await findExistingGuest(client, venueId, resolved.clientId, n);
  if (existingId) {
    return {
      ok: true,
      guestId: existingId,
      alreadyExisted: true,
      clientId: resolved.clientId,
      eventId: resolved.eventId,
    };
  }

  const householdId = await resolveOrCreateHousehold(client, venueId, resolved.clientId, n.household);
  const rsvp = (n.rsvpStatus?.trim().toLowerCase() && RSVP.has(n.rsvpStatus.trim().toLowerCase()))
    ? n.rsvpStatus.trim().toLowerCase()
    : "pending";
  const noteParts = [
    n.notes?.trim() || "",
    n.sourceId?.trim() ? `[migration:${n.sourceId.trim()}]` : "",
    "Imported via Bring Your Business — quiet guest list continuity.",
  ].filter(Boolean);

  const { data, error } = await client.from("couple_guests")
    .insert({
      venue_id: venueId,
      client_id: resolved.clientId,
      first_name: n.firstName.trim(),
      last_name: n.lastName?.trim() || null,
      email: n.email?.trim() || null,
      phone: n.phone?.trim() || null,
      household_id: householdId,
      rsvp_status: rsvp,
      meal_choice: n.mealChoice?.trim() || null,
      dietary_restrictions: n.dietaryRestrictions?.trim() || null,
      is_child: !!n.isChild,
      is_wedding_party: !!n.isWeddingParty,
      notes: noteParts.join("\n"),
      invitation_status: "draft",
      visibility_to_venue: true,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;

  return {
    ok: true,
    guestId: data.id,
    clientId: resolved.clientId,
    eventId: resolved.eventId,
  };
}
