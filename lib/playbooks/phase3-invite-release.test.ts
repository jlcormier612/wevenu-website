import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { shouldSendClientInvitation } from "@/lib/client-auth/service";
import { buildCommunicationsReview } from "@/lib/clients/communications-review";

describe("shouldSendClientInvitation", () => {
  it("sends when no invitation exists", () => {
    assert.equal(shouldSendClientInvitation(null), true);
  });

  it("does not send a duplicate when pending or accepted", () => {
    assert.equal(shouldSendClientInvitation({ status: "pending" }), false);
    assert.equal(shouldSendClientInvitation({ status: "accepted" }), false);
  });

  it("allows a new invite after revoke", () => {
    assert.equal(shouldSendClientInvitation({ status: "revoked" }), true);
  });
});

describe("Phase 3 invite-at-release seams", () => {
  it("Book This Lead does not call inviteClient and still converts", () => {
    const src = readFileSync(resolve("lib/clients/service.ts"), "utf8");
    const fnStart = src.indexOf("export async function convertLeadToClient");
    const fnEnd = src.indexOf("export async function updateClientInfo", fnStart);
    const fn = src.slice(fnStart, fnEnd);
    assert.doesNotMatch(fn, /inviteClient\(/);
    assert.match(fn, /insertClient\(/);
    assert.match(fn, /convertLeadHolds\(/);
    assert.match(fn, /exitEnrollmentsForBooking\(/);
    assert.match(fn, /autoCreateEvent\(/);
    assert.match(fn, /updateLeadSalesStage\(lead\.id, "booked"/);
    assert.doesNotMatch(fn, /status:\s*"confirmed"/);
    assert.doesNotMatch(fn, /applyPlaybookToEvent/);

    const coreStart = src.indexOf("async function createClientCore");
    const coreEnd = src.indexOf("export async function createClient_", coreStart);
    assert.doesNotMatch(src.slice(coreStart, coreEnd), /inviteClient\(/);
  });

  it("successful Client Planning release calls inviteClient only after release succeeds", () => {
    const src = readFileSync(resolve("lib/playbooks/service.ts"), "utf8");
    const fnStart = src.indexOf("export async function releasePlaybookApplication");
    const fnEnd = src.indexOf("export async function updateEventTaskDaysOffset", fnStart);
    const fn = src.slice(fnStart, fnEnd);
    const failReturn = fn.indexOf("if (!released.ok)");
    const inviteCall = fn.indexOf("inviteClient(");
    assert.ok(failReturn >= 0);
    assert.ok(inviteCall > failReturn);
    assert.match(fn, /if \(!released\.ok\)/);
    assert.match(fn, /inviteClient\(/);
    assert.match(fn, /if \(!email\)/);
    assert.doesNotMatch(fn, /applyPlaybookToEvent/);
  });

  it("release failure returns before inviteClient", () => {
    const src = readFileSync(resolve("lib/playbooks/service.ts"), "utf8");
    const fnStart = src.indexOf("export async function releasePlaybookApplication");
    const fn = src.slice(fnStart, src.indexOf("export async function updateEventTaskDaysOffset", fnStart));
    const beforeInvite = fn.slice(0, fn.indexOf("inviteClient("));
    assert.match(beforeInvite, /already_released/);
    assert.match(beforeInvite, /return \{/);
  });

  it("inviteClient skips insert when an active invitation already exists", () => {
    const src = readFileSync(resolve("lib/client-auth/service.ts"), "utf8");
    const fnStart = src.indexOf("export async function inviteClient");
    const fnEnd = src.indexOf("export async function resendClientInvitation", fnStart);
    const fn = src.slice(fnStart, fnEnd);
    assert.match(fn, /shouldSendClientInvitation/);
    assert.match(fn, /getClientInvitation\(clientId\)/);
  });

  it("Client Planning stays Draft until release; Venue Planning is unchanged", () => {
    const apply = readFileSync(resolve("lib/playbooks/repository.ts"), "utf8");
    const fnStart = apply.indexOf("export async function applyPlaybookToEvent");
    const fn = apply.slice(fnStart, apply.indexOf("export type ReleasePlaybookResult", fnStart));
    assert.match(fn, /released_at: template\.kind === "venue" \? new Date\(\)\.toISOString\(\) : null/);
    assert.doesNotMatch(fn, /inviteClient/);

    const panel = readFileSync(resolve("components/clients/prepare-planning-panel.tsx"), "utf8");
    assert.doesNotMatch(panel, /releasePlaybookAction/);
    assert.match(panel, /applyPlaybookAction/);
  });

  it("Prepare Their Event invitation copy uses the live record and invite-at-release timing", () => {
    const withEmail = buildCommunicationsReview({
      clientId: "c1",
      invitation: null,
      clientHasEmail: true,
      automations: [],
    }).rows.find((i) => i.key === "invitation");
    assert.equal(withEmail?.detail, "Not sent — the client will be invited when you release their planning.");
    assert.equal(withEmail?.onFile, false);

    const noEmail = buildCommunicationsReview({
      clientId: "c1",
      invitation: null,
      clientHasEmail: false,
      automations: [],
    }).rows.find((i) => i.key === "invitation");
    assert.equal(noEmail?.detail, "Not sent — no client email on file");

    const sent = buildCommunicationsReview({
      clientId: "c1",
      invitation: { status: "pending" },
      clientHasEmail: true,
      automations: [],
    }).rows.find((i) => i.key === "invitation");
    assert.equal(sent?.detail, "Invitation sent");

    const page = readFileSync(resolve("app/(app)/clients/[id]/booked/page.tsx"), "utf8");
    assert.match(page, /getClientInvitation/);
    assert.match(page, /buildCommunicationsReview/);
    assert.doesNotMatch(page, /invited === ["']1["']/);
  });

  it("release UX states that invitation email is sent when an address is on file", () => {
    const list = readFileSync(resolve("components/playbooks/event-task-list.tsx"), "utf8");
    assert.match(list, /they'll receive their invitation email if an email address is on file/);
    assert.match(list, /result\.message/);
  });

  it("wedding wording and Event Experience resolver are unchanged", () => {
    const celebration = readFileSync(resolve("components/clients/booking-celebration.tsx"), "utf8");
    assert.match(celebration, /eventTypeLabel/);
    const preview = readFileSync(resolve("lib/playbooks/apply-preview.ts"), "utf8");
    assert.match(preview, /For your couple/);
    const resolveSrc = readFileSync(resolve("lib/event-experience/resolve.ts"), "utf8");
    assert.match(resolveSrc, /resolveExperienceProfile/);
  });
});
