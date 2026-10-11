/**
 * Forensic + verify: Migration Center scroll/clip at /settings/migration?source=honeybook
 * Uses magic-link cookie (no password logging). Disposable or Fancy for layout-only.
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
const FANCY = "jennifer@hellotocheers.com";
const OUT = "docs/qa/migration-center-scroll";
const EXPECT_SHA = (process.env.EXPECT_SHA || "").slice(0, 8);
const VIEWPORTS = [
  { name: "original", width: 1280, height: 800 },
  { name: "short", width: 1280, height: 700 },
  { name: "narrow", width: 1024, height: 800 },
];

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox");
}
mkdirSync(OUT, { recursive: true });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 600)}`);
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

async function measure(page: { evaluate: (fn: string) => Promise<unknown> }) {
  // String form avoids tsx __name helpers inside page.evaluate.
  return page.evaluate(`(() => {
    const main = document.querySelector("main");
    const shell = document.querySelector(".htc-staff");
    const html = document.documentElement;
    const body = document.body;
    function cs(el) {
      if (!el) return null;
      const s = getComputedStyle(el);
      return {
        overflow: s.overflow,
        overflowY: s.overflowY,
        overflowX: s.overflowX,
        height: s.height,
        maxHeight: s.maxHeight,
        display: s.display,
        flex: s.flex,
        minHeight: s.minHeight,
        position: s.position,
      };
    }
    function box(el) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        top: r.top,
        bottom: r.bottom,
        height: r.height,
        clientH: el.clientHeight,
        scrollH: el.scrollHeight,
        scrollTop: el.scrollTop,
        scrollable: el.scrollHeight > el.clientHeight + 2,
      };
    }
    const headings = Array.from(document.querySelectorAll("h1,h2"));
    let heading = null;
    for (const el of headings) {
      if (/Migration Center/i.test(el.textContent || "")) { heading = el; break; }
    }
    const chain = [];
    let n = heading;
    while (n && chain.length < 12) {
      const s = getComputedStyle(n);
      chain.push({
        tag: n.tagName.toLowerCase(),
        className: (n.className || "").toString().slice(0, 120),
        overflowY: s.overflowY,
        scrollable: n.scrollHeight > n.clientHeight + 2,
        clientH: Math.round(n.clientHeight),
        scrollH: Math.round(n.scrollHeight),
      });
      n = n.parentElement;
    }
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      html: Object.assign({}, cs(html), box(html)),
      body: Object.assign({}, cs(body), box(body)),
      shell: Object.assign({}, cs(shell), box(shell)),
      main: Object.assign({}, cs(main), box(main)),
      chain: chain,
      pageYOffset: window.pageYOffset,
      dpl: (document.documentElement.outerHTML.match(/data-dpl-id="([^"]+)"/) || [])[1] || "",
    };
  })()`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const cookies = await cookiesFor(FANCY);
  const forensics: unknown[] = [];

  try {
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      await ctx.addCookies(cookies);
      const page = await ctx.newPage();

      await page.goto(`${APP}/settings/migration?source=honeybook`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(2500);

      const before = (await measure(page)) as {
        dpl?: string;
        main?: { scrollable?: boolean; scrollTop?: number; clientH?: number; scrollH?: number };
      };
      forensics.push({ viewport: vp, before });

      if (vp.name === "original") {
        const dpl = before.dpl || "";
        if (EXPECT_SHA) {
          record("runtime_dpl", dpl.startsWith(EXPECT_SHA), `dpl=${dpl}`);
        } else {
          record("runtime_dpl", Boolean(dpl), `dpl=${dpl || "missing"}`);
        }
        record(
          "heading_visible",
          (await page.getByRole("heading", { name: /Migration Center/i }).count()) > 0,
          "Migration Center heading",
        );
        record(
          "honeybook_selected_or_visible",
          (await page.getByText(/HoneyBook/i).count()) > 0,
          "HoneyBook lane present",
        );
      }

      // Top-of-page evidence before any scroll (matches reported fold)
      if (vp.name === "original") {
        await page.screenshot({
          path: `${OUT}/original-top-before-scroll.png`,
          fullPage: false,
        });
        // PageDown must move main even when focus is still on body (document locked).
        const beforePd = await page.evaluate(
          `(() => document.querySelector("main")?.scrollTop ?? -1)()`,
        );
        await page.keyboard.press("PageDown");
        await page.waitForTimeout(250);
        const afterPd = await page.evaluate(
          `(() => document.querySelector("main")?.scrollTop ?? -1)()`,
        );
        record(
          "pagedown_without_click_scrolls_main",
          Number(afterPd) > Number(beforePd) + 20,
          `before=${beforePd} after=${afterPd}`,
        );
        await page.evaluate(`(() => { const m=document.querySelector("main"); if(m) m.scrollTop=0; })()`);
        await page.waitForTimeout(100);

        const gutter = await page.evaluate(`(() => {
          const m = document.querySelector("main");
          if (!m) return null;
          const s = getComputedStyle(m);
          return {
            gutter: m.offsetWidth - m.clientWidth,
            scrollbarGutter: s.scrollbarGutter,
            overflowY: s.overflowY,
          };
        })()`) as { gutter: number; scrollbarGutter: string; overflowY: string } | null;
        record(
          "main_scrollbar_affordance",
          Boolean(
            gutter &&
              (gutter.gutter >= 8 ||
                gutter.scrollbarGutter.includes("stable") ||
                gutter.overflowY === "scroll"),
          ),
          JSON.stringify(gutter),
        );
      }

      // Attempt scroll via mouse wheel over main content
      await page.mouse.move(vp.width / 2, vp.height / 2);
      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(400);
      const afterWheel = (await measure(page)) as {
        main?: { scrollTop?: number };
      };

      // Programmatic main.scrollTop
      const prog = await page.evaluate(`(() => {
        const main = document.querySelector("main");
        if (!main) return { ok: false, reason: "no main" };
        const beforeTop = main.scrollTop;
        main.scrollTop = main.scrollHeight;
        return {
          ok: true,
          beforeTop: beforeTop,
          afterTop: main.scrollTop,
          clientH: main.clientHeight,
          scrollH: main.scrollHeight,
          moved: main.scrollTop > beforeTop + 10,
        };
      })()`);

      // scrollIntoView on bottom-ish control
      const bottomTexts = [
        /CSV files/i,
        /Choose file/i,
        /Upload a CSV/i,
        /I'm starting from scratch/i,
        /Continue/i,
        /Import history/i,
        /session history/i,
      ];
      let bottomReached = false;
      let bottomDetail = "no bottom marker";
      for (const t of bottomTexts) {
        const loc = page.getByText(t);
        if ((await loc.count()) > 0) {
          await loc.last().scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(200);
          const box = await loc.last().boundingBox();
          if (box) {
            const inView = box.y >= 0 && box.y + box.height <= vp.height + 2;
            bottomReached = inView || box.y < vp.height;
            bottomDetail = `marker=${t} y=${Math.round(box.y)} h=${Math.round(box.height)} inView=${inView}`;
            if (bottomReached) break;
          }
        }
      }

      const mainScrollable = Boolean(before.main?.scrollable);
      const wheelMoved = (afterWheel.main?.scrollTop ?? 0) > 10;
      const progMoved = Boolean((prog as { moved?: boolean }).moved);

      record(
        `${vp.name}_main_scrollable`,
        mainScrollable || progMoved,
        `mainScrollable=${mainScrollable} prog=${JSON.stringify(prog)} wheelMoved=${wheelMoved} main=${JSON.stringify((before as { main?: unknown }).main)}`,
      );
      record(
        `${vp.name}_wheel_or_prog_scrolls`,
        wheelMoved || progMoved,
        `wheelMoved=${wheelMoved} progMoved=${progMoved}`,
      );
      record(
        `${vp.name}_bottom_reachable`,
        bottomReached || progMoved,
        bottomDetail,
      );

      await page.screenshot({
        path: `${OUT}/${vp.name}-viewport.png`,
        fullPage: false,
      });
      // Capture "scrolled" state
      await page.evaluate(`(() => {
        const main = document.querySelector("main");
        if (main) main.scrollTop = main.scrollHeight;
      })()`);
      await page.waitForTimeout(200);
      await page.screenshot({
        path: `${OUT}/${vp.name}-scrolled.png`,
        fullPage: false,
      });

      // Keyboard: Tab toward bottom controls
      if (vp.name === "original") {
        await page.evaluate(`(() => {
          const main = document.querySelector("main");
          if (main) main.scrollTop = 0;
        })()`);
        for (let i = 0; i < 40; i++) await page.keyboard.press("Tab");
        const focused = await page.evaluate(`(() => {
          const el = document.activeElement;
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            text: (el.innerText || el.getAttribute("aria-label") || "").slice(0, 80),
            y: r.y,
            visible: r.y >= 0 && r.y < window.innerHeight,
          };
        })()`);
        record(
          "keyboard_focus_visible",
          Boolean(focused && (focused as { visible?: boolean }).visible),
          JSON.stringify(focused),
        );
      }

      await ctx.close();
    }

    // Sibling onboarding page: intake (scroll sanity)
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 700 } });
      await ctx.addCookies(cookies);
      const page = await ctx.newPage();
      await page.goto(`${APP}/settings/business`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(2000);
      const sib = await page.evaluate(`(() => {
        const main = document.querySelector("main");
        if (!main) return { ok: false };
        const beforeTop = main.scrollTop;
        main.scrollTop = 400;
        return {
          ok: true,
          scrollH: main.scrollHeight,
          clientH: main.clientHeight,
          moved: main.scrollTop !== beforeTop || main.scrollHeight <= main.clientHeight + 2,
          canScroll: main.scrollHeight > main.clientHeight + 2,
        };
      })()`);
      record(
        "sibling_settings_scroll_ok",
        Boolean((sib as { ok?: boolean }).ok),
        JSON.stringify(sib),
      );
      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  writeFileSync(`${OUT}/forensics.json`, JSON.stringify(forensics, null, 2));
  const required = [
    "runtime_dpl",
    "heading_visible",
    "honeybook_selected_or_visible",
    "pagedown_without_click_scrolls_main",
    "main_scrollbar_affordance",
    "original_main_scrollable",
    "original_wheel_or_prog_scrolls",
    "original_bottom_reachable",
    "short_main_scrollable",
    "short_bottom_reachable",
    "narrow_main_scrollable",
    "narrow_bottom_reachable",
  ];
  const report = {
    observedAt: new Date().toISOString(),
    expectSha: EXPECT_SHA || null,
    checks,
    hardFail: checks.filter((c) => required.includes(c.name) && !c.pass).map((c) => c.name),
    ok: required.every((n) => checks.find((c) => c.name === n)?.pass),
  };
  writeFileSync(`${OUT}/results.json`, JSON.stringify(report, null, 2));
  console.log(report.ok ? "GREEN migration scroll" : "NOT GREEN migration scroll");
  console.log(JSON.stringify({ ok: report.ok, hardFail: report.hardFail }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
