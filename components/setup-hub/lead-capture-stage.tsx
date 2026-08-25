"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { CheckCircle2, Globe, Mail, QrCode, Send, Users } from "lucide-react";
import { toast } from "sonner";

import { markChannelConfiguredAction, markChannelVerifiedAction, setLeadCapturePathAction } from "@/app/(app)/setup-hub/actions";
import { FacebookConnectSection } from "@/components/settings/facebook-connect-section";
import { LeadIntakeHealthSection } from "@/components/settings/lead-intake-health-section";
import { TourSettingsSection } from "@/components/settings/tour-settings-section";
import { WebsiteFormsSection } from "@/components/settings/website-forms-section";
import { QrCampaignList } from "@/components/qr-campaigns/qr-campaign-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { FacebookConnection, FacebookLeadForm, FacebookLeadLogEntry } from "@/lib/facebook/types";
import type { IntakeHealthSummary } from "@/lib/lead-intake/monitoring";
import type { EmailIntakeStatus } from "@/lib/lead-intake/email-status";
import type { QrCampaign, QrCampaignAnalytics } from "@/lib/qr-campaigns/types";
import type { LeadCaptureChannelKey, LeadCaptureStageStatus } from "@/lib/setup-hub/types";
import type { TourAvailabilityException, TourAvailabilityWindow, TourSettings } from "@/lib/tours/types";

function ChannelBadge({ configuredAt, verifiedAt, hasVerification }: { configuredAt: string | null; verifiedAt: string | null; hasVerification: boolean }) {
  if (!configuredAt) return <Badge variant="muted">Not yet configured</Badge>;
  if (hasVerification && !verifiedAt) return <Badge variant="outline">Configured — not yet verified</Badge>;
  return <Badge variant="outline"><CheckCircle2 className="mr-1 h-3 w-3" />Configured{hasVerification ? " & verified" : ""}</Badge>;
}

