import { getTemplates as getContractTemplates } from "@/lib/contracts/service";
import { listVenueSetupProfiles } from "@/lib/event-setup/profiles";
import { getTemplates as getEventOrderTemplates } from "@/lib/event-order-templates/service";
import { getTemplates as getFloorPlanTemplates } from "@/lib/floor-plan-templates/service";
import { getItemsForLibrary } from "@/lib/inventory/service";
import { getSequences } from "@/lib/message-sequences/service";
import { getTemplates as getMessageTemplates } from "@/lib/message-templates/service";
import { getPackages } from "@/lib/packages/service";
import { getTemplates as getPlaybookTemplates } from "@/lib/playbooks/service";
import { getTemplates as getQuestionnaireTemplates } from "@/lib/questionnaire-templates/service";
import {
  makeHtcYoursSectionStatuses,
  type PackageReadinessSnapshot,
  type SetupProfileAssignmentSnapshot,
  type SetupProfileSnapshot,
} from "@/lib/setup-hub/phase-b1-readiness";
import { getSetupHubState } from "@/lib/setup-hub/service";
import { getTemplates as getTimelineTemplates } from "@/lib/timeline-templates/service";
import type { SetupHubState } from "@/lib/setup-hub/types";
import { getCurrentVenue } from "@/lib/venue/service";

export type Milestone02Context = {
  venue: NonNullable<Awaited<ReturnType<typeof getCurrentVenue>>>;
  hubState: SetupHubState | null;
  profiles: SetupProfileSnapshot[];
  assignments: SetupProfileAssignmentSnapshot[];
  packages: PackageReadinessSnapshot[];
  contractStarterCount: number;
  messageTemplateCount: number;
  pausedAutomationCount: number;
  activeAutomationCount: number;
  operationalStarterAvailable: boolean;
  venueBrandStarted: boolean;
  sections: ReturnType<typeof makeHtcYoursSectionStatuses>;
};

export async function loadMilestone02Context(): Promise<Milestone02Context | null> {
  const venue = await getCurrentVenue();
  if (!venue) return null;

  async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  }

  const [
    hubState,
    listed,
    packages,
    contracts,
    messageTemplates,
    sequences,
    playbooks,
    timelines,
    questionnaires,
    eventOrders,
    inventory,
    floorPlans,
  ] = await Promise.all([
    getSetupHubState(),
    listVenueSetupProfiles(venue.id),
    getPackages(false),
    getContractTemplates(true),
    getMessageTemplates(true),
    getSequences(),
    safe(() => getPlaybookTemplates(), []),
    safe(() => getTimelineTemplates(), []),
    safe(() => getQuestionnaireTemplates(), []),
    safe(() => getEventOrderTemplates(true), []),
    safe(() => getItemsForLibrary(), []),
    safe(() => getFloorPlanTemplates(), []),
  ]);

  const profiles: SetupProfileSnapshot[] = listed.profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    updatedAt: profile.updatedAt ?? "",
    decisions: profile.decisions,
    templateRefs: profile.templateRefs,
  }));

  const packageSnapshots: PackageReadinessSnapshot[] = packages.map((pkg) => ({
    isActive: pkg.isActive,
    basePrice: pkg.basePrice,
    sourceMasterKey: pkg.sourceMasterKey,
  }));

  const pausedAutomationCount = sequences.filter((seq) => seq.status === "paused").length;
  const activeAutomationCount = sequences.filter((seq) => seq.status === "active").length;
  const operationalStarterAvailable =
    playbooks.some((row) => Boolean(row.sourceMasterKey)) ||
    timelines.some((row) => Boolean(row.sourceMasterKey)) ||
    questionnaires.some((row) => Boolean(row.sourceMasterKey)) ||
    eventOrders.some((row) => Boolean(row.sourceMasterKey)) ||
    floorPlans.some((row) => Boolean(row.sourceMasterKey)) ||
    inventory.length > 0;

  const venueBrandStarted = Boolean(
    venue.phone || venue.logoUrl || venue.heroImageUrl || hubState?.yourVenueReviewedAt,
  );

  const sections = makeHtcYoursSectionStatuses({
    venueBrandStarted,
    yourVenueReviewedAt: hubState?.yourVenueReviewedAt ?? null,
    bookingProcessReviewedAt: hubState?.bookingProcessReviewedAt ?? null,
    packages: packageSnapshots,
    contractStarterCount: contracts.filter((row) => Boolean(row.sourceMasterKey)).length,
    hostedEventTypes: hubState?.hostedEventTypes ?? null,
    assignments: listed.assignments,
    profiles,
    reviews: hubState?.eventExperienceReviews ?? {},
    communicationsReviewedAt: hubState?.communicationsReviewedAt ?? null,
    templateCount: messageTemplates.length,
    pausedAutomationCount,
    operationalResourcesReviewedAt: hubState?.operationalResourcesReviewedAt ?? null,
    operationalStarterAvailable,
  });

  return {
    venue,
    hubState,
    profiles,
    assignments: listed.assignments,
    packages: packageSnapshots,
    contractStarterCount: contracts.filter((row) => Boolean(row.sourceMasterKey)).length,
    messageTemplateCount: messageTemplates.length,
    pausedAutomationCount,
    activeAutomationCount,
    operationalStarterAvailable,
    venueBrandStarted,
    sections,
  };
}
