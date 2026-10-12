/**
 * Sandbox proof: explicit SMS consent persists via applyInquiryCommunicationCapture
 * when the form phone is blank but the lead on-file phone is present (existing-lead path).
 *
 * Usage: npx tsx scripts/qa/tour-sms-consent-persist-proof.mts
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { applyInquiryCommunicationCapture } from "../../lib/communication/apply-inquiry-consent.ts";
import { normalizeSmsAddressKey } from "../../lib/communication/permissions.ts";

const OUT = resolve("docs/qa/tour-sms-consent-opt-in");
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) throw new Error("Missing Supabase env");

const admin = createClient(url, key);
const venueId = "05f16a15-1752-4855-8a3b-aad5c593d8d9"; // Meadowbrook
const suffix = String(Date.now()).slice(-7);
const phone = `(603) 555-${suffix.slice(0, 4)}`;
const email = `sms-consent-qa-${Date.now()}@example.test`;

const results: Record<string, unknown> = { phone, email, venueId };

async function cleanup(leadId: string | null, addressKey: string | null) {
  if (addressKey) {
    await admin.from("communication_permissions").delete()
      .eq("venue_id", venueId).eq("channel", "sms").eq("address_key", addressKey);
  }
  if (leadId) {
    await admin.from("leads").delete().eq("id", leadId).eq("venue_id", venueId);
  }
}

async function main() {
  const { data: venue } = await admin.from("venues").select("id, name").eq("id", venueId).single();
  if (!venue) throw new Error("Meadowbrook not found");

  const { data: created, error: createErr } = await admin.rpc("ingest_lead", {
    p_venue_id: venueId,
    p_source: "website",
    p_input: {
      firstName: "SmsConsent",
      lastName: "QaFixture",
      email,
      phone,
      eventType: "wedding",
      eventDate: "2027-06-15",
      guestCount: 100,
      inquiryMessage: "Disposable SMS consent QA fixture — safe to delete",
      inquiryMessageOrigin: "staff",
    },
  });
  if (createErr || !(created as { ok?: boolean })?.ok) {
    throw new Error(`ingest_lead failed: ${createErr?.message ?? JSON.stringify(created)}`);
  }
  const leadId = (created as { leadId: string }).leadId;
  const relationshipId = (created as { relationshipId: string }).relationshipId;
  results.leadId = leadId;
  results.relationshipId = relationshipId;

  const addressKey = normalizeSmsAddressKey(phone);
  results.addressKey = addressKey;

  // A: checkbox on, form phone blank, fallback = on-file phone → opted_in tour_form
  const checked = await applyInquiryCommunicationCapture({
    venueId,
    venueName: venue.name,
    leadId,
    relationshipId,
    phone: "",
    fallbackPhone: phone,
    preferredChannels: ["email", "sms"],
    smsPermissionGranted: true,
    embedKey: "qa-fixture",
    source: "tour_form",
  });
  results.checkedCapture = checked;

  const { data: afterChecked } = await admin.from("communication_permissions")
    .select("status, source, evidence, consent_text")
    .eq("venue_id", venueId).eq("channel", "sms").eq("address_key", addressKey!)
    .maybeSingle();
  results.afterChecked = afterChecked;

  // B: unchecked must not create/keep opted_in on a fresh number
  const phone2 = `(603) 555-${String(Date.now()).slice(-4)}`;
  const key2 = normalizeSmsAddressKey(phone2);
  const unchecked = await applyInquiryCommunicationCapture({
    venueId,
    venueName: venue.name,
    leadId,
    relationshipId,
    phone: phone2,
    preferredChannels: ["sms"],
    smsPermissionGranted: false,
    embedKey: "qa-fixture",
    source: "tour_form",
  });
  results.uncheckedCapture = unchecked;
  const { data: afterUnchecked } = await admin.from("communication_permissions")
    .select("status, source")
    .eq("venue_id", venueId).eq("channel", "sms").eq("address_key", key2!)
    .maybeSingle();
  results.afterUnchecked = afterUnchecked;

  // C: phone alone (checkbox false) on original — leave opted_in from A; prove phone-alone path on new #
  const phone3 = `(603) 555-${String(Date.now() + 1).slice(-4)}`;
  const key3 = normalizeSmsAddressKey(phone3);
  const phoneAlone = await applyInquiryCommunicationCapture({
    venueId,
    venueName: venue.name,
    leadId,
    relationshipId,
    phone: phone3,
    preferredChannels: ["email"],
    smsPermissionGranted: false,
    source: "tour_form",
  });
  results.phoneAloneCapture = phoneAlone;
  const { data: afterPhoneAlone } = await admin.from("communication_permissions")
    .select("status, source")
    .eq("venue_id", venueId).eq("channel", "sms").eq("address_key", key3!)
    .maybeSingle();
  results.afterPhoneAlone = afterPhoneAlone;

  const pass =
    checked.ok === true &&
    checked.consentRecorded === true &&
    afterChecked?.status === "opted_in" &&
    afterChecked?.source === "tour_form" &&
    (afterChecked?.evidence as { leadId?: string } | null)?.leadId === leadId &&
    unchecked.ok === true &&
    unchecked.consentRecorded === false &&
    afterUnchecked == null &&
    afterPhoneAlone == null;

  results.pass = pass;

  await cleanup(leadId, addressKey);
  if (key2) await admin.from("communication_permissions").delete().eq("venue_id", venueId).eq("address_key", key2);
  if (key3) await admin.from("communication_permissions").delete().eq("venue_id", venueId).eq("address_key", key3);

  writeFileSync(resolve(OUT, "persist-proof.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ pass, leadId, status: afterChecked?.status, source: afterChecked?.source }, null, 2));
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
