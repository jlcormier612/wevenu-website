import type { Metadata } from "next";
import Link from "next/link";

import { CapacityRulesSection } from "@/components/availability/capacity-rules-section";
import { VenueSpacesSection } from "@/components/availability/venue-spaces-section";
import { PageHeader } from "@/components/shell/module-placeholder";
import { LuvSettingsSection } from "@/components/settings/luv-settings-section";
import { NotificationPreferencesSection } from "@/components/settings/notification-preferences-section";
import { NotificationsSection } from "@/components/settings/notifications-section";
import { TourSettingsSection } from "@/components/settings/tour-settings-section";
import { WebsiteFormsSection } from "@/components/settings/website-forms-section";
import { DataExportSection } from "@/components/settings/data-export-section";
import { LuvHeart } from "@/components/dashboard/luv-widget";
import { StripeConnectSection } from "@/components/settings/stripe-connect-section";
import { VenueSettings } from "@/components/settings/venue-settings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCapacityRules, getSpaces } from "@/lib/availability/service";
import { getLuvSettings } from "@/lib/luv/settings";
import { getCurrentVenue, getVenueSettings } from "@/lib/venue/service";
import { getNotificationStats } from "@/lib/notifications/stats";
import { getNotificationPreferences } from "@/lib/notifications/preferences";
import { getTourSettings } from "@/lib/tours/service";
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
  const [settings, venue, spaces, capacityRules, luvSettings, notifStats, notifPrefs, tourSettings] = await Promise.all([
    getVenueSettings(), getCurrentVenue(), getSpaces(), getCapacityRules(), getLuvSettings(), getNotificationStats(), getNotificationPreferences(), getTourSettings(),
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

      {/* ── Import Data ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import Existing Data</CardTitle>
          <CardDescription>
            Bring your clients, leads, and vendors into Wevenu from any CSV export. No template required — map your own column names.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href="/settings/import?type=couples" className="text-sm font-medium text-primary hover:underline">Import Clients →</Link>
            <Link href="/settings/import?type=leads" className="text-sm font-medium text-primary hover:underline">Import Leads →</Link>
            <Link href="/settings/import?type=vendors" className="text-sm font-medium text-primary hover:underline">Import Vendors →</Link>
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
            <CardTitle className="text-base">Website Forms</CardTitle>
            <CardDescription>
              Share your inquiry form or embed it on your website. Every submission becomes a lead in Wevenu automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WebsiteFormsSection
              embedKey={venue.embedKey}
              appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Tour Scheduling ────────────────────────────────────────── */}
      {tourSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tour Scheduling</CardTitle>
            <CardDescription>
              Let clients schedule a tour directly from your website. Every booking creates a lead in Wevenu automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TourSettingsSection initialSettings={tourSettings} />
          </CardContent>
        </Card>
      )}

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
          <CardTitle className="text-base">Notification Engine</CardTitle>
          <CardDescription>
            Reminder delivery engine. Pending reminders are processed on a schedule.
            Channel-agnostic: email active now, SMS and in-app coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationsSection initialStats={notifStats} />
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
