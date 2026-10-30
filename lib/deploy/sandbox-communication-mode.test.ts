import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

/**
 * Sandbox email safety. The venue app sends real email unless
 * COMMUNICATION_MODE says otherwise, and every deploy registers a new task
 * revision from infra/htc-ecs-stack.json. Revisions registered without the
 * variable emailed the staff inbox on the next notification cron.
 */
type Param = { Default?: unknown; AllowedValues?: string[] };
type EnvEntry = { Name: string; Value: unknown };
type Container = { Environment?: EnvEntry[]; Secrets?: Array<{ Name: string }> };

const stack = JSON.parse(readFileSync(resolve("infra/htc-ecs-stack.json"), "utf8")) as {
  Parameters: Record<string, Param>;
  Resources: Record<string, { Properties: { ContainerDefinitions?: Container[] } }>;
};
const workflow = readFileSync(resolve(".github/workflows/deploy-sandbox.yml"), "utf8");

const changeSetBlock = workflow.slice(
  workflow.indexOf("aws cloudformation create-change-set"),
  workflow.indexOf("for _ in $(seq 1 40)"),
);
const deployBlock = workflow.slice(
  workflow.indexOf("aws cloudformation deploy"),
  workflow.indexOf("--no-fail-on-empty-changeset"),
);
const verifyJob = workflow.slice(workflow.indexOf("\n  verify:"));

function container(logicalId: string): Container {
  return stack.Resources[logicalId].Properties.ContainerDefinitions![0];
}

describe("Sandbox COMMUNICATION_MODE", () => {
  it("is a required stack parameter with no default", () => {
    const param = stack.Parameters.CommunicationMode;
    assert.ok(param, "CommunicationMode parameter exists");
    assert.equal("Default" in param, false, "no default, so an omitted value fails the deploy");
    assert.deepEqual([...(param.AllowedValues ?? [])].sort(), ["disabled", "real", "sandbox"]);
  });

  it("sets the venue-app task environment from the parameter, once", () => {
    const venue = container("VenueAppTaskDefinition");
    const entries = (venue.Environment ?? []).filter((e) => e.Name === "COMMUNICATION_MODE");
    assert.deepEqual(entries, [{ Name: "COMMUNICATION_MODE", Value: { Ref: "CommunicationMode" } }]);
    assert.equal((venue.Secrets ?? []).some((s) => s.Name === "COMMUNICATION_MODE"), false);
  });

  it("leaves the existing venue-app environment and secrets intact", () => {
    const venue = container("VenueAppTaskDefinition");
    const names = (venue.Environment ?? []).map((e) => e.Name);
    assert.deepEqual(names, [
      "NODE_ENV", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY", "FROM_EMAIL", "RESEND_INBOUND_ADDRESS",
      "QUICKBOOKS_ENVIRONMENT", "NEXT_DEPLOYMENT_ID", "CRON_SECRET", "NOTIFICATIONS_SECRET",
      "NEXT_PUBLIC_APP_URL", "COMMUNICATION_MODE",
    ]);
    assert.ok((venue.Secrets ?? []).some((s) => s.Name === "RESEND_API_KEY"));
  });

  it("passes real on both Sandbox deploy paths", () => {
    assert.match(changeSetBlock, /"ParameterKey=CommunicationMode,ParameterValue=real"/);
    assert.match(deployBlock, /^\s*CommunicationMode=real \\$/m);
    const deployJob = workflow.slice(workflow.indexOf("\n  deploy:"), workflow.indexOf("\n  verify:"));
    assert.equal((deployJob.match(/CommunicationMode/g) ?? []).length, 2, "no other value is passed anywhere");
  });

  it("passes every parameter that has no default on both deploy paths", () => {
    const required = Object.entries(stack.Parameters)
      .filter(([, p]) => !("Default" in p))
      .map(([name]) => name);
    assert.ok(required.includes("CommunicationMode"));
    for (const name of required) {
      assert.match(changeSetBlock, new RegExp(`"ParameterKey=${name},ParameterValue=`), `change set passes ${name}`);
      assert.match(deployBlock, new RegExp(`^\\s*${name}=`, "m"), `deploy fallback passes ${name}`);
    }
  });

  it("fails the deploy run unless the running venue-app revision sends real email", () => {
    const stable = verifyJob.indexOf("aws ecs wait services-stable");
    const step = verifyJob.indexOf("- name: Verify venue-app email mode is real");
    assert.ok(stable > 0 && step > stable, "check runs after services stabilize");
    const body = verifyJob.slice(step, verifyJob.indexOf("- name: Verify ALB endpoints"));
    assert.match(body, /ParameterKey=='CommunicationMode'/);
    assert.match(body, /"\$mode" != "real"/);
    assert.match(body, /"Name": "COMMUNICATION_MODE", "Value": \{"Ref": "CommunicationMode"\}/);
    assert.match(body, /LogicalResourceId=='VenueAppTaskDefinition'/);
    assert.doesNotMatch(body, /\| \[0\]\.PhysicalResourceId/, "per-page --query indexing returns stale revisions");
    assert.match(body, /ResourceStatus=='UPDATE_COMPLETE'/, "replaced revisions are reported as UPDATE_COMPLETE");
    assert.match(body, /"\$svc_td" != "\$stack_td"/);
    assert.match(body, /"\$dep_td" != "\$svc_td"/);
    assert.match(body, /"\$dep_state" != "COMPLETED"/);
    assert.match(body, /"\$dep_running" != "\$dep_desired"/);
    assert.doesNotMatch(body, /aws ecs (list-tasks|describe-task-definition)/, "the deploy role is not granted these");
    assert.equal((body.match(/exit 1/g) ?? []).length >= 4, true);
  });
});
