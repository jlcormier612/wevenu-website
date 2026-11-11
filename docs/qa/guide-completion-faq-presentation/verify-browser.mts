/**
 * Queue Item 2C — Guide Completion pills + FAQ outline (light/dark).
 * Sandbox only. Read-only.
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
const EXPECTED = process.env.EXPECTED_SHA ?? "";
const ARTIFACT = process.env.ARTIFACT_PREFIX ?? "verify";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = "docs/qa/guide-completion-faq-presentation";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function luminance(rgb: string): number | null {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return null;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(fg: string, bg: string): number | null {
  const a = luminance(fg);
  const b = luminance(bg);
  if (a == null || b == null) return null;
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
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

async function measure(page: import("playwright").Page) {
  return page.evaluate(`(() => {
    const pill = (key) => document.querySelector('[data-testid="guide-completion-pill-' + key + '"]');
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        text: (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 60),
        w: Math.round(r.width),
        h: Math.round(r.height),
        color: cs.color,
        bg: cs.backgroundColor,
        border: cs.borderTopColor,
        radius: cs.borderRadius,
        borderWidth: cs.borderTopWidth,
      };
    };
    const completionCards = Array.from(document.querySelectorAll('[data-slot="card"]')).filter((el) =>
      /Guide Completion/i.test(el.textContent || ""),
    );
    const collapsedSections = Array.from(document.querySelectorAll('[data-slot="card"]'))
      .filter((el) => !/Guide Completion/i.test(el.textContent || ""))
      .filter((el) => el.querySelector("button"))
      .slice(0, 6)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { h: Math.round(r.height), text: (el.textContent || "").trim().slice(0, 40) };
      });
    return {
      htmlDark: document.documentElement.classList.contains("dark"),
      completionCardCount: completionCards.length,
      faq: box(pill("faqs")),
      parking: box(pill("parking")),
      contacts: box(pill("contacts")),
      collapsedHeights: collapsedSections.map((c) => c.h),
      collapsedSample: collapsedSections,
    };
  })()`);
}

async function themePass(
  page: import("playwright").Page,
  theme: "light" | "dark",
  width: number,
) {
  const suffix = `${theme}-${width}`;
  await page.setViewportSize({ width, height: width <= 400 ? 844 : 900 });
  await page.goto(`${APP}/guide`, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(
    theme === "dark"
      ? `(() => { document.documentElement.classList.add("dark"); })()`
      : `(() => { document.documentElement.classList.remove("dark"); })()`,
  );
  await page.waitForTimeout(400);
  await page.waitForSelector('[data-testid="guide-completion-pill-faqs"]', { timeout: 45000 });
  await page.locator('[data-testid="guide-completion-pills"]').scrollIntoViewIfNeeded();

  const m = await measure(page);
  await page.locator('[data-testid="guide-completion-pills"]').screenshot({
    path: `${OUT}/${ARTIFACT}-pills-${suffix}.png`,
  });
  await page.screenshot({ path: `${OUT}/${ARTIFACT}-page-${suffix}.png`, fullPage: false });

  record(
    `completion_card_count_${suffix}`,
    m.completionCardCount === 1,
    `count=${m.completionCardCount} (live UI has a single Guide Completion card)`,
  );
  record(
    `faq_pill_present_${suffix}`,
    Boolean(m.faq && /FAQ/i.test(m.faq.text || "")),
    JSON.stringify(m.faq),
  );
  record(
    `faq_matches_peer_shape_${suffix}`,
    Boolean(
      m.faq &&
        m.parking &&
        m.faq.h === m.parking.h &&
        Number.parseFloat(m.faq.borderWidth) > 0 &&
        Number.parseFloat(m.parking.borderWidth) > 0,
    ),
    `faqH=${m.faq?.h} parkingH=${m.parking?.h} faqBorder=${m.faq?.borderWidth}`,
  );

  const cardBg = theme === "dark" ? "rgb(79, 95, 79)" : "rgb(248, 247, 244)";
  const ratio = m.faq?.color ? contrast(m.faq.color, m.faq.bg?.includes("0)") ? cardBg : m.faq.bg) : null;
  // Prefer text vs local pill bg when bg is opaque enough; fall back to card.
  const local = m.faq?.color && m.faq?.bg ? contrast(m.faq.color, m.faq.bg) : null;
  const best = local != null && local > 1.5 ? local : ratio;
  if (theme === "dark") {
    record(
      `faq_dark_contrast_${suffix}`,
      Boolean(best != null && best >= 3),
      `contrast=${best?.toFixed(2)} color=${m.faq?.color} bg=${m.faq?.bg}`,
    );
  } else {
    record(
      `faq_light_readable_${suffix}`,
      Boolean(m.faq?.color && luminance(m.faq.color)! < 0.4),
      `color=${m.faq?.color} lum=${m.faq?.color ? luminance(m.faq.color) : null}`,
    );
  }

  const heights = m.collapsedHeights as number[];
  if (heights.length >= 3 && width >= 1000) {
    const closed = heights.filter((h) => h > 0 && h < 200);
    const equal = closed.length >= 3 && closed.every((h) => Math.abs(h - closed[0]!) <= 4);
    record(
      `collapsed_section_heights_${suffix}`,
      equal,
      `heights=${JSON.stringify(closed.slice(0, 5))}`,
    );
  }

  return m;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");

  const image = await servingImage();
  record(
    "Serving expected SHA",
    image.includes(EXPECTED.slice(0, 12)),
    `image=${image || "unknown"} expected=${EXPECTED.slice(0, 12)}`,
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(await cookiesFor());
  const page = await context.newPage();

  const light1280 = await themePass(page, "light", 1280);
  const dark1280 = await themePass(page, "dark", 1280);
  const light390 = await themePass(page, "light", 390);
  const dark390 = await themePass(page, "dark", 390);

  await browser.close();
  const pass = checks.every((c) => c.pass);
  writeFileSync(
    `${OUT}/${ARTIFACT}-browser-results.json`,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        expectedSha: EXPECTED,
        servingImage: image,
        artifactPrefix: ARTIFACT,
        pass,
        checks,
        light1280,
        dark1280,
        light390,
        dark390,
      },
      null,
      2,
    ),
  );
  console.log(pass ? "ALL PASS" : "HAS FAILURES");
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
