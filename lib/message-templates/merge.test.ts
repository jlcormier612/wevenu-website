/**
 * Message Template merge + starter masters — unit tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertCustomerSafeMergedContent,
  buildMergeData,
  mergeContent,
  resolveForCustomerSend,
} from "@/lib/message-templates/merge";
import { STARTER_MESSAGE_MASTERS } from "@/lib/message-templates/starters";
import { substituteSampleMergeFields } from "@/lib/message-templates/preview";
import { formatTourDatetimeForCustomer } from "@/lib/message-templates/merge-context";

describe("starter message masters", () => {
  it("ships exactly 11 approved starters", () => {
    assert.equal(STARTER_MESSAGE_MASTERS.length, 11);
    assert.deepEqual(
      STARTER_MESSAGE_MASTERS.map((m) => m.key),
      ["MSG-01", "MSG-02", "MSG-03", "MSG-04", "MSG-05", "MSG-06", "MSG-07", "MSG-08", "MSG-09", "MSG-10", "MSG-11"],
    );
  });

  it("names and categories match the approved product inventory", () => {
    const byKey = Object.fromEntries(STARTER_MESSAGE_MASTERS.map((m) => [m.key, m]));
    assert.equal(byKey["MSG-01"].name, "New Inquiry Response");
    assert.equal(byKey["MSG-01"].category, "inquiry_follow_up");
    assert.equal(byKey["MSG-02"].name, "Tour Confirmation");
    assert.equal(byKey["MSG-02"].category, "tour");
    assert.equal(byKey["MSG-09"].name, "Almost Here");
    assert.equal(byKey["MSG-09"].category, "planning_reminder");
    assert.equal(byKey["MSG-10"].category, "payment_reminder");
    assert.equal(byKey["MSG-11"].category, "post_event");
  });

  it("MSG-02 includes tour_datetime and MSG-10 includes payment tokens", () => {
    const msg02 = STARTER_MESSAGE_MASTERS.find((m) => m.key === "MSG-02")!;
    const msg10 = STARTER_MESSAGE_MASTERS.find((m) => m.key === "MSG-10")!;
    assert.match(msg02.emailBody, /\{\{tour_datetime\}\}/);
    assert.match(msg10.emailBody, /\{\{payment_amount\}\}/);
    assert.match(msg10.emailBody, /\{\{payment_due_date\}\}/);
  });

  it("preview resolves every starter token with samples", () => {
    for (const master of STARTER_MESSAGE_MASTERS) {
      const preview = substituteSampleMergeFields(`${master.emailSubject}\n${master.emailBody}`);
      assert.doesNotMatch(preview, /\{\{[a-z_]+\}\}/);
    }
  });
});

describe("buildMergeData optional tokens", () => {
  it("omits tour/payment keys when absent so literals can be detected", () => {
    const data = buildMergeData({
      venueName: "Willow Creek",
      clientName: "Emily & James",
      coordinatorName: "Jordan",
      eventDate: "2027-06-12",
    });
    assert.equal(data.venue_name, "Willow Creek");
    assert.equal(data.tour_datetime, undefined);
    assert.equal(data.payment_amount, undefined);
    assert.equal(data.first_name, undefined);
    const body = "See you on {{tour_datetime}}";
    assert.equal(mergeContent(body, data), "See you on {{tour_datetime}}");
  });

  it("includes first/last/full name when present", () => {
    const data = buildMergeData({
      venueName: "Willow Creek",
      clientName: "Emily & James Carter",
      clientFirstName: "Emily",
      clientLastName: "Carter",
      coordinatorName: "Jordan",
      eventDate: "2027-06-12",
    });
    assert.equal(data.first_name, "Emily");
    assert.equal(data.last_name, "Carter");
    assert.equal(data.full_name, "Emily Carter");
  });

  it("includes tour and payment when present", () => {
    const data = buildMergeData({
      venueName: "Willow Creek",
      clientName: "Emily & James",
      coordinatorName: "Jordan",
      eventDate: "2027-06-12",
      tourDatetime: "Saturday, May 9, 2027 at 2:00 PM",
      paymentLabel: "Deposit",
      paymentAmount: "$2,000",
      paymentDueDate: "March 1, 2027",
    });
    assert.equal(data.tour_datetime, "Saturday, May 9, 2027 at 2:00 PM");
    assert.equal(data.payment_label, "Deposit");
    assert.equal(data.payment_amount, "$2,000");
    assert.equal(data.payment_due_date, "March 1, 2027");
  });
});

describe("customer-safe merge gate", () => {
  it("blocks unresolved tokens", () => {
    const result = assertCustomerSafeMergedContent("Due {{payment_amount}} on {{tour_datetime}}");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.tokens.includes("payment_amount"));
      assert.ok(result.tokens.includes("tour_datetime"));
    }
  });

  it("resolveForCustomerSend succeeds when context covers tokens", () => {
    const master = STARTER_MESSAGE_MASTERS.find((m) => m.key === "MSG-02")!;
    const result = resolveForCustomerSend(master.emailBody, master.emailSubject, {
      venueName: "Willow Creek Estate",
      clientName: "Emily & James Carter",
      coordinatorName: "Jordan Blake",
      eventDate: "2027-06-12",
      tourDatetime: "Saturday, May 9, 2027 at 2:00 PM",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.match(result.body, /Saturday, May 9, 2027 at 2:00 PM/);
      assert.doesNotMatch(result.body, /\{\{/);
    }
  });

  it("resolveForCustomerSend fails MSG-10 without payment context", () => {
    const master = STARTER_MESSAGE_MASTERS.find((m) => m.key === "MSG-10")!;
    const result = resolveForCustomerSend(master.emailBody, master.emailSubject, {
      venueName: "Willow Creek Estate",
      clientName: "Emily & James Carter",
      coordinatorName: "Jordan Blake",
      eventDate: "2027-06-12",
    });
    assert.equal(result.ok, false);
  });
});

describe("formatTourDatetimeForCustomer", () => {
  it("formats in the venue timezone", () => {
    // 2027-05-09T18:00:00.000Z = 2:00 PM Eastern (EDT)
    const formatted = formatTourDatetimeForCustomer("2027-05-09T18:00:00.000Z", "America/New_York");
    assert.match(formatted, /May/);
    assert.match(formatted, /2027/);
    assert.match(formatted, /2:00|14:00/);
  });
});
