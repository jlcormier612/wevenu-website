import type { Metadata } from "next";

import { CapacityRulesSection } from "@/components/availability/capacity-rules-section";
import { VenueSpacesSection } from "@/components/availability/venue-spaces-section";
import { PageHeader } from "@/components/shell/module-placeholder";
import { LuvSettingsSection } from "@/components/settings/luv-settings-section";
import { NotificationsSection } from "@/components/settings/notifications-section";
import { PlaybooksSection } from "@/components/settings/playbooks-section";
import { TourSettingsSection } from "@/components/settings/tour-settings-section";
import { WebsiteFormsSection } from "@/components/settings/website-forms-section";
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
import { getTemplates } from "@/lib/playbooks/service";
import { getCurrentVenue, getVenueSettings } from "@/lib/venue/service";
import { getNotificationStats } from "@/lib/notifications/stats";
import { getTourSettings } from "@/lib/tours/service";

export const metadata: Metadata = { title: "Settings" };

/**
 * Venue Settings — every field entered during setup is editable here.
 * Loads current venue data server-side and passes it to the VenueSettings
 * client component, which reuses the wizard step components directly.
 * Route is protected by the (app) layout (venue existence already confirmed).
 */
export default async function SettingsPage() {
  const [settings, venue, spaces, capacityRules, luvSettings, playbookTemplates, notifStats, tourSettings] = await Promise.all([
    getVenueSettings(), getCurrentVenue(), getSpaces(), getCapacityRules(), getLuvSettings(), getTemplates(), getNotificationStats(), getTourSettings(),
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
              Let couples schedule a tour directly from your website. Every booking creates a lead in Wevenu automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TourSettingsSection initialSettings={tourSettings} />
          </CardContent>
        </Card>
      )}

      {/* ── Playbooks ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event Playbooks</CardTitle>
          <CardDescription>
            Templates that auto-generate event tasks with real due dates when an event is created.
            Tasks can auto-complete as milestones are hit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlaybooksSection initialTemplates={playbookTemplates} />
        </CardContent>
      </Card>

      {/* ── Notifications ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
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
