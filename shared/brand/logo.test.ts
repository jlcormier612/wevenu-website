import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { join } from "node:path";

import {
  HTC_EMAIL_LOGO_WIDTH_PX,
  HTC_LOGO_ALT,
  HTC_LOGO_PUBLIC_PATH,
  htcBrandAssetOrigin,
  htcEmailLogoHeaderHtml,
  htcEmailLogoHtml,
  htcLogoAbsoluteUrl,
} from "./logo";

const ROOT = join(import.meta.dirname, "../..");

const ENV_KEYS = [
  "NEXT_PUBLIC_MARKETING_URL",
  "MARKETING_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_PRODUCT_APP_URL",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("HTC communication logo", () => {
  it("points at the existing official transparent PNG, not a generated substitute", () => {
    assert.equal(HTC_LOGO_PUBLIC_PATH, "/brand/hello-to-cheers-logo-primary-transparent.png");
    assert.equal(HTC_LOGO_ALT, "Hello to Cheers");
    assert.equal(HTC_EMAIL_LOGO_WIDTH_PX, 200);
    assert.ok(existsSync(join(ROOT, "public", HTC_LOGO_PUBLIC_PATH)));
    assert.ok(existsSync(join(ROOT, "marketing/public", HTC_LOGO_PUBLIC_PATH)));
  });

  it("builds an absolute HTTPS URL — never a filesystem path", () => {
    process.env.NEXT_PUBLIC_MARKETING_URL = "https://sandbox.hellotocheers.com/";
    assert.equal(
      htcLogoAbsoluteUrl(),
      "https://sandbox.hellotocheers.com/brand/hello-to-cheers-logo-primary-transparent.png",
    );
    assert.doesNotMatch(htcLogoAbsoluteUrl(), /file:|\/Users\/|C:\\/);
  });

  it("prefers marketing origin, then the product app", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";
    assert.equal(htcBrandAssetOrigin(), "https://app.sandbox.hellotocheers.com");
    process.env.NEXT_PUBLIC_MARKETING_URL = "https://sandbox.hellotocheers.com";
    assert.equal(htcBrandAssetOrigin(), "https://sandbox.hellotocheers.com");
  });

  it("renders email-safe logo HTML with alt text and optional link", () => {
    process.env.NEXT_PUBLIC_MARKETING_URL = "https://hellotocheers.com";
    const html = htcEmailLogoHeaderHtml({ href: "https://hellotocheers.com" });
    assert.match(html, /alt="Hello to Cheers"/);
    assert.match(html, /width="200"/);
    assert.match(html, /https:\/\/hellotocheers\.com\/brand\/hello-to-cheers-logo-primary-transparent\.png/);
    assert.match(html, /href="https:\/\/hellotocheers\.com"/);
    assert.doesNotMatch(html, /HC/);
    assert.equal(htcEmailLogoHtml().includes("<a "), false);
  });
});
