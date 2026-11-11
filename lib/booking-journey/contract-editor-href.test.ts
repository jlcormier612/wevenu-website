import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { contractEditorHref } from "@/lib/booking-journey/model";

describe("Create contract opens reliably when the client already exists", () => {
  it("builds a native editor URL from the accepted selection and client", () => {
    const href = contractEditorHref({
      selectionId: "83e65db6-1275-4b77-93c6-da53c366bbdc",
      clientId: "9b7a3923-5d8b-492c-bd3d-318d1fafaef9",
      leadId: "32c524e8-8947-456a-a009-5b900e1c7419",
    });
    assert.equal(
      href,
      "/contracts/new?selectionId=83e65db6-1275-4b77-93c6-da53c366bbdc&clientId=9b7a3923-5d8b-492c-bd3d-318d1fafaef9&leadId=32c524e8-8947-456a-a009-5b900e1c7419",
    );
  });

  it("returns null when a client must still be created, so the action path remains", () => {
    assert.equal(contractEditorHref({ selectionId: "sel", clientId: null }), null);
    assert.equal(contractEditorHref({ selectionId: "sel", clientId: "  " }), null);
  });

  it("renders a link instead of a transition when the href is known", () => {
    const facts = readFileSync(resolve("components/booking-journey/commercial-facts.tsx"), "utf8");
    assert.match(facts, /contractHref \?/);
    assert.match(facts, /render=\{<Link href=\{contractHref\} \/>\}/);
    assert.match(facts, /data-testid="create-contract"/);
    assert.match(facts, /\{contractPending \? "Preparing…" : "Create contract"\}/);
  });

  it("does not refresh the current lead before navigating, and pending is local", () => {
    const actions = readFileSync(resolve("app/(app)/booking-journey/actions.ts"), "utf8");
    const prepare = actions.slice(
      actions.indexOf("export async function prepareCreateContractAction"),
      actions.indexOf("export async function sendOfferAction"),
    );
    assert.doesNotMatch(prepare, /revalidatePath/);
    assert.match(prepare, /window is not refreshed|Do not revalidate the current Lead/);

    const panel = readFileSync(resolve("components/booking-journey/booking-journey-panel.tsx"), "utf8");
    const handler = panel.slice(
      panel.indexOf("function handleCreateContract"),
      panel.indexOf("function copyShareLink"),
    );
    assert.match(handler, /setContractBusy\(true\)/);
    assert.doesNotMatch(handler, /startTransition/);
    assert.match(handler, /window\.location\.assign\(result\.href\)/);
    assert.match(panel, /contractEditorHref/);
  });

  it("opening the editor route does not insert a contract", () => {
    const page = readFileSync(resolve("app/(app)/contracts/new/page.tsx"), "utf8");
    assert.doesNotMatch(page, /\.insert\(/);
    assert.doesNotMatch(page, /createContract\(/);
  });
});
