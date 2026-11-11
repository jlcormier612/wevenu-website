import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { GAP_COPY } from "@/lib/dashboard/gap-copy";
import { computeSetupGapObservations } from "@/lib/luv/setup-observations";
import type { ActivationChecklistItem } from "@/lib/activation/types";
import {
  FIRST_TEAM_INVITE_KEY,
  FIRST_TEAM_LOGIN_KEY,
  applyFirstTeamLoginPrerequisite,
} from "@/lib/activation/first-team-login";

function item(
  key: string,
  completed: boolean,
  points = 7,
): ActivationChecklistItem {
  return { key, label: key, points, href: "/settings/team", completed };
}

describe("first_team_login eligibility (invite prerequisite)", () => {
  it("suppresses login gap when no team invite has been sent", () => {
    const checklist = applyFirstTeamLoginPrerequisite([
      item(FIRST_TEAM_INVITE_KEY, false, 3),
      item(FIRST_TEAM_LOGIN_KEY, false, 7),
    ]);
    assert.equal(checklist.find((c) => c.key === FIRST_TEAM_LOGIN_KEY)?.completed, true);
    const obs = computeSetupGapObservations(checklist);
    assert.equal(obs.some((o) => o.id === `setup-gap-${FIRST_TEAM_LOGIN_KEY}`), false);
    assert.doesNotMatch(
      obs.map((o) => o.suggestion ?? "").join(" "),
      /An invited team member who hasn't logged in/i,
    );
  });

  it("keeps login gap incomplete after invite until login completes", () => {
    const checklist = applyFirstTeamLoginPrerequisite([
      item(FIRST_TEAM_INVITE_KEY, true, 3),
      item(FIRST_TEAM_LOGIN_KEY, false, 7),
    ]);
    assert.equal(checklist.find((c) => c.key === FIRST_TEAM_LOGIN_KEY)?.completed, false);
    const obs = computeSetupGapObservations(checklist);
    assert.equal(obs[0]?.message, GAP_COPY.first_team_login.title);
  });

  it("activation service wires the team-login prerequisite", () => {
    const src = readFileSync(resolve("lib/activation/service.ts"), "utf8");
    assert.match(src, /applyFirstTeamLoginPrerequisite/);
  });

  it("GAP_COPY first_team_login asserts an invite (eligibility must gate it)", () => {
    assert.match(GAP_COPY.first_team_login.description, /An invited team member/);
  });
});
