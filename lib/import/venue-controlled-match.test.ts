import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  classifyVenueControlledMatch,
  importedLeadIdentityDecision,
  incomingPersonFromLeadInput,
  importMatchRecordFromIncoming,
  leadImportFingerprint,
  rememberCreatedImportLead,
  resolveImportMatchAction,
  venueMatchSkipMessage,
  type ImportMatchRecord,
  type IncomingImportPerson,
} from "@/lib/import/venue-controlled-match";

function person(overrides: Partial<IncomingImportPerson> & Pick<IncomingImportPerson, "firstName" | "lastName">): IncomingImportPerson {
  return {
    email: "riley.prospect@byb.test",
    phone: "5551112222",
    partnerFirstName: "Sam",
    partnerLastName: "Prospect",
    eventDate: "2027-06-12",
    eventType: "Wedding",
    inquiryMessage: "June garden wedding",
    ...overrides,
  };
}

function record(incoming: IncomingImportPerson, extras: Partial<ImportMatchRecord> = {}): ImportMatchRecord {
  return {
    ...importMatchRecordFromIncoming(incoming, extras.fileRow ?? 1),
    leadId: extras.leadId ?? "lead-1",
    relationshipId: extras.relationshipId ?? "rel-1",
    importFingerprint: null,
    sourceRecordId: null,
    ...extras,
  };
}

