import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  emailBrandFromVenue,
  renderEmailBrandPreviewHtml,
  resolveEmailFooterContactPrefs,
} from "@/lib/email/venue-brand";

describe("venue email footer contact preferences", () => {
  it("migration adds per-venue display flags with phone default false", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261414900000_venue_email_footer_contact_prefs.sql"),
      "utf8",
    );
    assert.match(sql, /email_footer_show_signature boolean not null default true/);
    assert.match(sql, /email_footer_show_email boolean not null default true/);
    assert.match(sql, /email_footer_show_phone boolean not null default false/);
    assert.match(sql, /Does not change the stored/);
  });

  it("settings service persists prefs on the active venue without clearing contact fields", () => {
    const service = readFileSync(join(process.cwd(), "lib/venue/service.ts"), "utf8");
    assert.match(service, /updateVenueEmailFooterContactPrefs/);
    assert.match(service, /email_footer_show_signature/);
    assert.match(service, /email_footer_show_phone/);
    // Must not null out email/phone when saving display prefs.
    const fnStart = service.indexOf("export async function updateVenueEmailFooterContactPrefs");
    const fn = service.slice(fnStart, fnStart + 900);
    assert.doesNotMatch(fn, /email:\s*null/);
    assert.doesNotMatch(fn, /phone:\s*null/);
  });

  it("preview uses the same emailBrandFromVenue path as production", () => {
    const ui = readFileSync(
      join(process.cwd(), "components/settings/communication-identity-section.tsx"),
      "utf8",
    );
    assert.match(ui, /emailBrandFromVenue\(/);
    assert.match(ui, /renderEmailBrandPreviewHtml\(/);
    assert.match(ui, /updateEmailFooterContactPrefsAction/);
  });

  it("new-venue defaults hide phone and keep email + signature visible when present", () => {
    const prefs = resolveEmailFooterContactPrefs({});
    assert.deepEqual(prefs, {
      showSignature: true,
      showEmail: true,
      showPhone: false,
    });
    const brand = emailBrandFromVenue({
      name: "New Venue",
      emailSignature: "Warmly,\nNew Venue",
      email: "hello@new.test",
      phone: "5551234567",
    });
    assert.equal(brand.emailSignature, "Warmly,\nNew Venue");
    assert.equal(brand.replyContact, "hello@new.test");
    const preview = renderEmailBrandPreviewHtml(brand);
    assert.match(preview, /hello@new\.test/);
    assert.doesNotMatch(preview, /555/);
  });

  it("explicitly enabling phone shows formatted number in preview HTML", () => {
    const brand = emailBrandFromVenue({
      name: "New Venue",
      email: "hello@new.test",
      phone: "5551234567",
      emailFooterShowPhone: true,
    });
    const preview = renderEmailBrandPreviewHtml(brand);
    assert.match(preview, /\(555\) 123-4567/);
  });
});
