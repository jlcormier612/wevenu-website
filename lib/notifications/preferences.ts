import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type NotificationPreferences = {
  prefNewLead:                   boolean;
  prefRsvpReceived:              boolean;
  prefTaskCompleted:             boolean;
  prefVendorCheckedIn:           boolean;
  prefFeedbackReceived:          boolean;
  prefReferralReceived:          boolean;
  prefMessageReceived:           boolean;
  prefClientSubmittedInfo:       boolean;
  prefPaymentFailed:             boolean;
  prefPaymentOverdue:            boolean;
  prefPaymentReceived:           boolean;
  prefContractRequiresAttention: boolean;
  prefContractSigned:            boolean;
  prefFinalGuestCountSubmitted:  boolean;
  channelEmail:                  boolean;
  channelSms:                    boolean;
  channelPush:                   boolean;
  dailyDigestEnabled:            boolean;
  digestIntroDismissed:          boolean;
};

const DEFAULTS: NotificationPreferences = {
  prefNewLead:                   true,
  prefRsvpReceived:              true,
  prefTaskCompleted:             true,
  prefVendorCheckedIn:           true,
  prefFeedbackReceived:          true,
  prefReferralReceived:          true,
  prefMessageReceived:           true,
  prefClientSubmittedInfo:       false,
  prefPaymentFailed:             true,
  prefPaymentOverdue:            true,
  prefPaymentReceived:           false,
  prefContractRequiresAttention: true,
  prefContractSigned:            false,
  prefFinalGuestCountSubmitted:  false,
  channelEmail:                  false,
  channelSms:                    false,
  channelPush:                   false,
  dailyDigestEnabled:            true,
  digestIntroDismissed:          false,
};

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  if (!isSupabaseConfigured) return DEFAULTS;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_notification_preferences");
  const result = data as Partial<NotificationPreferences> & { error?: string } | null;
  if (!result || result.error) return DEFAULTS;
  return { ...DEFAULTS, ...result };
}
