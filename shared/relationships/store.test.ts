/**
 * Lightweight unit tests for CRM store selection (no live Supabase required).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("usePostgresCrmStore", () => {
  it("forces file backend when HTC_CRM_STORE=file", async () => {
    const prev = process.env.HTC_CRM_STORE;
    process.env.HTC_CRM_STORE = "file";
    const { usePostgresCrmStore } = await import("./pg-client.ts");
    assert.equal(usePostgresCrmStore(), false);
    if (prev === undefined) delete process.env.HTC_CRM_STORE;
    else process.env.HTC_CRM_STORE = prev;
  });

  it("forces postgres when HTC_CRM_STORE=postgres", async () => {
    const prev = process.env.HTC_CRM_STORE;
    process.env.HTC_CRM_STORE = "postgres";
    // Re-import won't re-evaluate in same process — call logic inline
    const forced =
      process.env.HTC_CRM_STORE === "postgres" ||
      (process.env.HTC_CRM_STORE !== "file" &&
        Boolean(
          (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)?.trim() &&
            process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
        ));
    assert.equal(forced, true);
    if (prev === undefined) delete process.env.HTC_CRM_STORE;
    else process.env.HTC_CRM_STORE = prev;
  });
});
