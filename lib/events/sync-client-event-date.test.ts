/**
 * Event date → client.event_date synchronization for Booked (and other
 * active) relationships. Source-contract + pure decision helper.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { clientEventDateSyncPatch } from "@/lib/events/sync-client-event-date";
import {
  classifyBookedMembership,
  isCurrentBookedMembership,
  isPastBookedMembership,
} from "@/lib/booking-journey/booked-membership";
import { clientMatchesListFilter, type ClientListFilterContext } from "@/lib/clients/list-filters";

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const TODAY = "2026-10-04";

describe("clientEventDateSyncPatch", () => {
  it("syncs when an active linked event date changes", () => {
    assert.deepEqual(clientEventDateSyncPatch({
      clientId: "client-1",
      eventStatus: "confirmed",
      previousEventDate: "2028-06-15",
      previousEventEndDate: null,
      nextEventDate: "2025-06-15",
      nextEventEndDate: null,
    }), {
      clientId: "client-1",
      eventDate: "2025-06-15",
      endDate: null,
    });
  });

  it("syncs end-date-only changes", () => {
    assert.deepEqual(clientEventDateSyncPatch({
      clientId: "client-1",
      eventStatus: "confirmed",
      previousEventDate: "2028-06-15",
      previousEventEndDate: null,
      nextEventDate: "2028-06-15",
      nextEventEndDate: "2028-06-17",
    }), {
      clientId: "client-1",
      eventDate: "2028-06-15",
      endDate: "2028-06-17",
    });
  });

  it("does not sync when dates are unchanged", () => {
    assert.equal(clientEventDateSyncPatch({
      clientId: "client-1",
      eventStatus: "confirmed",
      previousEventDate: "2028-06-15",
      previousEventEndDate: null,
      nextEventDate: "2028-06-15",
      nextEventEndDate: null,
    }), null);
  });

  it("does not sync events without a client", () => {
    assert.equal(clientEventDateSyncPatch({
      clientId: null,
      eventStatus: "confirmed",
      previousEventDate: "2028-06-15",
      previousEventEndDate: null,
      nextEventDate: "2025-06-15",
      nextEventEndDate: null,
    }), null);
  });

  it("does not sync cancelled events (no accidental reactivation via date)", () => {
    assert.equal(clientEventDateSyncPatch({
      clientId: "client-1",
      eventStatus: "cancelled",
      previousEventDate: "2028-06-15",
      previousEventEndDate: null,
      nextEventDate: "2025-06-15",
      nextEventEndDate: null,
    }), null);
  });

  it("syncs draft/non-booked active events the same way (event is sole date writer)", () => {
    assert.deepEqual(clientEventDateSyncPatch({
      clientId: "client-1",
      eventStatus: "draft",
      previousEventDate: "2027-01-01",
      previousEventEndDate: null,
      nextEventDate: "2027-02-01",
      nextEventEndDate: null,
    })?.eventDate, "2027-02-01");
  });
});

describe("updateEvent_ synchronizes client date on the normal edit path", () => {
  const service = read("lib/events/service.ts");
  const repo = read("lib/events/repository.ts");
  const actions = read("app/(app)/events/[id]/actions.ts");
  const editForm = read("components/events/event-edit-form.tsx");
  const updateFn = service.slice(
    service.indexOf("export async function updateEvent_"),
    service.indexOf("export async function updateEventStatus_"),
  );

  it("Gate90 path: EventEditForm → updateEventAction → updateEvent_", () => {
    assert.match(editForm, /updateEventAction/);
    assert.match(actions, /export async function updateEventAction/);
    assert.match(actions, /updateEvent_\(/);
    assert.match(updateFn, /repo\.updateEvent\(/);
  });

  it("writes clients.event_date / end_date after event date mutation", () => {
    assert.match(updateFn, /clientEventDateSyncPatch/);
    assert.match(updateFn, /repo\.syncClientEventDate/);
    assert.match(repo, /export async function syncClientEventDate/);
    assert.match(repo, /event_date:\s*eventDate/);
    assert.match(repo, /end_date:/);
  });

  it("does not mutate booked_at, sales_stage, or bookClient from date edit", () => {
    const syncFn = repo.slice(
      repo.indexOf("export async function syncClientEventDate"),
      repo.indexOf("export async function updateEventStatus"),
    );
    assert.match(syncFn, /event_date:\s*eventDate/);
    assert.match(syncFn, /end_date:/);
    assert.doesNotMatch(syncFn, /booked_at/);
    assert.doesNotMatch(syncFn, /sales_stage/);
    assert.doesNotMatch(syncFn, /status:/);
    assert.doesNotMatch(updateFn, /bookClient/);
    assert.doesNotMatch(updateFn, /book_relationship/);
    assert.doesNotMatch(updateFn, /insertEvent\(/);
    assert.doesNotMatch(updateFn, /insertClient/);
  });

  it("client contact edit still cannot overwrite event_date when an event exists", () => {
    const clientsRepo = read("lib/clients/repository.ts");
    const fn = clientsRepo.slice(
      clientsRepo.indexOf("export async function updateClientInfo"),
      clientsRepo.indexOf("export async function updateClientStatus"),
    );
    assert.match(fn, /delete row\.event_date/);
  });
});

describe("synced dates drive Past / All Bookings split without changing membership", () => {
  const bookedIds = new Set(["gate90"]);
  const filterCtx: ClientListFilterContext = {
    today: TODAY,
    comingUpOut: "2026-11-03",
    attentionClientIds: new Set(),
    bookedClientIds: bookedIds,
  };

  it("future → past date moves Clients All Bookings → Past; membership stays booked", () => {
    assert.equal(classifyBookedMembership({
      salesStage: "booked",
      clientStatus: "confirmed",
      eventStatus: "confirmed",
      eventDate: "2025-06-15",
    }, TODAY), "past");
    assert.equal(isPastBookedMembership({
      salesStage: "booked",
      clientStatus: "confirmed",
      eventStatus: "confirmed",
      eventDate: "2025-06-15",
    }, TODAY), true);

    const pastClient = { id: "gate90", status: "confirmed", eventDate: "2025-06-15" };
    assert.equal(clientMatchesListFilter(pastClient, "all", filterCtx), false);
    assert.equal(clientMatchesListFilter(pastClient, "past", filterCtx), true);
  });

  it("past → future date returns to current Booked / All Bookings", () => {
    assert.equal(isCurrentBookedMembership({
      salesStage: "booked",
      clientStatus: "confirmed",
      eventStatus: "confirmed",
      eventDate: "2028-06-15",
    }, TODAY), true);

    const futureClient = { id: "gate90", status: "confirmed", eventDate: "2028-06-15" };
    assert.equal(clientMatchesListFilter(futureClient, "all", filterCtx), true);
    assert.equal(clientMatchesListFilter(futureClient, "past", filterCtx), false);
  });

  it("stale client date alone would mis-split — proving why sync is required", () => {
    // Membership uses event date (past), but Clients list uses client date.
    assert.equal(classifyBookedMembership({
      salesStage: "booked",
      clientStatus: "confirmed",
      eventStatus: "confirmed",
      eventDate: "2025-06-15",
    }, TODAY), "past");
    const staleClientCopy = { id: "gate90", status: "confirmed", eventDate: "2028-06-15" };
    assert.equal(clientMatchesListFilter(staleClientCopy, "all", filterCtx), true);
    assert.equal(clientMatchesListFilter(staleClientCopy, "past", filterCtx), false);
  });
});
