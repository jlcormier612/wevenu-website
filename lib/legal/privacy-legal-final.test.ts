/**
 * LEGAL-FINAL Privacy Policy publication guards.
 * Marketing source: marketing/lib/marketing/legal.ts
 * App acceptance source: legal_documents (migration 20270208120000).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PRIVACY_POLICY, TERMS_OF_SERVICE, VENDOR_TERMS, COOKIE_POLICY } from "../../marketing/lib/marketing/legal";

const migration = readFileSync(
  resolve("supabase/migrations/20270208120000_legal_documents_privacy_legal_final.sql"),
  "utf8",
);

describe("LEGAL-FINAL Privacy Policy 2026-11-21.1", () => {
  it("marketing Privacy uses publication effective date and approved §7A / §10 wording", () => {
    assert.equal(PRIVACY_POLICY.effectiveDate, "November 21, 2026");

    const ai = PRIVACY_POLICY.sections.find(
      (s) => s.heading === "How our AI provider handles information",
    );
    assert.ok(ai);
    const aiBody = (ai!.paragraphs ?? []).join("\n");
    assert.match(aiBody, /OpenAI's API to support certain Luv features/);
    assert.match(aiBody, /not used to train OpenAI's models by default unless the API customer opts in/);
    assert.match(aiBody, /abuse monitoring and security purposes/);
    assert.match(aiBody, /does not use information submitted to Luv for advertising/);

    const choices = PRIVACY_POLICY.sections.find(
      (s) => s.heading === "10. Your Choices and Rights",
    );
    assert.ok(choices);
    const choicesBody = (choices!.paragraphs ?? []).join("\n");
    assert.match(
      choicesBody,
      /You may manage your cookie preferences at \/cookies where available/,
    );
    assert.match(
      choicesBody,
      /If Hello to Cheers sends you promotional emails, those messages will provide a way to opt out/,
    );
    assert.doesNotMatch(choicesBody, /unsubscribe from promotional emails using the link in those messages/);
  });

  it("preserves existing §7A transmission disclosure", () => {
    const section = PRIVACY_POLICY.sections.find(
      (s) => s.heading === "7A. Assistive AI (Luv and related features)",
    );
    assert.ok(section);
    const body = (section!.paragraphs ?? []).join("\n");
    assert.match(body, /third-party artificial-intelligence provider \(currently OpenAI\)/);
    assert.match(body, /These transmissions can include personal information/);
  });

  it("migration activates only privacy_policy 2026-11-21.1 and matches marketing wording", () => {
    assert.match(migration, /'2026-11-21\.1'/);
    assert.match(migration, /effective_date,\n[\s\S]*?'2026-11-21'/);
    assert.match(migration, /where document_type = 'privacy_policy'/);
    assert.match(migration, /How our AI provider handles information/);
    assert.match(migration, /manage your cookie preferences at \/cookies where available/);
    assert.doesNotMatch(migration, /unsubscribe from promotional emails using the link in those messages/);
    assert.equal((migration.match(/insert into public\.legal_documents/g) || []).length, 1);
    assert.match(
      migration,
      /insert into public\.legal_documents \([\s\S]*?\) values \(\s*'privacy_policy'/,
    );
    assert.doesNotMatch(migration, /update public\.legal_acceptances|delete from public\.legal_acceptances/);
  });

  it("does not alter Terms, Vendor Terms, or Cookie Policy effective dates in marketing source", () => {
    assert.equal(TERMS_OF_SERVICE.effectiveDate, "September 23, 2026");
    assert.equal(VENDOR_TERMS.effectiveDate, "July 15, 2026");
    assert.equal(COOKIE_POLICY.effectiveDate, "July 15, 2026");
  });

  it("does not publish a residential street address in Privacy marketing source", () => {
    const blob = JSON.stringify(PRIVACY_POLICY);
    assert.doesNotMatch(blob, /\b\d{1,5}\s+[A-Z][a-z]+ (Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr)\b/);
    assert.match(blob, /privacy@hellotocheers\.com/);
  });
});
