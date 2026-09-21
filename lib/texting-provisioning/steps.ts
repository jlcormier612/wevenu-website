/**
 * Ordered, idempotent provisioning steps for venue texting self-service.
 *
 * Sequenced per proven Sandbox result:
 * Brand APPROVED → Campaign create (0 phones) → Campaign VERIFIED → phone.
 */
export const TEXTING_PROVISIONING_STEPS = [
  "create_subaccount",
  "create_api_key",
  "store_secret",
  "create_messaging_service",
  "configure_webhooks",
  "submit_secondary_profile",
  "submit_a2p_trust_product",
  "submit_brand",
  "await_brand_approved",
  "submit_campaign",
  "await_campaign_verified",
  "buy_number",
  "attach_number",
  "await_number_a2p",
  "mark_ready",
] as const;

export type TextingProvisioningStep = (typeof TEXTING_PROVISIONING_STEPS)[number];

export function isTextingProvisioningStep(value: string): value is TextingProvisioningStep {
  return (TEXTING_PROVISIONING_STEPS as readonly string[]).includes(value);
}

export function nextTextingProvisioningStep(
  current: TextingProvisioningStep | null,
): TextingProvisioningStep | null {
  if (!current) return TEXTING_PROVISIONING_STEPS[0];
  const idx = TEXTING_PROVISIONING_STEPS.indexOf(current);
  if (idx < 0 || idx >= TEXTING_PROVISIONING_STEPS.length - 1) return null;
  return TEXTING_PROVISIONING_STEPS[idx + 1];
}

/** Steps that imply Twilio compliance artifacts are in review / submitted. */
export const COMPLIANCE_REVIEW_STEPS: ReadonlySet<TextingProvisioningStep> = new Set([
  "submit_secondary_profile",
  "submit_a2p_trust_product",
  "submit_brand",
  "await_brand_approved",
  "submit_campaign",
  "await_campaign_verified",
]);
