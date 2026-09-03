import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RsvpPage } from "@/components/wedding-website/rsvp-page";
import { createClient } from "@/integrations/supabase/server";
import {
  resolveExperienceProfile,
  rsvpDocumentDescription,
  rsvpDocumentTitle,
} from "@/lib/event-experience";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_rsvp_context", { p_rsvp_token: token });
  // Venue Brand Experience Phase 1: `absolute` stops the root layout's
  // "%s · Hello to Cheers" template from appending to this customer-facing tab title.
  if (!data || (data as Record<string, unknown>).error) return { title: { absolute: "RSVP" } };
  const d = data as Record<string, unknown>;
  const couple = d.couple as { firstName: string; partnerFirstName?: string } | undefined;
  const coupleName = [couple?.firstName, couple?.partnerFirstName].filter(Boolean).join(" & ");
  const event = d.event as { eventType?: string | null } | null | undefined;
  const experienceProfile = resolveExperienceProfile(event?.eventType);
  return {
    title: { absolute: rsvpDocumentTitle(coupleName, experienceProfile) },
    description: rsvpDocumentDescription(coupleName, experienceProfile),
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
    mealChoice: string | null;
    plusOneMeal: string | null;
    householdId: string | null;
  };
  couple: { firstName: string; partnerFirstName: string | null };
  event: { name: string; eventDate: string; eventType: string | null } | null;
  venue: { name: string; logoUrl: string | null };
  websiteSlug: string | null;
  accentColor: string;
  /** The one authoritative meal catalog (Guest Experience — Phase 3) — replaces the old rsvp_questions "meal_choice" convention. */
  mealOptions: string[];
  questions: import("@/lib/portal/types").RsvpQuestion[];
  guestAnswers: { questionId: string; answer: string }[];
  householdMembers: {
    id: string;
    firstName: string;
    lastName: string | null;
    rsvpStatus: string;
    mealChoice: string | null;
  }[];
};
