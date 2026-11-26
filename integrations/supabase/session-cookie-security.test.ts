import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));

describe("session cookie security (Intuit Secure + HttpOnly)", () => {
  it("server createClient cookieOptions set Secure and HttpOnly", () => {
    const src = readFileSync(join(dir, "server.ts"), "utf8");
    assert.match(src, /httpOnly:\s*true/);
    assert.match(src, /secure:\s*true/);
  });

  it("proxy createClient cookieOptions set Secure and HttpOnly", () => {
    const src = readFileSync(join(dir, "proxy.ts"), "utf8");
    assert.match(src, /httpOnly:\s*true/);
    assert.match(src, /secure:\s*true/);
    assert.match(src, /httpOnly:\s*true,\s*\n\s*sameSite:/);
  });

  it("browser createClient requests Secure and HttpOnly (middleware rewrites)", () => {
    const src = readFileSync(join(dir, "client.ts"), "utf8");
    assert.match(src, /httpOnly:\s*true/);
    assert.match(src, /secure:\s*true/);
  });
});
