/**
 * Phase 3 CRM hold + denial capture — select rehearsal applied row explicitly.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "/tmp/htc-phase3-sandbox/closure-ui";
mkdirSync(OUT, { recursive: true });
const VENUE = "f9427d5e-84f9-48bc-a9fa-8a2bcb95af7f";
const WS = "https://workspace.sandbox.hellotocheers.com";
const EMAIL = "jennifer@hellotocheers.com";

function save(name: string, text: string) {
  writeFileSync(`${OUT}/${name}`, text);
}

const report: Record<string, unknown> = { steps: [] as unknown[] };
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const wsPage = await context.newPage();

await wsPage.goto(`${WS}/login`, { waitUntil: "networkidle", timeout: 90000 });
await wsPage.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
await wsPage.locator('input[type="password"], input[name="password"]').first().fill("cheers-demo");
await wsPage.getByRole("button", { name: /sign in|log in|continue/i }).click();
await wsPage.waitForTimeout(3000);
await wsPage.goto(`${WS}/tier-upgrades`, { waitUntil: "networkidle", timeout: 90000 });
await wsPage.waitForTimeout(3500);

const crmApi = await wsPage.evaluate(async () => {
  const res = await fetch("/api/relationships/tier-upgrades");
  return { status: res.status, json: await res.json() };
});
save("05-crm-api.json", JSON.stringify(crmApi, null, 2));
const applied = (crmApi.json?.upgrades || []).find(
  (u: { id: string }) => u.id === "c31898c1-faea-4c17-a309-ac458d66dc78",
);
(report.steps as unknown[]).push({
  crmApiStatus: crmApi.status,
  upgradeCount: crmApi.json?.upgrades?.length ?? 0,
  appliedFound: Boolean(applied),
  applied,
});

// Select the rehearsal applied row explicitly
const rehearsalRow = wsPage.locator("tr").filter({ hasText: /DISPOSABLE-P3-REHEARSAL/i }).first();
await rehearsalRow.click();
await wsPage.waitForTimeout(800);
await wsPage.screenshot({ path: `${OUT}/05-crm-tier-upgrades.png`, fullPage: true });
await wsPage.screenshot({ path: `${OUT}/06-crm-applied-detail.png`, fullPage: true });
save("05-crm-body.txt", (await wsPage.locator("body").innerText()).slice(0, 12000));

// Place hold on selected rehearsal venue
await wsPage.getByRole("button", { name: /^Place hold$/i }).click();
await wsPage.waitForTimeout(3000);
await wsPage.screenshot({ path: `${OUT}/07-crm-hold-placed.png`, fullPage: true });
save("07-hold-placed-body.txt", (await wsPage.locator("body").innerText()).slice(0, 5000));
const crmAfterPlace = await wsPage.evaluate(async () => {
  const res = await fetch("/api/relationships/tier-upgrades");
  return { status: res.status, json: await res.json() };
});
save("07-crm-after-place.json", JSON.stringify(crmAfterPlace, null, 2));
const activeHold =
  (crmAfterPlace.json?.holds || []).find(
    (h: { venueId: string; active: boolean }) => h.venueId === VENUE && h.active,
  ) || null;
(report.steps as unknown[]).push({ holdPlaced: Boolean(activeHold), hold: activeHold });

// Release via UI
const releaseBtn = wsPage.getByRole("button", { name: /Release hold/i }).first();
if (await releaseBtn.count()) {
  await releaseBtn.click();
} else {
  await wsPage.getByRole("button", { name: /^Release$/i }).first().click();
}
await wsPage.waitForTimeout(3000);
await wsPage.screenshot({ path: `${OUT}/08-crm-hold-released.png`, fullPage: true });
const crmAfterRelease = await wsPage.evaluate(async () => {
  const res = await fetch("/api/relationships/tier-upgrades");
  return { status: res.status, json: await res.json() };
});
save("08-crm-after-release.json", JSON.stringify(crmAfterRelease, null, 2));
const stillActive = (crmAfterRelease.json?.holds || []).some(
  (h: { venueId: string; active: boolean }) => h.venueId === VENUE && h.active,
);
(report.steps as unknown[]).push({ holdReleased: !stillActive });

// Unauthorized: fresh context (no cookies)
const deniedContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const apiRes = await deniedContext.request.get(`${WS}/api/relationships/tier-upgrades`);
const apiText = await apiRes.text();
const unauth = { status: apiRes.status(), text: apiText.slice(0, 500) };
save("09-unauth-api.json", JSON.stringify(unauth, null, 2));
const deniedPage = await deniedContext.newPage();
await deniedPage.goto(`${WS}/tier-upgrades`, { waitUntil: "networkidle", timeout: 90000 });
await deniedPage.waitForTimeout(1500);
await deniedPage.screenshot({ path: `${OUT}/09-unauthorized-crm.png`, fullPage: true });
save("09-unauthorized-url.txt", deniedPage.url());
save("09-unauthorized-body.txt", (await deniedPage.locator("body").innerText()).slice(0, 3000));
const deniedUi =
  !deniedPage.url().includes("/tier-upgrades") ||
  /sign in|log in|email|password/i.test(await deniedPage.locator("body").innerText());
(report.steps as unknown[]).push({ unauthApi: unauth, unauthUrl: deniedPage.url(), deniedUi });

report.ok =
  crmApi.status === 200 &&
  Boolean(applied) &&
  Boolean(activeHold) &&
  !stillActive &&
  (unauth.status === 401 || unauth.status === 403) &&
  deniedUi;

save("CRM-CLOSURE-REPORT.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await deniedContext.close();
await browser.close();
process.exit(report.ok ? 0 : 1);
