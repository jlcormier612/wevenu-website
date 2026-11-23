import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

describe("CRM notification dismissals (per actor)", () => {
  let dir: string;
  let prev: string | undefined;

  before(() => {
    dir = mkdtempSync(path.join(tmpdir(), "ws-notif-dismiss-"));
    prev = process.env.WORKSPACE_DATA_PATH;
    process.env.WORKSPACE_DATA_PATH = dir;
  });

  after(() => {
    if (prev === undefined) delete process.env.WORKSPACE_DATA_PATH;
    else process.env.WORKSPACE_DATA_PATH = prev;
    rmSync(dir, { recursive: true, force: true });
  });

  it("scopes dismissals to the acting team member and is idempotent", async () => {
    // Resolve relative imports (tsx path aliases need workspace cwd).
    process.chdir(path.join(__dirname, "../.."));
    const mod = await import(`./dismissals.ts?t=${Date.now()}`);
    const a = await mod.dismissNotifications({
      notificationIds: ["n1", "n2"],
      actorId: "tm_jen",
    });
    assert.equal(a.dismissed, 2);

    const again = await mod.dismissNotifications({
      notificationIds: ["n1"],
      actorId: "tm_jen",
    });
    assert.equal(again.dismissed, 0);

    await mod.dismissNotifications({
      notificationIds: ["n1"],
      actorId: "tm_other",
    });

    const jen = mod.getDismissedNotificationIdsSync("tm_jen");
    const other = mod.getDismissedNotificationIdsSync("tm_other");
    assert.equal(jen.has("n1"), true);
    assert.equal(jen.has("n2"), true);
    assert.equal(other.has("n1"), true);
    assert.equal(other.has("n2"), false);
  });
});
