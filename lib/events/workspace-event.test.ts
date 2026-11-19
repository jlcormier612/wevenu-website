import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { clientWorkspaceHref, resolveClientWorkspaceEventId } from "@/lib/events/workspace-event";

describe("resolveClientWorkspaceEventId", () => {
  const events = [{ id: "event-early" }, { id: "event-later" }];

  it("honors a requested Event that belongs to this Client", () => {
    assert.equal(
      resolveClientWorkspaceEventId(events, "event-later", "event-early"),
      "event-later",
    );
  });

  it("ignores an Event ID that does not belong to this Client", () => {
    assert.equal(
      resolveClientWorkspaceEventId(events, "other-client-event", "event-early"),
      "event-early",
    );
  });

  it("keeps the linked Event when no eventId is provided", () => {
    assert.equal(
      resolveClientWorkspaceEventId(events, undefined, "event-early"),
      "event-early",
    );
    assert.equal(
      resolveClientWorkspaceEventId(events, "  ", "event-early"),
      "event-early",
    );
  });
});

describe("clientWorkspaceHref", () => {
  it("keeps the Event in the Client workspace URL", () => {
    assert.equal(clientWorkspaceHref("client-1", "event-later"), "/clients/client-1?eventId=event-later");
    assert.equal(clientWorkspaceHref("client-1"), "/clients/client-1");
  });
});

describe("Client workspace honors eventId without leaking other records", () => {
  it("Booking workspace resolves ?eventId= against this Client's Events", () => {
    const page = readFileSync(resolve("app/(app)/clients/[id]/page.tsx"), "utf8");
    const detail = readFileSync(resolve("app/(app)/clients/[id]/booked-workspace-detail.tsx"), "utf8");
    const fallback = readFileSync(resolve("components/clients/booking-identity-fallback.tsx"), "utf8");
    assert.match(page, /listEventsForClient/);
    assert.match(page, /resolveClientWorkspaceEventId/);
    assert.match(detail, /ClientEventSwitcher/);
    assert.match(fallback, /ClientEventSwitcher/);
  });

  it("Calendar Event links land on the matching Client Event", () => {
    const page = readFileSync(resolve("app/(app)/events/[id]/page.tsx"), "utf8");
    assert.match(page, /withEventIdSearch/);
  });

  it("celebration uses the Event being viewed, not always the linked Event", () => {
    const page = readFileSync(resolve("app/(app)/clients/[id]/page.tsx"), "utf8");
    const resolveAt = page.indexOf("const eventId = resolveClientWorkspaceEventId");
    const celebAt = page.indexOf("bookingCelebrationPending(eventId)");
    assert.ok(resolveAt > 0 && celebAt > resolveAt);
    assert.doesNotMatch(page, /bookingCelebrationPending\(client\.linkedEventId\)/);
  });

  it("booked celebration bounce keeps the Event in the URL", () => {
    const booked = readFileSync(resolve("app/(app)/clients/[id]/booked/page.tsx"), "utf8");
    assert.match(booked, /clientWorkspaceHref\(client\.id, resolvedEventId\)/);
  });
});
