/**
 * Source-level coverage: former bypass paths must go through sendEmail /
 * postResendEmail — never a raw api.resend.com/emails fetch.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

function read(rel: string): string {
  return readFileSync(resolve(rel), "utf8");
}

const RAW_POST = /api\.resend\.com\/emails(?!\/)/;

describe("Resend send-path coverage (RESEND-SCALE Phase B)", () => {
  it("message notify uses sendEmail, not raw fetch", () => {
    const src = read("lib/messages/notify.ts");
    assert.match(src, /from ["']@\/lib\/email\/send["']/);
    assert.match(src, /sendEmail\(/);
    assert.match(src, /category:\s*["']message_alert["']/);
    assert.doesNotMatch(src, RAW_POST);
  });

  it("feedback notify uses sendEmail, not raw fetch", () => {
    const src = read("lib/feedback/notify.ts");
    assert.match(src, /from ["']@\/lib\/email\/send["']/);
    assert.match(src, /sendEmail\(/);
    assert.doesNotMatch(src, RAW_POST);
  });

  it("password recovery uses sendEmail with critical category", () => {
    const src = read("lib/auth/send-password-recovery-email.ts");
    assert.match(src, /sendEmail\(/);
    assert.match(src, /password_recovery/);
    assert.match(src, /openTracking:\s*false/);
    assert.doesNotMatch(src, RAW_POST);
  });

  it("guest RSVP invite route uses sendEmail as bulk and distinguishes deferred", () => {
    const src = read("app/api/portal/invite/route.ts");
    assert.match(src, /sendEmail\(/);
    assert.match(src, /guest_rsvp_invite/);
    assert.match(src, /priority:\s*["']bulk["']/);
    assert.match(src, /deferredGuestIds/);
    assert.match(src, /sentGuestIds/);
    assert.match(src, /method === ["']resend["']/);
    assert.match(src, /log_invitations_sent/);
    assert.match(src, /p_guest_ids:\s*results\.sentGuestIds/);
    assert.doesNotMatch(src, RAW_POST);
  });

  it("portal guest UI reports deferred separately and does not toast all as sent", () => {
    const guests = read("components/portal/guest-section.tsx");
    const editor = read("components/portal/website-editor.tsx");
    assert.match(guests, /data\.deferred/);
    assert.match(guests, /data\.sent/);
    assert.doesNotMatch(
      guests,
      /toast\.success\(`Invitation sent to \$\{withEmail\.length\}/,
    );
    assert.match(editor, /deferredGuestIds/);
    assert.match(editor, /sentGuestIds/);
    assert.match(editor, /setSelectedGuests\(prev => prev\.filter/);
  });

  it("venue sendEmail and shared client both use postResendEmail", () => {
    const venue = read("lib/email/send.ts");
    const shared = read("shared/email/client.ts");
    assert.match(venue, /postResendEmail/);
    assert.match(shared, /postResendEmail/);
    assert.doesNotMatch(venue, RAW_POST);
    assert.doesNotMatch(shared, RAW_POST);
  });

  it("ops alert lambda acquires pacing slot before Resend POST", () => {
    const src = read("infra/sandbox-ops/lambdas/ops_alert_email/handler.py");
    assert.match(src, /acquire_resend_send_slot/);
    assert.match(src, /_acquire_resend_slot/);
    assert.match(src, /pacing_unavailable/);
  });

  it("scheduled messages claim before send", () => {
    const proc = read("lib/scheduled-messages/processor.ts");
    const repo = read("lib/scheduled-messages/repository.ts");
    assert.match(repo, /claimForSend/);
    assert.match(repo, /reclaimStaleSending/);
    assert.match(proc, /claimForSend/);
    assert.match(proc, /scheduled_sequence/);
  });
});
