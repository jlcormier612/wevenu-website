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

  it("publishes all 32 editorial articles with none blocked", () => {
    assert.equal(FINAL_HELP_ARTICLES.length, 32);
    assert.equal(PUBLISHABLE_HELP_ARTICLES.length, 32);
    assert.equal(BLOCKED_HELP_ARTICLES.length, 0);
    assert.ok(FINAL_HELP_ARTICLES.every((a) => !a.blocked));
  });

  it("keeps exact titles for every editorial article", () => {
    const titles = FINAL_HELP_ARTICLES.map((a) => a.title);
    assert.ok(titles.includes("Getting Started: Your First Morning"));
    assert.ok(titles.includes("How Should I Read My Reports?"));
    assert.ok(titles.includes("What Happens After an Event?"));
    assert.equal(new Set(titles).size, 32);
    assert.equal(new Set(FINAL_HELP_ARTICLES.map((a) => a.slug)).size, 32);
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
    assert.match(leadClient.body, /A \*\*Client\*\* is a Lead who has become a booking/);
    assert.match(leadClient.body, /You decide what "booked" means for your venue/);
    assert.doesNotMatch(leadClient.body, /client\/event workspace/);
    assert.doesNotMatch(leadClient.body, /Booked does not automatically mean the contract is signed/);
  });

  it("matches expected publishable counts per category", () => {
    const expected: Record<string, number> = {
      "Getting Started": 2,
      "Your Venue": 2,
      "Finding & Booking Clients": 5,
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

  it("historical seed published 31 slugs and omitted the later Date Availability article", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261386000000_help_guides_final_content.sql"),
      "utf8",
    );
    assert.match(sql, /delete from public\.success_library_articles/);
    const historical = FINAL_HELP_ARTICLES.filter((a) => a.slug !== "how-does-date-availability-work");
    for (const a of historical) {
      assert.match(sql, new RegExp(`'${a.slug.replace(/-/g, "\\-")}'`));
    }
    assert.doesNotMatch(sql, /Your Venue → Settings → Tour Scheduling/);
    assert.doesNotMatch(sql, /Your Venue → Settings → Payments(?![\w])/);
    // Allow "Payments" in other contexts; forbid the exact stale Settings path.
    assert.doesNotMatch(sql, /Settings → Payments/);
    assert.match(sql, /Availability & Capacity/);
    assert.match(sql, /Financials & Integrations/);
  });

  it("lead/client booking terminology migration uses approved venue-centric copy", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20261401700000_help_lead_client_booking_terminology.sql",
      ),
      "utf8",
    );
    assert.match(sql, /whats-the-difference-between-a-lead-and-a-client/);
    assert.match(sql, /A \*\*Client\*\* is a Lead who has become a booking/);
    assert.match(sql, /You decide what "booked" means for your venue/);
    assert.doesNotMatch(sql, /client\/event workspace/);
  });

  it("Vendors article describes invite, portal ownership, and shared event context", () => {
    const vendors = FINAL_HELP_ARTICLES.filter(
      (a) => a.title === "How Do Vendors Work in Hello to Cheers?",
    );
    assert.equal(vendors.length, 1);
    const body = vendors[0].body;
    assert.match(body, /Vendors can be invited into Hello to Cheers/);
    assert.match(body, /their own portal/);
    assert.match(body, /Vendor = owns their information/);
    assert.match(body, /when appropriate/);
    assert.doesNotMatch(body, /three layers/);
    assert.doesNotMatch(body, /\bdirectory\b/i);
    assert.doesNotMatch(body, /system of record|domain model|synchronization/i);

    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261402300000_help_vendors_portal_guidance.sql"),
      "utf8",
    );
    assert.match(sql, /how-do-vendors-work-in-hello-to-cheers/);
    assert.match(sql, /Vendor = owns their information/);
    assert.doesNotMatch(sql, /insert into public\.success_library_articles/);
  });

  it("Guidance Library copy uses templates, not definitions, in the two package-difference articles", () => {
    const inventory = FINAL_HELP_ARTICLES.find(
      (a) => a.slug === "whats-the-difference-between-a-package-inventory-and-an-inventory-template",
    );
    const payment = FINAL_HELP_ARTICLES.find(
      (a) => a.slug === "whats-the-difference-between-a-package-payment-schedule-and-payment",
    );
    assert.ok(inventory);
    assert.ok(payment);
    assert.match(inventory.body, /\*\*Library = reusable templates\.\*\*/);
    assert.doesNotMatch(inventory.body, /\bdefinitions?\b/i);
    assert.match(payment.body, /The Library holds reusable templates such as Packages/);
    assert.match(
      payment.body,
      /changing a reusable Library template should not silently rewrite/,
    );
    assert.doesNotMatch(payment.body, /\bdefinitions?\b/i);

    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20261402200000_help_guidance_library_templates_copy.sql",
      ),
      "utf8",
    );
    assert.match(sql, /Library = reusable templates/);
    assert.match(sql, /holds reusable templates such as Packages/);
    assert.match(sql, /reusable Library template should not silently rewrite/);
  });
});
