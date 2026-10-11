import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  FORGOT_PASSWORD_PATH,
  PASSWORD_RECOVERY_SUCCESS_COPY,
  PASSWORD_RESET_PATH,
  passwordRecoveryRedirectTo,
  safePasswordRecoveryNextPath,
  validateNewPassword,
} from "./password-recovery.ts";

describe("password recovery helpers", () => {
  it("keeps success copy account-enumeration safe", () => {
    assert.match(PASSWORD_RECOVERY_SUCCESS_COPY, /If an account exists/i);
    assert.doesNotMatch(PASSWORD_RECOVERY_SUCCESS_COPY, /sent to your account/i);
  });

  it("only allows /reset-password as recovery next", () => {
    assert.equal(safePasswordRecoveryNextPath("/reset-password"), PASSWORD_RESET_PATH);
    assert.equal(safePasswordRecoveryNextPath("/dashboard"), PASSWORD_RESET_PATH);
    assert.equal(safePasswordRecoveryNextPath("https://evil.example"), PASSWORD_RESET_PATH);
    assert.equal(safePasswordRecoveryNextPath(null), PASSWORD_RESET_PATH);
  });

  it("validates new passwords", () => {
    assert.equal(validateNewPassword("short", "short"), "Password must be at least 8 characters.");
    assert.equal(validateNewPassword("longenough", "different"), "Passwords do not match.");
    assert.equal(validateNewPassword("longenough", "longenough"), null);
  });

  it("builds Sandbox confirm redirect on the allowlisted http host", () => {
    const prior = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";
    try {
      assert.equal(
        passwordRecoveryRedirectTo(),
        "http://app.sandbox.hellotocheers.com/auth/confirm?next=%2Freset-password",
      );
    } finally {
      if (prior === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prior;
    }
  });

  it("wires forgot-password link, confirm route, and public paths", () => {
    const loginForm = readFileSync("components/auth/login-form.tsx", "utf8");
    const proxy = readFileSync("integrations/supabase/proxy.ts", "utf8");
    const confirm = readFileSync("app/auth/confirm/route.ts", "utf8");
    const actions = readFileSync("app/auth/actions.ts", "utf8");
    assert.match(loginForm, /Forgot password\?/);
    assert.match(loginForm, new RegExp(FORGOT_PASSWORD_PATH.replace("/", "\\/")));
    assert.match(proxy, /"\/forgot-password"/);
    assert.match(proxy, /"\/reset-password"/);
    assert.match(proxy, /"\/auth\/confirm"/);
    assert.match(confirm, /exchangeCodeForSession|verifyOtp/);
    assert.match(confirm, /publicAppOrigin/);
    assert.match(actions, /resetPasswordForEmail/);
    assert.match(actions, /passwordRecoveryRedirectTo/);
    assert.equal(PASSWORD_RESET_PATH, "/reset-password");
  });
});
