/**
 * Strong-signal duplicate detection — pure contracts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  namePairKey,
  normalizeEmail,
  normalizeInquiryText,
  normalizePhone,
  signalsAgainstRecord,
} from "@/lib/leads/duplicate-detection";

describe("normalize helpers", () => {
  it("normalizes email case and rejects empty", () => {
    assert.equal(normalizeEmail("  Jane@Example.COM "), "jane@example.com");
    assert.equal(normalizeEmail(""), null);
    assert.equal(normalizeEmail("not-an-email"), null);
  });

  it("requires 10 phone digits and compares last 10", () => {
    assert.equal(normalizePhone("(555) 123-4567"), "5551234567");
    assert.equal(normalizePhone("+1 555 123 4567"), "5551234567");
    assert.equal(normalizePhone("555-12"), null);
    assert.equal(normalizePhone(""), null);
  });
});

describe("strong signals", () => {
  const jane = {
    firstName: "Jane",
    lastName: "Smith",
    email: "jane@example.com",
    phone: "555-111-2222",
    partnerFirstName: "John",
    partnerLastName: "Smith",
    partnerEmail: "john@example.com",
  };

  it("exact primary email match", () => {
    const signals = signalsAgainstRecord(
      { firstName: "X", lastName: "Y", email: "JANE@example.com" },
      jane,
    );
    assert.deepEqual(signals, ["email"]);
  });

  it("exact phone match", () => {
    const signals = signalsAgainstRecord(
      { firstName: "A", lastName: "B", phone: "+1 (555) 111-2222" },
      jane,
    );
    assert.deepEqual(signals, ["phone"]);
  });

  it("incoming email matching partner email", () => {
    const signals = signalsAgainstRecord(
      { firstName: "John", lastName: "Smith", email: "john@example.com" },
      jane,
    );
    assert.ok(signals.includes("partner_email"));
  });

  it("exact primary + partner names order-insensitive", () => {
    const keyJaneJohn = namePairKey(jane);
    const keyJohnJane = namePairKey({
      firstName: "John",
      lastName: "Smith",
      partnerFirstName: "Jane",
      partnerLastName: "Smith",
    });
    assert.equal(keyJaneJohn, keyJohnJane);
    const signals = signalsAgainstRecord(
      {
        firstName: "John",
        lastName: "Smith",
        partnerFirstName: "Jane",
        partnerLastName: "Smith",
        email: "other@example.com",
      },
      jane,
    );
    assert.ok(signals.includes("name_pair"));
  });

  it("similar / weak names alone do NOT trigger", () => {
    assert.deepEqual(
      signalsAgainstRecord(
        { firstName: "Janet", lastName: "Smith", email: "other@example.com" },
        jane,
      ),
      [],
    );
  });

  it("same last name only does NOT trigger", () => {
    assert.deepEqual(
      signalsAgainstRecord(
        { firstName: "Bob", lastName: "Smith", email: "bob@example.com" },
        jane,
      ),
      [],
    );
  });

  it("same email and exact inquiry text is a candidate signal", () => {
    const signals = signalsAgainstRecord(
      {
        firstName: "A",
        lastName: "B",
        email: "JANE@example.com",
        inquiryMessage: "  We   would like\r\nto visit.  ",
      },
      { ...jane, inquiryMessage: "We would like\nto visit." },
    );
    assert.ok(signals.includes("email"));
    assert.ok(signals.includes("inquiry_text"));
  });

  it("same email and different inquiry text does not add the text signal", () => {
    const signals = signalsAgainstRecord(
      { firstName: "A", lastName: "B", email: "jane@example.com", inquiryMessage: "A June wedding." },
      { ...jane, inquiryMessage: "An October wedding." },
    );
    assert.deepEqual(signals, ["email"]);
  });

  it("blank inquiry text does not match a stored message", () => {
    assert.equal(normalizeInquiryText("  \n\t "), null);
    const signals = signalsAgainstRecord(
      { firstName: "A", lastName: "B", email: "jane@example.com", inquiryMessage: "   " },
      { ...jane, inquiryMessage: "We would like to visit." },
    );
    assert.deepEqual(signals, ["email"]);
  });

  it("a material wording change does not match", () => {
    assert.notEqual(
      normalizeInquiryText("We would like to visit Saturday."),
      normalizeInquiryText("We would like to visit Sunday."),
    );
  });

  it("same email plus phone still matches without inquiry text", () => {
    const signals = signalsAgainstRecord(
      { firstName: "A", lastName: "B", email: "jane@example.com", phone: "555-111-2222" },
      jane,
    );
    assert.ok(signals.includes("email"));
    assert.ok(signals.includes("phone"));
    assert.equal(signals.includes("inquiry_text"), false);
  });

  it("name pair requires both people fully named", () => {
    assert.equal(
      namePairKey({ firstName: "Jane", lastName: "Smith", partnerFirstName: "John" }),
      null,
    );
  });
});
