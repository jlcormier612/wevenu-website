import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { buildEventExperienceReview } from "@/lib/clients/event-experience-review";
import {
  homeLaunchHeading,
  homeLaunchPrompt,
  resolveExperienceProfile,
} from "@/lib/event-experience";

function review(eventType: string | null, clientEventType?: string | null) {
  return buildEventExperienceReview({
    clientId: "c1",
    eventId: "e1",
    eventType,
    clientEventType,
  });
}

describe("buildEventExperienceReview", () => {
  it("shows the Wedding family for wedding, elopement, engagement party, reception, and rehearsal dinner", () => {
    for (const value of ["wedding", "elopement", "engagement_party", "reception", "rehearsal_dinner"]) {
      const profile = resolveExperienceProfile(value);
      const model = review(value);
      assert.equal(profile.isWeddingSpecific, true, value);
      assert.equal(model.experienceName, "Wedding", value);
      assert.equal(model.customerTitle, "Your Wedding", value);
      assert.equal(model.summary, "Your client's experience is set up for a wedding.", value);
      assert.match(model.rows.find((r) => r.key === "client_will_see")?.detail ?? "", /Your Wedding/);
      assert.match(
        model.rows.find((r) => r.key === "client_will_see")?.detail ?? "",
        /What would you like to work on for your wedding\?/,
      );
      assert.doesNotMatch(JSON.stringify(model), /general_event/);
      assert.doesNotMatch(JSON.stringify(model), /resolver/i);
    }
  });

  it("shows Celebration of Life from the existing presentation result", () => {
    const profile = resolveExperienceProfile("celebration_of_life");
    const model = review("celebration_of_life");
    assert.equal(model.experienceName, "Celebration of Life");
    assert.equal(model.customerTitle, homeLaunchHeading(profile));
    assert.equal(model.summary, "This event will use the Celebration of Life experience.");
    assert.match(model.rows.find((r) => r.key === "client_will_see")?.detail ?? "", /Your Celebration of Life/);
  });

  it("shows Anniversary from the existing presentation result", () => {
    const profile = resolveExperienceProfile("anniversary");
    const model = review("anniversary");
    assert.equal(model.experienceName, "Anniversary");
    assert.equal(model.customerTitle, homeLaunchHeading(profile));
    assert.equal(model.summary, "This event will use the Anniversary experience.");
    assert.match(model.rows.find((r) => r.key === "client_will_see")?.detail ?? "", /Your Anniversary Celebration/);
  });

  it("shows Corporate from the existing presentation result", () => {
    const profile = resolveExperienceProfile("corporate");
    const model = review("corporate");
    assert.equal(model.experienceName, "Corporate");
    assert.equal(model.customerTitle, homeLaunchHeading(profile));
    assert.equal(model.customerTitle, "Your Event");
    assert.equal(model.summary, "This event will use the Corporate experience.");
    assert.equal(homeLaunchPrompt(profile), "What would you like to work on for your event?");
  });

  it("shows General Event for catch-all types without exposing it as the client title", () => {
    for (const value of ["birthday", "social_event", "birthday_milestone", "quinceanera", "other"]) {
      const model = review(value);
      assert.equal(model.experienceName, "General Event", value);
      assert.equal(model.customerTitle, "Your Event", value);
      assert.equal(model.summary, "This event will use the General Event experience.", value);
      assert.doesNotMatch(model.customerTitle, /General Event/);
      assert.doesNotMatch(model.rows.find((r) => r.key === "client_will_see")?.detail ?? "", /General Event/);
    }
  });

  it("uses the Event type over the Client type, matching the existing resolver", () => {
    const model = review("celebration_of_life", "wedding");
    assert.equal(model.experienceName, "Celebration of Life");
    assert.doesNotMatch(model.summary, /wedding/i);
  });

  it("does not claim a hosted website is ready", () => {
    const model = review("wedding");
    const blob = JSON.stringify(model);
    assert.doesNotMatch(blob, /wedding website ready/i);
    assert.doesNotMatch(blob, /website is ready/i);
    assert.match(model.reviewNote, /hosted website is not created here/i);
  });
});

