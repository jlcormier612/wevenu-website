import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  SKEW_RELOAD_COOLDOWN_MS,
  SKEW_RELOAD_STORAGE_KEY,
  clearSkewReloadGuard,
  consumeSkewReload,
  isLikelyDeploySkewError,
  markSkewReloadAttempted,
  shouldAttemptSkewReload,
  shouldAutoRecoverFromFatal,
} from "./client-skew-recovery.ts";

describe("client deploy-skew recovery", () => {
  it("classifies chunk / module / Server Action skew signatures", () => {
    assert.equal(isLikelyDeploySkewError(new Error("Loading chunk 123 failed")), true);
    assert.equal(
      isLikelyDeploySkewError(
        Object.assign(new Error("Loading chunk abc failed"), { name: "ChunkLoadError" }),
      ),
      true,
    );
    assert.equal(
      isLikelyDeploySkewError(
        new Error(
          'Failed to find Server Action "x". This request might be from an older or newer deployment.',
        ),
      ),
      true,
    );
    assert.equal(
      isLikelyDeploySkewError(new Error("The router state header was sent but could not be parsed")),
      true,
    );
    assert.equal(
      isLikelyDeploySkewError(new Error("Failed to fetch dynamically imported module: /_next/static/chunks/x.js")),
      true,
    );
    assert.equal(isLikelyDeploySkewError(new Error("Unexpected token '<'")), true);
    assert.equal(isLikelyDeploySkewError(new Error("Cannot read properties of undefined")), false);
  });

  it("auto-recovers skew signatures and digest-less client fatals, not server digests", () => {
    assert.equal(shouldAutoRecoverFromFatal(new Error("Loading chunk 1 failed")), true);
    assert.equal(shouldAutoRecoverFromFatal(new Error("random client crash")), true);
    assert.equal(
      shouldAutoRecoverFromFatal(
        Object.assign(new Error("server boom"), { digest: "ABC123" }),
      ),
      false,
    );
    assert.equal(
      shouldAutoRecoverFromFatal(
        Object.assign(new Error("x"), {
          digest: "Failed to find Server Action from an older or newer deployment",
        }),
      ),
      true,
    );
  });

  it("allows one reload per path then cools down", () => {
    const store = new Map<string, string>();
    const read = () => store.get(SKEW_RELOAD_STORAGE_KEY) ?? null;
    const write = (v: string) => {
      store.set(SKEW_RELOAD_STORAGE_KEY, v);
    };
    const remove = () => {
      store.delete(SKEW_RELOAD_STORAGE_KEY);
    };

    const path = "/clients/abc#playbook";
    const t0 = 1_000_000;
    assert.equal(shouldAttemptSkewReload(path, t0, read), true);
    markSkewReloadAttempted(path, t0, write);
    assert.equal(shouldAttemptSkewReload(path, t0 + 1_000, read), false);
    assert.equal(shouldAttemptSkewReload(path, t0 + SKEW_RELOAD_COOLDOWN_MS + 1, read), true);
    assert.equal(shouldAttemptSkewReload("/other", t0 + 1_000, read), true);

    clearSkewReloadGuard(remove);
    assert.equal(shouldAttemptSkewReload(path, t0 + 1_000, read), true);

    assert.equal(consumeSkewReload("/leads", t0 + 50_000, read, write), true);
    assert.equal(consumeSkewReload("/leads", t0 + 50_100, read, write), false);
  });
});

describe("deploy-skew recovery wiring", () => {
  it("mounts recovery in root layout and owns global + workspace error boundaries", () => {
    const layout = readFileSync(resolve("app/layout.tsx"), "utf8");
    const globalError = readFileSync(resolve("app/global-error.tsx"), "utf8");
    const workspaceError = readFileSync(resolve("app/(app)/error.tsx"), "utf8");
    const provider = readFileSync(
      resolve("components/providers/deploy-skew-recovery.tsx"),
      "utf8",
    );

    assert.match(layout, /DeploySkewRecovery/);
    assert.match(provider, /isLikelyDeploySkewError/);
    assert.match(provider, /consumeSkewReload/);
    assert.match(globalError, /shouldAutoRecoverFromFatal/);
    assert.match(globalError, /consumeSkewReload/);
    assert.match(globalError, /window\.location\.reload/);
    assert.match(workspaceError, /shouldAutoRecoverFromFatal/);
    assert.match(workspaceError, /window\.location\.reload/);
  });
});
