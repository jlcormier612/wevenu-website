/**
 * Live Sandbox visual recovery — serving SHA gate + representative surface
 * screenshots (venue / couple / vendor / emails) light+dark where supported.
 * Soft muted + category hue + typography size probes (not unit-only GREEN).
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { measureTextContrast } from "@/lib/qa/css-contrast";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = (process.env.EXPECTED_SHA ?? "57ab96ab1fc598e5168c7739b6cfec9d3ca1ab1f").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const CLIENT = "b4e2764b-be33-4579-89e3-0c8e4a6dd5be";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const OUT = "docs/qa/product-contrast-audit";
const SHOTS = `${OUT}/shots-recovery`;
mkdirSync(SHOTS, { recursive: true });

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

async function servingMeta(): Promise<{ image: string; digest: string }> {
  try {
    const { execSync } = await import("node:child_process");
    const taskArn = execSync(
      "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
      { encoding: "utf8" },
    ).trim();
    if (!taskArn || taskArn === "None") return { image: "", digest: "" };
    const raw = execSync(
      `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].{image:image,digest:imageDigest}' --output json`,
      { encoding: "utf8" },
    );
    const j = JSON.parse(raw) as { image?: string; digest?: string };
    return { image: j.image ?? "", digest: j.digest ?? "" };
  } catch {
    return { image: "", digest: "" };
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

async function setTheme(page: import("playwright").Page, theme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate(
    `(() => {
      localStorage.setItem('theme', '${theme}');
      document.documentElement.classList.toggle('dark', '${theme}' === 'dark');
    })()`,
  );
  await page.waitForTimeout(350);
}

async function shot(page: import("playwright").Page, name: string) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

async function probeMutedSoftness(page: import("playwright").Page): Promise<{
  ok: boolean;
  detail: string;
  samples: number;
}> {
  const css = await page.evaluate(`(() => {
    const cs = getComputedStyle(document.documentElement);
    return { muted: cs.getPropertyValue('--muted-foreground').trim() };
  })()`) as { muted: string };

  // Softness gate: approved 80–86% band (allow 78–88). Reject global 92%.
  const mixMatch = css.muted.match(/(\d+(?:\.\d+)?)%/);
  let softOk = true;
  let softDetail = `muted=${css.muted.slice(0, 140)}`;
  if (mixMatch) {
    const pct = Number(mixMatch[1]);
    softOk = pct >= 78 && pct <= 88;
    softDetail += ` mixPct=${pct}`;
  } else if (/92%/.test(css.muted)) {
    softOk = false;
    softDetail += " still-92";
  }

  // AA only on elements whose computed color matches the muted token RGB
  // (skip status badges, hero overlays, buttons).
  const samples = await page.evaluate(`(() => {
    const isRgb = (v) => typeof v === "string" && /^rgba?\\(/i.test(v);
    const mutedRaw = getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground').trim();
    // Resolve muted to rgb via a probe node
    const probe = document.createElement('span');
    probe.style.color = mutedRaw || 'var(--muted-foreground)';
    probe.style.position = 'absolute';
    probe.style.left = '-9999px';
    document.body.appendChild(probe);
    const mutedRgb = getComputedStyle(probe).color;
    probe.remove();
    const out = [];
    const root = document.querySelector("main") || document.body;
    for (const el of Array.from(root.querySelectorAll("p, span, label, small"))) {
      const t = (el.textContent || "").trim();
      if (t.length < 4 || t.length > 80) continue;
      if (el.closest("nav, button, a[class*='button'], [data-portal-hero], header")) continue;
      if (/overdue|complete|booked|cancel/i.test(t) && t.length < 24) continue;
      const cs = getComputedStyle(el);
      if (!isRgb(cs.color) || cs.color !== mutedRgb) continue;
      let bg = cs.backgroundColor;
      let n = el.parentElement;
      while (n && (bg === "rgba(0, 0, 0, 0)" || bg === "transparent" || /oklab|color-mix/i.test(bg))) {
        bg = getComputedStyle(n).backgroundColor;
        n = n.parentElement;
      }
      const backdrop = getComputedStyle(document.body).backgroundColor;
      if (!isRgb(bg)) bg = backdrop;
      if (!isRgb(bg) || !isRgb(backdrop)) continue;
      out.push({ text: t.slice(0, 36), color: cs.color, surface: bg, backdrop });
      if (out.length >= 8) break;
    }
    return { mutedRgb, out };
  })()`) as { mutedRgb: string; out: { text: string; color: string; surface: string; backdrop: string }[] };

  let aaFail = 0;
  let aaPass = 0;
  const bad: string[] = [];
  for (const s of samples.out) {
    const m = measureTextContrast(s.color, s.surface, s.backdrop);
    if (m.status !== "ok") continue;
    if (m.ratio >= 4.5) aaPass += 1;
    else {
      aaFail += 1;
      bad.push(`${s.text}:${m.ratio.toFixed(2)}`);
    }
  }
  // Soft token restored is required. AA on muted samples required only when samples exist.
  const aaOk = samples.out.length === 0 ? true : aaFail === 0 && aaPass > 0;
  return {
    ok: softOk && aaOk,
    detail: `${softDetail} soft=${softOk} mutedRgb=${samples.mutedRgb} aaPass=${aaPass} aaFail=${aaFail} bad=${bad.slice(0, 3).join("|")}`,
    samples: samples.out.length,
  };
}

async function probeCategoryHues(page: import("playwright").Page, theme: string) {
  // Only task-list category labels (not nav tabs named "Planning").
  await page.locator("#planning-task-list").scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);

  const probes = (await page.evaluate(`(() => {
    const labels = ['Planning', 'Communication', 'Financial', 'Document', 'Meeting', 'Internal', 'Custom'];
    const root = document.querySelector('#planning-task-list')
      || document.querySelector('[data-testid="planning-task-list"]');
    if (!root) return [];
    function opaqueRgb(start) {
      let el = start;
      while (el) {
        const bg = getComputedStyle(el).backgroundColor || '';
        const m = /^rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)$/i.exec(bg);
        if (m) {
          const a = m[4] === undefined ? 1 : Number(m[4]);
          if (a >= 0.99) return 'rgb(' + m[1] + ', ' + m[2] + ', ' + m[3] + ')';
        }
        el = el.parentElement;
      }
      const dark = document.documentElement.classList.contains('dark');
      return dark ? 'rgb(79, 95, 79)' : 'rgb(247, 245, 241)';
    }
    const found = [];
    for (const span of Array.from(root.querySelectorAll('span'))) {
      const t = (span.textContent || '').trim();
      if (!labels.includes(t)) continue;
      const styleAttr = span.getAttribute('style') || '';
      if (!styleAttr.includes('color') && !styleAttr.includes('--category-label')) continue;
      const cs = getComputedStyle(span);
      found.push({
        text: t,
        color: cs.color,
        surface: opaqueRgb(span.parentElement),
        backdrop: opaqueRgb(document.body),
        fontSize: cs.fontSize,
      });
    }
    return found;
  })()`)) as {
    text: string;
    color: string;
    surface: string;
    backdrop: string;
    fontSize: string;
  }[];

  const uniqueColors = new Set(probes.map((p) => p.color));
  record(
    `${theme}-category-hue-diversity`,
    probes.length === 0 || uniqueColors.size >= Math.min(3, probes.length),
    `labels=${probes.length} uniqueColors=${uniqueColors.size} sample=${JSON.stringify(probes.slice(0, 4))}`,
  );

  let aaFail = 0;
  let aaPass = 0;
  let skipped = 0;
  for (const p of probes) {
    const m = measureTextContrast(p.color, p.surface, p.backdrop);
    if (m.status !== "ok") {
      skipped += 1;
      if (skipped <= 2) {
        record(
          `${theme}-cat-measure-${p.text}`,
          false,
          m.status === "measurement-unavailable" ? m.reason : m.status,
        );
      }
      continue;
    }
    if (m.ratio >= 4.5) aaPass += 1;
    else {
      aaFail += 1;
      record(`${theme}-cat-${p.text}`, false, `ratio=${m.ratio.toFixed(2)} ${p.color} on ${p.surface}`);
    }
  }
  if (probes.length > 0) {
    record(
      `${theme}-category-aa`,
      aaFail === 0 && aaPass > 0 && skipped === 0,
      `pass=${aaPass} fail=${aaFail} skipped=${skipped}`,
    );
  } else {
    record(`${theme}-category-aa`, false, "no category labels in #planning-task-list");
  }

  const meta = await page.evaluate(`(() => {
    const root = document.querySelector('#planning-task-list');
    if (!root) return [];
    return Array.from(root.querySelectorAll('span'))
      .filter((el) => {
        const t = (el.textContent || '').trim();
        return ['Planning', 'Communication', 'Financial', 'Document', 'Meeting', 'Internal', 'Custom', 'Client', 'Coordinator'].includes(t)
          || /Due|days before|days after/i.test(t);
      })
      .slice(0, 10)
      .map((el) => ({
        t: (el.textContent || '').trim().slice(0, 40),
        fs: getComputedStyle(el).fontSize,
      }));
  })()`) as { t: string; fs: string }[];
  const sizes = meta.map((m) => parseFloat(m.fs)).filter((n) => Number.isFinite(n));
  const minPx = sizes.length ? Math.min(...sizes) : 0;
  record(
    `${theme}-task-meta-not-10px`,
    sizes.length === 0 || minPx >= 14,
    `minPx=${minPx} sample=${JSON.stringify(meta.slice(0, 4))}`,
  );
}

async function main() {
  const { image, digest } = await servingMeta();
  const shaOk = image.includes(EXPECTED.slice(0, 12));
  record("serving-sha", shaOk, `expected=${EXPECTED.slice(0, 12)} ecs=${image}`);
  record("serving-digest-present", !!digest, digest || "missing");
  if (!shaOk) {
    writeFileSync(
      `${OUT}/visual-recovery-browser-results.json`,
      JSON.stringify({ expectedSha: EXPECTED, image, digest, checks, at: new Date().toISOString() }, null, 2),
    );
    console.error("Serving SHA mismatch — abort browser visual pass");
    process.exit(1);
  }

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

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  // Dashboard
  await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1200);
  for (const theme of ["light", "dark"] as const) {
    await setTheme(page, theme);
    const m = await probeMutedSoftness(page);
    record(`dashboard-${theme}-muted`, m.ok, m.detail);
    await shot(page, `dashboard-${theme}-1280`);
  }

  // Event planning / task list
  await page.goto(`${APP}/events/${EVENT}?tab=playbook`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1500);
  const review = page.getByRole("button", { name: /Review Tasks/i });
  if (await review.count()) {
    await review.first().click().catch(() => {});
    await page.waitForTimeout(600);
  }
  await page.locator("#planning-task-list").scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(500);
  for (const theme of ["light", "dark"] as const) {
    await setTheme(page, theme);
    const m = await probeMutedSoftness(page);
    record(`planning-${theme}-muted`, m.ok, m.detail);
    await probeCategoryHues(page, theme);
    await page.locator("#planning-task-list").scrollIntoViewIfNeeded().catch(() => {});
    await shot(page, `event-planning-${theme}-1280`);
    await shot(page, `event-task-list-${theme}-1280`);
  }

  // Inventory
  await page.goto(`${APP}/events/${EVENT}?tab=inventory`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1200);
  for (const theme of ["light", "dark"] as const) {
    await setTheme(page, theme);
    const m = await probeMutedSoftness(page);
    record(`inventory-${theme}-muted`, m.ok, m.detail);
    await shot(page, `inventory-${theme}-1280`);
  }

  // Event Order
  await page.goto(`${APP}/events/${EVENT}?tab=event-order`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1200);
  for (const theme of ["light", "dark"] as const) {
    await setTheme(page, theme);
    const m = await probeMutedSoftness(page);
    record(`event-order-${theme}-muted`, m.ok, m.detail);
    await shot(page, `event-order-${theme}-1280`);
  }

  // Timeline
  await page.goto(`${APP}/events/${EVENT}?tab=timeline`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1200);
  for (const theme of ["light", "dark"] as const) {
    await setTheme(page, theme);
    await shot(page, `timeline-${theme}-1280`);
    const timeProbe = await page.evaluate(`(() => {
      const nodes = Array.from(document.querySelectorAll('span, time, div, p'))
        .filter((el) => /\\d{1,2}:\\d{2}|No time set/i.test(el.textContent || ''))
        .slice(0, 6)
        .map((el) => ({
          t: (el.textContent || '').trim().slice(0, 40),
          fs: getComputedStyle(el).fontSize,
          fw: getComputedStyle(el).fontWeight,
        }));
      return nodes;
    })()`) as { t: string; fs: string; fw: string }[];
    const clock = timeProbe.find((n) => /\d{1,2}:\d{2}/.test(n.t));
    if (clock) {
      const px = parseFloat(clock.fs);
      record(
        `${theme}-timeline-time-prominence`,
        px >= 14,
        `fs=${clock.fs} fw=${clock.fw} t=${clock.t}`,
      );
    } else {
      record(`${theme}-timeline-time-prominence`, true, `no-clock-sample sample=${JSON.stringify(timeProbe.slice(0, 2))}`);
    }
  }

  // Couple portal
  if (token) {
    await page.goto(`${APP}/p/${token}`, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(1500);
    await shot(page, "couple-home-1280");
    const eyebrow = await page.evaluate(`(() => {
      const els = Array.from(document.querySelectorAll('span, p, div, h2, h3'))
        .filter((el) => /Your Snapshot|Coming Up|Journey/i.test(el.textContent || ''))
        .slice(0, 6)
        .map((el) => ({
          t: (el.textContent || '').trim().slice(0, 40),
          fs: getComputedStyle(el).fontSize,
          color: getComputedStyle(el).color,
        }));
      return els;
    })()`) as { t: string; fs: string; color: string }[];
    const minEyebrow = eyebrow.length
      ? Math.min(...eyebrow.map((e) => parseFloat(e.fs)).filter(Number.isFinite))
      : 0;
    record(
      "couple-eyebrow-not-10px",
      eyebrow.length === 0 || minEyebrow >= 11,
      `minPx=${minEyebrow} sample=${JSON.stringify(eyebrow.slice(0, 3))}`,
    );
    const m = await probeMutedSoftness(page);
    record("couple-home-muted", m.ok, m.detail);

    await page.goto(`${APP}/p/${token}#timeline`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1200);
    await shot(page, "couple-timeline-1280");

    await page.goto(`${APP}/p/${token}#documents`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1000);
    await shot(page, "couple-documents-1280");
  } else {
    record("couple-home-muted", false, "no portal token");
  }

  // Vendor surface
  await page.goto(`${APP}/vendor`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1000);
  await shot(page, "vendor-1280");
  record("vendor-shot", true, page.url());

  await browser.close();

  // Email HTML renders (file://) — pale CTA + footer ink
  const emailBrowser = await chromium.launch({ headless: true });
  const emailPage = await emailBrowser.newPage({ viewport: { width: 720, height: 900 } });
  for (const file of [
    "venue-cta-pale.html",
    "venue-cta-heritage.html",
    "venue-branded-shell.html",
    "team-invite.html",
  ]) {
    const path = `${OUT}/email-renders/${file}`;
    if (!existsSync(path)) {
      record(`email-${file}`, false, "missing render");
      continue;
    }
    const html = readFileSync(path, "utf8");
    await emailPage.setContent(html, { waitUntil: "domcontentloaded" });
    await emailPage.waitForTimeout(200);
    const ban = await emailPage.evaluate(`(() => {
      const all = Array.from(document.querySelectorAll('*'));
      let gray = 0;
      let forest = 0;
      for (const el of all) {
        const c = getComputedStyle(el).color.toLowerCase();
        if (c.includes('156, 163, 175') || c === 'rgb(156, 163, 175)') gray += 1;
        if (c.includes('79, 95, 79') || c.includes('93, 111, 93')) forest += 1;
      }
      return { gray, forest };
    })()`) as { gray: number; forest: number };
    record(
      `email-${file}-no-cool-gray-footer`,
      ban.gray === 0,
      `coolGrayHits=${ban.gray} forestHits=${ban.forest}`,
    );
    await emailPage.screenshot({
      path: `${SHOTS}/email-${file.replace(".html", "")}-720.png`,
      fullPage: false,
    });
  }
  await emailBrowser.close();

  const fail = checks.filter((c) => !c.pass).length;
  const summary = {
    expectedSha: EXPECTED,
    servingImage: image,
    servingDigest: digest,
    counts: { pass: checks.filter((c) => c.pass).length, fail, total: checks.length },
    checks,
    shotsDir: SHOTS,
    at: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/visual-recovery-browser-results.json`, JSON.stringify(summary, null, 2));
  console.log(`\n${summary.counts.pass} pass / ${fail} fail → ${OUT}/visual-recovery-browser-results.json`);
  console.log(`digest=${digest}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
