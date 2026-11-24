import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

describe("marketing proxy www canonicalization", () => {
  const src = readFileSync(join(__dirname, "proxy.ts"), "utf8");

  it("redirects www.hellotocheers.com to apex", () => {
    assert.match(src, /www\.hellotocheers\.com/);
    assert.match(src, /hellotocheers\.com/);
    assert.match(src, /NextResponse\.redirect/);
    assert.match(src, /308/);
  });

  it("still passes through non-www hosts", () => {
    assert.match(src, /NextResponse\.next\(\)/);
  });
});
