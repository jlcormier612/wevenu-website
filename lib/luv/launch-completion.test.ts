import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { selectLuvDashboardEntry } from "@/lib/dashboard-system/luv-entry";

const observations = readFileSync(resolve("lib/luv/observations.ts"), "utf8");
const communication = readFileSync(resolve("lib/luv/communication-observations.ts"), "utf8");
const draftRoute = readFileSync(resolve("app/api/luv/draft/route.ts"), "utf8");
const settingsSave = readFileSync(resolve("lib/luv/settings.ts"), "utf8");
const dashboardPage = readFileSync(resolve("app/(app)/dashboard/page.tsx"), "utf8");
const dashboardService = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");
const leadPage = readFileSync(resolve("app/(app)/leads/[id]/page.tsx"), "utf8");

describe("Luv action destinations stay trustworthy", () => {
  it("draft follow-up links use the canonical ?luv=follow_up_email param", () => {
    assert.match(observations, /\?luv=follow_up_email/);
    assert.match(communication, /\?luv=follow_up_email/);
    assert.doesNotMatch(communication, /\?luv=followup(?:["'`]|$)/);
  });

  it("observation draft/navigate links point at real app routes", () => {
    const linkRe = /link:\s*`([^`]+)`|link:\s*"([^"]+)"/g;
    const links: string[] = [];
    for (const src of [observations, communication]) {
      let m: RegExpExecArray | null;
      while ((m = linkRe.exec(src))) {
        links.push(m[1] ?? m[2]);
      }
    }
    assert.ok(links.length > 10, "expected observation links to audit");
    for (const link of links) {
      const path = link.split("?")[0].split("#")[0];
      assert.match(
        path,
        /^\/(leads|events|clients|contracts|tasks|tours|messaging\/health|payments|setup-hub|reporting|documents|vendors)(\/|$)/,
        `unexpected Luv link: ${link}`,
      );
    }
  });
});

describe("Luv settings honesty for launch", () => {
  it("never persists suggest_only autonomy from the save path", () => {
    assert.match(settingsSave, /autonomy_level:\s*"draft_for_review"/);
    assert.doesNotMatch(
      settingsSave.slice(settingsSave.indexOf("export async function saveLuvSettings")),
      /autonomy_level:\s*settings\.autonomyLevel/,
    );
  });

  it("distinguishes drafting-disabled from missing API key", () => {
    assert.match(draftRoute, /Luv drafting is turned off in Settings/);
    assert.match(draftRoute, /status:\s*403/);
    assert.match(draftRoute, /AI drafting is temporarily unavailable/);
    assert.match(draftRoute, /status:\s*503/);
  });

  it("Dashboard Luv respects observationsEnabled end-to-end", () => {
    assert.match(dashboardService, /luvObservationsEnabled:\s*observationsOn/);
    assert.match(dashboardPage, /data\.luvObservationsEnabled/);
    assert.match(dashboardPage, /DashboardLuvEntryCard/);
  });

  it("normalizes legacy ?luv=followup into follow_up_email", () => {
    assert.match(leadPage, /normalizeAutoLuvDraft/);
    assert.match(leadPage, /raw === "followup"/);
  });
});

describe("selectLuvDashboardEntry dismissal metadata", () => {
  it("carries recommendation id when a recommendation leads", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [],
      recommendations: [{
        id: "rec-dismiss-me",
        insightId: null,
        type: "followup",
        title: "Check quiet leads",
        body: "A few inquiries went quiet.",
        priority: 1,
        ctas: [{ type: "navigate", target: "/leads", label: "Open leads" }],
        metadata: {},
        dismissedAt: null,
        completedAt: null,
        expiresAt: null,
        createdAt: "2026-09-12T00:00:00.000Z",
      }],
    });
    assert.equal(entry?.dismissRecommendationId, "rec-dismiss-me");
  });
});
