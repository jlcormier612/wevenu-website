import Link from "next/link";

import {
  getCommunications,
  getOpenTaskCount,
  getSubscriptions,
  getTasks,
  getTeamMember,
  getTimelineForRelationship,
  getWalkthroughs,
} from "@/lib/data/store";
import { getSequenceEnrollmentsSync } from "@/lib/program3/store";
import {
  computeAdoptionCheckpoints,
  computeRiskSection,
  CS_STAGE_LABELS,
  deriveCustomerSuccessStage,
  deriveSalesStage,
  HEALTH_BADGE_LABELS,
  isInCustomerSuccessView,
  SALES_STAGE_LABELS,
  toCustomerHealthBadge,
} from "@/lib/sales-cs";
import type { Relationship, TimelineEvent, Walkthrough } from "@/lib/types";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatRelativeDay,
  HEALTH_EMOJI,
  HEALTH_LABELS,
  ONBOARDING_LABELS,
  STATUS_LABELS,
  WELCOME_BACK_LABELS,
  welcomeBackBadgeLabel,
  yesNo,
} from "@/lib/utils";
import { Panel, StatusPill } from "@/components/shared/ui";
import { TaskCompleteButton } from "@/components/tasks/task-complete-button";
import { WelcomeBackVerifyControl } from "@/components/relationships/welcome-back-verify-control";
import {
  computeRelationshipHealth,
  normalizeLifecycleStatus,
  WHITE_GLOVE_CHECKLIST_MARKER,
} from "@shared/relationships";
import type { SequenceEnrollment } from "@/lib/program3/types";

export type SnapshotPreferredView = "sales" | "customer-success";

/**
 * Display mode for Relationship Snapshot cells — same record, no data duplication.
 * `subscribedAt` always forces CS so customers never stay on hollow Sales metrics.
 * Prospects (`!subscribedAt` and not in CS view) always use Sales.
 * Optional board `from=` bias only applies when CS membership is not from subscribe.
 */
export function resolveSnapshotMode(
  relationship: Pick<Relationship, "status" | "subscribedAt">,
  preferredView?: SnapshotPreferredView,
): "sales" | "cs" {
  if (relationship.subscribedAt) return "cs";
  if (!isInCustomerSuccessView(relationship)) return "sales";
  if (preferredView === "sales") return "sales";
  return "cs";
}

/** Mid-checkout / trial — show Plan + Payment on Sales snapshot; hide empty otherwise. */
function isMidCheckoutSales(relationship: Relationship): boolean {
  if (relationship.subscribedAt) return false;
  if (relationship.stripeCheckoutSessionId) return true;
  if (relationship.paymentStatus === "pending") return true;
  if (normalizeLifecycleStatus(relationship.status) === "trial") return true;
  if (relationship.planId && relationship.planId !== "none") return true;
  return false;
}

/** Humanize payment status; clarify manual (Owner/Admin, no Stripe). */
function formatPaymentLabel(status: string | null | undefined): string {
  if (!status) return "—";
  const raw = String(status).trim();
  if (raw.toLowerCase() === "manual") return "Manual (no Stripe)";
  return raw.replace(/_/g, " ");
}

/**
 * CS board already shows the primary stage. Only surface Lifecycle/Access when
 * it adds signal (suspension, disabled access, former customer, lifecycle at-risk).
 */
function csSnapshotLifecycleExtra(
  relationship: Relationship,
): { label: string; value: string } | null {
  const status = normalizeLifecycleStatus(relationship.status);

  if (relationship.accessDisabled || status === "suspended") {
    const value = relationship.accessDisabled
      ? status === "suspended"
        ? "Suspended · access disabled"
        : "Access disabled"
      : (STATUS_LABELS[relationship.status] ?? "Suspended");
    return { label: "Access", value };
  }

  if (status === "former_customer" || status === "at_risk") {
    return {
      label: "Lifecycle",
      value: STATUS_LABELS[relationship.status] ?? relationship.status,
    };
  }

  return null;
}

function daysSilentSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function walkthroughSnapshotLabel(
  relationship: Relationship,
  walkthroughs: Walkthrough[],
): string {
  const status = normalizeLifecycleStatus(relationship.status);
  if (status === "walkthrough_requested") return "Requested";
  if (status === "walkthrough_scheduled") {
    const upcoming = walkthroughs.find(
      (w) => w.status === "upcoming" || w.status === "rescheduled",
    );
    return upcoming
      ? `Scheduled — ${formatDate(upcoming.scheduledAt, { year: undefined })}`
      : "Scheduled";
  }
  if (status === "walkthrough_completed") return "Completed";

  const completed = walkthroughs.find((w) => w.status === "completed");
  if (completed) return "Completed";
  const upcoming = [...walkthroughs]
    .filter((w) => w.status === "upcoming" || w.status === "rescheduled")
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    )[0];
  if (upcoming) {
    return `Scheduled — ${formatDate(upcoming.scheduledAt, { year: undefined })}`;
  }
  if (walkthroughs.some((w) => w.status === "cancelled")) return "Cancelled";
  return "—";
}

function sequenceEnrollmentLabel(
  enrollment: SequenceEnrollment | undefined,
): string | null {
  if (!enrollment) return null;
  const next = enrollment.steps.find(
    (s) => s.status === "scheduled" || s.status === "pending",
  );
  const status = enrollment.status.replace(/_/g, " ");
  if (next?.scheduledFor) {
    return `${status} · next ${formatDateTime(next.scheduledFor)}`;
  }
  if (next?.label) return `${status} · next: ${next.label}`;
  return status;
}

