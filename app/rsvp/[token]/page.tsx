import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RsvpPage } from "@/components/wedding-website/rsvp-page";
import { createClient } from "@/integrations/supabase/server";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_rsvp_context", { p_rsvp_token: token });
  if (!data || (data as Record<string, unknown>).error) return { title: "RSVP" };
  const d = data as Record<string, unknown>;
  const couple = d.couple as { firstName: string; partnerFirstName?: string } | undefined;
  const coupleName = [couple?.firstName, couple?.partnerFirstName].filter(Boolean).join(" & ");
  return {
    title: `RSVP — ${coupleName}'s Wedding`,
    description: `Submit your RSVP for ${coupleName}'s wedding.`,
  };
}

export default async function RsvpPageRoute({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_rsvp_context", { p_rsvp_token: token });

  if (!data || (data as Record<string, unknown>).error) notFound();

  return <RsvpPage context={data as RsvpContext} rsvpToken={token} />;
}

export type RsvpContext = {
  guest: {
    id: string;
    firstName: string;
    lastName: string | null;
    rsvpStatus: string;
    rsvpNote: string | null;
    dietary: string | null;
    plusOne: boolean;
    plusOneName: string | null;
  };
  couple: { firstName: string; partnerFirstName: string | null };
  event: { name: string; eventDate: string; eventType: string | null } | null;
  venue: { name: string };
  websiteSlug: string | null;
  accentColor: string;
};
