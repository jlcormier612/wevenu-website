import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PASSWORD_RECOVERY_EMAIL_SUBJECT,
  buildPasswordRecoveryEmailHtml,
} from "./password-recovery-email";
import { htcLogoAbsoluteUrl } from "../brand/logo";

describe("shared password recovery email branding", () => {
  it("includes the official HTC logo absolute URL", () => {
    process.env.HTC_ENVIRONMENT = "production";
    delete process.env.NEXT_PUBLIC_MARKETING_URL;
    delete process.env.MARKETING_URL;
    const html = buildPasswordRecoveryEmailHtml(
      "https://workspace.hellotocheers.com/login/reset?token_hash=abc&type=recovery",
    );
    assert.match(html, /hello-to-cheers-logo-primary-transparent\.png/);
    assert.match(html, /https:\/\/hellotocheers\.com\/brand\//);
    assert.match(html, /Reset password/);
    assert.match(html, new RegExp(PASSWORD_RECOVERY_EMAIL_SUBJECT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(
      htcLogoAbsoluteUrl(),
      "https://hellotocheers.com/brand/hello-to-cheers-logo-primary-transparent.png",
    );
  });
});
