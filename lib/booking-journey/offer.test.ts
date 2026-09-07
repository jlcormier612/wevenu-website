import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  acceptOfferByToken,
  getOfferByToken,
  mapAcceptRpcResult,
  mapOfferRpcData,
  type OfferRpcClient,
} from "@/lib/booking-journey/offer";

const VALID_OFFER_ROW = {
  id: "sel-1",
  name: "Garden Package",
  totalAmount: 3200,
  depositAmount: 800,
  remainingAmount: 2400,
  includedItems: [{ description: "Ceremony", quantity: 1, unit: null }],
  status: "offered",
  offerMessage: "Looking forward to celebrating with you.",
};

function fakeClient(handlers: {
  get?: (token: string) => { data: unknown; error: { message?: string } | null };
  accept?: (token: string) => { data: unknown; error: { message?: string } | null };
}): OfferRpcClient {
  return {
    async rpc(fn, args) {
      const token = String(args.p_token ?? "");
      if (fn === "get_commercial_selection_by_accept_token") {
        return handlers.get?.(token) ?? { data: null, error: { message: "unexpected get" } };
      }
      if (fn === "accept_commercial_selection") {
        return handlers.accept?.(token) ?? { data: null, error: { message: "unexpected accept" } };
      }
      return { data: null, error: { message: `unknown rpc ${fn}` } };
    },
  };
}

describe("Public offer security model (service_role + SECURITY DEFINER)", () => {
  const originalSql = readFileSync(
    resolve("supabase/migrations/20261343000000_commercial_selections.sql"),
    "utf8",
  );
  const grantSql = readFileSync(
    resolve("supabase/migrations/20261345000000_commercial_offer_service_role_grants.sql"),
    "utf8",
  );
  const offerSrc = readFileSync(resolve("lib/booking-journey/offer.ts"), "utf8");
  const pageSrc = readFileSync(resolve("app/offer/[token]/page.tsx"), "utf8");
  const actionSrc = readFileSync(resolve("app/offer/actions.ts"), "utf8");
  const proxySrc = readFileSync(resolve("integrations/supabase/proxy.ts"), "utf8");

  it("RPCs stay SECURITY DEFINER and scoped by accept_token", () => {
    assert.match(originalSql, /security definer/);
    assert.match(originalSql, /where accept_token = p_token/);
    assert.match(originalSql, /get_commercial_selection_by_accept_token/);
    assert.match(originalSql, /accept_commercial_selection/);
  });

  it("grants service_role execute for the intended createAdminClient caller", () => {
    assert.match(
      grantSql,
      /grant execute on function public\.get_commercial_selection_by_accept_token\(text\)\s+to service_role/i,
    );
    assert.match(
      grantSql,
      /grant execute on function public\.accept_commercial_selection\(text\)\s+to service_role/i,
    );
    assert.match(offerSrc, /createAdminClient/);
    assert.doesNotMatch(offerSrc, /createBrowserClient|createServerClient|createAnon/);
  });

  it("public /offer requires no venue authentication", () => {
    assert.match(proxySrc, /"\/offer"/);
    assert.doesNotMatch(pageSrc, /requireVenue|getVenueSession|createClient\(/);
    assert.doesNotMatch(actionSrc, /requireVenue|getVenueSession|createClient\(/);
    assert.match(actionSrc, /acceptOfferByToken/);
  });
});

describe("Public offer retrieve + accept (logged-out / no venue session)", () => {
  it("valid token retrieves the offer", async () => {
    const client = fakeClient({
      get: (token) =>
        token === "valid-token"
          ? { data: VALID_OFFER_ROW, error: null }
          : { data: { error: "invalid_token" }, error: null },
    });
    const offer = await getOfferByToken("valid-token", client);
    assert.deepEqual(offer, {
      id: "sel-1",
      name: "Garden Package",
      totalAmount: 3200,
      depositAmount: 800,
      remainingAmount: 2400,
      includedItems: [{ description: "Ceremony", quantity: 1, unit: null }],
      status: "offered",
      offerMessage: "Looking forward to celebrating with you.",
    });
  });

  it("valid token can accept the offer", async () => {
    const client = fakeClient({
      accept: (token) =>
        token === "valid-token"
          ? { data: { ok: true, id: "sel-1", alreadyAccepted: false }, error: null }
          : { data: { ok: false, error: "invalid_token" }, error: null },
    });
    const result = await acceptOfferByToken("valid-token", client);
    assert.deepEqual(result, { ok: true, alreadyAccepted: false });
  });

  it("invalid token cannot retrieve an offer", async () => {
    const client = fakeClient({
      get: () => ({ data: { error: "invalid_token" }, error: null }),
    });
    assert.equal(await getOfferByToken("bogus", client), null);
  });

  it("RPC permission/transport failure cannot retrieve an offer", async () => {
    const client = fakeClient({
      get: () => ({ data: null, error: { message: "permission denied for function" } }),
    });
    assert.equal(await getOfferByToken("valid-token", client), null);
  });

  it("invalid token cannot accept an offer", async () => {
    const client = fakeClient({
      accept: () => ({ data: { ok: false, error: "invalid_token" }, error: null }),
    });
    const result = await acceptOfferByToken("bogus", client);
    assert.deepEqual(result, { ok: false, message: "This offer link is not valid." });
  });

  it("non-offered / expired-style status cannot accept", async () => {
    const client = fakeClient({
      accept: () => ({ data: { ok: false, error: "not_offered" }, error: null }),
    });
    const result = await acceptOfferByToken("stale-token", client);
    assert.deepEqual(result, { ok: false, message: "This offer cannot be accepted." });
  });

  it("mapOfferRpcData / mapAcceptRpcResult reject empty and error payloads", () => {
    assert.equal(mapOfferRpcData(null), null);
    assert.equal(mapOfferRpcData({ error: "invalid_token" }), null);
    assert.deepEqual(mapAcceptRpcResult(null, null), {
      ok: false,
      message: "Could not accept this offer.",
    });
    assert.deepEqual(mapAcceptRpcResult({ ok: true, alreadyAccepted: true }, null), {
      ok: true,
      alreadyAccepted: true,
    });
  });
});
