"use client";

/**
 * Additional event staff — compact selector of internal venue team members.
 * Persists via existing event_team rows (full_name). Legacy free-text rows
 * remain visible and removable; new adds come only from venue staff.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";

import { addTeamMemberAction, removeTeamMemberAction } from "@/app/(app)/events/[id]/actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  filterEligibleAdditionalStaff,
  staffNamesMatch,
  type AdditionalStaffOption,
} from "@/lib/events/additional-team-eligibility";
import { useSyncedState } from "@/lib/hooks/use-synced-state";
import type { EventTeamMember } from "@/lib/events/types";

export type VenueStaffOption = AdditionalStaffOption;

export function EventTeamSection({
  eventId,
  initialTeam,
  staffOptions = [],
  ownerStaffId = null,
  density = "regular",
}: {
  eventId: string;
  initialTeam: EventTeamMember[];
  /** Eligible internal venue members for the compact selector. */
  staffOptions?: VenueStaffOption[];
  /** Event owner staff id — excluded from additional-member options. */
  ownerStaffId?: string | null;
  density?: "regular" | "compact";
}) {
  const router = useRouter();
  const [team, setTeam] = useSyncedState(initialTeam);
  const [addPending, startAdd] = React.useTransition();
  const [addSelectKey, setAddSelectKey] = React.useState(0);
  const compact = density === "compact";

  const eligibleToAdd = filterEligibleAdditionalStaff(
    staffOptions,
    team.map((m) => m.fullName),
    ownerStaffId,
  );

  function handleAddStaff(staffId: string) {
    const member = staffOptions.find((s) => s.id === staffId);
    if (!member) return;
    if (ownerStaffId && staffId === ownerStaffId) {
      toast.error("That person is already the Event owner.");
      return;
    }
    if (team.some((m) => staffNamesMatch(m.fullName, member.name))) {
      toast.error("That team member is already on this event.");
      return;
    }
    startAdd(async () => {
      const result = await addTeamMemberAction(eventId, {
        fullName: member.name,
        role: "",
        phone: "",
      });
      setAddSelectKey((k) => k + 1);
      if (result.ok) {
        toast.success(`${member.name} added.`);
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not add team member.");
      }
    });
  }

  async function handleRemove(memberId: string, memberName: string) {
    setTeam((p) => p.filter((m) => m.id !== memberId));
    const result = await removeTeamMemberAction(memberId, memberName, eventId);
    if (!result.ok) {
      toast.error("Could not remove team member.");
      router.refresh();
    } else {
      toast.success(`${memberName} removed.`);
      router.refresh();
    }
  }

  if (compact) {
    return (
      <div
        className="flex min-w-0 flex-wrap items-center gap-2"
        data-testid="event-team-section"
        data-density="compact"
      >
        <span className="shrink-0 text-xs font-medium text-muted-foreground">Additional team members</span>
        {team.map((member) => (
          <span
            key={member.id}
            className="inline-flex max-w-[11rem] items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-xs text-foreground"
            data-testid="event-team-member"
            title={member.role ? `${member.fullName} · ${member.role}` : member.fullName}
          >
            <span className="truncate">{member.fullName}</span>
            <button
              type="button"
              onClick={() => handleRemove(member.id, member.fullName)}
              className="shrink-0 text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${member.fullName}`}
              data-testid="event-team-member-remove"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Select
          key={addSelectKey}
          onValueChange={(v) => {
            if (typeof v === "string" && v) handleAddStaff(v);
          }}
          items={eligibleToAdd.map((s) => ({ value: s.id, label: s.name }))}
          disabled={addPending || eligibleToAdd.length === 0}
        >
          <SelectTrigger
            className="h-8 w-[11rem] max-w-full sm:w-44"
            aria-label="Add additional team member"
            data-testid="event-team-add-select"
          >
            <SelectValue placeholder={eligibleToAdd.length === 0 ? "All members added" : "Select team members…"} />
          </SelectTrigger>
          <SelectContent>
            {eligibleToAdd.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {addPending ? <span className="text-xs text-muted-foreground">Adding…</span> : null}
      </div>
    );
  }

  // Non-compact: same internal selector, taller list presentation.
  return (
    <div className="space-y-2" data-testid="event-team-section">
      {team.length === 0 ? (
        <p className="text-sm text-muted-foreground">No additional staff assigned.</p>
      ) : (
        <div className="space-y-1.5">
          {team.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5"
              data-testid="event-team-member"
            >
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{member.fullName}</p>
              <button
                type="button"
                onClick={() => handleRemove(member.id, member.fullName)}
                className="text-xs text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${member.fullName}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      <Select
        key={addSelectKey}
        onValueChange={(v) => {
          if (typeof v === "string" && v) handleAddStaff(v);
        }}
        items={eligibleToAdd.map((s) => ({ value: s.id, label: s.name }))}
        disabled={addPending || eligibleToAdd.length === 0}
      >
        <SelectTrigger className="h-8 w-56" data-testid="event-team-add-select">
          <SelectValue placeholder="Select team members…" />
        </SelectTrigger>
        <SelectContent>
          {eligibleToAdd.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
