import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sessionDeviceLabel } from "@/lib/client-auth/session-label";

describe("sessionDeviceLabel", () => {
  it("labels the current session as This device", () => {
    assert.equal(sessionDeviceLabel("node", true), "This device");
    assert.equal(sessionDeviceLabel("Mozilla/5.0 … Chrome/120", true), "This device");
  });

  it("never surfaces node or other technical identifiers", () => {
    assert.equal(sessionDeviceLabel("node", false), "Other device");
    assert.equal(sessionDeviceLabel("node/v20.11.0", false), "Other device");
    assert.equal(sessionDeviceLabel("undici", false), "Other device");
    assert.equal(
      sessionDeviceLabel("a415ac52-cd74-42a6-8df7-7a8f6e71d080", false),
      "Other device",
    );
  });

  it("uses a human browser/OS label when the UA is a real browser", () => {
    const chromeMac =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    assert.equal(sessionDeviceLabel(chromeMac, false), "Chrome on Mac");
  });

  it("falls back to Other device when UA is missing or unparseable", () => {
    assert.equal(sessionDeviceLabel(null, false), "Other device");
    assert.equal(sessionDeviceLabel("", false), "Other device");
    assert.equal(sessionDeviceLabel("SomeWeirdAgent/1.0", false), "Other device");
  });
});