describe("classifyVenueControlledMatch", () => {
  const rileyJune = person({ firstName: "Riley", lastName: "Prospect" });
  const rileyMay = person({ firstName: "Riley", lastName: "Prospect", eventDate: "2028-05-03", inquiryMessage: "May date instead" });
  const otherOffice = person({ firstName: "Other", lastName: "Office", eventDate: "2027-08-01", inquiryMessage: "Office inquiry" });
  const blankOne = person({ firstName: "Riley", lastName: "Prospect", eventDate: "", inquiryMessage: "Called about a weekday" });
  const blankTwo = person({ firstName: "Riley", lastName: "Prospect", eventDate: "", inquiryMessage: "Bridal show follow-up", source: "The Knot" });

  it("flags same person, same email, same date for venue review instead of auto-merging", () => {
    const match = classifyVenueControlledMatch(rileyJune, [record(rileyJune)]);
    assert.equal(match.needsReview, true);
    assert.equal(match.alreadyImported, false);
    assert.equal(resolveImportMatchAction(match, null), "held");
    assert.match(match.reason, /Same email|Matched by/i);
  });

  it("flags same person with different dates as a possible separate inquiry, not an automatic create", () => {
    const match = classifyVenueControlledMatch(rileyMay, [record(rileyJune)]);
    assert.equal(match.needsReview, true);
    assert.equal(match.kind, "exact");
    assert.ok(match.inquiryNotes.some((note) => /different preferred date/i.test(note)));
    assert.equal(resolveImportMatchAction(match, "create_same_person"), "create_same_person");
    assert.deepEqual(importedLeadIdentityDecision(match, "create_same_person"), {
      action: "use_existing",
      relationshipId: "rel-1",
    });
    assert.deepEqual(importedLeadIdentityDecision(match, "create_new"), { action: "create_new" });
  });

  it("warns on same email with different names and does not auto-merge", () => {
    const match = classifyVenueControlledMatch(otherOffice, [record(rileyJune)]);
    assert.equal(match.needsReview, true);
    assert.equal(match.kind, "likely");
    assert.ok(match.signals.includes("email"));
    assert.equal(resolveImportMatchAction(match, null), "held");
    assert.deepEqual(importedLeadIdentityDecision(match, "create_new"), { action: "create_new" });
  });

  it("lets the venue keep two blank-date inquiries for the same person", () => {
    const match = classifyVenueControlledMatch(blankTwo, [record(blankOne)]);
    assert.equal(match.needsReview, true);
    assert.equal(resolveImportMatchAction(match, "create_same_person"), "create_same_person");
    assert.deepEqual(importedLeadIdentityDecision(match, "create_same_person"), {
      action: "use_existing",
      relationshipId: "rel-1",
    });
  });

  it("does not treat an updated budget or notes as a new inquiry without a venue decision", () => {
    const updated = person({
      firstName: "Riley",
      lastName: "Prospect",
      estimatedBudget: "25000",
      inquiryMessage: "Updated notes",
      followUpDate: "2027-03-01",
      sourceRecordId: "src-riley-june",
    });
    const existing = record(rileyJune, {
      sourceRecordId: "src-riley-june",
      importFingerprint: leadImportFingerprint(rileyJune),
      estimatedBudget: "18000",
    });
    const match = classifyVenueControlledMatch(updated, [existing]);
    assert.equal(match.needsReview, true);
    assert.equal(match.changedSinceImport, true);
    assert.equal(match.alreadyImported, false);
    assert.ok(match.differences.some((diff) => diff.label === "Budget"));
    assert.equal(resolveImportMatchAction(match, "use_existing"), "use_existing");
    assert.match(venueMatchSkipMessage(match, "use_existing"), /Nothing was overwritten/);
  });

  it("shows both potential duplicates from the same uploaded file", () => {
    const first = importMatchRecordFromIncoming(rileyJune, 1);
    const match = classifyVenueControlledMatch(rileyJune, [], [first]);
    assert.equal(match.needsReview, true);
    assert.equal(match.fileMatchRow, 1);
    assert.match(match.reason, /row 1/);
  });

  it("auto-skips a proven retry with the same source-system record ID and identical fingerprint", () => {
    const incoming = person({ firstName: "Riley", lastName: "Prospect", sourceRecordId: "src-riley-june" });
    const existing = record(incoming, {
      sourceRecordId: "src-riley-june",
      importFingerprint: leadImportFingerprint(incoming),
    });
    const match = classifyVenueControlledMatch(incoming, [existing]);
    assert.equal(match.alreadyImported, true);
    assert.equal(match.needsReview, false);
    assert.equal(resolveImportMatchAction(match, null), "skip");
    assert.match(venueMatchSkipMessage(match, "skip"), /already in Hello to Cheers/);
  });

  it("auto-skips an identical previously imported fingerprint even without a source-system ID", () => {
    const existing = record(rileyJune, { importFingerprint: leadImportFingerprint(rileyJune) });
    const match = classifyVenueControlledMatch(rileyJune, [existing]);
    assert.equal(match.alreadyImported, true);
    assert.equal(resolveImportMatchAction(match, "create_new"), "skip");
  });

  it("does not treat a similar person as a proven retry", () => {
    const match = classifyVenueControlledMatch(rileyMay, [record(rileyJune, {
      importFingerprint: leadImportFingerprint(rileyJune),
    })]);
    assert.equal(match.alreadyImported, false);
    assert.equal(match.needsReview, true);
  });

  it("notes an existing booked customer without changing that booking", () => {
    const booked = record(rileyJune, { salesStage: "booked", clientId: "client-1" });
    const match = classifyVenueControlledMatch(rileyMay, [booked]);
    assert.ok(match.inquiryNotes.some((note) => /booked customer/i.test(note)));
    assert.equal(resolveImportMatchAction(match, "create_new"), "create_new");
  });

  it("holds unresolved potential matches and records an explicit skip", () => {
    const match = classifyVenueControlledMatch(rileyJune, [record(rileyJune)]);
    assert.equal(resolveImportMatchAction(match, null), "held");
    assert.match(venueMatchSkipMessage(match, "held"), /Held for your decision/);
    assert.equal(resolveImportMatchAction(match, "skip"), "skip");
    assert.match(venueMatchSkipMessage(match, "skip"), /Left out of this import/);
  });

  it("creates a new person when there is no match", () => {
    const match = classifyVenueControlledMatch(rileyJune, []);
    assert.equal(match.kind, "new");
    assert.equal(match.needsReview, false);
    assert.equal(resolveImportMatchAction(match, null), "create_new");
  });

  it("does not reuse a relationship from matching fields alone", () => {
    const match = classifyVenueControlledMatch(rileyMay, [record(rileyJune)]);
    assert.equal(match.kind, "exact");
    assert.equal(match.relationshipId, "rel-1");
    assert.deepEqual(importedLeadIdentityDecision(match, "create_new"), { action: "create_new" });
    assert.equal(importedLeadIdentityDecision(match, "skip"), undefined);
    assert.equal(importedLeadIdentityDecision(match, "use_existing"), undefined);
  });

  it("reuses a relationship created earlier in the same file after same-person confirmation", () => {
    const existing: ImportMatchRecord[] = [];
    const prior: ImportMatchRecord[] = [];
    const first = classifyVenueControlledMatch(rileyJune, existing, prior);
    assert.equal(first.kind, "new");
    assert.equal(resolveImportMatchAction(first, null), "create_new");
    prior.push(importMatchRecordFromIncoming(rileyJune, 1));
    rememberCreatedImportLead(existing, rileyJune, 1, "lead-june", "rel-riley");
    const second = classifyVenueControlledMatch(rileyMay, existing, prior);
    assert.equal(second.needsReview, true);
    assert.equal(second.relationshipId, "rel-riley");
    assert.equal(resolveImportMatchAction(second, "create_same_person"), "create_same_person");
    assert.deepEqual(importedLeadIdentityDecision(second, "create_same_person"), {
      action: "use_existing",
      relationshipId: "rel-riley",
    });
    assert.deepEqual(importedLeadIdentityDecision(second, "create_new"), { action: "create_new" });
  });

  it("creates a new person when same-person is chosen but no durable relationship exists yet", () => {
    const first = importMatchRecordFromIncoming(rileyJune, 1);
    const match = classifyVenueControlledMatch(rileyMay, [], [first]);
    assert.equal(match.relationshipId, null);
    assert.deepEqual(importedLeadIdentityDecision(match, "create_same_person"), { action: "create_new" });
  });

  it("does not auto-link when person identity is unresolved", () => {
    const match = classifyVenueControlledMatch(otherOffice, [record(rileyJune)]);
    assert.equal(resolveImportMatchAction(match, null), "held");
    assert.equal(importedLeadIdentityDecision(match, "skip"), undefined);
  });

  it("keeps Don't import as an explicit skip, not an identity link", () => {
    const match = classifyVenueControlledMatch(otherOffice, [record(rileyJune)]);
    assert.equal(resolveImportMatchAction(match, "skip"), "skip");
    assert.equal(importedLeadIdentityDecision(match, "skip"), undefined);
  });
});

