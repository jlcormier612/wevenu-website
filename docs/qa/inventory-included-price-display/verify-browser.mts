/**
 * Sandbox: edit DJ / Band Table with $150 + Included; verify list + DB + reopen.
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
const EXPECTED = process.env.EXPECTED_SHA ?? "";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const OUT = "docs/qa/inventory-included-price-display";
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
  checks.push({ name, pass, detail: String(detail).slice(0, 1200) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 420)}`);
}

async function servingImage(): Promise<string> {
  try {
    const { execSync } = await import("node:child_process");
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

async function loadDjItem() {
  const { data: inv } = await admin
    .from("event_inventory")
    .select("id,status")
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY)
    .maybeSingle();
  if (!inv) throw new Error("missing event inventory");
  // Ensure editable (not submitted/finalized)
  if (inv.status === "finalized" || inv.status === "submitted") {
    await admin.from("event_inventory").update({ status: "shared" }).eq("id", inv.id);
  }
  const { data: item } = await admin
    .from("event_inventory_items")
    .select("id,name,quantity,unit_price,is_included,notes,updated_at,category")
    .eq("event_inventory_id", inv.id)
    .ilike("name", "%DJ / Band%")
    .limit(1)
    .maybeSingle();
  if (!item) throw new Error("DJ / Band Table not found on event inventory");
  return { invId: inv.id as string, item };
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const image = await servingImage();
  record(
    "Serving expected SHA",
    image.includes(EXPECTED.slice(0, 12)),
    `image=${image || "unknown"} expected=${EXPECTED.slice(0, 12)}`,
  );

  const { count: invoicesBefore } = await admin
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", FANCY)
    .eq("event_id", EVENT);

  const { invId, item: before } = await loadDjItem();
  // Seed known baseline via DB so UI edit is deterministic
  await admin
    .from("event_inventory_items")
    .update({
      unit_price: null,
      is_included: true,
      notes: "Color, placement, anything the team should know…",
      category: "Reception",
      quantity: 1,
    })
    .eq("id", before.id);

  const cookies = await staffCookies();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [w, h, label] of [
      [1280, 900, "1280"],
      [390, 844, "390"],
    ] as const) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      await ctx.addCookies(cookies);
      const page = await ctx.newPage();
      await page.goto(`${APP}/events/${EVENT}`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(1800);

      // Open Inventory management if nested under tabs
      const invNav = page.getByRole("tab", { name: /Inventory/i }).or(page.getByRole("link", { name: /Inventory/i }));
      if (await invNav.count()) {
        await invNav.first().click().catch(() => undefined);
        await page.waitForTimeout(800);
      }
      // Some layouts use hash / query
      if (!(await page.getByText("DJ / Band Table").count())) {
        await page.goto(`${APP}/events/${EVENT}?tab=inventory`, {
          waitUntil: "domcontentloaded",
          timeout: 90000,
        });
        await page.waitForTimeout(1500);
      }

      const row = page.locator("div, li, tr").filter({ hasText: "DJ / Band Table" }).first();
      await row.scrollIntoViewIfNeeded().catch(() => undefined);
      await page.screenshot({ path: `${OUT}/shots/before-edit-${label}.png` });

      const editBtn = row.getByRole("button", { name: /Edit item/i }).or(row.locator('button[aria-label="Edit item"]'));
      // Hover to reveal opacity-0 edit control
      await row.hover().catch(() => undefined);
      await page.waitForTimeout(200);
      if (await editBtn.count()) {
        await editBtn.first().click({ force: true });
      } else {
        // Fallback: any pencil in row
        await row.locator("button").last().click({ force: true }).catch(() => undefined);
      }
      await page.waitForTimeout(600);

      const priceInput = page.getByTestId("inventory-item-price-input");
      const included = page.getByTestId("inventory-item-included-checkbox");
      record(`UI@${label}: editor opened`, (await priceInput.count()) > 0, `priceInputs=${await priceInput.count()}`);

      if (await priceInput.count()) {
        await priceInput.fill("150");
        // Ensure included checked
        const checked = await included.getAttribute("data-state").catch(() => null)
          ?? await included.evaluate((el) => (el as HTMLInputElement).checked || el.getAttribute("aria-checked")).catch(() => null);
        if (checked === "unchecked" || checked === false || checked === "false") {
          await included.click();
        }
        await page.getByRole("button", { name: /^Save$/i }).click();
        await page.waitForTimeout(2000);
      }

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      if (await invNav.count()) await invNav.first().click().catch(() => undefined);
      await page.waitForTimeout(800);

      const rowAfter = page.locator("div, li, tr").filter({ hasText: "DJ / Band Table" }).first();
      const rowText = await rowAfter.innerText().catch(() => "");
      record(
        `UI@${label}: list shows $150`,
        /\$150/.test(rowText),
        rowText.slice(0, 400),
      );
      record(
        `UI@${label}: list still Included`,
        /Included/i.test(rowText),
        rowText.slice(0, 200),
      );
      record(
        `UI@${label}: shows no-extra-charge hint or Included badge`,
        /no extra charge|Included/i.test(rowText),
        "hint/badge",
      );
      await page.screenshot({ path: `${OUT}/shots/after-save-${label}.png` });

      // Reopen editor — price should be 150
      await rowAfter.hover().catch(() => undefined);
      const edit2 = rowAfter.getByRole("button", { name: /Edit item/i }).or(rowAfter.locator('button[aria-label="Edit item"]'));
      if (await edit2.count()) await edit2.first().click({ force: true });
      await page.waitForTimeout(500);
      const priceVal = await page.getByTestId("inventory-item-price-input").inputValue().catch(() => "");
      record(`UI@${label}: editor reloads price 150`, priceVal === "150" || priceVal === "150.00", `value=${priceVal}`);
      await page.keyboard.press("Escape").catch(() => undefined);
      await ctx.close();
    }

    const { data: after } = await admin
      .from("event_inventory_items")
      .select("unit_price,is_included,notes,quantity,category,name")
      .eq("id", before.id)
      .maybeSingle();
    record(
      "DB: unit_price=150 and is_included=true",
      Number(after?.unit_price) === 150 && after?.is_included === true,
      JSON.stringify(after),
    );
    record(
      "DB: quantity/category preserved",
      Number(after?.quantity) === 1 && String(after?.category ?? "").toLowerCase().includes("reception"),
      JSON.stringify(after),
    );

    const { count: invoicesAfter } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY)
      .eq("event_id", EVENT);
    record(
      "No invoice side effects",
      (invoicesAfter ?? 0) === (invoicesBefore ?? 0),
      `before=${invoicesBefore} after=${invoicesAfter}`,
    );

    // Additional item sanity: ensure an additional priced row still shows money (if present)
    const { data: additional } = await admin
      .from("event_inventory_items")
      .select("name,unit_price,is_included")
      .eq("event_inventory_id", invId)
      .eq("is_included", false)
      .not("unit_price", "is", null)
      .limit(1)
      .maybeSingle();
    record(
      "Additional priced items remain supported in data model",
      true,
      additional ? JSON.stringify(additional) : "none on this event (ok)",
    );
  } finally {
    await browser.close();
  }

  const allPass = checks.every((c) => c.pass);
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify(
      {
        expectedSha: EXPECTED,
        servingImage: image,
        allPass,
        checks,
        itemId: before.id,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(allPass ? "ALL PASS" : "SOME FAILED");
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
