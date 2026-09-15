import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { eventTypeLabel, normalizeEventType } from "@/lib/event-types/canonical";
import { isInternalVerificationIdentity } from "@/lib/reporting/internal-verification";

describe("internal verification classification", () => {
  it("classifies known E2E / release fixtures and never Colby Yagnesak or Ellie Yagnesak", () => {
    assert.equal(isInternalVerificationIdentity({
      firstName: "PHASE7 TEST", lastName: "Booking Prepare", email: "phase7.booking.prepare@example.com",
    }), true);
    assert.equal(isInternalVerificationIdentity({
      firstName: "PathA", lastName: "LiveOffer", email: "patha.live.offer.1788731201@example.com",
    }), true);
    assert.equal(isInternalVerificationIdentity({
      firstName: "ZZCleanup", lastName: "734565", email: "zz-cleanup-inbox-cert@example.com",
    }), true);
    assert.equal(isInternalVerificationIdentity({
      firstName: "Colby", lastName: "SpineE2E", partnerFirstName: "Nicole",
      email: "commercial-spine-e2e-colby@hellotocheers.com",
    }), true);
    assert.equal(isInternalVerificationIdentity({
      extraName: "release_readiness_a",
    }), true);
    assert.equal(isInternalVerificationIdentity({
      extraName: "block_a_verify",
    }), true);
    assert.equal(isInternalVerificationIdentity({
      firstName: "Colby", lastName: "Yagnesak", partnerFirstName: "Nicole",
      email: "jyagnesak@yahoo.com",
    }), false);
    assert.equal(isInternalVerificationIdentity({
      firstName: "Ellie", lastName: "Yagnesak", partnerFirstName: "Hunter",
      email: "jyagnesak@yahoo.com",
    }), false);
    assert.equal(isInternalVerificationIdentity({
      firstName: "Buppy", lastName: "Robicheau", partnerFirstName: "Joy",
    }), false);
    assert.equal(isInternalVerificationIdentity({
      firstName: "Ron", lastName: "Cormier", partnerFirstName: "Jen",
    }), false);
  });
});

describe("event type grouping", () => {
  it("normalizes Wedding and wedding to the same canonical key", () => {
    assert.equal(normalizeEventType("Wedding"), "wedding");
    assert.equal(normalizeEventType("wedding"), "wedding");
    const rows = ["wedding", "Wedding", null] as Array<string | null>;
    const map = new Map<string, { label: string; count: number }>();
    for (const raw of rows) {
      const canonical = normalizeEventType(raw);
      const key = canonical ?? "unspecified";
      const label = canonical ? (eventTypeLabel(canonical) || canonical) : "Not recorded";
      const cur = map.get(key) ?? { label, count: 0 };
      cur.count += 1;
      map.set(key, cur);
    }
    assert.equal(map.get("wedding")?.count, 2);
    assert.equal(map.get("wedding")?.label, "Wedding");
    assert.equal(map.get("unspecified")?.count, 1);
  });
});

describe("customer-facing reporting copy", () => {
  const sales = readFileSync(resolve("app/(app)/reporting/sales/page.tsx"), "utf8");
  const overview = readFileSync(resolve("app/(app)/reporting/page.tsx"), "utf8");
  const revenue = readFileSync(resolve("app/(app)/reporting/revenue/page.tsx"), "utf8");
  const bookings = readFileSync(resolve("app/(app)/reporting/bookings/page.tsx"), "utf8");
  const dashboard = readFileSync(resolve("app/(app)/dashboard/page.tsx"), "utf8");
  const migration = readFileSync(resolve("supabase/migrations/20261397000000_reporting_business_record_boundary.sql"), "utf8");

  it("does not expose Eventually Booked, UTM, or top-of-funnel clues", () => {
    assert.doesNotMatch(sales, /Eventually booked/);
    assert.doesNotMatch(sales, /Top-of-funnel/);
    assert.doesNotMatch(sales, /UTM /);
    assert.doesNotMatch(sales, /getLeadTopOfFunnelEvidence/);
    assert.match(sales, /Leads who booked/);
    assert.match(sales, />Conversion</);
    assert.match(sales, /detail: "period-bookings"/);
    assert.match(sales, /detail: "period-tours"/);
    assert.match(sales, /detail: "stage:booked"/);
    assert.doesNotMatch(sales, /acquisition source/);
    assert.doesNotMatch(overview, /acquisition source/);
    assert.doesNotMatch(bookings, /acquisition source/);
    assert.doesNotMatch(revenue, /Revenue by acquisition source/);
    assert.match(revenue, /Revenue by source/);
  });

  it("preserves date range on Overview drill-downs", () => {
    assert.match(overview, /reportingHref\("\/reporting\/sales"/);
    assert.match(overview, /reportingHref\("\/reporting\/bookings"/);
    assert.match(overview, /reportingHref\("\/reporting\/revenue"/);
  });

  it("does not show a single-category revenue breakdown", () => {
    assert.match(revenue, /usefulCategories\.length < 2/);
  });

  it("Bookings page Card tags are balanced so production build can parse", () => {
    const opens = bookings.match(/<Card[\s>]/g)?.length ?? 0;
    const closes = bookings.match(/<\/Card>/g)?.length ?? 0;
    assert.equal(opens, closes);
  });

  it("Dashboard snapshot cards drill into the same populations", () => {
    assert.match(dashboard, /\/leads\?attention=active/);
    assert.match(dashboard, /\/payments\?filter=attention/);
    assert.match(dashboard, /clientListFilterHref\("coming_up"\)/);
    assert.match(dashboard, /Events in the next 60 days/);
  });

  it("SQL reporting RPCs exclude exclude_from_business_reporting", () => {
    assert.match(migration, /exclude_from_business_reporting = false/);
    assert.match(migration, /is_internal_verification_identity/);
    assert.match(migration, /canonical_conversion_funnel/);
    assert.match(migration, /canonical_gross_booked_revenue/);
    assert.match(migration, /generate_venue_recommendations/);
    assert.match(migration, /coalesce\(exclude_from_business_reporting, false\) = false/);
  });
});
