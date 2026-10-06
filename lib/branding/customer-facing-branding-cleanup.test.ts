/**
 * Final customer-facing branding cleanup — three inventoried defects only.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { renderEmailTemplate } from "@/shared/email/templates/registry";
import { wrapHelloHtml } from "@/shared/email/templates/helpers";
import { HTC_LOGO_PUBLIC_PATH } from "@/shared/brand/logo";

const ROOT = resolve(process.cwd());

const REDUNDANT_WORDMARK =
  /letter-spacing:0\.14em;text-transform:uppercase[^>]*>Hello to Cheers</;
const GENERIC_EYEBROW = /ws-eyebrow[^>]*>\s*Hello to Cheers/;

describe("A — wrapHelloHtml email shell", () => {
  it("keeps the canonical logo and drops the redundant Hello to Cheers wordmark", () => {
    const html = wrapHelloHtml("Founding Member Welcome", "<p>Hi Sally,</p>");
    assert.match(html, new RegExp(HTC_LOGO_PUBLIC_PATH.replace(/\//g, "\\/")));
    assert.match(html, /hello-to-cheers-logo-primary-transparent\.png/);
    assert.match(html, /alt="Hello to Cheers"/);
    assert.doesNotMatch(html, REDUNDANT_WORDMARK);
    assert.match(html, />Founding Member Welcome</);
    assert.match(html, /Hi Sally/);
    assert.match(html, /Jennifer &amp; the Hello to Cheers team/);
  });

  it("founder_welcome still renders logo + title without the shared wordmark eyebrow", () => {
    const rendered = renderEmailTemplate("founder_welcome", {
      firstName: "Sally",
      lastName: "Sunshine",
      fullName: "Sally Sunshine",
      venueName: "Sally Sunshine Events",
      planName: "Gather",
      activateUrl:
        "https://workspace.sandbox.hellotocheers.com/activate/tok_sally_test",
    });
    assert.match(rendered.html, /hello-to-cheers-logo-primary-transparent\.png/);
    assert.match(rendered.html, />Founding Member Welcome</);
    assert.doesNotMatch(rendered.html, REDUNDANT_WORDMARK);
    assert.match(
      rendered.html,
      /https:\/\/workspace\.sandbox\.hellotocheers\.com\/activate\/tok_sally_test/,
    );
  });
});

describe("B — vendor accept branding chrome", () => {
  const src = readFileSync(resolve(ROOT, "app/vendor/accept/page.tsx"), "utf8");

  it("uses the canonical Wordmark logo and does not introduce a text wordmark", () => {
    assert.match(src, /import \{ Wordmark \} from "@\/components\/brand\/wordmark"/);
    assert.match(src, /<Wordmark\s*\/>/);
    assert.doesNotMatch(src, GENERIC_EYEBROW);
    assert.doesNotMatch(src, /HELLO TO CHEERS/);
    // Claim logic wiring must remain present.
    assert.match(src, /get_vendor_by_claim_token/);
    assert.match(src, /VendorAcceptAuthedPanel/);
    assert.match(src, /VendorAcceptUnauthPanel/);
  });
});

describe("C — White Glove branding chrome", () => {
  const intake = readFileSync(
    resolve(ROOT, "app/onboarding/white-glove/[token]/page.tsx"),
    "utf8",
  );
  const waiting = readFileSync(
    resolve(ROOT, "app/onboarding/white-glove/[token]/waiting/page.tsx"),
    "utf8",
  );
  const chrome = readFileSync(
    resolve(ROOT, "components/onboarding/white-glove-brand-chrome.tsx"),
    "utf8",
  );

  it("shared chrome uses the canonical Wordmark logo only", () => {
    assert.match(chrome, /Wordmark/);
    assert.match(chrome, /HTC|Wordmark/);
    assert.doesNotMatch(chrome, GENERIC_EYEBROW);
    assert.doesNotMatch(chrome, /HELLO TO CHEERS/);
  });

  it("intake page mounts brand chrome and keeps intake wiring", () => {
    assert.match(intake, /WhiteGloveBrandChrome/);
    assert.match(intake, /WhiteGloveIntakeClient/);
    assert.match(intake, /intake_token/);
    assert.doesNotMatch(intake, GENERIC_EYEBROW);
  });

  it("waiting page mounts brand chrome and keeps waiting copy", () => {
    assert.match(waiting, /WhiteGloveBrandChrome/);
    assert.match(waiting, /We&apos;re getting your venue ready/);
    assert.doesNotMatch(waiting, GENERIC_EYEBROW);
  });
});
