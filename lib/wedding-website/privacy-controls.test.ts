import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  mintWeddingWebsiteUnlockToken,
  verifyWeddingWebsiteUnlockToken,
  WEDDING_WEBSITE_UNLOCK_COOKIE,
} from "./guest-unlock";
import {
  allowWeddingWebsitePasswordAttempt,
  resetWeddingWebsitePasswordAttemptsForTests,
} from "./password-rate-limit";

const root = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("wedding website privacy controls — migration matrix", () => {
  const mig = read("supabase/migrations/20270329120000_wedding_website_privacy_controls.sql");

  it("adds search_visible default true and password_hash + password_version", () => {
    assert.match(mig, /search_visible boolean not null default true/);
    assert.match(mig, /password_hash text/);
    assert.match(mig, /password_version integer not null default 0/);
  });

  it("hashes new passwords with bcrypt and clears plaintext", () => {
    assert.match(mig, /extensions\.crypt\(p_password, extensions\.gen_salt\('bf'\)\)/);
    assert.match(mig, /password = null/);
    assert.match(mig, /password_version = coalesce\(password_version, 0\) \+ 1/);
  });

  it("migrates residual plaintext passwords then nulls them", () => {
    assert.match(mig, /where password is not null/);
    assert.match(mig, /password_hash = extensions\.crypt\(password/);
  });

  it("gates public content unless preview, password, or service-role unlock", () => {
    assert.match(mig, /requires_password/);
    assert.match(mig, /p_service_unlock/);
    assert.match(mig, /auth\.role\(\) = 'service_role'/);
    assert.match(mig, /status not in \('published', 'archived'\)/);
  });

  it("exposes independent searchVisible without requiring password", () => {
    assert.match(mig, /'searchVisible', coalesce\(v_site\.search_visible, true\)/);
    assert.match(mig, /p_search_visible/);
  });

  it("grants the widened get_wedding_website and update_my_website signatures", () => {
    assert.match(
      mig,
      /grant execute on function public\.get_wedding_website\(text, text, text, text, text, boolean\)/,
    );
    assert.match(mig, /grant execute on function public\.update_my_website\(/);
    assert.match(mig, /drop function if exists public\.get_wedding_website\(text, text, text, text\);/);
    assert.match(
      mig,
      /drop function if exists public\.update_my_website\(\s*text, text, boolean, text, boolean, text, text, text, text, text\[\],\s*text, jsonb, text\[\], boolean, uuid, uuid, uuid, uuid,\s*text, text, text, text, text, text, boolean, text\s*\);/s,
    );
  });
});

describe("wedding website privacy controls — app surfaces", () => {
  it("public metadata applies couple-controlled robots and hides password content", () => {
    const page = read("app/w/[slug]/page.tsx");
    assert.match(page, /searchVisible/);
    assert.match(page, /requires_password/);
    assert.match(page, /Private Wedding Website/);
    assert.match(page, /p_password: null/);
    assert.match(page, /p_service_unlock: true/);
    assert.match(page, /WEDDING_WEBSITE_UNLOCK_COOKIE/);
    assert.doesNotMatch(page, /marketing/);
    // Passwords must never be accepted via URL query params.
    assert.doesNotMatch(page, /\bp\?:/);
    assert.doesNotMatch(page, /password \?\? null/);
    assert.doesNotMatch(page, /\?p=/);
  });

  it("unlock route sets httpOnly cookie after server-side password check", () => {
    const unlock = read("app/api/wedding-website/unlock/route.ts");
    assert.match(unlock, /allowWeddingWebsitePasswordAttempt/);
    assert.match(unlock, /httpOnly: true/);
    assert.match(unlock, /mintWeddingWebsiteUnlockToken/);
    assert.match(unlock, /get_wedding_website/);
  });

  it("proxy allowlists only the guest unlock endpoint", () => {
    const proxy = read("integrations/supabase/proxy.ts");
    assert.match(proxy, /\/api\/wedding-website\/unlock/);
    assert.doesNotMatch(
      proxy,
      /\/api\/wedding-website", \/\/ public wedding-website unlock \(password gate\)/,
    );
    assert.match(proxy, /\/w"/);
  });

  it("password gate posts to unlock API and never puts passwords in URLs", () => {
    const ui = read("components/wedding-website/wedding-website.tsx");
    assert.match(ui, /\/api\/wedding-website\/unlock/);
    assert.match(ui, /Private wedding website/);
    assert.doesNotMatch(ui, /\?p=/);
    assert.doesNotMatch(ui, /encodeURIComponent\(pw\)/);
  });

  it("portal website API and Studio expose independent search + password controls", () => {
    const api = read("app/api/portal/website/route.ts");
    assert.match(api, /searchVisible/);
    assert.match(api, /p_search_visible/);
    const editor = read("components/portal/website-editor.tsx");
    assert.match(editor, /Appear in search engines/);
    assert.match(editor, /Password protect website/);
    assert.match(editor, /clearPassword: true/);
  });

  it("Studio and portal API never return plaintext password or hash", () => {
    const api = read("app/api/portal/website/route.ts");
    const editor = read("components/portal/website-editor.tsx");
    assert.doesNotMatch(api, /password_hash|passwordHash/);
    assert.match(api, /hasPassword|searchVisible/);
    assert.doesNotMatch(editor, /password_hash/);
  });
});

describe("guest unlock token", () => {
  it("accepts matching site+version and rejects version bump (password change)", () => {
    process.env.SENSITIVE_FIELD_ENCRYPTION_KEY = "test-unlock-secret";
    const token = mintWeddingWebsiteUnlockToken({ siteId: "site-1", passwordVersion: 3, ttlSeconds: 120 });
    assert.equal(
      verifyWeddingWebsiteUnlockToken(token, { siteId: "site-1", passwordVersion: 3 }),
      true,
    );
    assert.equal(
      verifyWeddingWebsiteUnlockToken(token, { siteId: "site-1", passwordVersion: 4 }),
      false,
    );
    assert.equal(
      verifyWeddingWebsiteUnlockToken(token, { siteId: "other", passwordVersion: 3 }),
      false,
    );
    assert.equal(WEDDING_WEBSITE_UNLOCK_COOKIE, "htc_ww_unlock");
  });

  it("rejects expired tokens", () => {
    process.env.SENSITIVE_FIELD_ENCRYPTION_KEY = "test-unlock-secret";
    const token = mintWeddingWebsiteUnlockToken({ siteId: "site-1", passwordVersion: 1, ttlSeconds: 60 });
    const past = Math.floor(Date.now() / 1000) + 3600;
    assert.equal(
      verifyWeddingWebsiteUnlockToken(token, { siteId: "site-1", passwordVersion: 1 }, past),
      false,
    );
  });
});

describe("password rate limit", () => {
  it("allows then blocks after max attempts", () => {
    resetWeddingWebsitePasswordAttemptsForTests();
    for (let i = 0; i < 20; i++) assert.equal(allowWeddingWebsitePasswordAttempt("k"), true);
    assert.equal(allowWeddingWebsitePasswordAttempt("k"), false);
  });
});
