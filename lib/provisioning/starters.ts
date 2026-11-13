/**
 * Idempotent starter-content seeding for a newly provisioned venue.
 *
 * Extracted from submitVenueSetup so Self-Setup and White Glove share one
 * provisioning path. Individual seed helpers are already idempotent
 * (source_master_key / name guards). Failures are collected and persisted —
 * a partial seed must not roll back venue creation; retries re-run safely
 * without duplicating successful resources.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";

type DbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

export type StarterSeedResult = {
  ok: boolean;
  seeded: string[];
  failed: Array<{ key: string; message: string }>;
  status: StarterProvisioningStatus;
  skippedBecauseRunning?: boolean;
};

export type StarterProvisioningStatus =
  | "pending"
  | "running"
  | "complete"
  | "incomplete"
  | "failed"
  | "unknown";

export type StarterProvisioningSnapshot = {
  venueId: string;
  status: StarterProvisioningStatus;
  seededSteps: string[];
  failedSteps: Array<{ key: string; message: string }>;
  attemptCount: number;
  lastAttemptAt: string | null;
  completedAt: string | null;
  lastError: string | null;
  /** True when owner-facing repair guidance should show. */
  needsAttention: boolean;
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
    key: "playbooks",
    run: async (venueId) => {
      const { seedPlaybookStarters } = await import("@/lib/playbooks/provision");
      await seedPlaybookStarters(venueId);
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
  {
    key: "standard_pipeline",
    run: async (venueId, client) => {
      const { error } = await client.rpc("ensure_standard_sales_pipeline", {
        p_venue_id: venueId,
      });
      if (error) throw error;
    },
  },
  {
    // After Library starters so refs resolve. Idempotent; wedding-only assignment.
    key: "setup_profiles",
    run: async (venueId) => {
      const { seedStandardWeddingSetupProfile } = await import(
        "@/lib/event-setup/provision-standard-wedding-setup"
      );
      await seedStandardWeddingSetupProfile(venueId);
    },
  },
];

export const STARTER_SEED_STEP_KEYS = STEPS.map((s) => s.key);

const RUNNING_STALE_MS = 2 * 60 * 1000;

type ProvisionRow = {
  venue_id: string;
  status: string;
  seeded_steps: string[] | null;
  failed_steps: unknown;
  attempt_count: number | null;
  last_attempt_at: string | null;
  completed_at: string | null;
  last_error: string | null;
};

function parseFailedSteps(raw: unknown): Array<{ key: string; message: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { key?: unknown; message?: unknown };
      if (typeof row.key !== "string") return null;
      return { key: row.key, message: typeof row.message === "string" ? row.message : "failed" };
    })
    .filter((x): x is { key: string; message: string } => Boolean(x));
}

function snapshotFromRow(row: ProvisionRow): StarterProvisioningSnapshot {
  const status = (row.status as StarterProvisioningStatus) || "unknown";
  const needsAttention =
    status === "pending" ||
    status === "incomplete" ||
    status === "failed" ||
    status === "running";
  return {
    venueId: row.venue_id,
    status,
    seededSteps: row.seeded_steps ?? [],
    failedSteps: parseFailedSteps(row.failed_steps),
    attemptCount: row.attempt_count ?? 0,
    lastAttemptAt: row.last_attempt_at,
    completedAt: row.completed_at,
    lastError: row.last_error,
    needsAttention,
  };
}

// Table is new; cast until Database typings are regenerated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function provisioningTable(client: DbClient): any {
  return client.from("venue_starter_provisioning");
}

async function readProvisionRow(
  client: DbClient,
  venueId: string,
): Promise<ProvisionRow | null> {
  const { data, error } = await provisioningTable(client)
    .select(
      "venue_id,status,seeded_steps,failed_steps,attempt_count,last_attempt_at,completed_at,last_error",
    )
    .eq("venue_id", venueId)
    .maybeSingle();
  if (error) {
    // Table may not exist yet in older local DBs — treat as unknown.
    console.warn("[provisioning] read venue_starter_provisioning", error.message);
    return null;
  }
  return (data as ProvisionRow | null) ?? null;
}

async function upsertProvisionRow(
  client: DbClient,
  venueId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await provisioningTable(client).upsert(
    {
      venue_id: venueId,
      ...patch,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "venue_id" },
  );
  if (error) {
    console.error("[provisioning] upsert venue_starter_provisioning", error);
  }
}

/**
 * Heuristic for legacy venues with no provisioning row:
 * if any platform starter identity exists, treat as complete (never force repair);
 * otherwise mark incomplete so Restore is available.
 */
export async function inferLegacyStarterPresence(
  venueId: string,
  client?: DbClient,
): Promise<"complete" | "incomplete"> {
  const db = client ?? createAdminClient();
  const probes = await Promise.all([
    db.from("packages").select("id", { count: "exact", head: true }).eq("venue_id", venueId).not("source_master_key", "is", null),
    db.from("contract_templates").select("id", { count: "exact", head: true }).eq("venue_id", venueId).not("source_master_key", "is", null),
    db.from("message_templates").select("id", { count: "exact", head: true }).eq("venue_id", venueId).not("source_master_key", "is", null),
    db.from("event_order_templates").select("id", { count: "exact", head: true }).eq("venue_id", venueId).not("source_master_key", "is", null),
  ]);
  const any = probes.some((p) => (p.count ?? 0) > 0);
  return any ? "complete" : "incomplete";
}

