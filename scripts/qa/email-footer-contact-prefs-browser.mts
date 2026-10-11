/**
 * Sandbox: email footer contact prefs — UI persistence + Resend delivery.
 * Disposable venues / internal inboxes only. Never logs secrets.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const OUT = "docs/qa/email-footer-contact-prefs";
const EXPECT_SHA = (process.env.EXPECT_SHA || "").slice(0, 8);
/** Feature landed on this SHA; later tips that contain it are accepted when EXPECT_SHA matches tip. */
const FEATURE_SHA = "4aaa0692";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox");
}
mkdirSync(OUT, { recursive: true });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 500)}`);
}

function loadResendKeyFromAws(): string {
  const { execFileSync } = require("node:child_process");
  const raw = execFileSync(
    "aws",
    [
      "secretsmanager",
      "get-secret-value",
      "--secret-id",
      "htc/sandbox/resend-api-key",
      "--query",
      "SecretString",
      "--output",
      "text",
    ],
    { encoding: "utf8" },
  ).trim();
  try {
    const j = JSON.parse(raw);
    if (j && typeof j.value === "string") return j.value.trim();
  } catch {
    /* plain string */
  }
  return raw.trim();
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);

async function cookiesFor(email: string) {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded =
    "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return ssrUtils.createChunks(cookieName, encoded).map(
    (c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    }),
  );
}

async function passWelcome(page: {
  url: () => string;
  locator: (s: string) => {
    count: () => Promise<number>;
    check: (o?: { force?: boolean }) => Promise<void>;
    first: () => {
      count: () => Promise<number>;
      check: (o?: { force?: boolean }) => Promise<void>;
    };
    isVisible: () => Promise<boolean>;
  };
  getByRole: (r: string, o?: { name?: RegExp }) => {
    count: () => Promise<number>;
    click: () => Promise<void>;
  };
  waitForTimeout: (n: number) => Promise<void>;
}) {
  for (let a = 0; a < 3; a++) {
    const onWelcome = page.url().includes("/welcome");
    const visible = await page
      .locator('[data-welcome-experience="true"]')
      .isVisible()
      .catch(() => false);
    if (!onWelcome && !visible) return;
    const agree = page.locator("#welcome-experience-agree");
    if ((await agree.count()) > 0) await agree.check({ force: true });
    else {
      const fb = page.locator("input[type='checkbox']").first();
      if ((await fb.count()) > 0) await fb.check({ force: true });
    }
    const cont = page.getByRole("button", { name: /^Continue$/i });
    if ((await cont.count()) > 0) await cont.click();
    for (let i = 0; i < 25; i++) {
      if (!page.url().includes("/welcome")) break;
      await page.waitForTimeout(400);
    }
  }
}

async function isLabelCheckboxChecked(
  page: {
    getByText: (t: RegExp) => {
      locator: (s: string) => {
        first: () => {
          getAttribute: (a: string) => Promise<string | null>;
          evaluate: (fn: (el: Element) => string | null) => Promise<string | null>;
        };
      };
      first: () => {
        evaluate: (fn: (el: Element) => boolean | null) => Promise<boolean | null>;
      };
    };
  },
  text: RegExp,
): Promise<boolean | null> {
  const label = page.getByText(text).first();
  return label.evaluate((el: Element) => {
    const wrap = el.closest("label");
    if (!wrap) return null;
    const btn = wrap.querySelector('[role="checkbox"]') as HTMLElement | null;
    if (!btn) return null;
    return btn.getAttribute("aria-checked") === "true";
  });
}

async function clickLabelCheckbox(
  page: {
    getByText: (t: RegExp) => {
      first: () => {
        click: (o?: { force?: boolean }) => Promise<void>;
        evaluate: (fn: (el: Element) => void) => Promise<void>;
      };
    };
  },
  text: RegExp,
) {
  await page.getByText(text).first().evaluate((el: Element) => {
    const wrap = el.closest("label");
    const btn = wrap?.querySelector('[role="checkbox"]') as HTMLElement | null;
    btn?.click();
  });
}

async function sendResendCase(args: {
  resendKey: string;
  fromEmail: string;
  to: string;
  stamp: number;
  caseId: string;
  brandInput: Record<string, unknown>;
  expect: {
    hasEmail?: boolean;
    hasPhone?: boolean;
    hasSignature?: boolean;
    noBlankArtifacts?: boolean;
  };
}): Promise<{ id: string | null; html: string; pass: boolean; detail: string }> {
  const { emailBrandFromVenue, renderBrandedEmailHtml, appendEmailSignatureText } =
    await import("@/lib/email/venue-brand");
  const brand = emailBrandFromVenue(args.brandInput as never);
  const html = renderBrandedEmailHtml(
    brand,
    `<p>QA footer prefs case ${args.caseId}</p>`,
  );
  const text = appendEmailSignatureText(`QA footer prefs case ${args.caseId}`, brand);
  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.resendKey}`,
      "Content-Type": "application/json",
      "User-Agent": "htc-email-footer-prefs-qa/1.0",
    },
    body: JSON.stringify({
      from: args.fromEmail,
      to: [args.to],
      subject: `[QA] Footer prefs ${args.caseId} ${args.stamp}`,
      text,
      html,
      tags: [
        { name: "category", value: "qa_email_footer_prefs" },
        { name: "qa_case", value: args.caseId },
      ],
      open_tracking: false,
      click_tracking: false,
    }),
  });
  const sendBody = (await sendRes.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };
  if (!sendRes.ok || !sendBody.id) {
    return {
      id: null,
      html: "",
      pass: false,
      detail: `send status=${sendRes.status}`,
    };
  }
  let retrievedHtml = "";
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1200));
    const getRes = await fetch(`https://api.resend.com/emails/${sendBody.id}`, {
      headers: {
        Authorization: `Bearer ${args.resendKey}`,
        "User-Agent": "htc-email-footer-prefs-qa/1.0",
      },
    });
    if (getRes.ok) {
      const retrieved = (await getRes.json()) as { html?: string };
      retrievedHtml = String(retrieved.html || "");
      if (retrievedHtml) break;
    }
  }
  const hasEmail = /footer-qa@example\.test/.test(retrievedHtml);
  const hasPhone = /\(978\) 870-3988|870-3988|9788703988/.test(retrievedHtml);
  const hasSignature = /Warmly/.test(retrievedHtml);
  const blankArtifacts =
    /Email:\s*<\/|Phone:\s*<\/| · <\/|·\s*·|\n\s*\n\s*—\s*\n\s*$/i.test(retrievedHtml) ||
    />\s*·\s*</.test(retrievedHtml);
  const e = args.expect;
  const pass =
    retrievedHtml.length > 0 &&
    (e.hasEmail === undefined || hasEmail === e.hasEmail) &&
    (e.hasPhone === undefined || hasPhone === e.hasPhone) &&
    (e.hasSignature === undefined || hasSignature === e.hasSignature) &&
    (e.noBlankArtifacts === undefined || blankArtifacts === false);
  return {
    id: sendBody.id,
    html: retrievedHtml,
    pass,
    detail: `id=${sendBody.id} email=${hasEmail} phone=${hasPhone} sig=${hasSignature} blank=${blankArtifacts} len=${retrievedHtml.length}`,
  };
}

