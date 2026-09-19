/**
 * Manual Mark as Booked and automatic commercial booking share bookClient.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("one canonical booking transition", () => {
  it("bookClient is the only writer of the booked transition", () => {
    const book = read("lib/booking-journey/book-client.ts");
    assert.match(book, /ensureEventBookedAt/);
    assert.match(book, /status: "confirmed"/);
    assert.match(book, /sales_stage !== "booked"/);
    assert.match(book, /source: input\.source/);
  });

  it("automatic booking calls bookClient only after isCommerciallyBooked", () => {
    const stamp = read("lib/booking-journey/stamp-commercial-booked-at.ts");
    const rule = stamp.indexOf("if (!commerciallyBooked) return null;");
    const call = stamp.indexOf("bookClient(");
    assert.ok(rule > 0 && call > rule);
    assert.match(stamp, /source: "commercial_rule"/);
    assert.doesNotMatch(stamp, /ensureEventBookedAt/);
  });

  it("manual Mark as Booked calls the same bookClient", () => {
    const service = read("lib/leads/service.ts");
    const fn = service.slice(service.indexOf("export async function confirmPipelineBookedMove"));
    assert.match(fn, /bookClient/);
    assert.match(fn, /source: "manual"/);
    assert.match(fn, /firstTime: booked\.firstTime/);
  });

  it("a second call does not re-enter the sales stage or lifecycle record", () => {
    const book = read("lib/booking-journey/book-client.ts");
    assert.match(book, /lead\.sales_stage !== "booked"/);
    assert.match(book, /else if \(firstTime\)/);
    assert.match(book, /before\.booked_at == null/);
  });

  it("calendar lists official booked events only", () => {
    const cal = read("lib/calendar/service.ts");
    assert.match(cal, /\.not\("booked_at", "is", null\)/);
    assert.match(cal, /\.neq\("status", "cancelled"\)/);
  });

  it("celebration is gated on the transition and fires once", () => {
    const page = read("app/(app)/clients/[id]/booked/page.tsx");
    const burst = read("components/clients/booking-celebration.tsx");
    assert.match(page, /justBooked/);
    assert.match(page, /event\?\.bookedAt/);
    assert.match(burst, /sessionStorage/);
    assert.match(burst, /celebrate/);
  });
});
