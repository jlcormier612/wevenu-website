import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  FIRST_PORTAL_INVITE_KEY,
  applyFirstPortalInviteToChecklist,
  invitationQualifiesAsSent,
  isFirstPortalInviteComplete,
} from "@/lib/activation/first-portal-invite";
import {
  THREE_COUPLES_PORTAL_KEY,
  applyPortalOpenMilestoneToChecklist,
  portalActivationState,
} from "@/lib/activation/portal-open-milestone";
import { GAP_COPY } from "@/lib/dashboard/gap-copy";
import { selectLuvDashboardEntry } from "@/lib/dashboard-system/luv-entry";
import { computeSetupGapObservations } from "@/lib/luv/setup-observations";
import type { ActivationChecklistItem } from "@/lib/activation/types";

const VENUE = "venue-a";
const OTHER = "venue-b";
const BOOKED = ["booked-1", "booked-2"];

function invite(
  clientId: string,
  status: string,
  venueId = VENUE,
) {
  return { clientId, venueId, status };
}

function checklistItem(
  key: string,
  completed: boolean,
  points = 5,
): ActivationChecklistItem {
  return {
    key,
    label: key,
    points,
    href: "/clients",
    completed,
  };
}

describe("first_portal_invite invitation rules", () => {
  it("no invitation → incomplete", () => {
    assert.equal(
      isFirstPortalInviteComplete({
        venueId: VENUE,
        bookedClientIds: BOOKED,
        invitations: [],
      }),
      false,
    );
  });

  it("pending invitation → complete", () => {
    assert.equal(invitationQualifiesAsSent("pending"), true);
    assert.equal(
      isFirstPortalInviteComplete({
        venueId: VENUE,
        bookedClientIds: BOOKED,
        invitations: [invite("booked-1", "pending")],
      }),
      true,
    );
  });

  it("accepted invitation → complete", () => {
    assert.equal(invitationQualifiesAsSent("accepted"), true);
    assert.equal(
      isFirstPortalInviteComplete({
        venueId: VENUE,
        bookedClientIds: BOOKED,
        invitations: [invite("booked-1", "accepted")],
      }),
      true,
    );
  });

  it("accepted invitation still complete when a session also exists", () => {
    assert.equal(
      isFirstPortalInviteComplete({
        venueId: VENUE,
        bookedClientIds: BOOKED,
        invitations: [invite("booked-1", "accepted")],
      }),
      true,
    );
  });

  it("opened session alone is not invitation evidence", () => {
    assert.equal(
      isFirstPortalInviteComplete({
        venueId: VENUE,
        bookedClientIds: BOOKED,
        invitations: [],
      }),
      false,
    );
  });

  it("revoked invitation does not complete", () => {
    assert.equal(invitationQualifiesAsSent("revoked"), false);
    assert.equal(
      isFirstPortalInviteComplete({
        venueId: VENUE,
        bookedClientIds: BOOKED,
        invitations: [invite("booked-1", "revoked")],
      }),
      false,
    );
  });

  it("invitation from another venue does not satisfy this venue", () => {
    assert.equal(
      isFirstPortalInviteComplete({
        venueId: VENUE,
        bookedClientIds: BOOKED,
        invitations: [invite("booked-1", "accepted", OTHER)],
      }),
      false,
    );
  });

  it("invitation for a non-booked / ineligible client does not satisfy", () => {
    assert.equal(
      isFirstPortalInviteComplete({
        venueId: VENUE,
        bookedClientIds: BOOKED,
        invitations: [invite("fixture-unbooked", "accepted")],
      }),
      false,
    );
  });
});

describe("first_portal_invite overlay ignores stale stamps", () => {
  it("stamp-null SQL incomplete + invitation evidence → overlay complete", () => {
    const sqlIncomplete = [
      checklistItem(FIRST_PORTAL_INVITE_KEY, false),
      checklistItem("first_vendor_assigned", false),
    ];
    const overlaid = applyFirstPortalInviteToChecklist(sqlIncomplete, true);
    assert.equal(overlaid[0].completed, true);
    assert.equal(overlaid[1].completed, false);
  });

  it("does not read first_portal_open_at or third_couple_portal_active_at", () => {
    const src = readFileSync(resolve("lib/activation/first-portal-invite.ts"), "utf8");
    assert.doesNotMatch(src, /first_portal_open_at/);
    assert.doesNotMatch(src, /third_couple_portal_active_at/);
    assert.doesNotMatch(src, /last_accessed_at/);
    assert.doesNotMatch(src, /client_portal_sessions/);
  });

  it("loader queries invitations, not sessions or open stamps", () => {
    const src = readFileSync(resolve("lib/activation/first-portal-invite-service.ts"), "utf8");
    assert.match(src, /client_invitations/);
    assert.match(src, /pending/);
    assert.match(src, /accepted/);
    assert.doesNotMatch(src, /client_portal_sessions/);
    assert.doesNotMatch(src, /first_portal_open_at/);
    assert.doesNotMatch(src, /third_couple_portal_active_at/);
  });
});

