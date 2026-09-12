/**
 * Strong-signal duplicate detection — pure contracts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  namePairKey,
  normalizeEmail,
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

  it("name pair requires both people fully named", () => {
    assert.equal(
      namePairKey({ firstName: "Jane", lastName: "Smith", partnerFirstName: "John" }),
      null,
    );
  });
});
