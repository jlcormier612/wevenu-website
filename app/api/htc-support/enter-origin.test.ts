import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("htc-support enter public origin", () => {
  it("prefers NEXT_PUBLIC_APP_URL over request.url.origin for redirects", () => {
    const src = readFileSync(resolve(import.meta.dirname, "enter/route.ts"), "utf8");
    assert.match(src, /function publicAppOrigin/);
    assert.match(src, /NEXT_PUBLIC_APP_URL/);
    assert.match(src, /NextResponse\.redirect\(new URL\(dest, origin\)\)/);
    assert.doesNotMatch(src, /NextResponse\.redirect\(new URL\(dest, url\.origin\)\)/);
  });
});