describe("Dashboard Luv first_portal_invite card", () => {
  it("does not render the first-invite card when invitation evidence exists", () => {
    const checklist = applyFirstPortalInviteToChecklist(
      [
        checklistItem(FIRST_PORTAL_INVITE_KEY, false, 5),
        checklistItem("first_vendor_assigned", false, 5),
      ],
      true,
    );
    const obs = computeSetupGapObservations(checklist);
    assert.equal(obs.some((o) => o.id === `setup-gap-${FIRST_PORTAL_INVITE_KEY}`), false);
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: obs,
      recommendations: [],
    });
    assert.notEqual(entry?.message, GAP_COPY.first_portal_invite.title);
  });

  it("still renders the first-invite card for a genuinely uninvited venue when it ranks", () => {
    const checklist = applyFirstPortalInviteToChecklist(
      [
        checklistItem(FIRST_PORTAL_INVITE_KEY, false, 15),
        checklistItem("first_vendor_assigned", false, 5),
      ],
      false,
    );
    const obs = computeSetupGapObservations(checklist);
    assert.equal(obs[0].id, `setup-gap-${FIRST_PORTAL_INVITE_KEY}`);
    assert.equal(obs[0].message, GAP_COPY.first_portal_invite.title);
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: obs,
      recommendations: [],
    });
    assert.equal(entry?.message, GAP_COPY.first_portal_invite.title);
    assert.equal(entry?.suggestion, GAP_COPY.first_portal_invite.description);
    assert.equal(entry?.actionLabel, GAP_COPY.first_portal_invite.ctaLabel);
  });
});

describe("three_couples_active and portal activation states stay independent", () => {
  it("first-invite overlay does not change three_couples_active", () => {
    const checklist = applyFirstPortalInviteToChecklist(
      [
        checklistItem(FIRST_PORTAL_INVITE_KEY, false),
        checklistItem(THREE_COUPLES_PORTAL_KEY, false, 10),
      ],
      true,
    );
    assert.equal(checklist[0].completed, true);
    assert.equal(checklist[1].completed, false);
    const afterOpen = applyPortalOpenMilestoneToChecklist(checklist, false);
    assert.equal(afterOpen[1].completed, false);
  });

  it("portal activation states remain not_invited / invited_not_opened / opened", () => {
    assert.equal(
      portalActivationState({ lastAccessedAt: null, invitationStatus: null }),
      "not_invited",
    );
    assert.equal(
      portalActivationState({ lastAccessedAt: null, invitationStatus: "pending" }),
      "invited_not_opened",
    );
    assert.equal(
      portalActivationState({ lastAccessedAt: null, invitationStatus: "accepted" }),
      "invited_not_opened",
    );
    assert.equal(
      portalActivationState({ lastAccessedAt: "2026-10-03T17:40:57Z", invitationStatus: "accepted" }),
      "opened",
    );
  });
});

describe("inviteClient is not the source of truth", () => {
  it("inviteClient still does not record couple.portal_invite_sent", () => {
    const inviteSrc = readFileSync(resolve("lib/client-auth/service.ts"), "utf8");
    const start = inviteSrc.indexOf("export async function inviteClient");
    const fn = inviteSrc.slice(start, start + 1200);
    assert.doesNotMatch(fn, /couple\.portal_invite_sent/);
    assert.doesNotMatch(fn, /recordEngagementEvent/);
  });

  it("activation score overlay applies first_portal_invite from the loader", () => {
    const src = readFileSync(resolve("lib/activation/service.ts"), "utf8");
    assert.match(src, /getVenueFirstPortalInviteMilestone/);
    assert.match(src, /applyFirstPortalInviteToChecklist/);
    assert.match(src, /applyPortalOpenMilestoneToChecklist/);
  });
});
