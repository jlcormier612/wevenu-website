/**
 * Phase 3 Performance — Slice 1: Client Workspace serial-wave collapse +
 * request-scoped getClient / getCurrentUserRole caching.
 *
 * Source-level contracts: prove dependency-sensitive calls still receive
 * required inputs, workspace data props remain wired, and cache() is
 * request-scoped (same pattern as getCurrentVenue) — not a global cache.
 *
 * Slice 2 pipelines former Wave B dependents; assertions here keep the
 * Slice 1 cache contracts and the independent-read / dependency invariants.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const page = readFileSync(resolve("app/(app)/clients/[id]/page.tsx"), "utf8");
const clientsService = readFileSync(resolve("lib/clients/service.ts"), "utf8");
const venueService = readFileSync(resolve("lib/venue/service.ts"), "utf8");

function bookedBranch(src: string): string {
  const start = src.indexOf("const eventId = client.linkedEventId;");
  assert.ok(start > 0, "booked branch start");
  const end = src.indexOf("return (", start);
  assert.ok(end > start, "booked branch return");
  return src.slice(start, end);
}

describe("Slice 1 — request-scoped getClient cache", () => {
  it("wraps getClient in React cache() like getCurrentVenue", () => {
    assert.match(clientsService, /import \{ cache \} from "react"/);
    assert.match(clientsService, /export const getClient = cache\(async/);
    assert.match(clientsService, /repo\.getClient\(await createClient\(\), venue\.id, clientId\)/);
    // Still venue-scoped — authorization/isolation unchanged.
    assert.match(clientsService, /const venue = await getCurrentVenue\(\)/);
  });

  it("does not introduce module-level Map/TTL client caching", () => {
    assert.doesNotMatch(clientsService, /new Map\(\).*getClient|clientCache|ttl.*client/i);
  });

  it("generateMetadata and page both call getClient (deduped by cache)", () => {
    assert.match(page, /export async function generateMetadata/);
    const meta = page.slice(page.indexOf("export async function generateMetadata"), page.indexOf("export default async function BookingWorkspacePage"));
    assert.match(meta, /getClient\(id\)/);
    assert.match(page, /const client = await getClient\(id\)/);
  });
});

describe("Slice 1 — request-scoped getCurrentUserRole cache", () => {
  it("wraps getCurrentUserRole in React cache() like getCurrentVenue", () => {
    assert.match(venueService, /export const getCurrentVenue = cache\(async/);
    assert.match(venueService, /export const getCurrentUserRole = cache\(async/);
    assert.match(venueService, /supabase\.rpc\("current_user_role"\)/);
    assert.match(venueService, /Request-scoped `cache\(\)`/);
  });

  it("does not change the RPC source of truth for role", () => {
    const fn = venueService.slice(venueService.indexOf("export const getCurrentUserRole"));
    assert.match(fn, /current_user_role/);
    assert.doesNotMatch(fn.slice(0, 500), /venue_staff.*role.*LIMIT 1/);
  });
});

describe("Slice 1 — BookingWorkspacePage dependency-correct batches", () => {
  const booked = bookedBranch(page);

  it("collapses independent reads into a parallel Promise.all (Slice 1; Slice 2 pipelines dependents)", () => {
    assert.match(booked, /getCurrentUserRole\(\)/);
    assert.match(booked, /getQuestionnaireTemplates\(\)/);
    assert.match(booked, /getEventFloorPlanOffers\(eventId\)/);
    assert.match(booked, /getEventSpaceAssignments\(eventId\)/);
    assert.match(booked, /getPortalSessions\(id\)/);
    assert.match(booked, /getGuestReadinessSummary\(id\)/);
    assert.match(booked, /getSeatingReadinessSummary\(null, eventId\)/);
    assert.match(booked, /getEventOrder\(eventId\)/);
    assert.match(booked, /listClientChoicesForEvent\(eventId\)/);
    assert.match(booked, /getPaymentSchedules\(\)/);
    assert.match(booked, /getRequests\(\{ eventId \}\)/);
    assert.match(booked, /loadBookingJourneyForClient/);
  });

  it("keeps invoice-id → line-marker dependency (pipelined in Slice 2)", () => {
    assert.match(booked, /getInvoiceLineMarkers\(eventInvoices\.map/);
  });

  it("keeps choice-list → getClientChoices dependency (pipelined in Slice 2)", () => {
    assert.match(booked, /getClientChoices\(c\.id\)/);
  });

  it("keeps task staff ids → contacts and request ids → requestsByIds (pipelined in Slice 2)", () => {
    assert.match(booked, /getTaskContactsByStaffIds\(eventTasks\.map/);
    assert.match(booked, /getRequestsByIds\(requestIds\)/);
  });

  it("keeps conversation id → messages as an inner serial chain", () => {
    assert.match(booked, /getConversationIdForRelationship/);
    assert.match(booked, /getConversation\(conversationId\)/);
    assert.match(booked, /inner serial only/);
  });

  it("still wires core workspace props into EventDetail", () => {
    const render = page.slice(page.lastIndexOf("<EventDetail"));
    for (const prop of [
      "contracts={contracts}",
      "invoices={eventInvoices}",
      "conversationMessages={conversationMessages}",
      "bookingJourney={bookingJourney}",
      "eventOrder={eventOrder}",
      "clientChoices={clientChoices}",
      "contextualObservations={contextualObservations}",
      "floorPlanCanEdit={floorPlanCanEdit}",
      "relationshipContact={relationshipContact}",
      "readinessSummary={readinessSummary}",
    ]) {
      assert.match(render, new RegExp(prop.replace(/[{}]/g, "\\$&")));
    }
  });

  it("does not remove venue isolation on client load", () => {
    assert.match(clientsService, /venue\.id, clientId/);
  });
});
