/**
 * Sandbox: couple portal Inventory terminology — tab label Inventory (not Included),
 * empty vs shared states, included vs additional-fee item labels.
 * Also checks staff Client Portal Preview. Sandbox only.
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
/** Known Fancy booked event with portal session (prior inventory harnesses). */
const SHARED_EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const SHARED_CLIENT = "b4e2764b-be33-4579-89e3-0c8e4a6dd5be";
const OUT = "docs/qa/inventory-terminology";
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
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 400)}`);
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

async function ensureMixedSharedInventory() {
  const { data: inv } = await admin
    .from("event_inventory")
    .select("id,status")
    .eq("event_id", SHARED_EVENT)
    .eq("venue_id", FANCY)
    .maybeSingle();
  if (!inv) throw new Error("shared event missing event_inventory row");

  const { data: items } = await admin
    .from("event_inventory_items")
    .select("id,name,is_included,unit_price")
    .eq("event_inventory_id", inv.id);
  const list = items ?? [];
  const hasIncluded = list.some((i) => i.is_included);
  const hasPaid = list.some((i) => !i.is_included && i.unit_price != null && Number(i.unit_price) > 0);

  if (!hasIncluded) {
    await admin.from("event_inventory_items").insert({
      event_inventory_id: inv.id,
      venue_id: FANCY,
      name: "QA Included Chairs",
      quantity: 10,
      unit_price: null,
      is_included: true,
      sort_order: 0,
    });
  }
  if (!hasPaid) {
    await admin.from("event_inventory_items").insert({
      event_inventory_id: inv.id,
      venue_id: FANCY,
      name: "QA Paid Cocktail Tables",
      quantity: 4,
      unit_price: 40,
      is_included: false,
      sort_order: 1,
    });
  }

  // Ensure portal-visible share state (shared|finalized|selection statuses).
  if (!["shared", "finalized", "submitted", "confirmed", "changes_requested"].includes(inv.status)) {
    await admin
      .from("event_inventory")
      .update({ status: "shared", shared_at: new Date().toISOString() })
      .eq("id", inv.id);
  }

  return inv.id as string;
}

/** Find a Fancy booked event whose inventory is absent or not portal-shared. */
async function findUnsharedEventId(): Promise<string | null> {
  const { data: events } = await admin
    .from("events")
    .select("id")
    .eq("venue_id", FANCY)
    .neq("id", SHARED_EVENT)
    .order("created_at", { ascending: false })
    .limit(40);
  for (const e of events ?? []) {
    const { data: inv } = await admin
      .from("event_inventory")
      .select("id,status")
      .eq("event_id", e.id)
      .maybeSingle();
    if (!inv) return e.id as string;
    if (!["shared", "finalized", "submitted", "confirmed", "changes_requested"].includes(inv.status)) {
      return e.id as string;
    }
  }
  return null;
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const image = await servingImage();
  record(
    "Serving expected SHA",
    image.includes(EXPECTED.slice(0, 12)),
    `image=${image || "unknown"} expected=${EXPECTED.slice(0, 12)}`,
  );

  await ensureMixedSharedInventory();

  const { data: portal } = await admin
    .from("client_portal_sessions")
    .select("access_token")
    .eq("client_id", SHARED_CLIENT)
    .eq("event_id", SHARED_EVENT)
    .limit(1)
    .maybeSingle();
  const token = portal?.access_token;
  if (!token) throw new Error("missing portal token for shared event");

  const browser = await chromium.launch({ headless: true });
  try {
    // --- Couple portal: shared mixed inventory ---
    for (const [w, h, label] of [
      [1280, 900, "1280"],
      [390, 844, "390"],
    ] as const) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await page.goto(`${APP}/portal/${token}?section=inventory`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(1400);

      const body = await page.locator("body").innerText();
      const navLabels = await page.evaluate(() => {
        // Bottom/side nav uses shortLabel or label on section buttons.
        return Array.from(document.querySelectorAll("button, a"))
          .map((n) => (n.textContent || "").replace(/\s+/g, " ").trim())
          .filter((t) => t.length > 0 && t.length < 40);
      });
      record(
        `shared@${label}: Inventory nav label present`,
        navLabels.some((t) => /\bInventory\b/.test(t)) || /Inventory/.test(body),
        navLabels.filter((t) => /Invent|Includ|Order/i.test(t)).join(" | "),
      );
      record(
        `shared@${label}: no nav item labeled only Included`,
        !navLabels.some((t) => t === "Included" || t === "🪑 Included" || /^🪑\s*Included$/.test(t)),
        navLabels.filter((t) => /Includ/i.test(t)).join(" | ") || "(none)",
      );

      const view = page.locator('[data-testid="inventory-portal-view"]');
      const empty = page.locator('[data-testid="inventory-portal-empty"]');
      const sharedVisible = await view.count();
      record(`shared@${label}: shared view`, sharedVisible > 0, `view=${sharedVisible} empty=${await empty.count()}`);

      if (sharedVisible > 0) {
        const intro = await page.locator('[data-testid="inventory-portal-intro"]').innerText().catch(() => "");
        record(
          `shared@${label}: neutral intro`,
          /package-included items and available add-ons/i.test(intro),
          intro,
        );
        record(
          `shared@${label}: heading not What's included`,
          !/What.?s included in your event/i.test(body),
          "heading check",
        );
        const includedLabels = await page.locator('[data-testid="inventory-item-included-label"]').allInnerTexts();
        const additionalLabels = await page.locator('[data-testid="inventory-item-additional-label"]').allInnerTexts();
        record(
          `shared@${label}: included item label`,
          includedLabels.some((t) => /Included — no extra charge/.test(t)),
          JSON.stringify(includedLabels),
        );
        record(
          `shared@${label}: additional fee label`,
          additionalLabels.some((t) => /Additional fee/.test(t)),
          JSON.stringify(additionalLabels),
        );
      }

      await page.screenshot({ path: `${OUT}/shots/portal-shared-dark-${label}.png`, fullPage: false });
      // Prefer light screenshot name without theme claim
      await page.screenshot({ path: `${OUT}/shots/portal-shared-${label}.png`, fullPage: false });
      await ctx.close();
    }

    // --- Unshared inventory empty state (staff preview preferred; portal if token) ---
    const unsharedEventId = await findUnsharedEventId();
    const cookies = await staffCookies();
    const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await staffCtx.addCookies(cookies);
    const staffPage = await staffCtx.newPage();

    if (unsharedEventId) {
      await staffPage.goto(`${APP}/events/${unsharedEventId}?tab=overview`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await staffPage.waitForTimeout(1200);
      // Open Client Portal Preview if available
      const previewBtn = staffPage.getByRole("button", { name: /portal preview|client portal preview/i }).first();
      if (await previewBtn.count()) {
        await previewBtn.click().catch(() => undefined);
        await staffPage.waitForTimeout(800);
        const invTab = staffPage.getByRole("button", { name: /^Inventory$/i }).or(
          staffPage.getByText("Inventory", { exact: true }),
        );
        if (await invTab.count()) {
          await invTab.first().click().catch(() => undefined);
          await staffPage.waitForTimeout(600);
        }
      } else {
        // Direct preview route if product exposes one
        await staffPage.goto(`${APP}/events/${unsharedEventId}?preview=portal&section=inventory`, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        }).catch(() => undefined);
        await staffPage.waitForTimeout(1000);
      }
      await staffPage.screenshot({ path: `${OUT}/shots/preview-or-unshared-1280.png`, fullPage: false });
      const staffBody = await staffPage.locator("body").innerText();
      record(
        "unshared/preview: Not shared yet or Inventory branding",
        /Not shared yet/i.test(staffBody) || /Inventory/i.test(staffBody),
        staffBody.slice(0, 500),
      );
      record(
        "unshared/preview: empty does not claim shared package",
        !/what your venue is including for this celebration/i.test(staffBody),
        "legacy empty copy absent",
      );
    } else {
      record("unshared event available", false, "no Fancy event without shared inventory");
    }

    // Staff preview of shared event inventory section
    await staffPage.goto(`${APP}/events/${SHARED_EVENT}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await staffPage.waitForTimeout(1500);
    const previewTrigger = staffPage.getByRole("button", { name: /Client Portal Preview|Portal preview/i }).first();
    if (await previewTrigger.count()) {
      await previewTrigger.click();
      await staffPage.waitForTimeout(1000);
      const inv = staffPage.getByRole("tab", { name: /Inventory/i }).or(
        staffPage.getByRole("button", { name: /^Inventory$/ }),
      );
      if (await inv.count()) await inv.first().click().catch(() => undefined);
      await staffPage.waitForTimeout(800);
    }
    await staffPage.screenshot({ path: `${OUT}/shots/staff-preview-shared-1280.png`, fullPage: false });
    const previewBody = await staffPage.locator("body").innerText();
    record(
      "staff preview: Inventory label",
      /Inventory/.test(previewBody),
      "preview surface",
    );
    record(
      "staff preview: no What's included heading",
      !/What.?s included in your event/i.test(previewBody),
      previewBody.slice(0, 400),
    );
    await staffCtx.close();
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
        sharedEvent: SHARED_EVENT,
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
