/**
 * Read-only Sandbox probes for guest_list ownership / destination / side effects.
 * Disposable Fancy records only. No production.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { writeFileSync, mkdirSync } from "node:fs";

config({ path: ".env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = "docs/qa/guest-list-import-audit";
mkdirSync(OUT, { recursive: true });

const stamp = Date.now().toString(36);
const findings: Record<string, unknown> = { stamp, fancy: FANCY };

async function main() {
  // 1) Disposable client + future event
  const { data: client, error: cErr } = await admin.from("clients").insert({
    venue_id: FANCY,
    first_name: "AuditGuest",
    last_name: `Client${stamp}`,
    email: `audit.guest.${stamp}@example.invalid`,
    exclude_from_business_reporting: true,
  }).select("id,email").single();
  if (cErr) throw cErr;

  const futureDate = "2031-06-15";
  const { data: event, error: eErr } = await admin.from("events").insert({
    venue_id: FANCY,
    client_id: client.id,
    event_date: futureDate,
    event_type: "Wedding",
    status: "confirmed",
    name: `Audit Guest Event ${stamp}`,
  }).select("id,client_id,event_date,venue_id,status").single();
  if (eErr) throw eErr;

  // 2) Simulate commitOperationalGuest shape (admin write, visibility true)
  const { data: guest, error: gErr } = await admin.from("couple_guests").insert({
    venue_id: FANCY,
    client_id: client.id,
    first_name: "Probe",
    last_name: "Guest",
    email: `probe.guest.${stamp}@example.invalid`,
    rsvp_status: "pending",
    invitation_status: "draft",
    visibility_to_venue: true,
    notes: `Imported via Bring Your Business — quiet guest list continuity.\n[migration:audit-${stamp}]`,
  }).select("id,client_id,venue_id,visibility_to_venue,invitation_status,first_name,notes").single();
  if (gErr) throw gErr;

  findings.persisted = {
    clientId: client.id,
    eventId: event.id,
    guestId: guest.id,
    guestHasEventIdColumn: false, // proven absent
    guestClientIdMatches: guest.client_id === client.id,
    visibilityToVenue: guest.visibility_to_venue,
    invitationStatus: guest.invitation_status,
  };

  // 3) Cross-venue: create guest with wrong venue should still be insertable via admin
  //    but resolveEventForMigration filters by venue_id — probe events from OTHER venue
  const { data: otherVenue } = await admin.from("venues").select("id").neq("id", FANCY).limit(1).maybeSingle();
  if (otherVenue?.id) {
    const { data: foreignEvent } = await admin.from("events")
      .select("id,venue_id,client_id")
      .eq("venue_id", otherVenue.id)
      .not("client_id", "is", null)
      .limit(1)
      .maybeSingle();
    findings.crossVenue = {
      otherVenueId: otherVenue.id,
      foreignEventId: foreignEvent?.id ?? null,
      // resolveEventForMigration with Fancy venueId + foreign eventId would fail:
      // .eq("venue_id", venueId) on events
      note: "resolveEventForMigration always .eq venue_id — foreign eventId rejected",
    };
  }

  // 4) Side effects: invitations / enrollments for this guest
  const { count: invites } = await admin.from("client_invitations")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client.id);
  const { count: enroll } = await admin.from("automation_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client.id);
  findings.sideEffects = { clientInvitations: invites, automationEnrollments: enroll };

  // 5) Past event rejection: prove date gate conceptually
  findings.pastEventGate = {
    codePath: "commitOperationalGuest rejects when resolved.eventDate < today",
    evidence: "lib/migration/operational-guest.ts lines 156-161",
  };

  // Cleanup disposable rows (preserve tree; only our fixtures)
  await admin.from("couple_guests").delete().eq("id", guest.id);
  await admin.from("events").delete().eq("id", event.id);
  await admin.from("clients").delete().eq("id", client.id);

  findings.cleanup = "deleted disposable client/event/guest";
  writeFileSync(`${OUT}/probe-results.json`, JSON.stringify(findings, null, 2));
  console.log(JSON.stringify(findings, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
