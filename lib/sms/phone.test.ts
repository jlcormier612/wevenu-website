import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  formatPhoneDisplay,
  normalizeVenuePhoneInput,
  toE164,
} from "@/lib/sms/phone";

describe("phone display for the SMS composer", () => {
  it("formats a US number the same way send validation would accept it", () => {
    assert.equal(toE164("(615) 555-1234"), "+16155551234");
    assert.equal(formatPhoneDisplay("(615) 555-1234"), "(615) 555-1234");
    assert.equal(formatPhoneDisplay("+16155551234"), "(615) 555-1234");
  });
});

describe("venue phone normalization and customer-facing display", () => {
  it("accepts a 10-digit US phone without punctuation", () => {
    assert.equal(normalizeVenuePhoneInput("9788703988"), "(978) 870-3988");
    assert.equal(toE164("9788703988"), "+19788703988");
  });

  it("accepts common human-entered formats", () => {
    assert.equal(normalizeVenuePhoneInput("(978) 870-3988"), "(978) 870-3988");
    assert.equal(normalizeVenuePhoneInput("978-870-3988"), "(978) 870-3988");
    assert.equal(normalizeVenuePhoneInput("978.870.3988"), "(978) 870-3988");
    assert.equal(normalizeVenuePhoneInput("+1 978 870 3988"), "(978) 870-3988");
  });

  it("keeps empty/optional venue phone empty", () => {
    assert.equal(normalizeVenuePhoneInput(""), "");
    assert.equal(normalizeVenuePhoneInput("   "), "");
    assert.equal(normalizeVenuePhoneInput(null), "");
  });

  it("formats signature contact via emailBrandFromVenue", () => {
    const brand = readFileSync(resolve("lib/email/venue-brand.ts"), "utf8");
    assert.match(brand, /formatPhoneDisplay/);
    assert.match(brand, /phoneDisplay/);
  });

  it("stores normalized phone on venue info and representation save", () => {
    const service = readFileSync(resolve("lib/venue/service.ts"), "utf8");
    assert.match(service, /normalizeVenuePhoneInput\(input\.phone\)/);
    assert.match(service, /normalizeVenuePhoneInput\(venue\.phone\)/);
  });

  it("formats human test value for display without breaking E.164", () => {
    const stored = normalizeVenuePhoneInput("9788703988");
    assert.equal(stored, "(978) 870-3988");
    assert.equal(formatPhoneDisplay(stored), "(978) 870-3988");
    assert.equal(toE164(stored), "+19788703988");
  });

  it("leaves short strings and non-US values unforced", () => {
    assert.equal(formatPhoneDisplay("555-12"), "555-12");
    assert.equal(normalizeVenuePhoneInput("555-12"), "555-12");
    assert.equal(toE164("555-12"), null);
    assert.equal(formatPhoneDisplay("+442071234567"), "+442071234567");
  });

  it("does not invent formatting for non-phone digit strings that fail E.164", () => {
    assert.equal(formatPhoneDisplay("12345"), "12345");
    assert.equal(toE164("12345"), null);
  });
});

