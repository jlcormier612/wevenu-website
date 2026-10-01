/**
 * Phase 3 Performance — Slice 2: Client Workspace serial-barrier collapse.
 *
 * Source-level contracts: dependent reads chain from parent promises (no
 * artificial Wave A → Wave B full-batch wait); duplicate clients contact
 * select is gone; unbooked photo is parallelized; data dependencies remain.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const page = readFileSync(resolve("app/(app)/clients/[id]/page.tsx"), "utf8");

function bookedBranch(src: string): string {
  const start = src.indexOf("const eventId = client.linkedEventId;");
  assert.ok(start > 0, "booked branch start");
  const end = src.indexOf("return (", start);
  assert.ok(end > start, "booked branch return");
  return src.slice(start, end);
}

function unbookedBranch(src: string): string {
  const start = src.indexOf("if (!client.linkedEventId)");
  assert.ok(start > 0, "unbooked branch start");
  const end = src.indexOf("if (await bookingCelebrationPending", start);
  assert.ok(end > start, "unbooked branch end");
  return src.slice(start, end);
}

describe("Slice 2 — booked path pipelines dependents off parents", () => {
  const booked = bookedBranch(page);

  it("documents Slice 2 pipelining (no Wave A → Wave B barrier)", () => {
    assert.match(booked, /Slice 2/);
    assert.doesNotMatch(booked, /Wave B — only calls that require Wave A outputs/);
    assert.match(booked, /invoiceLineMarkersPromise/);
    assert.match(booked, /activityListsPromise/);
    assert.match(booked, /requestsByIdsPromise/);
    assert.match(booked, /taskContactsPromise/);
    assert.match(booked, /clientChoicesRawPromise/);
    assert.match(booked, /teamMembersPromise/);
    assert.match(booked, /contextualObservationsPromise/);
  });

  it("keeps invoice-id → line-marker dependency via parent.then", () => {
    assert.match(booked, /eventInvoicesPromise\.then/);
    assert.match(booked, /getInvoiceLineMarkers\(eventInvoices\.map/);
    // Slice 3B: scoped fetch replaces venue-wide + app filter; markers still
    // chain from the scoped eventInvoicesPromise.
    const markersFromScoped = booked.indexOf(
      "getInvoiceLineMarkers(eventInvoices.map((inv) => inv.id))",
    );
    const scopedIdx = booked.indexOf("getInvoicesForClientOrEvent(id, eventId)");
    assert.ok(scopedIdx > 0 && markersFromScoped > scopedIdx);
  });

  it("keeps choice-list → getClientChoices dependency via parent.then", () => {
    assert.match(booked, /clientChoicesListPromise\.then/);
    assert.match(booked, /list\.map\(\(c\) => getClientChoices\(c\.id\)\)/);
  });

  it("keeps task staff ids → contacts and request ids → requestsByIds via parent.then", () => {
    assert.match(booked, /eventTasksPromise\.then/);
    assert.match(booked, /getTaskContactsByStaffIds\(eventTasks\.map/);
    assert.match(booked, /getRequestsByIds\(requestIds\)/);
  });

  it("moves getTeamMembers onto venuePromise (not after full independent batch)", () => {
    assert.match(booked, /teamMembersPromise = venuePromise\.then/);
    assert.match(booked, /getTeamMembers\(v\.id\)/);
  });

  it("pipelines Luv observations off venue + filtered contracts without changing call shape", () => {
    assert.match(booked, /getContextualObservationsForRecord\(venue\.id, venue\.timezone/);
    assert.match(booked, /contractIds: contracts\.map\(\(c\) => c\.id\)/);
  });

  it("keeps conversation id → messages as an inner serial chain", () => {
    assert.match(booked, /getConversationIdForRelationship/);
    assert.match(booked, /getConversation\(conversationId\)/);
    assert.match(booked, /inner serial only/);
  });

  it("removes duplicate clients contact select; uses cached getClient fields", () => {
    assert.doesNotMatch(booked, /\.from\("clients"\)\.select\("email, phone, partner_email/);
    assert.doesNotMatch(booked, /clientContactRow/);
    assert.match(booked, /const coupleEmail = client\.email/);
    assert.match(booked, /phone: client\.phone/);
    assert.match(booked, /partnerEmail: client\.partnerEmail/);
  });

  it("does not serial-await createClient before the Promise.all batch", () => {
    // createClient lives only inside leadExtrasPromise (parallel), not as a
    // blocking await ahead of starting independent reads.
    const createIdx = booked.indexOf("const supabase = await createClient()");
    assert.ok(createIdx > 0);
    assert.ok(booked.lastIndexOf("leadExtrasPromise", createIdx) > 0);
    assert.ok(booked.indexOf("const eventInvoicesPromise") < createIdx);
  });

  it("keeps celebration redirect serial before workspace reads", () => {
    const full = page;
    const celeb = full.indexOf("bookingCelebrationPending(client.linkedEventId)");
    const eventId = full.indexOf("const eventId = client.linkedEventId;");
    assert.ok(celeb > 0 && eventId > celeb);
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
});

describe("Slice 2 — unbooked path parallelizes relationship photo", () => {
  const unbooked = unbookedBranch(page);

  it("folds getRelationshipPhotoForVenue into the unbooked Promise.all", () => {
    assert.match(unbooked, /getRelationshipPhotoForVenue\(client\.relationshipId\)/);
    assert.doesNotMatch(
      unbooked,
      /const photo = client\.relationshipId\s*\n\s*\? await getRelationshipPhotoForVenue/,
    );
  });
});
