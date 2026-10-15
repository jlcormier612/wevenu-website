import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  buildInquiryFormQuestionInsertRows,
  historicalCustomAnswersRemainReadable,
  moveQuestionInList,
  orderCustomQuestionsBySort,
} from "@/lib/inquiry-form/question-order";
import { mapInquiryFormQuestion } from "@/lib/inquiry-form/map-question";
import { applyInquiryFormDraftToPublicConfig } from "@/lib/inquiry-form/preview-config";
import { validateCustomAnswers } from "@/lib/inquiry-form/validation";
import type { InquiryFormQuestion, PublicInquiryFormConfig } from "@/lib/inquiry-form/types";
import { DEFAULT_INQUIRY_FORM_FIELDS } from "@/lib/inquiry-form/constants";
import { DEFAULT_INQUIRY_COMMUNICATION_SETTINGS } from "@/lib/communication/sms-consent";

function q(
  id: string,
  text: string,
  sortOrder: number,
  required = false,
): InquiryFormQuestion {
  return {
    id,
    questionText: text,
    questionType: "short_answer",
    required,
    options: [],
    sortOrder,
  };
}

describe("inquiry form custom question ordering", () => {
  it("settings builder section order is Standard → Custom → Communication", () => {
    const src = readFileSync(resolve("components/settings/inquiry-form-config-section.tsx"), "utf8");
    const standard = src.indexOf('data-testid="inquiry-form-standard-fields"');
    const custom = src.indexOf('data-testid="inquiry-form-custom-questions"');
    const communication = src.indexOf('data-testid="inquiry-form-communication-preferences"');
    assert.ok(standard >= 0 && custom >= 0 && communication >= 0);
    assert.ok(standard < custom && custom < communication);
    assert.match(src, /aria-label="Move up"/);
    assert.match(src, /aria-label="Move down"/);
    assert.match(src, /aria-label="Delete question"/);
  });

  it("moves questions up and down and no-ops at ends", () => {
    const list = ["a", "b", "c"];
    assert.deepEqual(moveQuestionInList(list, 0, -1), ["a", "b", "c"]);
    assert.deepEqual(moveQuestionInList(list, 2, 1), ["a", "b", "c"]);
    assert.deepEqual(moveQuestionInList(list, 1, -1), ["b", "a", "c"]);
    assert.deepEqual(moveQuestionInList(list, 0, 1), ["b", "a", "c"]);
  });

  it("handles empty and single-question lists", () => {
    assert.deepEqual(moveQuestionInList([], 0, 1), []);
    assert.deepEqual(moveQuestionInList(["only"], 0, -1), ["only"]);
    assert.deepEqual(moveQuestionInList(["only"], 0, 1), ["only"]);
  });

  it("persists sort_order from array index on save rows", () => {
    const rows = buildInquiryFormQuestionInsertRows("venue-1", [
      { questionText: "Second", questionType: "short_answer", required: true, options: [] },
      { questionText: "First", questionType: "long_answer", required: false, options: [] },
      { questionText: "Third", questionType: "single_select", required: false, options: ["A", "B"] },
    ]);
    assert.equal(rows.length, 3);
    assert.equal(rows[0]!.sort_order, 0);
    assert.equal(rows[0]!.question_text, "Second");
    assert.equal(rows[0]!.required, true);
    assert.equal(rows[1]!.sort_order, 1);
    assert.equal(rows[2]!.sort_order, 2);
    assert.deepEqual(rows[2]!.options, ["A", "B"]);
  });

  it("orders loaded questions by sort_order for public rendering", () => {
    const ordered = orderCustomQuestionsBySort([
      q("c", "C", 2),
      q("a", "A", 0),
      q("b", "B", 1),
    ]);
    assert.deepEqual(
      ordered.map((x) => x.questionText),
      ["A", "B", "C"],
    );
  });

  it("maps public RPC camelCase custom questions (not only DB snake_case)", () => {
    const fromRpc = mapInquiryFormQuestion({
      id: "q-rpc",
      questionText: "Dietary needs?",
      questionType: "long_answer",
      required: true,
      options: [],
      sortOrder: 2,
    });
    assert.equal(fromRpc.questionText, "Dietary needs?");
    assert.equal(fromRpc.questionType, "long_answer");
    assert.equal(fromRpc.required, true);
    assert.equal(fromRpc.sortOrder, 2);

    const fromDb = mapInquiryFormQuestion({
      id: "q-db",
      question_text: "Heard about us?",
      question_type: "short_answer",
      required: false,
      options: null,
      sort_order: 0,
    });
    assert.equal(fromDb.questionText, "Heard about us?");
    assert.equal(fromDb.sortOrder, 0);
  });

  it("preview draft preserves configured question order", () => {
    const base: PublicInquiryFormConfig = {
      venue: {
        id: "v1",
        name: "Test",
        logoUrl: null,
        primaryColor: "#000",
        secondaryColor: "#111",
        accentColor: "#222",
        neutralColor: "#fff",
        email: null,
        phone: null,
        addressLine1: null,
        city: null,
        stateRegion: null,
        timezone: null,
      },
      tourSchedulingEnabled: false,
      tourEmbedKey: null,
      tourProtectionRequired: false,
      tourProtectionKind: null,
      tourProtectionFeeCents: null,
      inquiryEventDateMode: "request_preferred",
      inquiryFormFields: { ...DEFAULT_INQUIRY_FORM_FIELDS },
      acceptedEventTypes: ["wedding"],
      customQuestions: [q("old", "Old", 0)],
      ga4MeasurementId: null,
      inquiryCommunicationSettings: { ...DEFAULT_INQUIRY_COMMUNICATION_SETTINGS },
    };
    const preview = applyInquiryFormDraftToPublicConfig(base, {
      inquiryEventDateMode: "request_preferred",
      inquiryFormFields: { ...DEFAULT_INQUIRY_FORM_FIELDS },
      acceptedEventTypes: ["wedding"],
      customQuestions: [q("b", "B", 0), q("a", "A", 1, true)],
      inquiryCommunicationSettings: { ...DEFAULT_INQUIRY_COMMUNICATION_SETTINGS },
    });
    assert.deepEqual(
      preview.customQuestions.map((x) => x.questionText),
      ["B", "A"],
    );
    assert.equal(preview.customQuestions[1]!.required, true);
  });
});

