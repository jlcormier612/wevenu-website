import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { LuvHeart } from "@/components/dashboard/luv-widget";
import { LuvSettingsSection } from "@/components/settings/luv-settings-section";
import { NotificationPreferencesSection } from "@/components/settings/notification-preferences-section";
import { NotificationsSection } from "@/components/settings/notifications-section";
import { ReminderCadenceSection } from "@/components/settings/reminder-cadence-section";
import { ReviewReferralNudgeSection } from "@/components/settings/review-referral-nudge-section";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isEmailConfigured } from "@/lib/email/send";
import { getEventCompletedNudgeRule } from "@/lib/automation/service";
import { getLuvSettings } from "@/lib/luv/settings";
import { getReminderCadence } from "@/lib/notifications/obligations";
import { getNotificationPreferences } from "@/lib/notifications/preferences";
import { getNotificationStats } from "@/lib/notifications/stats";

export const metadata: Metadata = { title: "Communications & Automation — Settings" };

/**
 * Settings > Communications & Automation. The email-delivery/reminder
 * status ("Automatic reminders") and the per-event-type email preferences
 * ("Email notifications") stay as the two distinct, independently-scoped
 * components they already were (see the notification-preferences-email-
 * correction pass) — bundled onto one page as requested, not merged into
 * one component.
 */
export default async function CommunicationsAutomationSettingsPage() {
  const [notifStats, notifPrefs, eventCompletedNudgeRule, luvSettings, reminderCadence] = await Promise.all([
    getNotificationStats(), getNotificationPreferences(), getEventCompletedNudgeRule(), getLuvSettings(), getReminderCadence(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communications & Automation"
        description="Notifications, follow-ups, and Luv."
      />
      <SettingsTabs />

      <Card id="notifications" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Email notifications</CardTitle>
          <CardDescription>
            Choose which important updates you&apos;d like us to send to your inbox. These are optional extras — your important activity and alerts will still appear in Hello to Cheers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationPreferencesSection initialPrefs={notifPrefs} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Automatic reminders</CardTitle>
          <CardDescription>
            Automatic reminders for tasks and tours, sent by email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationsSection initialStats={notifStats} emailConfigured={isEmailConfigured()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client Reminder Cadence</CardTitle>
          <CardDescription>
            Set the expectation once — Hello to Cheers keeps reminding clients on this schedule until they take care of it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReminderCadenceSection initialCadence={reminderCadence} />
        </CardContent>
      </Card>

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
    </div>
  );
}
