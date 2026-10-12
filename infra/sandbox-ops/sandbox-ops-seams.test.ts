import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

describe("sandbox ops early-warning seams", () => {
  it("ships usage canary + ops email fanout handlers and deploy script", () => {
    const root = resolve("infra/sandbox-ops");
    assert.equal(existsSync(resolve(root, "deploy-sandbox-ops.sh")), true);
    assert.equal(existsSync(resolve(root, "lambdas/resend_usage_canary/handler.py")), true);
    assert.equal(existsSync(resolve(root, "lambdas/ops_alert_email/handler.py")), true);
    const usage = readFileSync(resolve(root, "lambdas/resend_usage_canary/handler.py"), "utf8");
    assert.match(usage, /ResendMonthlyUsagePercent/);
    assert.match(usage, /ResendDailyUsagePercent/);
    assert.doesNotMatch(usage, /print\(api_key\)/);
    const email = readFileSync(resolve(root, "lambdas/ops_alert_email/handler.py"), "utf8");
    assert.match(email, /_persist_incident/);
    assert.match(email, /ops_incidents/);
    assert.match(email, /OpsAlertEmailSuccess/);
    assert.match(email, /OpsAlertEmailFailure/);
    assert.match(email, /jennifer@hellotocheers\.com/);
  });
});
