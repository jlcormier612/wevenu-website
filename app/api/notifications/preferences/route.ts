import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_notification_preferences");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = data as {
    prefNewLead?: boolean;
    prefRsvpReceived?: boolean;
    prefTaskCompleted?: boolean;
    prefVendorCheckedIn?: boolean;
    prefFeedbackReceived?: boolean;
    prefReferralReceived?: boolean;
    prefMessageReceived?: boolean;
    channelEmail?: boolean;
    channelSms?: boolean;
    channelPush?: boolean;
    error?: string;
  } | null;

  if (result?.error) return NextResponse.json({ error: result.error }, { status: 401 });
  return NextResponse.json(result ?? {});
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    prefNewLead?:          boolean;
    prefRsvpReceived?:     boolean;
    prefTaskCompleted?:    boolean;
    prefVendorCheckedIn?:  boolean;
    prefFeedbackReceived?: boolean;
    prefReferralReceived?: boolean;
    prefMessageReceived?:  boolean;
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_notification_preferences", {
    p_pref_new_lead:          body.prefNewLead          ?? null,
    p_pref_rsvp_received:     body.prefRsvpReceived     ?? null,
    p_pref_task_completed:    body.prefTaskCompleted     ?? null,
    p_pref_vendor_checked_in: body.prefVendorCheckedIn  ?? null,
    p_pref_feedback_received: body.prefFeedbackReceived ?? null,
    p_pref_referral_received: body.prefReferralReceived ?? null,
    p_pref_message_received:  body.prefMessageReceived  ?? null,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const result = data as { ok: boolean } | null;
  return NextResponse.json({ ok: result?.ok ?? false });
}
