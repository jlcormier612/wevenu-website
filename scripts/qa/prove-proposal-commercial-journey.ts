/**
 * Path A proof against Sandbox DB (service role):
 * multi-option proposal → freeze → client select → approve → L2
 * Does not book. Does not charge Stripe.
 *
 * Usage: npx tsx --env-file=.env.local scripts/qa/prove-proposal-commercial-journey.ts
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(url, key, { auth: { persistSession: false } });

const SWEET_DAISY = "5c84e74e-355d-4ce1-9e6b-913a9267f543";
const OUT = resolve("docs/qa/proposal-commercial-selection-payment-journey");

async function main() {
  mkdirSync(OUT, { recursive: true });
  const stamp = Date.now();
  const email = `proposal.e2e.${stamp}@hellotocheers.test`;

  // Mark one package as addon for menu UX (catalog mutation on disposable venue)
  const { data: pkgs } = await sb
    .from("packages")
    .select("id,name,base_price,offer_role,is_active")
    .eq("venue_id", SWEET_DAISY)
    .eq("is_active", true)
    .gt("base_price", 0)
    .order("base_price")
    .limit(4);
  if (!pkgs || pkgs.length < 2) throw new Error("Need ≥2 priced packages on Sweet Daisy");

  const primaries = pkgs.slice(0, 2);
  let addon = pkgs[2] ?? null;
  if (addon) {
    await sb.from("packages").update({ offer_role: "addon" }).eq("id", addon.id);
    addon = { ...addon, offer_role: "addon" };
  }

  const { data: lead, error: leadErr } = await sb
    .from("leads")
    .insert({
      venue_id: SWEET_DAISY,
      first_name: "Proposal",
      last_name: `E2E${stamp}`,
      email,
      event_type: "wedding",
      guest_count: 120,
      status: "new",
    })
    .select("id,email,first_name,last_name")
    .single();
  if (leadErr || !lead) throw leadErr ?? new Error("lead create failed");

  const { data: proposal, error: pErr } = await sb
    .from("commercial_proposals")
    .insert({
      venue_id: SWEET_DAISY,
      lead_id: lead.id,
      status: "draft",
      deposit_amount: 800,
      offer_message: "Pick the package that feels right.",
      eligibility_context: { eventType: "wedding", guestCount: 120 },
    })
    .select("*")
    .single();
  if (pErr || !proposal) throw pErr ?? new Error("proposal create failed");

  const optionIds: { id: string; role: string; price: number; name: string }[] = [];
  let sort = 0;
  for (const pkg of primaries) {
    const { data: opt, error } = await sb
      .from("commercial_proposal_options")
      .insert({
        proposal_id: proposal.id,
        venue_id: SWEET_DAISY,
        source_package_id: pkg.id,
        offer_role: "primary",
        name: pkg.name,
        description: null,
        unit_price: pkg.base_price,
        included_items: [],
        sort_order: sort++,
        frozen_at: null,
      })
      .select("id,unit_price,name")
      .single();
    if (error || !opt) throw error ?? new Error("option insert");
    optionIds.push({ id: opt.id, role: "primary", price: Number(opt.unit_price), name: opt.name });
  }
  if (addon) {
    const { data: opt, error } = await sb
      .from("commercial_proposal_options")
      .insert({
        proposal_id: proposal.id,
        venue_id: SWEET_DAISY,
        source_package_id: addon.id,
        offer_role: "addon",
        name: addon.name,
        description: null,
        unit_price: addon.base_price,
        included_items: [],
        sort_order: sort++,
        frozen_at: null,
      })
      .select("id,unit_price,name")
      .single();
    if (error || !opt) throw error ?? new Error("addon option insert");
    optionIds.push({ id: opt.id, role: "addon", price: Number(opt.unit_price), name: opt.name });
  }

  // Mutate live catalog price AFTER drafting — must not change frozen offer after send
  const catalogBumpId = primaries[0]!.id;
  const originalPrice = Number(primaries[0]!.base_price);
  await sb.from("packages").update({ base_price: originalPrice + 999 }).eq("id", catalogBumpId);

  const token = randomBytes(24).toString("hex");
  const now = new Date().toISOString();
  await sb
    .from("commercial_proposal_options")
    .update({ frozen_at: now })
    .eq("proposal_id", proposal.id);
  await sb
    .from("commercial_proposals")
    .update({ status: "sent", accept_token: token, offered_at: now })
    .eq("id", proposal.id);

  const { data: frozenOpts } = await sb
    .from("commercial_proposal_options")
    .select("id,unit_price,source_package_id,frozen_at")
    .eq("proposal_id", proposal.id);
  const bumpedStillFrozen = frozenOpts?.find((o) => o.source_package_id === catalogBumpId);
  if (!bumpedStillFrozen || Number(bumpedStillFrozen.unit_price) !== originalPrice) {
    throw new Error("L1 freeze failed — catalog bump mutated offered price");
  }

  const chosenPrimary = optionIds.find((o) => o.role === "primary")!;
  const chosenAddon = optionIds.find((o) => o.role === "addon");
  const choices = [
    { optionId: chosenPrimary.id, quantity: 1 },
    ...(chosenAddon ? [{ optionId: chosenAddon.id, quantity: 1 }] : []),
  ];
  const expectedTotal =
    chosenPrimary.price + (chosenAddon ? chosenAddon.price : 0);

  const { data: selectRes, error: selErr } = await sb.rpc("select_commercial_proposal", {
    p_token: token,
    p_choices: choices,
  });
  if (selErr) throw selErr;
  if (!selectRes?.ok) throw new Error(`select failed: ${JSON.stringify(selectRes)}`);

  const { data: afterSelect } = await sb
    .from("commercial_proposals")
    .select("status,selected_at,approved_at")
    .eq("id", proposal.id)
    .single();
  if (afterSelect?.status !== "selected" || !afterSelect.selected_at) {
    throw new Error("selected_at not set");
  }
  if (afterSelect.approved_at) throw new Error("approved_at must be null after select-only");

  const { data: approveRes, error: apErr } = await sb.rpc("approve_commercial_proposal", {
    p_token: token,
  });
  if (apErr) throw apErr;
  if (!approveRes?.ok) throw new Error(`approve failed: ${JSON.stringify(approveRes)}`);

  const selectionId = approveRes.selectionId as string;
  const { data: selection } = await sb
    .from("commercial_selections")
    .select("*")
    .eq("id", selectionId)
    .single();
  if (!selection) throw new Error("L2 missing");
  if (selection.status !== "accepted") throw new Error("L2 not accepted");
  if (Number(selection.total_amount) !== expectedTotal) {
    throw new Error(`L2 total ${selection.total_amount} != expected ${expectedTotal}`);
  }
  if (!selection.selected_at || !selection.approved_at) {
    throw new Error("L2 missing selected_at/approved_at");
  }
  if (selection.proposal_id !== proposal.id) throw new Error("L2 not linked to proposal");

  // Restore catalog price
  await sb.from("packages").update({ base_price: originalPrice }).eq("id", catalogBumpId);

  const offerUrl = `https://app.sandbox.hellotocheers.com/offer/${token}`;
  const evidence = {
    ok: true,
    path: "A",
    venue_id: SWEET_DAISY,
    lead_id: lead.id,
    proposal_id: proposal.id,
    selection_id: selectionId,
    offer_url: offerUrl,
    accept_token: token,
    options_offered: optionIds,
    choices,
    expected_total: expectedTotal,
    l2_total: Number(selection.total_amount),
    selected_at: selection.selected_at,
    approved_at: selection.approved_at,
    catalog_bump_did_not_mutate_l1: true,
    does_not_book: true,
    note: "DB/RPC Path A proof. Browser/Stripe/mailbox still required for GREEN.",
  };
  writeFileSync(resolve(OUT, "path-a-db-proof.json"), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
