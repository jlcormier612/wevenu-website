import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  PROTECTED_SANDBOX_VENUE_IDS,
  assertWritableQaVenue,
  isFounderProtectedQaMaintenanceEnabled,
  refuseProtectedVenueHardcodes,
} from "@/lib/qa/protected-venues";
import { createGuardedQaAdmin } from "@/lib/qa/guarded-admin";

const DISPOSABLE = "11111111-2222-3333-4444-555555555555";

describe("QA guarded writes", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://wvpsldwwjqdannqasrdf.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key-not-used";
    process.env.DISPOSABLE_VENUE_ID = DISPOSABLE;
    delete process.env.HTC_ALLOW_PROTECTED_QA_WRITES;
    delete process.env.HTC_FOUNDER_PROTECTED_QA_MAINTENANCE;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("refuses each protected venue ID via refuseProtectedVenueHardcodes", () => {
    for (const id of Object.values(PROTECTED_SANDBOX_VENUE_IDS)) {
      assert.throws(() => refuseProtectedVenueHardcodes({ venueIds: [id], purpose: "unit" }), /REFUSED/);
    }
  });

  it("single env override does not disable protection", () => {
    process.env.HTC_ALLOW_PROTECTED_QA_WRITES = "1";
    assert.equal(isFounderProtectedQaMaintenanceEnabled(), false);
    assert.throws(
      () =>
        refuseProtectedVenueHardcodes({
          venueIds: [PROTECTED_SANDBOX_VENUE_IDS.WILLOW_GROVE],
          purpose: "unit",
        }),
      /REFUSED/,
    );
  });

  it("dual-key founder maintenance enables override", () => {
    process.env.HTC_ALLOW_PROTECTED_QA_WRITES = "1";
    process.env.HTC_FOUNDER_PROTECTED_QA_MAINTENANCE = "1";
    assert.equal(isFounderProtectedQaMaintenanceEnabled(), true);
    assert.doesNotThrow(() =>
      refuseProtectedVenueHardcodes({
        venueIds: [PROTECTED_SANDBOX_VENUE_IDS.WILLOW_GROVE],
        purpose: "founder-maintenance",
      }),
    );
  });

  it("allows disposable venue IDs", () => {
    assert.doesNotThrow(() =>
      assertWritableQaVenue({
        venueId: DISPOSABLE,
        venueName: "[DISPOSABLE-UNIT] x",
      }),
    );
  });

  it("createGuardedQaAdmin requires disposable venue context", () => {
    delete process.env.DISPOSABLE_VENUE_ID;
    assert.throws(() => createGuardedQaAdmin("unit-test"), /DISPOSABLE_VENUE_ID/);
  });

  it("refuses insert targeting protected venue", async () => {
    const admin = createGuardedQaAdmin({ purpose: "unit-test", disposableVenueId: DISPOSABLE });
    await assert.rejects(
      async () =>
        admin.from("leads").insert({
          venue_id: PROTECTED_SANDBOX_VENUE_IDS.JENS_FANCY_VENUE,
          first_name: "Blocked",
        }),
      /REFUSED/,
    );
  });

  it("refuses update targeting protected venue_id", async () => {
    const admin = createGuardedQaAdmin({ purpose: "unit-test", disposableVenueId: DISPOSABLE });
    await assert.rejects(
      async () =>
        admin
          .from("leads")
          .update({ first_name: "Nope" })
          .eq("venue_id", PROTECTED_SANDBOX_VENUE_IDS.WILLOW_GROVE),
      /REFUSED/,
    );
  });

  it("refuses ID-only delete without venue scope", async () => {
    const admin = createGuardedQaAdmin({ purpose: "unit-test", disposableVenueId: DISPOSABLE });
    await assert.rejects(
      async () => admin.from("leads").delete().eq("id", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
      /lacks verified venue scope|REFUSED/,
    );
  });

  it("refuses RPC without venue id", async () => {
    const admin = createGuardedQaAdmin({ purpose: "unit-test", disposableVenueId: DISPOSABLE });
    await assert.rejects(
      async () => admin.rpc("some_mutation", { p_lead_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }),
      /lacks verified venue scope|REFUSED/,
    );
  });

  it("refuses RPC targeting protected venue", async () => {
    const admin = createGuardedQaAdmin({ purpose: "unit-test", disposableVenueId: DISPOSABLE });
    await assert.rejects(
      async () =>
        admin.rpc("some_mutation", {
          p_venue_id: PROTECTED_SANDBOX_VENUE_IDS.SWEET_DAISY_BARN,
        }),
      /REFUSED/,
    );
  });

  it("allows disposable-scoped insert to proceed past the guard", async () => {
    const admin = createGuardedQaAdmin({ purpose: "unit-test", disposableVenueId: DISPOSABLE });
    // Guard passes; network will fail with fake key — assert error is NOT REFUSED.
    const result = await admin.from("leads").insert({
      venue_id: DISPOSABLE,
      first_name: "Ok",
    });
    assert.equal(result.error?.message?.includes("REFUSED") ?? false, false);
  });

  it("refuses delete targeting protected venue_id", async () => {
    const admin = createGuardedQaAdmin({ purpose: "unit-test", disposableVenueId: DISPOSABLE });
    await assert.rejects(
      async () =>
        admin
          .from("leads")
          .delete()
          .eq("venue_id", PROTECTED_SANDBOX_VENUE_IDS.JENS_FANCY_VENUE),
      /REFUSED/,
    );
  });
});
