import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { resolveVendorPortalPath } from "./resolve-customer-portal-dest";

describe("HTC support real customer portal destinations", () => {
  it("vendor support opens /vendor/dashboard not staff /vendors/[id]", () => {
    assert.equal(resolveVendorPortalPath(), "/vendor/dashboard");
  });

  it("enter route resolves client /p/{token} and vendor /vendor paths", () => {
    const src = readFileSync(
      resolve(import.meta.dirname, "../../app/api/htc-support/enter/route.ts"),
      "utf8",
    );
    assert.match(src, /resolveClientPortalPath/);
    assert.match(src, /resolveVendorPortalPath/);
    assert.doesNotMatch(src, /dest = `\/clients\/\$\{claims\.clientId\}`/);
    assert.doesNotMatch(src, /dest = `\/vendors\/\$\{claims\.vendorId\}`/);
  });

  it("vendor client switches to venue jar for support portal cookie", () => {
    const src = readFileSync(
      resolve(import.meta.dirname, "../../integrations/supabase/server.ts"),
      "utf8",
    );
    assert.match(src, /htc_support_portal/);
    assert.match(src, /supportPortal === "vendor"/);
  });
});
