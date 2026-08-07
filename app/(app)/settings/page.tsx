import type { Metadata } from "next";
import Link from "next/link";

import { CapacityRulesSection } from "@/components/availability/capacity-rules-section";
import { VenueSpacesSection } from "@/components/availability/venue-spaces-section";
import { PageHeader } from "@/components/shell/module-placeholder";
import { LuvSettingsSection } from "@/components/settings/luv-settings-section";
import { NotificationPreferencesSection } from "@/components/settings/notification-preferences-section";
import { NotificationsSection } from "@/components/settings/notifications-section";
import { TourSettingsSection } from "@/components/settings/tour-settings-section";
import { ReviewReferralNudgeSection } from "@/components/settings/review-referral-nudge-section";
import { WebsiteFormsSection } from "@/components/settings/website-forms-section";
import { LeadIntakeHealthSection } from "@/components/settings/lead-intake-health-section";
import { DataExportSection } from "@/components/settings/data-export-section";
import { LuvHeart } from "@/components/dashboard/luv-widget";
import { StripeConnectSection } from "@/components/settings/stripe-connect-section";
import { QuickBooksConnectSection } from "@/components/settings/quickbooks-connect-section";
import { FacebookConnectSection } from "@/components/settings/facebook-connect-section";
import { VenueSettings } from "@/components/settings/venue-settings";
import { LegalHistorySection } from "@/components/legal/legal-history-section";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCapacityRules, getSpaces } from "@/lib/availability/service";
import { listLegalAcceptancesForCurrentUser } from "@/lib/legal/service";
import { getLuvSettings } from "@/lib/luv/settings";
import { getCurrentVenue, getVenueSettings } from "@/lib/venue/service";
import { getNotificationStats } from "@/lib/notifications/stats";
import { isEmailConfigured } from "@/lib/email/send";
import { getNotificationPreferences } from "@/lib/notifications/preferences";
import { getTourAvailabilityExceptions, getTourAvailabilityWindows, getTourSettings } from "@/lib/tours/service";
import { getIntakeHealthSummary } from "@/lib/lead-intake/monitoring";
import { getEmailIntakeStatus } from "@/lib/lead-intake/email-status";
import { getEventCompletedNudgeRule } from "@/lib/automation/service";
import { getQuickBooksConnection, getRecentQuickBooksSyncLog } from "@/lib/quickbooks/service";
import { getFacebookConnection, getFacebookLeadForms, getRecentFacebookLog } from "@/lib/facebook/service";
// Playbooks moved to Library (/library/playbooks)
// Pipeline Templates moved to Library (/library/pipeline-templates)

export const metadata: Metadata = { title: "Settings" };

/**
 * Venue Settings — every field entered during setup is editable here.
 * Loads current venue data server-side and passes it to the VenueSettings
 * client component, which reuses the wizard step components directly.
 * Route is protected by the (app) layout (venue existence already confirmed).
 */
