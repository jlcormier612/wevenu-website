import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const service = readFileSync(resolve("lib/client-choices/service.ts"), "utf8");
const panel = readFileSync(resolve("components/event-order-templates/package-choices-panel.tsx"), "utf8");

describe("required choice groups need options before the couple sees them", () => {
  it("sendClientChoices refuses before marking the packet sent", () => {
    const send = service.slice(service.indexOf("export async function sendClientChoices"));
    const guard = send.indexOf("unanswerableRequiredGroupMessage(row.definition)");
    const flip = send.indexOf('status: "sent"');
    assert.ok(guard > 0 && flip > guard, "guard must run before the sent transition");
  });

  it("the Event Order share path goes through sendClientChoices", () => {
    const share = service.slice(service.indexOf("export async function prepareCoupleChoicesForEventOrderShare"));
    assert.match(share, /sendClientChoices\(/);
  });

  it("the template builder warns on the top choice set as well as categories", () => {
    assert.match(panel, /impossibleSelectionGroupMessage\(set\.group, set\.options\.length\)/);
    assert.match(panel, /eo-choice-set-impossible-/);
    assert.match(panel, /eo-child-group-impossible-/);
  });
});
