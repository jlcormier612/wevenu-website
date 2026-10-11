import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { GAP_COPY } from "@/lib/dashboard/gap-copy";
import { selectLuvDashboardEntry } from "@/lib/dashboard-system/luv-entry";
import { computeSetupGapObservations } from "@/lib/luv/setup-observations";
import type { ActivationChecklistItem } from "@/lib/activation/types";
import { applyFirstPortalInviteToChecklist, FIRST_PORTAL_INVITE_KEY } from "@/lib/activation/first-portal-invite";
import {
  FIRST_PORTAL_OPEN_KEY,
  applyFirstPortalOpenToChecklist,
  applyThreeCouplesPortalPrerequisite,
  isFirstPortalOpenComplete,
} from "@/lib/activation/first-portal-open";
import {
  THREE_COUPLES_PORTAL_KEY,
  applyPortalOpenMilestoneToChecklist,
} from "@/lib/activation/portal-open-milestone";

function item(
  key: string,
  completed: boolean,
  points = 15,
): ActivationChecklistItem {
  return { key, label: key, points, href: "/clients", completed };
}

/** Same overlay order as enrichActivationScore. */
function enrich(
  checklist: ActivationChecklistItem[],
  args: {
    inviteSent: boolean;
    firstOpenComplete: boolean;
    threeCouplesComplete: boolean;
  },
): ActivationChecklistItem[] {
  let next = applyFirstPortalInviteToChecklist(checklist, args.inviteSent);
  next = applyFirstPortalOpenToChecklist(next, {
    inviteSent: args.inviteSent,
    firstOpenComplete: args.firstOpenComplete,
  });
  next = applyPortalOpenMilestoneToChecklist(next, args.threeCouplesComplete);
  next = applyThreeCouplesPortalPrerequisite(next, args.inviteSent);
  return next;
}

