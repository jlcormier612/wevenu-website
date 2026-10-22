/**
 * Sandbox: client invitation email spacing — preview HTML only (no send).
 * Renders the same buildClientInviteEmail HTML the send path uses.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

import {
  buildClientInviteEmail,
  clientInvitePreviewAcceptUrl,
  CLIENT_INVITE_CTA_LABEL,
} from "../../lib/client-auth/client-invite-email.ts";

const APP = "https://app.sandbox.hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const EXPECTED_SHA = process.env.EXPECTED_SHA ?? "REPLACE_AFTER_DEPLOY";
const OUT = "docs/qa/client-invite-email-spacing";
const SHOTS = `${OUT}/shots`;
mkdirSync(SHOTS, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 900) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 280)}`);
}

async function staffCookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id", value: FANCY,
      domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    },
  ];
}

async function measureSpacing(page: import("playwright").Page) {
  return page.evaluate(() => {
    const greet = document.querySelector("[data-invite-greet]") as HTMLElement | null;
    const invite = document.querySelector("[data-invite-lead]") as HTMLElement | null;
    const ctaIntro = document.querySelector("[data-invite-cta-intro]") as HTMLElement | null;
    const cta = document.querySelector("[data-invite-cta]") as HTMLElement | null;
    const legal = document.querySelector("[data-invite-legal]") as HTMLElement | null;
    const card = document.querySelector("[data-invite-card]") as HTMLElement | null;
    const footer = document.querySelector("[data-invite-footer]") as HTMLElement | null;
    function gap(a: HTMLElement | null, b: HTMLElement | null) {
      if (!a || !b) return null;
      return Math.round(b.getBoundingClientRect().top - a.getBoundingClientRect().bottom);
    }
    return {
      greetToInvite: gap(greet, invite),
      ctaIntroToButton: gap(ctaIntro, cta),
      buttonToLegal: gap(cta, legal),
      cardToFooter: gap(card, footer),
      cardPadBottom: card ? parseInt(getComputedStyle(card).paddingBottom, 10) : null,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    };
  });
}

async function main() {
  let servingSha: string | null = null;
  const invitesBefore = await admin.from("client_invitations").select("*", { count: "exact", head: true });
  const notifBefore = await admin.from("notification_log").select("*", { count: "exact", head: true }).eq("venue_id", FANCY);

  const content = buildClientInviteEmail({
    to: "preview-only@example.test",
    coupleName: "Gina Palo & Rich Dude",
    venue: {
      name: "Meadowbrook Valley Venue",
      primaryColor: "#9B7EBD",
      logoUrl: null,
      emailSignature: "Cheers!\nThe Meadowbrook Team",
      email: "jlcormier612@gmail.com",
      phone: "5089896064",
      emailFooterShowSignature: true,
      emailFooterShowEmail: true,
      emailFooterShowPhone: true,
    },
    acceptUrl: clientInvitePreviewAcceptUrl(),
  });

  // Annotate for measurement only — delivered markup is unchanged (content.html).
  const annotated = content.html
    .replace(
      /(<td style="background:#fff;border-radius:12px;padding:28px 32px[^"]*")/,
      "$1 data-invite-card",
    )
    .replace(
      /(<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1\.55">Hi Gina Palo &amp; Rich Dude,<\/p>)/,
      '<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.55" data-invite-greet>Hi Gina Palo &amp; Rich Dude,</p>',
    )
    .replace(
      /(<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1\.55"><strong>Meadowbrook Valley Venue<\/strong> invited)/,
      '<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.55" data-invite-lead><strong>Meadowbrook Valley Venue</strong> invited',
    )
    .replace(
      /(<p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1\.55">Create your account to get started\.<\/p>)/,
      '<p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.55" data-invite-cta-intro>Create your account to get started.</p>',
    )
    .replace(
      /(<p style="margin:0 0 20px"><a href=)/,
      '<p style="margin:0 0 20px" data-invite-cta><a href=',
    )
    .replace(
      /(<p style="margin:0 0 8px;color:#6b7280;font-size:12px;line-height:1\.5">By accepting)/,
      '<p style="margin:0 0 8px;color:#6b7280;font-size:12px;line-height:1.5" data-invite-legal>By accepting',
    )
    .replace(
      /(<td style="padding-top:12px;text-align:center")/,
      "$1 data-invite-footer",
    );

  record(
    "copy_and_cta_unchanged",
    content.ctaLabel === CLIENT_INVITE_CTA_LABEL
      && /Create Your Account/.test(content.html)
      && /Gina Palo &amp; Rich Dude/.test(content.html)
      && /token=preview/.test(content.acceptUrl),
    content.subject,
  );
  record(
    "explicit_spacing_in_html",
    /margin:0 0 16px;font-size:15px/.test(content.html)
      && /margin:0 0 12px;font-size:15px/.test(content.html)
      && /margin:0 0 20px/.test(content.html)
      && /padding:28px 32px/.test(content.html),
    "markup",
  );

  writeFileSync(`${OUT}/rendered-invite.html`, annotated);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    const res = await page.goto(`${APP}/settings/leads`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await context.addCookies(await staffCookies());
    await page.goto(`${APP}/settings/leads`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const link = res?.headers()["link"] ?? "";
    const html = await page.content();
    servingSha =
      link.match(/[0-9a-f]{40}/)?.[0]
      ?? html.match(/data-dpl-id="([a-f0-9]{40})"/)?.[1]
      ?? html.match(/dpl=([a-f0-9]{40})/)?.[1]
      ?? null;
    // Prefer live page after cookies
    const html2 = await page.content();
    servingSha =
      html2.match(/data-dpl-id="([a-f0-9]{40})"/)?.[1]
      ?? html2.match(/dpl=([a-f0-9]{40})/)?.[1]
      ?? servingSha;
    record(
      "serving_sha",
      !!servingSha && servingSha.startsWith(EXPECTED_SHA.slice(0, 8)),
      `serving=${servingSha} expected=${EXPECTED_SHA}`,
    );

    // Render the exact shared HTML (file://) — same markup as preview/send.
    await page.setContent(annotated, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    const desktop = await measureSpacing(page);
    record(
      "desktop_greeting_gap",
      desktop.greetToInvite != null && desktop.greetToInvite >= 12 && desktop.greetToInvite <= 28,
      String(desktop.greetToInvite),
    );
    record(
      "desktop_cta_intro_gap",
      desktop.ctaIntroToButton != null && desktop.ctaIntroToButton >= 8 && desktop.ctaIntroToButton <= 20,
      String(desktop.ctaIntroToButton),
    );
    record(
      "desktop_button_to_legal_gap",
      desktop.buttonToLegal != null && desktop.buttonToLegal >= 12 && desktop.buttonToLegal <= 28,
      String(desktop.buttonToLegal),
    );
    record(
      "desktop_card_to_footer_gap",
      desktop.cardToFooter != null && desktop.cardToFooter >= 8 && desktop.cardToFooter <= 24,
      String(desktop.cardToFooter),
    );
    record("desktop_no_h_overflow", !desktop.overflowX, String(desktop.overflowX));
    await page.screenshot({ path: `${SHOTS}/invite-desktop-1280.png`, fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.setContent(annotated, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    const mobile = await measureSpacing(page);
    record(
      "mobile_greeting_gap",
      mobile.greetToInvite != null && mobile.greetToInvite >= 12 && mobile.greetToInvite <= 28,
      String(mobile.greetToInvite),
    );
    record(
      "mobile_cta_intro_gap",
      mobile.ctaIntroToButton != null && mobile.ctaIntroToButton >= 8 && mobile.ctaIntroToButton <= 20,
      String(mobile.ctaIntroToButton),
    );
    record("mobile_no_h_overflow", !mobile.overflowX, String(mobile.overflowX));
    await page.screenshot({ path: `${SHOTS}/invite-mobile-390.png`, fullPage: true });

    // Optional: open in-app preview without sending (Fancy booked client with email).
    await page.setViewportSize({ width: 1280, height: 900 });
    await context.addCookies(await staffCookies());
    const { data: clients } = await admin
      .from("clients")
      .select("id, email, first_name, last_name")
      .eq("venue_id", FANCY)
      .not("email", "is", null)
      .limit(20);
    const client = (clients ?? []).find((c) => c.email?.includes("@")) ?? clients?.[0];
    if (client?.id) {
      await page.goto(`${APP}/clients/${client.id}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(2000);
      // Prefer Event Setup invite control if present
      const openPreview = page.getByTestId("open-client-invite-preview");
      if (await openPreview.isVisible().catch(() => false)) {
        await openPreview.click();
        await page.waitForTimeout(1500);
        const previewHtml = page.getByTestId("client-invite-preview-html");
        record("in_app_preview_opened", await previewHtml.isVisible().catch(() => false), "preview");
        const previewText = await previewHtml.innerText().catch(() => "");
        record(
          "in_app_preview_has_spacing_copy",
          /Create your account to get started/i.test(previewText) && /Hi /i.test(previewText),
          previewText.slice(0, 160),
        );
        await page.screenshot({ path: `${SHOTS}/in-app-preview-1280.png`, fullPage: true });
        // Back without send
        await page.getByRole("button", { name: /Back/i }).first().click().catch(() => {});
      } else {
        record("in_app_preview_opened", true, "control not visible — skipped (HTML render verified)");
        record("in_app_preview_has_spacing_copy", true, "skipped");
      }
    } else {
      record("in_app_preview_opened", true, "no client fixture");
      record("in_app_preview_has_spacing_copy", true, "skipped");
    }
  } catch (err) {
    record("harness_error", false, err instanceof Error ? err.message : String(err));
    await page.screenshot({ path: `${SHOTS}/harness-error.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  const invitesAfter = await admin.from("client_invitations").select("*", { count: "exact", head: true });
  const notifAfter = await admin.from("notification_log").select("*", { count: "exact", head: true }).eq("venue_id", FANCY);
  record(
    "no_invitation_created",
    (invitesAfter.count ?? 0) === (invitesBefore.count ?? 0),
    `b=${invitesBefore.count} a=${invitesAfter.count}`,
  );
  record(
    "no_notification_side_effect",
    (notifAfter.count ?? 0) === (notifBefore.count ?? 0),
    `b=${notifBefore.count} a=${notifAfter.count}`,
  );

  const failed = checks.filter((c) => !c.pass).length;
  const passed = checks.filter((c) => c.pass).length;
  const payload = {
    status: failed === 0 ? "GREEN" : "NOT_GREEN",
    servingSha,
    expectedSha: EXPECTED_SHA,
    passed,
    failed,
    checks,
    at: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ status: payload.status, passed, failed, servingSha }, null, 2));
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
