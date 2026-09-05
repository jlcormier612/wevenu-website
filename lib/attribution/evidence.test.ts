/**
 * Phase 2D — evidence helpers and cohort/time-to-book pure math.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeMedianTimeToBookByKey,
  computeSourceCohortRates,
  EVIDENCE_UNKNOWN_KEY,
  EVIDENCE_UNKNOWN_LABEL,
  evidenceGroupKey,
  groupEvidenceCounts,
  normalizeLandingPageForReporting,
  normalizeReferrerHost,
  readSourceDataString,
} from "@/lib/attribution/evidence";
import { median } from "@/lib/attribution/source";
import {
  PHASE_2D_EVIDENCE_AUTHORITY_NOTE,
} from "@/lib/metrics/deeper-attribution";

describe("Phase 2D evidence helpers", () => {
  it("reads non-empty source_data strings only", () => {
    assert.equal(readSourceDataString({ utm_source: "google" }, "utm_source"), "google");
    assert.equal(readSourceDataString({ utm_source: "  " }, "utm_source"), null);
    assert.equal(readSourceDataString({ utm_source: 1 }, "utm_source"), null);
    assert.equal(readSourceDataString(null, "utm_source"), null);
  });

  it("normalizes landing page without inventing values", () => {
    assert.equal(
      normalizeLandingPageForReporting("https://venue.example/weddings?utm_source=x#top"),
      "https://venue.example/weddings",
    );
    assert.equal(normalizeLandingPageForReporting(null), null);
    assert.equal(normalizeLandingPageForReporting(""), null);
    assert.equal(normalizeLandingPageForReporting("/relative/path?x=1"), "/relative/path");
  });

  it("normalizes referrer to host only", () => {
    assert.equal(normalizeReferrerHost("https://www.google.com/search?q=venue"), "www.google.com");
    assert.equal(normalizeReferrerHost(null), null);
    assert.equal(normalizeReferrerHost("instagram.com"), "instagram.com");
  });

  it("keeps Unknown first-class and does not invent Organic/Direct", () => {
    assert.equal(evidenceGroupKey(null), EVIDENCE_UNKNOWN_KEY);
    assert.equal(evidenceGroupKey(""), EVIDENCE_UNKNOWN_KEY);
    const rows = groupEvidenceCounts(["google", null, "google", ""]);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.count]));
    assert.equal(byKey.google, 2);
    assert.equal(byKey[EVIDENCE_UNKNOWN_KEY], 2);
    assert.equal(rows.find((r) => r.key === EVIDENCE_UNKNOWN_KEY)?.label, EVIDENCE_UNKNOWN_LABEL);
    assert.ok(!rows.some((r) => /organic|direct/i.test(r.label) && r.key !== "google"));
  });

  it("caps high-cardinality evidence lists with an Other bucket", () => {
    const values = Array.from({ length: 20 }, (_, i) => `camp-${i}`);
    const rows = groupEvidenceCounts(values, { topN: 5 });
    assert.ok(rows.some((r) => r.key === "__other_evidence__"));
    assert.equal(
      rows.filter((r) => r.key !== "__other_evidence__").length,
      5,
    );
  });

  it("authority note keeps evidence non-causal for venue owners", () => {
    assert.match(PHASE_2D_EVIDENCE_AUTHORITY_NOTE, /not Hello to Cheers/i);
    assert.match(PHASE_2D_EVIDENCE_AUTHORITY_NOTE, /do not mean a campaign caused a booking/i);
    assert.doesNotMatch(PHASE_2D_EVIDENCE_AUTHORITY_NOTE, /source_data|acquisition_source/);
  });
});

describe("Phase 2D cohort and time-to-book by key", () => {
  it("computes Lead→Tour / Lead→Booking / Tour→Booking without inventing rates", () => {
    const rows = computeSourceCohortRates([
      { sourceKey: "website", label: "Website", eventuallyToured: true, eventuallyBooked: true },
      { sourceKey: "website", label: "Website", eventuallyToured: true, eventuallyBooked: false },
      { sourceKey: "website", label: "Website", eventuallyToured: false, eventuallyBooked: false },
      { sourceKey: "unknown", label: EVIDENCE_UNKNOWN_LABEL, eventuallyToured: false, eventuallyBooked: false },
    ]);
    const website = rows.find((r) => r.key === "website")!;
    assert.equal(website.leads, 3);
    assert.equal(website.eventuallyToured, 2);
    assert.equal(website.eventuallyBooked, 1);
    assert.equal(website.touredAndBooked, 1);
    assert.equal(website.leadToTourRate, 67);
    assert.equal(website.leadToBookingRate, 33);
    assert.equal(website.tourToBookingRate, 50);
    assert.equal(rows[rows.length - 1]?.key, "unknown");
  });

  it("Tour→Booking is 0 when nobody toured (no invented denominator story)", () => {
    const rows = computeSourceCohortRates([
      { sourceKey: "instagram", label: "Instagram", eventuallyToured: false, eventuallyBooked: true },
    ]);
    assert.equal(rows[0]!.tourToBookingRate, 0);
    assert.equal(rows[0]!.eventuallyBooked, 1);
  });

  it("median time-to-book by source preserves Unknown and sample sizes", () => {
    const rows = computeMedianTimeToBookByKey(
      [
        { key: "website", label: "Website", days: 10 },
        { key: "website", label: "Website", days: 20 },
        { key: "unknown", label: EVIDENCE_UNKNOWN_LABEL, days: 5 },
      ],
      median,
    );
    const website = rows.find((r) => r.key === "website")!;
    assert.equal(website.medianDays, 15);
    assert.equal(website.sampleSize, 2);
    assert.equal(rows[rows.length - 1]?.key, "unknown");
  });
});
