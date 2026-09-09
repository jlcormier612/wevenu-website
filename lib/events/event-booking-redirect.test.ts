/**
 * I3 — /events/{id}#documents must not lose Documents on Booking redirect.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  bookingWorkspacePathFromEvent,
  searchParamsToQueryString,
} from "@/lib/events/event-booking-redirect";

describe("bookingWorkspacePathFromEvent", () => {
  it("preserves #documents for single-event Documents deep links", () => {
    assert.equal(
      bookingWorkspacePathFromEvent({
        clientId: "client-1",
        hash: "#documents",
      }),
      "/clients/client-1#documents",
    );
  });

  it("ordinary /events/{id} (no hash) lands on booking without inventing a tab", () => {
    assert.equal(
      bookingWorkspacePathFromEvent({ clientId: "client-1" }),
      "/clients/client-1",
    );
    assert.equal(
      bookingWorkspacePathFromEvent({ clientId: "client-1", hash: "" }),
      "/clients/client-1",
    );
  });

  it("forwards query params and preserves hash together", () => {
    assert.equal(
      bookingWorkspacePathFromEvent({
        clientId: "client-1",
        search: "?conversation=thread-9",
        hash: "#vendors",
      }),
      "/clients/client-1?conversation=thread-9#vendors",
    );
  });

  it("normalizes search/hash without double separators", () => {
    assert.equal(
      bookingWorkspacePathFromEvent({
        clientId: "c",
        search: "conversation=x",
        hash: "documents",
      }),
      "/clients/c?conversation=x#documents",
    );
  });
});

describe("searchParamsToQueryString", () => {
  it("builds query string from Next searchParams record", () => {
    assert.equal(searchParamsToQueryString({}), "");
    assert.equal(
      searchParamsToQueryString({ conversation: "abc" }),
      "?conversation=abc",
    );
  });
});

describe("event → booking redirect wiring", () => {
  it("events/[id] uses browser replace (not server redirect) so hash survives", () => {
    const page = readFileSync(resolve("app/(app)/events/[id]/page.tsx"), "utf8");
    assert.match(page, /EventToBookingRedirect/);
    assert.match(page, /searchParamsToQueryString/);
    assert.match(page, /location\.replace/);
    assert.match(page, /location\.hash/);
    assert.doesNotMatch(page, /\bredirect\(/);
  });

  it("EventToBookingRedirect forwards window.location.hash", () => {
    const src = readFileSync(
      resolve("components/events/event-to-booking-redirect.tsx"),
      "utf8",
    );
    assert.match(src, /window\.location\.hash/);
    assert.match(src, /bookingWorkspacePathFromEvent/);
    assert.match(src, /window\.location\.replace/);
  });

  it("EventDetail syncs #documents to the Documents tab before paint", () => {
    const src = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
    assert.match(src, /useLayoutEffect/);
    assert.match(src, /hashchange/);
    assert.match(src, /setActiveTab\(tab\)/);
    assert.match(src, /window\.location\.hash\.replace\("#", ""\)/);
    assert.match(src, /URLSearchParams\(window\.location\.search\)\.get\("tab"\)/);
  });
});
