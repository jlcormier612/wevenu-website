import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { buildBookingHandoff } from "@/lib/clients/booking-handoff";

const CLIENT_ID = "client-1";
const EVENT_ID = "event-1";

function baseInput(overrides: Partial<Parameters<typeof buildBookingHandoff>[0]> = {}) {
  return {
    clientId: CLIENT_ID,
    eventId: EVENT_ID,
    playbookApplications: [],
    financialSummary: "Nothing on file yet. Contract and payment plan are optional.",
    communicationsSummary:
      "Not sent — the client will be invited when you release their planning. Nothing is scheduled to send automatically after booking.",
    experienceSummary: "Your client's experience is set up for a wedding.",
    ...overrides,
  };
}

describe("buildBookingHandoff", () => {
  it("does not treat an invitation as a prepared workspace", () => {
    const model = buildBookingHandoff(baseInput());
    const blob = JSON.stringify(model);
    assert.doesNotMatch(blob, /workspace is ready/i);
    assert.doesNotMatch(blob, /wedding website ready/i);
    assert.doesNotMatch(blob, /planning tools ready/i);
    assert.equal(model.bookingLine, "are booked.");
    assert.equal(model.prepareHeading, "Prepare Their Event");
    const communications = model.items.find((i) => i.key === "communications");
    assert.equal(communications?.complete, false);
    assert.match(communications?.detail ?? "", /will be invited when you release their planning/);
    const clientPlanning = model.items.find((i) => i.key === "client_planning");
    assert.equal(clientPlanning?.complete, false);
    assert.equal(clientPlanning?.detail, "Not configured");
  });

  it("shows a newly booked client with no planning as needing preparation", () => {
    const model = buildBookingHandoff(baseInput());
    assert.equal(model.items.find((i) => i.key === "client_planning")?.complete, false);
    assert.equal(model.items.find((i) => i.key === "venue_planning")?.complete, false);
    assert.equal(model.items.find((i) => i.key === "client_planning")?.detail, "Not configured");
    assert.equal(model.items.find((i) => i.key === "venue_planning")?.detail, "Not configured");
    assert.equal(model.primaryHref, `/events/${EVENT_ID}#playbook`);
    assert.equal(model.primaryLabel, "Prepare Their Event");
  });

  it("represents invitation state truthfully on the Communications row", () => {
    const pending = buildBookingHandoff(baseInput({
      communicationsSummary: "Not sent — the client will be invited when you release their planning. Nothing is scheduled to send automatically after booking.",
    }));
    assert.match(pending.items.find((i) => i.key === "communications")?.detail ?? "", /will be invited when you release their planning/);
    assert.equal(pending.items.find((i) => i.key === "communications")?.complete, false);

    const noEmail = buildBookingHandoff(baseInput({
      communicationsSummary: "Not sent — no client email on file. Nothing is scheduled to send automatically after booking.",
    }));
    assert.match(noEmail.items.find((i) => i.key === "communications")?.detail ?? "", /no client email on file/);

    const sent = buildBookingHandoff(baseInput({
      communicationsSummary: "Invitation sent. Nothing is scheduled to send automatically after booking.",
    }));
    assert.match(sent.items.find((i) => i.key === "communications")?.detail ?? "", /Invitation sent/);
  });

  it("links Planning, Financial readiness, Event Experience, and Communications to existing routes", () => {
    const empty = buildBookingHandoff(baseInput());
    assert.equal(empty.items.find((i) => i.key === "client_planning")?.href, `/events/${EVENT_ID}#playbook`);
    assert.equal(empty.items.find((i) => i.key === "financial")?.href, "#financial-readiness");
    assert.equal(empty.items.find((i) => i.key === "financial")?.label, "Financial readiness");
    assert.match(empty.items.find((i) => i.key === "financial")?.detail ?? "", /optional/i);
    assert.equal(empty.items.find((i) => i.key === "event_experience")?.href, "#event-experience");
    assert.equal(empty.items.find((i) => i.key === "event_experience")?.label, "Event Experience");
    assert.equal(empty.items.find((i) => i.key === "event_experience")?.complete, false);
    assert.equal(empty.items.find((i) => i.key === "communications")?.href, "#communications");
    assert.equal(empty.items.find((i) => i.key === "communications")?.label, "Communications");
  });

  it("distinguishes Client Planning draft from released without treating either as website-ready", () => {
    const draft = buildBookingHandoff(baseInput({
      playbookApplications: [{ kind: "client", releasedAt: null, templateName: "Standard Wedding" }],
    }));
    assert.equal(draft.items.find((i) => i.key === "client_planning")?.complete, true);
    assert.match(draft.items.find((i) => i.key === "client_planning")?.detail ?? "", /Draft/);
    assert.doesNotMatch(JSON.stringify(draft), /workspace is ready/i);

    const released = buildBookingHandoff(baseInput({
      playbookApplications: [{ kind: "client", releasedAt: "2026-09-02T00:00:00Z", templateName: "Standard Wedding" }],
    }));
    assert.match(released.items.find((i) => i.key === "client_planning")?.detail ?? "", /Released to the client/);
    assert.match(released.items.find((i) => i.key === "client_planning")?.detail ?? "", /Standard Wedding/);
  });

  it("does not mark Event created complete when no event exists", () => {
    const model = buildBookingHandoff(baseInput({ eventId: null }));
    assert.equal(model.items.find((i) => i.key === "event")?.complete, false);
    assert.equal(model.primaryHref, `/clients/${CLIENT_ID}/edit`);
    assert.equal(model.items.find((i) => i.key === "client_planning")?.href, `/clients/${CLIENT_ID}/edit`);
  });

  it("does not invent a contract or deposit requirement", () => {
    const model = buildBookingHandoff(baseInput());
    const blob = JSON.stringify(model);
    assert.doesNotMatch(blob, /required/i);
    assert.doesNotMatch(blob, /not ready/i);
    assert.equal(model.items.find((i) => i.key === "financial")?.complete, false);
  });
});

