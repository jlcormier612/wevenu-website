import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { INQUIRY_API_ERRORS } from "@/lib/inquiry-form/constants";
import { validateConfigurableFields, validateCustomAnswers } from "@/lib/inquiry-form/validation";
import type { InquiryFormQuestion } from "@/lib/inquiry-form/types";
import { DEFAULT_ACCEPTED_EVENT_TYPES, eventTypeLabel } from "@/lib/event-types/canonical";

describe("inquiry form validation", () => {
  it("default public accepted labels match product starter set", () => {
    assert.deepEqual(
      DEFAULT_ACCEPTED_EVENT_TYPES.map((v) => eventTypeLabel(v)),
      ["Wedding", "Corporate Event", "Social Event", "Birthday Party", "Other"],
    );
  });

  it("flags missing required configurable fields", () => {
    const errors = validateConfigurableFields(
      {
        phone: "required",
        partner: "hidden",
        guest_count: "optional",
        estimated_budget: "hidden",
        preferred_event_date: "required",
        event_details: "hidden",
      },
      {
        phone: "",
        partnerFirst: "",
        partnerLast: "",
        eventDate: "",
        guestCount: "",
        budget: "",
        message: "",
      },
    );
    assert.equal(errors.phone, "Phone is required.");
    assert.equal(errors.eventDate, "Preferred event date is required.");
  });

  it("validates required custom questions", () => {
    const questions: InquiryFormQuestion[] = [
      {
        id: "q1",
        questionText: "How did you hear about us?",
        questionType: "short_answer",
        required: true,
        options: [],
        sortOrder: 0,
      },
    ];
    const errors = validateCustomAnswers(questions, {});
    assert.equal(errors.q1, "This field is required.");
  });

  it("maps API error copy for unavailable slot and date and rejected type", () => {
    assert.equal(
      INQUIRY_API_ERRORS.slot_unavailable,
      "That time is no longer available. Please choose another time.",
    );
    assert.equal(
      INQUIRY_API_ERRORS.date_unavailable,
      "That date is no longer available. Please choose another date.",
    );
    assert.equal(
      INQUIRY_API_ERRORS.event_type_not_accepted,
      "That event type is not accepted by this venue. Please choose another.",
    );
  });
});