describe("Phase 6 Event Experience review seams", () => {
  it("Prepare consumes the existing resolver and does not duplicate a mapping table", () => {
    const helper = readFileSync(resolve("lib/clients/event-experience-review.ts"), "utf8");
    assert.match(helper, /resolveExperienceProfileForClientEvent/);
    assert.match(helper, /homeLaunchHeading/);
    assert.match(helper, /homeLaunchPrompt/);
    assert.doesNotMatch(helper, /EVENT_TYPE_VALUE_TO_PROFILE/);
    assert.doesNotMatch(helper, /elopement:\s*"wedding"/);
    assert.doesNotMatch(helper, /social_event:\s*"general_event"/);
    const page = readFileSync(resolve("app/(app)/clients/[id]/booked/page.tsx"), "utf8");
    assert.match(page, /buildEventExperienceReview/);
    assert.doesNotMatch(page, /resolveExperienceProfileId/);
  });

  it("opening Prepare does not mutate Event Experience or send communications", () => {
    const page = readFileSync(resolve("app/(app)/clients/[id]/booked/page.tsx"), "utf8");
    assert.doesNotMatch(page, /updateEvent\(/);
    assert.doesNotMatch(page, /updateClientInfo\(/);
    assert.doesNotMatch(page, /inviteClient\(/);
    assert.doesNotMatch(page, /releasePlaybookApplication/);
    assert.doesNotMatch(page, /triggerSequencesForRelationship/);
    assert.doesNotMatch(page, /enrollRelationshipManually/);
    const helper = readFileSync(resolve("lib/clients/event-experience-review.ts"), "utf8");
    assert.doesNotMatch(helper, /updateEvent/);
    assert.doesNotMatch(helper, /inviteClient/);
    assert.doesNotMatch(helper, /sendEmail/);
    assert.doesNotMatch(helper, /insertEnrollment/);
    const panel = readFileSync(resolve("components/clients/event-experience-review-panel.tsx"), "utf8");
    assert.doesNotMatch(panel, /fetch\(/);
    assert.doesNotMatch(panel, /Action/);
  });

  it("does not release planning, send an invitation, or change Event status", () => {
    const release = readFileSync(resolve("lib/playbooks/service.ts"), "utf8");
    const fn = release.slice(
      release.indexOf("export async function releasePlaybookApplication"),
      release.indexOf("export async function updateEventTaskDaysOffset"),
    );
    assert.match(fn, /inviteClient\(/);
    assert.doesNotMatch(fn, /buildEventExperienceReview/);
    const convert = readFileSync(resolve("lib/clients/service.ts"), "utf8");
    const convertFn = convert.slice(
      convert.indexOf("export async function convertLeadToClient"),
      convert.indexOf("export async function updateClientInfo"),
    );
    assert.doesNotMatch(convertFn, /status:\s*"confirmed"/);
    assert.doesNotMatch(convertFn, /buildEventExperienceReview/);
  });

  it("wedding wording and Phase 1–5 panels remain on Prepare", () => {
    const celebration = readFileSync(resolve("components/clients/booking-celebration.tsx"), "utf8");
    assert.match(celebration, /eventTypeLabel/);
    assert.match(celebration, /PreparePlanningPanel/);
    assert.match(celebration, /FinancialReadinessPanel/);
    assert.match(celebration, /CommunicationsReviewPanel/);
    assert.match(celebration, /EventExperienceReviewPanel/);
    assert.doesNotMatch(celebration, /Their workspace is ready/);
    assert.doesNotMatch(celebration, /Wedding website ready/);
    const preview = readFileSync(resolve("lib/playbooks/apply-preview.ts"), "utf8");
    assert.match(preview, /For your couple/);
  });
});
