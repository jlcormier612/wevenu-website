import type { Metadata } from "next";

import { TaskCenter } from "@/components/tasks/task-center";
import { PageHeader } from "@/components/shell/module-placeholder";
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Task Center" };

export const revalidate = 0; // always fresh — this is the coordinator's live workspace

export default async function TaskCenterPage() {
  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-6">
        <PageHeader title="Task Center" description="Your live event workspace — overdue tasks, due today, due this week, and blocked items across all events." />
        <p className="text-sm text-muted-foreground">Configure Supabase to see tasks.</p>
      </div>
    );
  }

  const venue = await getCurrentVenue();
  if (!venue) return null;

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const weekOut = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const { data: rawTasks } = await supabase
    .from("event_tasks")
    .select(`
      id, title, status, due_date, category, owner_type, visibility,
      is_required, depends_on_event_task_id, completed_at,
      events (
        id, name, event_date, status,
        clients ( first_name, last_name, partner_first_name, partner_last_name )
      )
    `)
    .eq("venue_id", venue.id)
    .in("status", ["pending", "overdue", "blocked"])
    .not("events.status", "in", "(cancelled,complete)")
    .order("due_date", { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks = (rawTasks ?? []) as any[];

  // Compute overdue in app layer (DB status may lag between cron runs)
  const enriched = tasks.map(t => ({
    ...t,
    computedStatus: (t.status === "blocked" ? "blocked"
      : t.status === "complete" ? "complete"
      : new Date(t.due_date + "T00:00:00") < new Date(today + "T00:00:00") ? "overdue"
      : "pending") as "overdue" | "blocked" | "pending" | "complete",
  }));

  const overdue    = enriched.filter(t => t.computedStatus === "overdue");
  const dueToday   = enriched.filter(t => t.computedStatus === "pending" && t.due_date === today);
  const dueThisWeek = enriched.filter(t => t.computedStatus === "pending" && t.due_date > today && t.due_date <= weekOut);
  const blocked    = enriched.filter(t => t.computedStatus === "blocked");
  const upcoming   = enriched.filter(t => t.computedStatus === "pending" && t.due_date > weekOut);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader
          title="Task Center"
          description="Your live event workspace. Focus on exceptions — Wevenu handles the routine."
        />
        <div className="shrink-0 flex items-center gap-2 text-xs text-muted-foreground pt-1">
          <span className="font-medium text-heading">{overdue.length + dueToday.length + blocked.length}</span> items need attention
        </div>
      </div>
      <TaskCenter
        overdue={overdue}
        dueToday={dueToday}
        dueThisWeek={dueThisWeek}
        blocked={blocked}
        upcoming={upcoming}
        venueId={venue.id}
      />
    </div>
  );
}
