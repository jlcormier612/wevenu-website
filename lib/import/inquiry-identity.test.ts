import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  classifyLeadImportMatch,
  classifyLeadRowAgainstKnownPeople,
  clientEventWithinFileKey,
  isLeadInquiryRetry,
  leadInquiryRetryKey,
} from "@/lib/import/inquiry-identity";
import { classifyPersonMatch, type PersonMatchCandidate } from "@/lib/import/match-policy";

const riley = {
  firstName: "Riley",
  lastName: "Prospect",
  email: "riley.prospect@byb.test",
};

const june = {
  ...riley,
  eventDate: "2027-06-12",
  partnerFirstName: "Sam",
  partnerLastName: "Prospect",
  eventType: "Wedding",
  guestCount: "120",
  source: "Website",
  inquiryMessage: "Preferred June date — not booked",
};

const may = {
  ...riley,
  eventDate: "2028-05-03",
  partnerFirstName: "Sam",
  partnerLastName: "Prospect",
  eventType: "Wedding",
  guestCount: "80",
  source: "Website",
  inquiryMessage: "Second inquiry different date",
};

describe("leadInquiryRetryKey", () => {
  it("treats same person + different preferred dates as distinct inquiries", () => {
    assert.notEqual(leadInquiryRetryKey(june), leadInquiryRetryKey(may));
    assert.equal(isLeadInquiryRetry(may, [june]), false);
  });

  it("treats same person + same preferred date as a retry", () => {
    assert.equal(leadInquiryRetryKey(june), leadInquiryRetryKey({ ...june, inquiryMessage: "retry paste" }));
    assert.equal(isLeadInquiryRetry({ ...june, source: "The Knot" }, [june]), true);
  });

  it("does not treat email-only different names as the same inquiry", () => {
    const other = { ...june, firstName: "Other", lastName: "Office" };
    assert.notEqual(leadInquiryRetryKey(june), leadInquiryRetryKey(other));
  });

  it("distinguishes blank-date inquiries by source and notes", () => {
    const blankWebsite = {
      ...riley,
      eventDate: "",
      source: "Website",
      inquiryMessage: "Called about a weekday",
    };
    const blankKnot = {
      ...riley,
      eventDate: "",
      source: "The Knot",
      inquiryMessage: "Bridal show follow-up",
    };
    assert.notEqual(leadInquiryRetryKey(blankWebsite), leadInquiryRetryKey(blankKnot));
    assert.equal(isLeadInquiryRetry(blankWebsite, [blankKnot]), false);
    assert.equal(isLeadInquiryRetry(blankWebsite, [blankWebsite]), true);
  });

  it("treats identical blank-date rows with no distinguishing details as a retry", () => {
    const empty = { ...riley, eventDate: "" };
    assert.equal(isLeadInquiryRetry(empty, [empty]), true);
  });

  it("treats blank-date rows with different sales stages as distinct inquiries", () => {
    const outreach = { ...riley, eventDate: "", salesStage: "Outreach Sent" };
    const inquiry = { ...riley, eventDate: "", salesStage: "New Inquiry" };
    assert.notEqual(leadInquiryRetryKey(outreach), leadInquiryRetryKey(inquiry));
  });
});

describe("classifyLeadImportMatch", () => {
  const existing: PersonMatchCandidate = {
    id: "lead-1",
    firstName: "Riley",
    lastName: "Prospect",
    email: "riley.prospect@byb.test",
  };

  it("creates a new inquiry when the exact person already has a different date", () => {
    const person = classifyPersonMatch(may, existing, existing);
    const match = classifyLeadImportMatch(person, may, [june]);
    assert.equal(match.inquiryDisposition, "additional");
    assert.equal(match.defaultAction, "create_new");
    assert.match(match.reason, /additional inquiry/i);
  });

  it("skips a retry of the same person and preferred date", () => {
    const person = classifyPersonMatch(june, existing, existing);
    const match = classifyLeadImportMatch(person, june, [june, may]);
    assert.equal(match.inquiryDisposition, "retry");
    assert.equal(match.defaultAction, "skip");
  });

  it("defaults email-only matches to skip", () => {
    const person = classifyPersonMatch(
      { firstName: "Other", lastName: "Office", email: riley.email },
      existing,
      null,
    );
    const match = classifyLeadImportMatch(person, { ...june, firstName: "Other", lastName: "Office" }, [june]);
    assert.equal(match.inquiryDisposition, "uncertain");
    assert.equal(match.defaultAction, "skip");
  });
});

