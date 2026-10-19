import assert from "node:assert/strict";
import { mock } from "node:test";
import { before, describe, it } from "node:test";
import Stripe from "stripe";

type Row = Record<string, unknown>;

const store = {
  venues: [] as Row[],
  events: new Map<string, Row>(),
};

function resetStore() {
  store.venues = [
    {
      id: "venue-sweet",
      stripe_account_id: "acct_fixture_sweet",
      stripe_charges_enabled: true,
      stripe_charges_enabled_verified_at: "2026-08-29T02:27:08.496Z",
    },
    {
      id: "venue-other",
      stripe_account_id: "acct_fixture_other",
      stripe_charges_enabled: true,
      stripe_charges_enabled_verified_at: "2026-08-29T02:27:08.496Z",
    },
  ];
  store.events.clear();
}

function matches(row: Row, filters: Array<[string, unknown]>) {
  return filters.every(([key, value]) => row[key] === value);
}

function builder(table: string) {
  const filters: Array<[string, unknown]> = [];
  let op: "select" | "insert" | "update" | "delete" = "select";
  let patch: Row = {};
  let insertRow: Row | null = null;

  const api = {
    select() { return api; },
    eq(key: string, value: unknown) { filters.push([key, value]); return api; },
    insert(row: Row) {
      op = "insert";
      insertRow = row;
      return api;
    },
    update(next: Row) {
      op = "update";
      patch = next;
      return api;
    },
    delete() {
      op = "delete";
      return api;
    },
    async maybeSingle() {
      if (table === "venues") {
        const found = store.venues.find((row) => matches(row, filters)) ?? null;
        return { data: found ? { id: found.id } : null, error: null };
      }
      return { data: null, error: null };
    },
    then(resolve: (value: { data: unknown; error: { code?: string } | null }) => unknown, reject?: (err: unknown) => unknown) {
      try {
        resolve(execute());
      } catch (err) {
        if (reject) reject(err);
        else throw err;
      }
    },
  };

  function execute() {
    if (op === "insert") {
      const row = insertRow ?? {};
      if (table === "stripe_webhook_events") {
        const id = String(row.stripe_event_id);
        if (store.events.has(id)) return { data: null, error: { code: "23505" } };
        store.events.set(id, row);
        return { data: null, error: null };
      }
      return { data: null, error: null };
    }
    if (op === "update") {
      if (table === "venues") {
        for (const row of store.venues) {
          if (matches(row, filters)) Object.assign(row, patch);
        }
      }
      return { data: null, error: null };
    }
    if (op === "delete") {
      if (table === "stripe_webhook_events") {
        const id = filters.find(([key]) => key === "stripe_event_id")?.[1];
        if (typeof id === "string") store.events.delete(id);
      }
      return { data: null, error: null };
    }
    return { data: null, error: null };
  }

  return api;
}

const admin = {
  from(table: string) { return builder(table); },
};

mock.module("@/integrations/supabase/admin", {
  exports: { createAdminClient: () => admin },
});

const WEBHOOK_SECRET = "whsec_fixture_account_updated";
process.env.STRIPE_SECRET_KEY = "sk_test_fixture_account_updated";
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;

type PostRoute = typeof import("@/app/api/webhooks/stripe-connect/route").POST;
let POST: PostRoute;
let stripe: Stripe;

function signedRequest(event: Record<string, unknown>, signatureOverride?: string) {
  const payload = JSON.stringify(event);
  const signature = signatureOverride
    ?? stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return new Request("https://app.sandbox.hellotocheers.com/api/webhooks/stripe-connect", {
    method: "POST",
    headers: { "stripe-signature": signature, "content-type": "application/json" },
    body: payload,
  });
}

function accountUpdatedEvent(overrides: {
  id?: string;
  account?: string;
  charges_enabled?: boolean;
} = {}) {
  const accountId = overrides.account ?? "acct_fixture_sweet";
  return {
    id: overrides.id ?? "evt_account_updated_1",
    object: "event",
    type: "account.updated",
    account: accountId,
    data: {
      object: {
        id: accountId,
        object: "account",
        charges_enabled: overrides.charges_enabled ?? false,
      },
    },
  };
}

before(async () => {
  ({ POST } = await import("@/app/api/webhooks/stripe-connect/route"));
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
});

describe("Connect account.updated webhook", () => {
  it("rejects an invalid signature", async () => {
    resetStore();
    const event = accountUpdatedEvent();
    const res = await POST(signedRequest(event, "t=1,v1=not-a-real-signature"));
    assert.equal(res.status, 400);
    assert.equal(store.venues[0].stripe_charges_enabled, true);
    assert.equal(store.events.size, 0);
  });

  it("disables charges on the matching venue and refreshes verified_at", async () => {
    resetStore();
    const before = store.venues[0].stripe_charges_enabled_verified_at;
    const res = await POST(signedRequest(accountUpdatedEvent({ charges_enabled: false })));
    assert.equal(res.status, 200);
    const body = await res.json() as { received?: boolean };
    assert.equal(body.received, true);
    assert.equal(store.venues[0].stripe_charges_enabled, false);
    assert.notEqual(store.venues[0].stripe_charges_enabled_verified_at, before);
    assert.equal(store.venues[1].stripe_charges_enabled, true);
  });

  it("re-enables charges when Stripe reports charges_enabled true", async () => {
    resetStore();
    store.venues[0].stripe_charges_enabled = false;
    const res = await POST(signedRequest(accountUpdatedEvent({
      id: "evt_account_updated_enable",
      charges_enabled: true,
    })));
    assert.equal(res.status, 200);
    assert.equal(store.venues[0].stripe_charges_enabled, true);
  });

  it("is idempotent on duplicate event delivery", async () => {
    resetStore();
    const event = accountUpdatedEvent({ id: "evt_account_updated_dup", charges_enabled: false });
    const first = await POST(signedRequest(event));
    assert.equal(first.status, 200);
    assert.equal(store.venues[0].stripe_charges_enabled, false);
    const verified = store.venues[0].stripe_charges_enabled_verified_at;

    const second = await POST(signedRequest(event));
    assert.equal(second.status, 200);
    const body = await second.json() as { duplicate?: boolean };
    assert.equal(body.duplicate, true);
    assert.equal(store.venues[0].stripe_charges_enabled, false);
    assert.equal(store.venues[0].stripe_charges_enabled_verified_at, verified);
    assert.equal(store.events.size, 1);
  });

  it("ignores an unknown connected account without touching other venues", async () => {
    resetStore();
    const res = await POST(signedRequest(accountUpdatedEvent({
      id: "evt_account_updated_unknown",
      account: "acct_fixture_unknown",
      charges_enabled: false,
    })));
    assert.equal(res.status, 200);
    assert.equal(store.venues[0].stripe_charges_enabled, true);
    assert.equal(store.venues[1].stripe_charges_enabled, true);
  });
});
