/**
 * CRM login brand mark + password recovery routes (source contract).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("CRM login brand + recovery", () => {
  it("login page shows official HTC logo and forgot-password link", () => {
    const src = read("app/login/page.tsx");
    assert.match(src, /ActivationBrandMark/);
    assert.match(src, /href="\/login\/forgot"/);
    assert.match(src, /Forgot password\?/);
    assert.doesNotMatch(src, /ws-eyebrow">Hello to Cheers</);
  });

  it("forgot and reset routes exist with brand mark", () => {
    const forgot = read("app/login/forgot/page.tsx");
    const reset = read("app/login/reset/page.tsx");
    assert.match(forgot, /ActivationBrandMark/);
    assert.match(forgot, /ForgotPasswordForm/);
    assert.match(reset, /ActivationBrandMark/);
    assert.match(reset, /ResetPasswordForm/);
  });

  it("password reset uses generateLink + password_recovery category", () => {
    const actions = read("app/(app)/team/auth-actions.ts");
    assert.match(actions, /generateLink/);
    assert.match(actions, /type:\s*"recovery"/);
    assert.match(actions, /category:\s*"password_recovery"/);
    assert.match(actions, /updatePasswordAfterWorkspaceRecoveryAction/);
    assert.match(actions, /workspaceBaseUrl\(\)[^;]*\/login\/reset/);
    assert.match(actions, /const redirectTo = /);
  });
});
