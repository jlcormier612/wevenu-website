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

  it("password reset uses generateLink hashed_token + password_recovery category", () => {
    const actions = read("app/(app)/team/auth-actions.ts");
    assert.match(actions, /generateLink/);
    assert.match(actions, /type:\s*"recovery"/);
    assert.match(actions, /hashed_token/);
    assert.match(actions, /workspacePasswordRecoveryUrl/);
    assert.match(actions, /category:\s*"password_recovery"/);
    assert.match(actions, /updatePasswordAfterWorkspaceRecoveryAction/);
    assert.doesNotMatch(actions, /properties\?\.action_link|data\.properties\.action_link/);
  });

  it("Dockerfile bakes NEXT_PUBLIC_SUPABASE_* for browser recovery verifyOtp", () => {
    const docker = read("../Dockerfile");
    assert.match(docker, /ARG NEXT_PUBLIC_SUPABASE_URL/);
    assert.match(docker, /ARG NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    assert.match(docker, /NEXT_PUBLIC_SUPABASE_URL=\$NEXT_PUBLIC_SUPABASE_URL/);
    assert.match(docker, /NEXT_PUBLIC_SUPABASE_ANON_KEY=\$NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
});
