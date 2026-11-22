import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

describe("program4 empty operational bootstrap", () => {
  let dataDir = "";
  let prevDataPath: string | undefined;

  before(() => {
    dataDir = mkdtempSync(path.join(tmpdir(), "p4-empty-ops-"));
    prevDataPath = process.env.WORKSPACE_DATA_PATH;
    process.env.WORKSPACE_DATA_PATH = dataDir;
  });

  after(() => {
    if (prevDataPath === undefined) delete process.env.WORKSPACE_DATA_PATH;
    else process.env.WORKSPACE_DATA_PATH = prevDataPath;
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("scrubs fictional team ids and sample ledger rows", async () => {
    const { operationalLedgerBootstrap, operationalTeamBootstrap } = await import(
      "./store"
    );
    const { BOOTSTRAP_OWNER_PROFILE, LEGACY_FICTIONAL_TEAM_MEMBER_IDS } =
      await import("./seed");

    const scrubbed = operationalTeamBootstrap([
      BOOTSTRAP_OWNER_PROFILE,
      {
        ...BOOTSTRAP_OWNER_PROFILE,
        id: LEGACY_FICTIONAL_TEAM_MEMBER_IDS[0],
        email: "maya@hellotocheers.com",
        name: "Maya Chen",
        role: "customer_success",
      },
    ]);
    assert.equal(scrubbed.length, 1);
    assert.equal(scrubbed[0]?.id, "tm_jen");
    assert.equal(scrubbed[0]?.role, "owner");

    const ledger = operationalLedgerBootstrap([
      {
        id: "cl_1",
        teamMemberId: "tm_sara",
        relationshipId: "rel_harbor",
        eventType: "walkthrough_booked",
        sourceEventId: "seed_wt_harbor",
        basisCents: 0,
        commissionCents: 5000,
        planId: "plan_sales_standard",
        occurredAt: "2026-07-17T15:00:00.000Z",
        periodKey: "2026-07",
        status: "approved",
      },
      {
        id: "cl_real_1",
        teamMemberId: "tm_jen",
        relationshipId: "rel_future",
        eventType: "subscription_sold",
        sourceEventId: "evt_real",
        basisCents: 14900,
        commissionCents: 0,
        planId: "plan_leadership",
        occurredAt: "2026-11-22T12:00:00.000Z",
        periodKey: "2026-11",
        status: "pending",
      },
    ]);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0]?.id, "cl_real_1");
  });

  it("ensureProgram4Data writes owner-only team, empty ledger, preserved plans", async () => {
    const {
      ensureProgram4Data,
      getCommissionLedgerSync,
      getCommissionPlansSync,
      getTeamProfilesSync,
    } = await import("./store");
    const { PROGRAM4_BOOTSTRAP_VERSION, SEED_COMMISSION_PLANS } = await import(
      "./seed"
    );
    const { readJsonFileSync } = await import("@/lib/program3/jsonl");
    const { PROGRAM4_FILES } = await import("./paths");
    const { filePath } = await import("@/lib/program3/jsonl");

    await ensureProgram4Data();
    await ensureProgram4Data(); // idempotent

    const team = getTeamProfilesSync();
    assert.equal(team.length, 1);
    assert.equal(team[0]?.id, "tm_jen");
    assert.equal(team[0]?.email, "jennifer@hellotocheers.com");
    assert.equal(getCommissionLedgerSync().length, 0);
    assert.equal(getCommissionPlansSync().length, SEED_COMMISSION_PLANS.length);

    const marker = readJsonFileSync<{ bootstrapVersion?: number }>(
      filePath(PROGRAM4_FILES.seedMarker),
      {},
    );
    assert.equal(marker.bootstrapVersion, PROGRAM4_BOOTSTRAP_VERSION);
  });

  it("empty ledger file does not resurrect sample commissions", async () => {
    const { getCommissionLedgerSync, ensureProgram4Data } = await import("./store");
    await ensureProgram4Data();
    assert.equal(getCommissionLedgerSync({ periodKey: "2026-07" }).length, 0);
    assert.equal(getCommissionLedgerSync().reduce((s, e) => s + e.commissionCents, 0), 0);
  });

  it("migrates legacy v1 marker roster to owner-only without reseed fiction", async () => {
    const { writeJsonAtomic, writeJsonlAtomic, filePath } = await import(
      "@/lib/program3/jsonl"
    );
    const { PROGRAM4_FILES } = await import("./paths");
    const {
      BOOTSTRAP_OWNER_PROFILE,
      LEGACY_FICTIONAL_TEAM_MEMBER_IDS,
      SEED_COMMISSION_PLANS,
    } = await import("./seed");

    await writeJsonlAtomic(filePath(PROGRAM4_FILES.teamMembers), [
      BOOTSTRAP_OWNER_PROFILE,
      {
        ...BOOTSTRAP_OWNER_PROFILE,
        id: LEGACY_FICTIONAL_TEAM_MEMBER_IDS[1],
        email: "eli@hellotocheers.com",
        name: "Eli Torres",
        role: "implementation",
      },
    ]);
    await writeJsonlAtomic(filePath(PROGRAM4_FILES.commissionPlans), SEED_COMMISSION_PLANS);
    await writeJsonlAtomic(filePath(PROGRAM4_FILES.commissionLedger), [
      {
        id: "cl_3",
        teamMemberId: "tm_sara",
        relationshipId: "rel_x",
        eventType: "white_glove_sold",
        sourceEventId: "seed_wg",
        basisCents: 0,
        commissionCents: 20000,
        planId: "plan_sales_standard",
        occurredAt: "2026-07-12T18:00:00.000Z",
        periodKey: "2026-07",
        status: "approved",
      },
    ]);
    await writeJsonAtomic(filePath(PROGRAM4_FILES.seedMarker), {
      seededAt: "2026-01-01T00:00:00.000Z",
      bootstrapVersion: 1,
    });

    // Fresh import path already loaded — call ensure again after rewriting files.
    const {
      ensureProgram4Data,
      getCommissionLedgerSync,
      getTeamProfilesSync,
    } = await import("./store");
    await ensureProgram4Data();

    assert.equal(getTeamProfilesSync().length, 1);
    assert.equal(getTeamProfilesSync()[0]?.id, "tm_jen");
    assert.equal(getCommissionLedgerSync().length, 0);
  });
});
