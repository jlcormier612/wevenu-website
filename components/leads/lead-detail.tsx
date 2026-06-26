"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  DollarSign,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  addNoteAction,
  addTaskAction,
  deleteNoteAction,
  deleteTaskAction,
  setTaskCompletedAction,
  updateLeadStatusAction,
} from "@/app/(app)/leads/[id]/actions";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  LEAD_STATUSES,
  eventTypeLabel,
  formatCurrency,
  formatDate,
  leadDisplayName,
  sourceLabel,
} from "@/lib/leads/constants";
import type { LeadWithDetails } from "@/lib/leads/types";

// ---- contact + inquiry overview ---------------------------------------------

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

// ---- notes section ----------------------------------------------------------

function NotesSection({
  leadId,
  initialNotes,
}: {
  leadId: string;
  initialNotes: LeadWithDetails["notes"];
}) {
  const router = useRouter();
  const [notes, setNotes] = React.useState(initialNotes);
  const [body, setBody] = React.useState("");
  const [addPending, startAdd] = React.useTransition();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function handleAdd() {
    if (!body.trim()) return;
    startAdd(async () => {
      const result = await addNoteAction(leadId, body);
      if (result.ok) {
        setBody("");
        router.refresh();
        // optimistic: add immediately
        setNotes((prev) => [
          {
            id: crypto.randomUUID(),
            venueId: "",
            leadId,
            body: body.trim(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      } else {
        toast.error(result.message ?? "Could not add note.");
      }
    });
  }

  async function handleDelete(noteId: string) {
    setDeletingId(noteId);
    const result = await deleteNoteAction(noteId);
    setDeletingId(null);
    if (result.ok) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      router.refresh();
    } else {
      toast.error(result.message ?? "Could not delete note.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Add note */}
      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note…"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd();
          }}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={!body.trim() || addPending}
            onClick={handleAdd}
          >
            {addPending ? "Saving…" : "Add note"}
          </Button>
        </div>
      </div>

      {notes.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No notes yet. Add one above.
        </p>
      )}

      <div className="space-y-3">
        {notes.map((note) => (
          <div
            key={note.id}
            className="group relative rounded-lg border border-border bg-card p-4"
          >
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {note.body}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {new Date(note.createdAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
              <button
                type="button"
                onClick={() => handleDelete(note.id)}
                disabled={deletingId === note.id}
                className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                aria-label="Delete note"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- tasks section ----------------------------------------------------------

function TasksSection({
  leadId,
  initialTasks,
}: {
  leadId: string;
  initialTasks: LeadWithDetails["tasks"];
}) {
  const router = useRouter();
  const [tasks, setTasks] = React.useState(initialTasks);
  const [title, setTitle] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [addPending, startAdd] = React.useTransition();

  async function handleAdd() {
    if (!title.trim()) return;
    startAdd(async () => {
      const result = await addTaskAction(leadId, { title, dueDate });
      if (result.ok) {
        setTitle("");
        setDueDate("");
        router.refresh();
        setTasks((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            venueId: "",
            leadId,
            title: title.trim(),
            dueDate: dueDate || null,
            completed: false,
            completedAt: null,
            createdAt: new Date().toISOString(),
          },
        ]);
      } else {
        toast.error(result.message ?? "Could not add task.");
      }
    });
  }

  async function handleToggle(taskId: string, completed: boolean) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !completed } : t)),
    );
    const result = await setTaskCompletedAction(taskId, !completed);
    if (!result.ok) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, completed } : t)),
      );
      toast.error(result.message ?? "Could not update task.");
    } else {
      router.refresh();
    }
  }

  async function handleDelete(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    const result = await deleteTaskAction(taskId);
    if (!result.ok) {
      router.refresh();
      toast.error(result.message ?? "Could not delete task.");
    }
  }

  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  return (
    <div className="space-y-4">
      {/* Add task */}
      <div className="flex items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task…"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1"
        />
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-36 shrink-0"
        />
        <Button
          type="button"
          size="icon"
          disabled={!title.trim() || addPending}
          onClick={handleAdd}
          aria-label="Add task"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {tasks.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No tasks yet. Add one above.
        </p>
      )}

      {/* Open tasks */}
      {open.length > 0 && (
        <div className="space-y-1.5">
          {open.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Completed tasks */}
      {done.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Completed
          </p>
          {done.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: LeadWithDetails["tasks"][number];
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      <button
        type="button"
        onClick={() => onToggle(task.id, task.completed)}
        aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
          task.completed
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border hover:border-primary"
        }`}
      >
        {task.completed && <Check className="h-3 w-3" />}
      </button>
      <span
        className={`flex-1 text-sm ${task.completed ? "text-muted-foreground line-through" : "text-foreground"}`}
      >
        {task.title}
      </span>
      {task.dueDate && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {formatDate(task.dueDate)}
        </span>
      )}
      <button
        type="button"
        onClick={() => onDelete(task.id)}
        aria-label="Delete task"
        className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---- timeline placeholder ---------------------------------------------------

function TimelinePlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <MessageSquare className="h-5 w-5" />
      </span>
      <p className="font-heading text-base font-medium text-heading">
        Conversation timeline
      </p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Email threads, SMS, and call logs will appear here once messaging is
        connected in a future sprint.
      </p>
    </div>
  );
}

// ---- main component ---------------------------------------------------------

export function LeadDetail({ lead }: { lead: LeadWithDetails }) {
  const router = useRouter();
  const [statusPending, startStatus] = React.useTransition();

  const displayName = leadDisplayName(
    lead.firstName,
    lead.lastName,
    lead.partnerFirstName,
    lead.partnerLastName,
  );

  function handleStatusChange(status: string) {
    startStatus(async () => {
      const result = await updateLeadStatusAction(lead.id, status);
      if (result.ok) {
        toast.success("Status updated.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not update status.");
      }
    });
  }

  const openTaskCount = lead.tasks.filter((t) => !t.completed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 text-muted-foreground"
            render={<Link href="/leads" />}
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Leads
          </Button>
          <h1 className="font-heading text-2xl font-medium text-heading">
            {displayName}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {lead.eventType && (
              <span>{eventTypeLabel(lead.eventType)}</span>
            )}
            {lead.eventDate && (
              <>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(lead.eventDate)}
                </span>
              </>
            )}
            {lead.guestCount != null && (
              <>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {lead.guestCount.toLocaleString()} guests
                </span>
              </>
            )}
            {lead.estimatedBudget != null && (
              <>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  {formatCurrency(lead.estimatedBudget)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Status badge + change */}
        <div className="flex shrink-0 items-center gap-2">
          <LeadStatusBadge status={lead.status} />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={statusPending}
                />
              }
            >
              Change status
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {LEAD_STATUSES.map((s) => (
                <DropdownMenuItem
                  key={s.value}
                  disabled={s.value === lead.status}
                  onClick={() => handleStatusChange(s.value)}
                >
                  {s.label}
                  <span className="ml-auto pl-4 text-xs text-muted-foreground">
                    {s.description}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="notes">
            Notes
            {lead.notes.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {lead.notes.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="tasks">
            Tasks
            {openTaskCount > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {openTaskCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* ── Overview ─────────────────────────────────────────────── */}
        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow icon={Mail} label="Email" value={lead.email} />
                <InfoRow icon={Phone} label="Phone" value={lead.phone} />
                {(lead.partnerFirstName || lead.partnerLastName) && (
                  <>
                    <Separator />
                    <p className="text-xs font-medium text-muted-foreground">Partner</p>
                    <InfoRow
                      icon={Mail}
                      label={[lead.partnerFirstName, lead.partnerLastName].filter(Boolean).join(" ")}
                      value={lead.partnerEmail ?? undefined}
                    />
                    {!lead.partnerEmail && (
                      <p className="text-sm text-muted-foreground">
                        {[lead.partnerFirstName, lead.partnerLastName].filter(Boolean).join(" ")}
                      </p>
                    )}
                  </>
                )}
                {!lead.email && !lead.phone && !lead.partnerFirstName && (
                  <p className="text-sm text-muted-foreground">No contact details recorded.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Inquiry details</CardTitle>
                <CardDescription>
                  Received {formatDate(lead.inquiryDate)}
                  {lead.source && <> via {sourceLabel(lead.source)}</>}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow icon={Calendar} label="Event type" value={eventTypeLabel(lead.eventType)} />
                <InfoRow icon={Clock} label="Event date" value={formatDate(lead.eventDate)} />
                <InfoRow
                  icon={Users}
                  label="Guest count"
                  value={lead.guestCount != null ? `${lead.guestCount.toLocaleString()} guests` : undefined}
                />
                <InfoRow
                  icon={DollarSign}
                  label="Estimated budget"
                  value={formatCurrency(lead.estimatedBudget) || undefined}
                />
                {lead.inquiryMessage && (
                  <>
                    <Separator />
                    <div>
                      <Label className="mb-1 text-xs text-muted-foreground">Message</Label>
                      <p className="whitespace-pre-wrap text-sm text-foreground">
                        {lead.inquiryMessage}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Notes ─────────────────────────────────────────────────── */}
        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
              <CardDescription>
                Internal notes about this lead. Not visible to the client.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotesSection leadId={lead.id} initialNotes={lead.notes} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tasks ─────────────────────────────────────────────────── */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tasks</CardTitle>
              <CardDescription>
                Action items for this lead. Press Enter or ⌘↵ to save.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TasksSection leadId={lead.id} initialTasks={lead.tasks} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Timeline ──────────────────────────────────────────────── */}
        <TabsContent value="timeline">
          <TimelinePlaceholder />
        </TabsContent>
      </Tabs>
    </div>
  );
}
