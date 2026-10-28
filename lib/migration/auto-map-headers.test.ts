import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autoMapHeaders, compactHeader } from "@/lib/migration/auto-map-headers";

const CLIENT_FIELDS = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "name", label: "Full name (only if your file has ONE combined name column instead of separate first/last)" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "internalNotes", label: "Internal notes" },
  { key: "sourceId", label: "Their own record ID (if the export has one)" },
];

describe("compactHeader", () => {
  it("collapses case, spaces, underscores, and punctuation", () => {
    assert.equal(compactHeader("first_name"), "firstname");
    assert.equal(compactHeader("First Name"), "firstname");
    assert.equal(compactHeader("firstName"), "firstname");
    assert.equal(compactHeader("E-mail Address"), "emailaddress");
    assert.equal(compactHeader("Full_name"), "fullname");
  });
});

describe("autoMapHeaders — Tripleseat-shaped export", () => {
  it("maps first_name / last_name / email / phone / account_id without manual mapping", () => {
    const mapping = autoMapHeaders(
      ["first_name", "last_name", "email", "phone", "account_id", "lead_source", "contact_type"],
      CLIENT_FIELDS,
    );
    assert.equal(mapping.firstName, "first_name");
    assert.equal(mapping.lastName, "last_name");
    assert.equal(mapping.email, "email");
    assert.equal(mapping.phone, "phone");
    assert.equal(mapping.sourceId, "account_id");
    assert.equal(mapping.name, undefined);
  });

  it("maps Full_name convenience header to combined name", () => {
    const mapping = autoMapHeaders(["Full_name", "email", "phone", "account_id"], CLIENT_FIELDS);
    assert.equal(mapping.name, "Full_name");
    assert.equal(mapping.email, "email");
    assert.equal(mapping.firstName, undefined);
    assert.equal(mapping.lastName, undefined);
  });
});

describe("autoMapHeaders — HoneyBook-shaped export", () => {
  it("maps Name / Email / Phone / Notes to canonical keys", () => {
    const mapping = autoMapHeaders(
      ["Name", "Email", "Phone", "Address", "Notes", "Date Created"],
      CLIENT_FIELDS,
    );
    assert.equal(mapping.name, "Name");
    assert.equal(mapping.email, "Email");
    assert.equal(mapping.phone, "Phone");
    assert.equal(mapping.internalNotes, "Notes");
    assert.equal(mapping.firstName, undefined);
    assert.equal(mapping.lastName, undefined);
  });
});

describe("autoMapHeaders — imperfect third-party columns", () => {
  it("maps Couple Name and E-mail Address", () => {
    const mapping = autoMapHeaders(
      ["Couple Name", "E-mail Address", "Mobile #", "Wedding Date", "Notes / Comments"],
      [
        ...CLIENT_FIELDS,
        { key: "eventDate", label: "Event date (YYYY-MM-DD)" },
      ],
    );
    assert.equal(mapping.name, "Couple Name");
    assert.equal(mapping.email, "E-mail Address");
    assert.equal(mapping.phone, "Mobile #");
    assert.equal(mapping.eventDate, "Wedding Date");
    assert.equal(mapping.internalNotes, "Notes / Comments");
  });
});

describe("autoMapHeaders — does not double-assign a header", () => {
  it("uses each header at most once", () => {
    const mapping = autoMapHeaders(["Name", "Email"], CLIENT_FIELDS);
    const values = Object.values(mapping);
    assert.equal(new Set(values).size, values.length);
  });
});
