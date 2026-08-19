import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { LeadCaptureStage } from "@/components/setup-hub/lead-capture-stage";
import { getFacebookConnection, getFacebookLeadForms, getRecentFacebookLog } from "@/lib/facebook/service";
import { getEmailIntakeStatus } from "@/lib/lead-intake/email-status";
import { getIntakeHealthSummary } from "@/lib/lead-intake/monitoring";
import { getQrCampaignAnalytics, getQrCampaigns } from "@/lib/qr-campaigns/service";
import { getLeadCaptureStageStatus } from "@/lib/setup-hub/service";
import { getTourAvailabilityExceptions, getTourAvailabilityWindows, getTourSettings } from "@/lib/tours/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Lead Capture — Setup" };
export const dynamic = "force-dynamic";

export default async function LeadCaptureSetupPage() {
  const [
    venue, emailIntakeStatus, tourSettings, tourWindows, tourExceptions,
    facebookConnection, facebookLeadForms, facebookLog,
    qrCampaigns, qrAnalytics, intakeHealth, stageStatus,
  ] = await Promise.all([
    getCurrentVenue(),
    getEmailIntakeStatus(),
    getTourSettings(),
    getTourAvailabilityWindows(),
    getTourAvailabilityExceptions(),
    getFacebookConnection(),
    getFacebookLeadForms(),
    getRecentFacebookLog(),
    getQrCampaigns(),
    getQrCampaignAnalytics(),
    getIntakeHealthSummary(),
    getLeadCaptureStageStatus(),
  ]);

  if (!venue) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const leadEmailAddress = process.env.RESEND_INBOUND_ADDRESS
    ? `leads+${venue.leadEmailKey}@${process.env.RESEND_INBOUND_ADDRESS.replace(/^.*@/, "")}`
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Capture"
        description="How new inquiries reach Hello to Cheers."
      />
      <LeadCaptureStage
        venueId={venue.id}
        embedKey={venue.embedKey}
        appUrl={appUrl}
        leadEmailAddress={leadEmailAddress}
        emailIntakeStatus={emailIntakeStatus}
        tourSettings={tourSettings}
        tourWindows={tourWindows}
        tourExceptions={tourExceptions}
        facebookConnection={facebookConnection}
        facebookLeadForms={facebookLeadForms}
        facebookLog={facebookLog}
        qrCampaigns={qrCampaigns}
        qrAnalytics={qrAnalytics}
        intakeHealth={intakeHealth}
        stageStatus={stageStatus}
      />
    </div>
  );
}