export function RelationshipSnapshot({
  relationship,
  preferredView,
  canVerifyWelcomeBack = false,
}: {
  relationship: Relationship;
  preferredView?: SnapshotPreferredView;
  canVerifyWelcomeBack?: boolean;
}) {
  const assignee = getTeamMember(relationship.assignedTeamMemberId);
  const openTasks = getOpenTaskCount(relationship.id);
  const tasks = getTasks({ relationshipId: relationship.id });
  const communications = getCommunications({ relationshipId: relationship.id });
  const timelineEvents = getTimelineForRelationship(relationship.id);
  const subscriptions = getSubscriptions(relationship.id);
  const walkthroughs = getWalkthroughs().filter(
    (w) => w.relationshipId === relationship.id,
  );
  const sequenceEnrollments = getSequenceEnrollmentsSync({
    relationshipId: relationship.id,
  });
  const activeEnrollment =
    sequenceEnrollments.find((e) => e.status === "active") ??
    sequenceEnrollments.find((e) => e.status === "paused") ??
    sequenceEnrollments[0];

  const health = computeRelationshipHealth(relationship as never, {
    tasks: tasks as never,
    communications: communications as never,
    timelineEvents: timelineEvents as never,
    subscriptions: subscriptions as never,
  });

  const wgTasks = tasks.filter(
    (t) => t.meta?.checklist === WHITE_GLOVE_CHECKLIST_MARKER,
  );
  const showImplLink =
    relationship.onboardingType === "white_glove" ||
    relationship.status === "white_glove_implementation" ||
    wgTasks.length > 0;
  const mode = resolveSnapshotMode(relationship, preferredView);
  const isCsMode = mode === "cs";
  const healthBadge = toCustomerHealthBadge(
    health.band,
    health.score,
    {
      suspended: relationship.status === "suspended",
      accessDisabled: relationship.accessDisabled,
    },
  );
  const nextMilestoneValue = relationship.nextMilestone
    ? `${relationship.nextMilestone}${
        relationship.nextMilestoneAt
          ? ` — ${formatDate(relationship.nextMilestoneAt, { year: undefined })}`
          : ""
      }`
    : "—";
  const lastCommAt =
    health.lastCommunicationAt || relationship.lastContactAt || null;
  const silentDays = daysSilentSince(lastCommAt);
  const showWelcomeBack =
    relationship.welcomeBackRequested ||
    relationship.welcomeBackVerified !== "none";
  const wbPending =
    relationship.welcomeBackRequested &&
    relationship.welcomeBackVerified === "pending";
  const wbBadgeLabel = relationship.welcomeBackRequested
    ? welcomeBackBadgeLabel(relationship.welcomeBackVerified)
    : null;
  const showPlanPayment = isCsMode || isMidCheckoutSales(relationship);
  const sequenceLabel = sequenceEnrollmentLabel(activeEnrollment);
  const walkthroughLabel = walkthroughSnapshotLabel(relationship, walkthroughs);
  const lifecycleExtra = isCsMode
    ? csSnapshotLifecycleExtra(relationship)
    : null;

  return (
    <section className="ws-panel border-[var(--soft-sage)]/60 bg-[linear-gradient(165deg,var(--natural-cream),var(--true-white)_45%,color-mix(in_srgb,var(--soft-sage)_18%,var(--true-white)))] p-7 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="ws-eyebrow">Relationship Snapshot</p>
          <h1 className="mt-2 font-heading text-4xl tracking-tight md:text-5xl">
            {relationship.venue.name}
          </h1>
          <p className="mt-2 text-[var(--heritage-sage)]">
            {relationship.venue.city}, {relationship.venue.state}
            {assignee ? ` · ${assignee.name}` : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isCsMode ? (
            <span className="rounded-sm bg-[color-mix(in_srgb,var(--soft-sage)_35%,var(--true-white))] px-2.5 py-1 text-xs font-medium tracking-wide text-[var(--forest-sage)]">
              {HEALTH_BADGE_LABELS[healthBadge]}
            </span>
          ) : null}
          {showImplLink ? (
            <Link
              href={`/relationships/${relationship.id}/implementation`}
              className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3.5 py-2 text-sm font-medium text-[var(--forest-sage)] hover:border-[var(--heritage-sage)]"
            >
              White Glove Implementation
            </Link>
          ) : null}
        </div>
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isCsMode ? (
          <>
            <SnapItem
              label="Relationship Health"
              value={`${HEALTH_LABELS[health.band]} ${HEALTH_EMOJI[health.band]} · ${health.score}/100`}
            />
            <SnapItem
              label="Customer Success stage"
              value={CS_STAGE_LABELS[deriveCustomerSuccessStage(relationship)]}
            />
            {lifecycleExtra ? (
              <SnapItem
                label={lifecycleExtra.label}
                value={lifecycleExtra.value}
              />
            ) : null}
            {showPlanPayment ? (
              <SnapItem label="Plan" value={relationship.planName} />
            ) : null}
            <SnapItem label="Founder" value={yesNo(relationship.foundingMember)} />
            {showWelcomeBack ? (
              wbPending && canVerifyWelcomeBack ? (
                <div>
                  <dt className="ws-eyebrow">Welcome Back</dt>
                  <dd className="mt-1.5">
                    <WelcomeBackVerifyControl
                      relationshipId={relationship.id}
                      venueName={relationship.venue.name}
                      variant="inline"
                    />
                  </dd>
                </div>
              ) : (
                <SnapItem
                  label="Welcome Back"
                  value={wbBadgeLabel ?? WELCOME_BACK_LABELS[relationship.welcomeBackVerified]}
                />
              )
            ) : null}
            {showPlanPayment ? (
              <SnapItem
                label="Payment"
                value={formatPaymentLabel(health.paymentStatus)}
              />
            ) : null}
            <SnapItem
              label="Onboarding progress"
              value={`${health.onboardingProgress}%`}
            />
            <SnapItem
              label="Last login"
              value={
                health.lastLoginAt
                  ? formatRelativeDay(health.lastLoginAt)
                  : "—"
              }
            />
            <SnapItem
              label="Logins (30d)"
              value={String(health.loginCount30d)}
            />
            <SnapItem
              label="Last customer activity"
              value={
                health.lastCustomerActivityAt
                  ? formatRelativeDay(health.lastCustomerActivityAt)
                  : formatRelativeDay(relationship.lastContactAt)
              }
            />
            <SnapItem
              label="Last team activity"
              value={
                health.lastTeamActivityAt
                  ? formatRelativeDay(health.lastTeamActivityAt)
                  : "—"
              }
            />
            <SnapItem
              label="Last communication"
              value={
                health.lastCommunicationAt
                  ? formatRelativeDay(health.lastCommunicationAt)
                  : "—"
              }
            />
            <SnapItem
              label="Support requests"
              value={String(health.supportOpenCount)}
            />
            <SnapItem label="Next Milestone" value={nextMilestoneValue} />
            <SnapItem label="Open Tasks" value={String(openTasks)} />
            {relationship.subscribedAt ? (
              <SnapItem
                label="Customer since"
                value={formatDate(relationship.subscribedAt)}
              />
            ) : null}
          </>
        ) : (
          <>
            <SnapItem
              label="Sales stage"
              value={SALES_STAGE_LABELS[deriveSalesStage(relationship)]}
            />
            <SnapItem label="Next Milestone" value={nextMilestoneValue} />
            {relationship.referralSource ? (
              <SnapItem label="Source" value={relationship.referralSource} />
            ) : null}
            <SnapItem
              label="Last communication"
              value={lastCommAt ? formatRelativeDay(lastCommAt) : "—"}
            />
            <SnapItem
              label="Days silent"
              value={silentDays != null ? String(silentDays) : "—"}
            />
            {sequenceLabel ? (
              <SnapItem label="Sequence" value={sequenceLabel} />
            ) : null}
            <SnapItem label="Walkthrough" value={walkthroughLabel} />
            {showWelcomeBack ? (
              <SnapItem
                label="Welcome Back"
                value={WELCOME_BACK_LABELS[relationship.welcomeBackVerified]}
              />
            ) : null}
            {relationship.foundingMember ? (
              <SnapItem label="Founder" value={yesNo(true)} />
            ) : null}
            {showPlanPayment ? (
              <>
                <SnapItem label="Plan" value={relationship.planName} />
                <SnapItem
                  label="Payment"
                  value={formatPaymentLabel(
                    relationship.paymentStatus ?? health.paymentStatus,
                  )}
                />
              </>
            ) : null}
            <SnapItem label="Open Tasks" value={String(openTasks)} />
          </>
        )}
      </dl>
      {isCsMode && health.factors.length > 0 ? (
        <p className="mt-4 text-xs ws-muted">
          Health factors: {health.factors.slice(0, 4).join(" · ")}
        </p>
      ) : null}
    </section>
  );
}

function SnapItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="ws-eyebrow">{label}</dt>
      <dd className="mt-1.5 text-[1.05rem] leading-snug">{value}</dd>
    </div>
  );
}

/** Customer Success panels — same Relationship record; no sales terminology. */
export function CustomerSuccessPanels({
  relationship,
}: {
  relationship: Relationship;
}) {
  if (!isInCustomerSuccessView(relationship)) return null;

  const tasks = getTasks({ relationshipId: relationship.id });
  const communications = getCommunications({ relationshipId: relationship.id });
  const timelineEvents = getTimelineForRelationship(relationship.id);
  const subscriptions = getSubscriptions(relationship.id);
  const health = computeRelationshipHealth(relationship as never, {
    tasks: tasks as never,
    communications: communications as never,
    timelineEvents: timelineEvents as never,
    subscriptions: subscriptions as never,
  });
  const adoption = computeAdoptionCheckpoints(relationship, {
    onboardingProgress: health.onboardingProgress,
    websitePublished: health.websitePublished,
  });
  const lastActivity =
    health.lastCustomerActivityAt ||
    health.lastLoginAt ||
    relationship.lastContactAt;
  const daysSince = lastActivity
    ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86_400_000)
    : null;
  const risk = computeRiskSection(relationship, {
    onboardingProgress: health.onboardingProgress,
    websitePublished: health.websitePublished,
    daysSinceActivity: daysSince,
    healthFactors: health.factors,
  });
  const sub = subscriptions[0];
  const badge = toCustomerHealthBadge(relationship.health, relationship.healthScore, {
    suspended: relationship.status === "suspended",
    accessDisabled: relationship.accessDisabled,
  });
  const riskLabel =
    risk.tone === "green" ? "Green" : risk.tone === "yellow" ? "Yellow" : "Red";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Adoption">
        <ul className="space-y-2">
          {adoption.map((a) => (
            <li key={a.id} className="flex justify-between gap-3 text-sm">
              <span>{a.label}</span>
              <span className="ws-muted">{a.done ? "Done" : "Open"}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Engagement">
        <div className="space-y-2">
          <Row
            label="Last Login"
            value={
              health.lastLoginAt ? formatRelativeDay(health.lastLoginAt) : "—"
            }
          />
          <Row
            label="Last Activity"
            value={lastActivity ? formatRelativeDay(lastActivity) : "—"}
          />
          <Row
            label="Days Since Activity"
            value={daysSince != null ? String(daysSince) : "—"}
          />
          <Row
            label="Open Support Issues"
            value={String(health.supportOpenCount)}
          />
          <Row label="Health badge" value={HEALTH_BADGE_LABELS[badge]} />
        </div>
      </Panel>

      <Panel title="Subscription">
        <div className="space-y-2">
          <Row label="Current Plan" value={sub?.planName ?? relationship.planName} />
          <Row
            label="Monthly Revenue"
            value={sub ? formatCurrency(sub.mrrCents) : "—"}
          />
          <Row
            label="Subscription Status"
            value={formatPaymentLabel(
              sub?.status ?? relationship.paymentStatus ?? undefined,
            )}
          />
          <Row
            label="Renewal Date"
            value={
              relationship.nextMilestoneAt &&
              /renew/i.test(relationship.nextMilestone ?? "")
                ? formatDate(relationship.nextMilestoneAt)
                : "—"
            }
          />
          <Row
            label="Customer Since"
            value={
              relationship.subscribedAt
                ? formatDate(relationship.subscribedAt)
                : "—"
            }
          />
        </div>
      </Panel>

      <Panel title="Risk">
        <p className="text-sm font-medium">Badge: {riskLabel}</p>
        {risk.reasons.length === 0 ? (
          <p className="mt-2 text-sm ws-muted">No risk reasons flagged.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {risk.reasons.map((reason) => (
              <li key={reason} className="text-sm ws-muted">
                · {reason}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export function RelationshipTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <Panel title="Relationship Timeline">
        <p className="text-sm ws-muted">No timeline activity yet.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Relationship Timeline">
      <ol className="relative space-y-0 border-l border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] ml-2">
        {events.map((event) => (
          <li key={event.id} className="relative pb-7 pl-6 last:pb-0">
            <span className="absolute top-1.5 -left-[5px] h-2.5 w-2.5 rounded-full bg-[var(--heritage-sage)]" />
            <p className="text-xs tracking-wide text-[var(--heritage-sage)]">
              {formatDateTime(event.occurredAt)}
            </p>
            <h3 className="mt-1 font-heading text-lg leading-snug">{event.title}</h3>
            {event.body ? <p className="mt-1 text-sm leading-relaxed ws-muted">{event.body}</p> : null}
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function RelationshipDetails({ relationship }: { relationship: Relationship }) {
  const assignee = getTeamMember(relationship.assignedTeamMemberId);

  return (
    <Panel title="Details">
      <div className="grid gap-6 md:grid-cols-2">
        <DetailBlock title="Venue Information">
          <Row label="Name" value={relationship.venue.name} />
          <Row
            label="Location"
            value={`${relationship.venue.city}, ${relationship.venue.state}`}
          />
          <Row label="Type" value={relationship.venue.venueType ?? "—"} />
          <Row
            label="Capacity"
            value={relationship.venue.capacity ? String(relationship.venue.capacity) : "—"}
          />
          <Row label="Website" value={relationship.venue.website ?? "—"} />
        </DetailBlock>

        <DetailBlock title="Owner Information">
          <Row
            label="Name"
            value={`${relationship.owner.firstName} ${relationship.owner.lastName}`}
          />
          <Row label="Title" value={relationship.owner.title ?? "—"} />
          <Row label="Email" value={relationship.owner.email} />
          <Row label="Phone" value={relationship.owner.phone ?? "—"} />
        </DetailBlock>

        <DetailBlock title="Status & Plan">
          <Row
            label={
              isInCustomerSuccessView(relationship)
                ? "Customer Success"
                : "Sales stage"
            }
            value={
              isInCustomerSuccessView(relationship)
                ? CS_STAGE_LABELS[deriveCustomerSuccessStage(relationship)]
                : SALES_STAGE_LABELS[deriveSalesStage(relationship)]
            }
          />
          <Row label="Assigned" value={assignee?.name ?? "—"} />
          <Row label="Plan" value={relationship.planName} />
          <Row label="Founder" value={yesNo(relationship.foundingMember)} />
          <Row
            label="Welcome Back"
            value={
              relationship.welcomeBackRequested
                ? (welcomeBackBadgeLabel(relationship.welcomeBackVerified) ??
                  WELCOME_BACK_LABELS[relationship.welcomeBackVerified])
                : "Not requested"
            }
          />
          <Row label="Onboarding" value={ONBOARDING_LABELS[relationship.onboardingType]} />
        </DetailBlock>

        <DetailBlock title="Notes">
          <p className="text-sm leading-relaxed ws-muted">
            {relationship.notes ?? "No notes yet."}
          </p>
          {relationship.referralSource ? (
            <p className="mt-3 text-sm">
              <span className="ws-eyebrow">Referral</span>
              <span className="mt-1 block">{relationship.referralSource}</span>
            </p>
          ) : null}
        </DetailBlock>
      </div>
    </Panel>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-heading text-lg">{title}</h3>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="ws-muted">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function SecondaryLists({
  relationshipId,
  tasks,
  communications,
  documents,
  invoices,
  subscriptions,
  milestones,
}: {
  relationshipId: string;
  tasks: {
    id: string;
    title: string;
    status: string;
    dueDate: string;
  }[];
  communications: { id: string; subject: string; channel: string; occurredAt: string }[];
  documents: { id: string; name: string; kind: string }[];
  invoices: { id: string; number: string; description: string; status: string }[];
  subscriptions: { id: string; planName: string; status: string }[];
  milestones: { id: string; title: string; status: string }[];
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel
        title="Tasks"
        action={
          <Link href="/tasks" className="text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline">
            All tasks
          </Link>
        }
      >
        <ul className="space-y-3">
          {tasks.length === 0 ? (
            <li className="text-sm ws-muted">No open tasks.</li>
          ) : (
            tasks.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 text-sm">
                <span>{t.title}</span>
                <div className="shrink-0">
                  {t.status === "completed" || t.status === "cancelled" ? (
                    <StatusPill tone="muted">{t.status.replace("_", " ")}</StatusPill>
                  ) : (
                    <TaskCompleteButton
                      taskId={t.id}
                      title={t.title}
                      initialStatus={t.status as "open" | "in_progress" | "completed" | "cancelled"}
                    />
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      </Panel>

      <Panel
        title="Communications"
        action={
          <Link
            href="/communications"
            className="text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
          >
            All messages
          </Link>
        }
      >
        <ul className="space-y-3">
          {communications.length === 0 ? (
            <li className="text-sm ws-muted">No communications yet.</li>
          ) : (
            communications.slice(0, 5).map((c) => (
              <li key={c.id} className="text-sm">
                <span className="font-medium">{c.subject}</span>
                <span className="mt-0.5 block ws-muted">
                  {c.channel.replace("_", " ")} · {formatRelativeDay(c.occurredAt)}
                </span>
              </li>
            ))
          )}
        </ul>
      </Panel>

      <Panel title="Documents">
        <ul className="space-y-2">
          {documents.length === 0 ? (
            <li className="text-sm ws-muted">No documents.</li>
          ) : (
            documents.map((d) => (
              <li key={d.id} className="flex justify-between gap-3 text-sm">
                <span>{d.name}</span>
                <span className="ws-muted">{d.kind}</span>
              </li>
            ))
          )}
        </ul>
      </Panel>

      <Panel title="Invoices & Subscriptions">
        <div className="space-y-4">
          <div>
            <p className="ws-eyebrow mb-2">Subscriptions</p>
            {subscriptions.length === 0 ? (
              <p className="text-sm ws-muted">None</p>
            ) : (
              subscriptions.map((s) => (
                <p key={s.id} className="text-sm">
                  {s.planName} · {s.status}
                </p>
              ))
            )}
          </div>
          <div>
            <p className="ws-eyebrow mb-2">Invoices</p>
            {invoices.length === 0 ? (
              <p className="text-sm ws-muted">None</p>
            ) : (
              invoices.map((i) => (
                <p key={i.id} className="text-sm">
                  {i.number} · {i.description} · {i.status}
                </p>
              ))
            )}
          </div>
        </div>
      </Panel>

      {milestones.length > 0 ? (
        <Panel
          title="Onboarding Milestones"
          className="lg:col-span-2"
          action={
            relationshipId ? (
              <Link
                href="/onboarding"
                className="text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
              >
                White Glove board
              </Link>
            ) : null
          }
        >
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {milestones.map((m) => (
              <li key={m.id} className="rounded-sm bg-[var(--warm-gray)] px-4 py-3">
                <p className="text-sm font-medium">{m.title}</p>
                <p className="mt-1 text-xs capitalize ws-muted">{m.status.replace("_", " ")}</p>
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}
    </div>
  );
}
