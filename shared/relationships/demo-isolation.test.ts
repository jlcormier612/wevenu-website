import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DISPOSABLE_FIXTURE_GUIDE,
  filterOperationalRelationships,
  isOperationalRelationship,
  isSandboxDemoVenueId,
  resolveCrmRole,
  stampCrmIsolation,
  SANDBOX_DEMO_VENUE_IDS,
  SANDBOX_DEMO_STRIPE_CUSTOMER_IDS,
} from "./demo-isolation.ts";

const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";

describe("demo-isolation registry", () => {
  it("includes Fancy and nine theater venues", () => {
    assert.equal(SANDBOX_DEMO_VENUE_IDS.size, 10);
    assert.equal(isSandboxDemoVenueId(FANCY), true);
    assert.equal(isSandboxDemoVenueId("00000000-0000-0000-0000-000000000000"), false);
  });

  it("does not treat arbitrary Sandbox venues as demo", () => {
    assert.equal(
      resolveCrmRole({
        venue: { name: "Brand New Sandbox Venue" },
        owner: { email: "owner@example.com" },
        productSync: { venueId: "11111111-2222-3333-4444-555555555555" },
      }),
      "customer",
    );
  });
});

describe("crmRole resolution", () => {
  it("classifies Fancy-bound relationships as sandbox_demo", () => {
    assert.equal(
      resolveCrmRole({
        productSync: { venueId: FANCY },
        venue: { name: "Jen's Fancy Venue" },
      }),
      "sandbox_demo",
    );
  });

  it("classifies known demo Stripe customers as sandbox_demo", () => {
    const cus = [...SANDBOX_DEMO_STRIPE_CUSTOMER_IDS][0];
    assert.equal(
      resolveCrmRole({ stripeCustomerId: cus, venue: { name: "Theater" } }),
      "sandbox_demo",
    );
  });

  it("classifies disposable name/email ahead of demo venue", () => {
    assert.equal(
      resolveCrmRole(
        {
          productSync: { venueId: FANCY },
          venue: { name: "[DISPOSABLE-QA-1] Fancy Probe" },
          owner: { email: "qa+disposable@hellotocheers.com" },
        },
      ),
      "disposable",
    );
  });

  it("stamps without wiping disposable", () => {
    const r = {
      crmRole: "disposable" as const,
      productSync: { venueId: FANCY },
      venue: { name: "[DISPOSABLE-X] Keep" },
    };
    stampCrmIsolation(r, { productVenueId: FANCY });
    assert.equal(r.crmRole, "disposable");
  });

  it("filters operational MRR parents", () => {
    const rows = [
      {
        id: "rel_demo",
        crmRole: "sandbox_demo" as const,
        productSync: { venueId: FANCY },
      },
      {
        id: "rel_real",
        venue: { name: "Fresh Checkout Venue" },
        owner: { email: "buyer@venue.test" },
      },
      {
        id: "rel_disp",
        venue: { name: `${DISPOSABLE_FIXTURE_GUIDE.venueNamePrefix}Temp` },
        owner: { email: "temp+disposable@hellotocheers.com" },
      },
    ];
    const ops = filterOperationalRelationships(rows);
    assert.deepEqual(
      ops.map((r) => r.id),
      ["rel_real"],
    );
    assert.equal(isOperationalRelationship(rows[0]), false);
    assert.equal(isOperationalRelationship(rows[1]), true);
  });
});
