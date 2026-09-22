/**
 * Compliance retry policy — rejected Twilio artifacts must not auto-loop.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TERMINAL_PROVISIONING_RETRY_AT,
  isTerminalProvisioningErrorCode,
  provisioningRetryAt,
  selectReusableTrustHubBundle,
} from "@/lib/texting-provisioning/compliance-retry-policy";

describe("terminal provisioning failures", () => {
  it("treats Brand FAILED / secondary rejected as terminal", () => {
    assert.equal(isTerminalProvisioningErrorCode("FAILED"), true);
    assert.equal(isTerminalProvisioningErrorCode("secondary_rejected"), true);
    assert.equal(isTerminalProvisioningErrorCode("secondary_rejected_only"), true);
    assert.equal(isTerminalProvisioningErrorCode("brand_rejected"), true);
    assert.equal(isTerminalProvisioningErrorCode("campaign_rejected"), true);
    assert.equal(isTerminalProvisioningErrorCode("waiting"), false);
  });

  it("does not schedule automatic retry for non-retryable failures", () => {
    const at = provisioningRetryAt(false, 3);
    assert.equal(at.toISOString(), TERMINAL_PROVISIONING_RETRY_AT.toISOString());
    assert.ok(at.getTime() > Date.now() + 365 * 24 * 60 * 60_000);
  });

  it("still backs off retryable waits", () => {
    const at = provisioningRetryAt(true, 1);
    assert.ok(at.getTime() < Date.now() + 60_000);
    assert.ok(at.getTime() > Date.now());
  });
});

describe("selectReusableTrustHubBundle", () => {
  it("reuses approved over rejected orphans", () => {
    const pick = selectReusableTrustHubBundle([
      { sid: "BUrejected", status: "twilio-rejected" },
      { sid: "BUapproved", status: "twilio-approved" },
    ]);
    assert.deepEqual(pick, {
      kind: "reuse",
      sid: "BUapproved",
      status: "twilio-approved",
    });
  });

  it("reuses in-review instead of creating a duplicate", () => {
    const pick = selectReusableTrustHubBundle([
      { sid: "BUpending", status: "pending-review" },
    ]);
    assert.equal(pick.kind, "reuse");
    if (pick.kind === "reuse") assert.equal(pick.sid, "BUpending");
  });

  it("signals rejected_only so callers stop automatic create/submit", () => {
    const pick = selectReusableTrustHubBundle([
      { sid: "BUrej1", status: "twilio-rejected" },
      { sid: "BUrej2", status: "twilio-rejected" },
    ]);
    assert.equal(pick.kind, "rejected_only");
    if (pick.kind === "rejected_only") {
      assert.deepEqual(pick.rejectedSids, ["BUrej1", "BUrej2"]);
    }
  });

  it("returns none when no bundles exist", () => {
    assert.deepEqual(selectReusableTrustHubBundle([]), { kind: "none" });
  });
});
