import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const notify = readFileSync(resolve("lib/client-choices/finalize-notify.ts"), "utf8");
const service = readFileSync(resolve("lib/client-choices/service.ts"), "utf8");

describe("Client Choices finalize notifications", () => {
  it("notify helper emails and creates portal notification", () => {
    assert.match(notify, /notifyClientChoicesFinalized/);
    assert.match(notify, /createCoupleNotification/);
    assert.match(notify, /sendEmail/);
    assert.match(notify, /client_choices_finalized/);
    assert.match(notify, /choicesReviewUrl/);
  });

  it("finalizeClientChoices notifies after persist without rolling back", () => {
    const start = service.indexOf("export async function finalizeClientChoices");
    const end = service.indexOf("export async function", start + 10);
    const body = service.slice(start, end > start ? end : undefined);
    // The shared apply engine persists status finalized; finalize notifies after it returns.
    const core = readFileSync(resolve("lib/client-choices/apply-core.ts"), "utf8");
    assert.match(core, /status: "finalized"/);
    assert.match(body, /notifyClientChoicesFinalized/);
    assert.match(body, /finalized state already persisted/);
    const notifyAt = body.indexOf("notifyClientChoicesFinalized");
    const persistAt = body.indexOf("await applyChoicesToEventOrder(");
    const bailAt = body.indexOf("if (!applied.ok) return applied;");
    assert.ok(persistAt >= 0 && notifyAt > persistAt, "notify must follow finalized persist");
    assert.ok(bailAt > persistAt && bailAt < notifyAt, "a failed apply must not notify");
  });
});
