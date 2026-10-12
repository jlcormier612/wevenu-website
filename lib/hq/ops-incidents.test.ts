import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { classifyOpsAlarm } from "@/lib/hq/ops-incidents";

describe("classifyOpsAlarm", () => {
  it("maps infrastructure and supabase to critical", () => {
    assert.equal(classifyOpsAlarm("htc-sandbox-health-supabase-down").severity, "critical");
    assert.equal(classifyOpsAlarm("htc-sandbox-venue-unhealthy-hosts").severity, "critical");
    assert.equal(classifyOpsAlarm("htc-sandbox-supabase-restriction-signal").severity, "critical");
  });

  it("maps Resend usage to warning and canary/email path to high", () => {
    assert.equal(classifyOpsAlarm("htc-sandbox-resend-monthly-usage-high").severity, "warning");
    assert.equal(classifyOpsAlarm("htc-sandbox-resend-daily-usage-high").severity, "warning");
    assert.equal(classifyOpsAlarm("htc-sandbox-resend-usage-canary-down").severity, "high");
    assert.equal(classifyOpsAlarm("htc-sandbox-ops-alert-email-failures").severity, "high");
  });
});

describe("ops alerts surface wiring", () => {
  it("HQ shell exposes Ops Alerts with active badge", () => {
    const shell = readFileSync(resolve(process.cwd(), "components/hq/hq-shell.tsx"), "utf8");
    assert.match(shell, /\/admin\/ops-alerts/);
    assert.match(shell, /ops-alerts-nav-badge/);
    assert.match(shell, /countActiveOpsIncidents/);
  });

  it("migration gates ops_incidents to is_hq_admin", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20261415200000_ops_incidents_hq.sql"),
      "utf8",
    );
    assert.match(sql, /create table if not exists public\.ops_incidents/);
    assert.match(sql, /is_hq_admin\(\)/);
    assert.match(sql, /acknowledge_ops_incident/);
    assert.match(sql, /ops_notification_attempts/);
  });

  it("Lambda persists incidents independently of email", () => {
    const py = readFileSync(
      resolve(process.cwd(), "infra/sandbox-ops/lambdas/ops_alert_email/handler.py"),
      "utf8",
    );
    assert.match(py, /_persist_incident/);
    assert.match(py, /_should_email/);
    assert.match(py, /OpsIncidentPersistFailure/);
    assert.match(py, /ops_incidents/);
  });
});
