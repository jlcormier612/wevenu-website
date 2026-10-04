import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  PORTAL_ACTIVATION_CLIENTS_HREF,
  THREE_COUPLES_PORTAL_KEY,
  THREE_COUPLES_PORTAL_TARGET,
  applyPortalOpenMilestoneToChecklist,
  clientHasOpenedPortal,
  countUniqueBookedPortalOpens,
  isThreeCouplesPortalMilestoneComplete,
  portalActivationState,
} from "@/lib/activation/portal-open-milestone";
import { GAP_COPY } from "@/lib/dashboard/gap-copy";
import { computeSetupGapObservations } from "@/lib/luv/setup-observations";
import { selectLuvDashboardEntry } from "@/lib/dashboard-system/luv-entry";
import {
  clientMatchesListFilter,
  isPortalActivationFilter,
  parseClientListFilter,
  type ClientListFilterContext,
} from "@/lib/clients/list-filters";

function lastMap(entries: [string, string | null][]): Map<string, string | null> {
  return new Map(entries);
}

describe("portal-open milestone count rules", () => {
  const booked = ["a", "b", "c", "d"];

  it("0 opens → incomplete", () => {
    const n = countUniqueBookedPortalOpens({
      bookedClientIds: booked,
      lastAccessedByClientId: lastMap([]),
    });
    assert.equal(n, 0);
    assert.equal(isThreeCouplesPortalMilestoneComplete(n), false);
  });

  it("1 or 2 unique opens → incomplete", () => {
    assert.equal(
      isThreeCouplesPortalMilestoneComplete(
        countUniqueBookedPortalOpens({
          bookedClientIds: booked,
          lastAccessedByClientId: lastMap([["a", "2026-01-01T00:00:00Z"]]),
        }),
      ),
      false,
    );
    assert.equal(
      isThreeCouplesPortalMilestoneComplete(
        countUniqueBookedPortalOpens({
          bookedClientIds: booked,
          lastAccessedByClientId: lastMap([
            ["a", "2026-01-01T00:00:00Z"],
            ["b", "2026-01-02T00:00:00Z"],
          ]),
        }),
      ),
      false,
    );
  });

  it("3 unique booked opens → complete; more stays complete", () => {
    const three = countUniqueBookedPortalOpens({
      bookedClientIds: booked,
      lastAccessedByClientId: lastMap([
        ["a", "2026-01-01T00:00:00Z"],
        ["b", "2026-01-02T00:00:00Z"],
        ["c", "2026-01-03T00:00:00Z"],
      ]),
    });
    assert.equal(three, 3);
    assert.equal(isThreeCouplesPortalMilestoneComplete(three), true);
    const four = countUniqueBookedPortalOpens({
      bookedClientIds: booked,
      lastAccessedByClientId: lastMap([
        ["a", "2026-01-01T00:00:00Z"],
        ["b", "2026-01-02T00:00:00Z"],
        ["c", "2026-01-03T00:00:00Z"],
        ["d", "2026-01-04T00:00:00Z"],
      ]),
    });
    assert.equal(four, 4);
    assert.equal(isThreeCouplesPortalMilestoneComplete(four), true);
  });

  it("repeated opens by the same couple count once", () => {
    // Map stores one last_accessed per client — duplicate keys collapse.
    const n = countUniqueBookedPortalOpens({
      bookedClientIds: booked,
      lastAccessedByClientId: lastMap([
        ["a", "2026-01-01T00:00:00Z"],
        ["a", "2026-01-05T00:00:00Z"],
      ]),
    });
    assert.equal(n, 1);
  });

  it("invitation without open does not count; null last_accessed does not count", () => {
    assert.equal(clientHasOpenedPortal(null), false);
    assert.equal(clientHasOpenedPortal(undefined), false);
    assert.equal(clientHasOpenedPortal("2026-01-01T00:00:00Z"), true);
    assert.equal(
      portalActivationState({ lastAccessedAt: null, invitationStatus: "pending" }),
      "invited_not_opened",
    );
    assert.equal(
      portalActivationState({ lastAccessedAt: null, invitationStatus: "accepted" }),
      "invited_not_opened",
    );
    assert.equal(
      countUniqueBookedPortalOpens({
        bookedClientIds: booked,
        lastAccessedByClientId: lastMap([["a", null]]),
      }),
      0,
    );
  });

  it("non-booked fixture portal open does not count", () => {
    const n = countUniqueBookedPortalOpens({
      bookedClientIds: ["booked-1", "booked-2"],
      lastAccessedByClientId: lastMap([
        ["fixture-x", "2026-01-01T00:00:00Z"],
        ["booked-1", "2026-01-02T00:00:00Z"],
      ]),
    });
    assert.equal(n, 1);
  });
});

