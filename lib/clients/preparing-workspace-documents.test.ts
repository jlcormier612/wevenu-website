/**
 * Preparing client workspace Documents: the page shows client-scoped files,
 * and conversation links stay event, then client, then lead.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  chooseAttachmentDocumentTarget,
  documentsWorkspaceHref,
} from "@/lib/conversations/attachment-document";

const page = readFileSync(resolve("app/(app)/clients/[id]/page.tsx"), "utf8");
const leadPage = readFileSync(resolve("app/(app)/leads/[id]/page.tsx"), "utf8");
const leadDetail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
const eventDetail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
const retrieval = readFileSync(
  resolve("supabase/migrations/20261411800000_venue_documents_booking_relationship_scope.sql"),
  "utf8",
);

function unbookedBranch(src: string): string {
  const start = src.indexOf("if (!client.linkedEventId)");
  assert.ok(start > 0);
  const end = src.indexOf("if (await bookingCelebrationPending", start);
  assert.ok(end > start);
  return src.slice(start, end);
}

function bookedBranch(src: string): string {
  const start = src.indexOf("const eventId = client.linkedEventId;");
  assert.ok(start > 0);
  return src.slice(start);
}

describe("preparing client workspace Documents", () => {
  const unbooked = unbookedBranch(page);

  it("renders a Documents section from client-scoped retrieval", () => {
    assert.match(unbooked, /getVenueWorkspaceDocuments\(\{ clientId: client\.id \}\)/);
    assert.doesNotMatch(unbooked, /getVenueWorkspaceDocuments\(\{[^}]*leadId/);
    assert.doesNotMatch(unbooked, /getVenueWorkspaceDocuments\(\{[^}]*eventId/);
    assert.match(unbooked, /<section id="documents"/);
    assert.match(unbooked, /<DocumentWorkspace/);
    assert.match(unbooked, /entityType: "client", entityId: client\.id, venueId: client\.venueId/);
  });
});

describe("documentsWorkspaceHref destinations", () => {
  it("one event opens event Documents", () => {
    assert.equal(
      documentsWorkspaceHref({ leadId: "l1", clientId: "c1", eventId: "e1" }),
      "/events/e1#documents",
    );
  });

  it("several events, with no single event id, open client booking Documents", () => {
    assert.equal(
      documentsWorkspaceHref({ leadId: "l1", clientId: "c1" }),
      "/clients/c1#documents",
    );
    assert.deepEqual(
      chooseAttachmentDocumentTarget({
        leadId: "l1",
        clientId: "c1",
        eventIds: ["e1", "e2"],
      }),
      { entityType: "client", entityId: "c1" },
    );
  });

  it("lead-only documents stay on the lead workspace", () => {
    assert.equal(
      documentsWorkspaceHref({ leadId: "l1", clientId: null }),
      "/leads/l1#documents",
    );
    assert.deepEqual(
      chooseAttachmentDocumentTarget({ leadId: "l1", clientId: null, eventIds: [] }),
      { entityType: "lead", entityId: "l1" },
    );
    assert.match(leadPage, /getVenueWorkspaceDocuments\(\{ leadId: id \}\)/);
    assert.match(leadDetail, /value="documents"/);
    assert.match(leadDetail, /uploadTarget=\{\{ entityType: "lead", entityId: lead\.id/);
    assert.match(leadDetail, /window\.location\.hash/);
  });
});

describe("booked client Documents stay on the booking workspace", () => {
  const booked = bookedBranch(page);

  it("loads event documents plus this client's unscoped files, and honors #documents", () => {
    assert.match(booked, /getVenueWorkspaceDocuments\(\{ eventId, clientId: id \}\)/);
    assert.match(eventDetail, /#documents/);
    assert.match(eventDetail, /window\.location\.hash\.replace\("#", ""\)/);
  });
});

describe("get_venue_documents venue and relationship isolation", () => {
  it("scopes every row to the current user's venue", () => {
    assert.match(retrieval, /v_venue_id uuid := public\.current_user_venue_id\(\)/);
    assert.match(retrieval, /d\.venue_id = v_venue_id/);
  });

  it("client-only scope matches that client and does not pull other events' files by itself", () => {
    assert.match(
      retrieval,
      /\(p_client_id is null or d\.client_id = p_client_id\)\s+and \(p_event_id\s+is null or d\.event_id\s+= p_event_id\)/,
    );
  });

  it("booking scope is this event or this client's files that are not tied to an event", () => {
    assert.match(retrieval, /No cross-event leakage/);
    assert.match(
      retrieval,
      /\(d\.event_id = p_event_id\)\s+or \(d\.event_id is null and d\.client_id = p_client_id\)/,
    );
  });
});
