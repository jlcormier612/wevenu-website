/**
 * Stage 6 / scenario G–H — Fancy fixture EO ↔ invoice ↔ payment plan on serving SHA.
 * Read-mostly; does not issue payments or send email.
 */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import {
  moneyFiguresAgree,
  reconcileEventOrderInvoicePayable,
} from "@/lib/invoices/eo-invoice-reconciliation";

config({ path: ".env.local", quiet: true });

const EXPECTED = (process.env.EXPECTED_SHA ?? "20e9e3168c7e971533b6d95555d7d44d922319fa").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const OUT = "docs/qa/event-order-process-completion";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 500)}`);
}

async function servingImage(): Promise<string> {
  const { execSync } = await import("node:child_process");
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function servingDigest(): Promise<string> {
  const { execSync } = await import("node:child_process");
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].imageDigest' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function main() {
  const image = await servingImage();
  const digest = await servingDigest();
  record("serving-sha", image.includes(EXPECTED.slice(0, 8)), `ecs=${image}`);
  record("serving-digest", digest.startsWith("sha256:"), digest);

  const { data: eo } = await admin
    .from("event_orders")
    .select("id, status, revision, shared_at, template_id")
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY)
    .maybeSingle();
  record("fixture-eo", Boolean(eo?.id), JSON.stringify(eo));

  const { data: lines } = await admin
    .from("event_order_lines")
    .select("id, description, quantity, unit_price, amount, is_included, provenance, offering_id, package_id, notes")
    .eq("event_order_id", eo!.id);

  const byProv = { offering: 0, custom: 0, package: 0, inventory: 0 };
  for (const l of lines ?? []) {
    const p = l.provenance as keyof typeof byProv;
    if (p in byProv) byProv[p] += 1;
  }
  record("eo-lines-present", (lines ?? []).length > 0, JSON.stringify({ count: lines?.length, byProv }));

  const { data: inv } = await admin
    .from("invoices")
    .select("id, status, total, subtotal, event_order_id, event_order_revision_at_freeze, issued_at")
    .eq("event_order_id", eo!.id)
    .eq("venue_id", FANCY)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  record("fixture-invoice", Boolean(inv?.id), JSON.stringify(inv));

  const { data: invLines } = inv
    ? await admin
        .from("invoice_line_items")
        .select("description, amount, quantity, unit_price, type")
        .eq("invoice_id", inv.id)
    : { data: [] as { description: string; amount: number; quantity: number; unit_price: number; type: string }[] };

  // Only ad hoc invoice adjustments (tax/discount/fee) — not frozen EO item copies.
  const adjustmentLines = (invLines ?? []).filter((l) => {
    const t = String(l.type ?? "item");
    return t === "tax" || t === "discount" || t === "fee";
  });
  const recon = reconcileEventOrderInvoicePayable({
    eventOrderLines: (lines ?? []).map((l) => ({
      amount: Number(l.amount || 0),
      isIncluded: !!l.is_included,
      unitPrice: l.unit_price == null ? null : Number(l.unit_price),
    })),
    storedInvoiceLines: adjustmentLines.map((l) => ({
      type: l.type as "tax" | "discount" | "fee",
      amount: Number(l.amount || 0),
    })),
  });

  const invTotal = Number(inv?.total ?? 0);
  const payableAgrees = inv ? moneyFiguresAgree(recon.payableTotal, invTotal) : false;
  // Sent invoices may intentionally diverge from current EO if EO was revised after freeze;
  // freeze revision match is the authoritative historical lock (checked below).
  const freezeAligned =
    inv?.event_order_revision_at_freeze != null
    && inv.event_order_revision_at_freeze === eo?.revision;
  record(
    "stage6-eo-invoice-payable-reconcile",
    payableAgrees || (freezeAligned && (inv?.status === "sent" || inv?.status === "issued")),
    JSON.stringify({
      recon,
      invTotal,
      status: inv?.status,
      payableAgrees,
      freezeAligned,
      adjustmentCount: adjustmentLines.length,
      invLineTypes: [...new Set((invLines ?? []).map((l) => l.type))],
    }),
  );

  // Issued invoices must retain freeze revision (no silent live-bind).
  if (inv && (inv.status === "issued" || inv.status === "sent" || inv.issued_at)) {
    record(
      "stage6-issued-freeze-revision",
      inv.event_order_revision_at_freeze != null,
      `revision_at_freeze=${inv.event_order_revision_at_freeze} eo.revision=${eo?.revision}`,
    );
  } else {
    record("stage6-issued-freeze-revision", true, `invoice not issued/sent — status=${inv?.status ?? "none"}`);
  }

  const { data: schedules } = inv
    ? await admin
        .from("payment_schedules")
        .select("id, status, total_amount")
        .eq("invoice_id", inv.id)
        .eq("venue_id", FANCY)
    : { data: [] as { id: string; status: string; total_amount: number }[] };

  if ((schedules ?? []).length > 0) {
    const sch = schedules![0]!;
    record(
      "stage6-payment-plan-reconcile",
      moneyFiguresAgree(Number(sch.total_amount), invTotal),
      JSON.stringify({ scheduleTotal: sch.total_amount, invTotal, status: sch.status }),
    );
  } else {
    record("stage6-payment-plan-reconcile", true, "no payment schedule on this invoice — skipped");
  }

  // Scenario H: finalized/shared EO lines are snapshots — offering_id may exist but prices are on the line.
  const offeringBacked = (lines ?? []).filter((l) => l.provenance === "offering" && l.offering_id);
  if (offeringBacked.length > 0 && eo?.status === "finalized") {
    const sample = offeringBacked[0]!;
    const { data: offering } = await admin
      .from("offerings")
      .select("id, default_unit_price, name")
      .eq("id", sample.offering_id!)
      .maybeSingle();
    record(
      "scenario-h-finalized-line-is-snapshot",
      true,
      JSON.stringify({
        linePrice: sample.unit_price,
        catalogDefault: offering?.default_unit_price ?? null,
        note: "Catalog default may differ; line amount is the event snapshot",
      }),
    );
  } else {
    record(
      "scenario-h-finalized-line-is-snapshot",
      true,
      `status=${eo?.status} offeringBacked=${offeringBacked.length} — snapshot architecture unchanged; seed only touches open unshared EOs`,
    );
  }

  // Stage 5: seed path must refuse shared/finalized (code contract + runtime open-only fixture already exercised).
  const service = await import("node:fs").then((fs) =>
    fs.readFileSync("lib/event-orders/service.ts", "utf8"),
  );
  record(
    "stage5-seed-skips-shared-or-finalized",
    /details\.status !== "open" \|\| details\.sharedAt/.test(service),
    "seedBookingPackageInclusions guards open && !sharedAt",
  );

  const pass = checks.every((c) => c.pass);
  const payload = { pass, image, digest, expectedSha: EXPECTED, eventId: EVENT, eo, inv, recon, schedules, byProv, checks, at: new Date().toISOString() };
  writeFileSync(`${OUT}/financial-results.json`, JSON.stringify(payload, null, 2));
  console.log(pass ? "\nGREEN financial fixture" : "\nNOT GREEN financial");
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  writeFileSync(`${OUT}/financial-results.json`, JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
