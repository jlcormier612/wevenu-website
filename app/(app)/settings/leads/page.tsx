import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { WebsiteFormsSection } from "@/components/settings/website-forms-section";
import { LeadIntakeHealthSection } from "@/components/settings/lead-intake-health-section";
import { TourSettingsSection } from "@/components/settings/tour-settings-section";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";
import { getIntakeHealthSummary } from "@/lib/lead-intake/monitoring";
import { getEmailIntakeStatus } from "@/lib/lead-intake/email-status";
import { getInquiryFormSettings } from "@/lib/inquiry-form/service";
import { getTourSettings } from "@/lib/tours/service";

export const metadata: Metadata = { title: "Leads & Booking — Settings" };

export default async function LeadsBookingSettingsPage() {
  const [venue, intakeHealth, emailIntakeStatus, tourSettings, inquiryFormSettings, role] = await Promise.all([
    getCurrentVenue(), getIntakeHealthSummary(), getEmailIntakeStatus(), getTourSettings(), getInquiryFormSettings(), getCurrentUserRole(),
  ]);
  const canEditInquiryForm = role === "owner" || role === "manager";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads & Booking"
        description="Inquiry forms, lead sources, and tour booking."
      />
      <SettingsTabs />

      {venue && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inquiry Form</CardTitle>
            <CardDescription>
              Share your inquiry form or embed it on your website. Every submission becomes a lead in Hello to Cheers automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WebsiteFormsSection
              embedKey={venue.embedKey}
              appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
              leadEmailAddress={
                process.env.RESEND_INBOUND_ADDRESS
                  ? `leads+${venue.leadEmailKey}@${process.env.RESEND_INBOUND_ADDRESS.replace(/^.*@/, "")}`
                  : null
              }
              emailIntakeStatus={emailIntakeStatus}
              inquiryFormSettings={inquiryFormSettings}
              canEditInquiryForm={canEditInquiryForm}
            />
          </CardContent>
        </Card>
      )}

      {venue && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lead Intake Health</CardTitle>
            <CardDescription>
              Every inquiry your venue receives — website, tour requests, and email intake — in one place.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LeadIntakeHealthSection summary={intakeHealth} />
          </CardContent>
        </Card>
      )}

      {tourSettings && (
        <Card id="tours" className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="text-base">Tour Scheduling</CardTitle>
            <CardDescription>
              Let clients schedule a tour directly from your website. Every booking creates a lead in Hello to Cheers automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TourSettingsSection initialSettings={tourSettings} />
            <p className="mt-4 text-xs text-muted-foreground">
              Weekly hours and blocked dates are managed under Availability &amp; Capacity.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
