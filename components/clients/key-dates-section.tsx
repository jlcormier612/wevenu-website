"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Calendar, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addKeyDateAction, deleteKeyDateAction } from "@/app/(app)/clients/[id]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KEY_DATE_SUGGESTIONS, daysUntil, formatDate } from "@/lib/clients/constants";
import type { ClientKeyDate, KeyDateInput } from "@/lib/clients/types";
import { cn } from "@/lib/utils";

export function KeyDatesSection({ clientId, initialKeyDates }: { clientId: string; initialKeyDates: ClientKeyDate[] }) {
  const router = useRouter();
  const [keyDates, setKeyDates] = React.useState(initialKeyDates);
  const [label, setLabel] = React.useState("");
  const [date, setDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [showForm, setShowForm] = React.useState(false);
  const [addPending, startAdd] = React.useTransition();

  function handleAdd() {
    if (!label.trim() || !date) return;
    startAdd(async () => {
      const input: KeyDateInput = { label: label.trim(), date, note };
      const result = await addKeyDateAction(clientId, input);
      if (result.ok) {
        setKeyDates((p) => [...p, { id: crypto.randomUUID(), venueId: "", clientId, label: label.trim(), date, note: note.trim() || null, createdAt: new Date().toISOString() }]
          .sort((a, b) => a.date.localeCompare(b.date)));
        setLabel(""); setDate(""); setNote(""); setShowForm(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not add key date.");
      }
    });
  }

  async function handleDelete(kdId: string) {
    setKeyDates((p) => p.filter((k) => k.id !== kdId));
    const result = await deleteKeyDateAction(kdId);
    if (!result.ok) { toast.error("Could not delete key date."); router.refresh(); }
  }

  return (
    <div className="space-y-4">
      {keyDates.length === 0 && !showForm && (
        <p className="text-center text-sm text-muted-foreground py-4">No key dates yet. Add rehearsal, deadlines, and other milestones.</p>
      )}
      {/* Key date list */}
      <div className="space-y-2">
        {keyDates.map((kd) => {
          const days = daysUntil(kd.date);
          const past = days < 0;
          const soon = !past && days <= 7;
          return (
            <div key={kd.id} className="group flex items-start gap-3 rounded-lg border border-border bg-card p-3">
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", past ? "bg-muted text-muted-foreground" : soon ? "bg-warning/15 text-warning-foreground" : "bg-accent/60 text-heading")}>
                <Calendar className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className={cn("text-sm font-medium", past ? "text-muted-foreground line-through" : "text-foreground")}>{kd.label}</p>
                <p className={cn("text-xs", past ? "text-muted-foreground" : soon ? "font-medium text-warning-foreground" : "text-muted-foreground")}>
                  {formatDate(kd.date)}
                  {!past && ` · In ${days} day${days === 1 ? "" : "s"}`}
                  {past && ` · ${Math.abs(days)} days ago`}
                </p>
                {kd.note && <p className="text-xs text-muted-foreground">{kd.note}</p>}
              </div>
              <button type="button" onClick={() => handleDelete(kd.id)}
                className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive" aria-label="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add form */}
      {showForm ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="kd-label" className="text-xs">Label</Label>
              <Input id="kd-label" value={label} onChange={(e) => setLabel(e.target.value)}
                placeholder="Rehearsal Dinner, Final Count Due…" list="kd-suggestions" />
              <datalist id="kd-suggestions">{KEY_DATE_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kd-date" className="text-xs">Date</Label>
              <Input id="kd-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kd-note" className="text-xs">Note <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="kd-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any additional context…" />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setShowForm(false); setLabel(""); setDate(""); setNote(""); }}>Cancel</Button>
            <Button type="button" size="sm" disabled={!label.trim() || !date || addPending} onClick={handleAdd}>
              {addPending ? "Adding…" : "Add date"}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add key date
        </Button>
      )}
    </div>
  );
}
