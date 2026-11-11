/**
 * Setup Hub readiness declaration — copy-only polish.
 * Behavior stays on setReadyToInviteCouples / ready_to_invite_couples.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

const readiness = read("components/setup-hub/setup-readiness.tsx");
const actions = read("app/(app)/setup-hub/actions.ts");
const service = read("lib/setup-hub/service.ts");
const repository = read("lib/setup-hub/repository.ts");
const conciergeSelect = read("lib/setup-concierge/select.ts");
const vendorBook = read(
  "supabase/migrations/20261413500000_book_relationship_assign_required_vendors.sql",
);

describe("Setup Hub readiness copy", () => {
  it("uses the new CTA and supporting copy; removes invite-couples CTA phrasing", () => {
    assert.match(readiness, /We&apos;re ready to start working with couples/);
    assert.match(
      readiness,
      /You&apos;ve decided you&apos;re ready\. We&apos;ll stop showing setup guidance, but you can continue configuring your venue anytime\./,
    );
    assert.doesNotMatch(readiness, /We&apos;re ready to invite couples/);
    assert.doesNotMatch(readiness, /ready to invite couples!/);
    assert.doesNotMatch(readiness, /You told us you&apos;re ready to invite couples in/);
  });
});

describe("Setup Hub readiness behavior unchanged", () => {
  it("still writes ready_to_invite_couples via existing action/service/repository", () => {
    assert.match(readiness, /setReadyToInviteCouplesAction\(ready\)/);
    assert.match(actions, /setReadyToInviteCouplesAction/);
    assert.match(actions, /setupHub\.setReadyToInviteCouples\(ready\)/);
    assert.match(actions, /revalidatePath\("\/setup-hub"\)/);
    assert.match(actions, /revalidatePath\("\/dashboard"\)/);
    assert.match(service, /setReadyToInviteCouples/);
    assert.match(repository, /ready_to_invite_couples: true/);
    assert.match(repository, /ready_to_invite_couples_at/);
    assert.match(repository, /ready_to_invite_couples_declared_by/);
    assert.match(repository, /ready_to_invite_couples: false/);
  });

  it("keeps undo control and does not invite clients", () => {
    assert.match(readiness, /We need a bit more time/);
    assert.match(readiness, /onClick=\{\(\) => toggle\(false\)\}/);
    assert.doesNotMatch(readiness, /inviteClient|sendInvite|portal invite|Invite to portal/i);
    assert.doesNotMatch(actions, /inviteClient|sendInvite|createPortalSession/);
  });

  it("Setup Concierge still stops when readyToInviteCouples is true", () => {
    assert.match(conciergeSelect, /if \(snapshot\.readyToInviteCouples\) return null/);
  });

  it("does not touch Vendor booking assign path or Setup Profile vendors UI", () => {
    assert.match(vendorBook, /is_required = true/);
    assert.match(vendorBook, /event_vendor_assignments/);
    assert.doesNotMatch(readiness, /is_required|requiredVendorIds|Vendor Network/);
  });
});
