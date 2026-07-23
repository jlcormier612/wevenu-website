import Link from "next/link";

import {
  getCommunications,
  getOpenTaskCount,
  getSubscriptions,
  getTasks,
  getTeamMember,
  getTimelineForRelationship,
} from "@/lib/data/store";
import type { Relationship, TimelineEvent } from "@/lib/types";
import {
  formatDate,
  formatDateTime,
  formatRelativeDay,
  HEALTH_EMOJI,
  HEALTH_LABELS,
  ONBOARDING_LABELS,
  STATUS_LABELS,
  WELCOME_BACK_LABELS,
  yesNo,
} from "@/lib/utils";
import { Panel, StatusPill } from "@/components/shared/ui";
import { TaskCompleteButton } from "@/components/tasks/task-complete-button";
import {
  computeRelationshipHealth,
  WHITE_GLOVE_CHECKLIST_MARKER,
} from "@shared/relationships";

export function RelationshipSnapshot({ relationship }: { relationship: Relationship }) {
  const assignee = getTeamMember(relationship.assignedTeamMemberId);
  const openTasks = getOpenTaskCount(relationship.id);
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

  const wgTasks = tasks.filter(
    (t) => t.meta?.checklist === WHITE_GLOVE_CHECKLIST_MARKER,
  );
  const showImplLink =
    relationship.onboardingType === "white_glove" ||
    relationship.status === "white_glove_implementation" ||
    wgTasks.length > 0;

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
        {showImplLink ? (
          <Link
            href={`/relationships/${relationship.id}/implementation`}
            className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3.5 py-2 text-sm font-medium text-[var(--forest-sage)] hover:border-[var(--heritage-sage)]"
          >
            White Glove Implementation
          </Link>
        ) : null}
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SnapItem
          label="Relationship Health"
          value={`${HEALTH_LABELS[health.band]} ${HEALTH_EMOJI[health.band]} · ${health.score}/100`}
        />
        <SnapItem label="Lifecycle Stage" value={relationship.currentStageLabel} />
        <SnapItem label="Plan" value={relationship.planName} />
        <SnapItem label="Founder" value={yesNo(relationship.foundingMember)} />
        <SnapItem
          label="Welcome Back"
          value={WELCOME_BACK_LABELS[relationship.welcomeBackVerified]}
        />
        <SnapItem
          label="Payment"
          value={String(health.paymentStatus).replace(/_/g, " ")}
        />
        <SnapItem
          label="Onboarding progress"
          value={`${health.onboardingProgress}%`}
        />
        <SnapItem
          label="Website published"
          value={yesNo(health.websitePublished)}
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
        <SnapItem
          label="Next Milestone"
          value={
            relationship.nextMilestone
              ? `${relationship.nextMilestone}${
                  relationship.nextMilestoneAt
                    ? ` — ${formatDate(relationship.nextMilestoneAt, { year: undefined })}`
                    : ""
                }`
              : "—"
          }
        />
        <SnapItem label="Open Tasks" value={String(openTasks)} />
      </dl>
      {health.factors.length > 0 ? (
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
          <Row label="Status" value={STATUS_LABELS[relationship.status]} />
          <Row label="Assigned" value={assignee?.name ?? "—"} />
          <Row label="Plan" value={relationship.planName} />
          <Row label="Founder" value={yesNo(relationship.foundingMember)} />
          <Row
            label="Welcome Back"
            value={
              relationship.welcomeBackRequested
                ? WELCOME_BACK_LABELS[relationship.welcomeBackVerified]
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
