import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

const prevStore = process.env.HTC_CRM_STORE;
const prevEnv = process.env.HTC_ENVIRONMENT;
const prevData = process.env.WORKSPACE_DATA_PATH;
const dataDir = mkdtempSync(join(tmpdir(), "htc-program3-durable-"));

before(() => {
  process.env.HTC_CRM_STORE = "file";
  delete process.env.HTC_ENVIRONMENT;
  process.env.WORKSPACE_DATA_PATH = dataDir;
});

after(() => {
  if (prevStore === undefined) delete process.env.HTC_CRM_STORE;
  else process.env.HTC_CRM_STORE = prevStore;
  if (prevEnv === undefined) delete process.env.HTC_ENVIRONMENT;
  else process.env.HTC_ENVIRONMENT = prevEnv;
  if (prevData === undefined) delete process.env.WORKSPACE_DATA_PATH;
  else process.env.WORKSPACE_DATA_PATH = prevData;
  rmSync(dataDir, { recursive: true, force: true });
});

describe("Program 3 durable file seed defaults", () => {
  it("seeds workflows inactive and persists founder enable across ensure", async () => {
    const store = await import("./store");
    await store.ensureProgram3Data();
    const workflows = store.getWorkflowsSync();
    assert.ok(workflows.length > 0);
    assert.equal(
      workflows.every((w) => w.active === false),
      true,
      "seed workflows must be inactive until founder enables",
    );

    const target = workflows.find((w) => w.id === "wf_inquiry_welcome");
    assert.ok(target);
    await store.upsertWorkflow({ ...target, active: true });
    await store.ensureProgram3Data();
    const again = store.getWorkflowSync("wf_inquiry_welcome");
    assert.equal(again?.active, true);
  });
});
