import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  PUBLIC_FORM_STARTER_MASTERS,
  seedPublicFormStarters,
} from "@/lib/public-forms/starters";
import { PUBLIC_FORM_COLLECTS_SMS_CONSENT } from "@/lib/public-forms/constants";

const root = process.cwd();

describe("Public Forms starters", () => {
  it("defines exactly four launch starters with draft-safe identities", () => {
    assert.equal(PUBLIC_FORM_STARTER_MASTERS.length, 4);
    const keys = PUBLIC_FORM_STARTER_MASTERS.map((m) => m.key);
    assert.deepEqual(keys, [
      "general_venue_inquiry",
      "wedding_expo_lead_capture",
      "open_house_tour_interest",
      "private_social_event_inquiry",
    ]);
    for (const m of PUBLIC_FORM_STARTER_MASTERS) {
      assert.ok(m.internalName.trim().length > 0);
      assert.ok(m.publicTitle.trim().length > 0);
      assert.ok(m.questions.some((q) => /contact/i.test(q.questionText) && q.required));
    }
  });

  it("does not collect SMS consent on Public Forms starters", () => {
    assert.equal(PUBLIC_FORM_COLLECTS_SMS_CONSENT, false);
    const src = readFileSync(join(root, "lib/public-forms/starters.ts"), "utf8");
    assert.doesNotMatch(src, /applyInquiryCommunicationCapture|requestSmsPermission/);
  });

  it("is wired into ensureVenueStarters seed steps", () => {
    const src = readFileSync(join(root, "lib/provisioning/starters.ts"), "utf8");
    assert.match(src, /key: "public_forms"/);
    assert.match(src, /seedPublicFormStarters/);
  });

  it("exports seedPublicFormStarters for backfill", () => {
    assert.equal(typeof seedPublicFormStarters, "function");
  });

  it("migration adds starter_key uniqueness", () => {
    const mig = readFileSync(
      join(root, "supabase/migrations/20261420000000_public_form_starter_key.sql"),
      "utf8",
    );
    assert.match(mig, /starter_key/);
    assert.match(mig, /public_forms_venue_starter_key_uidx/);
  });
});