export default async function SettingsPage() {
  const [settings, venue, spaces, capacityRules, luvSettings, notifStats, notifPrefs, tourSettings, intakeHealth, eventCompletedNudgeRule, quickbooksConnection, quickbooksSyncLog, tourAvailabilityWindows, tourAvailabilityExceptions, emailIntakeStatus, facebookConnection, facebookLeadForms, facebookLog, legalHistory] = await Promise.all([
    getVenueSettings(), getCurrentVenue(), getSpaces(), getCapacityRules(), getLuvSettings(), getNotificationStats(), getNotificationPreferences(), getTourSettings(), getIntakeHealthSummary(), getEventCompletedNudgeRule(), getQuickBooksConnection(), getRecentQuickBooksSyncLog(), getTourAvailabilityWindows(), getTourAvailabilityExceptions(), getEmailIntakeStatus(), getFacebookConnection(), getFacebookLeadForms(), getRecentFacebookLog(), listLegalAcceptancesForCurrentUser(),
  ]);

  if (!settings) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          description="Venue configuration and preferences."
        />
        <p className="text-sm text-muted-foreground">
          Your venue settings could not be loaded. Please refresh the page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Edit your venue information, hours, brand, and preferences."
      />
      <VenueSettings initial={settings.input} venueId={settings.venueId} />
      {venue && <StripeConnectSection venue={venue} />}
      {venue && <QuickBooksConnectSection venueId={venue.id} connection={quickbooksConnection} syncLog={quickbooksSyncLog} />}
      {venue && <FacebookConnectSection venueId={venue.id} connection={facebookConnection} leadForms={facebookLeadForms} recentLog={facebookLog} />}

      {/* ── Import Data ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import Existing Data</CardTitle>
          <CardDescription>
            Bring your clients, leads, vendors, inventory, and packages into Hello to Cheers from any CSV export. No template required — map your own column names.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href="/settings/import?type=couples" className="text-sm font-medium text-primary hover:underline">Import Clients →</Link>
            <Link href="/settings/import?type=leads" className="text-sm font-medium text-primary hover:underline">Import Leads →</Link>
            <Link href="/settings/import?type=vendors" className="text-sm font-medium text-primary hover:underline">Import Vendors →</Link>
            <Link href="/settings/import?type=inventory" className="text-sm font-medium text-primary hover:underline">Import Inventory →</Link>
            <Link href="/settings/import?type=packages" className="text-sm font-medium text-primary hover:underline">Import Packages →</Link>
          </div>
        </CardContent>
      </Card>

      {/* ── Export Data ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Data</CardTitle>
          <CardDescription>
            Your data belongs to you. Download a complete copy of your clients, events, contracts,
            invoices, and payment records at any time — no need to ask, no waiting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataExportSection />
        </CardContent>
      </Card>

      {/* ── Team ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team</CardTitle>
          <CardDescription>
            Invite coordinators and staff to access the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/settings/team" className="text-sm font-medium text-primary hover:underline">Manage Team →</Link>
        </CardContent>
      </Card>

      {/* ── Legal History (signed-in staff user) ───────────────────── */}
      <LegalHistorySection items={legalHistory} />

      {/* ── Availability & Spaces ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event Spaces</CardTitle>
          <CardDescription>
            Define the named spaces within your venue (Ballroom, Garden, Barn…).
            Each space can have its own capacity and be assigned to events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VenueSpacesSection initialSpaces={spaces} />
        </CardContent>
      </Card>

      {/* ── Website Forms ──────────────────────────────────────────── */}
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
            />
          </CardContent>
        </Card>
      )}

      {/* ── Lead Intake Health ─────────────────────────────────────── */}
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

      {/* ── Tour Scheduling ────────────────────────────────────────── */}
      {tourSettings && (
        <Card id="tours" className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="text-base">Tour Scheduling</CardTitle>
            <CardDescription>
              Let clients schedule a tour directly from your website. Every booking creates a lead in Hello to Cheers automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TourSettingsSection
              initialSettings={tourSettings}
              initialWindows={tourAvailabilityWindows}
              initialExceptions={tourAvailabilityExceptions}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Review & Referral Nudge — RC2, Milestone 4 ─────────────── */}
      <Card id="review-referral" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Post-Event Follow-Up</CardTitle>
          <CardDescription>
            The moment coordination ends and relationship management begins.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReviewReferralNudgeSection initialRule={eventCompletedNudgeRule} />
        </CardContent>
      </Card>

      {/* ── Notification Preferences ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notification Preferences</CardTitle>
          <CardDescription>
            Choose which activity triggers an in-app notification. Changes take effect immediately — nothing is ever sent for disabled types.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationPreferencesSection initialPrefs={notifPrefs} />
        </CardContent>
      </Card>

      {/* ── Notifications ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>
            Automatic reminders for tasks and tours, sent by email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationsSection initialStats={notifStats} emailConfigured={isEmailConfigured()} />
        </CardContent>
      </Card>

      {/* ── Luv ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-1.5">
            <LuvHeart size={14} /> Luv — Venue Assistant
          </CardTitle>
          <CardDescription>
            Control how Luv helps you and how much autonomy she has.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LuvSettingsSection initialSettings={luvSettings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scheduling Capacity</CardTitle>
          <CardDescription>
            Configure your venue{"'"}s operating limits. The system will warn when
            these thresholds are approached.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CapacityRulesSection initialRules={capacityRules} />
        </CardContent>
      </Card>
    </div>
  );
}
