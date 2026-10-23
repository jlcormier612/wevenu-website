/**
 * Sandbox — event Client task-list category labels (Planning etc.) contrast
 * in light + dark staff themes. Measures computed styles; no outbound sends.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { measureTextContrast, parseCssColor } from "@/lib/qa/css-contrast";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED_SHA = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const OUT = "docs/qa/product-contrast-audit";
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

type LabelProbe = {
  text: string;
  color: string;
  surface: string;
  backdrop: string;
};

async function probeCategoryLabels(page: import("playwright").Page): Promise<LabelProbe[]> {
  return page.evaluate(`(() => {
    const section = document.querySelector('[data-responsibility="client"]')
      || document.querySelector('#planning-task-list')
      || document.body;
    const spans = Array.from(section.querySelectorAll('span'));
    const labels = ['Planning', 'Communication', 'Financial', 'Document', 'Meeting', 'Internal', 'Custom'];
    const found = [];
    for (const span of spans) {
      const t = (span.textContent || '').trim();
      if (!labels.includes(t)) continue;
      const cs = getComputedStyle(span);
      let el = span.parentElement;
      let surface = 'rgba(0,0,0,0)';
      while (el) {
        const bg = getComputedStyle(el).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') { surface = bg; break; }
        el = el.parentElement;
      }
      const backdrop = getComputedStyle(document.body).backgroundColor
        || getComputedStyle(document.documentElement).backgroundColor;
      found.push({ text: t, color: cs.color, surface, backdrop });
    }
    return found;
  })()`);
}

async function setTheme(page: import("playwright").Page, theme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate(
    `(() => {
      localStorage.setItem('theme', '${theme}');
      document.documentElement.classList.toggle('dark', '${theme}' === 'dark');
    })()`,
  );
  await page.waitForTimeout(400);
}

async function main() {
  const image = await servingImage();
  if (EXPECTED_SHA) {
    record(
      "serving-sha",
      image.includes(EXPECTED_SHA.slice(0, 12)),
      `expected=${EXPECTED_SHA.slice(0, 12)} ecs=${image}`,
    );
  } else {
    record("serving-sha-observed", !!image, image || "unavailable");
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  await page.goto(`${APP}/events/${EVENT}`, { waitUntil: "networkidle", timeout: 120000 });
  // Prefer Planning / Client tasks panel if tabs exist
  const planningTab = page.getByRole("tab", { name: /planning|tasks/i }).first();
  if (await planningTab.count()) {
    await planningTab.click().catch(() => {});
    await page.waitForTimeout(800);
  }

  for (const theme of ["light", "dark"] as const) {
    await setTheme(page, theme);
    await page.waitForTimeout(500);
    const probes = await probeCategoryLabels(page);
    record(
      `${theme}-labels-found`,
      probes.length > 0,
      `count=${probes.length} sample=${JSON.stringify(probes.slice(0, 3))}`,
    );

    let aaPass = 0;
    let aaFail = 0;
    for (const p of probes) {
      const m = measureTextContrast(p.color, p.surface, p.backdrop);
      const ok = m.status === "ok" && m.ratio >= 4.5;
      if (ok) aaPass++;
      else aaFail++;
      if (p.text === "Planning" || !ok) {
        record(
          `${theme}-label-${p.text.toLowerCase()}`,
          ok,
          m.status === "ok"
            ? `ratio=${m.ratio.toFixed(2)} fg=${p.color} surface=${p.surface} bg=${p.backdrop}`
            : m.reason,
        );
      }
    }
    record(
      `${theme}-category-labels-aa`,
      aaFail === 0 && aaPass > 0,
      `pass=${aaPass} fail=${aaFail}`,
    );

    // Planning must not be near forest-sage on dark surfaces
    if (theme === "dark") {
      const planning = probes.find((p) => p.text === "Planning");
      if (planning) {
        const rgb = parseCssColor(planning.color);
        const darkish = rgb ? (rgb.r + rgb.g + rgb.b) / 3 < 100 : false;
        record(
          "dark-planning-not-forest-ink",
          !darkish,
          `color=${planning.color} avg=${rgb ? ((rgb.r + rgb.g + rgb.b) / 3).toFixed(0) : "?"}`,
        );
      }
    }

    await page.screenshot({
      path: `${OUT}/shots/task-categories-${theme}-1280.png`,
      fullPage: false,
    });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await setTheme(page, "dark");
  await page.screenshot({ path: `${OUT}/shots/task-categories-dark-390.png`, fullPage: false });
  record("narrow-dark-shot", true, "390");

  await browser.close();

  const out = {
    at: new Date().toISOString(),
    expectedSha: EXPECTED_SHA || null,
    servingImage: image,
    checks,
    pass: checks.filter((c) => c.pass).length,
    fail: checks.filter((c) => !c.pass).length,
  };
  writeFileSync(`${OUT}/task-category-browser-results.json`, JSON.stringify(out, null, 2));
  console.log(`\n${out.pass} pass / ${out.fail} fail → ${OUT}/task-category-browser-results.json`);
  process.exit(out.fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