function ChannelActions({
  channel, configuredAt, verifiedAt, hasVerification, testHref, onChanged,
}: {
  channel: LeadCaptureChannelKey;
  configuredAt: string | null;
  verifiedAt: string | null;
  hasVerification: boolean;
  testHref?: string;
  onChanged: () => void;
}) {
  const [pending, startTransition] = React.useTransition();

  function markConfigured() {
    startTransition(async () => {
      const result = await markChannelConfiguredAction(channel);
      if (result.ok) { toast.success("Marked as configured."); onChanged(); }
      else toast.error("Could not save.");
    });
  }

  function markVerified() {
    startTransition(async () => {
      const result = await markChannelVerifiedAction(channel);
      if (result.ok) { toast.success("Marked as verified."); onChanged(); }
      else toast.error("Could not save.");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!configuredAt && (
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={markConfigured}>
          This is how I&apos;ll receive inquiries
        </Button>
      )}
      {configuredAt && hasVerification && !verifiedAt && (
        <>
          {testHref && (
            <Button type="button" size="sm" variant="outline" render={<a href={testHref} target="_blank" rel="noopener noreferrer" />}>
              <Send className="mr-1.5 h-3.5 w-3.5" />Send a test inquiry
            </Button>
          )}
          <Button type="button" size="sm" disabled={pending} onClick={markVerified}>
            I tested it — mark verified
          </Button>
        </>
      )}
    </div>
  );
}

export function LeadCaptureStage({
  venueId, embedKey, appUrl, leadEmailAddress, emailIntakeStatus,
  tourSettings, tourWindows, tourExceptions, tourAvailabilityLoadError,
  facebookConnection, facebookLeadForms, facebookLog, facebookConnectUrl,
  qrCampaigns, qrAnalytics, intakeHealth, stageStatus,
}: {
  venueId: string;
  embedKey: string;
  appUrl: string;
  leadEmailAddress: string | null;
  emailIntakeStatus: EmailIntakeStatus | null;
  tourSettings: TourSettings | null;
  tourWindows: TourAvailabilityWindow[];
  tourExceptions: TourAvailabilityException[];
  tourAvailabilityLoadError?: string | null;
  facebookConnection: FacebookConnection | null;
  facebookLeadForms: FacebookLeadForm[];
  facebookLog: FacebookLeadLogEntry[];
  facebookConnectUrl?: string | null;
  qrCampaigns: QrCampaign[];
  qrAnalytics: QrCampaignAnalytics[];
  intakeHealth: IntakeHealthSummary;
  stageStatus: LeadCaptureStageStatus | null;
}) {
  const router = useRouter();
  const [path, setPath] = React.useState(stageStatus?.path ?? null);
  const [pathPending, startPathTransition] = React.useTransition();
  const [showOtherSources, setShowOtherSources] = React.useState(false);

  const channelState = React.useCallback(
    (channel: LeadCaptureChannelKey) => stageStatus?.channels.find((c) => c.channel === channel) ?? { configuredAt: null, verifiedAt: null },
    [stageStatus],
  );

  function onChanged() {
    router.refresh();
  }

  function choosePath(next: "automated" | "manual_external") {
    startPathTransition(async () => {
      const result = await setLeadCapturePathAction(next);
      if (result.ok) { setPath(next); onChanged(); }
      else toast.error("Could not save.");
    });
  }

  const website = channelState("website_form");
  const email = channelState("email_intake");
  const tour = channelState("tour_booking");

  return (
    <div className="space-y-6">
      {/* Start Here */}
      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-heading">How do you want new inquiries to reach Hello to Cheers?</p>
          <p className="text-sm text-muted-foreground">
            You don&apos;t need every channel below — just a workable way for new couples to reach you. The website inquiry form is the easiest place to start for most venues; it automatically brings every submission straight into Hello to Cheers.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant={path === "automated" ? "default" : "outline"} disabled={pathPending} onClick={() => choosePath("automated")} className="flex-1 justify-start h-auto py-3 text-left">
            <div>
              <p className="font-medium">Set up automated intake</p>
              <p className="text-xs font-normal text-muted-foreground mt-0.5">Website form, email, tours, and more — configure the channels you intend to use.</p>
            </div>
          </Button>
          <Button type="button" variant={path === "manual_external" ? "default" : "outline"} disabled={pathPending} onClick={() => choosePath("manual_external")} className="flex-1 justify-start h-auto py-3 text-left">
            <div>
              <p className="font-medium">I&apos;ll enter leads manually for now</p>
              <p className="text-xs font-normal text-muted-foreground mt-0.5">A legitimate way to run your business — you can add automated channels whenever it&apos;s useful.</p>
            </div>
          </Button>
        </CardContent>
      </Card>

      {path === "manual_external" && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-foreground">You&apos;re set — you&apos;ll add leads yourself from the Leads page as they come in. You can switch to automated intake any time.</p>
          </CardContent>
        </Card>
      )}

      {path === "automated" && (
        <>
          {/* Website Form (bundles Email Intake) */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-heading">Website Form</p>
              </div>
              <ChannelBadge configuredAt={website.configuredAt} verifiedAt={website.verifiedAt} hasVerification />
            </CardHeader>
            <CardContent className="space-y-4">
              <WebsiteFormsSection embedKey={embedKey} appUrl={appUrl} leadEmailAddress={leadEmailAddress} emailIntakeStatus={emailIntakeStatus} />
              <ChannelActions channel="website_form" configuredAt={website.configuredAt} verifiedAt={website.verifiedAt} hasVerification
                testHref={`${appUrl}/form/${embedKey}`} onChanged={onChanged} />
              {emailIntakeStatus?.connectedAt && (
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-foreground">Email intake</p>
                  </div>
                  <ChannelActions channel="email_intake" configuredAt={email.configuredAt} verifiedAt={email.verifiedAt} hasVerification onChanged={onChanged} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tour Booking */}
          {tourSettings && (
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-heading">Tour Booking</p>
                </div>
                <ChannelBadge configuredAt={tour.configuredAt} verifiedAt={tour.verifiedAt} hasVerification />
              </CardHeader>
              <CardContent className="space-y-4">
                <TourSettingsSection initialSettings={tourSettings} />
                {tourAvailabilityLoadError ? (
                  <p className="text-xs text-destructive">Could not load tour availability. Refresh the page to try again.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">{tourWindows.length} availability window{tourWindows.length === 1 ? "" : "s"}, {tourExceptions.length} exception{tourExceptions.length === 1 ? "" : "s"} — manage full availability from Settings.</p>
                )}
                <ChannelActions channel="tour_booking" configuredAt={tour.configuredAt} verifiedAt={tour.verifiedAt} hasVerification
                  testHref={tourSettings.tourEmbedKey ? `${appUrl}/book/${tourSettings.tourEmbedKey}` : undefined} onChanged={onChanged} />
              </CardContent>
            </Card>
          )}

          {/* Other Sources — progressively disclosed */}
          {!showOtherSources ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowOtherSources(true)}>
              Other lead sources — QR campaigns, Facebook/Instagram, manual entry
            </Button>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-heading">Other Sources</p>
                </div>
                <p className="text-xs text-muted-foreground">Add other lead sources whenever they&apos;re useful for your business.</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-sm font-medium text-heading mb-2">QR Campaigns</p>
                  <QrCampaignList initialCampaigns={qrCampaigns} analytics={qrAnalytics} appUrl={appUrl} />
                </div>
                <div>
                  <p className="text-sm font-medium text-heading mb-2">Facebook / Instagram Lead Ads</p>
                  <FacebookConnectSection venueId={venueId} connection={facebookConnection} leadForms={facebookLeadForms} recentLog={facebookLog} connectUrl={facebookConnectUrl ?? null} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Verify It Works */}
          <Card>
            <CardHeader>
              <p className="text-sm font-medium text-heading">Verify It Works</p>
              <p className="text-xs text-muted-foreground">The last 7 days of inquiries across every channel above.</p>
            </CardHeader>
            <CardContent>
              <LeadIntakeHealthSection summary={intakeHealth} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
