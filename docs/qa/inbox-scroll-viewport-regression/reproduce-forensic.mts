/**
 * Read-only Inbox expand/collapse scroll forensic (Sandbox).
 * Deep-links a high-email client conversation. No sends.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const OUT = "docs/qa/inbox-scroll-viewport-regression";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
/** Client conversation with many emails (Fancy Sandbox). */
const CONVERSATION = "e389ecd5-4c11-42ca-af5f-4896c76df69b";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

mkdirSync(OUT, { recursive: true });

async function cookiesFor() {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: FANCY_EMAIL,
  });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map(
      (c: { name: string; value: string }) => ({
        name: c.name,
        value: c.value,
        domain: "app.sandbox.hellotocheers.com",
        path: "/",
        httpOnly: false,
        secure: true,
        sameSite: "Lax" as const,
      }),
    ),
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

type Metrics = Record<string, unknown>;

async function measure(page: { evaluate: (s: string) => Promise<Metrics> }): Promise<Metrics> {
  return page.evaluate(`(() => {
    const main = document.querySelector("[data-workspace-main]");
    const cards = Array.from(document.querySelectorAll("div.rounded-sm.border.bg-card"));
    const row =
      cards.find((el) => {
        const cs = getComputedStyle(el);
        return (
          (cs.display === "flex" || cs.display === "inline-flex")
          && String(el.className).includes("min-h-")
          && el.children.length >= 2
        );
      }) || cards[0] || null;

    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        className: String(el.className).slice(0, 180),
        height: Math.round(r.height),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        scrollTop: Math.round(el.scrollTop),
        overflowY: cs.overflowY,
        minHeight: cs.minHeight,
        alignSelf: cs.alignSelf,
        position: cs.position,
      };
    };

    const threadCol = row && row.children[1] ? row.children[1] : null;
    const listCol = row && row.children[0] ? row.children[0] : null;
    const collapsedMsg = Array.from(document.querySelectorAll('button[aria-expanded="false"]')).filter((b) =>
      String(b.className).includes("max-w-[min(42rem") || String(b.className).includes("rounded-lg border border-border/70")
    ).length;
    const collapseBtns = Array.from(document.querySelectorAll("button")).filter((b) =>
      (b.textContent || "").trim() === "Collapse"
    ).length;

    let whiteGapHeuristic = null;
    if (main && row) {
      const mainRect = main.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      whiteGapHeuristic = {
        rowBottomInViewport: Math.round(rowRect.bottom),
        mainBottomInViewport: Math.round(mainRect.bottom),
        gapBelowRowPx: Math.round(mainRect.bottom - rowRect.bottom),
        mainScrollHeight: main.scrollHeight,
        mainClientHeight: main.clientHeight,
        mainScrollTop: Math.round(main.scrollTop),
        mainMaxScroll: main.scrollHeight - main.clientHeight,
        rowOffsetHeight: row.offsetHeight,
        innerContentHeight: main.firstElementChild ? main.firstElementChild.scrollHeight : null,
      };
    }

    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      documentOverflowY: getComputedStyle(document.documentElement).overflowY,
      bodyOverflowY: getComputedStyle(document.body).overflowY,
      main: box(main),
      listCol: box(listCol),
      threadCol: box(threadCol),
      workspaceRow: box(row),
      collapsedMessageButtons: collapsedMsg,
      collapseButtons: collapseBtns,
      whiteGapHeuristic,
    };
  })()`);
}

