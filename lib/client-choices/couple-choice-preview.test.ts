/**
 * R1 — "The couple will choose" on the venue Event Order tab shows the groups
 * the couple will actually answer: the active packet's frozen definition, else
 * the Event Order's own template frozen the same way, else the review-only state.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  NO_COUPLE_CHOICES_MESSAGE,
  coupleChoiceOptionPriceLabel,
  coupleChoicePreview,
  coupleChoiceRuleLabel,
  pickActiveChoices,
} from "@/lib/client-choices/couple-choice-preview";
import type { ChoicesDefinition } from "@/lib/client-choices/types";
import type { EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";

const panel = readFileSync(resolve("components/event-orders/event-order-panel.tsx"), "utf8");
const workflow = readFileSync(resolve("components/event-orders/event-commercial-workflow.tsx"), "utf8");
const choicesPanel = readFileSync(resolve("components/client-choices/client-choices-panel.tsx"), "utf8");

const definition: ChoicesDefinition = {
  sections: [{ id: "s1", name: "Dinner", guidance: null, sortOrder: 0 }],
  groups: [
    { id: "g1", sectionId: "s1", name: "Dinner service", instructions: null, selectionMode: "single", minSelect: 1, maxSelect: 1, allowQuantity: false, sortOrder: 0 },
    { id: "g2", sectionId: "s1", name: "Plated entrées", instructions: "Pick two", selectionMode: "multi", minSelect: 2, maxSelect: 2, allowQuantity: false, sortOrder: 1, dependsOnOptionIds: ["o2"] },
  ],
  options: [
    { id: "o1", groupId: "g1", offeringId: null, label: "Buffet", description: null, isIncluded: true, unitPrice: 0, sortOrder: 0 },
    { id: "o2", groupId: "g1", offeringId: null, label: "Plated", description: null, isIncluded: false, unitPrice: 12, sortOrder: 1 },
    { id: "o3", groupId: "g2", offeringId: null, label: "Salmon", description: null, isIncluded: false, unitPrice: null, sortOrder: 0 },
  ],
};

function packet(status: string, answers = {}) {
  return { id: `p-${status}`, name: "Dinner choices", status, definition, answers };
}

const template = {
  id: "t1", venueId: "v", name: "Standard Wedding EO", description: null, sourceMasterKey: null,
  isArchived: false, createdAt: "", updatedAt: "",
  sections: [{ id: "ts1", templateId: "t1", venueId: "v", name: "Bar", guidance: null, sortOrder: 0, createdAt: "", updatedAt: "" }],
  lines: [],
  groups: [{
    id: "tg1", templateId: "t1", venueId: "v", sectionId: "ts1", name: "Bar package", instructions: null,
    selectionMode: "single", minSelect: 0, maxSelect: 1, allowQuantity: false, dependsOnOptionIds: [], sortOrder: 0,
    createdAt: "", updatedAt: "",
  }],
  options: [
    { id: "to1", templateId: "t1", venueId: "v", groupId: "tg1", offeringId: null, label: "Beer & wine", description: null, isIncluded: true, unitPrice: 9, isDefault: true, imageUrl: null, sortOrder: 0, createdAt: "", updatedAt: "" },
    { id: "to2", templateId: "t1", venueId: "v", groupId: "tg1", offeringId: null, label: "Full bar", description: null, isIncluded: false, unitPrice: 18, isDefault: false, imageUrl: null, sortOrder: 1, createdAt: "", updatedAt: "" },
  ],
} as unknown as EventOrderTemplateWithDetails;

describe("couple choice preview — source selection", () => {
  it("packet present → groups, options, rules, prices from the frozen definition", () => {
    const preview = coupleChoicePreview({ choices: [packet("sent")], eventOrderTemplate: template });
    assert.equal(preview.kind, "packet");
    if (preview.kind !== "packet") return;
    assert.equal(preview.statusLabel, "Awaiting Client");
    assert.deepEqual(preview.groups.map((g) => g.name), ["Dinner service", "Plated entrées"]);
    const [service, entrees] = preview.groups;
    assert.equal(service!.ruleLabel, "Pick one · required");
    assert.equal(service!.sectionName, "Dinner");
    assert.deepEqual(service!.options.map((o) => [o.label, o.priceLabel]), [
      ["Buffet", "Included — $0 extra"],
      ["Plated", "+$12.00"],
    ]);
    assert.equal(entrees!.ruleLabel, "Choose exactly 2");
    assert.deepEqual(entrees!.shownWhen, ["Plated"]);
    assert.equal(entrees!.options[0]!.priceLabel, "Additional — price not set");
  });

  it("packet takes precedence over the template", () => {
    const preview = coupleChoicePreview({ choices: [packet("draft")], eventOrderTemplate: template });
    assert.equal(preview.kind, "packet");
  });

  it("answers shown only once the couple has submitted", () => {
    const answers = { g1: { optionIds: ["o2"] } };
    const sent = coupleChoicePreview({ choices: [packet("sent", answers)], eventOrderTemplate: null });
    const submitted = coupleChoicePreview({ choices: [packet("submitted", answers)], eventOrderTemplate: null });
    assert.ok(sent.kind === "packet" && !sent.showAnswers && sent.groups[0]!.options.every((o) => !o.chosen));
    assert.ok(submitted.kind === "packet" && submitted.showAnswers);
    if (submitted.kind !== "packet") return;
    assert.deepEqual(submitted.groups[0]!.options.filter((o) => o.chosen).map((o) => o.label), ["Plated"]);
    assert.equal(submitted.statusLabel, "Client Submitted");
  });

  it("no packet → the Event Order's template, frozen as Prepare selection request freezes it", () => {
    const preview = coupleChoicePreview({ choices: [], eventOrderTemplate: template });
    assert.equal(preview.kind, "template");
    if (preview.kind !== "template") return;
    assert.equal(preview.templateName, "Standard Wedding EO");
    assert.equal(preview.groups[0]!.ruleLabel, "Optional — choose 1 or skip");
    assert.deepEqual(preview.groups[0]!.options.map((o) => [o.label, o.priceLabel, o.unitPrice]), [
      ["Beer & wine", "Included — $0 extra", 0],
      ["Full bar", "+$18.00", 18],
    ]);
  });

  it("no packet and no template → review only", () => {
    assert.deepEqual(coupleChoicePreview({ choices: [], eventOrderTemplate: null }), { kind: "none" });
    assert.equal(NO_COUPLE_CHOICES_MESSAGE, "No choices — the couple reviews only.");
  });

  it("template or packet with no choice groups → review only", () => {
    const fixedOnly = { ...template, groups: [], options: [] } as EventOrderTemplateWithDetails;
    assert.deepEqual(coupleChoicePreview({ choices: [], eventOrderTemplate: fixedOnly }), { kind: "none" });
    const emptyPacket = { ...packet("sent"), definition: { sections: [], groups: [], options: [] } };
    assert.deepEqual(coupleChoicePreview({ choices: [emptyPacket], eventOrderTemplate: template }), { kind: "none" });
  });
});

describe("couple choice preview — labels", () => {
  it("rule labels match the couple form wording without the live count", () => {
    assert.equal(coupleChoiceRuleLabel({ selectionMode: "multi", minSelect: 1, maxSelect: 3 }), "Choose 1–3");
    assert.equal(coupleChoiceRuleLabel({ selectionMode: "multi", minSelect: 2, maxSelect: null }), "Choose at least 2");
    assert.equal(coupleChoiceRuleLabel({ selectionMode: "multi", minSelect: 0, maxSelect: null }), "Optional — choose any");
  });

  it("price labels: included $0 extra, priced each when quantities apply", () => {
    assert.equal(coupleChoiceOptionPriceLabel({ isIncluded: true, unitPrice: 50 }, false), "Included — $0 extra");
    assert.equal(coupleChoiceOptionPriceLabel({ isIncluded: false, unitPrice: 4.5 }, true), "+$4.50 each");
  });

  it("pickActiveChoices prefers venue review, then awaiting client, then draft", () => {
    const list = [packet("finalized"), packet("draft"), packet("sent"), packet("submitted")];
    assert.equal(pickActiveChoices(list)?.status, "submitted");
    assert.equal(pickActiveChoices(list.slice(0, 3))?.status, "sent");
    assert.equal(pickActiveChoices(list.slice(0, 2))?.status, "draft");
    assert.equal(pickActiveChoices([packet("finalized")])?.status, "finalized");
    assert.equal(pickActiveChoices([]), null);
  });
});

describe("Event Order tab wiring", () => {
  it("renders The couple will choose from already-loaded packets and the order's template", () => {
    assert.match(panel, /The couple will choose/);
    assert.match(panel, /coupleChoicePreview\(/);
    assert.match(panel, /eventOrder\.templateId/);
    assert.match(panel, /getEventOrderTemplateDetailAction\(templateId\)/);
    assert.match(workflow, /choices=\{choices\}/);
  });

  it("the preview section triggers no packet creation, send, finalize, or invoice", () => {
    const start = panel.indexOf("function CoupleWillChooseSection");
    const end = panel.indexOf("function AddSectionInline");
    const section = panel.slice(start, end);
    assert.ok(start > 0 && end > start);
    const actions = section.match(/[A-Za-z]+Action\(/g) ?? [];
    assert.deepEqual([...new Set(actions)], ["getEventOrderTemplateDetailAction("]);
  });

  it("included lines say $0 extra and the extra total uses the invoice rule", () => {
    assert.match(panel, /\$0 extra/);
    assert.match(panel, /eventOrderChargeSplit\(eventOrder\?\.lines \?\? \[\]\)/);
    assert.match(
      readFileSync(resolve(process.cwd(), "lib/client-choices/unbilled-delta.ts"), "utf8"),
      /if \(isBillableEventOrderLineForInvoice\(line\)\) newCharges \+= line\.amount;/,
    );
  });

  it("Client selections panel and the preview share one active-packet rule", () => {
    assert.match(choicesPanel, /import \{ pickActiveChoices \} from "@\/lib\/client-choices\/couple-choice-preview"/);
    assert.doesNotMatch(choicesPanel, /function pickActiveChoices/);
  });
});
