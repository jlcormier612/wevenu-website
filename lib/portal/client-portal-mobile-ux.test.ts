/**
 * Client portal mobile UX — password reveal, invite labels, legal history,
 * support access duration, Luv chips, message scroll, logo on dark, assignment label.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { assignmentActionLabel } from "@/lib/team/assignment-action-label";
import { resolveLuvAskSuggestedChips } from "@/lib/luv/portal-context/chips";
import { HTC_LOGO_ON_DARK_PUBLIC_PATH, HTC_LOGO_PUBLIC_PATH } from "@/shared/brand/logo";

const ROOT = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

describe("1 — password visibility", () => {
  const pwd = read("components/ui/password-input.tsx");
  it("shared PasswordInput toggles without clearing value", () => {
    assert.match(pwd, /Show password/);
    assert.match(pwd, /Hide password/);
    assert.match(pwd, /aria-pressed=\{revealed\}/);
    assert.match(pwd, /type=\{revealed \? "text" : "password"\}/);
  });
  it("client login, accept, participant accept, and account change use PasswordInput", () => {
    assert.match(read("app/client/login/login-form.tsx"), /PasswordInput/);
    assert.match(read("app/client/accept/accept-form.tsx"), /PasswordInput/);
    assert.match(read("app/client/accept-participant/accept-participant-form.tsx"), /PasswordInput/);
    assert.match(read("components/portal/portal-shell.tsx"), /PasswordInput/);
    assert.match(read("components/portal/portal-shell.tsx"), /account-new-password/);
  });
});

describe("2 — invite someone labels and explanation", () => {
  const shell = read("components/portal/portal-shell.tsx");
  it("invite form has persistent labels and plain-language delivery copy", () => {
    assert.match(shell, /data-testid="portal-invite-form"/);
    assert.match(shell, /htmlFor="invite-first"/);
    assert.match(shell, /htmlFor="invite-email"/);
    assert.match(shell, /htmlFor="invite-role"/);
    assert.match(shell, /htmlFor="invite-access"/);
    assert.match(shell, /private invitation to this event workspace/);
    assert.match(shell, /Knowing an email address alone does not grant access/);
    assert.match(shell, /How they relate to your celebration/);
    assert.match(shell, /What they can see and do in this workspace/);
  });
});

describe("3 — legal history empty / cards", () => {
  const legal = read("components/legal/legal-history-section.tsx");
  it("portal uses cards and clear empty copy", () => {
    assert.match(legal, /No legal documents accepted yet\./);
    assert.match(legal, /LegalHistoryCards/);
    assert.match(legal, /data-testid="legal-history-empty"/);
    assert.match(legal, /data-testid="legal-history-loading"/);
    assert.match(legal, /data-testid="legal-history-error"/);
  });
});

describe("4 — support access duration label", () => {
  const shell = read("components/portal/portal-shell.tsx");
  it("duration select is labeled and explains grant", () => {
    assert.match(shell, /htmlFor="support-access-duration"/);
    assert.match(shell, /Access duration/);
    assert.match(shell, /data-testid="support-access-grant"/);
    assert.match(shell, /Grant Temporary Access/);
    assert.match(shell, /SUPPORT_ACCESS_DURATIONS/);
  });
});

describe("5 — Ask Luv suggestion chips", () => {
  it("never returns empty chip labels", () => {
    const chips = resolveLuvAskSuggestedChips(null);
    assert.ok(chips.length >= 4);
    for (const q of chips) {
      assert.ok(q.trim().length > 0, `empty chip: ${JSON.stringify(q)}`);
    }
  });
  it("ask section filters empty labels and hides empty section", () => {
    const ask = read("components/portal/luv-ask-section.tsx");
    assert.match(ask, /suggested\.filter\(\(q\) => q\.trim\(\)\.length > 0\)/);
    assert.match(ask, /suggested\.length > 0 \?/);
    assert.match(ask, /text-foreground/);
  });
});

describe("6 — required vendor self-booking exclusion", () => {
  const lookup = read("lib/vendor-availability/lookup.ts");
  const overlay = read("lib/vendor-availability/couple-overlay.ts");
  it("excludes this event's assignments from unavailable/booked", () => {
    assert.match(lookup, /excludeEventId/);
    assert.match(lookup, /assignmentEventId === excludeEventId/);
    assert.match(overlay, /lookupVendorsForEventDate\(ids, eventDate, eventId\)/);
  });
  it("portal UI does not mark required/assigned as Unavailable", () => {
    const vendors = read("components/portal/vendor-section.tsx");
    assert.match(vendors, /onThisEventTeam/);
    assert.match(vendors, /On your event/);
  });
});

describe("7 — portal messages scroll to latest", () => {
  const msg = read("components/portal/message-section.tsx");
  it("sorts chronological and scrolls the list container to bottom", () => {
    assert.match(msg, /listRef/);
    assert.match(msg, /scrollHeight/);
    assert.match(msg, /sort\(/);
    assert.match(msg, /data-testid="portal-message-list"/);
    assert.match(msg, /oldest at top, newest at bottom/);
  });
});

describe("8 — HTC logo on dark backgrounds", () => {
  it("ships an on-dark logo asset and Wordmark uses it in dark mode", () => {
    assert.ok(existsSync(resolve(ROOT, "public" + HTC_LOGO_ON_DARK_PUBLIC_PATH)));
    assert.notEqual(HTC_LOGO_ON_DARK_PUBLIC_PATH, HTC_LOGO_PUBLIC_PATH);
    const wm = read("components/brand/wordmark.tsx");
    assert.match(wm, /HTC_LOGO_ON_DARK_PUBLIC_PATH/);
    assert.match(wm, /forceDark/);
    assert.match(wm, /hidden dark:block/);
  });
});

describe("9 — Edit/Save Assignment label", () => {
  it("uses Edit/Save Assignment or Edit/Save compact fallback", () => {
    assert.equal(assignmentActionLabel("staff"), "Edit/Save Assignment");
    assert.equal(assignmentActionLabel(null), "Edit/Save Assignment");
    assert.equal(assignmentActionLabel("staff", { compact: true }), "Edit/Save");
  });
  it("StaffAssignmentField keeps explicit save and nowrap label", () => {
    const field = read("components/team/staff-assignment-field.tsx");
    assert.match(field, /whitespace-nowrap/);
    assert.match(field, /assignmentActionLabel\(persistedId/);
    assert.match(field, /onSave\(next\.trim\(\) \|\| null\)/);
    assert.doesNotMatch(field, /Edit assignment|Save assignment/);
  });
});
