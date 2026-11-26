import { isReferralProgramReady } from "@shared/pricing";

import { SettingsTabsClient } from "@/components/settings/settings-tabs-client";

/**
 * Server wrapper so referral visibility uses REFERRAL_PROGRAM_V1 readiness
 * without exposing env diagnostics to the client.
 */
export async function SettingsTabs() {
  return <SettingsTabsClient showReferrals={isReferralProgramReady()} />;
}
