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

console.log("product-sync smoke OK");
