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
    assert.equal(
      safePasswordRecoveryNextPath("/reset-password?audience=client"),
      "/reset-password?audience=client",
    );
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
      assert.equal(
        passwordRecoveryRedirectTo("client"),
        "http://app.sandbox.hellotocheers.com/auth/confirm?next=%2Freset-password%3Faudience%3Dclient",
      );
    } finally {
      if (prior === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prior;
    }
  });

  it("wires forgot-password link, confirm client callback, and public paths", () => {
    const loginForm = readFileSync("components/auth/login-form.tsx", "utf8");
    const clientLogin = readFileSync("app/client/login/login-form.tsx", "utf8");
    const vendorLogin = readFileSync("app/vendor/login/login-form.tsx", "utf8");
    const proxy = readFileSync("integrations/supabase/proxy.ts", "utf8");
    const confirmPage = readFileSync("app/auth/confirm/page.tsx", "utf8");
    const confirmClient = readFileSync("components/auth/auth-confirm-client.tsx", "utf8");
    const actions = readFileSync("app/auth/actions.ts", "utf8");
    const sendPath = readFileSync("lib/auth/send-password-recovery-email.ts", "utf8");
    assert.match(loginForm, /Forgot password\?/);
    assert.match(loginForm, new RegExp(FORGOT_PASSWORD_PATH.replace("/", "\\/")));
    assert.match(clientLogin, /Forgot password\?/);
    assert.match(clientLogin, /audience=client/);
    assert.match(vendorLogin, /Forgot password\?/);
    assert.match(vendorLogin, /audience=vendor/);
    assert.match(proxy, /"\/forgot-password"/);
    assert.match(proxy, /"\/reset-password"/);
    assert.match(proxy, /"\/auth\/confirm"/);
    assert.match(confirmPage, /AuthConfirmClient/);
    assert.match(confirmClient, /setSession/);
    assert.match(confirmClient, /exchangeCodeForSession/);
    assert.match(confirmClient, /verifyOtp/);
    assert.match(actions, /sendBrandedPasswordRecoveryEmail/);
    assert.match(sendPath, /generateLink/);
    assert.match(sendPath, /click_tracking:\s*false/);
    assert.match(sendPath, /PASSWORD_RECOVERY_EMAIL_SUBJECT/);
    assert.equal(PASSWORD_RESET_PATH, "/reset-password");
  });
});

describe("password recovery branded email", () => {
  it("uses HTC subject, logo, CTA, and safe ignore copy", async () => {
    const {
      PASSWORD_RECOVERY_EMAIL_SUBJECT,
      buildPasswordRecoveryEmailHtml,
      buildPasswordRecoveryEmailText,
    } = await import("./password-recovery-email.ts");
    const url = "https://example.test/auth/v1/verify?token=redacted&type=recovery&redirect_to=http%3A%2F%2Fapp.sandbox.hellotocheers.com%2Fauth%2Fconfirm";
    const html = buildPasswordRecoveryEmailHtml(url);
    const text = buildPasswordRecoveryEmailText(url);
    assert.equal(PASSWORD_RECOVERY_EMAIL_SUBJECT, "Reset your Hello to Cheers password");
    assert.match(html, /Reset your Hello to Cheers password/);
    assert.match(html, /Reset password/);
    assert.match(html, /hello-to-cheers-logo/);
    assert.match(html, /If you didn’t request a password reset/);
    assert.doesNotMatch(html, /Supabase/i);
    assert.match(text, /Reset your Hello to Cheers password/);
    assert.match(text, /If you didn’t request a password reset/);
    assert.doesNotMatch(text, /Supabase/i);
  });
});

