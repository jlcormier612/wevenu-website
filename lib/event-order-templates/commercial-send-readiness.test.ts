/**
 * Commercial send readiness — Library Send must refuse incomplete offerings
 * before creating a client_choices packet, and both send UIs must show
 * grouped completeness guidance. Does not invent prices or auto-mark Included.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import { unanswerableChoicesSendMessage } from "@/lib/client-choices/validate-answers";
import {
  newVenueUnconfiguredStarterTemplate,
} from "@/lib/event-order-templates/checkpoint-3b-fixtures";
import { commercialState } from "@/lib/event-order-templates/commercial-state";
import { selectionDefinitionFromEventOrderTemplate } from "@/lib/event-order-templates/selection-definition";
import type { EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";

const root = join(process.cwd());

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function markEveryOptionIncluded(template: EventOrderTemplateWithDetails): EventOrderTemplateWithDetails {
  const next = structuredClone(template);
  for (const opt of next.options) {
    if (commercialState(opt) === "not_configured") {
      opt.isIncluded = true;
      opt.unitPrice = 0;
    }
  }
  return next;
}

describe("incomplete offerings block sending", () => {
  it("the unconfigured Wedding Reception starter is refused by the shared send guard", () => {
    const template = newVenueUnconfiguredStarterTemplate();
    const unresolved = template.options.filter((o) => commercialState(o) === "not_configured");
    assert.ok(unresolved.length > 0);
    const blocked = unanswerableChoicesSendMessage(selectionDefinitionFromEventOrderTemplate(template));
    assert.match(blocked ?? "", /not configured/i);
  });
});

describe("failed Library sends create no new selection packets", () => {
  it("sendEventOrderTemplate checks commercial readiness before apply and packet create", () => {
    const sendFn = source("lib/event-order-templates/use-send.ts").slice(
      source("lib/event-order-templates/use-send.ts").indexOf("export async function sendEventOrderTemplate"),
    );
    const guard = sendFn.indexOf("unanswerableChoicesSendMessage");
    const apply = sendFn.indexOf("startOrApplyEventOrderTemplate");
    const create = sendFn.indexOf("createClientChoicesFromEventOrderTemplate");
    assert.ok(guard > 0, "Library Send must call the shared commercial guard");
    assert.ok(apply > guard, "apply must not run before a refused commercial check");
    assert.ok(create > guard, "packet create must not run before a refused commercial check");
    assert.ok(create > apply);
  });
});

describe("completed offerings can be sent successfully", () => {
  it("the shared send guard is silent once every offering is configured", () => {
    const template = markEveryOptionIncluded(newVenueUnconfiguredStarterTemplate());
    assert.equal(
      template.options.filter((o) => commercialState(o) === "not_configured").length,
      0,
    );
    assert.equal(
      unanswerableChoicesSendMessage(selectionDefinitionFromEventOrderTemplate(template)),
      null,
    );
  });

  it("successful Library Send still creates a packet and marks it sent", () => {
    const sendFn = source("lib/event-order-templates/use-send.ts").slice(
      source("lib/event-order-templates/use-send.ts").indexOf("export async function sendEventOrderTemplate"),
    );
    assert.ok(
      sendFn.indexOf("createClientChoicesFromEventOrderTemplate")
        < sendFn.indexOf("sendClientChoices"),
    );
    assert.match(sendFn, /choicesId: created\.choicesId/);
  });
});

describe("Path A does not finalize or share on failed validation", () => {
  it("sendEventOrderToCoupleAction checks the blocker before finalize and share", () => {
    const actions = source("app/(app)/events/[id]/event-order-actions.ts");
    const send = actions.slice(actions.indexOf("export async function sendEventOrderToCoupleAction"));
    const check = send.indexOf("eventOrderShareChoicesBlocker(eventId, order.templateId)");
    const finalize = send.indexOf("finalizeEventOrder(eventOrderId)");
    const share = send.indexOf("shareEventOrderWithClient(eventOrderId");
    assert.ok(check > 0 && finalize > check, "check must run before finalize");
    assert.ok(share > finalize, "share must run only after finalize");
    assert.match(send, /if \(blocked\) return \{ ok: false, message: blocked \}/);
  });

  it("prepareCoupleChoicesForEventOrderShare guards before creating a packet", () => {
    const service = source("lib/client-choices/service.ts");
    const share = service.slice(service.indexOf("export async function prepareCoupleChoicesForEventOrderShare"));
    const guard = share.indexOf("unanswerableSendMessage(definition)");
    const create = share.indexOf("createClientChoicesFromEventOrderTemplate(");
    assert.ok(guard > 0 && create > guard);
  });
});

describe("no unintended invoices, payments, bookings, or contracts", () => {
  it("Library Send and Path A send do not create invoices, payments, bookings, or contracts", () => {
    const send = source("lib/event-order-templates/use-send.ts");
    const sendFn = send.slice(send.indexOf("export async function sendEventOrderTemplate"));
    assert.doesNotMatch(sendFn, /createInvoice\(/);
    assert.doesNotMatch(sendFn, /createPayment/);
    assert.doesNotMatch(sendFn, /createContract/);
    assert.doesNotMatch(sendFn, /createBooking/);

    const actions = source("app/(app)/events/[id]/event-order-actions.ts");
    const pathA = actions.slice(actions.indexOf("export async function sendEventOrderToCoupleAction"));
    const pathAEnd = pathA.indexOf("export async function getEventOrderDocumentPreviewAction");
    const pathAFn = pathAEnd > 0 ? pathA.slice(0, pathAEnd) : pathA;
    assert.doesNotMatch(pathAFn, /createInvoice\(/);
    assert.doesNotMatch(pathAFn, /createPayment/);
    assert.doesNotMatch(pathAFn, /createContract/);
    assert.doesNotMatch(pathAFn, /createBooking/);
  });
});

describe("send UIs show grouped completeness guidance", () => {
  it("Library Send and Event Order send surfaces reuse EventOrderCompletenessGuidance", () => {
    const list = source("components/event-order-templates/event-order-template-list.tsx");
    const workflow = source("components/event-orders/event-commercial-workflow.tsx");
    const guidance = source("components/event-order-templates/event-order-completeness-guidance.tsx");
    const share = source("components/sharing/share-dialog.tsx");
    assert.match(guidance, /groupedCompletenessGuidance/);
    assert.match(guidance, /sectionEditorHref/);
    assert.match(guidance, /COMPLETENESS_CONFIGURE_OR_REMOVE/);
    assert.match(list, /eo-library-send-incomplete/);
    assert.match(list, /EventOrderCompletenessGuidance/);
    assert.match(workflow, /eo-event-order-send-incomplete/);
    assert.match(workflow, /eo-event-order-share-incomplete/);
    assert.match(share, /notice\?: React\.ReactNode/);
  });
});
