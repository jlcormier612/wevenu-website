import { createRequire } from "node:module";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT =
  "/Users/jensmac/Library/Mobile Documents/com~apple~CloudDocs/Wevenu Website/wevenu-website";
const OUT = path.join(ROOT, "docs/qa/stripe-saas-sandbox-e2e");
const require = createRequire(path.join(ROOT, "marketing/package.json"));
const { chromium } = require("playwright");

const url = process.argv[2];
if (!url) { console.error("need url"); process.exit(1); }
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1800 } });
const log = [];
page.on("console", (m) => { if (m.type() === "error") log.push("cerr:"+m.text()); });

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(3500);
await page.screenshot({ path: path.join(OUT, "pay-01-open.png"), fullPage: true });

// Uncheck Link
const save = page.getByLabel(/save my information/i);
if (await save.count()) {
  if (await save.isChecked().catch(() => false)) {
    await save.uncheck({ force: true }).catch(() => {});
    log.push("unchecked_link");
  }
}
await page.getByRole("radio", { name: /^card$/i }).click({ force: true }).catch(() => {});
await page.waitForTimeout(1500);

async function fillFirst(sels, value, opts = {}) {
  for (const sel of sels) {
    const loc = page.locator(sel).first();
    if (!(await loc.count().catch(() => 0))) continue;
    if (!(await loc.isVisible().catch(() => false))) continue;
    await loc.click({ force: true });
    if (opts.seq) {
      await loc.fill("");
      await loc.pressSequentially(value, { delay: 25 });
    } else {
      await loc.fill(value);
    }
    return sel;
  }
  // frames
  for (const frame of page.frames()) {
    for (const sel of sels) {
      const loc = frame.locator(sel).first();
      if (!(await loc.count().catch(() => 0))) continue;
      await loc.click({ force: true }).catch(() => {});
      await loc.fill(value).catch(async () => loc.pressSequentially(value, { delay: 25 }));
      return "frame:"+sel;
    }
  }
  return null;
}

log.push("card:"+await fillFirst([
  'input[autocomplete="cc-number"]','input[name="cardnumber"]','input[placeholder*="1234"]'
], "4242424242424242", { seq: true }));
log.push("exp:"+await fillFirst([
  'input[autocomplete="cc-exp"]','input[name="exp-date"]','input[placeholder*="MM"]'
], "1234", { seq: true }));
log.push("cvc:"+await fillFirst([
  'input[autocomplete="cc-csc"]','input[name="cvc"]','input[placeholder*="CVC"]'
], "123", { seq: true }));
log.push("name:"+await fillFirst([
  'input[autocomplete="cc-name"]','input[name="billingName"]','input[name="name"]','input[autocomplete="name"]'
], "HTC E2E Tester"));

// Country US
const country = page.locator('select[name="billingCountry"], select[name="country"]').first();
if (await country.count()) await country.selectOption("US").catch(()=>{});

// Strategy: fill ZIP first (often no autocomplete), then city/state, then line1 with Escape
log.push("zip:"+await fillFirst([
  'input[autocomplete="postal-code"]','input[name="billingPostalCode"]','input[name="postalCode"]'
], "78701", { seq: true }));
log.push("city:"+await fillFirst([
  'input[autocomplete="address-level2"]','input[name="billingLocality"]','input[name="city"]'
], "Austin"));
const st = page.locator('select[name="billingAdministrativeArea"], select[name="state"]').first();
if (await st.count()) {
  await st.selectOption("TX").catch(()=>st.selectOption({label:"Texas"}).catch(()=>{}));
  log.push("state:select");
} else {
  log.push("state:"+await fillFirst(['input[autocomplete="address-level1"]','input[name="billingAdministrativeArea"]'], "TX"));
}

const line1 = page.locator('input[autocomplete="address-line1"], input[name="billingAddressLine1"], input[name="addressLine1"]').first();
if (await line1.count()) {
  await line1.click({ force: true });
  await line1.fill("");
  // Use obscure street that won't match Google suggestions strongly
  await line1.pressSequentially("500 Congress Avenue", { delay: 30 });
  await page.waitForTimeout(900);
  // Prefer selecting first suggestion (complete structured address)
  const suggestion = page.locator('[role="option"], .pac-item, [id*="PlacesAutocomplete"]').first();
  if (await suggestion.count() && await suggestion.isVisible().catch(()=>false)) {
    await suggestion.click({ force: true }).catch(()=>{});
    log.push("address:suggestion_clicked");
  } else {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);
    await page.keyboard.press("Enter");
    log.push("address:arrow_enter");
  }
  await page.waitForTimeout(1000);
  // Re-assert zip/city if wiped
  const zipNow = await page.locator('input[autocomplete="postal-code"], input[name="billingPostalCode"]').first().inputValue().catch(()=>"");
  if (!zipNow) {
    await fillFirst(['input[autocomplete="postal-code"]','input[name="billingPostalCode"]'], "78701");
    await fillFirst(['input[autocomplete="address-level2"]','input[name="city"]'], "Austin");
    if (await st.count()) await st.selectOption("TX").catch(()=>{});
    log.push("address:refilled_manual");
  } else {
    log.push("address:zip="+zipNow);
  }
}

await page.screenshot({ path: path.join(OUT, "pay-02-filled.png"), fullPage: true });

if (!log.find(l => l.startsWith("card:") && !l.endsWith(":null"))) {
  await writeFile(path.join(OUT, "pay-log.json"), JSON.stringify({log},null,2));
  console.log("FAIL no card"); process.exit(2);
}

// Click enabled Subscribe
const cta = page.getByRole("button", { name: /^Subscribe$/ });
await cta.waitFor({ state: "visible", timeout: 15000 });
for (let i=0;i<20;i++) {
  const disabled = await cta.getAttribute("disabled");
  const aria = await cta.getAttribute("aria-disabled");
  if (!disabled && aria !== "true") break;
  await page.waitForTimeout(500);
}
await cta.click({ timeout: 10000 });
log.push("clicked_subscribe");

// Wait for completion signal
let done = false;
try {
  await page.waitForURL(/pricing\/success|session_id=/i, { timeout: 120000 });
  done = true; log.push("nav:"+page.url());
} catch {}
if (!done) {
  // Stripe sometimes stays on same host briefly — wait for processing UI
  await page.waitForTimeout(15000);
  const body = await page.locator("body").innerText().catch(()=>"");
  log.push("body_snip:"+body.slice(0,400).replace(/\n/g," | "));
  const alerts = await page.locator('[role="alert"], .FieldError-container').allInnerTexts().catch(()=>[]);
  log.push("alerts:"+JSON.stringify(alerts).slice(0,400));
}

await page.screenshot({ path: path.join(OUT, "pay-03-after.png"), fullPage: true });
await writeFile(path.join(OUT, "pay-log.json"), JSON.stringify({ log, finalUrl: page.url() }, null, 2));
console.log(JSON.stringify({ log, finalUrl: page.url() }, null, 2));
await browser.close();
