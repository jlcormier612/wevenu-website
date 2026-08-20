import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cookieNameForScope,
  isClientAuthPath,
  isVendorAppPath,
  supabaseProjectRef,
} from "@/lib/auth/session-scope";

describe("session-scope", () => {
  it("derives project ref from Supabase URL", () => {
    assert.equal(
      supabaseProjectRef("https://abcdefg.supabase.co"),
      "abcdefg",
    );
    assert.equal(supabaseProjectRef("not-a-url"), null);
  });

  it("keeps venue on the default cookie name", () => {
    assert.equal(cookieNameForScope("venue", "proj"), undefined);
  });

  it("isolates vendor and client cookie names", () => {
    assert.equal(
      cookieNameForScope("vendor", "proj"),
      "sb-proj-vendor-auth-token",
    );
    assert.equal(
      cookieNameForScope("client", "proj"),
      "sb-proj-client-auth-token",
    );
  });

  it("classifies vendor app paths without accept/login", () => {
    assert.equal(isVendorAppPath("/vendor/dashboard"), true);
    assert.equal(isVendorAppPath("/vendor/accept"), false);
    assert.equal(isVendorAppPath("/vendor/login"), false);
    assert.equal(isVendorAppPath("/dashboard"), false);
  });

  it("classifies client auth surfaces", () => {
    assert.equal(isClientAuthPath("/client/login"), true);
    assert.equal(isClientAuthPath("/client/accept"), true);
    assert.equal(isClientAuthPath("/p/tok"), false);
  });
});