describe("classifyLeadRowAgainstKnownPeople", () => {
  it("keeps a second same-file date as an additional inquiry before commit", () => {
    const match = classifyLeadRowAgainstKnownPeople(
      may,
      classifyPersonMatch(may, null, null),
      [],
      [{ id: "file-1", ...riley }],
      [june],
    );
    assert.equal(match.inquiryDisposition, "additional");
    assert.equal(match.defaultAction, "create_new");
  });

  it("defaults a same-file email-only row to skip", () => {
    const incoming = { ...june, firstName: "Other", lastName: "Office", eventDate: "2027-08-01" };
    const match = classifyLeadRowAgainstKnownPeople(
      incoming,
      classifyPersonMatch(incoming, null, null),
      [],
      [{ id: "file-1", ...riley }],
      [june],
    );
    assert.equal(match.inquiryDisposition, "uncertain");
    assert.equal(match.defaultAction, "skip");
  });
});

describe("clientEventWithinFileKey", () => {
  it("separates extra event dates and collapses same-date retries", () => {
    const first = clientEventWithinFileKey("Dana", "Booked", "dana@x.com", "2027-10-10");
    const extra = clientEventWithinFileKey("Dana", "Booked", "dana@x.com", "2028-03-04");
    const retry = clientEventWithinFileKey("Dana", "Booked", "dana@x.com", "2027-10-10");
    const emailOnly = clientEventWithinFileKey("Other", "Office", "dana@x.com", "2027-10-10");
    assert.notEqual(first, extra);
    assert.equal(first, retry);
    assert.notEqual(first, emailOnly);
  });
});

describe("HQ and self-service Lead import share the inquiry identity module", () => {
  const hq = readFileSync(resolve("app/admin/onboarding/import-actions.ts"), "utf8");
  const selfServe = readFileSync(resolve("app/(app)/settings/import/actions.ts"), "utf8");
  const preview = readFileSync(resolve("lib/import/preview-integrity.ts"), "utf8");
  const wizard = readFileSync(resolve("components/settings/import-wizard.tsx"), "utf8");
  const hqLeads = hq.slice(
    hq.indexOf("export async function importLeadsForVenueAction"),
    hq.indexOf("export async function importVendorsForVenueAction"),
  );
  const csvLeads = selfServe.slice(
    selfServe.indexOf("export async function importLeadsAction"),
    selfServe.indexOf("export async function importVendorsAction"),
  );

  it("does not keep a third email-only duplicate detector on HQ leads", () => {
    assert.match(hqLeads, /classifyVenueControlledMatch/);
    assert.match(hqLeads, /createLeadForVenue/);
    assert.doesNotMatch(hqLeads, /findActiveDuplicateLeadForVenue/);
    assert.doesNotMatch(hqLeads, /same email/);
    assert.doesNotMatch(hqLeads, /bookClient/);
  });

  it("uses the same venue-controlled match actions on self-service", () => {
    assert.match(csvLeads, /classifyVenueControlledMatch/);
    assert.match(csvLeads, /resolveImportMatchAction/);
    assert.match(csvLeads, /createLead\(/);
    assert.match(csvLeads, /"import"/);
    assert.match(csvLeads, /true/);
  });

  it("preview does not auto-skip Lead rows by email or inquiry identity", () => {
    assert.doesNotMatch(preview, /leadInquiryRetryKey/);
    assert.match(preview, /clientEventWithinFileKey/);
    assert.doesNotMatch(preview, /same email\) — will be skipped/);
  });

  it("HQ Lead import honors matchActions from the wizard", () => {
    assert.match(hqLeads, /matchActions/);
    assert.match(wizard, /importLeadsForVenueAction\(venueId, inputRows, sourceLabel, matchActions\)/);
  });
});
