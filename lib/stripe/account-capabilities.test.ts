import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  capabilitySnapshotFromAccount,
  chargesEnabledFromAccount,
  persistConnectedAccountCapabilitiesByAccountId,
} from "@/lib/stripe/account-capabilities";

describe("chargesEnabledFromAccount", () => {
  it("reads Stripe's flag and never invents true", () => {
    assert.equal(chargesEnabledFromAccount({ charges_enabled: true }), true);
    assert.equal(chargesEnabledFromAccount({ charges_enabled: false }), false);
    assert.equal(chargesEnabledFromAccount({ charges_enabled: undefined as unknown as boolean }), false);
  });
});

describe("capabilitySnapshotFromAccount", () => {
  it("pairs charges_enabled with a verification timestamp", () => {
    const snap = capabilitySnapshotFromAccount({ charges_enabled: true }, "2026-10-18T22:00:00.000Z");
    assert.deepEqual(snap, {
      chargesEnabled: true,
      verifiedAt: "2026-10-18T22:00:00.000Z",
    });
  });
});

describe("persistConnectedAccountCapabilitiesByAccountId", () => {
  it("updates only the venue that owns the Stripe account id", async () => {
    const venues = [
      {
        id: "venue-a",
        stripe_account_id: "acct_A",
        stripe_charges_enabled: true,
        stripe_charges_enabled_verified_at: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "venue-b",
        stripe_account_id: "acct_B",
        stripe_charges_enabled: true,
        stripe_charges_enabled_verified_at: "2026-08-01T00:00:00.000Z",
      },
    ];

    const admin = {
      from(_table: string) {
        const filters: Array<[string, unknown]> = [];
        let patch: Record<string, unknown> | null = null;
        const api = {
          select() { return api; },
          eq(key: string, value: unknown) { filters.push([key, value]); return api; },
          update(next: Record<string, unknown>) { patch = next; return api; },
          async maybeSingle() {
            const found = venues.find((row) => filters.every(([k, v]) => (row as Record<string, unknown>)[k] === v)) ?? null;
            return { data: found ? { id: found.id } : null, error: null };
          },
          then(resolve: (value: { data: null; error: null }) => unknown) {
            if (patch) {
              for (const row of venues) {
                if (filters.every(([k, v]) => (row as Record<string, unknown>)[k] === v)) {
                  Object.assign(row, patch);
                }
              }
            }
            return resolve({ data: null, error: null });
          },
        };
        return api;
      },
    };

    const disabled = await persistConnectedAccountCapabilitiesByAccountId(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      admin as any,
      "acct_A",
      { chargesEnabled: false, verifiedAt: "2026-10-18T22:05:00.000Z" },
    );
    assert.deepEqual(disabled, { ok: true, venueId: "venue-a" });
    assert.equal(venues[0].stripe_charges_enabled, false);
    assert.equal(venues[0].stripe_charges_enabled_verified_at, "2026-10-18T22:05:00.000Z");
    assert.equal(venues[1].stripe_charges_enabled, true);

    const missing = await persistConnectedAccountCapabilitiesByAccountId(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      admin as any,
      "acct_unknown",
      { chargesEnabled: true, verifiedAt: "2026-10-18T22:06:00.000Z" },
    );
    assert.deepEqual(missing, { ok: false, reason: "not_found" });
    assert.equal(venues[1].stripe_charges_enabled, true);
  });
});

describe("Connect webhook and checkout wiring", () => {
  it("dispatches account.updated through the Connect webhook route", () => {
    const route = readFileSync(resolve("app/api/webhooks/stripe-connect/route.ts"), "utf8");
    assert.match(route, /case "account\.updated"/);
    assert.match(route, /handleAccountUpdated/);
  });

  it("checkout refuses when chargesEnabled is false", () => {
    const checkout = readFileSync(resolve("lib/stripe/checkout.ts"), "utf8");
    assert.match(checkout, /if \(!ctx\.chargesEnabled\)/);
    assert.match(checkout, /isn't ready to accept charges yet/);
  });
});
