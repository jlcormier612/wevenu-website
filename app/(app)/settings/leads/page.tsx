import type { Metadata } from "next";
import Link from "next/link";

import { SetupHubReturnLink } from "@/components/setup-hub/phase-b1/setup-hub-return-link";
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
import type { GmailVerificationCustomerView } from "@/lib/lead-intake/gmail-forwarding-verification";
import { getActiveGmailVerificationForVenue } from "@/lib/lead-intake/gmail-forwarding-verification-store";
import { getInquiryFormSettings, getPublicInquiryFormConfig } from "@/lib/inquiry-form/service";
import { getTourSettings } from "@/lib/tours/service";
import { createAdminClient } from "@/integrations/supabase/admin";

export const metadata: Metadata = { title: "Leads & Booking — Settings" };

function syntheticGmailFixture(modeRaw?: string | null): GmailVerificationCustomerView | null {
  // Local visual acceptance only. Requires BOTH flags — never set ALLOW_* in Sandbox/Production.
  // Optional ?gmail_fixture=pending|pending-code|opened|expired|code-only
  if (process.env.ALLOW_GMAIL_VERIFICATION_UI_FIXTURE !== "1") return null;
  if (process.env.GMAIL_VERIFICATION_UI_FIXTURE !== "1") return null;
  const mode = (modeRaw ?? process.env.GMAIL_VERIFICATION_UI_FIXTURE_STATE ?? "pending").trim();
  const base = {
    id: `fixture-${mode}`,
    confirmationCode: mode === "code-only" ? "123456789" : mode === "pending-code" || mode === "opened" ? "987654321" : null,
    hasLink: mode !== "code-only",
    expiresAt: mode === "expired" ? new Date(Date.now() - 60_000).toISOString() : null,
    expiryKnown: mode === "expired",
    receivedAt: new Date().toISOString(),
  };
  if (mode === "expired") return { ...base, display: "expired", hasLink: true, confirmationCode: null };
  if (mode === "opened") return { ...base, display: "opened", hasLink: true };
  if (mode === "code-only") return { ...base, display: "pending", hasLink: false };
  return { ...base, display: "pending", hasLink: true, confirmationCode: mode === "pending-code" ? base.confirmationCode : null };
}

export default async function LeadsBookingSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : {};
  const fixtureMode = typeof sp.gmail_fixture === "string" ? sp.gmail_fixture : null;
  const [venue, emailIntakeStatus, intakeHealth, tourSettings, inquiryFormSettings, role] = await Promise.all([
    getCurrentVenue(), getEmailIntakeStatus(), getEmailIntakeHealth(), getTourSettings(), getInquiryFormSettings(), getCurrentUserRole(),
  ]);
  const previewBaseConfig = venue?.embedKey
    ? await getPublicInquiryFormConfig(venue.embedKey)
    : null;
  const canEditInquiryForm = role === "owner" || role === "manager";
  const planningCapabilities = capabilitiesFromVenue(venue);

  let gmailVerification: GmailVerificationCustomerView | null = syntheticGmailFixture(fixtureMode);
  if (!gmailVerification && venue && (role === "owner" || role === "manager")) {
    try {
      gmailVerification = await getActiveGmailVerificationForVenue(createAdminClient(), venue.id);
    } catch {
      gmailVerification = null;
    }
  }

  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      <SetupHubReturnLink href="/setup-hub/make-htc-yours/booking-process" label="Back to your booking process" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Leads & Booking"
          description="Inquiry forms, lead sources, tour booking, and how you book couples."
        />
      </div>
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
        <Card id="inquiry" className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="text-base">Website Inquiry Form</CardTitle>
            <CardDescription>
              Turn website visitors into prospective clients.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WebsiteFormsSection
              embedKey={venue.embedKey}
              appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
              leadEmailAddress={
                process.env.RESEND_INBOUND_ADDRESS
                  ? `leads+${venue.leadEmailKey}@${process.env.RESEND_INBOUND_ADDRESS.replace(/^.*@/, "")}`
                  : process.env.ALLOW_GMAIL_VERIFICATION_UI_FIXTURE === "1" &&
                      process.env.GMAIL_VERIFICATION_UI_FIXTURE === "1"
                    ? `leads+${venue.leadEmailKey}@inbound.local.test`
                    : null
              }
              emailIntakeStatus={emailIntakeStatus}
              intakeHealth={intakeHealth}
              gmailVerification={gmailVerification}
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
