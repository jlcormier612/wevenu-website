/**
 * Sales → Booking Started / commercial Booked release semantics — focused tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { SALES_STAGE_META, salesStageLabel } from "@/lib/leads/sales-stages";
import { formatTimingLabel } from "@/lib/payments/starters";
import { commercialStepsComplete, buildBookingJourney } from "@/lib/booking-journey/model";
import type { CommercialSelection } from "@/lib/commercial-selections/types";

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("Pipeline terminology — Booking Started vs commercial Booked", () => {
  it("pipeline sales_stage booked is labeled Booked", () => {
    assert.equal(salesStageLabel("booked"), "Booked");
    assert.equal(SALES_STAGE_META.find((s) => s.value === "booked")!.label, "Booked");
    assert.match(
      SALES_STAGE_META.find((s) => s.value === "booked")!.description,
      /booking transition is complete/i,
    );
  });

  it("commercialReady is informational; Booked is only bookClient", () => {
    const model = read("lib/booking-journey/model.ts");
    assert.match(model, /commercialReady/);
    assert.match(model, /commercialStepsComplete/);
    assert.doesNotMatch(model, /export function isCommerciallyBooked/);
    const facts = read("components/booking-journey/commercial-facts.tsx");
    assert.match(facts, /You mark a relationship Booked when you/);
    assert.match(facts, /payment does not decide it/i);
    const panel = read("components/booking-journey/booking-journey-panel.tsx");
    assert.doesNotMatch(panel, /BookingJourneyStrip|Booking Journey/);
    assert.doesNotMatch(panel, /Send proposal/);
    const lead = read("components/leads/lead-detail.tsx");
    const event = read("components/events/event-detail.tsx");
    assert.match(lead, /Pipeline stage/);
    assert.doesNotMatch(lead, /Booking Journey/);
    assert.doesNotMatch(event, />\s*Booking Journey/);
  });

  it("Start booking file prepares the workspace and does not reserve the date", () => {
    const detail = read("components/leads/lead-detail.tsx");
    assert.match(detail, /Start booking file\?/);
    assert.match(detail, /does not reserve their date/);
    assert.match(detail, /planning workspace/);
  });
});

describe("events.booked_at — commercial Booked only", () => {
  it("convertLeadToClient / createClientCore do not stamp booked_at on Start booking / Direct Add", () => {
    const clients = read("lib/clients/service.ts");
    const convert = clients.slice(clients.indexOf("export async function convertLeadToClient"));
    assert.doesNotMatch(convert, /stampBookingDateIfNeeded|ensureEventBookedAt/);
    const core = clients.slice(
      clients.indexOf("async function createClientCore"),
      clients.indexOf("export async function createClient_"),
    );
    assert.doesNotMatch(core, /stampBookingDateIfNeeded|ensureEventBookedAt/);
  });

  it("commercial milestones do not book the relationship", () => {
    const stamp = read("lib/booking-journey/stamp-commercial-booked-at.ts");
    assert.match(stamp, /maybeStampCommercialBookedAt/);
    assert.match(stamp, /do not move a relationship to Booked/);
    assert.doesNotMatch(stamp, /bookClient\(/);
    assert.doesNotMatch(read("lib/payments/service.ts"), /maybeStampCommercialBookedAt/);
    assert.doesNotMatch(read("lib/stripe/webhook-handlers.ts"), /maybeStampCommercialBookedAt/);
    assert.doesNotMatch(read("lib/contracts/service.ts"), /maybeStampCommercialBookedAt/);
  });

  it("payment timing labels refer to commercial Booked", () => {
    assert.equal(formatTimingLabel({ type: "at_booking" }), "At booking (when Booked)");
    assert.match(formatTimingLabel({ type: "after_booking", days: 30 }), /when Booked/);
  });
});

describe("Commercial steps (not Booked)", () => {
  function selection(overrides: Partial<CommercialSelection> = {}): CommercialSelection {
    return {
      id: "s1",
      venueId: "v",
      leadId: null,
      clientId: "c1",
      eventId: "e1",
      proposalId: null,
      sourcePackageId: null,
      name: "Gold",
      totalAmount: 10000,
      depositAmount: 2000,
      includedItems: [],
      status: "accepted",
      version: 1,
      supersededById: null,
      acceptToken: null,
      offerMessage: null,
      offeredAt: null,
      acceptedAt: null,
      contractId: null,
      invoiceId: null,
      createdAt: "",
      updatedAt: "",
      ...overrides,
    };
  }

  it("commercial steps complete with agreement + deposit — still not Booked", () => {
    assert.equal(
      commercialStepsComplete({
        selection: selection(),
        contract: null,
        paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 2000 }],
      }),
      true,
    );
    assert.equal(
      commercialStepsComplete({
        selection: selection({ status: "offered" }),
        contract: null,
        paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 2000 }],
      }),
      false,
    );
  });

  it("journey ready stage never claims Booked", () => {
    const j = buildBookingJourney({
      selection: selection(),
      contract: null,
      paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 2000 }],
      portalInvited: false,
      planningStarted: false,
      clientId: "c1",
      eventId: "e1",
    });
    assert.equal(j.commercialReady, true);
    assert.equal(j.stages.find((s) => s.key === "ready")?.label, "Next steps");
    assert.match(j.direction, /Mark them Booked when you're ready/i);
  });
});

describe("Canonical Start booking file path", () => {
  it("startBookingFileAction is the canonical path; convertLeadToClientAction delegates", () => {
    const bookingActions = read("app/(app)/booking-journey/actions.ts");
    assert.match(bookingActions, /export async function startBookingFileAction/);
    assert.match(bookingActions, /attachSelectionToBookingFile/);
    assert.match(bookingActions, /warning/);
    const clientsActions = read("app/(app)/clients/actions.ts");
    assert.match(clientsActions, /startBookingFileAction/);
    assert.match(clientsActions, /@deprecated Prefer startBookingFileAction/);
    assert.doesNotMatch(
      clientsActions.slice(clientsActions.indexOf("convertLeadToClientAction")),
      /convertLeadToClient\(lead/,
    );
  });

  it("Start booking file does not enroll Booking Started automations", () => {
    const detail = read("components/leads/lead-detail.tsx");
    assert.doesNotMatch(detail, /wouldEnrollOnPipelineStageMoveAction\(lead\.id, "booked"\)/);
    assert.doesNotMatch(detail, /pendingBookAfterAutomation/);
    assert.match(detail, /does not reserve their date/i);
  });

  it("Lead detail surfaces ConflictWarning for the event date", () => {
    const detail = read("components/leads/lead-detail.tsx");
    assert.match(detail, /ConflictWarning/);
    assert.match(detail, /eventDateBlocked/);
    assert.match(detail, /That date is already protected/);
  });

  it("convertLeadToClient prepares a client and does not occupy a date", () => {
    const clients = read("lib/clients/service.ts");
    const convert = clients.slice(clients.indexOf("export async function convertLeadToClient"));
    assert.doesNotMatch(convert, /coveringClientEventBlockTitle/);
    assert.doesNotMatch(convert, /insertClientWithDatedEvent\(/);
    assert.match(convert, /clients_lead_id_unique|23505/);
  });
});

describe("Direct Add and celebration destinations", () => {
  it("Direct Add does not navigate to /booked celebration", () => {
    const form = read("components/clients/client-form.tsx");
    assert.match(form, /router\.push\(`\/clients\/\$\{result\.clientId\}`\)/);
    assert.doesNotMatch(form, /\/booked/);
  });

  it("celebration page requires events.booked_at and the transition handoff", () => {
    const page = read("app/(app)/clients/[id]/booked/page.tsx");
    assert.match(page, /event\?\.bookedAt/);
    assert.match(page, /consumeBookingCelebration/);
    assert.match(page, /redirect\(`\/clients\/\$\{client\.id\}`\)/);
    assert.match(page, /They're Booked/);
  });
});

describe("Booked-stage automation copy", () => {
  it("communications review says when Booked", () => {
    const src = read("lib/clients/communications-review.ts");
    assert.match(src, /when Booked/);
    assert.doesNotMatch(src, /Booking Started/);
  });
});

describe("commercial-only path skips Booking Started", () => {
  it("ensureCommercialCustomer uses commercialOnly", () => {
    const src = read("lib/booking-journey/ensure-commercial-customer.ts");
    assert.match(src, /commercialOnly:\s*true/);
    assert.doesNotMatch(src, /inviteClient/);
  });
});