describe("first_portal_open eligibility (invite prerequisite)", () => {
  it("brand-new venue with no invite does not surface the client-activation card", () => {
    const checklist = enrich(
      [
        item(FIRST_PORTAL_INVITE_KEY, false, 5),
        item(FIRST_PORTAL_OPEN_KEY, false, 15),
        item(THREE_COUPLES_PORTAL_KEY, false, 10),
        item("first_package", false, 10),
      ],
      { inviteSent: false, firstOpenComplete: false, threeCouplesComplete: false },
    );
    const obs = computeSetupGapObservations(checklist);
    assert.equal(obs.some((o) => o.id === `setup-gap-${FIRST_PORTAL_OPEN_KEY}`), false);
    assert.equal(obs.some((o) => o.id === `setup-gap-${THREE_COUPLES_PORTAL_KEY}`), false);
    assert.doesNotMatch(
      obs.map((o) => o.message).join(" | "),
      /hasn't opened their portal|You've sent the invite/i,
    );
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: obs,
      recommendations: [],
    });
    assert.notEqual(entry?.message, GAP_COPY.first_portal_open.title);
  });

  it("creating a lead alone does not imply invite or portal-open gaps", () => {
    // Overlay ignores leads entirely — inviteSent stays false.
    const checklist = enrich(
      [item(FIRST_PORTAL_OPEN_KEY, false, 15), item(FIRST_PORTAL_INVITE_KEY, false, 5)],
      { inviteSent: false, firstOpenComplete: false, threeCouplesComplete: false },
    );
    assert.equal(
      checklist.find((c) => c.key === FIRST_PORTAL_OPEN_KEY)?.completed,
      true,
    );
  });

  it("creating a client alone (no invitation) does not claim invite was sent", () => {
    const checklist = enrich(
      [item(FIRST_PORTAL_OPEN_KEY, false, 15)],
      { inviteSent: false, firstOpenComplete: false, threeCouplesComplete: false },
    );
    const obs = computeSetupGapObservations(checklist);
    assert.equal(obs.some((o) => o.id === `setup-gap-${FIRST_PORTAL_OPEN_KEY}`), false);
  });

  it("unsuccessful invitation (no pending/accepted) does not unlock the open card", () => {
    // inviteSent=false mirrors loader when only revoked/failed rows exist.
    const checklist = enrich(
      [item(FIRST_PORTAL_OPEN_KEY, false, 15)],
      { inviteSent: false, firstOpenComplete: false, threeCouplesComplete: false },
    );
    assert.equal(
      checklist.find((c) => c.key === FIRST_PORTAL_OPEN_KEY)?.completed,
      true,
    );
  });

  it("confirmed successful invitation permits the waiting-for-open card", () => {
    const checklist = enrich(
      [
        item(FIRST_PORTAL_INVITE_KEY, false, 5),
        item(FIRST_PORTAL_OPEN_KEY, false, 15),
        item("first_vendor_assigned", false, 5),
      ],
      { inviteSent: true, firstOpenComplete: false, threeCouplesComplete: false },
    );
    const obs = computeSetupGapObservations(checklist);
    assert.equal(obs[0].id, `setup-gap-${FIRST_PORTAL_OPEN_KEY}`);
    assert.equal(obs[0].message, GAP_COPY.first_portal_open.title);
    assert.match(obs[0].detail ?? "", /You've sent the invite/);
    assert.equal(obs.some((o) => o.id === `setup-gap-${FIRST_PORTAL_INVITE_KEY}`), false);
  });

  it("portal-open completion suppresses the waiting card", () => {
    const checklist = enrich(
      [item(FIRST_PORTAL_OPEN_KEY, false, 15)],
      { inviteSent: true, firstOpenComplete: true, threeCouplesComplete: false },
    );
    const obs = computeSetupGapObservations(checklist);
    assert.equal(obs.some((o) => o.id === `setup-gap-${FIRST_PORTAL_OPEN_KEY}`), false);
  });

  it("isFirstPortalOpenComplete requires booked client session last_accessed_at", () => {
    assert.equal(
      isFirstPortalOpenComplete({
        bookedClientIds: ["a", "b"],
        lastAccessedByClientId: new Map([["a", null], ["c", "2026-10-01T00:00:00Z"]]),
      }),
      false,
    );
    assert.equal(
      isFirstPortalOpenComplete({
        bookedClientIds: ["a"],
        lastAccessedByClientId: new Map([["a", "2026-10-01T00:00:00Z"]]),
      }),
      true,
    );
  });

  it("activation service wires the first-open overlay after invite evidence", () => {
    const src = readFileSync(resolve("lib/activation/service.ts"), "utf8");
    assert.match(src, /applyFirstPortalOpenToChecklist/);
    assert.match(src, /getVenueFirstPortalOpenMilestone/);
    assert.match(src, /applyThreeCouplesPortalPrerequisite/);
    assert.match(src, /inviteSent:\s*inviteMilestone\.complete/);
  });

  it("loader uses sessions, not invitation stamps alone", () => {
    const src = readFileSync(resolve("lib/activation/first-portal-open-service.ts"), "utf8");
    assert.match(src, /client_portal_sessions/);
    assert.match(src, /last_accessed_at/);
    assert.match(src, /loadBookedMembershipSets/);
  });
});

describe("related lifecycle gap factuality (activation overlays)", () => {
  it("first_portal_invite remains the invite-sent gate (existing overlay)", () => {
    const withInvite = applyFirstPortalInviteToChecklist(
      [item(FIRST_PORTAL_INVITE_KEY, false, 5)],
      true,
    );
    assert.equal(withInvite[0].completed, true);
    const without = applyFirstPortalInviteToChecklist(
      [item(FIRST_PORTAL_INVITE_KEY, false, 5)],
      false,
    );
    assert.equal(without[0].completed, false);
  });

  it("three_couples_active stays incomplete after invite until 3 opens, but is hidden before invite", () => {
    const beforeInvite = applyThreeCouplesPortalPrerequisite(
      applyPortalOpenMilestoneToChecklist(
        [item(THREE_COUPLES_PORTAL_KEY, false, 10)],
        false,
      ),
      false,
    );
    assert.equal(beforeInvite[0].completed, true);

    const afterInvite = applyThreeCouplesPortalPrerequisite(
      applyPortalOpenMilestoneToChecklist(
        [item(THREE_COUPLES_PORTAL_KEY, false, 10)],
        false,
      ),
      true,
    );
    assert.equal(afterInvite[0].completed, false);
  });

  it("GAP_COPY first_portal_open still asserts invite sent (eligibility must gate it)", () => {
    assert.match(GAP_COPY.first_portal_open.description, /You've sent the invite/);
  });
});
