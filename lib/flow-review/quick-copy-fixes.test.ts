/**
 * Flow-review quick copy fixes:
 * 4 — stale "does not reserve stock"
 * 10 — stock dates missing year
 * 11 — proposal "setup setup"
 * 12 — couple choice block not in its section
 * 13 — Documents said "Reviewed"
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { inclusionUnitLabel } from "@/lib/commercial-proposals/inclusion-display";
import { matchChoiceGroupsToSections } from "@/lib/event-orders/document-view";
import { formatStockDate } from "@/lib/inventory/reservations";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("4 — inventory link copy tells when stock is reserved", () => {
  it("Offerings library, Offerings page, and EO Templates no longer say linking does not reserve", () => {
    for (const path of [
      "components/offerings/offerings-library-section.tsx",
      "components/offerings/offerings-page-client.tsx",
      "app/(app)/library/event-order-templates/page.tsx",
    ]) {
      const src = read(path);
      assert.doesNotMatch(src, /does not reserve stock/i);
      assert.match(src, /approves the Event Order/);
    }
  });
});

describe("10 — stock dates include the year", () => {
  it("formatStockDate shows month, day, and year", () => {
    assert.equal(formatStockDate("2056-06-12"), "Jun 12, 2056");
    assert.equal(formatStockDate("2058-07-14"), "Jul 14, 2058");
  });
});

describe("11 — proposal inclusions do not repeat the unit", () => {
  it("drops unit when the description already ends with it", () => {
    assert.equal(inclusionUnitLabel("Ceremony seating furniture setup", "setup"), null);
    assert.equal(inclusionUnitLabel("Reception tables and chairs setup", "setup"), null);
    assert.equal(inclusionUnitLabel("Day-of venue contact", "event"), "event");
    assert.equal(inclusionUnitLabel("Chiavari chairs", "each"), "each");
  });
  it("proposal surfaces use the helper", () => {
    for (const path of [
      "components/booking-journey/proposal-artifact.tsx",
      "components/booking-journey/multi-option-proposal-view.tsx",
      "components/booking-journey/select-package-sheet.tsx",
    ]) {
      assert.match(read(path), /inclusionUnitLabel\(/);
    }
  });
});

describe("12 — unlinked choice groups still land in their named section", () => {
  it("Bar package with no sectionName still matches Bar", () => {
    const { bySectionId, unmatched } = matchChoiceGroupsToSections(
      [{ id: "g", name: "Bar package", sectionName: null }],
      [{ id: "s-bar", name: "Bar" }, { id: "s-cat", name: "Catering" }],
    );
    assert.deepEqual(bySectionId.get("s-bar")?.map((g) => g.id), ["g"]);
    assert.equal(unmatched.length, 0);
  });
  it("couple document and apply path pass the group name into the matcher", () => {
    assert.match(read("components/event-orders/event-order-document-view.tsx"), /name: g\.name/);
    assert.match(read("lib/client-choices/apply-core.ts"), /name: g\.name/);
  });
});

describe("13 — Documents badge for an approved Event Order", () => {
  it("says Approved, not Reviewed", () => {
    const src = read("components/portal/couple-documents-section.tsx");
    assert.match(src, /agreed \? "Approved" : "Shared"/);
    assert.doesNotMatch(src, /agreed \? "Reviewed"/);
  });
});
