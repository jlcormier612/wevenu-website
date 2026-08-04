/**
 * Smoke test — Project 10 Product Sync.
 *
 * Usage (repo root):
 *   RELATIONSHIPS_DATA_PATH=./shared/product-sync/.smoke-data/relationships \
 *   PRODUCT_SYNC_DATA_PATH=./shared/product-sync/.smoke-data/provision \
 *   npx tsx shared/product-sync/_smoke.mts
 */

import { mkdir, rm } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const smokeRoot = path.join(here, ".smoke-data");
const relDir = path.join(smokeRoot, "relationships");
const provisionDir = path.join(smokeRoot, "provision");

process.env.RELATIONSHIPS_DATA_PATH = relDir;
process.env.PRODUCT_SYNC_DATA_PATH = provisionDir;
process.env.PRODUCT_SYNC_ADAPTER = "local";

await rm(smokeRoot, { recursive: true, force: true });
await mkdir(relDir, { recursive: true });
await mkdir(provisionDir, { recursive: true });

const { findOrCreateRelationship, updateRelationshipFields } = await import(
  "../relationships"
);
const { syncRelationshipToProduct } = await import("./index");

const { relationship } = await findOrCreateRelationship({
  email: "smoke-product-sync@example.com",
  venueName: "Smoke Sync Barn",
  firstName: "Smoke",
  lastName: "Tester",
  city: "Austin",
  state: "TX",
});

await updateRelationshipFields(relationship.id, {
  status: "subscribed",
  planId: "gather",
  planName: "Gather",
  onboardingType: "self_guided",
});

const first = await syncRelationshipToProduct(relationship.id, {
  trigger: "smoke",
});
const second = await syncRelationshipToProduct(relationship.id, {
  trigger: "smoke-idempotent",
});

const venueA = first.productSync.venueId;
const venueB = second.productSync.venueId;

console.log(
  JSON.stringify(
    {
      relationshipId: relationship.id,
      first: {
        status: first.status,
        ran: first.ran,
        venueId: venueA,
        workspaceId: first.productSync.workspaceId,
        message: first.message,
      },
      second: {
        status: second.status,
        ran: second.ran,
        venueId: venueB,
        message: second.message,
      },
      idempotentVenue: venueA === venueB && Boolean(venueA),
      allStepsCompleted: first.productSync.steps.every(
        (s) => s.status === "completed",
      ),
    },
    null,
    2,
  ),
);

if (first.status !== "completed") {
  throw new Error(`Expected completed, got ${first.status}`);
}
if (venueA !== venueB) {
  throw new Error("Idempotency failed — venue id changed on second run");
}
if (second.ran !== false && second.message.indexOf("Already") < 0) {
  // second may still "run" if we didn't early-return — allow either no-op or skip-all
  const ok =
    second.status === "completed" &&
    second.productSync.venueId === venueA;
  if (!ok) throw new Error("Second run did not preserve completed state");
}

// --- Product → CRM write-back ---
const { syncVenueProfileFromProduct } = await import("./writeback");
const { loadLiveStore } = await import("../relationships");

const writeback = await syncVenueProfileFromProduct({
  venueId: "uuid-real-venue-from-product",
  reason: "setup_submit",
  profile: {
    name: "Coastal Grove Estate",
    city: "Charleston",
    state: "SC",
    website: "coastalgrove.example",
    address: "12 Harbor Lane",
    venueType: "Estate",
    capacity: 180,
    ownerFullName: "Avery Grove",
    ownerEmail: "smoke-product-sync@example.com",
    ownerTitle: "Owner & Host",
    ownerPhone: "555-0100",
  },
});

if (!writeback.ok || !writeback.synced) {
  throw new Error(
    `Write-back failed: ${JSON.stringify(writeback)}`,
  );
}
if (writeback.matchedBy !== "email") {
  throw new Error(`Expected email match (sim venue id), got ${writeback.matchedBy}`);
}

const store = await loadLiveStore();
const refreshed = store.relationships.find((r) => r.id === relationship.id);
if (!refreshed) throw new Error("Relationship missing after write-back");
if (refreshed.venue.name !== "Coastal Grove Estate") {
  throw new Error(`Venue name not overwritten: ${refreshed.venue.name}`);
}
if (refreshed.venue.city !== "Charleston" || refreshed.venue.state !== "SC") {
  throw new Error("Location not overwritten");
}
if (refreshed.venue.venueType !== "Estate" || refreshed.venue.capacity !== 180) {
  throw new Error("Type/capacity not synced");
}
if (refreshed.owner.title !== "Owner & Host") {
  throw new Error(`Owner title not synced: ${refreshed.owner.title}`);
}
if (refreshed.owner.firstName !== "Avery" || refreshed.owner.lastName !== "Grove") {
  throw new Error("Owner name not overwritten");
}
if (refreshed.productSync?.venueId !== "uuid-real-venue-from-product") {
  throw new Error(
    `Expected productSync.venueId rebound to real id, got ${refreshed.productSync?.venueId}`,
  );
}

const timeline = store.timelineEvents.filter(
  (e) =>
    e.relationshipId === relationship.id && e.type === "venue_profile_synced",
);
if (timeline.length < 1) {
  throw new Error("Expected venue_profile_synced timeline event");
}

// Second submit with same data — no spam event when unchanged
const writeback2 = await syncVenueProfileFromProduct({
  venueId: "uuid-real-venue-from-product",
  reason: "setup_submit",
  profile: {
    name: "Coastal Grove Estate",
    city: "Charleston",
    state: "SC",
    website: "https://coastalgrove.example",
    address: "12 Harbor Lane",
    venueType: "Estate",
    capacity: 180,
    ownerFullName: "Avery Grove",
    ownerEmail: "smoke-product-sync@example.com",
    ownerTitle: "Owner & Host",
    ownerPhone: "555-0100",
  },
});
if (!writeback2.ok || !writeback2.synced || writeback2.eventAppended) {
  throw new Error(
    `Expected silent no-change write-back, got ${JSON.stringify(writeback2)}`,
  );
}

// Match by product venue id after rebind
const writeback3 = await syncVenueProfileFromProduct({
  venueId: "uuid-real-venue-from-product",
  reason: "settings",
  profile: {
    name: "Coastal Grove Estate",
    city: "Charleston",
    state: "SC",
    capacity: 200,
    ownerEmail: "smoke-product-sync@example.com",
  },
});
if (!writeback3.ok || !writeback3.synced || writeback3.matchedBy !== "product_venue_id") {
  throw new Error(`Expected product_venue_id match, got ${JSON.stringify(writeback3)}`);
}

console.log("product-sync smoke OK (incl. product→CRM write-back)");
