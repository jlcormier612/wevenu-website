/**
 * Partner email persistence — public inquiry form → leads.partner_email → lead detail.
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

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMBED = "2551bc9f8f6d4b9aabfcab9b8795edf6";
const EMAIL = "jennifer@hellotocheers.com";
const OUT = "docs/qa/partner-email-inquiry-persistence";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 500)}`);
}

async function servingImage(): Promise<string> {
  const { execSync } = await import("node:child_process");
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function servingDigest(): Promise<string> {
  const { execSync } = await import("node:child_process");
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].imageDigest' --output text`,
    { encoding: "utf8" },
  ).trim();
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
      name: c.name,
      value: c.value,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id",
      value: FANCY,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];
}

function redactEmail(value: string | null | undefined): string {
  if (!value) return "(null)";
  const [u, d] = value.split("@");
  return `${(u ?? "").slice(0, 4)}…@${d ?? "?"}`;
}

async function main() {
  const image = await servingImage();
  const digest = await servingDigest();
  const shaOk = EXPECTED ? image.includes(EXPECTED.slice(0, 8)) : true;
  record("serving-sha", shaOk, `expected=${EXPECTED || "(any)"} ecs=${image}`);
  record("serving-digest", digest.startsWith("sha256:"), digest);
  if (!shaOk) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ pass: false, checks, image, digest }, null, 2));
    process.exit(1);
  }

  const stamp = Date.now();
  const primaryEmail = `pem-primary-${stamp}@hellotocheers-test.invalid`;
  const partnerEmail = `brian.valley-${stamp}@hellotocheers-test.invalid`;
  const lastName = `Pem${stamp}`;

  const browser = await chromium.launch({ headless: true });
  let leadId: string | null = null;
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${APP}/form/${EMBED}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);

    // Choose request information mode if mode picker present
    const infoMode = page.getByRole("button", { name: /Request information|Ask a question|Get information/i }).first();
    if ((await infoMode.count()) > 0) {
      await infoMode.click();
      await page.waitForTimeout(500);
    }

    const partnerEmailInput = page.locator('[data-testid="inquiry-partner-email"]');
    record("ui-partner-email-field", await partnerEmailInput.count() > 0, await partnerEmailInput.count().then(String));
    if ((await partnerEmailInput.count()) === 0) {
      await page.screenshot({ path: `${OUT}/shots/missing-partner-email-field.png`, fullPage: true });
      writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ pass: false, checks, image, digest }, null, 2));
      process.exit(1);
    }

    await page.locator('input[type="email"]').first().fill(primaryEmail).catch(async () => {
      await page.getByLabel(/Email/i).first().fill(primaryEmail);
    });
    // Fill by placeholders / labels used on the public form
    await page.getByPlaceholder(/First name/i).or(page.locator('input').nth(0)).fill("Alex").catch(() => undefined);
    // More reliable: find labels
    const inputs = page.locator("form input");
    // Prefer named testids where present
    await page.locator('[data-testid="inquiry-partner-first"]').fill("Brian");
    await page.locator('[data-testid="inquiry-partner-last"]').fill("Valley");
    await partnerEmailInput.fill(partnerEmail);

    // Primary name/email/event — scan for common fields
    await page.evaluate(({ primaryEmail: pe, last }) => {
      const form = document.querySelector("form");
      if (!form) return;
      const setByPlaceholder = (re: RegExp, value: string) => {
        const el = [...form.querySelectorAll("input,select,textarea")].find((n) => {
          const ph = (n as HTMLInputElement).placeholder ?? "";
          const aria = n.getAttribute("aria-label") ?? "";
          const lab = (n as HTMLInputElement).labels?.[0]?.textContent ?? "";
          return re.test(ph) || re.test(aria) || re.test(lab);
        }) as HTMLInputElement | HTMLSelectElement | undefined;
        if (!el) return;
        el.focus();
        if (el.tagName === "SELECT") {
          (el as HTMLSelectElement).value = value;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
          setter?.call(el, value);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      };
      setByPlaceholder(/first name/i, "Alex");
      setByPlaceholder(/^last name$/i, last);
      setByPlaceholder(/^email$/i, pe);
      setByPlaceholder(/phone/i, "5550199");
      // event type select
      const sel = form.querySelector("select");
      if (sel) {
        const wedding = [...sel.options].find((o) => /wedding/i.test(o.text) || o.value === "wedding");
        if (wedding) {
          sel.value = wedding.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }, { primaryEmail, last: lastName });

    // Preferred event date if required — pick first available day button if calendar shown
    const dayBtn = page.locator('button[data-available="true"], button[aria-label*="202"]').first();
    if ((await dayBtn.count()) > 0) {
      await dayBtn.click().catch(() => undefined);
    }

    await page.screenshot({ path: `${OUT}/shots/form-filled-1280.png`, fullPage: false });

    // Submit
    const submit = page.getByRole("button", { name: /Submit|Send|Request information/i }).first();
    await submit.click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/shots/form-after-submit-1280.png`, fullPage: false });

    const { data: lead } = await admin
      .from("leads")
      .select("id, email, partner_first_name, partner_last_name, partner_email, first_name, last_name")
      .eq("venue_id", FANCY)
      .eq("email", primaryEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    leadId = lead?.id ?? null;
    record("persisted-lead-created", Boolean(leadId), JSON.stringify({
      id: leadId,
      partner_first_name: lead?.partner_first_name,
      partner_last_name: lead?.partner_last_name,
      partner_email: redactEmail(lead?.partner_email),
      primary_email: redactEmail(lead?.email),
    }));
    record(
      "persisted-partner-email",
      lead?.partner_email?.toLowerCase() === partnerEmail.toLowerCase(),
      redactEmail(lead?.partner_email),
    );
    record(
      "persisted-partner-names",
      lead?.partner_first_name === "Brian" && lead?.partner_last_name === "Valley",
      `${lead?.partner_first_name} ${lead?.partner_last_name}`,
    );
    record(
      "persisted-primary-email-distinct",
      lead?.email?.toLowerCase() === primaryEmail.toLowerCase()
        && lead?.partner_email?.toLowerCase() !== lead?.email?.toLowerCase(),
      `primary=${redactEmail(lead?.email)} partner=${redactEmail(lead?.partner_email)}`,
    );

    if (!leadId) {
      writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ pass: false, checks, image, digest }, null, 2));
      process.exit(1);
    }

    // Lead detail / read path
    const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await staffCtx.addCookies(await staffCookies());
    const staffPage = await staffCtx.newPage();
    await staffPage.goto(`${APP}/leads/${leadId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await staffPage.waitForTimeout(3500);
    const bodyText = await staffPage.locator("body").innerText();
    record("lead-detail-shows-partner-email", bodyText.includes(partnerEmail) || bodyText.toLowerCase().includes(partnerEmail.toLowerCase()), "partner email visible on lead detail");
    record("lead-detail-shows-brian-valley", /Brian/i.test(bodyText) && /Valley/i.test(bodyText), "partner name on detail");
    await staffPage.screenshot({ path: `${OUT}/shots/lead-detail-1280.png`, fullPage: false });

    // Reload
    await staffPage.reload({ waitUntil: "domcontentloaded" });
    await staffPage.waitForTimeout(2500);
    const body2 = await staffPage.locator("body").innerText();
    record("lead-detail-reload-partner-email", body2.includes(partnerEmail), "still visible after reload");

    // Blank partner email still submits (API-level)
    const blankStamp = `${stamp}-blank`;
    const blankPrimary = `pem-blank-${blankStamp}@hellotocheers-test.invalid`;
    const blankRes = await fetch(`${APP}/api/public/inquire`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        embedKey: EMBED,
        firstName: "Casey",
        lastName: `Blank${blankStamp}`,
        email: blankPrimary,
        phone: "5550101",
        partnerFirst: "Sam",
        partnerLast: "Lee",
        partnerEmail: null,
        eventType: "wedding",
        eventDate: "2027-07-20",
        message: "blank-partner-email-ok",
      }),
    });
    const blankJson = await blankRes.json();
    const { data: blankLead } = await admin.from("leads")
      .select("id, partner_first_name, partner_last_name, partner_email, email")
      .eq("email", blankPrimary)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    record("blank-partner-email-submits", blankJson.ok === true && Boolean(blankLead?.id), JSON.stringify(blankJson));
    record(
      "blank-partner-email-null-names-kept",
      blankLead?.partner_email == null
        && blankLead?.partner_first_name === "Sam"
        && blankLead?.partner_last_name === "Lee",
      JSON.stringify(blankLead),
    );
  } finally {
    await browser.close();
  }

  const pass = checks.every((c) => c.pass);
  const payload = {
    pass,
    image,
    digest,
    expectedSha: EXPECTED || null,
    leadId,
    primaryEmailRedacted: redactEmail(primaryEmail),
    partnerEmailRedacted: redactEmail(partnerEmail),
    checks,
    at: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(payload, null, 2));
  writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify({
    leadId,
    field: "leads.partner_email",
    partnerEmailRedacted: redactEmail(partnerEmail),
    primaryEmailRedacted: redactEmail(primaryEmail),
  }, null, 2));
  console.log(pass ? "\nGREEN partner email persistence" : "\nNOT GREEN");
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
