/**
 * Batch 3.1 — venue identity matching regression.
 * File-store fixtures only; does not touch Sandbox Postgres or Fancy.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  ingestCheckoutStarted,
  ingestContactForm,
  ingestSubscriptionPurchased,
  ingestWalkthroughRequest,
} from "./ingest";
import {
  emptyLiveStore,
  loadLiveStore,
  saveLiveStore,
  withLiveStore,
} from "./store";
import {
  PROVISIONAL_VENUE_NAME,
  findOrCreateRelationship,
} from "./service";

const prevStore = process.env.HTC_CRM_STORE;
const prevPath = process.env.RELATIONSHIPS_DATA_PATH;
const dataDir = mkdtempSync(path.join(tmpdir(), "htc-venue-identity-"));

before(() => {
  process.env.HTC_CRM_STORE = "file";
  process.env.RELATIONSHIPS_DATA_PATH = dataDir;
});

after(() => {
  if (prevStore === undefined) delete process.env.HTC_CRM_STORE;
  else process.env.HTC_CRM_STORE = prevStore;
  if (prevPath === undefined) delete process.env.RELATIONSHIPS_DATA_PATH;
  else process.env.RELATIONSHIPS_DATA_PATH = prevPath;
  rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await saveLiveStore(emptyLiveStore());
});

describe("Batch 3.1 venue identity matching", () => {
  it("1. same email + same venue → relationship continuity", async () => {
    const first = await ingestContactForm({
      email: "owner@example.com",
      name: "Alex Owner",
      venueName: "Alpha Hall",
      message: "first",
    });
    const second = await ingestContactForm({
      email: "owner@example.com",
      name: "Alex Owner",
      venueName: "Alpha Hall",
      message: "returning",
    });
    assert.equal(second.relationship.id, first.relationship.id);
    assert.equal(second.created, false);
    const store = await loadLiveStore();
    assert.equal(
      store.relationships.filter((r) => r.owner.email === "owner@example.com")
        .length,
      1,
    );
  });

  it("2. same email + different venues → separate relationships", async () => {
    const alpha = await ingestContactForm({
      email: "shared@example.com",
      name: "Sam Shared",
      venueName: "Venue Alpha",
      message: "alpha",
    });
    const beta = await ingestContactForm({
      email: "shared@example.com",
      name: "Sam Shared",
      venueName: "Venue Beta",
      message: "beta",
    });
    assert.notEqual(alpha.relationship.id, beta.relationship.id);
    assert.equal(beta.created, true);
    assert.equal(alpha.relationship.venue.name, "Venue Alpha");
    assert.equal(beta.relationship.venue.name, "Venue Beta");
    assert.match(beta.relationship.notes || "", /Same contact email/);
    const store = await loadLiveStore();
    assert.equal(store.relationships.length, 2);
  });

  it("3. different emails + same venue → no unsafe automatic merge", async () => {
    const a = await ingestContactForm({
      email: "one@example.com",
      name: "One",
      venueName: "Shared Barn",
      message: "a",
    });
    const b = await ingestContactForm({
      email: "two@example.com",
      name: "Two",
      venueName: "Shared Barn",
      message: "b",
    });
    assert.notEqual(a.relationship.id, b.relationship.id);
    assert.equal(a.relationship.venue.name, "Shared Barn");
    assert.equal(b.relationship.venue.name, "Shared Barn");
  });

  it("4. same venue + contact name change → no overwrite of existing name", async () => {
    const first = await ingestContactForm({
      email: "rename@example.com",
      name: "Original Name",
      venueName: "Stable Venue",
      message: "first",
    });
    const second = await ingestContactForm({
      email: "rename@example.com",
      name: "Changed Name",
      venueName: "Stable Venue",
      message: "second",
    });
    assert.equal(second.relationship.id, first.relationship.id);
    assert.equal(second.relationship.owner.firstName, "Original");
    assert.equal(second.relationship.owner.lastName, "Name");
  });

  it("5. missing venue name → inquiry preserved as provisional without merging named venues", async () => {
    const named = await ingestContactForm({
      email: "miss@example.com",
      name: "Miss Venue",
      venueName: "Named Estate",
      message: "named",
    });
    const missing = await findOrCreateRelationship({
      email: "miss@example.com",
      firstName: "Miss",
      lastName: "Venue",
    });
    assert.equal(missing.created, true);
    assert.notEqual(missing.relationship.id, named.relationship.id);
    assert.equal(missing.relationship.venue.name, PROVISIONAL_VENUE_NAME);

    const again = await findOrCreateRelationship({
      email: "miss@example.com",
    });
    assert.equal(again.created, false);
    assert.equal(again.relationship.id, missing.relationship.id);
  });

  it("6. Calendly booking after contact form → correct venue relationship", async () => {
    const contact = await ingestContactForm({
      email: "cal@example.com",
      name: "Cal Lead",
      venueName: "Calendly Garden",
      message: "contact first",
    });
    const booked = await ingestWalkthroughRequest({
      email: "cal@example.com",
      name: "Cal Lead",
      venueName: "Calendly Garden",
      scheduledAt: "2026-12-15T17:00:00.000Z",
      sourceId: "https://api.calendly.com/scheduled_events/EVT/invitees/INV",
      referralSource: "Calendly",
    });
    assert.equal(booked.relationship.id, contact.relationship.id);
    assert.equal(booked.relationship.salesStage, "walkthrough_scheduled");
    const store = await loadLiveStore();
    assert.equal(
      store.walkthroughs.filter((w) => w.relationshipId === contact.relationship.id)
        .length,
      1,
    );
  });

  it("7. duplicate webhook/submission → idempotent", async () => {
    const sourceId =
      "https://api.calendly.com/scheduled_events/DUP/invitees/ONE";
    const first = await ingestWalkthroughRequest({
      email: "dup@example.com",
      name: "Dup",
      venueName: "Dup Venue",
      scheduledAt: "2026-12-20T18:00:00.000Z",
      sourceId,
      referralSource: "Calendly",
    });
    const second = await ingestWalkthroughRequest({
      email: "dup@example.com",
      name: "Dup",
      venueName: "Dup Venue",
      scheduledAt: "2026-12-20T18:00:00.000Z",
      sourceId,
      referralSource: "Calendly",
    });
    assert.equal(second.relationship.id, first.relationship.id);
    const store = await loadLiveStore();
    const scheduled = store.timelineEvents.filter(
      (e) =>
        e.relationshipId === first.relationship.id &&
        e.type === "walkthrough_scheduled" &&
        String(e.meta?.sourceId ?? "") === sourceId,
    );
    assert.equal(scheduled.length, 1);
    assert.equal(store.relationships.length, 1);
  });

  it("8. subscription checkout after lead creation → correct venue association", async () => {
    const lead = await ingestContactForm({
      email: "buy@example.com",
      name: "Buyer",
      venueName: "Purchase Hall",
      message: "lead",
    });
    await ingestCheckoutStarted({
      email: "buy@example.com",
      venueName: "Purchase Hall",
      plan: "starter",
      checkoutSessionId: "cs_test_purchase_hall",
    });
    const purchased = await ingestSubscriptionPurchased({
      email: "buy@example.com",
      venueName: "Purchase Hall",
      plan: "starter",
      foundingMember: false,
      welcomeBackRequested: false,
      onboardingType: "self_guided",
      stripeCustomerId: "cus_test_purchase_hall",
      stripeSubscriptionId: "sub_test_purchase_hall",
      stripeCheckoutSessionId: "cs_test_purchase_hall",
    });
    assert.equal(purchased.relationship.id, lead.relationship.id);
    assert.equal(purchased.relationship.venue.name, "Purchase Hall");
  });

  it("9. two venues managed by one organization → independent relationships", async () => {
    const east = await ingestContactForm({
      email: "org@example.com",
      name: "Org Admin",
      venueName: "Org East Ballroom",
      message: "east",
    });
    const west = await ingestContactForm({
      email: "org@example.com",
      name: "Org Admin",
      venueName: "Org West Loft",
      message: "west",
    });
    assert.notEqual(east.relationship.id, west.relationship.id);
    const eastAgain = await ingestContactForm({
      email: "org@example.com",
      name: "Org Admin",
      venueName: "Org East Ballroom",
      message: "east return",
    });
    assert.equal(eastAgain.relationship.id, east.relationship.id);
    assert.notEqual(eastAgain.relationship.id, west.relationship.id);
  });

  it("10. Fancy-like sandbox_demo row is not mutated by unrelated email/venue intake", async () => {
    const fancy = await findOrCreateRelationship({
      email: "jennifer@hellotocheers.com",
      venueName: "Jen's Fancy Venue",
      firstName: "Jennifer",
      lastName: "Cormier",
    });
    await withLiveStore((store) => {
      const row = store.relationships.find((r) => r.id === fancy.relationship.id);
      if (row) (row as { crmRole?: string }).crmRole = "sandbox_demo";
    });
    const beforeStore = await loadLiveStore();
    const before = JSON.parse(
      JSON.stringify(
        beforeStore.relationships.find((r) => r.id === fancy.relationship.id),
      ),
    );

    await ingestContactForm({
      email: "jennifer@hellotocheers.com",
      name: "Other Person",
      venueName: "Completely Different Venue",
      message: "must not merge into fancy",
    });

    const store = await loadLiveStore();
    const fancyAfter = store.relationships.find((r) => r.id === fancy.relationship.id)!;
    assert.equal(fancyAfter.venue.name, before.venue.name);
    assert.equal(fancyAfter.owner.email, before.owner.email);
    assert.equal(fancyAfter.owner.firstName, before.owner.firstName);
    assert.equal((fancyAfter as { crmRole?: string }).crmRole, "sandbox_demo");
    assert.equal(store.relationships.length, 2);
  });
});
