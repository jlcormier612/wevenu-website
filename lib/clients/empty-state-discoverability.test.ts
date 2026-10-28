/**
 * Empty Clients list must make manual add discoverable without requiring import.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Clients empty-state discoverability", () => {
  const list = readFileSync(resolve("components/clients/client-list.tsx"), "utf8");
  const page = readFileSync(resolve("app/(app)/clients/page.tsx"), "utf8");

  it("empty state offers Add your first client and Import as an alternative", () => {
    assert.match(list, /data-clients-empty="true"/);
    assert.match(list, /Add your first client/);
    assert.match(list, /href="\/clients\/new"/);
    assert.match(list, /Import Clients/);
    assert.match(list, /href="\/settings\/import\?type=couples"/);
    assert.match(list, /Add your first client or import an existing client list/);
  });

  it("page header still exposes New Client without requiring import first", () => {
    assert.match(page, /href="\/clients\/new"/);
    assert.match(page, /\+ New Client|New Client/);
    assert.match(page, /Import Clients/);
  });
});