describe("booked page — conversion and copy seams", () => {
  it("does not render the old workspace-ready or wedding-website-ready assertions", () => {
    const celebration = readFileSync(resolve("components/clients/booking-celebration.tsx"), "utf8");
    const page = readFileSync(resolve("app/(app)/clients/[id]/booked/page.tsx"), "utf8");
    assert.doesNotMatch(celebration, /Their workspace is ready/);
    assert.doesNotMatch(celebration, /Wedding website ready/);
    assert.doesNotMatch(celebration, /Planning tools ready/);
    assert.doesNotMatch(celebration, /Workspace Ready/);
    assert.doesNotMatch(celebration, /wedding workspace appeared/);
    assert.match(celebration, /eventTypeLabel/);
    assert.match(celebration, /handoff\.prepareHeading/);
    assert.match(celebration, /handoff\.primaryLabel/);
    assert.match(page, /buildBookingHandoff/);
    assert.match(page, /getClientInvitation/);
    assert.match(page, /buildCommunicationsReview/);
    assert.match(page, /clientHasEmail/);
    assert.match(page, /getEventPlaybookApplications/);
    assert.match(page, /getTemplates/);
    assert.match(celebration, /PreparePlanningPanel/);
    assert.match(celebration, /FinancialReadinessPanel/);
    assert.match(celebration, /EventExperienceReviewPanel/);
    assert.match(celebration, /CommunicationsReviewPanel/);
  });

  it("does not invite at convertLeadToClient and does not apply planning", () => {
    const src = readFileSync(resolve("lib/clients/service.ts"), "utf8");
    const fnStart = src.indexOf("export async function convertLeadToClient");
    const fnEnd = src.indexOf("export async function updateClientInfo", fnStart);
    const fn = src.slice(fnStart, fnEnd);
    assert.doesNotMatch(fn, /inviteClient\(/);
    assert.match(fn, /insertClient\(/);
    assert.match(fn, /autoCreateEvent\(/);
    assert.match(fn, /updateLeadSalesStage\(lead\.id, "booked"/);
    assert.doesNotMatch(fn, /applyPlaybookToEvent/);
    assert.doesNotMatch(fn, /releasePlaybookApplication/);
  });
});
