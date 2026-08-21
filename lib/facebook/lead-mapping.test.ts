import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  META_INTAKE_SOURCE,
  acquisitionSourceFromPlatform,
  isStaleProcessing,
  leadSourceKeyFromPlatform,
  leadgenFetchPath,
  mapFacebookFieldData,
  mapGraphLeadToIntake,
} from "@/lib/facebook/lead-mapping";

describe("Meta platform → acquisition source", () => {
  it("treats platform=ig as Instagram", () => {
    assert.equal(acquisitionSourceFromPlatform("ig"), "instagram");
    assert.equal(leadSourceKeyFromPlatform("IG"), "instagram");
  });

  it("does not guess Instagram from a missing or Facebook platform", () => {
    assert.equal(acquisitionSourceFromPlatform(null), "facebook");
    assert.equal(acquisitionSourceFromPlatform("fb"), "facebook");
    assert.equal(acquisitionSourceFromPlatform("unknown"), "facebook");
    assert.equal(leadSourceKeyFromPlatform("fb"), META_INTAKE_SOURCE);
  });
});

describe("sourceLabel for webhook-created leads", () => {
  it("shows Facebook Lead Ads and Instagram, not a raw registry key", async () => {
    const { sourceLabel } = await import("@/lib/leads/constants");
    assert.equal(sourceLabel("facebook_lead_ads"), "Facebook Lead Ads");
    assert.equal(sourceLabel("instagram"), "Instagram");
  });
});

describe("mapFacebookFieldData", () => {
  it("maps Meta Instant Form field names into the canonical intake shape", () => {
    const input = mapFacebookFieldData([
      { name: "full_name", values: ["Ada Lovelace"] },
      { name: "email", values: ["ada@example.com"] },
      { name: "phone_number", values: ["555-0100"] },
      { name: "event_date", values: ["2026-10-10"] },
      { name: "Favorite color", values: ["green"] },
    ]);
    assert.equal(input.firstName, "Ada");
    assert.equal(input.lastName, "Lovelace");
    assert.equal(input.email, "ada@example.com");
    assert.equal(input.phone, "555-0100");
    assert.equal(input.eventDate, "2026-10-10");
    assert.equal((input.sourceData ?? {})["Favorite color"], "green");
  });
});

describe("mapGraphLeadToIntake", () => {
  it("preserves Meta identifiers and Instagram placement when platform=ig", () => {
    const { input, leadSource } = mapGraphLeadToIntake(
      {
        id: "lead-1",
        platform: "ig",
        form_id: "form-9",
        ad_id: "ad-3",
        campaign_id: "camp-2",
        campaign_name: "Spring Open House",
        field_data: [
          { name: "first_name", values: ["Grace"] },
          { name: "last_name", values: ["Hopper"] },
          { name: "email", values: ["grace@example.com"] },
        ],
      },
      { leadgenId: "lead-1", formId: "form-9", pageId: "page-4" },
    );
    assert.equal(leadSource, "instagram");
    assert.equal(input.firstName, "Grace");
    assert.equal(input.email, "grace@example.com");
    const meta = input.sourceData ?? {};
    assert.equal(meta.intake_mechanism, "meta_webhook");
    assert.equal(meta.acquisition_source, "instagram");
    assert.equal(meta.platform, "ig");
    assert.equal(meta.leadgen_id, "lead-1");
    assert.equal(meta.page_id, "page-4");
    assert.equal(meta.campaign_name, "Spring Open House");
  });

  it("labels Facebook Lead Ads when Meta does not say Instagram", () => {
    const { leadSource, input } = mapGraphLeadToIntake(
      { id: "lead-2", platform: "fb", field_data: [{ name: "email", values: ["a@b.com"] }] },
      { leadgenId: "lead-2", formId: "form-1", pageId: "page-1" },
    );
    assert.equal(leadSource, META_INTAKE_SOURCE);
    assert.equal((input.sourceData ?? {}).acquisition_source, "facebook");
  });
});

describe("stale processing reclaim", () => {
  it("treats a processing row older than the stale window as crashed", () => {
    const now = Date.parse("2026-08-20T01:00:00.000Z");
    assert.equal(isStaleProcessing("2026-08-20T00:50:00.000Z", now), true);
    assert.equal(isStaleProcessing("2026-08-20T00:58:00.000Z", now), false);
    assert.equal(isStaleProcessing(null, now), true);
  });
});

describe("B2 processor wiring", () => {
  it("fetches Graph lead fields including platform", () => {
    assert.match(leadgenFetchPath("abc"), /\/abc\?fields=/);
    assert.match(leadgenFetchPath("abc"), /platform/);
    assert.match(leadgenFetchPath("abc"), /field_data/);
  });

  it("processor uses ingest_lead and leadgen_id as external_ref", () => {
    const source = readFileSync(resolve("lib/facebook/processor.ts"), "utf8");
    assert.match(source, /ingestLead\(/);
    assert.match(source, /externalRef: item\.leadgen_id/);
    assert.match(source, /p_source: mapped\.leadSource/);
    assert.match(source, /source: META_INTAKE_SOURCE/);
    assert.match(source, /reclaimStaleProcessing/);
  });

  it("webhook kicks the processor after enqueue without blocking the 200", () => {
    const source = readFileSync(resolve("app/api/facebook/webhook/route.ts"), "utf8");
    assert.match(source, /after\(/);
    assert.match(source, /processFacebookLeadQueue/);
    assert.match(source, /enqueueLead/);
    assert.match(source, /for \(const row of/);
  });

  it("queue rows are unique per venue + leadgen_id across all statuses", () => {
    const sql = readFileSync(resolve("supabase/migrations/20261302000000_facebook_lead_queue_idempotency.sql"), "utf8");
    assert.match(sql, /facebook_lead_queue_venue_leadgen/);
    assert.match(sql, /unique \(venue_id, leadgen_id\)/);
  });
});
