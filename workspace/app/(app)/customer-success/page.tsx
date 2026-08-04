import Link from "next/link";

import { AutoArrivalBadge } from "@/components/relationships/auto-arrival-badge";
import { CustomerSuccessBoard } from "@/components/relationships/customer-success-board";
import {
  DataTable,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/shared/ui";
import {
  getCommunications,
  getRelationship,
  getRelationships,
  getSubscriptions,
  getTasks,
  getTeamMember,
  getTimelineForRelationship,
} from "@/lib/data/store";
import { actorCan } from "@/lib/program4/session";
import { tickWorkflows } from "@/lib/program3/engine";
import { ensureProgram3Data } from "@/lib/program3/store";
import { ensureProgram4Data } from "@/lib/program4/store";
import {
  CS_FLAG_FILTERS,
  CS_FLAG_LABELS,
  CS_STAGE_COLUMNS,
  CS_STAGE_LABELS,
  HEALTH_BADGE_LABELS,
  countAutoArrivalsForStage,
  deriveCustomerSuccessStage,
  isCsAutoArrivalStage,
  isInCustomerSuccessView,
  matchesCustomerSuccessFlag,
  resolveCustomerSuccessFlag,
  toCustomerHealthBadge,
  type CustomerSuccessFlag,
  type CustomerSuccessStage,
} from "@/lib/sales-cs";
import type { Subscription } from "@/lib/types";
import { formatRelativeDay, welcomeBackBadgeLabel } from "@/lib/utils";
import {
  acknowledgeStageAutoArrivals,
  computeRelationshipHealth,
  hasLiveRelationshipsSync,
  tickRenewalStages,
} from "@shared/relationships";

export const metadata = { title: "Customer Success" };

const STAGE_FILTERS: { label: string; value: CustomerSuccessStage | "all" }[] = [
  { label: "All", value: "all" },
  ...CS_STAGE_COLUMNS.map((c) => ({ label: c.label, value: c.stage })),
];

const CHIP_ACTIVE =
  "inline-flex items-center rounded-sm bg-[var(--forest-sage)] px-3 py-1.5 text-sm text-[var(--true-white)]";
const CHIP_IDLE =
  "inline-flex items-center rounded-sm bg-[var(--true-white)] px-3 py-1.5 text-sm text-[var(--forest-sage)] ring-1 ring-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] hover:bg-[var(--header-linen)]";

function isCsStageFilter(value: string | undefined): value is CustomerSuccessStage {
  return CS_STAGE_COLUMNS.some((c) => c.stage === value);
}

function buildCsHref(opts: {
  view: "pipeline" | "list";
  stage: CustomerSuccessStage | "all";
  flag: CustomerSuccessFlag | null;
}): string {
  const params = new URLSearchParams();
  if (opts.view === "list") params.set("view", "list");
  if (opts.stage !== "all") params.set("stage", opts.stage);
  if (opts.flag) params.set("flag", opts.flag);
  const qs = params.toString();
  return qs ? `/customer-success?${qs}` : "/customer-success";
}

export default async function CustomerSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; view?: string; wb?: string; flag?: string }>;
}) {
  await ensureProgram4Data();
  await ensureProgram3Data();
  await tickWorkflows(getRelationship);

  // Light demo / ops feedback: soft-promote renewal / renewed from anniversary windows.
  if (hasLiveRelationshipsSync()) {
    await tickRenewalStages().catch(() => null);
  }

  const params = await searchParams;
  const stageFilter = isCsStageFilter(params.stage) ? params.stage : "all";
  const flagFilter = resolveCustomerSuccessFlag(params);
  const view = params.view === "list" ? "list" : "pipeline";
  const canVerifyWelcomeBack = await actorCan("manage_welcome_back");

  if (
    stageFilter !== "all" &&
    isCsAutoArrivalStage(stageFilter) &&
    hasLiveRelationshipsSync()
  ) {
    await acknowledgeStageAutoArrivals("cs", stageFilter).catch(() => null);
  }

  const all = getRelationships().filter(isInCustomerSuccessView);

  let relationships =
    stageFilter === "all"
      ? all
      : all.filter((r) => deriveCustomerSuccessStage(r) === stageFilter);

  if (flagFilter) {
    relationships = relationships.filter((r) =>
      matchesCustomerSuccessFlag(r, flagFilter),
    );
  }

  const listHref = buildCsHref({
    view: "list",
    stage: stageFilter,
    flag: flagFilter,
  });
  const pipelineHref = buildCsHref({
    view: "pipeline",
    stage: stageFilter,
    flag: flagFilter,
  });

  const flagCounts = Object.fromEntries(
    CS_FLAG_FILTERS.map((f) => [
      f.value,
      all.filter((r) => matchesCustomerSuccessFlag(r, f.value)).length,
    ]),
  ) as Record<CustomerSuccessFlag, number>;

  const subscriptionsByRel: Record<string, Subscription | undefined> = {};
  const onboardingProgressByRel: Record<string, number> = {};

  for (const r of relationships) {
    const subs = getSubscriptions(r.id);
    subscriptionsByRel[r.id] = subs[0];
    const health = computeRelationshipHealth(r as never, {
      tasks: getTasks({ relationshipId: r.id }) as never,
      communications: getCommunications({ relationshipId: r.id }) as never,
      timelineEvents: getTimelineForRelationship(r.id) as never,
      subscriptions: subs as never,
    });
    onboardingProgressByRel[r.id] = health.onboardingProgress;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Customer Success"
        title="Customer Success"
        description="Every customer after subscribe. One relationship. Flags are attention filters — not pipeline stages. Welcome Back never gates checkout."
      />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {STAGE_FILTERS.map((f) => {
              const active = stageFilter === f.value;
              const href = buildCsHref({
                view,
                stage: f.value,
                flag: flagFilter,
              });
              const newCount =
                f.value !== "all"
                  ? countAutoArrivalsForStage(
                      all.filter(
                        (r) => deriveCustomerSuccessStage(r) === f.value,
                      ),
                      f.value,
                      "cs",
                    )
                  : 0;
              return (
                <Link
                  key={f.value}
                  href={href}
                  className={active ? CHIP_ACTIVE : CHIP_IDLE}
                >
                  {f.label}
                  <AutoArrivalBadge count={newCount} active={active} />
                </Link>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs uppercase tracking-[0.14em] ws-muted">
              Flags
            </span>
            {CS_FLAG_FILTERS.map((f) => {
              const active = flagFilter === f.value;
              const href = buildCsHref({
                view,
                stage: stageFilter,
                flag: active ? null : f.value,
              });
              const count = flagCounts[f.value];
              return (
                <Link
                  key={f.value}
                  href={href}
                  className={active ? CHIP_ACTIVE : CHIP_IDLE}
                >
                  {f.label}
                  {count > 0 ? (
                    <span
                      className={`ml-1.5 text-xs ${
                        active ? "text-[var(--true-white)]/80" : "ws-muted"
                      }`}
                    >
                      {count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            href={pipelineHref}
            className={
              view === "pipeline"
                ? "rounded-sm bg-[var(--soft-sage)]/50 px-3 py-1.5 text-sm"
                : "rounded-sm px-3 py-1.5 text-sm ws-muted hover:text-[var(--forest-sage)]"
            }
          >
            Pipeline
          </Link>
          <Link
            href={listHref}
            className={
              view === "list"
                ? "rounded-sm bg-[var(--soft-sage)]/50 px-3 py-1.5 text-sm"
                : "rounded-sm px-3 py-1.5 text-sm ws-muted hover:text-[var(--forest-sage)]"
            }
          >
            List
          </Link>
        </div>
      </div>

      {flagFilter ? (
        <p className="mb-4 text-sm ws-muted">
          Showing {CS_FLAG_LABELS[flagFilter]} ({relationships.length})
          {flagFilter === "wb_pending" ? (
            <>
              {" · "}
              <Link
                href="/founding"
                className="text-[var(--heritage-sage)] underline-offset-4 hover:underline"
              >
                Founder Dashboard
              </Link>
            </>
          ) : null}
          {" · "}
          <Link
            href={buildCsHref({
              view,
              stage: stageFilter,
              flag: null,
            })}
            className="text-[var(--heritage-sage)] underline-offset-4 hover:underline"
          >
            Clear flag
          </Link>
        </p>
      ) : null}

      {view === "pipeline" ? (
        <CustomerSuccessBoard
          relationships={relationships}
          subscriptionsByRel={subscriptionsByRel}
          onboardingProgressByRel={onboardingProgressByRel}
          canVerifyWelcomeBack={canVerifyWelcomeBack}
        />
      ) : (
        <Panel>
          <DataTable
            headers={[
              "Venue",
              "Stage",
              "Health",
              "Welcome Back",
              "Plan",
              "MRR",
              "Owner",
              "Last activity",
              "Support",
            ]}
            rows={relationships.map((r) => {
              const assignee = getTeamMember(r.assignedTeamMemberId);
              const stage = deriveCustomerSuccessStage(r);
              const badge = toCustomerHealthBadge(r.health, r.healthScore, {
                suspended: r.status === "suspended",
                accessDisabled: r.accessDisabled,
              });
              const sub = subscriptionsByRel[r.id];
              const lastActivity =
                r.lastCustomerActivityAt || r.lastLoginAt || r.lastContactAt;
              const wbLabel = r.welcomeBackRequested
                ? welcomeBackBadgeLabel(r.welcomeBackVerified)
                : null;
              return [
                <div key={`${r.id}-venue`}>
                  <Link
                    href={`/relationships/${r.id}?from=customer-success${
                      (r.supportOpenCount || 0) > 0 ? "&panel=support" : ""
                    }`}
                    className="font-medium hover:text-[var(--heritage-sage)]"
                  >
                    {r.venue.name}
                  </Link>
                  <p className="mt-0.5 text-xs ws-muted">
                    {r.venue.city}, {r.venue.state}
                  </p>
                </div>,
                <StatusPill key={`${r.id}-status`}>
                  {CS_STAGE_LABELS[stage]}
                </StatusPill>,
                <span key={`${r.id}-health`}>{HEALTH_BADGE_LABELS[badge]}</span>,
                <span key={`${r.id}-wb`}>{wbLabel ?? "—"}</span>,
                r.planName,
                sub ? `$${(sub.mrrCents / 100).toFixed(0)}` : "—",
                assignee?.name ?? "—",
                lastActivity ? formatRelativeDay(lastActivity) : "—",
                String(r.supportOpenCount || 0),
              ];
            })}
          />
        </Panel>
      )}
    </div>
  );
}