async function main() {
  const stamp = Date.now();
  const email = `jennifer+footerprefs.${stamp}@hellotocheers.com`;
  const password = `Fp-${stamp}-Aa1x`;
  const contactEmail = `contact.${stamp}@example.test`;
  const contactPhone = "9788703988";
  const signature = "Warmly,\nFooter Prefs QA Venue";

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (cErr || !created.user) throw cErr ?? new Error("createUser");
  const userId = created.user.id;
  let venueA = "";
  let venueB = "";

  try {
    const { data: vA, error: vErr } = await admin
      .from("venues")
      .insert({
        owner_user_id: userId,
        name: `Footer Prefs A ${stamp}`,
        email: contactEmail,
        phone: contactPhone,
        email_signature: signature,
      })
      .select(
        "id,email,phone,email_signature,email_footer_show_signature,email_footer_show_email,email_footer_show_phone",
      )
      .single();
    if (vErr || !vA) throw vErr ?? new Error("venueA");
    venueA = vA.id;

    record(
      "new_venue_defaults",
      vA.email_footer_show_phone === false &&
        vA.email_footer_show_email === true &&
        vA.email_footer_show_signature === true,
      JSON.stringify({
        phone: vA.email_footer_show_phone,
        email: vA.email_footer_show_email,
        sig: vA.email_footer_show_signature,
      }),
    );

    const { data: vB, error: vBErr } = await admin
      .from("venues")
      .insert({
        owner_user_id: userId,
        name: `Footer Prefs B ${stamp}`,
        email: `b.${contactEmail}`,
        phone: "9785550100",
        email_signature: "Cheers,\nVenue B",
        email_footer_show_phone: true,
        email_footer_show_email: true,
        email_footer_show_signature: true,
      })
      .select("id,email_footer_show_phone")
      .single();
    if (vBErr || !vB) throw vBErr ?? new Error("venueB");
    venueB = vB.id;

    for (const vid of [venueA, venueB]) {
      await admin.from("venue_staff").insert({
        venue_id: vid,
        user_id: userId,
        full_name: "Footer Prefs QA",
        email,
        role: "owner",
        is_owner: true,
        is_active: true,
        accepted_at: new Date().toISOString(),
        access_title: "administrator",
        title_basis: "administrator",
        capability_overrides: {},
        owner_invite_pending: false,
      });
    }
    await admin.from("venue_staff_active_context").upsert({
      user_id: userId,
      active_venue_id: venueA,
      updated_at: new Date().toISOString(),
    });
    await admin.from("venue_onboarding_intake").upsert(
      {
        venue_id: venueA,
        path: "self_setup",
        venue_name: `Footer Prefs A ${stamp}`,
        space_mode: "one",
        spaces: [{ name: "Main Space", maxCapacity: null }],
        offers_tours: false,
        inquiry_sources: [],
        bring_business_choice: "starting_fresh",
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "venue_id" },
    );

    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies(await cookiesFor(email));
    const page = await ctx.newPage();

    try {
      await page.goto(`${APP}/settings/communications#identity`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(2500);
      await passWelcome(page);
      await page.goto(`${APP}/settings/communications#identity`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(2500);

      // Tip marker: data-dpl-id attribute and/or ?dpl= on Next asset URLs.
      const extractDpl = (html: string) =>
        html.match(/data-dpl-id="([a-f0-9]+)"/)?.[1] ||
        html.match(/[?&]dpl=([a-f0-9]{8,})/)?.[1] ||
        "";
      let dpl = extractDpl(await page.content());
      if (!dpl) {
        const tipPage = await ctx.newPage();
        try {
          await tipPage.goto(`${APP}/login`, {
            waitUntil: "domcontentloaded",
            timeout: 60000,
          });
          dpl = extractDpl(await tipPage.content());
        } finally {
          await tipPage.close();
        }
      }
      if (EXPECT_SHA) {
        record(
          "runtime_dpl",
          dpl.startsWith(EXPECT_SHA),
          `dpl=${dpl} expect=${EXPECT_SHA}`,
        );
      } else {
        record("runtime_dpl", Boolean(dpl), `dpl=${dpl || "missing"}`);
      }

      record(
        "settings_heading",
        (await page.getByText(/How clients see you/i).count()) > 0,
        "identity card",
      );
      record(
        "phone_control_visible",
        (await page.getByText(/Show venue phone number/i).count()) > 0,
        "phone checkbox label",
      );
      record(
        "email_control_visible",
        (await page.getByText(/Show venue email address/i).count()) > 0,
        "email checkbox label",
      );
      record(
        "signature_control_visible",
        (await page.getByText(/Show venue \/ team sign-off/i).count()) > 0,
        "signature checkbox label",
      );
      record(
        "preview_iframe",
        (await page.locator('iframe[title="Email brand preview"]').count()) > 0,
        "preview present",
      );

      const phoneDefault = await isLabelCheckboxChecked(
        page,
        /Show venue phone number/i,
      );
      const emailDefault = await isLabelCheckboxChecked(
        page,
        /Show venue email address/i,
      );
      const sigDefault = await isLabelCheckboxChecked(
        page,
        /Show venue \/ team sign-off/i,
      );
      record(
        "ui_defaults_match_product",
        phoneDefault === false && emailDefault === true && sigDefault === true,
        `phone=${phoneDefault} email=${emailDefault} sig=${sigDefault}`,
      );

      // Enable phone, save, reload
      await clickLabelCheckbox(page, /Show venue phone number/i);
      await page.getByRole("button", { name: /Save email footer/i }).click();
      await page.waitForTimeout(2000);
      const { data: afterPhoneOn } = await admin
        .from("venues")
        .select(
          "email,phone,email_signature,email_footer_show_phone,email_footer_show_email,email_footer_show_signature",
        )
        .eq("id", venueA)
        .single();
      record(
        "save_phone_enabled",
        afterPhoneOn?.email_footer_show_phone === true &&
          afterPhoneOn?.email === contactEmail &&
          afterPhoneOn?.phone === contactPhone &&
          afterPhoneOn?.email_signature === signature,
        `phone_pref=${afterPhoneOn?.email_footer_show_phone} contact_intact=${afterPhoneOn?.email === contactEmail}`,
      );

      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2000);
      const phoneAfterReload = await isLabelCheckboxChecked(
        page,
        /Show venue phone number/i,
      );
      record("reload_restores_phone_on", phoneAfterReload === true, `phone=${phoneAfterReload}`);

      // Independent toggles: hide email + signature, keep phone
      if ((await isLabelCheckboxChecked(page, /Show venue email address/i)) === true) {
        await clickLabelCheckbox(page, /Show venue email address/i);
      }
      if ((await isLabelCheckboxChecked(page, /Show venue \/ team sign-off/i)) === true) {
        await clickLabelCheckbox(page, /Show venue \/ team sign-off/i);
      }
      await page.getByRole("button", { name: /Save email footer/i }).click();
      await page.waitForTimeout(2000);
      const { data: afterIndep } = await admin
        .from("venues")
        .select(
          "email,phone,email_footer_show_phone,email_footer_show_email,email_footer_show_signature",
        )
        .eq("id", venueA)
        .single();
      record(
        "independent_toggles_persist",
        afterIndep?.email_footer_show_phone === true &&
          afterIndep?.email_footer_show_email === false &&
          afterIndep?.email_footer_show_signature === false &&
          afterIndep?.email === contactEmail &&
          afterIndep?.phone === contactPhone,
        JSON.stringify({
          phone: afterIndep?.email_footer_show_phone,
          email: afterIndep?.email_footer_show_email,
          sig: afterIndep?.email_footer_show_signature,
        }),
      );

      // Preview should reflect phone when on (srcdoc)
      const previewSrc = await page
        .locator('iframe[title="Email brand preview"]')
        .getAttribute("srcdoc");
      record(
        "preview_reflects_phone",
        Boolean(previewSrc && /\(978\) 870-3988|870-3988/.test(previewSrc)),
        previewSrc ? `len=${previewSrc.length}` : "missing srcdoc",
      );

      // Venue isolation: switch active context to B and open settings
      await admin.from("venue_staff_active_context").upsert({
        user_id: userId,
        active_venue_id: venueB,
        updated_at: new Date().toISOString(),
      });
      await page.goto(`${APP}/settings/communications#identity`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(2500);
      const phoneOnB = await isLabelCheckboxChecked(page, /Show venue phone number/i);
      record(
        "venue_switch_loads_own_prefs",
        phoneOnB === true && vB.email_footer_show_phone === true,
        `venueB phone checkbox=${phoneOnB}`,
      );

      // Restore A prefs to product-default-ish for cleanup clarity
      await admin
        .from("venues")
        .update({
          email_footer_show_phone: false,
          email_footer_show_email: true,
          email_footer_show_signature: true,
        })
        .eq("id", venueA);

      await page.screenshot({ path: `${OUT}/settings-identity.png`, fullPage: false });
    } finally {
      await browser.close();
    }

    // Render proofs (module under test)
    const { emailBrandFromVenue, renderBrandedEmailHtml } = await import(
      "@/lib/email/venue-brand"
    );
    const hiddenPhone = renderBrandedEmailHtml(
      emailBrandFromVenue({
        name: "Proof Venue",
        emailSignature: "Warmly,\nProof Venue",
        email: "proof@example.test",
        phone: "9788703988",
      }),
      "<p>Body</p>",
    );
    record(
      "render_default_hides_phone",
      /proof@example\.test/.test(hiddenPhone) && !/870-3988/.test(hiddenPhone),
      "default footer",
    );
    const phoneOnly = renderBrandedEmailHtml(
      emailBrandFromVenue({
        name: "Proof Venue",
        email: "proof@example.test",
        phone: "9788703988",
        emailFooterShowPhone: true,
        emailFooterShowEmail: false,
        emailFooterShowSignature: false,
      }),
      "<p>Body</p>",
    );
    record(
      "render_phone_only_no_separator_artifact",
      /\(978\) 870-3988/.test(phoneOnly) &&
        !/proof@example\.test/.test(phoneOnly) &&
        !/ · /.test(phoneOnly),
      "phone-only footer",
    );

    // Contact fields intact after all pref updates
    const { data: finalA } = await admin
      .from("venues")
      .select("email,phone,email_signature")
      .eq("id", venueA)
      .single();
    record(
      "contact_data_intact",
      finalA?.email === contactEmail &&
        finalA?.phone === contactPhone &&
        finalA?.email_signature === signature,
      `email=${finalA?.email === contactEmail} phone=${finalA?.phone === contactPhone}`,
    );

    // Resend delivery matrix
    const resendKey = process.env.RESEND_API_KEY?.trim() || loadResendKeyFromAws();
    const fromEmail = "Hello to Cheers <jennifer@hellotocheers.com>";
    const internalTo =
      process.env.COMMUNICATION_SANDBOX_EMAIL?.trim() ||
      `jennifer+emailfooter.${stamp}@hellotocheers.com`;
    const baseBrand = {
      name: "Footer Prefs QA Venue",
      emailSignature: "Warmly,\nFooter Prefs QA Venue",
      email: "footer-qa@example.test",
      phone: "9788703988",
    };
    const delivery: Record<string, unknown> = { to: internalTo.replace(/^(.).+(@.+)$/, "$1***$2") };

    if (!resendKey) {
      record("resend_accepted", false, "Resend key unavailable");
      record("delivered_phone_hidden", false, "no key");
      record("delivered_phone_enabled", false, "no key");
      record("delivered_email_hidden", false, "no key");
      record("delivered_signature_hidden", false, "no key");
      record("delivered_all_hidden_clean", false, "no key");
    } else {
      const cases = [
        {
          caseId: "phone_hidden",
          brandInput: {
            ...baseBrand,
            emailFooterShowSignature: true,
            emailFooterShowEmail: true,
            emailFooterShowPhone: false,
          },
          expect: { hasEmail: true, hasPhone: false, hasSignature: true, noBlankArtifacts: true },
          check: "delivered_phone_hidden",
        },
        {
          caseId: "phone_enabled",
          brandInput: {
            ...baseBrand,
            emailFooterShowSignature: true,
            emailFooterShowEmail: true,
            emailFooterShowPhone: true,
          },
          expect: { hasEmail: true, hasPhone: true, hasSignature: true, noBlankArtifacts: true },
          check: "delivered_phone_enabled",
        },
        {
          caseId: "email_hidden",
          brandInput: {
            ...baseBrand,
            emailFooterShowSignature: true,
            emailFooterShowEmail: false,
            emailFooterShowPhone: true,
          },
          expect: { hasEmail: false, hasPhone: true, hasSignature: true, noBlankArtifacts: true },
          check: "delivered_email_hidden",
        },
        {
          caseId: "signature_hidden",
          brandInput: {
            ...baseBrand,
            emailFooterShowSignature: false,
            emailFooterShowEmail: true,
            emailFooterShowPhone: false,
          },
          expect: { hasEmail: true, hasPhone: false, hasSignature: false, noBlankArtifacts: true },
          check: "delivered_signature_hidden",
        },
        {
          caseId: "all_hidden",
          brandInput: {
            ...baseBrand,
            emailFooterShowSignature: false,
            emailFooterShowEmail: false,
            emailFooterShowPhone: false,
          },
          expect: {
            hasEmail: false,
            hasPhone: false,
            hasSignature: false,
            noBlankArtifacts: true,
          },
          check: "delivered_all_hidden_clean",
        },
      ] as const;

      let anyAccepted = false;
      for (const c of cases) {
        const result = await sendResendCase({
          resendKey,
          fromEmail,
          to: internalTo,
          stamp,
          caseId: c.caseId,
          brandInput: c.brandInput,
          expect: c.expect,
        });
        if (result.id) anyAccepted = true;
        record(c.check, result.pass, result.detail);
        delivery[c.caseId] = {
          emailId: result.id,
          htmlLen: result.html.length,
          pass: result.pass,
        };
      }
      record("resend_accepted", anyAccepted, `cases=${cases.length}`);
      writeFileSync(`${OUT}/delivered-sample.json`, JSON.stringify(delivery, null, 2));
    }
  } finally {
    if (venueA) {
      await admin.from("venue_onboarding_intake").delete().eq("venue_id", venueA);
      await admin.from("venue_activation_state").delete().eq("venue_id", venueA);
      await admin.from("venue_activation_scores").delete().eq("venue_id", venueA);
      await admin.from("venue_staff").delete().eq("venue_id", venueA);
      await admin.from("venues").delete().eq("id", venueA);
    }
    if (venueB) {
      await admin.from("venue_staff").delete().eq("venue_id", venueB);
      await admin.from("venues").delete().eq("id", venueB);
    }
    await admin.from("venue_staff_active_context").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  }

  const required = [
    "new_venue_defaults",
    "runtime_dpl",
    "phone_control_visible",
    "email_control_visible",
    "signature_control_visible",
    "preview_iframe",
    "ui_defaults_match_product",
    "save_phone_enabled",
    "reload_restores_phone_on",
    "independent_toggles_persist",
    "preview_reflects_phone",
    "venue_switch_loads_own_prefs",
    "render_default_hides_phone",
    "render_phone_only_no_separator_artifact",
    "contact_data_intact",
    "resend_accepted",
    "delivered_phone_hidden",
    "delivered_phone_enabled",
    "delivered_email_hidden",
    "delivered_signature_hidden",
    "delivered_all_hidden_clean",
  ];
  const report = {
    observedAt: new Date().toISOString(),
    expectSha: EXPECT_SHA || null,
    featureSha: FEATURE_SHA,
    checks,
    hardFail: checks.filter((c) => required.includes(c.name) && !c.pass).map((c) => c.name),
    ok: required.every((n) => checks.find((c) => c.name === n)?.pass),
  };
  writeFileSync(`${OUT}/results.json`, JSON.stringify(report, null, 2));
  console.log(report.ok ? "GREEN email footer contact prefs" : "NOT GREEN email footer contact prefs");
  console.log(JSON.stringify({ ok: report.ok, hardFail: report.hardFail }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