describe("inquiry form required/optional and deletion safety", () => {
  it("required validation follows the required flag for new and existing questions", () => {
    const existing: InquiryFormQuestion[] = [q("existing", "Existing?", 0, true)];
    const newlyAdded: InquiryFormQuestion[] = [q("new", "New?", 0, true)];
    assert.equal(validateCustomAnswers(existing, {}).existing, "This field is required.");
    assert.equal(validateCustomAnswers(newlyAdded, {}).new, "This field is required.");
    assert.equal(
      Object.keys(validateCustomAnswers([{ ...existing[0]!, required: false }], {})).length,
      0,
    );
  });

  it("deleting one question from the persist list does not drop siblings", () => {
    const before = [
      { questionText: "Keep A", questionType: "short_answer" as const, required: false, options: [] },
      { questionText: "Remove me", questionType: "short_answer" as const, required: true, options: [] },
      { questionText: "Keep B", questionType: "short_answer" as const, required: false, options: [] },
    ];
    const afterDelete = before.filter((_, i) => i !== 1);
    const rows = buildInquiryFormQuestionInsertRows("venue-1", afterDelete);
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((r) => r.question_text),
      ["Keep A", "Keep B"],
    );
    assert.equal(rows[0]!.sort_order, 0);
    assert.equal(rows[1]!.sort_order, 1);
  });

  it("historical answers stay readable when the live question id is gone", () => {
    const answers = [
      {
        questionId: "deleted-q",
        questionText: "How did you hear about us?",
        answer: "Instagram",
      },
      {
        questionId: "also-gone",
        questionText: "Guest count estimate",
        answer: "120",
      },
    ];
    assert.equal(
      historicalCustomAnswersRemainReadable(answers, new Set()),
      true,
    );
    assert.equal(
      historicalCustomAnswersRemainReadable(answers, new Set(["unrelated"])),
      true,
    );
  });
});
