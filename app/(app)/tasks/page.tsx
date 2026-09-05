import type { Metadata } from "next";

import { TaskCenter, type TaskRow } from "@/components/tasks/task-center";
import { PageHeader } from "@/components/shell/module-placeholder";
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue, getCurrentUserRole } from "@/lib/venue/service";
import { getCurrentStaffMember } from "@/lib/team/service";
import { isSupabaseConfigured } from "@/lib/env";
import {
  coupleLabelFromParts,
  computeTaskCenterUrgency,
  isDoOwned,
  qualifiesForWatch,
  type SearchableEvent,
} from "@/lib/tasks/task-center";

export const metadata: Metadata = { title: "Task Center" };

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function TaskCenterPage() {
  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Task Center"
          description="What your team needs to do — and which clients need watching."
        />
        <p className="text-sm text-muted-foreground">Configure Supabase to see tasks.</p>
      </div>
    );
  }

  const venue = await getCurrentVenue();
  if (!venue) return null;

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const weekAnchor = new Date(`${today}T00:00:00.000Z`);
  weekAnchor.setUTCDate(weekAnchor.getUTCDate() + 7);
  const weekOut = weekAnchor.toISOString().slice(0, 10);

  const [{ data: rawTasks }, { data: clientApps }, { data: eventRows }, currentStaff, currentRole] =
    await Promise.all([
      supabase
        .from("event_tasks")
        .select(`
          id, title, status, due_date, days_offset, due_date_locked, category, owner_type, visibility,
          is_required, depends_on_event_task_id, completed_at, auto_complete_trigger,
          assigned_to_staff_id, milestone_kind,
          assignee:assigned_to_staff_id ( full_name ),
          events (
            id, name, event_date, status,
            clients ( first_name, last_name, partner_first_name, partner_last_name )
          )
        `)
        .eq("venue_id", venue.id)
        .in("status", ["pending", "overdue", "blocked"])
        .not("events.status", "in", "(cancelled,complete)")
        .order("due_date", { ascending: true }),
      supabase
        .from("event_playbook_applications")
        .select("event_id, released_at")
        .eq("venue_id", venue.id)
        .eq("kind", "client"),
      supabase
        .from("events")
        .select(`
          id, name, event_date, status,
          clients ( first_name, last_name, partner_first_name, partner_last_name )
        `)
        .eq("venue_id", venue.id)
        .not("status", "in", "(cancelled,complete)")
        .order("event_date", { ascending: true }),
      getCurrentStaffMember(venue.id),
      getCurrentUserRole(),
    ]);

  const releasedClientEvents = new Set<string>();
  for (const row of (clientApps ?? []) as { event_id: string; released_at: string | null }[]) {
    if (row.released_at) releasedClientEvents.add(row.event_id);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks = (rawTasks ?? []) as any[];

  const enriched: TaskRow[] = tasks.map((t) => {
    const urgency = computeTaskCenterUrgency(t.status, t.due_date, today, weekOut);
    return {
      ...t,
      auto_complete_trigger: t.auto_complete_trigger ?? null,
      computedStatus: (urgency === "overdue" ? "overdue"
        : urgency === "blocked" ? "blocked"
        : t.status === "complete" ? "complete"
        : "pending") as TaskRow["computedStatus"],
    };
  });

  const doTasks = enriched.filter((t) => isDoOwned(t.owner_type));
  const watchTasks = enriched.filter((t) =>
    qualifiesForWatch(
      {
        ownerType: t.owner_type,
        status: t.status,
        dueDate: t.due_date,
        isRequired: t.is_required,
        autoCompleteTrigger: t.auto_complete_trigger,
        clientPlanningReleased: t.events?.id ? releasedClientEvents.has(t.events.id) : false,
      },
      today,
      weekOut,
    ),
  );

  const bucketDo = (urgency: ReturnType<typeof computeTaskCenterUrgency>) =>
    doTasks.filter((t) => computeTaskCenterUrgency(t.status, t.due_date, today, weekOut) === urgency);

  const doOverdue = bucketDo("overdue");
  const doBlocked = bucketDo("blocked");
  const doDueToday = bucketDo("due_today");
  const doDueSoon = bucketDo("due_soon");
  const doUpcoming = bucketDo("upcoming");

  // PostgREST typings sometimes surface belongs-to embeds as arrays; normalize.
  const searchableEvents: SearchableEvent[] = (eventRows ?? []).map((raw) => {
    const e = raw as {
      id: string;
      name: string;
      event_date: string;
      clients: unknown;
    };
    const clientsRaw = e.clients;
    const clients = (Array.isArray(clientsRaw) ? clientsRaw[0] : clientsRaw) as {
      first_name: string;
      last_name: string | null;
      partner_first_name: string | null;
      partner_last_name: string | null;
    } | null | undefined;
    return {
      id: e.id,
      name: e.name,
      eventDate: e.event_date,
      coupleLabel: coupleLabelFromParts(clients ?? null),
    };
  });

  const doAttention = doOverdue.length + doBlocked.length + doDueToday.length;
  const watchCount = watchTasks.length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Task Center"
          description="What your team needs to do — and which clients need watching."
        />
        <div className="shrink-0 flex flex-col items-end gap-0.5 text-xs text-muted-foreground pt-1">
          <span>
            <span className="font-medium text-heading">{doAttention}</span> team items need attention
          </span>
          {watchCount > 0 && (
            <span>
              <span className="font-medium text-heading">{watchCount}</span> client item{watchCount !== 1 ? "s" : ""} to watch
            </span>
          )}
        </div>
      </div>
      <TaskCenter
        doOverdue={doOverdue}
        doBlocked={doBlocked}
        doDueToday={doDueToday}
        doDueSoon={doDueSoon}
        doUpcoming={doUpcoming}
        watchTasks={watchTasks}
        searchableEvents={searchableEvents}
        hasAnyDoTasks={doTasks.length > 0}
        currentStaffId={currentStaff?.id ?? null}
        currentRole={currentRole}
      />
    </div>
  );
}
