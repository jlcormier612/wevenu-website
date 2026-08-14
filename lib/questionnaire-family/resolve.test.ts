import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getQuestionnaireMasterByKind,
  QUESTIONNAIRE_FAMILY_MASTERS,
} from "@/lib/questionnaire-family/definitions";
import {
  resolveQuestionnaireFields,
  sanitizeCustomFields,
  sanitizeFieldOrder,
  sanitizeMasterOverrides,
} from "@/lib/questionnaire-family/resolve";

describe("questionnaire authoring resolve", () => {
  for (const master of QUESTIONNAIRE_FAMILY_MASTERS) {
    it(`${master.kind}: default resolve includes all master fields`, () => {
      const fields = resolveQuestionnaireFields({ kind: master.kind });
      assert.equal(fields.length, master.fields.length);
      assert.equal(fields[0]?.label, master.fields[0]?.label);
    });

    it(`${master.kind}: master_overrides change label/helper only`, () => {
      const first = master.fields[0];
      assert.ok(first);
      const fields = resolveQuestionnaireFields({
        kind: master.kind,
        masterOverrides: {
          [first.id]: { label: "Venue wording", helper: "Venue helper" },
        },
      });
      const resolved = fields.find((f) => f.id === first.id);
      assert.equal(resolved?.label, "Venue wording");
      assert.equal(resolved?.helper, "Venue helper");
      assert.equal(resolved?.destination, first.destination);
      assert.equal(resolved?.type, first.type);
      assert.equal(resolved?.isCustom, false);
    });

    it(`${master.kind}: custom fields append with family destination`, () => {
      const customs = sanitizeCustomFields(master.kind, [{
        id: "custom_abc123",
        section: "Your Questions",
        label: "Dietary notes for family",
        required: true,
        type: "long_text",
        destination: "column", // must be forced to family by sanitize
      }]);
      assert.equal(customs[0]?.destination, "family");
      const fields = resolveQuestionnaireFields({
        kind: master.kind,
        customFields: customs,
        includedFields: [...master.fields.map((f) => f.id), "custom_abc123"],
        requiredFields: ["custom_abc123"],
        fieldOrder: ["custom_abc123", ...master.fields.map((f) => f.id)],
      });
      assert.equal(fields[0]?.id, "custom_abc123");
      assert.equal(fields[0]?.isCustom, true);
      assert.equal(fields[0]?.required, true);
      assert.equal(fields[0]?.destination, "family");
    });

    it(`${master.kind}: excluding a master field does not destroy the definition`, () => {
      const drop = master.fields[0]!.id;
      const included = master.fields.slice(1).map((f) => f.id);
      const fields = resolveQuestionnaireFields({
        kind: master.kind,
        includedFields: included,
      });
      assert.ok(!fields.some((f) => f.id === drop));
      // Master code unchanged
      assert.ok(getQuestionnaireMasterByKind(master.kind).fields.some((f) => f.id === drop));
    });
  }

  it("sanitize rejects non-custom_ ids and master id collisions", () => {
    const kind = "final_details";
    const masterId = getQuestionnaireMasterByKind(kind).fields[0]!.id;
    const out = sanitizeCustomFields(kind, [
      { id: masterId, label: "Nope", type: "short_text" },
      { id: "not_custom", label: "Nope", type: "short_text" },
      { id: "custom_ok", label: "Yes", type: "yes_no" },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.id, "custom_ok");
  });

  it("sanitizeMasterOverrides only allows master ids and label/helper", () => {
    const kind = "client_planning";
    const id = getQuestionnaireMasterByKind(kind).fields[0]!.id;
    const out = sanitizeMasterOverrides(kind, {
      [id]: { label: "Override", helper: null, type: "hacked" },
      custom_x: { label: "No" },
    });
    assert.deepEqual(Object.keys(out), [id]);
    assert.equal(out[id]?.label, "Override");
    assert.equal(out[id]?.helper, null);
  });

  it("sanitizeFieldOrder keeps only included + customs", () => {
    const kind = "post_event_feedback";
    const master = getQuestionnaireMasterByKind(kind);
    const customs = sanitizeCustomFields(kind, [{
      id: "custom_zz", label: "Extra", type: "short_text",
    }]);
    const included = [master.fields[0]!.id, "custom_zz"];
    const order = sanitizeFieldOrder(kind, included, customs, ["bogus", "custom_zz", master.fields[0]!.id]);
    assert.deepEqual(order, ["custom_zz", master.fields[0]!.id]);
  });

  it("working-form snapshot isolation model: resolve uses snapshot columns not live template", () => {
    // Emulates event_questionnaires columns frozen at apply time vs later template edit.
    const kind = "final_details" as const;
    const master = getQuestionnaireMasterByKind(kind);
    const snap = resolveQuestionnaireFields({
      kind,
      includedFields: master.fields.map((f) => f.id),
      masterOverrides: { [master.fields[0]!.id]: { label: "At send time" } },
      customFields: [],
      fieldOrder: master.fields.map((f) => f.id),
    });
    const laterTemplate = resolveQuestionnaireFields({
      kind,
      includedFields: [...master.fields.map((f) => f.id), "custom_new"],
      masterOverrides: { [master.fields[0]!.id]: { label: "Later edit on Library template" } },
      customFields: [{
        id: "custom_new",
        section: "Your Questions",
        label: "Added after send",
        required: false,
        type: "short_text",
        destination: "family",
      }],
      fieldOrder: [...master.fields.map((f) => f.id), "custom_new"],
    });
    assert.equal(snap[0]?.label, "At send time");
    assert.ok(!snap.some((f) => f.id === "custom_new"));
    assert.equal(laterTemplate[0]?.label, "Later edit on Library template");
    assert.ok(laterTemplate.some((f) => f.id === "custom_new"));
  });
});
