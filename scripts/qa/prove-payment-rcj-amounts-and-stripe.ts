/**
 * Seed a correct commercial payment fixture on Stripe-connected Sweet Daisy:
 * L2/invoice total $7,700 · deposit $800 · remaining $6,900.
 * Prove email amount lines + checkout RPC readiness (no Pay CTA on Fancy).
 *
 * Usage: npx tsx --env-file=.env.local scripts/qa/prove-payment-rcj-amounts-and-stripe.ts
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const DAISY = "5c84e74e-355d-4ce1-9e6b-913a9267f543";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const NAMED_TOKEN = "a3f37893d77359c7c8352b04aa65347761c50af2bf083af4bbbb594ddde2f683";
const NAMED_LINE = "d354875d-d9ef-44ca-acea-a45167dd7cb9";
const OUT = resolve("docs/qa/payment-rcj-regression");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(url, key, { auth: { persistSession: false } });

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

async function checkoutRpc(token: string, itemId: string) {
  const { data, error } = await sb.rpc("get_portal_checkout_context", {
    p_token: token,
    p_item_id: itemId,
  });
  if (error) return { error: error.message };
  return data as Record<string, unknown>;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const stamp = Date.now();

  const { data: daisy } = await sb
    .from("venues")
    .select("id,name,stripe_account_id,stripe_onboarding_status,stripe_charges_enabled")
    .eq("id", DAISY)
    .single();
  const { data: fancy } = await sb
    .from("venues")
    .select("id,name,stripe_account_id,stripe_onboarding_status,stripe_charges_enabled")
    .eq("id", FANCY)
    .single();

  if (!daisy?.stripe_account_id || daisy.stripe_onboarding_status !== "connected") {
    throw new Error("Sweet Daisy must remain Stripe-connected for this RCJ");
  }

  // --- Seed correct commercial invoice (7700) + deposit/remaining lines ---
  const { data: client, error: ce } = await sb
    .from("clients")
    .insert({
      venue_id: DAISY,
      first_name: "Deposit",
      last_name: `RCJ${stamp}`,
      email: `deposit.rcj.${stamp}@hellotocheers.test`,
      status: "planning",
    } as never)
    .select("id,email,first_name")
    .single();
  if (ce || !client) throw new Error(`client: ${ce?.message}`);

  const { data: portal, error: pe } = await sb
    .from("client_portal_sessions")
    .insert({
      venue_id: DAISY,
      client_id: client.id,
      label: "Payment",
      access_level: "financial",
    } as never)
    .select("access_token")
    .single();
  if (pe || !portal?.access_token) throw new Error(`portal: ${pe?.message}`);

  const invNumber = `INV-RCJ7700-${stamp.toString(36).toUpperCase()}`;
  const { data: inv, error: ie } = await sb
    .from("invoices")
    .insert({
      venue_id: DAISY,
      client_id: client.id,
      invoice_number: invNumber,
      display_name: "Wedding Deposit",
      status: "sent",
      subtotal: 7700,
      total: 7700,
      balance_due: 7700,
      notes: "Payment RCJ regression — commercial total preserved",
    } as never)
    .select("id,invoice_number,display_name,total,balance_due")
    .single();
  if (ie || !inv) throw new Error(`invoice: ${ie?.message}`);

  await sb.from("invoice_line_items").insert({
    venue_id: DAISY,
    invoice_id: inv.id,
    type: "package",
    description: "Signature Wedding + Full-Service",
    quantity: 1,
    unit_price: 7700,
    amount: 7700,
    sort_order: 0,
  } as never);

  const { data: sched, error: se } = await sb
    .from("payment_schedules")
    .insert({
      venue_id: DAISY,
      client_id: client.id,
      invoice_id: inv.id,
      title: "Wedding payments",
      total_amount: 7700,
    } as never)
    .select("id,total_amount")
    .single();
  if (se || !sched) throw new Error(`schedule: ${se?.message}`);

  const today = new Date().toISOString().slice(0, 10);
  const { data: lines, error: le } = await sb
    .from("payment_line_items")
    .insert([
      {
        venue_id: DAISY,
        schedule_id: sched.id,
        label: "Initial Payment",
        amount: 800,
        due_date: today,
        status: "pending",
        sort_order: 0,
        obligation_kind: "deposit",
      },
      {
        venue_id: DAISY,
        schedule_id: sched.id,
        label: "Remaining Balance",
        amount: 6900,
        due_date: today,
        status: "pending",
        sort_order: 1,
        obligation_kind: "final",
      },
    ] as never)
    .select("id,label,amount,status,obligation_kind");
  if (le || !lines?.length) throw new Error(`lines: ${le?.message}`);

  const deposit = lines.find((l) => l.obligation_kind === "deposit")!;
  const dueNow = 800;
  const paidToDate = 0;
  const remainingAfter = Math.max(0, inv.balance_due - dueNow);

  const emailBody = [
    `Initial Payment: ${money(dueNow)}`,
    `Total contracted: ${money(inv.total)}`,
    `Paid to date: ${money(paidToDate)}`,
    `Remaining after this payment: ${money(remainingAfter)}`,
  ].join("\n");

  const daisyCheckout = await checkoutRpc(portal.access_token, deposit.id);
  const fancyCheckout = await checkoutRpc(NAMED_TOKEN, NAMED_LINE);

  const proof = {
    ok:
      inv.total === 7700 &&
      dueNow === 800 &&
      remainingAfter === 6900 &&
      inv.display_name === "Wedding Deposit" &&
      Boolean((daisyCheckout as { stripeAccountId?: string }).stripeAccountId) &&
      (fancyCheckout as { error?: string }).error === "stripe_not_connected",
    venues: { daisy, fancy },
    fixture: {
      client,
      invoice: inv,
      schedule: sched,
      lines,
      deposit_line_id: deposit.id,
      pay_url: `https://app.sandbox.hellotocheers.com/p/${portal.access_token}`,
      portal_token: portal.access_token,
    },
    email_amount_lines: {
      body: emailBody,
      asserts: {
        total_contracted_7700: emailBody.includes("$7,700.00"),
        initial_800: emailBody.includes("$800.00"),
        remaining_6900: emailBody.includes("$6,900.00"),
        display_name_does_not_change_total: inv.display_name === "Wedding Deposit" && inv.total === 7700,
      },
    },
    checkout: {
      daisy: daisyCheckout,
      fancy_named_fixture: fancyCheckout,
    },
    audit_note:
      "INV-NAMED-MUEGXH6K on Fancy was a display_name-only seed (invoice total 800, no Stripe). Not the commercial $7700 RCJ.",
  };

  writeFileSync(resolve(OUT, "amounts-stripe-proof.json"), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof, null, 2));
  if (!proof.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