async function setMainScroll(page: { evaluate: (s: string) => Promise<unknown> }, top: number | "end") {
  await page.evaluate(`(() => {
    const main = document.querySelector("[data-workspace-main]");
    if (!main) return;
    main.scrollTop = ${top === "end" ? "main.scrollHeight" : String(top)};
  })()`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addCookies(await cookiesFor());
  const page = await context.newPage();
  const log: Record<string, unknown> = {
    at: new Date().toISOString(),
    conversationId: CONVERSATION,
  };

  await page.goto(`${APP}/messaging?conversation=${CONVERSATION}`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/01-conversation-open.png`, fullPage: false });
  log.afterOpen = await measure(page);

  // Control: scroll without expanding
  await setMainScroll(page, 500);
  await page.waitForTimeout(200);
  await setMainScroll(page, 0);
  await page.waitForTimeout(200);
  log.controlAfterScroll = await measure(page);

  const collapsedLocator = page.locator('button[aria-expanded="false"]').filter({
    has: page.locator("span.truncate"),
  });
  // Prefer message cards: class includes max-w
  const msgCollapsed = page.locator('button[aria-expanded="false"]').filter({
    hasText: /Email|Text|Portal|Note|You|System/i,
  });

  let available = await msgCollapsed.count();
  if (available < 2) available = await collapsedLocator.count();
  log.collapsedAvailable = available;

  const expandN = Math.min(available, 4);
  for (let i = 0; i < expandN; i++) {
    const target = (await msgCollapsed.count()) > 0 ? msgCollapsed.first() : collapsedLocator.first();
    if ((await target.count()) === 0) break;
    // Skip nav sheet trigger
    const label = await target.getAttribute("aria-label");
    if (label === "Open navigation") {
      // click second
      await msgCollapsed.nth(1).click({ timeout: 5000 }).catch(async () => {
        await collapsedLocator.nth(1).click({ timeout: 5000 });
      });
    } else {
      await target.click({ timeout: 5000 });
    }
    await page.waitForTimeout(700);
    log[`afterExpand_${i + 1}`] = await measure(page);
    await page.screenshot({ path: `${OUT}/03-expanded-${i + 1}.png`, fullPage: false });
  }

  // Collapse
  let guard = 0;
  while (guard < 10) {
    const collapse = page.getByRole("button", { name: "Collapse" });
    if ((await collapse.count()) === 0) break;
    await collapse.first().click();
    await page.waitForTimeout(500);
    guard++;
  }
  log.collapseClicks = guard;
  log.afterAllCollapsed = await measure(page);
  await page.screenshot({ path: `${OUT}/04-after-collapse.png`, fullPage: false });

  await setMainScroll(page, 0);
  await page.waitForTimeout(400);
  log.afterScrollTopAttempt = await measure(page);
  await page.screenshot({ path: `${OUT}/05-scroll-top-attempt.png`, fullPage: false });

  // Check if header/top of inbox is visible
  log.topAccessibility = await page.evaluate(`(() => {
    const main = document.querySelector("[data-workspace-main]");
    const h1 = Array.from(document.querySelectorAll("h1,h2")).find((el) =>
      /inbox|messages|leads|clients/i.test(el.textContent || "")
    );
    const tabs = document.querySelector('[role="tablist"], .rounded-lg.border.border-border.bg-muted\\\\/30');
    return {
      mainScrollTop: main ? Math.round(main.scrollTop) : null,
      mainMaxScroll: main ? main.scrollHeight - main.clientHeight : null,
      headingTop: h1 ? Math.round(h1.getBoundingClientRect().top) : null,
      headingText: h1 ? (h1.textContent || "").trim().slice(0, 40) : null,
      canReachZero: main ? main.scrollTop === 0 : null,
    };
  })()`);

  await setMainScroll(page, "end");
  await page.waitForTimeout(400);
  log.afterScrollBottom = await measure(page);
  await page.screenshot({ path: `${OUT}/06-scroll-bottom.png`, fullPage: false });

  // Repeat expand/collapse cycle twice more to detect accumulation
  for (let cycle = 1; cycle <= 2; cycle++) {
    const btn = page.locator('button[aria-expanded="false"]').filter({ hasText: /Email|Text/i }).first();
    if ((await btn.count()) > 0) {
      await btn.click();
      await page.waitForTimeout(500);
      const col = page.getByRole("button", { name: "Collapse" });
      if ((await col.count()) > 0) await col.first().click();
      await page.waitForTimeout(500);
    }
    await setMainScroll(page, 0);
    await page.waitForTimeout(200);
    log[`cycle_${cycle}_atTop`] = await measure(page);
  }
  await page.screenshot({ path: `${OUT}/07-after-cycles-top.png`, fullPage: false });

  writeFileSync(`${OUT}/forensic-results.json`, JSON.stringify(log, null, 2));
  const after = log.afterAllCollapsed as Metrics;
  const top = log.afterScrollTopAttempt as Metrics;
  const bottom = log.afterScrollBottom as Metrics;
  console.log(JSON.stringify({
    collapsedAvailable: log.collapsedAvailable,
    expandN,
    collapseClicks: log.collapseClicks,
    afterCollapse: {
      mainScrollTop: (after as { main?: { scrollTop?: number } })?.main?.scrollTop,
      rowH: (after as { workspaceRow?: { height?: number } })?.workspaceRow?.height,
      gap: (after as { whiteGapHeuristic?: unknown })?.whiteGapHeuristic,
    },
    afterScrollTop: (top as { main?: { scrollTop?: number } })?.main?.scrollTop,
    afterBottom: (bottom as { whiteGapHeuristic?: unknown })?.whiteGapHeuristic,
    topAccessibility: log.topAccessibility,
  }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
