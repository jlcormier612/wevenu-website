/**
 * Resolve an Event Space for migration commit.
 * Prefer an explicit UUID; otherwise match active space name (case-insensitive).
 * Returns null when unresolved — caller must surface needs_review, never guess.
 */
import type { AnyDbClient } from "@/lib/lead-intake/types";

export async function resolveSpaceId(
  client: AnyDbClient,
  venueId: string,
  spaceId: string | null | undefined,
  spaceName: string | null | undefined,
): Promise<{ ok: true; spaceId: string | null } | { ok: false; error: string }> {
  if (spaceId?.trim()) {
    const { data } = await client.from("venue_spaces")
      .select("id")
      .eq("venue_id", venueId)
      .eq("id", spaceId.trim())
      .maybeSingle<{ id: string }>();
    if (!data) return { ok: false, error: `Event Space id "${spaceId}" is not on this venue.` };
    return { ok: true, spaceId: data.id };
  }
  if (!spaceName?.trim()) return { ok: true, spaceId: null };

  const { data } = await client.from("venue_spaces")
    .select("id, name, is_active")
    .eq("venue_id", venueId);
  const rows = (data ?? []) as { id: string; name: string; is_active: boolean }[];
  const target = spaceName.trim().toLowerCase();
  const matches = rows.filter((r) => r.name.trim().toLowerCase() === target);
  if (matches.length === 0) {
    return { ok: false, error: `No Event Space named "${spaceName.trim()}" — add spaces in Calendar & Availability first, or map the space name.` };
  }
  if (matches.length > 1) {
    return { ok: false, error: `More than one Event Space is named "${spaceName.trim()}" — map a specific space id instead.` };
  }
  return { ok: true, spaceId: matches[0].id };
}

export async function resolveClientIdByEmail(
  client: AnyDbClient,
  venueId: string,
  clientId: string | null | undefined,
  email: string | null | undefined,
): Promise<{ ok: true; clientId: string } | { ok: false; error: string }> {
  if (clientId?.trim()) {
    const { data } = await client.from("clients")
      .select("id")
      .eq("venue_id", venueId)
      .eq("id", clientId.trim())
      .maybeSingle<{ id: string }>();
    if (!data) return { ok: false, error: `Client id "${clientId}" was not found on this venue.` };
    return { ok: true, clientId: data.id };
  }
  if (!email?.trim()) return { ok: false, error: "Missing client email or client id." };
  const { data } = await client.from("clients")
    .select("id")
    .eq("venue_id", venueId)
    .ilike("email", email.trim())
    .limit(2);
  const rows = (data ?? []) as { id: string }[];
  if (rows.length === 0) return { ok: false, error: `No client with email "${email.trim()}" — import clients first.` };
  if (rows.length > 1) return { ok: false, error: `More than one client has email "${email.trim()}" — use a client id.` };
  return { ok: true, clientId: rows[0].id };
}

export async function resolveLeadIdByEmail(
  client: AnyDbClient,
  venueId: string,
  leadId: string | null | undefined,
  email: string | null | undefined,
): Promise<{ ok: true; leadId: string } | { ok: false; error: string }> {
  if (leadId?.trim()) {
    const { data } = await client.from("leads")
      .select("id")
      .eq("venue_id", venueId)
      .eq("id", leadId.trim())
      .maybeSingle<{ id: string }>();
    if (!data) return { ok: false, error: `Lead id "${leadId}" was not found on this venue.` };
    return { ok: true, leadId: data.id };
  }
  if (!email?.trim()) return { ok: false, error: "Missing lead email or lead id." };
  const { data } = await client.from("leads")
    .select("id")
    .eq("venue_id", venueId)
    .ilike("email", email.trim())
    .limit(2);
  const rows = (data ?? []) as { id: string }[];
  if (rows.length === 0) return { ok: false, error: `No lead with email "${email.trim()}" — import leads first.` };
  if (rows.length > 1) return { ok: false, error: `More than one lead has email "${email.trim()}" — use a lead id.` };
  return { ok: true, leadId: rows[0].id };
}
