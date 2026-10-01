/**
 * Client Workspace Luv observation performance — record-scoped initial render.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const page = readFileSync(resolve("app/(app)/clients/[id]/page.tsx"), "utf8");
const eventDetail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
const panel = readFileSync(resolve("components/luv/contextual-observations-panel.tsx"), "utf8");
const contextual = readFileSync(resolve("lib/luv/contextual-record.ts"), "utf8");

function bookedBranch(src: string): string {
  const start = src.indexOf("const eventId = client.linkedEventId;");
  assert.ok(start > 0, "booked branch start");
  const end = src.indexOf("return (", start);
  assert.ok(end > start, "booked branch return");
  return src.slice(start, end);
}

describe("Client Workspace Luv — initial-render scope", () => {
  const booked = bookedBranch(page);

  it("booked workspace still loads record-filtered Luv observations", () => {
    assert.match(booked, /getContextualObservationsForRecord\(venue\.id, venue\.timezone/);
    assert.match(booked, /eventId,/);
    assert.match(booked, /clientId: id/);
    assert.match(booked, /contractIds: contracts\.map\(\(c\) => c\.id\)/);
    assert.match(page, /contextualObservations=\{contextualObservations\}/);
  });

  it("EventDetail still renders the L3 panel from those observations", () => {
    assert.match(eventDetail, /ContextualLuvObservationsPanel observations=\{contextualObservations\}/);
    assert.match(panel, /Luv noticed/);
    assert.match(panel, /obs\.message/);
  });

  it("record helper scopes the shared engine then still filters for the record", () => {
    assert.match(contextual, /getLuvObservations\(supabase, venueId, today, undefined, record\)/);
    assert.match(contextual, /filterObservationsForRecord\(all, record\)/);
  });

  it("does not introduce a second Luv engine on the Client Workspace page", () => {
    assert.doesNotMatch(page, /getLuvObservations\(/);
    assert.match(page, /from "@\/lib\/luv\/contextual-record"/);
  });
});
