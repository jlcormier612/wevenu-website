#!/usr/bin/env npx tsx
/**
 * Dry-run only: print the A2P Campaign create/resubmit field map that MUST be used
 * for Hello to Cheers. Does not call Twilio. Does not submit or charge.
 *
 * Usage: npx tsx scripts/preview-a2p-campaign-payload.ts
 */
import {
  HELLO_TO_CHEERS_PRIVACY_POLICY_URL,
  HELLO_TO_CHEERS_SMS_OPT_IN_EVIDENCE_URL,
  HELLO_TO_CHEERS_TERMS_AND_CONDITIONS_URL,
  assertA2pCampaignPackageClean,
  buildA2pCampaignCreateFields,
} from "../lib/texting-registration/a2p-campaign-payload";

const fields = buildA2pCampaignCreateFields({
  brandRegistrationSid: "BN6dd5457b78fc5a24380b3cd9ca72b045",
  brandName: "QuickCloud LLC",
  privacyPolicyUrl: HELLO_TO_CHEERS_PRIVACY_POLICY_URL,
  termsUrl: HELLO_TO_CHEERS_TERMS_AND_CONDITIONS_URL,
  publicOptInEvidenceUrl: HELLO_TO_CHEERS_SMS_OPT_IN_EVIDENCE_URL,
});

assertA2pCampaignPackageClean(fields);

console.log("=== Hello to Cheers A2P Campaign package (DRY RUN) ===\n");
console.log(JSON.stringify(fields, null, 2));
console.log("\n# MessageFlow (readable)\n");
console.log(fields.MessageFlow);
console.log("\n# Public evidence URL:", HELLO_TO_CHEERS_SMS_OPT_IN_EVIDENCE_URL);
console.log("\n# DRY RUN ONLY — no Twilio request was made.");
