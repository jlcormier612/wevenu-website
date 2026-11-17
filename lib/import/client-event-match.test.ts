import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  classifyClientEventMatch,
  eventImportFingerprint,
  rememberCreatedImportClientEvent,
  resolveConfirmedClientEventAction,
  type ClientEventMatchRecord,
  type IncomingClientEvent,
} from "@/lib/import/client-event-match";
import { resolveImportMatchAction } from "@/lib/import/venue-controlled-match";

function person(overrides: Partial<IncomingClientEvent> = {}): IncomingClientEvent {
  return {
    firstName: "Morgan",
    lastName: "Booked",
    email: "morgan.booked@byb.test",
    phone: "555-0100",
    eventDate: "2027-09-12",
    eventType: "Wedding",
    guestCount: 90,
    internalNotes: "Original booking",
    sourceClientId: null,
    sourceEventId: null,
    ...overrides,
  };
}

function record(incoming: IncomingClientEvent, extra: Partial<ClientEventMatchRecord> = {}): ClientEventMatchRecord {
  return {
    clientId: extra.clientId ?? "client-1",
    eventId: extra.eventId ?? "event-1",
    relationshipId: extra.relationshipId ?? "rel-1",
    firstName: incoming.firstName,
    lastName: incoming.lastName,
    email: incoming.email ?? null,
    phone: incoming.phone ?? null,
    partnerFirstName: incoming.partnerFirstName ?? null,
    partnerLastName: incoming.partnerLastName ?? null,
    eventDate: incoming.eventDate ?? null,
    eventType: incoming.eventType ?? null,
    guestCount: incoming.guestCount ?? null,
    internalNotes: incoming.internalNotes ?? null,
    sourceClientId: incoming.sourceClientId ?? null,
    sourceEventId: incoming.sourceEventId ?? null,
    clientFingerprint: extra.clientFingerprint ?? null,
    eventFingerprint: extra.eventFingerprint ?? eventImportFingerprint(incoming),
    fileRow: extra.fileRow ?? null,
  };
}

describe("classifyClientEventMatch", () => {
  it("auto-skips only a proven unchanged Event retry", () => {
    const original = person({ sourceEventId: "EVT-1", sourceClientId: "CLI-1" });
    const match = classifyClientEventMatch(original, [record(original)]);
    assert.equal(match.alreadyImported, true);
    assert.equal(match.needsReview, false);
    assert.equal(match.defaultAction, "skip");
  });

  it("holds a matching source Event ID when details changed", () => {
    const existing = person({ sourceEventId: "EVT-1", guestCount: 90, internalNotes: "Original" });
    const incoming = person({ sourceEventId: "EVT-1", guestCount: 120, internalNotes: "Updated guests" });
    const match = classifyClientEventMatch(incoming, [record(existing)]);
    assert.equal(match.needsReview, true);
    assert.equal(match.changedSinceImport, true);
    assert.equal(match.alreadyImported, false);
    assert.ok(match.differences.some((d) => d.label === "Guest count"));
  });

  it("does not treat a matching source Client ID as a matching Event", () => {
    const existing = person({ sourceClientId: "CLI-1", sourceEventId: "EVT-1", eventDate: "2027-09-12" });
    const incoming = person({ sourceClientId: "CLI-1", sourceEventId: "EVT-2", eventDate: "2028-02-02" });
    const match = classifyClientEventMatch(incoming, [record(existing)]);
    assert.equal(match.needsReview, true);
    assert.equal(match.alreadyImported, false);
    assert.match(match.inquiryNotes.join(" "), /source Client ID/i);
    assert.equal(resolveImportMatchAction(match, null), "held");
  });

  it("does not auto-skip the same date as a duplicate Event", () => {
    const existing = person({ eventDate: "2027-09-12", eventType: "Wedding" });
    const incoming = person({ eventDate: "2027-09-12", eventType: "Rehearsal dinner" });
    const match = classifyClientEventMatch(incoming, [record(existing)]);
    assert.equal(match.needsReview, true);
    assert.equal(match.alreadyImported, false);
    assert.match(match.reason, /same Event|additional Event/i);
  });

  it("flags same name and email as a suggested Client, not a proven Event", () => {
    const existing = person({ eventDate: "2027-09-12" });
    const incoming = person({ eventDate: "2028-02-02" });
    const match = classifyClientEventMatch(incoming, [record(existing)]);
    assert.equal(match.kind, "exact");
    assert.equal(match.needsReview, true);
    assert.equal(match.matchedClientId, "client-1");
  });

  it("does not treat shared email with a different name as the same Client", () => {
    const existing = person({ firstName: "Morgan", lastName: "Booked" });
    const incoming = person({ firstName: "Other", lastName: "Office", eventDate: "2027-08-01" });
    const match = classifyClientEventMatch(incoming, [record(existing)]);
    assert.equal(match.kind, "likely");
    assert.equal(match.needsReview, true);
    assert.match(match.inquiryNotes.join(" "), /different name/i);
  });

  it("reuses a Client created earlier in the same file after confirmation", () => {
    const first = person({ eventDate: "2027-09-12" });
    const existing: ClientEventMatchRecord[] = [];
    rememberCreatedImportClientEvent(existing, first, 1, "client-created", "event-created", "rel-created");
    const second = person({ eventDate: "2028-02-02" });
    const match = classifyClientEventMatch(second, [], existing);
    assert.equal(match.matchedClientId, "client-created");
    assert.equal(match.needsReview, true);
  });

  it("holds Same Client, additional Event when the confirmed Client is no longer a real record", () => {
    const match = classifyClientEventMatch(person(), []);
    assert.equal(resolveConfirmedClientEventAction(match, "create_same_person"), "held");
    assert.equal(resolveConfirmedClientEventAction(match, "use_existing"), "held");
  });

  it("treats a confirmed additional Event as create_same_person on a persisted Client", () => {
    const existing = person({ eventDate: "2027-09-12" });
    const incoming = person({ eventDate: "2028-02-02" });
    const match = classifyClientEventMatch(incoming, [record(existing, { clientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })]);
    assert.equal(
      resolveConfirmedClientEventAction(match, "create_same_person"),
      "create_same_person",
    );
  });
});

describe("HQ and self-service Client import share venue-controlled matching", () => {
  const hq = readFileSync(resolve("app/admin/onboarding/import-actions.ts"), "utf8");
  const selfServe = readFileSync(resolve("app/(app)/settings/import/actions.ts"), "utf8");
  const wizard = readFileSync(resolve("components/settings/import-wizard.tsx"), "utf8");
  const hqCouples = hq.slice(
    hq.indexOf("export async function importCouplesForVenueAction"),
    hq.indexOf("export async function importLeadsForVenueAction"),
  );
  const csvCouples = selfServe.slice(
    selfServe.indexOf("export async function importCouplesAction"),
    selfServe.indexOf("export async function importLeadsAction"),
  );

  it("uses the shared Client+Event classifier instead of date-only auto-skip", () => {
    assert.match(hqCouples, /classifyClientEventMatch/);
    assert.match(csvCouples, /classifyClientEventMatch/);
    assert.match(hqCouples, /commitImportedClientAndEvent/);
    assert.match(csvCouples, /commitImportedClientAndEvent/);
    assert.doesNotMatch(hqCouples, /seenEvents/);
    assert.doesNotMatch(csvCouples, /same person and date/);
  });

  it("offers combined Client/Event review choices in the wizard", () => {
    assert.match(wizard, /Same Client, same Event/);
    assert.match(wizard, /Same Client, additional Event/);
    assert.match(wizard, /Different Client/);
  });
});
