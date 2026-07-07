import {
  addVenueNoteAction,
  addVenueTaskAction,
  completeVenueTaskAction,
  markVenueContactedAction,
  setNextContactAction,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { HqCrmState, HqNote, HqTask } from "@/lib/hq/venue-detail-types";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

async function addTask(venueId: string, formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "") || null;
  await addVenueTaskAction(venueId, title, dueDate);
}

async function addNote(venueId: string, formData: FormData) {
  "use server";
  const body = String(formData.get("body") ?? "");
  await addVenueNoteAction(venueId, body);
}

async function setNextContact(venueId: string, formData: FormData) {
  "use server";
  const date = String(formData.get("nextContactAt") ?? "") || null;
  await setNextContactAction(venueId, date ? new Date(date).toISOString() : null);
}

export function SupportSection({
  venueId,
  notes,
  tasks,
  crmState,
}: {
  venueId: string;
  notes: HqNote[];
  tasks: HqTask[];
  crmState: HqCrmState;
}) {
  const openTasks = tasks.filter((t) => !t.completedAt);
  const doneTasks = tasks.filter((t) => t.completedAt);

  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="font-heading text-sm font-semibold text-heading">Support</h2>
        <p className="text-xs text-muted-foreground">Internal notes, follow-up tasks, and contact cadence.</p>
      </CardHeader>
      <CardContent className="pt-0 space-y-6">
        {/* Contact cadence */}
        <div className="flex flex-wrap items-center gap-4 rounded-lg border p-3 text-xs">
          <div>
            <p className="text-muted-foreground">Last contacted</p>
            <p className="font-medium text-heading">{fmt(crmState.lastContactedAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Next contact</p>
            <p className="font-medium text-heading">{fmt(crmState.nextContactAt)}</p>
          </div>
          <form action={markVenueContactedAction.bind(null, venueId)}>
            <Button type="submit" variant="outline" size="sm">Mark contacted today</Button>
          </form>
          <form action={setNextContact.bind(null, venueId)} className="flex items-center gap-2">
            <Input type="date" name="nextContactAt" className="h-7 w-36 text-xs" />
            <Button type="submit" variant="outline" size="sm">Set next contact</Button>
          </form>
        </div>

        {/* Tasks */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Follow-up tasks</p>
          <ul className="space-y-1.5 mb-2">
            {openTasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-heading">{t.title}{t.dueDate && <span className="text-muted-foreground"> · due {fmt(t.dueDate)}</span>}</span>
                <form action={completeVenueTaskAction.bind(null, venueId, t.id)}>
                  <Button type="submit" variant="ghost" size="xs">Complete</Button>
                </form>
              </li>
            ))}
            {openTasks.length === 0 && <li className="text-xs text-muted-foreground/60">No open tasks</li>}
          </ul>
          {doneTasks.length > 0 && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">{doneTasks.length} completed</summary>
              <ul className="mt-1.5 space-y-1">
                {doneTasks.map((t) => <li key={t.id} className="line-through">{t.title}</li>)}
              </ul>
            </details>
          )}
          <form action={addTask.bind(null, venueId)} className="mt-2 flex items-center gap-2">
            <Input name="title" placeholder="New follow-up task…" className="h-7 flex-1 text-xs" required />
            <Input type="date" name="dueDate" className="h-7 w-36 text-xs" />
            <Button type="submit" size="sm">Add</Button>
          </form>
        </div>

        {/* Notes */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Internal notes</p>
          <ul className="space-y-2 mb-2 max-h-64 overflow-y-auto">
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg border p-2 text-xs">
                <p className="text-heading">{n.body}</p>
                <p className="mt-1 text-muted-foreground/70">{n.authorName} · {fmt(n.createdAt)}</p>
              </li>
            ))}
            {notes.length === 0 && <li className="text-xs text-muted-foreground/60">No notes yet</li>}
          </ul>
          <form action={addNote.bind(null, venueId)} className="flex items-start gap-2">
            <Textarea name="body" placeholder="Add a note…" className="text-xs" rows={2} required />
            <Button type="submit" size="sm">Save</Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
