import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

/**
 * Client-facing email paths must share emailBrandFromVenue /
 * wrapConversationMessageHtml / appendEmailSignatureText so preview and
 * production use the same signature source (venues.email_signature).
 */
describe("email branding/signature path audit", () => {
  const paths: { file: string; mustInclude: RegExp[] }[] = [
    {
      file: "lib/conversations/service.ts",
      mustInclude: [/emailBrandFromVenue/, /wrapConversationMessageHtml/, /appendEmailSignatureText/],
    },
    {
      file: "lib/scheduled-messages/processor.ts",
      mustInclude: [/emailBrandFromVenue/, /wrapConversationMessageHtml/, /appendEmailSignatureText/, /email_signature/],
    },
    {
      file: "lib/notifications/obligation-engine.ts",
      mustInclude: [/emailBrandFromVenue/, /wrapConversationMessageHtml/, /appendEmailSignatureText/, /email_signature/],
    },
    {
      file: "lib/notifications/engine.ts",
      mustInclude: [/emailBrandFromVenue/, /appendEmailSignatureText/, /email_signature/],
    },
    {
      file: "lib/contracts/service.ts",
      mustInclude: [/emailBrandFromVenue/, /buildContractInviteHtml/],
    },
    {
      file: "components/settings/communication-identity-section.tsx",
      mustInclude: [/renderEmailBrandPreviewHtml/, /emailSignature/],
    },
  ];

  for (const row of paths) {
    it(`${row.file} uses the shared brand/signature source`, () => {
      const src = readFileSync(resolve(row.file), "utf8");
      for (const re of row.mustInclude) {
        assert.match(src, re);
      }
    });
  }

  it("preview renderer is the same branded shell as production", () => {
    const brand = readFileSync(resolve("lib/email/venue-brand.ts"), "utf8");
    assert.match(brand, /export function renderEmailBrandPreviewHtml/);
    assert.match(brand, /return renderBrandedEmailHtml\(brand/);
    assert.match(brand, /emailSignature/);
  });
});
