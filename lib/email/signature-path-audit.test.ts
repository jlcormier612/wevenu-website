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
      mustInclude: [
        /emailBrandFromVenue/,
        /wrapConversationMessageHtml/,
        /appendEmailSignatureText/,
        /VENUE_EMAIL_BRAND_SELECT/,
      ],
    },
    {
      file: "lib/notifications/obligation-engine.ts",
      mustInclude: [
        /emailBrandFromVenue/,
        /wrapConversationMessageHtml/,
        /appendEmailSignatureText/,
        /VENUE_EMAIL_BRAND_SELECT/,
      ],
    },
    {
      file: "lib/notifications/engine.ts",
      mustInclude: [
        /emailBrandFromVenue/,
        /appendEmailSignatureText/,
        /VENUE_EMAIL_BRAND_SELECT/,
        /buildTourReminderCoupleEmail/,
        /coupleHtmlAlreadyBranded/,
      ],
    },
    {
      file: "lib/notifications/tour-reminder-email.ts",
      mustInclude: [/wrapConversationMessageHtml/, /appendEmailSignatureText/],
    },
    {
      file: "lib/tours/communication.ts",
      mustInclude: [/emailBrandFromVenue/, /renderBrandedEmailHtml/, /brandButtonHtml/],
    },
    {
      file: "lib/notifications/templates.ts",
      mustInclude: [/renderBrandedEmailHtml/, /emailBrandFromVenue/, /htcEmailLogoHeaderHtml/],
    },
    {
      file: "lib/invoices/payment-request-email.ts",
      mustInclude: [/renderBrandedEmailHtml/, /emailBrandFromVenue/],
    },
    {
      file: "lib/invoices/invoice-document-email.ts",
      mustInclude: [/renderBrandedEmailHtml/, /emailBrandFromVenue/],
    },
    {
      file: "lib/communication/sms-consent-email.ts",
      mustInclude: [/renderBrandedEmailHtml/, /emailBrandFromVenue/],
    },
    {
      file: "lib/brochures/service.ts",
      mustInclude: [/renderBrandedEmailHtml/, /emailBrandFromVenue/],
    },
    {
      file: "lib/client-auth/service.ts",
      mustInclude: [/renderBrandedEmailHtml/, /emailBrandFromVenue/],
    },
    {
      file: "lib/contacts/service.ts",
      mustInclude: [/renderBrandedEmailHtml/, /emailBrandFromVenue/],
    },
    {
      file: "lib/events/questionnaire.ts",
      mustInclude: [/wrapConversationMessageHtml/, /emailBrandFromVenue/],
    },
    {
      file: "lib/event-orders/representation.ts",
      mustInclude: [/wrapConversationMessageHtml/, /emailBrandFromVenue/],
    },
    {
      file: "lib/contracts/service.ts",
      mustInclude: [/emailBrandFromVenue/, /buildContractInviteHtml/],
    },
    {
      file: "lib/commercial-proposals/couple-email.ts",
      mustInclude: [/emailBrandFromVenue/, /brandButtonHtml/, /renderBrandedEmailHtml/],
    },
    {
      file: "components/settings/communication-identity-section.tsx",
      mustInclude: [
        /renderEmailBrandPreviewHtml/,
        /emailBrandFromVenue/,
        /emailFooterShowPhone/,
        /Show venue phone number/,
      ],
    },
  ];

  it("shared brand select includes footer contact preference columns", () => {
    const brand = readFileSync(resolve("lib/email/venue-brand.ts"), "utf8");
    assert.match(brand, /VENUE_EMAIL_BRAND_SELECT/);
    assert.match(brand, /email_footer_show_signature/);
    assert.match(brand, /email_footer_show_email/);
    assert.match(brand, /email_footer_show_phone/);
  });

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
