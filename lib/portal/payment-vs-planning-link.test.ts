import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const clientPage = readFileSync(resolve("app/(app)/clients/[id]/page.tsx"), "utf8");
const widget = readFileSync(resolve("components/portal/portal-link-widget.tsx"), "utf8");
const actions = readFileSync(resolve("app/(app)/clients/[id]/portal-actions.ts"), "utf8");

describe("payment link vs planning invite", () => {
  it("the client page never uses the invoice payment session as the couple's portal link", () => {
    assert.match(clientPage, /sessions\.find\(\(s\) => s\.accessLevel !== "financial"\) \?\? null;/);
    assert.doesNotMatch(clientPage, /accessLevel !== "financial"\) \?\? sessions\[0\]/);
  });

  it("the invite widget shows both rows, labelled", () => {
    assert.match(widget, /data-testid="client-access-planning-invite"/);
    assert.match(widget, /data-testid="client-access-payment-link"/);
    assert.match(widget, /opens Invoice &amp; Payment Plan only, not the planning workspace/);
  });

  it("the payment link status never returns its token", () => {
    const fn = actions.slice(actions.indexOf("export async function getPaymentLinkStatusAction"));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    assert.match(body, /accessLevel === "financial"/);
    assert.doesNotMatch(body, /accessToken/);
  });
});
