import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shell/module-placeholder";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { WebsiteFormsSection } from "@/components/settings/website-forms-section";
import { TourSettingsSection } from "@/components/settings/tour-settings-section";
import { CommercialBookingPrefsSection } from "@/components/settings/commercial-booking-prefs-section";
import { PlanningCapabilitiesSection } from "@/components/settings/planning-capabilities-section";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEFAULT_COMMERCIAL_BOOKING_PREFS } from "@/lib/booking-journey/venue-prefs";
import { capabilitiesFromVenue } from "@/lib/playbooks/capabilities";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";
import { getEmailIntakeHealth } from "@/lib/lead-intake/email-intake-health";
import { getEmailIntakeStatus } from "@/lib/lead-intake/email-status";
import { getInquiryFormSettings, getPublicInquiryFormConfig } from "@/lib/inquiry-form/service";
import { getTourSettings } from "@/lib/tours/service";

export const metadata: Metadata = { title: "Leads & Booking — Settings" };

export default async function LeadsBookingSettingsPage() {
  const [venue, emailIntakeStatus, intakeHealth, tourSettings, inquiryFormSettings, role] = await Promise.all([
    getCurrentVenue(), getEmailIntakeStatus(), getEmailIntakeHealth(), getTourSettings(), getInquiryFormSettings(), getCurrentUserRole(),
  ]);
  const previewBaseConfig = venue?.embedKey
    ? await getPublicInquiryFormConfig(venue.embedKey)
    : null;
  const canEditInquiryForm = role === "owner" || role === "manager";
  const planningCapabilities = capabilitiesFromVenue(venue);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads & Booking"
        description="Inquiry forms, lead sources, tour booking, and how you book couples."
      />
      <SettingsTabs />

      {venue && (
        <Card id="booking">
          <CardHeader>
            <CardTitle className="text-base">How you sell</CardTitle>
            <CardDescription>
              Agreement, initial payment, and payment collection defaults. Booked remains your decision.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CommercialBookingPrefsSection
              initial={venue.commercialBookingPrefs ?? DEFAULT_COMMERCIAL_BOOKING_PREFS}
            />
          </CardContent>
        </Card>
      )}

      {venue && (
        <Card id="planning">
          <CardHeader>
            <CardTitle className="text-base">Planning tools</CardTitle>
            <CardDescription>
              Venue-wide choices for which capabilities belong in your normal post-booking event workflow.
              Setup Profiles configure the starting templates for each enabled capability by event type.
              Turning a capability off does not rewrite existing profiles or booked events.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PlanningCapabilitiesSection initial={planningCapabilities} />
            <p className="mt-4 text-sm text-muted-foreground">
              <Link href="/settings/leads/setup-profiles" className="font-medium text-foreground underline underline-offset-2">
                Setup Profiles
              </Link>
              {" "}
              — tell Hello to Cheers how this venue normally operates. New events inherit the profile for their type.
            </p>
          </CardContent>
        </Card>
      )}

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
              intakeHealth={intakeHealth}
              inquiryFormSettings={inquiryFormSettings}
              canEditInquiryForm={canEditInquiryForm}
              previewBaseConfig={previewBaseConfig}
            />
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