export async function getStarterProvisioningSnapshot(
  venueId: string,
  client?: DbClient,
): Promise<StarterProvisioningSnapshot> {
  const db = client ?? createAdminClient();
  const row = await readProvisionRow(db, venueId);
  if (row) return snapshotFromRow(row);

  const inferred = await inferLegacyStarterPresence(venueId, db);
  return {
    venueId,
    status: inferred,
    seededSteps: [],
    failedSteps: [],
    attemptCount: 0,
    lastAttemptAt: null,
    completedAt: inferred === "complete" ? new Date().toISOString() : null,
    lastError: null,
    needsAttention: inferred !== "complete",
  };
}

/**
 * Claim the running lease. Returns false when another attempt is actively running.
 */
async function claimProvisioningRun(
  db: DbClient,
  venueId: string,
  existing: ProvisionRow | null,
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const staleBefore = new Date(Date.now() - RUNNING_STALE_MS).toISOString();
  const nextAttempt = (existing?.attempt_count ?? 0) + 1;

  if (!existing) {
    const { error } = await provisioningTable(db).insert({
      venue_id: venueId,
      status: "running",
      seeded_steps: [],
      failed_steps: [],
      attempt_count: 1,
      last_attempt_at: nowIso,
      last_error: null,
      updated_at: nowIso,
    });
    if (error) {
      // Concurrent insert — treat as another runner won the lease.
      if (error.code === "23505") return false;
      console.error("[provisioning] insert running lease", error);
      return false;
    }
    return true;
  }

  if (existing.status === "running" && existing.last_attempt_at) {
    const age = Date.now() - new Date(existing.last_attempt_at).getTime();
    if (Number.isFinite(age) && age >= 0 && age < RUNNING_STALE_MS) {
      return false;
    }
  }

  const { data, error } = await provisioningTable(db)
    .update({
      status: "running",
      last_attempt_at: nowIso,
      attempt_count: nextAttempt,
      last_error: null,
      updated_at: nowIso,
    })
    .eq("venue_id", venueId)
    .or(`status.neq.running,last_attempt_at.is.null,last_attempt_at.lt.${staleBefore}`)
    .select("venue_id")
    .maybeSingle();

  if (error) {
    console.error("[provisioning] claim running lease", error);
    return false;
  }
  return Boolean(data);
}

/**
 * Seed all platform starters for a venue. Safe to call repeatedly.
 * Uses the admin client by default so White Glove (no venue session) works.
 * Persists lifecycle status — never reports complete when a required step failed.
 */
export async function seedWorkspaceStarters(
  venueId: string,
  client?: DbClient,
): Promise<StarterSeedResult> {
  const db = client ?? createAdminClient();
  const existing = await readProvisionRow(db, venueId);

  const claimed = await claimProvisioningRun(db, venueId, existing);
  if (!claimed) {
    const current = (await readProvisionRow(db, venueId)) ?? existing;
    return {
      ok: false,
      seeded: current?.seeded_steps ?? [],
      failed: parseFailedSteps(current?.failed_steps),
      status: (current?.status as StarterProvisioningStatus) || "running",
      skippedBecauseRunning: true,
    };
  }

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

  const status: StarterProvisioningStatus =
    failed.length === 0 ? "complete" : seeded.length === 0 ? "failed" : "incomplete";

  await upsertProvisionRow(db, venueId, {
    status,
    seeded_steps: seeded,
    failed_steps: failed,
    last_attempt_at: new Date().toISOString(),
    completed_at: status === "complete" ? new Date().toISOString() : null,
    last_error: failed[0]?.message ?? null,
  });

  return { ok: failed.length === 0, seeded, failed, status };
}

/**
 * Ensure starters for any durable, owner-accessible venue.
 * Idempotent. Safe from progress-save, activation, and repair paths.
 *
 * When prior status is `complete`, missing masters are treated as intentional
 * deletions and are NOT recreated unless `recreateDeleted` is true.
 */
export async function ensureVenueStarters(
  venueId: string,
  opts?: { client?: DbClient; recreateDeleted?: boolean },
): Promise<StarterSeedResult> {
  const db = opts?.client ?? createAdminClient();
  const snap = await getStarterProvisioningSnapshot(venueId, db);

  if (snap.status === "complete" && !opts?.recreateDeleted) {
    // Healthy venue — do not resurrect intentional deletions.
    return {
      ok: true,
      seeded: snap.seededSteps,
      failed: [],
      status: "complete",
    };
  }

  return seedWorkspaceStarters(venueId, db);
}

/**
 * Owner-facing restore: fills missing starters for incomplete venues.
 * With recreateDeleted=true, also re-runs seed after a prior complete
 * (explicit confirmation required in UI).
 */
export async function restoreHtcStarters(
  venueId: string,
  opts?: { recreateDeleted?: boolean; client?: DbClient },
): Promise<StarterSeedResult> {
  return ensureVenueStarters(venueId, {
    client: opts?.client,
    recreateDeleted: opts?.recreateDeleted === true,
  });
}
