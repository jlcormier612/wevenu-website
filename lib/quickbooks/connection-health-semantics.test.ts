/**
 * Connection health must reflect real Intuit outcomes, not dependency waits,
 * and a later success must clear stale last_error text.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const processor = readFileSync(resolve("lib/quickbooks/processor.ts"), "utf8");
const repository = readFileSync(resolve("lib/quickbooks/repository.ts"), "utf8");
const settingsUi = readFileSync(resolve("components/settings/quickbooks-connect-section.tsx"), "utf8");

describe("QuickBooks connection health semantics", () => {
  it("dependency waits do not call recordHealthCheck", () => {
    const depBlock = processor.slice(
      processor.indexOf("const dependency = await checkDependency"),
      processor.indexOf("await repo.markDispatchStarted"),
    );
    assert.match(depBlock, /handleDependencyWait/);
    assert.doesNotMatch(depBlock, /recordHealthCheck/);
  });

  it("handleSuccess records healthy after a real sync", () => {
    const success = processor.slice(
      processor.indexOf("async function handleSuccess"),
      processor.indexOf("async function handleDependencyWait"),
    );
    assert.match(success, /recordHealthCheck\(item\.venue_id, true\)/);
  });

  it("recordHealthCheck clears last_error on ok and sets it on failure", () => {
    const fn = repository.slice(
      repository.indexOf("export async function recordHealthCheck"),
      repository.indexOf("export async function setDefaultItemId"),
    );
    assert.match(fn, /patch\.last_error = null/);
    assert.match(fn, /patch\.last_error = error/);
  });

  it("Settings only shows lastError when lastHealthCheckOk is false", () => {
    assert.match(
      settingsUi,
      /lastHealthCheckOk === false && connection\.lastError/,
    );
  });
});
