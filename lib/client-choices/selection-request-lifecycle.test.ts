/**
 * Selection-request send must not share/finalize/accept the Event Order.
 * Run: npx tsx --test lib/client-choices/selection-request-lifecycle.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const service = readFileSync(resolve("lib/client-choices/service.ts"), "utf8");
const coupleEmail = readFileSync(resolve("lib/client-choices/couple-email.ts"), "utf8");
const panel = readFileSync(resolve("components/client-choices/client-choices-panel.tsx"), "utf8");
const portalLink = readFileSync(resolve("lib/client-choices/choices-portal-link.ts"), "utf8");
const eoShare = readFileSync(resolve("lib/event-orders/representation.ts"), "utf8");

describe("selection-request lifecycle isolation", () => {
  it("sendClientChoicesRequest only portals + emails — never shares Event Order", () => {
    const fnStart = service.indexOf("export async function sendClientChoicesRequest");
    assert.ok(fnStart >= 0);
    const nextExport = service.indexOf("\nexport async function", fnStart + 10);
    const body = service.slice(fnStart, nextExport > 0 ? nextExport : undefined);
    assert.match(body, /sendClientChoices\(/);
    assert.match(body, /submitClientChoicesCoupleEmail/);
    assert.doesNotMatch(body, /shareEventOrderWithClient|setSharedAt|client_agreed|finalizeEventOrder|createInvoice/);
  });

  it("client-choices lib never imports Event Order share/finalize APIs", () => {
    assert.doesNotMatch(service, /shareEventOrderWithClient/);
    assert.doesNotMatch(service, /setSharedAt/);
    assert.doesNotMatch(coupleEmail, /shareEventOrderWithClient|setSharedAt|client_agreed/);
    assert.doesNotMatch(panel, /shareEventOrderWithClient/);
  });

  it("selection email uses choices deep link, not Event Order hash", () => {
    assert.match(portalLink, /view=choices#choices/);
    assert.match(coupleEmail, /choicesReviewUrl/);
    assert.doesNotMatch(coupleEmail, /#event-order/);
    assert.match(coupleEmail, /sourceType: "client_choices_request"/);
  });

  it("Event Order share remains a separate representation path", () => {
    assert.match(eoShare, /export async function shareEventOrderWithClient/);
    assert.match(eoShare, /setSharedAt/);
    assert.match(eoShare, /insertShareSnapshot/);
  });

  it("ShareDialog selection send wires sendClientChoicesRequestAction only", () => {
    assert.match(panel, /sendClientChoicesRequestAction/);
    assert.match(panel, /choices-send-selection-request/);
    assert.doesNotMatch(panel, /shareEventOrderWithClientAction|shareEventOrderAction/);
  });
});
