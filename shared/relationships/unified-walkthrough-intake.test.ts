/**
 * Unified HTC intake → Calendly handoff identity tests (file store).
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import {
  CALENDLY_HANDOFF_META_KEY,
  findRelationshipByCalendlyHandoffToken,
} from "./calendly-handoff";
import {
  ingestWalkthroughCanceled,
  ingestWalkthroughRequest,
} from "./ingest";
import { PROVISIONAL_VENUE_NAME } from "./service";
import { loadLiveStore } from "./store";

const prevStore = process.env.HTC_CRM_STORE;
const prevPath = process.env.RELATIONSHIPS_DATA_PATH;
const dataDir = mkdtempSync(path.join(tmpdir(), "htc-unified-intake-"));

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

describe("unified walkthrough intake handoff", () => {
  it("mints opaque handoff and binds Calendly booking to the same venue", async () => {
    const intake = await ingestWalkthroughRequest({
      email: "multi@example.invalid",
      firstName: "Pat",
      lastName: "Owner",
      venueName: "Alpha Garden",
      message: "Want a walkthrough",
      referralSource: "Schedule a Walkthrough",
      sourceId: "inq_alpha_1",
    });
    assert.equal(intake.relationship.status, "walkthrough_requested");
    assert.ok(intake.handoffToken?.startsWith("htc_"));

    const resolved = await findRelationshipByCalendlyHandoffToken(
      intake.handoffToken,
    );
    assert.equal(resolved?.relationship.id, intake.relationship.id);

    const booked = await ingestWalkthroughRequest({
      email: "multi@example.invalid",
      name: "Pat Owner",
      // Intentionally omit venue — handoff must supply Alpha Garden.
      scheduledAt: "2026-12-10T15:00:00.000Z",
      sourceId: "https://api.calendly.com/scheduled_events/X/invitees/Y",
      handoffToken: intake.handoffToken,
      referralSource: "Schedule a Walkthrough",
    });
    assert.equal(booked.relationship.id, intake.relationship.id);
    assert.equal(booked.relationship.venue.name, "Alpha Garden");
    assert.equal(booked.relationship.status, "walkthrough_scheduled");

    const store = await loadLiveStore();
    const walks = store.walkthroughs.filter(
      (w) => w.relationshipId === intake.relationship.id,
    );
    assert.equal(walks.length, 1);
    assert.equal(walks[0]?.status, "upcoming");
  });

  it("keeps same-email different venues separate; handoff picks the origin", async () => {
    const alpha = await ingestWalkthroughRequest({
      email: "shared@example.invalid",
      name: "Shared Contact",
      venueName: "Venue Alpha",
      sourceId: "inq_v_alpha",
    });
    const beta = await ingestWalkthroughRequest({
      email: "shared@example.invalid",
      name: "Shared Contact",
      venueName: "Venue Beta",
      sourceId: "inq_v_beta",
    });
    assert.notEqual(alpha.relationship.id, beta.relationship.id);

    const bookedBeta = await ingestWalkthroughRequest({
      email: "shared@example.invalid",
      name: "Shared Contact",
      scheduledAt: "2026-12-11T16:00:00.000Z",
      sourceId: "https://api.calendly.com/scheduled_events/B/invitees/1",
      handoffToken: beta.handoffToken,
    });
    assert.equal(bookedBeta.relationship.id, beta.relationship.id);
    assert.equal(bookedBeta.relationship.venue.name, "Venue Beta");
  });

  it("flags direct Calendly bookings without handoff/venue as provisional review", async () => {
    const direct = await ingestWalkthroughRequest({
      email: "direct@example.invalid",
      name: "Direct Booker",
      scheduledAt: "2026-12-12T17:00:00.000Z",
      sourceId: "https://api.calendly.com/scheduled_events/D/invitees/1",
      referralSource: "Calendly",
      identityReviewRequired: true,
    });
    assert.equal(direct.relationship.venue.name, PROVISIONAL_VENUE_NAME);
    assert.equal(direct.relationship.status, "walkthrough_scheduled");
    assert.match(
      direct.relationship.notes || "",
      /Identity review|review before treating/i,
    );

    const store = await loadLiveStore();
    const scheduled = store.timelineEvents.find(
      (e) =>
        e.relationshipId === direct.relationship.id &&
        e.type === "walkthrough_scheduled",
    );
    assert.equal(scheduled?.meta?.identityReviewRequired, true);
  });

  it("does not duplicate appointments on repeated webhook sourceId", async () => {
    const intake = await ingestWalkthroughRequest({
      email: "dupe@example.invalid",
      venueName: "Dupe Venue",
      name: "Dupe",
      sourceId: "inq_dupe",
    });
    const sourceId =
      "https://api.calendly.com/scheduled_events/DUP/invitees/ONE";
    await ingestWalkthroughRequest({
      email: "dupe@example.invalid",
      venueName: "Dupe Venue",
      scheduledAt: "2026-12-13T18:00:00.000Z",
      sourceId,
      handoffToken: intake.handoffToken,
    });
    await ingestWalkthroughRequest({
      email: "dupe@example.invalid",
      venueName: "Dupe Venue",
      scheduledAt: "2026-12-13T18:00:00.000Z",
      sourceId,
      handoffToken: intake.handoffToken,
    });
    const store = await loadLiveStore();
    const scheduled = store.timelineEvents.filter(
      (e) =>
        e.relationshipId === intake.relationship.id &&
        e.type === "walkthrough_scheduled" &&
        String(e.meta?.sourceId ?? "") === sourceId,
    );
    assert.equal(scheduled.length, 1);
    assert.equal(
      store.walkthroughs.filter((w) => w.relationshipId === intake.relationship.id)
        .length,
      1,
    );
  });

  it("cancels the handoff-bound appointment only", async () => {
    const intake = await ingestWalkthroughRequest({
      email: "cancel-hand@example.invalid",
      venueName: "Cancel Hand Venue",
      name: "Cancel Hand",
      sourceId: "inq_cancel_hand",
    });
    const sourceId =
      "https://api.calendly.com/scheduled_events/CH/invitees/ONE";
    await ingestWalkthroughRequest({
      email: "cancel-hand@example.invalid",
      venueName: "Cancel Hand Venue",
      scheduledAt: "2026-12-14T19:00:00.000Z",
      sourceId,
      handoffToken: intake.handoffToken,
    });
    const canceled = await ingestWalkthroughCanceled({
      email: "cancel-hand@example.invalid",
      venueName: "Cancel Hand Venue",
      scheduledAt: "2026-12-14T19:00:00.000Z",
      sourceId,
      handoffToken: intake.handoffToken,
      reason: "test cancel",
    });
    assert.equal(canceled?.relationship.id, intake.relationship.id);
    const store = await loadLiveStore();
    assert.ok(
      store.walkthroughs.some(
        (w) =>
          w.relationshipId === intake.relationship.id &&
          w.status === "cancelled",
      ),
    );
  });

  it("stores handoff on timeline without exposing relationship id in token", async () => {
    const intake = await ingestWalkthroughRequest({
      email: "opaque@example.invalid",
      venueName: "Opaque Venue",
      name: "Opaque",
      sourceId: "inq_opaque",
    });
    assert.ok(intake.handoffToken);
    assert.equal(intake.handoffToken!.includes(intake.relationship.id), false);
    const store = await loadLiveStore();
    const evt = store.timelineEvents.find(
      (e) =>
        e.relationshipId === intake.relationship.id &&
        e.type === "walkthrough_requested",
    );
    assert.equal(evt?.meta?.[CALENDLY_HANDOFF_META_KEY], intake.handoffToken);
  });
});
