"use client";

/**
 * Post-booking schedule correction. Uses replace_event_space_assignments —
 * does not amend contracts, invoices, or booking status.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { saveEventSpaceAssignmentsAction } from "@/app/(app)/events/[id]/actions";
import { EventSpaceAssignmentsEditor } from "@/components/events/event-space-assignments-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { VenueSpace } from "@/lib/availability/types";
import {
  intraEventSpaceOverlapError,
  materializeMissingScheduledDates,
  type EventSpaceAssignmentInput,
} from "@/lib/venue-spaces/assignments";
import { relevantUsesForExperience } from "@/lib/venue-spaces/relevant-uses";
import { resolveExperienceProfile } from "@/lib/event-experience";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  clientId?: string | null;
  eventType: string | null;
  eventDate: string;
  eventEndDate: string | null;
  spaces: VenueSpace[];
  assignments: EventSpaceAssignmentInput[];
};

export function EditBookingScheduleDialog({
  open,
  onOpenChange,
  eventId,
  clientId,
  eventType,
  eventDate,
  eventEndDate,
  spaces,
  assignments,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<EventSpaceAssignmentInput[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const saveInFlight = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;
    const { next } = materializeMissingScheduledDates(assignments, eventDate);
    setDraft(next);
    setError(null);
  }, [open, assignments, eventDate]);

  const experience = resolveExperienceProfile(eventType);
  const uses = relevantUsesForExperience(spaces, experience);

  async function save() {
    if (saveInFlight.current || saving) return;
    setError(null);
    const intra = intraEventSpaceOverlapError(draft);
    if (intra) {
      setError(intra);
      toast.error(intra);
      return;
    }
    saveInFlight.current = true;
    setSaving(true);
    try {
      const result = await saveEventSpaceAssignmentsAction(eventId, draft, clientId);
      if (!result.ok) {
        // Keep dialog + draft so the user can retry.
        setError(result.message ?? "Could not save the schedule.");
        toast.error(result.message ?? "Could not save the schedule.");
        return;
      }
      if (result.timelineWarning) {
        toast.warning(result.timelineWarning);
        onOpenChange(false);
        router.refresh();
        return;
      }
      // Honest success only after persistence; refresh does not block the spinner.
      toast.success("Schedule updated.");
      onOpenChange(false);
      router.refresh();
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="edit-booking-schedule-dialog">
        <DialogHeader>
          <DialogTitle>Edit schedule</DialogTitle>
          <DialogDescription>
            Correct component dates, times, and spaces. This updates the operational schedule only —
            it does not change a signed contract, invoice, or booking status.
          </DialogDescription>
        </DialogHeader>

        <EventSpaceAssignmentsEditor
          spaces={spaces}
          value={draft}
          onChange={setDraft}
          uses={uses}
          withTimes
          eventDate={eventDate}
          eventEndDate={eventEndDate ?? ""}
        />

        {error ? (
          <p className="text-sm text-destructive" data-testid="edit-schedule-error">{error}</p>
        ) : null}

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={() => void save()} data-testid="edit-schedule-save">
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
