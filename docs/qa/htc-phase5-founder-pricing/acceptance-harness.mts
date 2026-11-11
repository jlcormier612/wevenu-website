/**
 * Phase 5 Sandbox acceptance harness (API-level).
 *
 * Prerequisites:
 * - Migration applied
 * - PRICING_FOUNDER_V1=true
 * - PRODUCT_API_BASE_URL + PRODUCT_SYNC_API_KEY
 * - Disposable venueId with active Stripe Test subscription
 *
 * Usage:
 *   VENUE_ID=... npx tsx docs/qa/htc-phase5-founder-pricing/acceptance-harness.mts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = (
  process.env.PRODUCT_API_BASE_URL ||
  process.env.VENUE_APP_BASE_URL ||
  "https://app.sandbox.hellotocheers.com"
).replace(/\/$/, "");
const key = process.env.PRODUCT_SYNC_API_KEY?.trim();
const venueId = process.env.VENUE_ID?.trim();
const outDir = resolve("docs/qa/htc-phase5-founder-pricing/acceptance");

if (!key) {
  console.error("PRODUCT_SYNC_API_KEY required");
  process.exit(1);
}
if (!venueId) {
  console.error("VENUE_ID required");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

async function call(action: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`${base}/api/internal/pricing/founder-arrangements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ venueId, action, ...body }),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function getVenue() {
  const res = await fetch(
    `${base}/api/internal/pricing/founder-arrangements?venueId=${encodeURIComponent(venueId!)}`,
    { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" },
  );
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const report: Record<string, unknown> = { base, venueId, steps: [] };

const before = await getVenue();
report.steps = [...(report.steps as unknown[]), { step: "before", ...before }];
writeFileSync(resolve(outDir, "01-before.json"), JSON.stringify(before, null, 2));

const preview = await call("preview", {
  kind: "percent_off",
  percentOff: 15,
  effectiveAt: new Date().toISOString(),
  reason: "Phase 5 acceptance preview",
  createdByEmail: "jennifer@hellotocheers.com",
});
report.steps = [...(report.steps as unknown[]), { step: "preview", ...preview }];
writeFileSync(resolve(outDir, "02-preview.json"), JSON.stringify(preview, null, 2));

const create = await call("create", {
  kind: "percent_off",
  percentOff: 15,
  effectiveAt: new Date().toISOString(),
  reason: "Phase 5 acceptance create",
  customerFacingLabel: "Special pricing",
  createdByEmail: "jennifer@hellotocheers.com",
  idempotencyKey: `phase5-accept-${venueId}-${Date.now()}`,
});
report.steps = [...(report.steps as unknown[]), { step: "create", ...create }];
writeFileSync(resolve(outDir, "03-create.json"), JSON.stringify(create, null, 2));

const after = await getVenue();
report.steps = [...(report.steps as unknown[]), { step: "after", ...after }];
writeFileSync(resolve(outDir, "04-after.json"), JSON.stringify(after, null, 2));

const arrangementId = create.json?.arrangement?.id as string | undefined;
if (arrangementId) {
  const ended = await call("end", {
    arrangementId,
    endReason: "Phase 5 acceptance cleanup",
    actorEmail: "jennifer@hellotocheers.com",
  });
  report.steps = [...(report.steps as unknown[]), { step: "end", ...ended }];
  writeFileSync(resolve(outDir, "05-end.json"), JSON.stringify(ended, null, 2));
}

writeFileSync(resolve(outDir, "REPORT.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
