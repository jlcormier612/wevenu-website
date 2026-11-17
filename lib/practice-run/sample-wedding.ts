import * as clientRepo from "@/lib/clients/repository";
import * as eventRepo from "@/lib/events/repository";
import * as leadRepo from "@/lib/leads/repository";
import { practiceSampleEmail } from "@/lib/practice-run/isolation";
import { seedPracticeCouplePhoto } from "@/lib/practice-run/practice-couple-photo";
import * as practiceRepo from "@/lib/practice-run/repository";
import { PRACTICE_CELEBRATION_NAME } from "@/lib/practice-run/types";
import type { PracticeRun } from "@/lib/practice-run/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

function sampleEventDate(): string {
  const when = new Date();
  when.setUTCFullYear(when.getUTCFullYear() + 1);
  when.setUTCMonth(8); // September
  when.setUTCDate(12);
  return when.toISOString().slice(0, 10);
}

/**
 * Creates the isolated sample wedding for a Practice Run.
 * - Draft Event, no booked_at, no space → no calendar occupancy
 * - exclude_from_business_reporting + practice_run_id stamped
 * - historicalImport on lead/client → suppress new-inquiry notifications
 * Does not send email/SMS, create Stripe/QBO work, or invite anyone.
 */
export async function createSampleWedding(
  client: DbClient,
  venueId: string,
  run: PracticeRun,
): Promise<PracticeRun> {
  if (run.sampleLeadId && run.sampleClientId && run.sampleEventId) {
    // Keep the practice couple photo present across resume / partial resets.
    await seedPracticeCouplePhoto(client, venueId, run.sampleRelationshipId);
    return run;
  }

  const email = practiceSampleEmail(venueId, run.id);
  const eventDate = sampleEventDate();

  const leadId = await leadRepo.insertLead(
    client,
    venueId,
    {
      firstName: "Maya",
      lastName: "Chen",
      email,
      phone: "",
      partnerFirstName: "Jordan",
      partnerLastName: "Reed",
      partnerEmail: "",
      eventType: "wedding",
      eventDate,
      endDate: "",
      guestCount: "120",
      estimatedBudget: "28000",
      source: "other",
      originalSourceLabel: "Practice Run",
      inquiryMessage:
        "Practice Run sample inquiry. This is not a real couple — use it to explore Hello to Cheers.",
      inquiryMessageOrigin: "venue",
      inquiryDate: new Date().toISOString().slice(0, 10),
      nextActionText: "",
      nextActionDue: "",
      followUpDate: "",
      dateFlexibility: "",
      sourceRecordId: `practice-run:${run.id}`,
    },
    true,
  );

  await practiceRepo.markRecordPracticeLinked(client, "leads", venueId, leadId, run.id);

  const { data: leadRow } = await client
    .from("leads")
    .select("relationship_id")
    .eq("venue_id", venueId)
    .eq("id", leadId)
    .maybeSingle();
  const relationshipId = (leadRow as { relationship_id: string | null } | null)?.relationship_id ?? null;

  const clientId = await clientRepo.insertClient(
    client,
    venueId,
    {
      firstName: "Maya",
      lastName: "Chen",
      email,
      phone: "",
      partnerFirstName: "Jordan",
      partnerLastName: "Reed",
      partnerEmail: "",
      eventType: "wedding",
      eventDate,
      endDate: "",
      guestCount: "120",
      ceremonyTime: "",
      receptionTime: "",
      setupTime: "",
      teardownTime: "",
      rehearsalDate: "",
      internalNotes:
        "Practice Run sample client. Not a real booking. Explore freely — nothing here is sent or billed.",
      spaceId: "",
    },
    leadId,
    true,
  );
  await practiceRepo.markRecordPracticeLinked(client, "clients", venueId, clientId, run.id);

  const eventId = await eventRepo.insertEvent(
    client,
    venueId,
    {
      clientId,
      spaceId: "",
      name: PRACTICE_CELEBRATION_NAME,
      eventType: "wedding",
      eventDate,
      eventEndDate: "",
      startTime: "",
      endTime: "",
      setupTime: "",
      teardownTime: "",
      guestCount: "120",
      guaranteedGuestCount: "",
      externalCeremonyLocation: "",
      externalReceptionLocation: "",
    },
    { status: "draft" },
  );
  await practiceRepo.markRecordPracticeLinked(client, "events", venueId, eventId, run.id);

  let resolvedRelationshipId = relationshipId;
  if (!resolvedRelationshipId) {
    const { data: clientRow } = await client
      .from("clients")
      .select("relationship_id")
      .eq("venue_id", venueId)
      .eq("id", clientId)
      .maybeSingle();
    resolvedRelationshipId =
      (clientRow as { relationship_id?: string | null } | null)?.relationship_id ?? null;
  }
  await seedPracticeCouplePhoto(client, venueId, resolvedRelationshipId);

  return practiceRepo.attachPracticeSample(client, venueId, run.id, {
    leadId,
    clientId,
    eventId,
    relationshipId: resolvedRelationshipId,
  });
}
