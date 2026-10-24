/**
 * Sandbox — platform signup legal consent (venue/client/vendor paths).
 * Uses admin-inserted pending invites (no email send) for couple/vendor.
 * Venue activate is asserted via public legal destinations + enrollment contract.
 */
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED_SHA = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = "docs/qa/platform-signup-legal-consent";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function servingImage(): string {
  try {
    const taskArn = execSync(
      "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
      { encoding: "utf8" },
    ).trim();
    if (!taskArn || taskArn === "None") return "";
    return execSync(
      `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
}

async function assertLegalHref(page: import("playwright").Page, testId: string, expectedPath: string) {
  const href = await page.getByTestId(testId).getAttribute("href");
  const ok = href === expectedPath || href?.endsWith(expectedPath);
  record(`link-${testId}`, Boolean(ok), `href=${href} expected=${expectedPath}`);
  if (!href) return;
  const res = await page.request.get(href.startsWith("http") ? href : `${APP}${href}`);
  record(`dest-${testId}`, res.ok(), `status=${res.status()} url=${href}`);
}

async function main() {
  const image = servingImage();
  record(
    "serving-sha",
    !EXPECTED_SHA || image.includes(EXPECTED_SHA.slice(0, 12)),
    `expected=${EXPECTED_SHA.slice(0, 12)} ecs=${image}`,
  );
  record("serving-image", Boolean(image), image);

  const stamp = Date.now();
  const coupleEmail = `qa.consent.couple.${stamp}@example.com`;
  const coupleToken = randomUUID();
  const couplePassword = `QaConsent1!${stamp.toString().slice(-4)}`;

  // Pending invite only — do not call sendEmail.
  // Ephemeral client — do not mutate Fancy fixture invites / booked clients.
  const qaClientId = randomUUID();
  const { error: clientErr } = await admin.from("clients").insert({
    id: qaClientId,
    venue_id: FANCY,
    first_name: "QA",
    last_name: "Consent",
    email: coupleEmail,
    status: "booking",
  });
  record("seed-qa-client", !clientErr, clientErr?.message ?? qaClientId);

  const { error: invErr } = await admin.from("client_invitations").insert({
    venue_id: FANCY,
    client_id: qaClientId,
    email: coupleEmail,
    token: coupleToken,
    status: "pending",
    delivery_status: null,
  });
  record("seed-client-invite", !invErr, invErr?.message ?? `token=${coupleToken.slice(0, 8)}…`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // ── Client invite signup ──────────────────────────────────────────────
  await page.goto(`${APP}/client/accept?token=${coupleToken}`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.waitForSelector('[data-testid="signup-legal-consent"]', { timeout: 30000 }).catch(() => null);
  const coupleConsent = await page.getByTestId("signup-legal-consent").count();
  record("client-accept-consent-ui", coupleConsent > 0, `count=${coupleConsent}`);
  const coupleChecked = await page.getByTestId("signup-legal-accepted").isChecked().catch(() => true);
  record("client-accept-unchecked-default", coupleChecked === false, `checked=${coupleChecked}`);
  await assertLegalHref(page, "signup-legal-terms-link", "/end-user-terms");
  await assertLegalHref(page, "signup-legal-privacy-link", "/privacy");
  await page.screenshot({ path: `${OUT}/shots/client-accept-initial-1280.png`, fullPage: true });

  await page.locator("#password").fill(couplePassword);
  await page.locator("#confirmPassword").fill(couplePassword);
  await page.getByRole("button", { name: /Create Your Account/i }).click();
  await page.waitForTimeout(800);
  const blockedText = await page.locator('[role="alert"]').innerText().catch(() => "");
  // HTML5 required may block submit before server — either way account must not proceed.
  const stillOnAccept = page.url().includes("/client/accept");
  record(
    "client-accept-blocked-without-ack",
    stillOnAccept,
    `url=${page.url()} alert=${blockedText.slice(0, 200)}`,
  );
  await page.screenshot({ path: `${OUT}/shots/client-accept-blocked-1280.png`, fullPage: true });

  await page.getByTestId("signup-legal-accepted").check();
  await page.getByRole("button", { name: /Create Your Account/i }).click();
  await page.waitForTimeout(4000);
  const afterCreateUrl = page.url();
  const createdOk = afterCreateUrl.includes("/p/");
  record("client-accept-with-ack", createdOk, `url=${afterCreateUrl}`);
  await page.screenshot({ path: `${OUT}/shots/client-accept-success-1280.png`, fullPage: true });

  if (createdOk) {
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
    const user = (users.users ?? []).find(
      (u) => (u.email ?? "").toLowerCase() === coupleEmail,
    );
    const { data: accepts } = user
      ? await admin
          .from("legal_acceptances")
          .select("id, accepted_version, acceptance_method, legal_documents(document_type)")
          .eq("user_id", user.id)
          .order("accepted_at", { ascending: false })
          .limit(10)
      : { data: null };
    const methods = (accepts ?? []).map((a) => a.acceptance_method);
    const types = (accepts ?? []).map(
      (a) => (a.legal_documents as { document_type?: string } | null)?.document_type,
    );
    record(
      "client-persist-acceptances",
      Boolean(user)
        && methods.includes("Couple Invitation")
        && types.includes("couple_end_user_terms")
        && types.includes("privacy_policy"),
      JSON.stringify({ userId: user?.id, methods, types }).slice(0, 1500),
    );
  }

  // Narrow
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${APP}/client/accept?token=invalid-token-for-nav-check`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.screenshot({ path: `${OUT}/shots/client-accept-invalid-390.png`, fullPage: true });

  // ── Vendor invite signup (seed claim token if a sandbox vendor exists) ─
  await page.setViewportSize({ width: 1280, height: 900 });
  const { data: vendorRow } = await admin
    .from("vendors")
    .select("id, claim_token, business_name")
    .not("claim_token", "is", null)
    .limit(1)
    .maybeSingle<{ id: string; claim_token: string; business_name: string | null }>();

  if (vendorRow?.claim_token) {
    await page.goto(`${APP}/vendor/accept?token=${vendorRow.claim_token}`, {
      waitUntil: "networkidle",
      timeout: 90000,
    });
    const vendorConsent = await page.getByTestId("signup-legal-consent").count();
    // Authed panel may show instead of signup — only assert when signup form is present.
    if (vendorConsent > 0) {
      record("vendor-accept-consent-ui", true, "signup form visible");
      const vChecked = await page.getByTestId("signup-legal-accepted").isChecked();
      record("vendor-accept-unchecked-default", vChecked === false, `checked=${vChecked}`);
      await assertLegalHref(page, "signup-legal-terms-link", "/vendor-terms");
      await assertLegalHref(page, "signup-legal-privacy-link", "/privacy");
      await page.screenshot({ path: `${OUT}/shots/vendor-accept-signup-1280.png`, fullPage: true });
    } else {
      record(
        "vendor-accept-consent-ui",
        false,
        "signup form not shown (likely already authed session or claimed) — open private context",
      );
      // Retry with clean context (no cookies)
      const clean = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const vp = await clean.newPage();
      await vp.goto(`${APP}/vendor/accept?token=${vendorRow.claim_token}`, {
        waitUntil: "networkidle",
        timeout: 90000,
      });
      const again = await vp.getByTestId("signup-legal-consent").count();
      record("vendor-accept-consent-ui-clean", again > 0, `count=${again}`);
      if (again > 0) {
        await assertLegalHref(vp, "signup-legal-terms-link", "/vendor-terms");
        await assertLegalHref(vp, "signup-legal-privacy-link", "/privacy");
        await vp.screenshot({ path: `${OUT}/shots/vendor-accept-signup-1280.png`, fullPage: true });
      }
      await clean.close();
    }
  } else {
    record("vendor-accept-consent-ui", false, "no sandbox vendor with claim_token");
  }

  // ── Venue legal destinations (activate uses these) ────────────────────
  for (const path of [
    "/legal/venue_terms_of_service",
    "/privacy",
    "/end-user-terms",
    "/vendor-terms",
  ]) {
    const res = await page.request.get(`${APP}${path}`);
    record(`venue-legal-dest-${path}`, res.ok() || res.status() === 200, `status=${res.status()}`);
  }

  // Client login must not show signup consent
  await page.goto(`${APP}/client/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const loginConsent = await page.getByTestId("signup-legal-consent").count();
  record("client-login-no-signup-consent", loginConsent === 0, `count=${loginConsent}`);

  await browser.close();

  // Cleanup ephemeral QA client + invite (leave auth user for audit evidence if created).
  await admin.from("client_invitations").delete().eq("token", coupleToken);
  await admin.from("clients").delete().eq("id", qaClientId);

  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify({ expectedSha: EXPECTED_SHA, image, coupleEmail, checks }, null, 2),
  );
  const failed = checks.filter((c) => !c.pass).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
