/**
 * C3 closure — Event commercial status strip + anchors (read-mostly).
 * No Share / Finalize / Send / Create Invoice / payment-plan mutations.
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
const CLIENT = "b4e2764b-be33-4579-89e3-0c8e4a6dd5be";
const OUT = "docs/qa/commercial-workflow-consolidation";
mkdirSync(`${OUT}/shots-c3`, { recursive: true });

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

const INV_LABEL: Record<string, string> = {
  draft: "Draft",
  shared: "Awaiting client",
  submitted: "Needs venue review",
  changes_requested: "Awaiting client",
  confirmed: "Confirmed",
  finalized: "Finalized",
};

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const image = await servingImage();
  record(
    "Serving expected SHA",
    image.includes(EXPECTED.slice(0, 12)),
    `image=${image || "unknown"} expected=${EXPECTED.slice(0, 12)}`,
  );

  // Persisted commercial state for strip accuracy (read-only)
  const { data: invRow } = await admin
    .from("event_inventory")
    .select("id, status")
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY)
    .maybeSingle();
  const { data: eoRow } = await admin
    .from("event_orders")
    .select("id, status, shared_at")
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY)
    .maybeSingle();
  const { count: choiceCount } = await admin
    .from("client_choices")
    .select("id", { count: "exact", head: true })
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY);
  const { count: invBefore } = await admin
    .from("event_inventory")
    .select("id", { count: "exact", head: true })
    .eq("event_id", EVENT);
  const { count: eoLinesBefore } = eoRow?.id
    ? await admin
        .from("event_order_lines")
        .select("id", { count: "exact", head: true })
        .eq("event_order_id", eoRow.id)
    : { count: 0 };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  // A — Fixed Event Order path: strip + panels without requiring choice groups; no strip actions
  await page.goto(`${APP}/events/${EVENT}?tab=event-order`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1800);
  const strip = page.getByTestId("event-commercial-status-strip");
  const stripText = (await strip.innerText().catch(() => "")) || "";
  record(
    "A Strip present as commercial home",
    (await strip.count()) > 0 && /Commercial workspace/i.test(stripText),
    stripText.slice(0, 350) || "missing",
  );
  record(
    "A Copy: separate workflows + finalize ≠ share",
    /Inventory selection and client-selectable choices are separate/i.test(stripText)
      && /finalizing is distinct from sharing/i.test(stripText),
    stripText.slice(0, 280),
  );
  record(
    "A Anchors + Open Inventory present",
    (await page.getByTestId("commercial-anchor-choices").count()) > 0
      && (await page.getByTestId("commercial-anchor-order").count()) > 0
      && (await page.getByTestId("commercial-anchor-invoice").count()) > 0
      && (await page.getByTestId("commercial-open-inventory").count()) > 0,
    "subnav",
  );
  const stripHtml = (await strip.innerHTML().catch(() => "")) || "";
  record(
    "A Strip has no Share/Finalize/Send authoritative controls",
    !/data-testid="[^"]*(share-event|finalize-event|send-client|shareEvent|finalizeEvent|sendClient)/i.test(stripHtml)
      && !(await strip.getByRole("button", { name: /^(Share|Finalize|Send|Share with Client|Send to Client)$/i }).count()),
    "deep-link chips only",
  );
  record(
    "A Choices + Event Order panels still mounted (Path A does not require groups)",
    (await page.getByTestId("event-order-choices").count()) > 0
      && (await page.getByTestId("event-order-order").count()) > 0,
    `choicesPanel=${await page.getByTestId("event-order-choices").count()} orderPanel=${await page.getByTestId("event-order-order").count()}`,
  );
  const eoChip = page.getByTestId("commercial-chip-event_order");
  const eoChipText = (await eoChip.innerText().catch(() => "")) || "";
  if (eoRow) {
    const expectEo = eoRow.shared_at
      ? "Shared"
      : eoRow.status === "finalized"
        ? "Finalized — not shared"
        : "Draft";
    record(
      "A Event Order chip matches persisted finalize≠share",
      eoChipText.includes(expectEo),
      `chip=${eoChipText} db status=${eoRow.status} shared_at=${eoRow.shared_at} expect=${expectEo}`,
    );
  } else {
    record(
      "A Event Order chip Not started when no EO",
      /Not started/i.test(eoChipText),
      eoChipText,
    );
  }
  await page.screenshot({ path: `${OUT}/shots-c3/A-fixed-eo-strip-1280.png`, fullPage: true });

  // B — Pending inventory selection: chip + Open Inventory deep link
  const invChip = page.getByTestId("commercial-chip-inventory");
  const invChipText = (await invChip.innerText().catch(() => "")) || "";
  if (invRow?.status) {
    const expectInv = INV_LABEL[invRow.status] ?? invRow.status;
    record(
      "B Inventory chip matches persisted status",
      invChipText.includes(expectInv),
      `chip=${invChipText} db=${invRow.status} expect=${expectInv}`,
    );
    record(
      "B Client submission not shown as venue confirmation",
      invRow.status === "submitted"
        ? /Needs venue review/i.test(invChipText) && !/Confirmed|Finalized/i.test(invChipText)
        : invRow.status === "shared"
          ? /Awaiting client/i.test(invChipText) && !/Confirmed|Finalized/i.test(invChipText)
          : true,
      `status=${invRow.status} chip=${invChipText}`,
    );
  } else {
    record(
      "B Inventory chip Not started when no inventory",
      /Not started/i.test(invChipText),
      invChipText,
    );
    record("B Client submission not shown as venue confirmation", true, "no inventory row");
  }

  await page.getByTestId("commercial-open-inventory").click();
  await page.waitForTimeout(1200);
  const invTab = page.getByTestId("booked-tab-row-1").getByRole("tab", { name: /^Inventory$/i });
  const invActiveAttr =
    (await invTab.getAttribute("data-active"))
    ?? (await invTab.getAttribute("aria-selected"))
    ?? (await invTab.getAttribute("data-state"));
  const invTabActive =
    invActiveAttr === ""
    || invActiveAttr === "true"
    || invActiveAttr === "active"
    || (await page.getByTestId("booked-tab-row-1").locator('[data-slot="tabs-trigger"][data-active]').filter({ hasText: /^Inventory$/i }).count()) > 0;
  const invPanelVisible = /Event Inventory/i.test(await page.locator("body").innerText());
  record(
    "B Open Inventory reaches Inventory tab",
    (invTabActive || invPanelVisible) && /#inventory/i.test(page.url()),
    `url=${page.url()} activeAttr=${invActiveAttr} panel=${invPanelVisible}`,
  );
  await page.screenshot({ path: `${OUT}/shots-c3/B-open-inventory-1280.png`, fullPage: true });

  // C — Client-selectable choices: separate chip + anchor; panels remain distinct
  await page.goto(`${APP}/events/${EVENT}?tab=event-order`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1500);
  const choicesChip = page.getByTestId("commercial-chip-choices");
  record(
    "C Choices chip present (separate from Inventory)",
    (await choicesChip.count()) > 0 && (await invChip.count()) > 0,
    `choices=${await choicesChip.count()} inventory=${await page.getByTestId("commercial-chip-inventory").count()} choiceRows=${choiceCount ?? 0}`,
  );
  await page.getByTestId("commercial-anchor-choices").click();
  await page.waitForTimeout(900);
  const stripStill = (await page.getByTestId("event-commercial-status-strip").count()) > 0;
  const choicesVisible = await page.getByTestId("event-order-choices").isVisible().catch(() => false);
  const choicesText = (await page.getByTestId("event-order-choices").innerText().catch(() => "")) || "";
  record(
    "C Choices anchor scrolls to client_choices panel",
    stripStill && choicesVisible && /Client selections|Choices|selection/i.test(choicesText),
    `strip=${stripStill} hash=${await page.evaluate(() => location.hash)} ${choicesText.slice(0, 200) || `visible=${choicesVisible}`}`,
  );
  await page.getByTestId("commercial-anchor-order").click();
  await page.waitForTimeout(900);
  record(
    "C Event Order anchor reaches order panel",
    stripStill
      && (await page.getByTestId("event-order-order").isVisible().catch(() => false))
      && (await page.getByTestId("event-commercial-status-strip").count()) > 0,
    `hash=${await page.evaluate(() => location.hash)}`,
  );
  await page.screenshot({ path: `${OUT}/shots-c3/C-choices-anchor-1280.png`, fullPage: true });

  // D — Finance handoff: invoice chip/anchor; strip does not create invoice/plan
  await page.getByTestId("commercial-anchor-invoice").click();
  await page.waitForTimeout(1000);
  const invoiceAnchor = page.getByTestId("event-order-invoice");
  const invoiceVisible = (await invoiceAnchor.count()) > 0;
  const invoiceText = (await invoiceAnchor.innerText().catch(() => "")) || "";
  record(
    "D Invoice anchor reaches existing EO invoice link",
    invoiceVisible,
    invoiceText.slice(0, 240) || "anchor missing — EO may lack priced content",
  );
  const invoiceChip = page.getByTestId("commercial-chip-invoice");
  const invoiceChipText = (await invoiceChip.innerText().catch(() => "")) || "";
  record(
    "D Invoice chip is status/deep-link only",
    (await invoiceChip.count()) > 0 && /Invoice/i.test(invoiceChipText),
    invoiceChipText,
  );
  record(
    "D Strip does not expose Create Invoice / Payment Plan primary actions",
    !(await strip.getByRole("button", { name: /Create (Invoice|Payment Plan)/i }).count()),
    "no finance create on strip",
  );
  await page.screenshot({ path: `${OUT}/shots-c3/D-invoice-anchor-1280.png`, fullPage: true });

  // E — Navigation / regression: tabs + portal + C1/C2 surfaces
  await page.goto(`${APP}/events/${EVENT}?tab=inventory`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1000);
  record(
    "E Inventory tab intact",
    /Event Inventory|Inventory/i.test(await page.locator("body").innerText()),
    "inventory tab",
  );
  await page.goto(`${APP}/events/${EVENT}?tab=invoice`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1000);
  record(
    "E Payments tab intact",
    /Payment|Invoice/i.test(await page.locator("body").innerText()),
    "payments",
  );

  await page.goto(`${APP}/library`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1000);
  const hub = await page.locator("body").innerText();
  record(
    "E C2 Library Packages ≠ Event Order Templates intact",
    /Distinct from Event Order Templates/i.test(hub) && /Distinct from sales Packages/i.test(hub),
    "library hub",
  );

  await page.goto(`${APP}/events/${EVENT}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1200);
  if ((await page.getByTestId("event-setup-panel").count()) === 0) {
    const show = page.getByRole("button", { name: /Show setup/i });
    if (await show.count()) await show.click().catch(() => {});
    await page.waitForTimeout(600);
  }
  const setupText = (await page.getByTestId("event-setup-panel").innerText().catch(() => "")) || "";
  record(
    "E C1 Setup readiness links intact",
    /Open Inventory/i.test(setupText) || /readiness/i.test(setupText) || (await page.getByTestId("event-setup-open-inventory").count()) > 0,
    setupText.slice(0, 280) || "setup panel",
  );

  const { data: portal } = await admin
    .from("client_portal_sessions")
    .select("access_token")
    .eq("client_id", CLIENT)
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const token = portal?.access_token as string | undefined;
  if (token) {
    const portalPage = await context.newPage();
    for (const section of ["inventory", "event-order", "choices"] as const) {
      await portalPage.goto(`${APP}/p/${token}#${section}`, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
      await portalPage.waitForTimeout(1200);
      const t = await portalPage.locator("body").innerText();
      const ok =
        section === "inventory"
          ? /Inventory/i.test(t) && !/This page could not be found/i.test(t)
          : section === "event-order"
            ? /Event Order|order/i.test(t) && !/This page could not be found/i.test(t)
            : (/Choice|selection|Your Choices/i.test(t) || /not available|not shared|no choices|nothing to choose/i.test(t))
              && !/This page could not be found/i.test(t);
      record(`E Portal ${section} reachable`, ok, t.slice(0, 200));
      await portalPage.screenshot({
        path: `${OUT}/shots-c3/E-portal-${section}-1280.png`,
        fullPage: true,
      });
    }
    await portalPage.close();
  } else {
    record("E Portal sections", false, "no portal session token");
  }

  // Mobile strip accessibility
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${APP}/events/${EVENT}?tab=event-order`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1400);
  record(
    "E Strip + Open Inventory visible at 390",
    (await page.getByTestId("event-commercial-status-strip").count()) > 0
      && (await page.getByTestId("commercial-open-inventory").isVisible().catch(() => false)),
    "390",
  );
  await page.getByTestId("commercial-open-inventory").click();
  await page.waitForTimeout(1000);
  record(
    "E Open Inventory works at 390",
    /#inventory/i.test(page.url())
      && /Event Inventory/i.test(await page.locator("body").innerText()),
    page.url(),
  );
  await page.screenshot({ path: `${OUT}/shots-c3/E-strip-390.png`, fullPage: true });

  // Duplicate-record check: navigation-only session must not create rows
  const { count: invAfter } = await admin
    .from("event_inventory")
    .select("id", { count: "exact", head: true })
    .eq("event_id", EVENT);
  const { count: eoLinesAfter } = eoRow?.id
    ? await admin
        .from("event_order_lines")
        .select("id", { count: "exact", head: true })
        .eq("event_order_id", eoRow.id)
    : { count: 0 };
  const { count: choiceAfter } = await admin
    .from("client_choices")
    .select("id", { count: "exact", head: true })
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY);
  record(
    "E No duplicate inventory/choices/EO lines from strip navigation",
    invBefore === invAfter && eoLinesBefore === eoLinesAfter && choiceCount === choiceAfter,
    `inv ${invBefore}->${invAfter} lines ${eoLinesBefore}->${eoLinesAfter} choices ${choiceCount}->${choiceAfter}`,
  );

  await browser.close();

  const failed = checks.filter((c) => !c.pass);
  writeFileSync(
    `${OUT}/browser-results-c3.json`,
    JSON.stringify(
      {
        expectedSha: EXPECTED,
        servingImage: image,
        passed: failed.length === 0,
        checks,
        persisted: {
          inventoryStatus: invRow?.status ?? null,
          eventOrderStatus: eoRow?.status ?? null,
          eventOrderSharedAt: eoRow?.shared_at ?? null,
          choiceCount: choiceCount ?? 0,
        },
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  if (failed.length) {
    console.error(`FAILED ${failed.length}/${checks.length}`);
    process.exit(1);
  }
  console.log(`ALL PASS ${checks.length}/${checks.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
