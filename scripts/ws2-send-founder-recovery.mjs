#!/usr/bin/env node
/**
 * One-shot: send Production CRM recovery email to jennifer@hellotocheers.com
 * using hashed_token → /login/reset/complete (never logs the URL).
 *
 * Usage (from repo root, with AWS + secrets available):
 *   node scripts/ws2-send-founder-recovery.mjs
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, chmodSync, readFileSync, unlinkSync } from "node:fs";

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

  const resetUrl = new URL("/login/reset/complete", ORIGIN);
  resetUrl.searchParams.set("token_hash", link.hashed_token);
  resetUrl.searchParams.set("type", "recovery");
  const url = resetUrl.toString();

  if (/localhost/i.test(url) || !url.startsWith(ORIGIN)) {
    console.error("refusing_non_production_url");
    process.exit(1);
  }

  const safe = url
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");

  const html = `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#f4f1ec;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #ddd6cc;padding:32px">
    <h1 style="color:#1f2a1f;font-size:24px">Reset your password</h1>
    <p style="color:#374151;font-family:-apple-system,sans-serif;font-size:15px;line-height:1.6">
      Use the button below to choose a new password for the Relationship Workspace.
    </p>
    <p><a href="${safe}" style="display:inline-block;background:#5d6f5d;color:#fff;padding:14px 26px;border-radius:6px;text-decoration:none;font-family:-apple-system,sans-serif;font-weight:600">Reset password</a></p>
  </div></body></html>`;

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
      subject: "Reset your Hello to Cheers password",
      text: `Reset your Hello to Cheers password:\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
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

  // Evidence without exposing the recovery URL
  const evidence = {
    to: EMAIL,
    host: ORIGIN,
    path: "/login/reset/complete",
    action_link_had_localhost: /localhost/i.test(String(link.action_link || "")),
    resend_id: sendBody.id || null,
    sent_at: new Date().toISOString(),
  };
  const out =
    `${process.env.HOME}/Desktop/HTC-4C-3/stage-4c-crm-ownership/password-recovery-fix/founder-email-sent.json`;
  writeFileSync(out, JSON.stringify(evidence, null, 2));
  chmodSync(out, 0o600);
  console.log("sent_ok", evidence.resend_id ? "id_present" : "id_missing");
  console.log("evidence", out);
}

main().catch((err) => {
  console.error("fatal", err?.message || String(err));
  process.exit(1);
});
