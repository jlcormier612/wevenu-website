import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { LeadCaptureStage } from "@/components/setup-hub/lead-capture-stage";
import { getEmailIntakeStatus } from "@/lib/lead-intake/email-status";
import { getQrCampaignAnalytics, getQrCampaigns } from "@/lib/qr-campaigns/service";
import { getLeadCaptureStageStatus } from "@/lib/setup-hub/service";
import { editorHydrationFromAvailability } from "@/lib/tours/availability-read";
import { getTourAvailability, getTourSettings } from "@/lib/tours/service";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";
import { getInquiryFormSettings } from "@/lib/inquiry-form/service";

export const metadata: Metadata = { title: "Lead Capture — Setup" };
export const dynamic = "force-dynamic";

export default async function LeadCaptureSetupPage() {
  const [
    venue, emailIntakeStatus, tourSettings, tourAvailability,
    qrCampaigns, qrAnalytics, stageStatus,
    inquiryFormSettings, role,
  ] = await Promise.all([
    getCurrentVenue(),
    getEmailIntakeStatus(),
    getTourSettings(),
    getTourAvailability(),
    getQrCampaigns(),
    getQrCampaignAnalytics(),
    getLeadCaptureStageStatus(),
    getInquiryFormSettings(),
    getCurrentUserRole(),
  ]);

  if (!venue) return null;

  const { windows: tourWindows, exceptions: tourExceptions, loadError: tourAvailabilityLoadError } =
    editorHydrationFromAvailability(tourAvailability);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const leadEmailAddress = process.env.RESEND_INBOUND_ADDRESS
    ? `leads+${venue.leadEmailKey}@${process.env.RESEND_INBOUND_ADDRESS.replace(/^.*@/, "")}`
    : null;
  const canEditInquiryForm = role === "owner" || role === "manager";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Capture"
        description="Bring inquiries from the places couples already find you."
      />
      <LeadCaptureStage
        embedKey={venue.embedKey}
        appUrl={appUrl}
        leadEmailAddress={leadEmailAddress}
        emailIntakeStatus={emailIntakeStatus}
        tourSettings={tourSettings}
        tourWindows={tourWindows}
        tourExceptions={tourExceptions}
        tourAvailabilityLoadError={tourAvailabilityLoadError}
        qrCampaigns={qrCampaigns}
        qrAnalytics={qrAnalytics}
        stageStatus={stageStatus}
        inquiryFormSettings={inquiryFormSettings}
        canEditInquiryForm={canEditInquiryForm}
      />
    </div>
  );
}
