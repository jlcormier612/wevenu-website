import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { pickContract } from "@/lib/clients/booking-handoff";
import {
  contractIdSet,
  leadJourneyContractsFromVenueWide,
  leadJourneyContractsScoped,
  type JourneyContractRow,
} from "@/lib/booking-journey/lead-contract-scope";

const venue: JourneyContractRow[] = [
  { id: "a-signed", status: "signed", clientId: "c1", eventId: "e1" },
  { id: "a-sent", status: "sent", clientId: "c1", eventId: null },
  { id: "a-draft", status: "draft", clientId: "c1", eventId: null },
  { id: "a-amend", status: "sent", clientId: "c1", eventId: "e1" },
  { id: "other", status: "signed", clientId: "c2", eventId: "e2" },
  { id: "event-only", status: "sent", clientId: null, eventId: "e1" },
  { id: "void-other", status: "cancelled", clientId: "c9", eventId: null },
];

function parityOk(
  all: JourneyContractRow[],
  clientId: string | null,
  eventId: string | null,
): boolean {
  return (
    contractIdSet(leadJourneyContractsFromVenueWide(all, clientId)) ===
    contractIdSet(leadJourneyContractsScoped(all, clientId, eventId))
  );
}

describe("Lead journey contract scope parity", () => {
  it("matches venue-wide+filter for booked client with event", () => {
    assert.equal(parityOk(venue, "c1", "e1"), true);
  });

  it("matches for client without event (sent/draft path)", () => {
    assert.equal(parityOk(venue, "c1", null), true);
    const scoped = leadJourneyContractsScoped(venue, "c1", null);
    assert.ok(scoped.some((c) => c.id === "a-sent"));
    assert.ok(scoped.some((c) => c.id === "a-draft"));
    assert.ok(!scoped.some((c) => c.id === "other"));
  });

  it("returns empty when lead has no client (Avery-style)", () => {
    assert.deepEqual(leadJourneyContractsScoped(venue, null, null), []);
    assert.deepEqual(leadJourneyContractsFromVenueWide(venue, null), []);
    assert.equal(parityOk(venue, null, null), true);
  });

  it("does not select unrelated venue contracts", () => {
    const scoped = leadJourneyContractsScoped(venue, "c1", "e1");
    assert.ok(!scoped.some((c) => c.clientId === "c2"));
    assert.ok(!scoped.some((c) => c.id === "void-other"));
  });

  it("event-only rows are excluded by journey client filter (legacy identical)", () => {
    const legacy = leadJourneyContractsFromVenueWide(venue, "c1");
    const scoped = leadJourneyContractsScoped(venue, "c1", "e1");
    assert.ok(!legacy.some((c) => c.id === "event-only"));
    assert.ok(!scoped.some((c) => c.id === "event-only"));
  });

  it("pickContract prefers signed over sent/draft among scoped rows", () => {
    const scoped = leadJourneyContractsScoped(venue, "c1", "e1");
    const picked = pickContract(
      scoped.map((c) => ({
        id: c.id,
        status: c.status as "signed" | "sent" | "draft" | "cancelled" | "expired",
      })),
    );
    assert.equal(picked?.id, "a-signed");
  });

  it("load.ts never calls venue-wide getContracts for Lead journey", () => {
    const src = readFileSync("lib/booking-journey/load.ts", "utf8");
    const leadFn = src.slice(
      src.indexOf("export async function loadBookingJourneyForLead"),
      src.indexOf("export async function loadBookingJourneyForClient"),
    );
    assert.doesNotMatch(leadFn, /getContracts\(\)/);
    assert.match(leadFn, /contractsForLeadJourney/);
    assert.match(src, /async function contractsForLeadJourney/);
    assert.match(src, /getContractsForClientOrEvent\(clientId, eventId\)/);
    assert.match(src, /return getContractsForClient\(clientId\)/);
  });

  it("service helpers still gate on getCurrentVenue", () => {
    const svc = readFileSync("lib/contracts/service.ts", "utf8");
    assert.match(svc, /export async function getContractsForClient\(/);
    const slice = svc.slice(
      svc.indexOf("export async function getContractsForClient("),
      svc.indexOf("export async function getContractsForWorkflowList"),
    );
    assert.match(slice, /getCurrentVenue/);
  });
});
