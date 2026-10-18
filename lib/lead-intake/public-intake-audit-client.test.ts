/**
 * Public intake must log with the admin client.
 *
 * Sandbox evidence: POST /api/public/inquire and /api/public/forms/submit
 * created the lead, then logIntakeAttempt failed with RLS 42501 because
 * the visitor session cannot insert lead_intake_attempts. Rate limiting,
 * sequence enrollment, and notification status never ran. Tour booking
 * and email intake already pass the admin client.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function route(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

describe("public intake audit client", () => {
  it("logs website inquiries with the admin client and still creates through the embed-key RPC", () => {
    const source = route("app/api/public/inquire/route.ts");
    assert.match(source, /const admin = createAdminClient\(\)/);
    assert.match(source, /ingestLead\(\{[\s\S]*?supabase:\s*admin/);
    assert.match(source, /supabase\.rpc\("create_public_lead"/);
    assert.doesNotMatch(source, /recordNotificationStatus\(supabase/);
    assert.match(source, /recordNotificationStatus\(admin, outcome\.attemptId, result\.ok \? "sent" : "failed", "inquirer"\)/);
    assert.match(source, /recordNotificationStatus\(admin, outcome\.attemptId, result\.ok \? "sent" : "failed", "venue"\)/);
    assert.doesNotMatch(source, /recordNotificationStatus\(admin, outcome\.attemptId, result\.ok \? "sent" : "failed"\)/);
  });

  it("logs public library forms with the admin client and still creates through the public-key RPC", () => {
    const source = route("app/api/public/forms/submit/route.ts");
    assert.match(source, /ingestLead\(\{[\s\S]*?supabase:\s*admin/);
    assert.match(source, /supabase\.rpc\("create_public_form_lead"/);
    assert.doesNotMatch(source, /recordNotificationStatus\(supabase/);
    assert.match(source, /recordNotificationStatus\(admin, outcome\.attemptId, result\.ok \? "sent" : "failed", "inquirer"\)/);
    assert.match(source, /recordNotificationStatus\(admin, outcome\.attemptId, result\.ok \? "sent" : "failed", "venue"\)/);
  });
});
