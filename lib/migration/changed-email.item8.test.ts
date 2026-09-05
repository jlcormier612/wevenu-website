/**
 * Item 8 — changed-email duplicate matching for client/lead migration dedupe.
 *
 * When an incoming row has an email that does not match any live record, but
 * first+last still match, surface duplicate_likely (never exact / auto-skip).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dedupeClientLike, dedupeLeadLike } from "@/lib/migration/dedupe";

type DupCall = { email: string; firstName: string; lastName: string };

/**
 * Client mock that drives findActiveDuplicateClient / findActiveDuplicate
 * through their real query shape: email branch vs name branch.
 */
function duplicateAwareClient(opts: {
  emailHit?: { id: string; email: string };
  nameHit?: { id: string; firstName: string; lastName: string };
  table: "clients" | "leads";
}) {
  const calls: DupCall[] = [];
  return {
    calls,
    client: {
      from(table: string) {
        if (table !== opts.table && table !== "migration_records") {
          const c: Record<string, unknown> = {};
          const self = () => c;
          c.select = self; c.eq = self; c.neq = self; c.not = self; c.ilike = self;
          c.limit = self; c.filter = self;
          c.maybeSingle = async () => ({ data: null, error: null });
          return c;
        }
        if (table === "migration_records") {
          const c: Record<string, unknown> = {};
          const self = () => c;
          c.select = self; c.eq = self; c.filter = self; c.limit = self;
          c.maybeSingle = async () => ({ data: null, error: null });
          return c;
        }
        const state: { mode: "email" | "name" | null; email?: string; first?: string; last?: string } = { mode: null };
        const c: Record<string, unknown> = {};
        const self = () => c;
        c.select = self;
        c.eq = self;
        c.neq = self;
        c.not = self;
        c.limit = self;
        c.ilike = (col: string, value: string) => {
          if (col === "email") {
            state.mode = "email";
            state.email = value;
          } else if (col === "first_name") {
            state.mode = "name";
            state.first = value;
          } else if (col === "last_name") {
            state.last = value;
          }
          return c;
        };
        c.maybeSingle = async () => {
          calls.push({
            email: state.email ?? "",
            firstName: state.first ?? "",
            lastName: state.last ?? "",
          });
          if (state.mode === "email" && opts.emailHit && state.email?.toLowerCase() === opts.emailHit.email.toLowerCase()) {
            return { data: { id: opts.emailHit.id }, error: null };
          }
          if (
            state.mode === "name"
            && opts.nameHit
            && state.first?.toLowerCase() === opts.nameHit.firstName.toLowerCase()
            && state.last?.toLowerCase() === opts.nameHit.lastName.toLowerCase()
          ) {
            return { data: { id: opts.nameHit.id }, error: null };
          }
          return { data: null, error: null };
        };
        return c;
      },
    },
  };
}

describe("Item 8 — client changed-email matching", () => {
  it("exact-matches when email still matches", async () => {
    const { client } = duplicateAwareClient({
      table: "clients",
      emailHit: { id: "client-1", email: "jamie@example.com" },
      nameHit: { id: "client-1", firstName: "Jamie", lastName: "Rivera" },
    });
    const result = await dedupeClientLike(client as never, "venue-1", {
      firstName: "Jamie",
      lastName: "Rivera",
      email: "jamie@example.com",
    });
    assert.equal(result.matchType, "exact");
    assert.equal(result.matchedEntityId, "client-1");
  });

  it("flags likely when email changed but first+last still match", async () => {
    const { client, calls } = duplicateAwareClient({
      table: "clients",
      nameHit: { id: "client-1", firstName: "Jamie", lastName: "Rivera" },
    });
    const result = await dedupeClientLike(client as never, "venue-1", {
      firstName: "Jamie",
      lastName: "Rivera",
      email: "jamie.new@example.com",
    });
    assert.equal(result.matchType, "likely");
    assert.equal(result.matchedEntityId, "client-1");
    assert.equal(result.matchConfidence, 70);
    assert.ok(calls.some((c) => c.email === "jamie.new@example.com"));
    assert.ok(calls.some((c) => !c.email && c.firstName === "Jamie" && c.lastName === "Rivera"));
  });

  it("does not invent a name-only likely match when first or last is missing", async () => {
    const { client } = duplicateAwareClient({
      table: "clients",
      nameHit: { id: "client-1", firstName: "Jamie", lastName: "Rivera" },
    });
    const result = await dedupeClientLike(client as never, "venue-1", {
      firstName: "Jamie",
      lastName: "",
      email: "jamie.new@example.com",
    });
    assert.equal(result.matchType, "none");
  });

  it("keeps name-only exact match when no email is supplied", async () => {
    const { client } = duplicateAwareClient({
      table: "clients",
      nameHit: { id: "client-1", firstName: "Jamie", lastName: "Rivera" },
    });
    const result = await dedupeClientLike(client as never, "venue-1", {
      firstName: "Jamie",
      lastName: "Rivera",
      email: "",
    });
    assert.equal(result.matchType, "exact");
    assert.equal(result.matchedEntityId, "client-1");
  });
});

describe("Item 8 — lead changed-email matching", () => {
  it("flags likely when lead email changed but name still matches", async () => {
    const { client } = duplicateAwareClient({
      table: "leads",
      nameHit: { id: "lead-9", firstName: "Alex", lastName: "Ng" },
    });
    const result = await dedupeLeadLike(client as never, "venue-1", {
      firstName: "Alex",
      lastName: "Ng",
      email: "alex.ng+new@example.com",
    });
    assert.equal(result.matchType, "likely");
    assert.equal(result.matchedEntityId, "lead-9");
    assert.equal(result.matchConfidence, 70);
  });

  it("returns none when neither email nor name match", async () => {
    const { client } = duplicateAwareClient({ table: "leads" });
    const result = await dedupeLeadLike(client as never, "venue-1", {
      firstName: "Nobody",
      lastName: "Here",
      email: "nobody@example.com",
    });
    assert.equal(result.matchType, "none");
  });
});
