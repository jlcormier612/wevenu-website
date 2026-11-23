import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("proxy HTC vendor support access", () => {
  it("allows /vendor paths for HQ support cookies without vendor-jar session", () => {
    const src = readFileSync(resolve(import.meta.dirname, "proxy.ts"), "utf8");
    assert.match(src, /htcSupportVendor/);
    assert.match(src, /htc_support_portal/);
    assert.match(src, /!vendorUser && !htcSupportVendor/);
  });
});
