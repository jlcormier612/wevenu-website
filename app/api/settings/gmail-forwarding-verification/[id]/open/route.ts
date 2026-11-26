/**
 * Authenticated staff redirect to a stored Google forwarding confirmation URL.
 * Never auto-follows from the server; never returns the URL in JSON.
 */
import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { validateGmailConfirmationUrl } from "@/lib/lead-intake/gmail-forwarding-verification";
import { markGmailVerificationOpened } from "@/lib/lead-intake/gmail-forwarding-verification-store";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const venue = await getCurrentVenue();
  const role = await getCurrentUserRole();
  if (!venue || (role !== "owner" && role !== "manager")) {
    return NextResponse.redirect(new URL("/settings/leads#email-intake", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  }

  const admin = createAdminClient();
  const opened = await markGmailVerificationOpened(admin, venue.id, id);
  if (!opened.ok) {
    return NextResponse.redirect(
      new URL("/settings/leads#email-intake", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    );
  }

  const validated = validateGmailConfirmationUrl(opened.url);
  if (!validated.ok) {
    return NextResponse.redirect(
      new URL("/settings/leads#email-intake", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    );
  }

  return NextResponse.redirect(validated.url, 302);
}
