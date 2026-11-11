import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const service = readFileSync(resolve("lib/client-choices/service.ts"), "utf8");
const panel = readFileSync(resolve("components/event-order-templates/package-choices-panel.tsx"), "utf8");

describe("required choice groups need options before the couple sees them", () => {
  it("sendClientChoices refuses before marking the packet sent", () => {
    const send = service.slice(service.indexOf("export async function sendClientChoices"));
    const guard = send.indexOf("unanswerableSendMessage(row.definition)");
    const flip = send.indexOf('status: "sent"');
    assert.ok(guard > 0 && flip > guard, "guard must run before the sent transition");
  });

  it("the Event Order share path goes through sendClientChoices", () => {
    const share = service.slice(service.indexOf("export async function prepareCoupleChoicesForEventOrderShare"));
    assert.match(share, /sendClientChoices\(/);
  });

  it("Send to couple checks before locking the Event Order, so a refusal leaves it open", () => {
    const actions = readFileSync(resolve("app/(app)/events/[id]/event-order-actions.ts"), "utf8");
    const send = actions.slice(actions.indexOf("export async function sendEventOrderToCoupleAction"));
    const check = send.indexOf("eventOrderShareChoicesBlocker(eventId, order.templateId)");
    const finalize = send.indexOf("finalizeEventOrder(eventOrderId)");
    assert.ok(check > 0 && finalize > check, "check must run before finalize");
  });

  it("no choices packet is created from a template that would be refused", () => {
    const share = service.slice(service.indexOf("export async function prepareCoupleChoicesForEventOrderShare"));
    const guard = share.indexOf("unanswerableSendMessage(definition)");
    const create = share.indexOf("createClientChoicesFromEventOrderTemplate(");
    assert.ok(guard > 0 && create > guard);
  });

  it("the template builder warns on the top choice set as well as categories", () => {
    assert.match(panel, /impossibleSelectionGroupMessage\(set\.group, set\.options\.length\)/);
    assert.match(panel, /eo-choice-set-impossible-/);
    assert.match(panel, /eo-child-group-impossible-/);
  });
});
