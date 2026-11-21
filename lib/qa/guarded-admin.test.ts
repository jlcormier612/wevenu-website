import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROTECTED_SANDBOX_VENUE_IDS,
  assertWritableQaVenue,
  refuseProtectedVenueHardcodes,
} from "@/lib/qa/protected-venues";
import { createGuardedQaAdmin } from "@/lib/qa/guarded-admin";

describe("QA guarded writes", () => {
  it("refuses each protected venue ID via refuseProtectedVenueHardcodes", () => {
    for (const id of Object.values(PROTECTED_SANDBOX_VENUE_IDS)) {
      assert.throws(() => refuseProtectedVenueHardcodes({ venueIds: [id], purpose: "unit" }), /REFUSED/);
    }
  });

  it("allows disposable venue IDs", () => {
    assert.doesNotThrow(() =>
      assertWritableQaVenue({
        venueId: "11111111-2222-3333-4444-555555555555",
        venueName: "[DISPOSABLE-UNIT] x",
      }),
    );
  });

  it("guarded admin refuses insert targeting Willow before mutation", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://wvpsldwwjqdannqasrdf.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-key-not-used";
    // Force sandbox host check: if env is unset in unit context, skip network path.
    if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes("wvpsldwwjqdannqasrdf")) {
      return;
    }
    const admin = createGuardedQaAdmin("unit-test");
    await assert.rejects(
      async () =>
        admin.from("leads").insert({
          venue_id: PROTECTED_SANDBOX_VENUE_IDS.JENS_FANCY_VENUE,
          first_name: "Blocked",
        }),
      /REFUSED/,
    );
  });
});
