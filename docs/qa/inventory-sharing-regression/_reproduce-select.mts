/**
 * One-off reproduce: Ursula Select click → client_selectable + Share enablement.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const MEADOW = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const EMAIL = "jlcormier612@gmail.com";
const EVENT = "971849b2-2223-40e8-bb38-f66fb7c57a2b";
const dance = "f1c2c39c-df1c-4e36-a475-618e2fc4ea8c";
const dj = "53bb640e-c404-406d-a086-9ce904b1b1cc";
const OUT = "docs/qa/inventory-sharing-regression/shots";
mkdirSync(OUT, { recursive: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

async function main() {
  await admin
    .from("event_inventory_items")
    .update({ client_selectable: false, max_quantity: null })
    .in("id", [dance, dj]);

  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  await admin.from("venue_staff_active_context").upsert({
    user_id: otp.session.user.id,
    active_venue_id: MEADOW,
  });

  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  const cookies = [
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
      value: MEADOW,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("console", (m: { type: () => string; text: () => string }) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e: Error) => errors.push(String(e)));

  const responses: { url: string; status: number }[] = [];
  page.on("response", (r: { url: () => string; status: () => number }) => {
    const u = r.url();
    if (u.includes("event-inventory") || u.includes("_next") || u.includes(EVENT)) {
      if (r.status() >= 400 || u.includes("action")) {
        responses.push({ url: u.slice(0, 180), status: r.status() });
      }
    }
  });

  await page.goto(`${APP}/events/${EVENT}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(3500);
  // Prefer inventory tab/hash
  const invTab = page.getByRole("tab", { name: /Inventory/i }).or(page.getByRole("link", { name: /Inventory/i }));
  if (await invTab.count()) {
    await invTab.first().click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(1500);
  }
  await page.evaluate(() => {
    window.location.hash = "inventory";
    document
      .querySelector('[data-testid="inventory-share-for-selection"]')
      ?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/reproduce-before-select.png`, fullPage: true });

  const shareBefore = page.getByTestId("inventory-share-for-selection");
  const shareCount = await shareBefore.count();
  const disabledBefore = shareCount ? await shareBefore.isDisabled() : null;
  const danceToggle = page.getByTestId(`inventory-item-select-toggle-${dance}`);
  const danceCount = await danceToggle.count();
  const body = await page.locator("body").innerText();
  console.log(
    JSON.stringify({
      shareCount,
      disabledBefore,
      danceCount,
      hasDanceFloor: /Dance Floor/i.test(body),
      hasSelectWord: /\bSelect\b/.test(body),
      hasDisabledReason: /Share for selection is unavailable/i.test(body),
      title: await page.title(),
    }),
  );

  if (!danceCount) {
    // dump candidate testids
    const ids = await page.evaluate(() =>
      [...document.querySelectorAll("[data-testid]")].map((el) => el.getAttribute("data-testid")).filter((t) => t?.includes("inventory") || t?.includes("select")),
    );
    console.log("inventory testids", ids);
    await page.screenshot({ path: `${OUT}/reproduce-no-toggle.png`, fullPage: true });
    await browser.close();
    return;
  }

  await danceToggle.click({ force: true });
  await page.waitForTimeout(3000);

  const { data: afterClick } = await admin
    .from("event_inventory_items")
    .select("id,client_selectable")
    .eq("id", dance)
    .single();
  const shareDisabledAfter = await shareBefore.isDisabled();
  const toggleText = await danceToggle.innerText();
  const reasonAfter = await page.getByTestId("inventory-share-selection-disabled-reason").count();
  await page.screenshot({ path: `${OUT}/reproduce-after-select.png`, fullPage: true });

  console.log(
    JSON.stringify(
      {
        afterClick,
        shareDisabledAfter,
        toggleText,
        reasonAfter,
        errors: errors.slice(0, 15),
        responses: responses.slice(0, 20),
      },
      null,
      2,
    ),
  );

  // revert
  await admin
    .from("event_inventory_items")
    .update({ client_selectable: false, max_quantity: null })
    .in("id", [dance, dj]);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
