"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Phone, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { addTeamMemberAction, removeTeamMemberAction } from "@/app/(app)/events/[id]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSyncedState } from "@/lib/hooks/use-synced-state";
import type { EventTeamMember } from "@/lib/events/types";

export function EventTeamSection({ eventId, initialTeam }: { eventId: string; initialTeam: EventTeamMember[] }) {
  const router = useRouter();
  // See lib/hooks/use-synced-state.ts — keeps this tab's list in sync with
  // server data after a router.refresh() triggered elsewhere on this page,
  // instead of a plain useState silently freezing at its first-mount value.
  const [team, setTeam] = useSyncedState(initialTeam);
  const [showForm, setShowForm] = React.useState(false);
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [addPending, startAdd] = React.useTransition();

  function handleAdd() {
    if (!name.trim()) return;
    startAdd(async () => {
      const result = await addTeamMemberAction(eventId, { fullName: name, role, phone });
      if (result.ok) {
        setTeam((p) => [...p, { id: crypto.randomUUID(), venueId: "", eventId, fullName: name.trim(), role: role.trim() || null, phone: phone.trim() || null, createdAt: new Date().toISOString() }]);
        setName(""); setRole(""); setPhone(""); setShowForm(false); router.refresh();
      } else toast.error(result.message ?? "Could not add team member.");
    });
  }

  async function handleRemove(memberId: string, memberName: string) {
    setTeam((p) => p.filter((m) => m.id !== memberId));
    const result = await removeTeamMemberAction(memberId, memberName, eventId);
    if (!result.ok) { toast.error("Could not remove team member."); router.refresh(); }
  }

  return (
    <div className="space-y-4">
      {team.length === 0 && !showForm && (
        <p className="py-4 text-center text-sm text-muted-foreground">No team members assigned. Add the staff working this event.</p>
      )}
      <div className="space-y-2">
        {team.map((member) => (
          <div key={member.id} className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/60 text-heading">
              <Users className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm font-medium text-foreground">{member.fullName}</p>
              {(member.role || member.phone) && (
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {member.role && <span>{member.role}</span>}
                  {member.role && member.phone && <span>·</span>}
                  {member.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{member.phone}</span>}
                </p>
              )}
            </div>
            <button type="button" onClick={() => handleRemove(member.id, member.fullName)}
              className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive" aria-label="Remove">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {showForm ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tm-name" className="text-xs">Name *</Label>
              <Input id="tm-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Rivera" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tm-role" className="text-xs">Role</Label>
              <Input id="tm-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Event Coordinator, Setup Crew…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tm-phone" className="text-xs">Phone <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="tm-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 000-0000" />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setShowForm(false); setName(""); setRole(""); setPhone(""); }}>Cancel</Button>
            <Button type="button" size="sm" disabled={!name.trim() || addPending} onClick={handleAdd}>
              {addPending ? "Adding…" : "Add member"}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add team member
        </Button>
      )}
    </div>
  );
}
