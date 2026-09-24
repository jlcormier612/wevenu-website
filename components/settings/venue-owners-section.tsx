"use client";

import * as React from "react";
import { UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { StaffMember } from "@/lib/team/types";
import {
  inviteTeamMemberAction,
  inviteRecordedOwnerAction,
  recordOwnerMemberAction,
  removeTeamMemberAction,
} from "@/app/(app)/settings/team/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LibraryDeleteConfirmDialog } from "@/components/library/library-delete-confirm-dialog";

type OwnerAccessChoice = "record_only" | "invite_now";

function ownerStatusLabel(
  owner: StaffMember,
  actorStaffId: string | null,
): { line: string; isYou: boolean } {
  if (owner.acceptedAt) {
    const isYou = !!actorStaffId && owner.id === actorStaffId;
    return { line: isYou ? "You" : "Owner", isYou };
  }
  if (owner.ownerInvitePending) {
    return { line: "Invitation sent", isYou: false };
  }
  if (owner.isOwner) {
    return { line: "Owner access not yet invited", isYou: false };
  }
  return { line: "Owner", isYou: false };
}

/**
 * Business & Brand — Owners.
 * Ownership and invitation are separate decisions on the same venue_staff
 * model (is_owner / owner_invite_pending).
 */
export function VenueOwnersSection({
  initialOwners,
  actorIsOwner,
  actorStaffId = null,
}: {
  initialOwners: StaffMember[];
  actorIsOwner: boolean;
  actorStaffId?: string | null;
}) {
  const [owners, setOwners] = React.useState(initialOwners);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [accessChoice, setAccessChoice] = React.useState<OwnerAccessChoice>("record_only");
  const [busy, setBusy] = React.useState(false);
  const [invitingId, setInvitingId] = React.useState<string | null>(null);
  const [showAdd, setShowAdd] = React.useState(false);
  const [removing, setRemoving] = React.useState<StaffMember | null>(null);
  const [removePending, setRemovePending] = React.useState(false);

  const listedOwners = owners.filter(
    (o) => o.isActive && (o.isOwner || o.ownerInvitePending),
  );

  function resetForm() {
    setName("");
    setEmail("");
    setAccessChoice("record_only");
    setShowAdd(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setBusy(true);
    try {
      if (accessChoice === "record_only") {
        const result = await recordOwnerMemberAction({
          name: name.trim(),
          email: email.trim(),
        });
        if (result.ok) {
          toast.success(`Owner recorded${email ? ` · ${email.trim()}` : ""}`);
          setOwners((prev) => {
            if (result.staffId && prev.some((p) => p.id === result.staffId)) {
              return prev.map((p) =>
                p.id === result.staffId
                  ? { ...p, isOwner: true, ownerInvitePending: false }
                  : p,
              );
            }
            return [
              ...prev,
              {
                id: result.staffId ?? Math.random().toString(),
                venueId: "",
                userId: null,
                role: "staff",
                name: name.trim(),
                email: email.trim().toLowerCase(),
                jobTitle: null,
                isOwner: true,
                isActive: true,
                accessTitle: "administrator",
                titleBasis: "administrator",
                capabilityOverrides: {},
                ownerInvitePending: false,
                inviteToken: null,
                invitedAt: null,
                acceptedAt: null,
                lastActiveAt: null,
                createdAt: new Date().toISOString(),
              },
            ];
          });
          resetForm();
        } else {
          toast.error(result.error ?? "Could not record Owner");
        }
      } else {
        const result = await inviteTeamMemberAction({
          name: name.trim(),
          email: email.trim(),
          accessTitle: "administrator",
          isOwner: true,
        });
        if (result.ok) {
          toast.success(`Owner invitation sent to ${email.trim()}`);
          setOwners((prev) => {
            if (result.staffId && prev.some((p) => p.id === result.staffId)) {
              return prev.map((p) =>
                p.id === result.staffId
                  ? {
                      ...p,
                      isOwner: p.acceptedAt ? true : p.isOwner,
                      ownerInvitePending: !p.acceptedAt,
                    }
                  : p,
              );
            }
            return [
              ...prev,
              {
                id: result.staffId ?? Math.random().toString(),
                venueId: "",
                userId: null,
                role: "staff",
                name: name.trim(),
                email: email.trim().toLowerCase(),
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
            ];
          });
          resetForm();
        } else {
          toast.error(result.error ?? "Could not invite Owner");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleInviteLater(owner: StaffMember) {
    setInvitingId(owner.id);
    const result = await inviteRecordedOwnerAction(owner.id);
    setInvitingId(null);
    if (result.ok) {
      toast.success(`Invitation sent to ${owner.email ?? owner.name}`);
      setOwners((prev) =>
        prev.map((p) =>
          p.id === owner.id
            ? {
                ...p,
                ownerInvitePending: true,
                invitedAt: new Date().toISOString(),
              }
            : p,
        ),
      );
    } else {
      toast.error(result.error ?? "Could not send invitation");
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
          : removing.ownerInvitePending
            ? `Invitation to ${removing.name} canceled`
            : `${removing.name} removed as Owner`,
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
            account. You can add owners who already use Hello to Cheers or record
            another owner and invite them when you&apos;re ready.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {listedOwners.length === 0 ? (
            <p className="text-sm text-muted-foreground">No owners on record.</p>
          ) : (
            <ul className="space-y-2">
              {listedOwners.map((owner) => {
                const status = ownerStatusLabel(owner, actorStaffId);
                const canInviteLater =
                  actorIsOwner &&
                  owner.isOwner &&
                  !owner.acceptedAt &&
                  !owner.ownerInvitePending;
                const canCancelInvite =
                  actorIsOwner && owner.ownerInvitePending && !owner.acceptedAt;
                const canRemove =
                  actorIsOwner &&
                  (owner.acceptedAt ||
                    (owner.isOwner && !owner.ownerInvitePending) ||
                    owner.ownerInvitePending);

                return (
                  <li
                    key={owner.id}
                    className="flex flex-col gap-2 border-b py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{owner.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Owner{owner.email ? ` · ${owner.email}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">{status.line}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {canInviteLater && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={invitingId === owner.id}
                          onClick={() => handleInviteLater(owner)}
                        >
                          {invitingId === owner.id ? "Sending…" : "Invite"}
                        </Button>
                      )}
                      {canCancelInvite && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setRemoving(owner)}
                        >
                          Cancel invite
                        </Button>
                      )}
                      {canRemove && !canCancelInvite && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setRemoving(owner)}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
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
                <form onSubmit={handleAdd} className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="owner-name" className="text-xs">
                        Full name
                      </Label>
                      <Input
                        id="owner-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jordan Rivera"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="owner-email" className="text-xs">
                        Email address
                      </Label>
                      <Input
                        id="owner-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="jordan@example.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-heading">
                      How should this owner access Hello to Cheers?
                    </p>
                    <RadioGroup
                      value={accessChoice}
                      onValueChange={(v) => setAccessChoice(v as OwnerAccessChoice)}
                      className="gap-3"
                    >
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-3">
                        <RadioGroupItem value="record_only" className="mt-0.5" />
                        <span>
                          <span className="block text-sm font-medium text-heading">
                            Add owner only
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Record them as an owner without sending an invitation.
                          </span>
                        </span>
                      </label>
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-3">
                        <RadioGroupItem value="invite_now" className="mt-0.5" />
                        <span>
                          <span className="block text-sm font-medium text-heading">
                            Invite owner now
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Send them an invitation to access Hello to Cheers.
                          </span>
                        </span>
                      </label>
                    </RadioGroup>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" size="sm" disabled={busy}>
                      {busy
                        ? accessChoice === "invite_now"
                          ? "Sending…"
                          : "Saving…"
                        : accessChoice === "invite_now"
                          ? "Invite owner"
                          : "Add owner"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={resetForm}
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
        itemLabel={
          removing?.acceptedAt
            ? "owner"
            : removing?.ownerInvitePending
              ? "owner invitation"
              : "owner"
        }
        actionVerb={removing?.ownerInvitePending && !removing?.acceptedAt ? "Cancel" : "Remove"}
        pendingLabel={
          removing?.ownerInvitePending && !removing?.acceptedAt ? "Canceling…" : "Removing…"
        }
        title={
          removing?.ownerInvitePending && !removing?.acceptedAt ? (
            <>Cancel the invitation to &ldquo;{removing?.name}&rdquo;?</>
          ) : (
            <>Remove &ldquo;{removing?.name}&rdquo; as an Owner?</>
          )
        }
        description={
          removing?.ownerInvitePending && !removing?.acceptedAt
            ? "They won't be able to accept this invitation. You can record or invite them again later."
            : removing?.acceptedAt
              ? "They'll lose ownership-level control of this venue. The venue must keep at least one Owner."
              : "They'll be removed from the Owners list. You can add them again later."
        }
        pending={removePending}
        onConfirm={handleRemoveConfirmed}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}
