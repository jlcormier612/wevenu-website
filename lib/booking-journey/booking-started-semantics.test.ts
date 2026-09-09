/**
 * Sales → Booking Started / commercial Booked release semantics — focused tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { SALES_STAGE_META, salesStageLabel } from "@/lib/leads/sales-stages";
import { formatTimingLabel } from "@/lib/payments/starters";
import { isCommerciallyBooked, buildBookingJourney } from "@/lib/booking-journey/model";
import type { CommercialSelection } from "@/lib/commercial-selections/types";

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("Pipeline terminology — Booking Started vs commercial Booked", () => {
  it("pipeline sales_stage booked is labeled Booking Started", () => {
    assert.equal(salesStageLabel("booked"), "Booking Started");
    assert.equal(SALES_STAGE_META.find((s) => s.value === "booked")!.label, "Booking Started");
    assert.doesNotMatch(
      SALES_STAGE_META.find((s) => s.value === "booked")!.description,
      /^Booked$|commercially Booked milestone alone/i,
    );
    assert.match(
      SALES_STAGE_META.find((s) => s.value === "booked")!.description,
      /not commercially Booked/i,
    );
  });

  it("Booking Journey keeps commercial Booked label", () => {
    const model = read("lib/booking-journey/model.ts");
    assert.match(model, /key: "booked", label: "Booked"/);
    const strip = read("components/booking-journey/booking-journey-strip.tsx");
    assert.match(strip, /Commercial path/);
    assert.match(strip, /Booking Started/);
  });

  it("Lead confirm does not call the result a planning workspace", () => {
    const detail = read("components/leads/lead-detail.tsx");
    assert.match(detail, /Start booking file\?/);
    assert.match(detail, /Booking Started/);
    assert.match(detail, /booking file/);
    assert.doesNotMatch(
      detail.slice(detail.indexOf("title=\"Start booking file?\""), detail.indexOf("confirmLabel=\"Start booking file\"")),
      /planning workspace/i,
    );
    assert.match(detail, /not commercially Booked until/i);
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

  it("commercial stamp helper and payment/sign writers exist", () => {
    const stamp = read("lib/booking-journey/stamp-commercial-booked-at.ts");
    assert.match(stamp, /maybeStampCommercialBookedAt/);
    assert.match(stamp, /isCommerciallyBooked/);
    assert.match(stamp, /ensureEventBookedAt/);
    assert.match(read("lib/payments/service.ts"), /maybeStampCommercialBookedAt/);
    assert.match(read("lib/stripe/webhook-handlers.ts"), /maybeStampCommercialBookedAt/);
    assert.match(read("lib/contracts/service.ts"), /maybeStampCommercialBookedAt/);
  });

  it("payment timing labels refer to commercial Booked", () => {
    assert.equal(formatTimingLabel({ type: "at_booking" }), "At booking (when Booked)");
    assert.match(formatTimingLabel({ type: "after_booking", days: 30 }), /when Booked/);
  });
});

describe("Commercial Booked gate", () => {
  function selection(overrides: Partial<CommercialSelection> = {}): CommercialSelection {
    return {
      id: "s1",
      venueId: "v",
      leadId: null,
      clientId: "c1",
      eventId: "e1",
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

  it("is commercially Booked only with agreement + deposit", () => {
    assert.equal(
      isCommerciallyBooked({
        selection: selection(),
        contract: null,
        paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 2000 }],
      }),
      true,
    );
    assert.equal(
      isCommerciallyBooked({
        selection: selection({ status: "offered" }),
        contract: null,
        paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 2000 }],
      }),
      false,
    );
  });

  it("journey Booked stage stays commercial", () => {
    const j = buildBookingJourney({
      selection: selection(),
      contract: null,
      paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 2000 }],
      portalInvited: false,
      planningStarted: false,
      clientId: "c1",
      eventId: "e1",
    });
    assert.equal(j.isCommerciallyBooked, true);
    assert.equal(j.stages.find((s) => s.key === "booked")?.label, "Booked");
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

  it("Start booking file discloses Booking Started automations before enroll", () => {
    const detail = read("components/leads/lead-detail.tsx");
    assert.match(detail, /wouldEnrollOnPipelineStageMoveAction\(lead\.id, "booked"\)/);
    assert.match(detail, /pendingBookAfterAutomation/);
    assert.match(detail, /PipelineAutomationConfirmDialog/);
    assert.match(detail, /Booking Started/);
  });

  it("Lead detail surfaces ConflictWarning for the event date", () => {
    const detail = read("components/leads/lead-detail.tsx");
    assert.match(detail, /ConflictWarning/);
    assert.match(detail, /eventDateBlocked/);
    assert.match(detail, /That date is already protected/);
  });

  it("convertLeadToClient hard-blocks calendar coverage and maps occupancy failures", () => {
    const clients = read("lib/clients/service.ts");
    const convert = clients.slice(clients.indexOf("export async function convertLeadToClient"));
    assert.match(convert, /coveringClientEventBlockTitle/);
    assert.match(convert, /occupancyClientFailure/);
    assert.match(convert, /clients_lead_id_unique|23505/);
  });
});

describe("Direct Add and celebration destinations", () => {
  it("Direct Add does not navigate to /booked celebration", () => {
    const form = read("components/clients/client-form.tsx");
    assert.match(form, /router\.push\(`\/clients\/\$\{result\.clientId\}`\)/);
    assert.doesNotMatch(form, /\/booked/);
  });

  it("commercial celebration page still requires isCommerciallyBooked", () => {
    const page = read("app/(app)/clients/[id]/booked/page.tsx");
    assert.match(page, /isCommerciallyBooked/);
    assert.match(page, /redirect\(`\/clients\/\$\{client\.id\}`\)/);
    assert.match(page, /Client Planning is optional/);
  });
});

describe("Booked-stage automation copy", () => {
  it("communications review says Booking Started not after booking", () => {
    const src = read("lib/clients/communications-review.ts");
    assert.match(src, /when Booking Started/);
    assert.doesNotMatch(src, /after booking/);
  });
});

describe("commercial-only path skips Booking Started", () => {
  it("ensureCommercialCustomer uses commercialOnly", () => {
    const src = read("lib/booking-journey/ensure-commercial-customer.ts");
    assert.match(src, /commercialOnly:\s*true/);
    assert.doesNotMatch(src, /inviteClient/);
  });
});
