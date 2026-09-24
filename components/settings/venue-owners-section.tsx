"use client";

import * as React from "react";
import { UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { StaffMember } from "@/lib/team/types";
import {
  inviteTeamMemberAction,
  removeTeamMemberAction,
} from "@/app/(app)/settings/team/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LibraryDeleteConfirmDialog } from "@/components/library/library-delete-confirm-dialog";

/**
 * Business & Brand — Owners.
 * Relocates existing owner invite/remove (venue_staff.is_owner /
 * owner_invite_pending) out of Team invitation. No new auth model.
 */
export function VenueOwnersSection({
  initialOwners,
  actorIsOwner,
}: {
  initialOwners: StaffMember[];
  actorIsOwner: boolean;
}) {
  const [owners, setOwners] = React.useState(initialOwners);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [showAdd, setShowAdd] = React.useState(false);
  const [removing, setRemoving] = React.useState<StaffMember | null>(null);
  const [removePending, setRemovePending] = React.useState(false);

  const acceptedOwners = owners.filter((o) => o.isOwner && o.acceptedAt);
  const pendingOwners = owners.filter((o) => o.ownerInvitePending && !o.acceptedAt);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setBusy(true);
    try {
      // Existing owner invite path — Administrator is the silent day-to-day
      // title used with ownership (same pattern as venue founders / Jennifer).
      const result = await inviteTeamMemberAction({
        name: name.trim(),
        email: email.trim(),
        accessTitle: "administrator",
        isOwner: true,
      });
      if (result.ok) {
        toast.success(`Owner invitation sent to ${email}`);
        setOwners((prev) => [
          ...prev,
          {
            id: result.staffId ?? Math.random().toString(),
            venueId: "",
            userId: null,
            role: "staff",
            name: name.trim(),
            email: email.trim(),
            jobTitle: null,
            isOwner: false,
            isActive: true,
            accessTitle: "administrator",
            titleBasis: "administrator",
            capabilityOverrides: {},
            ownerInvitePending: true,
            inviteToken: null,
            invitedAt: new Date().toISOString(),
            acceptedAt: null,
            lastActiveAt: null,
            createdAt: new Date().toISOString(),
          },
        ]);
        setName("");
        setEmail("");
        setShowAdd(false);
      } else {
        toast.error(result.error ?? "Failed to invite Owner");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveConfirmed() {
    if (!removing) return;
    setRemovePending(true);
    const result = await removeTeamMemberAction(removing.id);
    setRemovePending(false);
    if (result.ok) {
      setOwners((prev) => prev.filter((o) => o.id !== removing.id));
      toast.success(
        removing.acceptedAt
          ? `${removing.name} is no longer an Owner`
          : `Owner invitation to ${removing.name} canceled`,
      );
      setRemoving(null);
    } else {
      toast.error(result.error ?? "Could not remove Owner");
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Owners</CardTitle>
          <CardDescription>
            Who owns this venue? Owners have full access to the venue and its
            account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {acceptedOwners.length === 0 && pendingOwners.length === 0 ? (
            <p className="text-sm text-muted-foreground">No owners on record.</p>
          ) : (
            <ul className="space-y-2">
              {acceptedOwners.map((owner) => (
                <li
                  key={owner.id}
                  className="flex flex-col gap-2 border-b py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{owner.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Owner
                      {owner.email ? ` · ${owner.email}` : ""}
                      {owner.jobTitle ? ` · ${owner.jobTitle}` : ""}
                    </p>
                  </div>
                  {actorIsOwner && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-destructive"
                      onClick={() => setRemoving(owner)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                </li>
              ))}
              {pendingOwners.map((owner) => (
                <li
                  key={owner.id}
                  className="flex flex-col gap-2 border-b py-2.5 opacity-80 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{owner.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Owner invite pending
                      {owner.email ? ` · ${owner.email}` : ""}
                    </p>
                  </div>
                  {actorIsOwner && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setRemoving(owner)}
                    >
                      Cancel invite
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {actorIsOwner && (
            <div className="space-y-3 border-t pt-4">
              {!showAdd ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdd(true)}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add owner
                </Button>
              ) : (
                <form onSubmit={handleAdd} className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    They&apos;ll receive an Owner invitation and get full access
                    once they accept.
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="owner-invite-name" className="text-xs">
                        Full name
                      </Label>
                      <Input
                        id="owner-invite-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jordan Rivera"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="owner-invite-email" className="text-xs">
                        Email address
                      </Label>
                      <Input
                        id="owner-invite-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="jordan@example.com"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" size="sm" disabled={busy}>
                      {busy ? "Sending…" : "Send Owner invitation"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setShowAdd(false);
                        setName("");
                        setEmail("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <LibraryDeleteConfirmDialog
        open={!!removing}
        itemName={removing?.name ?? ""}
        itemLabel={removing?.acceptedAt ? "owner" : "owner invitation"}
        actionVerb={removing?.acceptedAt ? "Remove" : "Cancel"}
        pendingLabel={removing?.acceptedAt ? "Removing…" : "Canceling…"}
        title={
          removing?.acceptedAt ? (
            <>Remove &ldquo;{removing.name}&rdquo; as an Owner?</>
          ) : (
            <>Cancel the Owner invitation to &ldquo;{removing?.name}&rdquo;?</>
          )
        }
        description={
          removing?.acceptedAt
            ? "They'll lose ownership-level control of this venue. The venue must keep at least one Owner."
            : "They won't be able to accept this Owner invitation."
        }
        pending={removePending}
        onConfirm={handleRemoveConfirmed}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}
