/**
 * Controlled file-store fixtures for Calendly → CRM walkthrough lifecycle.
 * Does not hit Sandbox Postgres or Calendly.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import {
  ingestWalkthroughCanceled,
  ingestWalkthroughRequest,
} from "./ingest";
import { loadLiveStore } from "./store";

const prevStore = process.env.HTC_CRM_STORE;
const prevPath = process.env.RELATIONSHIPS_DATA_PATH;
const dataDir = mkdtempSync(path.join(tmpdir(), "htc-calendly-crm-"));

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

describe("Calendly walkthrough CRM lifecycle (file fixtures)", () => {
  it("creates a scheduled walkthrough lead with Calendly attribution", async () => {
    const sourceId =
      "https://api.calendly.com/scheduled_events/AAA/invitees/BBB";
    const result = await ingestWalkthroughRequest({
      email: "walkthrough-fixture@example.invalid",
      name: "Fixture Lead",
      venueName: "Fixture Garden Venue",
      scheduledAt: "2026-12-01T16:00:00.000Z",
      sourceId,
      referralSource: "Calendly",
    });
    assert.equal(result.created, true);
    assert.equal(result.relationship.status, "walkthrough_scheduled");
    assert.equal(result.relationship.salesStage, "walkthrough_scheduled");
    assert.equal(result.relationship.referralSource, "Calendly");

    const store = await loadLiveStore();
    const walks = store.walkthroughs.filter(
      (w) => w.relationshipId === result.relationship.id,
    );
    assert.equal(walks.length, 1);
    assert.equal(walks[0]?.status, "upcoming");
    assert.equal(walks[0]?.scheduledAt, "2026-12-01T16:00:00.000Z");
    // Marketing walkthrough — not a venue event booking.
    assert.ok(!("eventId" in (walks[0] as object)));
  });

  it("is idempotent on repeated invitee.created sourceId", async () => {
    const sourceId =
      "https://api.calendly.com/scheduled_events/AAA/invitees/BBB";
    const first = await ingestWalkthroughRequest({
      email: "walkthrough-fixture@example.invalid",
      name: "Fixture Lead",
      venueName: "Fixture Garden Venue",
      scheduledAt: "2026-12-01T16:00:00.000Z",
      sourceId,
      referralSource: "Calendly",
    });
    const second = await ingestWalkthroughRequest({
      email: "walkthrough-fixture@example.invalid",
      name: "Fixture Lead",
      venueName: "Fixture Garden Venue",
      scheduledAt: "2026-12-01T16:00:00.000Z",
      sourceId,
      referralSource: "Calendly",
    });
    assert.equal(first.relationship.id, second.relationship.id);
    assert.equal(second.created, false);

    const store = await loadLiveStore();
    const scheduledEvents = store.timelineEvents.filter(
      (e) =>
        e.relationshipId === first.relationship.id &&
        e.type === "walkthrough_scheduled" &&
        String(e.meta?.sourceId ?? "") === sourceId,
    );
    assert.equal(scheduledEvents.length, 1);

    const sameEmail = store.relationships.filter(
      (r) =>
        (r.owner.email || "").toLowerCase() ===
        "walkthrough-fixture@example.invalid",
    );
    assert.equal(sameEmail.length, 1);
  });

  it("updates existing email lead without creating a duplicate relationship", async () => {
    const soft = await ingestWalkthroughRequest({
      email: "existing-lead@example.invalid",
      name: "Existing Lead",
      venueName: "Existing Venue",
      message: "Email request first",
      referralSource: "Website Walkthrough",
    });
    assert.equal(soft.relationship.status, "walkthrough_requested");

    const booked = await ingestWalkthroughRequest({
      email: "existing-lead@example.invalid",
      name: "Existing Lead",
      venueName: "Existing Venue",
      scheduledAt: "2026-12-02T17:00:00.000Z",
      sourceId: "https://api.calendly.com/scheduled_events/CCC/invitees/DDD",
      referralSource: "Calendly",
    });
    assert.equal(booked.relationship.id, soft.relationship.id);
    assert.equal(booked.relationship.status, "walkthrough_scheduled");

    const store = await loadLiveStore();
    assert.equal(
      store.relationships.filter(
        (r) =>
          (r.owner.email || "").toLowerCase() === "existing-lead@example.invalid",
      ).length,
      1,
    );
  });

  it("cancels the upcoming walkthrough and is idempotent on cancel sourceId", async () => {
    const createSource =
      "https://api.calendly.com/scheduled_events/EEE/invitees/FFF";
    const cancelSource = createSource; // Calendly invitee URI reused on cancel
    const created = await ingestWalkthroughRequest({
      email: "cancel-fixture@example.invalid",
      name: "Cancel Fixture",
      venueName: "Cancel Venue",
      scheduledAt: "2026-12-03T18:00:00.000Z",
      sourceId: createSource,
      referralSource: "Calendly",
    });

    const canceled = await ingestWalkthroughCanceled({
      email: "cancel-fixture@example.invalid",
      name: "Cancel Fixture",
      venueName: "Cancel Venue",
      scheduledAt: "2026-12-03T18:00:00.000Z",
      reason: "Invitee canceled",
      sourceId: cancelSource,
    });
    assert.ok(canceled);
    assert.equal(canceled!.relationship.id, created.relationship.id);

    const storeAfter = await loadLiveStore();
    const walks = storeAfter.walkthroughs.filter(
      (w) => w.relationshipId === created.relationship.id,
    );
    assert.equal(walks.some((w) => w.status === "cancelled"), true);

    const again = await ingestWalkthroughCanceled({
      email: "cancel-fixture@example.invalid",
      scheduledAt: "2026-12-03T18:00:00.000Z",
      sourceId: cancelSource,
    });
    assert.ok(again);
    assert.equal(again!.created, false);
  });

  it("models reschedule as cancel + create with distinct sourceIds", async () => {
    const email = "reschedule-fixture@example.invalid";
    const firstInvitee =
      "https://api.calendly.com/scheduled_events/OLD/invitees/ONE";
    const secondInvitee =
      "https://api.calendly.com/scheduled_events/NEW/invitees/TWO";

    await ingestWalkthroughRequest({
      email,
      name: "Reschedule Fixture",
      venueName: "Reschedule Venue",
      scheduledAt: "2026-12-04T15:00:00.000Z",
      sourceId: firstInvitee,
      referralSource: "Calendly",
    });
    await ingestWalkthroughCanceled({
      email,
      scheduledAt: "2026-12-04T15:00:00.000Z",
      sourceId: firstInvitee,
      reason: "rescheduled",
    });
    const next = await ingestWalkthroughRequest({
      email,
      name: "Reschedule Fixture",
      venueName: "Reschedule Venue",
      scheduledAt: "2026-12-05T15:00:00.000Z",
      sourceId: secondInvitee,
      referralSource: "Calendly",
    });

    const store = await loadLiveStore();
    const rels = store.relationships.filter(
      (r) => (r.owner.email || "").toLowerCase() === email,
    );
    assert.equal(rels.length, 1);
    assert.equal(next.relationship.id, rels[0]?.id);
    assert.equal(next.relationship.status, "walkthrough_scheduled");

    const walks = store.walkthroughs
      .filter((w) => w.relationshipId === rels[0]?.id)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    assert.ok(walks.some((w) => w.status === "cancelled"));
    assert.ok(
      walks.some(
        (w) =>
          w.status === "upcoming" && w.scheduledAt === "2026-12-05T15:00:00.000Z",
      ),
    );
  });
});
