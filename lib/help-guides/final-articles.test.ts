/**
 * Help & Guides final content pack — IA order, counts, and path guards.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { HELP_GUIDE_AREAS, HELP_GUIDES_TAGLINE } from "@/lib/help-guides/areas";
import {
  BLOCKED_HELP_ARTICLES,
  FINAL_HELP_ARTICLES,
  FINAL_HELP_CATEGORY_ORDER,
  HELP_GUIDES_LANDING_TAGLINE,
  PUBLISHABLE_HELP_ARTICLES,
} from "@/lib/help-guides/final-articles";

describe("Help & Guides final IA", () => {
  it("locks the 11 category order and excludes Guided Journeys", () => {
    assert.deepEqual(
      HELP_GUIDE_AREAS.map((a) => a.category),
      [...FINAL_HELP_CATEGORY_ORDER],
    );
    assert.equal(HELP_GUIDE_AREAS.length, 11);
    assert.ok(!HELP_GUIDE_AREAS.some((a) => a.category === "Guided Journeys"));
  });

  it("uses the exact landing tagline", () => {
    assert.equal(HELP_GUIDES_TAGLINE, HELP_GUIDES_LANDING_TAGLINE);
    assert.match(HELP_GUIDES_TAGLINE, /start with Getting Started if you're new here/);
  });

  it("publishes all 31 editorial articles with none blocked", () => {
    assert.equal(FINAL_HELP_ARTICLES.length, 31);
    assert.equal(PUBLISHABLE_HELP_ARTICLES.length, 31);
    assert.equal(BLOCKED_HELP_ARTICLES.length, 0);
    assert.ok(FINAL_HELP_ARTICLES.every((a) => !a.blocked));
  });

  it("keeps exact titles for every editorial article", () => {
    const titles = FINAL_HELP_ARTICLES.map((a) => a.title);
    assert.ok(titles.includes("Getting Started: Your First Morning"));
    assert.ok(titles.includes("How Should I Read My Reports?"));
    assert.ok(titles.includes("What Happens After an Event?"));
    assert.equal(new Set(titles).size, 31);
    assert.equal(new Set(FINAL_HELP_ARTICLES.map((a) => a.slug)).size, 31);
  });

  it("does not publish stale Reporting or Booking language in publishable bodies", () => {
    for (const a of PUBLISHABLE_HELP_ARTICLES) {
      assert.doesNotMatch(a.body, /Financially Committed/);
      assert.doesNotMatch(a.body, /coming soon/i);
      assert.doesNotMatch(a.body, /Guided Journeys/);
    }
    const reports = PUBLISHABLE_HELP_ARTICLES.find((a) => a.slug === "how-should-i-read-my-reports");
    assert.ok(reports);
    assert.match(reports.body, /Contracted, Collected, and Outstanding/);
    const leadClient = PUBLISHABLE_HELP_ARTICLES.find((a) => a.slug === "whats-the-difference-between-a-lead-and-a-client");
    assert.ok(leadClient);
    assert.match(leadClient.body, /Booked does not automatically mean the contract is signed/);
  });

  it("matches expected publishable counts per category", () => {
    const expected: Record<string, number> = {
      "Getting Started": 2,
      "Your Venue": 2,
      "Finding & Booking Clients": 4,
      "Working With Clients": 2,
      "Contracts & Payments": 5,
      "Building the Event": 3,
      "Planning the Event": 7,
      Vendors: 1,
      "Event Day": 2,
      Reports: 2,
      "After the Event": 1,
    };
    const counts: Record<string, number> = {};
    for (const a of PUBLISHABLE_HELP_ARTICLES) {
      counts[a.category] = (counts[a.category] ?? 0) + 1;
    }
    assert.deepEqual(counts, expected);
  });

  it("uses verified Settings paths for Tour Availability and online payments", () => {
    const tour = FINAL_HELP_ARTICLES.find((a) => a.slug === "how-do-i-set-my-tour-availability");
    assert.ok(tour);
    assert.match(tour.body, /Your Venue → Settings → Availability & Capacity/);
    assert.doesNotMatch(tour.body, /Your Venue → Settings → Tour Scheduling/);
    assert.match(tour.body, /Business Hours/);
    assert.match(tour.body, /Tour Availability/);

    const pay = FINAL_HELP_ARTICLES.find((a) => a.slug === "can-couples-pay-online");
    assert.ok(pay);
    assert.match(pay.body, /Your Venue → Settings → Financials & Integrations/);
    assert.doesNotMatch(pay.body, /Your Venue → Settings → Payments/);
    assert.match(pay.body, /Online Payment Collection/);
    assert.match(pay.body, /Stripe/);
  });

  it("migration publishes all 31 final slugs and omits stale paths", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261386000000_help_guides_final_content.sql"),
      "utf8",
    );
    assert.match(sql, /delete from public\.success_library_articles/);
    for (const a of FINAL_HELP_ARTICLES) {
      assert.match(sql, new RegExp(`'${a.slug.replace(/-/g, "\\-")}'`));
    }
    assert.doesNotMatch(sql, /Your Venue → Settings → Tour Scheduling/);
    assert.doesNotMatch(sql, /Your Venue → Settings → Payments(?![\w])/);
    // Allow "Payments" in other contexts; forbid the exact stale Settings path.
    assert.doesNotMatch(sql, /Settings → Payments/);
    assert.match(sql, /Availability & Capacity/);
    assert.match(sql, /Financials & Integrations/);
  });
});
