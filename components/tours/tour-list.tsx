"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { TourAppointment } from "@/lib/tours/types";

const STATUS_LABELS: Record<TourAppointment["status"], string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show:   "No Show",
};

const STATUS_COLORS: Record<TourAppointment["status"], string> = {
  scheduled: "amber",
  confirmed: "green",
  completed: "sage",
  cancelled: "muted",
  no_show:   "red",
};

function TourRow({ appt, onStatusChange }: { appt: TourAppointment; onStatusChange: (id: string, status: TourAppointment["status"]) => void }) {
  const [updating, setUpdating] = React.useState(false);
  const d = new Date(appt.scheduledAt);

  async function handleStatus(newStatus: string) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/tours/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appointmentId: appt.id, status: newStatus }),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (data.ok) { onStatusChange(appt.id, newStatus as TourAppointment["status"]); toast.success("Status updated."); }
      else toast.error(data.error ?? "Could not update status.");
    } catch { toast.error("Could not update status."); }
    finally { setUpdating(false); }
  }

  return (
    <div className="flex items-start gap-3 py-4 border-b border-border/50 last:border-0">
      {/* Date block */}
      <div className="shrink-0 w-12 text-center">
        <p className="text-lg font-bold text-heading leading-none">{d.getDate()}</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{d.toLocaleDateString("en-US", { month: "short" })}</p>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-heading truncate">{appt.contactName ?? "Unknown"}</p>
          <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_COLORS[appt.status] === "amber" ? "border-amber-300 text-amber-700 bg-amber-50" : STATUS_COLORS[appt.status] === "green" ? "border-green-300 text-green-700 bg-green-50" : "border-border text-muted-foreground"}`}>
            {STATUS_LABELS[appt.status]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {appt.durationMinutes} min
          {appt.eventType && ` · ${appt.eventType}`}
        </p>
        {appt.contactEmail && <p className="text-xs text-muted-foreground">{appt.contactEmail}</p>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {updating ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Select value={appt.status} onValueChange={handleStatus}>
            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="no_show">No Show</SelectItem>
            </SelectContent>
          </Select>
        )}
        {appt.leadId && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" render={<Link href={`/leads/${appt.leadId}`} />}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function TourList({ appointments }: { appointments: TourAppointment[] }) {
  const router = useRouter();
  const [appts, setAppts] = React.useState(appointments);

  function handleStatusChange(id: string, status: TourAppointment["status"]) {
    setAppts((p) => p.map((a) => a.id === id ? { ...a, status } : a));
    router.refresh();
  }

  return (
    <div className="divide-y divide-border/50">
      {appts.map((appt) => (
        <TourRow key={appt.id} appt={appt} onStatusChange={handleStatusChange} />
      ))}
    </div>
  );
}
