import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { publicTourSchedulingPath } from "@/lib/tours/public-link";

describe("public tour scheduling link", () => {
  it("uses the existing /book/{tour_embed_key} route and rejects a blank key", () => {
    assert.equal(publicTourSchedulingPath("abc key"), "/book/abc%20key");
    assert.equal(publicTourSchedulingPath("  "), null);
    assert.equal(publicTourSchedulingPath(null), null);
  });

  it("calendar copies and previews that path only when online tour booking is offered", () => {
    const calendar = readFileSync(resolve("app/(app)/calendar/page.tsx"), "utf8");
    const card = readFileSync(resolve("components/calendar/share-tour-availability.tsx"), "utf8");
    const book = readFileSync(resolve("app/book/[key]/page.tsx"), "utf8");
    assert.match(calendar, /publicTourSchedulingPath\(tourSettings\.tourEmbedKey\)/);
    assert.match(calendar, /tourSettings\?\.tourSchedulingEnabled/);
    assert.match(card, /Tour availability/);
    assert.match(card, /Let couples choose an available time to schedule a tour\./);
    assert.match(card, /Copy tour link/);
    assert.match(card, /Preview tour scheduling/);
    assert.match(card, /Share this link in emails, texts, and other sales messages\. Couples can choose from your available tour times\./);
    assert.match(card, /Tour link copied\./);
    assert.match(card, /Online tour booking is not offered\./);
    assert.match(card, /\/settings\/availability#tour-availability/);
    assert.match(card, /href=\{url\}/);
    assert.doesNotMatch(card, /Tour Sign-Up|schedule a new|\/tours\//);
    assert.match(book, /InquiryForm/);
    assert.match(book, /initialMode="schedule_tour"/);
    assert.match(book, /tour_scheduling_enabled", true/);
  });

  it("does not add a second scheduler", () => {
    const card = readFileSync(resolve("components/calendar/share-tour-availability.tsx"), "utf8");
    assert.doesNotMatch(card, /get_tour_slots|tour_availability_windows|book_tour/);
    const settings = readFileSync(resolve("components/settings/tour-settings-section.tsx"), "utf8");
    const qr = readFileSync(resolve("app/qr/[code]/route.ts"), "utf8");
    assert.match(settings, /publicTourSchedulingPath/);
    assert.match(qr, /publicTourSchedulingPath/);
    assert.doesNotMatch(settings, /\/book\/\$\{s\.tourEmbedKey\}/);
  });
});
