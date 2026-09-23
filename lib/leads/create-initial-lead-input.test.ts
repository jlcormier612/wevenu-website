/**
 * New Lead defaults — Inquiry date must use venue-local today, not UTC.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createInitialLeadInput } from "@/lib/leads/constants";

describe("createInitialLeadInput inquiry date", () => {
  it("uses venue-local today when UTC has already rolled to tomorrow", () => {
    // 2026-09-23 01:30 UTC = still Sep 22 evening in America/New_York
    const eveningUtc = new Date("2026-09-23T01:30:00.000Z");
    assert.equal(eveningUtc.toISOString().slice(0, 10), "2026-09-23");

    const input = createInitialLeadInput("America/New_York", eveningUtc);
    assert.equal(input.inquiryDate, "2026-09-22");
  });

  it("defaults Inquiry message empty — not an Internal note", () => {
    const input = createInitialLeadInput("America/New_York");
    assert.equal(input.inquiryMessage, "");
  });

  it("New Lead form labels the field Inquiry message, not Message / notes", () => {
    const source = readFileSync(resolve("components/leads/new-inquiry-form.tsx"), "utf8");
    assert.match(source, /label="Inquiry message"/);
    assert.doesNotMatch(source, /Message \/ notes/);
    assert.match(source, /createInitialLeadInput\(venueTimezone\)/);
  });

  it("New Lead page threads venue.timezone into the form", () => {
    const source = readFileSync(resolve("app/(app)/leads/new/page.tsx"), "utf8");
    assert.match(source, /getCurrentVenue/);
    assert.match(source, /venueTimezone=\{venue\?\.timezone/);
  });
});
