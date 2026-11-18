import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";
import { buildLuvAskPlanningFacts } from "@/lib/luv/portal-context/planning";
import { buildLuvAskPortalContext } from "@/lib/luv/portal-context/build";
import { formatPortalContextForPrompt } from "@/lib/luv/portal-context/format";

describe("Luv Ask planning pack", () => {
  const now = new Date("2026-11-18T15:00:00Z");

  it("classifies overdue vs open vs completed and suggests next work", () => {
    const plan = buildLuvAskPlanningFacts({
      now,
      tasks: [
        { title: "Finish seating", status: "pending", dueDate: "2026-11-10", isRequired: true },
        { title: "Upload song list", status: "pending", dueDate: "2026-11-25", isRequired: false },
        { title: "Confirm guest count", status: "complete", dueDate: "2026-10-01", isRequired: true },
      ],
    });
    assert.equal(plan.openTaskCount, 2);
    assert.equal(plan.overdueTaskCount, 1);
    assert.equal(plan.completedTaskCount, 1);
    assert.equal(plan.nextSuggestedTask?.title, "Finish seating");
    assert.equal(plan.openTasks[0]?.status, "overdue");
  });

  it("does not invent questionnaire completion", () => {
    const plan = buildLuvAskPlanningFacts({
      questionnaires: [
        { title: "Final Details", kind: "final_details", status: "sent" },
        { title: "Client Planning", kind: "client_planning", status: "submitted" },
      ],
    });
    assert.equal(plan.openQuestionnaireCount, 1);
    assert.equal(plan.completedQuestionnaireCount, 1);
    assert.equal(plan.questionnaires.find((q) => q.kind === "final_details")?.status, "open");
  });

  it("excludes venue-only timeline audiences", () => {
    const plan = buildLuvAskPlanningFacts({
      timelineAvailable: true,
      timelineEntries: [
        { title: "Staff load-in", owner: "venue", audiences: ["venue_staff"], entryTime: "08:00", dayOffset: 0 },
        { title: "Ceremony", owner: "venue", audiences: ["client"], entryTime: "16:00", dayOffset: 0 },
        { title: "Our first look", owner: "client", audiences: [], entryTime: "15:00", dayOffset: 0 },
      ],
    });
    assert.equal(plan.timelineEntries.length, 2);
    assert.ok(plan.timelineEntries.every((e) => e.title !== "Staff load-in"));
  });

  it("formats planning into portal prompt without inventing missing timeline", () => {
    const ctx = buildLuvAskPortalContext({
      includePlanning: true,
      tasks: [{ title: "Pay deposit reminder task", status: "pending", dueDate: "2026-11-20" }],
      questionnaires: [],
      timelineAvailable: true,
      timelineEntries: [],
      now,
    });
    const text = formatPortalContextForPrompt(ctx);
    assert.match(text, /Suggested next/);
    assert.match(text, /No couple-visible timeline entries/);
    assert.doesNotMatch(text, /Day 0:.*florist/i);
  });

  it("leaves planning null when includePlanning is false (Phase 2A callers)", () => {
    const ctx = buildLuvAskPortalContext({
      includePlanning: false,
      documents: [{ name: "Agreement", docType: "contract", status: "signed" }],
    });
    assert.equal(ctx.planning, null);
  });

  it("load path uses Ask-only loaders; dashboard GET does not import Ask context", () => {
    const load = readFileSync(resolve("lib/luv/portal-context/load.ts"), "utf8");
    assert.match(load, /resolvePortalTasks/);
    assert.match(load, /resolvePortalTimeline/);
    assert.match(load, /get_questionnaire_for_portal/);
    assert.match(load, /Called only from Ask Luv POST/);

    const askRoute = readFileSync(resolve("app/api/portal/luv-ask/route.ts"), "utf8");
    assert.match(askRoute, /loadLuvAskPortalContext/);

    const portalHome = readFileSync(resolve("app/(portal)/p/[token]/page.tsx"), "utf8");
    assert.doesNotMatch(portalHome, /loadLuvAskPortalContext/);

    const dashboard = readFileSync(resolve("app/(app)/dashboard/page.tsx"), "utf8");
    assert.doesNotMatch(dashboard, /loadLuvAskPortalContext/);
    assert.doesNotMatch(dashboard, /getLuvObservations/);

    const dashboardService = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");
    assert.doesNotMatch(dashboardService, /loadLuvAskPortalContext/);
    assert.doesNotMatch(dashboardService, /getLuvObservations/);
  });
});
