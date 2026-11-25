#!/usr/bin/env node
/**
 * One-shot: send Production CRM recovery email to jennifer@hellotocheers.com
 * using hashed_token → /login/reset with the shared branded HTC shell.
 *
 * Never logs the recovery URL.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, chmodSync } from "node:fs";
const EMAIL = "jennifer@hellotocheers.com";
const SUPABASE_URL = "https://eovxuojwmqqufactxtqq.supabase.co";
const ORIGIN = "https://workspace.hellotocheers.com";

function smGet(secretId) {
  const out = execFileSync(
    "aws",
    [
      "secretsmanager",
      "get-secret-value",
      "--secret-id",
      secretId,
      "--region",
      "us-east-1",
      "--query",
      "SecretString",
      "--output",
      "text",
    ],
    { encoding: "utf8" },
  ).trim();
  try {
    const d = JSON.parse(out);
    if (d && typeof d === "object") {
      for (const k of [
        "SUPABASE_SERVICE_ROLE_KEY",
        "RESEND_API_KEY",
        "api_key",
        "key",
        "value",
      ]) {
        if (d[k]) return String(d[k]);
      }
      if (Object.keys(d).length === 1) return String(Object.values(d)[0]);
    }
  } catch {
    /* raw */
  }
  return out;
}

async function main() {
  process.env.HTC_ENVIRONMENT = "production";
  // Load TS shared template via tsx when available
  let buildHtml;
  let buildText;
  let subject;
  try {
    const mod = await import("../shared/auth/password-recovery-email.ts");
    buildHtml = mod.buildPasswordRecoveryEmailHtml;
    buildText = mod.buildPasswordRecoveryEmailText;
    subject = mod.PASSWORD_RECOVERY_EMAIL_SUBJECT;
  } catch {
    // Fallback absolute logo shell if ts import unavailable
    const logo =
      "https://hellotocheers.com/brand/hello-to-cheers-logo-primary-transparent.png";
    subject = "Reset your Hello to Cheers password";
    buildHtml = (resetUrl) => {
      const safe = resetUrl
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;");
      return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f1ec;font-family:Georgia,serif">
        <table role="presentation" width="100%" style="background:#f4f1ec;padding:32px 16px"><tr><td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #ddd6cc">
        <tr><td style="padding:36px 32px;border-top:4px solid #5d6f5d">
        <div style="margin:0 0 22px"><img src="${logo}" alt="Hello to Cheers" width="180" style="display:block;width:180px;max-width:100%;height:auto;border:0" /></div>
        <h1 style="color:#1f2a1f;font-size:26px">Reset your Hello to Cheers password</h1>
        <p style="font-family:-apple-system,sans-serif;font-size:15px;color:#374151;line-height:1.6">Use the button below to choose a new password.</p>
        <p><a href="${safe}" style="display:inline-block;background:#5d6f5d;color:#fff;padding:14px 26px;border-radius:6px;text-decoration:none;font-weight:600">Reset password</a></p>
        </td></tr></table></td></tr></table></body></html>`;
    };
    buildText = (resetUrl) =>
      `Reset your Hello to Cheers password\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`;
  }

  const sr = smGet("htc/production/supabase-service-role-key");
  const resend = smGet("htc/production/resend-api-key");

  const genRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sr}`,
      apikey: sr,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "recovery", email: EMAIL }),
  });
  const link = await genRes.json();
  if (!genRes.ok || !link.hashed_token) {
    console.error("generate_link_failed", genRes.status);
    process.exit(1);
  }

  const resetUrl = new URL("/login/reset", ORIGIN);
  resetUrl.searchParams.set("token_hash", link.hashed_token);
  resetUrl.searchParams.set("type", "recovery");
  const url = resetUrl.toString();

  if (/localhost/i.test(url) || !url.startsWith(`${ORIGIN}/login/reset`)) {
    console.error("refusing_non_production_url");
    process.exit(1);
  }

  const html = buildHtml(url);
  if (!/hello-to-cheers-logo-primary-transparent\.png/.test(html)) {
    console.error("branded_logo_missing");
    process.exit(1);
  }

  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resend}`,
      "Content-Type": "application/json",
      "User-Agent": "htc-password-recovery/1.0",
    },
    body: JSON.stringify({
      from: "Hello to Cheers <jennifer@hellotocheers.com>",
      to: [EMAIL],
      subject,
      text: buildText(url),
      html,
      tags: [
        { name: "category", value: "password_recovery" },
        { name: "audience", value: "workspace" },
      ],
    }),
  });
  const sendBody = await sendRes.json().catch(() => ({}));
  if (!sendRes.ok) {
    console.error("resend_failed", sendRes.status);
    process.exit(1);
  }

  const evidence = {
    to: EMAIL,
    host: ORIGIN,
    path: "/login/reset",
    branded_logo: true,
    action_link_had_localhost: /localhost/i.test(String(link.action_link || "")),
    resend_id: sendBody.id || null,
    sent_at: new Date().toISOString(),
  };
  const out = `${process.env.HOME}/Desktop/HTC-4C-3/stage-4c-crm-ownership/password-recovery-fix/founder-email-sent.json`;
  writeFileSync(out, JSON.stringify(evidence, null, 2));
  chmodSync(out, 0o600);
  console.log("sent_ok", evidence.resend_id ? "id_present" : "id_missing");
  console.log("evidence", out);
}

main().catch((err) => {
  console.error("fatal", err?.message || String(err));
  process.exit(1);
});