describe("incomingPersonFromLeadInput", () => {
  it("carries source record ID and phone into the fingerprint", () => {
    const incoming = incomingPersonFromLeadInput({
      firstName: "Riley",
      lastName: "Prospect",
      email: "riley.prospect@byb.test",
      phone: "(555) 111-2222",
      sourceRecordId: "crm-99",
    });
    assert.match(leadImportFingerprint(incoming), /rid:crm-99/);
    assert.match(leadImportFingerprint(incoming), /\(555\) 111-2222/);
  });
});

describe("HQ and self-service Lead import share venue-controlled matching", () => {
  const hq = readFileSync(resolve("app/admin/onboarding/import-actions.ts"), "utf8");
  const selfServe = readFileSync(resolve("app/(app)/settings/import/actions.ts"), "utf8");
  const wizard = readFileSync(resolve("components/settings/import-wizard.tsx"), "utf8");
  const hqLeads = hq.slice(
    hq.indexOf("export async function importLeadsForVenueAction"),
    hq.indexOf("export async function importVendorsForVenueAction"),
  );
  const csvLeads = selfServe.slice(
    selfServe.indexOf("export async function importLeadsAction"),
    selfServe.indexOf("export async function importVendorsAction"),
  );

  it("uses the shared venue-controlled classifier on both entry points", () => {
    assert.match(hqLeads, /classifyVenueControlledMatch/);
    assert.match(hqLeads, /resolveImportMatchAction/);
    assert.match(hqLeads, /importedLeadIdentityDecision/);
    assert.match(csvLeads, /classifyVenueControlledMatch/);
    assert.match(csvLeads, /resolveImportMatchAction/);
    assert.match(csvLeads, /createLead\(/);
    assert.doesNotMatch(hqLeads, /merge_leads_v1|confirmMergeLeads/);
    assert.doesNotMatch(csvLeads, /merge_leads_v1|confirmMergeLeads/);
    assert.doesNotMatch(hqLeads, /bookClient/);
    assert.doesNotMatch(csvLeads, /findActiveDuplicateLeadForVenue/);
    const leadsService = readFileSync(resolve("lib/leads/service.ts"), "utf8");
    assert.match(leadsService, /relationshipId: outcome.relationshipId/);
  });

  it("does not auto-skip similar within-file Lead rows", () => {
    assert.doesNotMatch(hqLeads, /leadInquiryRetryKey/);
    assert.doesNotMatch(csvLeads, /leadInquiryRetryKey/);
    assert.doesNotMatch(hqLeads, /same person and preferred date/);
    assert.doesNotMatch(csvLeads, /inquiryDisposition === "retry"/);
  });

  it("keeps quiet historical create on both paths", () => {
    assert.match(csvLeads, /identityDecision: importedLeadIdentityDecision/);
    assert.match(csvLeads, /rememberCreatedImportLead/);
    assert.match(csvLeads, /,\s*"import",\s*true/);
    assert.match(hqLeads, /createLeadForVenue\(\s*venueId,\s*\{/);
    assert.match(hqLeads, /rememberCreatedImportLead/);
  });

  it("offers Same record, same-person inquiry, different person, and Don't import in the wizard", () => {
    assert.match(wizard, /Same record/);
    assert.match(wizard, /Separate inquiry for this person/);
    assert.match(wizard, /Separate inquiry for a different person/);
    assert.match(wizard, /Don't import/);
    assert.match(wizard, /byb-match-choice-same/);
    assert.match(wizard, /byb-match-choice-same-person/);
    assert.match(wizard, /byb-match-choice-different/);
    assert.match(wizard, /byb-match-choice-skip/);
    assert.match(wizard, /matchPreviewKey/);
    assert.match(wizard, /needsReview && !row.alreadyImported \? null/);
  });
});
