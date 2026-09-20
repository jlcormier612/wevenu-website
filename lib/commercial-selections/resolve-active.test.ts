/**
 * Unit tests for resolveActiveCommercialSelection with a fake getSelection chain.
 * Kept as a pure logic mirror so we don't need a live DB for the superseded handoff.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

type Sel = {
  id: string;
  status: "draft" | "offered" | "accepted" | "superseded";
  supersededById: string | null;
  clientId: string | null;
  eventId: string | null;
  leadId: string | null;
};

/**
 * Mirrors resolveActiveCommercialSelection resolution order without I/O.
 */
function resolveActive(
  opts: { selectionId?: string | null; eventId?: string | null; clientId?: string | null; leadId?: string | null },
  byId: Map<string, Sel>,
  activeByEvent: Map<string, Sel>,
  activeByClient: Map<string, Sel>,
  activeByLead: Map<string, Sel>,
): Sel | null {
  let selection = opts.selectionId ? byId.get(opts.selectionId) ?? null : null;
  for (let i = 0; i < 5 && selection?.status === "superseded"; i++) {
    if (!selection.supersededById) {
      selection = null;
      break;
    }
    selection = byId.get(selection.supersededById) ?? null;
  }
  if (selection?.status === "superseded") selection = null;
  if (!selection && opts.eventId) selection = activeByEvent.get(opts.eventId) ?? null;
  if (!selection && opts.clientId) selection = activeByClient.get(opts.clientId) ?? null;
  if (!selection && opts.leadId) selection = activeByLead.get(opts.leadId) ?? null;
  if (!selection || selection.status === "superseded") return null;
  return selection;
}

const draft = (id: string, overrides: Partial<Sel> = {}): Sel => ({
  id,
  status: "draft",
  supersededById: null,
  clientId: "client-1",
  eventId: "event-1",
  leadId: "lead-1",
  ...overrides,
});

describe("resolveActiveCommercialSelection logic", () => {
  it("1. Lead-only active selection resolves by leadId", () => {
    const active = draft("sel-active", { clientId: null, eventId: null });
    const got = resolveActive(
      { leadId: "lead-1" },
      new Map([[active.id, active]]),
      new Map(),
      new Map(),
      new Map([["lead-1", active]]),
    );
    assert.equal(got?.id, "sel-active");
  });

  it("2. Lead selection after Client/Event linkage resolves by client/event", () => {
    const active = draft("sel-linked");
    const got = resolveActive(
      { clientId: "client-1", eventId: "event-1" },
      new Map([[active.id, active]]),
      new Map([["event-1", active]]),
      new Map([["client-1", active]]),
      new Map(),
    );
    assert.equal(got?.id, "sel-linked");
  });

  it("3. Explicit selectionId resolves that exact active selection", () => {
    const active = draft("sel-exact");
    const got = resolveActive(
      { selectionId: "sel-exact" },
      new Map([[active.id, active]]),
      new Map(),
      new Map(),
      new Map(),
    );
    assert.equal(got?.id, "sel-exact");
  });

  it("4. Client fallback when selectionId omitted", () => {
    const active = draft("sel-client");
    const got = resolveActive(
      { clientId: "client-1" },
      new Map(),
      new Map(),
      new Map([["client-1", active]]),
      new Map(),
    );
    assert.equal(got?.id, "sel-client");
  });

  it("5. Event fallback when selectionId omitted", () => {
    const active = draft("sel-event");
    const got = resolveActive(
      { eventId: "event-1" },
      new Map(),
      new Map([["event-1", active]]),
      new Map(),
      new Map(),
    );
    assert.equal(got?.id, "sel-event");
  });

  it("6. Superseded selectionId follows superseded_by_id to active", () => {
    const active = draft("sel-new");
    const old = draft("sel-old", { status: "superseded", supersededById: "sel-new" });
    const got = resolveActive(
      { selectionId: "sel-old", clientId: "client-1" },
      new Map([
        [old.id, old],
        [active.id, active],
      ]),
      new Map(),
      new Map([["client-1", active]]),
      new Map(),
    );
    assert.equal(got?.id, "sel-new");
  });

  it("6b. Superseded without replacement falls back to client active", () => {
    const active = draft("sel-client-active");
    const orphan = draft("sel-orphan", { status: "superseded", supersededById: null });
    const got = resolveActive(
      { selectionId: "sel-orphan", clientId: "client-1" },
      new Map([[orphan.id, orphan]]),
      new Map(),
      new Map([["client-1", active]]),
      new Map(),
    );
    assert.equal(got?.id, "sel-client-active");
  });

  it("10. No active selection → null (caller shows no-package copy)", () => {
    const got = resolveActive(
      { selectionId: "missing", clientId: "client-1" },
      new Map(),
      new Map(),
      new Map(),
      new Map(),
    );
    assert.equal(got, null);
  });
});