describe("checklist overlay + Luv CTA", () => {
  it("marks three_couples_active complete and points at portal_activation handoff", () => {
    const checklist = applyPortalOpenMilestoneToChecklist(
      [{
        key: THREE_COUPLES_PORTAL_KEY,
        label: "Have 3+ couples active",
        points: 10,
        href: "/clients",
        completed: false,
      }],
      true,
    );
    assert.equal(checklist[0].completed, true);
    assert.equal(checklist[0].href, PORTAL_ACTIVATION_CLIENTS_HREF);
  });

  it("gap present when incomplete; copy and single CTA when incomplete", () => {
    const incomplete = applyPortalOpenMilestoneToChecklist(
      [{
        key: THREE_COUPLES_PORTAL_KEY,
        label: "x",
        points: 10,
        href: "/clients",
        completed: false,
      }],
      false,
    );
    const obs = computeSetupGapObservations(incomplete);
    assert.equal(obs.length, 1);
    assert.equal(obs[0].id, `setup-gap-${THREE_COUPLES_PORTAL_KEY}`);
    assert.equal(obs[0].message, GAP_COPY.three_couples_active.title);
    assert.equal(obs[0].detail, GAP_COPY.three_couples_active.description);
    assert.equal(obs[0].actionLabel, GAP_COPY.three_couples_active.ctaLabel);
    assert.equal(obs[0].link, PORTAL_ACTIVATION_CLIENTS_HREF);
    assert.equal(obs[0].recommendation, undefined);
    assert.match(GAP_COPY.three_couples_active.title, /Get 3 couples started/);
    assert.doesNotMatch(GAP_COPY.three_couples_active.title, /Get three couples active/i);
  });

  it("gap absent from setup observations when complete", () => {
    const complete = applyPortalOpenMilestoneToChecklist(
      [{
        key: THREE_COUPLES_PORTAL_KEY,
        label: "x",
        points: 10,
        href: PORTAL_ACTIVATION_CLIENTS_HREF,
        completed: false,
      }],
      true,
    );
    assert.equal(computeSetupGapObservations(complete).length, 0);
  });

  it("Dashboard L1 uses detail as suggestion, not CTA label", () => {
    const incomplete = applyPortalOpenMilestoneToChecklist(
      [{
        key: THREE_COUPLES_PORTAL_KEY,
        label: "x",
        points: 10,
        href: PORTAL_ACTIVATION_CLIENTS_HREF,
        completed: false,
      }],
      false,
    );
    const obs = computeSetupGapObservations(incomplete)[0];
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [obs],
      recommendations: [],
    });
    assert.ok(entry);
    assert.equal(entry!.message, GAP_COPY.three_couples_active.title);
    assert.equal(entry!.suggestion, GAP_COPY.three_couples_active.description);
    assert.notEqual(entry!.suggestion, entry!.actionLabel);
    assert.equal(entry!.actionLabel, GAP_COPY.three_couples_active.ctaLabel);
    assert.equal(entry!.actionHref, PORTAL_ACTIVATION_CLIENTS_HREF);
  });

  it("target constant is 3", () => {
    assert.equal(THREE_COUPLES_PORTAL_TARGET, 3);
  });
});

describe("Clients portal_activation filter", () => {
  const ctx: ClientListFilterContext = {
    today: "2026-10-03",
    comingUpOut: "2026-11-02",
    attentionClientIds: new Set(),
    bookedClientIds: new Set(["booked-1", "booked-2"]),
  };

  it("parses deep-link and matches booked clients only", () => {
    assert.equal(parseClientListFilter("portal_activation"), "portal_activation");
    assert.equal(isPortalActivationFilter("portal_activation"), true);
    assert.equal(
      clientMatchesListFilter(
        { id: "booked-1", status: "confirmed", eventDate: "2027-01-01" },
        "portal_activation",
        ctx,
      ),
      true,
    );
    assert.equal(
      clientMatchesListFilter(
        { id: "not-booked", status: "confirmed", eventDate: "2027-01-01" },
        "portal_activation",
        ctx,
      ),
      false,
    );
    assert.equal(
      clientMatchesListFilter(
        { id: "booked-1", status: "cancelled", eventDate: "2027-01-01" },
        "portal_activation",
        ctx,
      ),
      false,
    );
  });

  it("existing operational filters remain in the pill list without portal_activation", () => {
    const filters = readFileSync(resolve("lib/clients/list-filters.ts"), "utf8");
    assert.match(filters, /CLIENT_LIST_FILTERS/);
    assert.match(filters, /portal_activation/);
    assert.match(
      readFileSync(resolve("components/clients/client-list.tsx"), "utf8"),
      /CLIENT_LIST_FILTERS\.map/,
    );
    assert.match(
      readFileSync(resolve("components/clients/client-list.tsx"), "utf8"),
      /portal-activation-banner/,
    );
    assert.doesNotMatch(
      readFileSync(resolve("components/clients/client-list.tsx"), "utf8"),
      /CLIENT_LIST_FILTERS.*portal_activation/,
    );
  });
});

describe("inviteClient is not the first_portal_invite source of truth", () => {
  it("inviteClient still does not record couple.portal_invite_sent", () => {
    const invite = readFileSync(resolve("lib/client-auth/service.ts"), "utf8");
    const start = invite.indexOf("export async function inviteClient");
    const fn = invite.slice(start, start + 1200);
    assert.doesNotMatch(fn, /couple\.portal_invite_sent/);
    assert.doesNotMatch(fn, /recordEngagementEvent/);
  });
});
