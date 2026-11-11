/**
 * Partner email must travel from the public inquiry/tour form into the
 * inquire + tour book payloads (and never be substituted for primary email).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const root = process.cwd();

describe("public inquiry partner email persistence seams", () => {
  it("inquiry form collects and submits partnerEmail separately from primary email", () => {
    const form = readFileSync(join(root, "components/form/inquiry-form.tsx"), "utf8");
    assert.match(form, /const \[partnerEmail, setPartnerEmail\]/);
    assert.match(form, /data-testid="inquiry-partner-email"/);
    assert.match(form, /partnerEmail:\s*partnerEmail\.trim\(\)\s*\|\|\s*null/);
    assert.match(form, /\/api\/public\/inquire/);
    // Must not send primary email as partner email
    assert.doesNotMatch(form, /partnerEmail:\s*email\b/);
  });

  it("tour book payload carries structured partner email from the shared form", () => {
    const form = readFileSync(join(root, "components/form/inquiry-form.tsx"), "utf8");
    const book = readFileSync(join(root, "app/api/tours/book/route.ts"), "utf8");
    const service = readFileSync(join(root, "lib/tours/service.ts"), "utf8");
    assert.match(form, /\/api\/tours\/book/);
    assert.match(form, /partnerEmail:\s*partnerEmail\.trim\(\)\s*\|\|\s*null/);
    assert.match(book, /partnerEmail:\s*body\.partnerEmail/);
    assert.match(service, /applyStructuredPartnerFieldsToLead/);
    assert.match(service, /partner_email/);
  });

  it("public inquire API already maps partnerEmail into create_public_lead", () => {
    const inquire = readFileSync(join(root, "app/api/public/inquire/route.ts"), "utf8");
    assert.match(inquire, /partnerEmail:\s*partnerEmail\s*\?\s*String\(partnerEmail\)\s*:\s*null/);
    assert.match(inquire, /p_partner_email:\s*normalized\.partnerEmail/);
  });
});
