/**
 * Static safety validation for the Sandbox texting provisioning inspector.
 * Does not connect to a database and does not invent live inventory results.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const scriptPath = join(root, "scripts/inspect-sandbox-texting-provisioning.sh");
const workflowPath = join(
  root,
  ".github/workflows/inspect-sandbox-texting-provisioning.yml",
);
const deployPath = join(root, ".github/workflows/deploy-sandbox.yml");

const script = readFileSync(scriptPath, "utf8");
const workflow = readFileSync(workflowPath, "utf8");
const deploy = readFileSync(deployPath, "utf8");

describe("inspect-sandbox-texting-provisioning script safety", () => {
  it("uses an explicit READ ONLY transaction and rolls back", () => {
    assert.match(script, /BEGIN READ ONLY;/);
    assert.match(script, /ROLLBACK;/);
    assert.doesNotMatch(script, /\bCOMMIT\b/);
  });

  it("contains no DML/DDL mutation verbs outside comments", () => {
    const body = script
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");
    // Allow READ ONLY / ROLLBACK only — no INSERT/UPDATE/DELETE/TRUNCATE/CREATE/DROP/ALTER/GRANT.
    assert.doesNotMatch(body, /\bINSERT\b/i);
    assert.doesNotMatch(body, /\bUPDATE\b/i);
    assert.doesNotMatch(body, /\bDELETE\b/i);
    assert.doesNotMatch(body, /\bTRUNCATE\b/i);
    assert.doesNotMatch(body, /\bCREATE\b/i);
    assert.doesNotMatch(body, /\bDROP\b/i);
    assert.doesNotMatch(body, /\bALTER\b/i);
    assert.doesNotMatch(body, /\bGRANT\b/i);
    assert.doesNotMatch(body, /\bCOPY\b/i);
  });

  it("never prints the connection string or Twilio credentials", () => {
    assert.doesNotMatch(script, /echo "\$CONN"/);
    assert.doesNotMatch(script, /echo "\$SANDBOX_DB_URL"/);
    assert.doesNotMatch(script, /auth_token|api_key_secret|TWILIO_AUTH/i);
  });

  it("does not call Twilio, curl, or app provisioning endpoints", () => {
    const code = script
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");
    assert.doesNotMatch(code, /\bcurl\b/i);
    assert.doesNotMatch(code, /twilio\.com/i);
    assert.doesNotMatch(code, /\/api\/texting\/provision/);
    assert.doesNotMatch(code, /processVenueTextingProvisioning/);
    assert.doesNotMatch(code, /processTextingProvisioningQueue/);
  });

  it("does not print full last_error_message bodies", () => {
    assert.doesNotMatch(script, /s\.last_error_message/);
    assert.doesNotMatch(script, /last_error_message,/);
  });

  it("encodes protected venue IDs and mutation steps from b40b4e48", () => {
    assert.match(script, /0149e0d4-3cd9-459a-a9a2-6c5e2b30869e/);
    assert.match(script, /a415ac52-cd74-42a6-8df7-7a8f6e71d080/);
    assert.match(script, /buy_number/);
    assert.match(script, /attach_number/);
    assert.match(script, /configure_event_streams/);
    assert.match(script, /claim_limit_per_tick=8/);
    assert.match(script, /max_steps_advanced_per_venue_per_tick=4/);
    assert.match(script, /potential_twilio_mutation_if_claimed/);
    assert.match(
      script,
      /uncertain_ensureProvisioningSteps_may_add_mutation_step/,
    );
  });

  it("mirrors terminal claim exclusions from claimDueProvisioningVenueIds", () => {
    for (const code of [
      "FAILED",
      "SUSPENDED",
      "REJECTED",
      "twilio-rejected",
      "noncompliant",
      "brand_rejected",
      "campaign_rejected",
      "secondary_rejected",
      "secondary_rejected_only",
      "trust_product_rejected",
      "details_needed",
    ]) {
      assert.match(script, new RegExp(code));
    }
  });
});

describe("inspect-sandbox-texting-provisioning workflow safety", () => {
  it("is workflow_dispatch only", () => {
    assert.match(workflow, /workflow_dispatch:\s*\{\}/);
    assert.doesNotMatch(workflow, /^\s*push:/m);
    assert.doesNotMatch(workflow, /^\s*pull_request:/m);
    assert.doesNotMatch(workflow, /^\s*schedule:/m);
  });

  it("uses contents:read, sandbox environment, and SANDBOX_DB_URL secret", () => {
    assert.match(workflow, /contents:\s*read/);
    assert.match(workflow, /environment:\s*sandbox/);
    assert.match(workflow, /secrets\.SANDBOX_DB_URL/);
    assert.match(workflow, /group:\s*sandbox-database/);
    assert.match(workflow, /cancel-in-progress:\s*false/);
  });

  it("invokes the inspect script and does not deploy", () => {
    assert.match(
      workflow,
      /scripts\/inspect-sandbox-texting-provisioning\.sh/,
    );
    assert.doesNotMatch(workflow, /deploy-sandbox|ecs|cloudformation|docker/i);
  });

  it("does not alter the Deploy Sandbox workflow", () => {
    assert.doesNotMatch(deploy, /inspect-sandbox-texting-provisioning/);
    assert.match(deploy, /name: Deploy Sandbox/);
  });
});
