/**
 * Idempotent starter-content seeding for a newly provisioned venue.
 *
 * Extracted from submitVenueSetup so Self-Setup and White Glove share one
 * provisioning path. Individual seed helpers are already idempotent
 * (source_master_key / name guards). Failures are logged and collected —
 * a partial seed must not roll back venue creation; retries re-run safely.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";

type DbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

export type StarterSeedResult = {
  ok: boolean;
  seeded: string[];
  failed: Array<{ key: string; message: string }>;
};

type SeedStep = {
  key: string;
  run: (venueId: string, client: DbClient) => Promise<void>;
};

const STEPS: SeedStep[] = [
  {
    key: "inventory",
    run: async (venueId) => {
      const { seedStarterInventory } = await import("@/lib/inventory/service");
      await seedStarterInventory(venueId);
    },
  },
  {
    key: "message_templates",
    run: async (venueId) => {
      const { seedStarterMessageTemplates } = await import("@/lib/message-templates/provision");
      await seedStarterMessageTemplates(venueId);
    },
  },
  {
    key: "automations",
    run: async (venueId) => {
      const { seedStarterAutomations } = await import("@/lib/message-sequences/provision");
      await seedStarterAutomations(venueId);
    },
  },
  {
    key: "contracts",
    run: async (venueId) => {
      const { seedContractStarters } = await import("@/lib/contracts/provision");
      await seedContractStarters(venueId);
    },
  },
  {
    key: "questionnaires",
    run: async (venueId) => {
      const { seedQuestionnaireFamily } = await import("@/lib/questionnaire-family/provision");
      await seedQuestionnaireFamily(venueId);
    },
  },
  {
    key: "event_orders",
    run: async (venueId) => {
      const { seedEventOrderStarters } = await import("@/lib/event-order-templates/provision");
      await seedEventOrderStarters(venueId);
    },
  },
  {
    key: "timelines",
    run: async (venueId) => {
      const { seedTimelineStarters } = await import("@/lib/timeline-templates/provision");
      await seedTimelineStarters(venueId);
    },
  },
  {
    key: "floor_plans",
    run: async (venueId) => {
      const { seedFloorPlanStarters } = await import("@/lib/floor-plan-templates/provision");
      await seedFloorPlanStarters(venueId);
    },
  },
  {
    key: "packages",
    run: async (venueId) => {
      const { seedPackageStarters } = await import("@/lib/packages/provision");
      await seedPackageStarters(venueId);
    },
  },
  {
    key: "faq",
    run: async (venueId) => {
      const { seedFaqStarters } = await import("@/lib/venue-guide/provision");
      await seedFaqStarters(venueId);
    },
  },
  {
    key: "brochures",
    run: async (venueId) => {
      const { seedBrochureStarters } = await import("@/lib/brochures/provision");
      await seedBrochureStarters(venueId);
    },
  },
  {
    key: "saved_reports",
    run: async (venueId) => {
      const { seedSavedReportStarters } = await import("@/lib/saved-reports/provision");
      await seedSavedReportStarters(venueId);
    },
  },
  {
    key: "schedule_item_types",
    run: async (venueId, client) => {
      const { seedVenueScheduleItemTypes } = await import(
        "@/lib/calendar/schedule-item-catalog-repository"
      );
      await seedVenueScheduleItemTypes(client as Awaited<ReturnType<typeof createClient>>, venueId);
    },
  },
];

/**
 * Seed all platform starters for a venue. Safe to call repeatedly.
 * Uses the admin client by default so White Glove (no venue session) works.
 */
export async function seedWorkspaceStarters(
  venueId: string,
  client?: DbClient,
): Promise<StarterSeedResult> {
  const db = client ?? createAdminClient();
  const seeded: string[] = [];
  const failed: Array<{ key: string; message: string }> = [];

  for (const step of STEPS) {
    try {
      await step.run(venueId, db);
      seeded.push(step.key);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[provisioning] starter seed failed: ${step.key}`, error);
      failed.push({ key: step.key, message });
    }
  }

  return { ok: failed.length === 0, seeded, failed };
}
