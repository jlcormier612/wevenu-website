"use client";

import * as React from "react";
import { UserPlus, Trash2, MoreHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { StaffMember } from "@/lib/team/types";
import {
  ACCESS_TITLE_DESCRIPTIONS,
  ACCESS_TITLE_LABELS,
  ACCESS_TITLES,
  formatAccessBadge,
  summarizeWhatPersonCan,
  type AccessTitle,
  type BasisTitle,
  type CapabilityOverrides,
} from "@/lib/authorization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  inviteTeamMemberAction,
  removeTeamMemberAction,
  updateTeamMemberAccessAction,
} from "@/app/(app)/settings/team/actions";
import { LibraryDeleteConfirmDialog } from "@/components/library/library-delete-confirm-dialog";
import { TeamCapabilityCustomizer } from "@/components/settings/team-capability-customizer";
import Link from "next/link";

interface Props {
  initialMembers: StaffMember[];
  venueId: string;
  actorIsOwner: boolean;
  canInvite: boolean;
  canChangeAccess: boolean;
  canRemove: boolean;
}

const INVITE_TITLES = ACCESS_TITLES.filter((t) => t !== "custom" || true);

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function isOwnerRow(m: StaffMember): boolean {
  return m.isOwner || m.ownerInvitePending;
}

export function TeamRoster({
  initialMembers,
  venueId: _venueId,
  actorIsOwner,
  canInvite,
  canChangeAccess,
  canRemove,
}: Props) {
  const [members, setMembers] = React.useState(initialMembers);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [accessTitle, setAccessTitle] = React.useState<AccessTitle>("coordinator");
  const [titleBasis, setTitleBasis] = React.useState<BasisTitle>("coordinator");
  const [overrides, setOverrides] = React.useState<CapabilityOverrides>({});
  const [showCustomize, setShowCustomize] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [removing, setRemoving] = React.useState<{
    id: string;
    name: string;
    isPending: boolean;
  } | null>(null);
  const [removePending, setRemovePending] = React.useState(false);
  const [editing, setEditing] = React.useState<StaffMember | null>(null);

  const owners = members.filter((m) => isOwnerRow(m) && m.isActive);
  const staffAccepted = members.filter(
    (m) => m.acceptedAt && !isOwnerRow(m) && m.isActive,
  );
  const staffPending = members.filter(
    (m) => !m.acceptedAt && !isOwnerRow(m) && m.isActive,
  );

  const invitePreview = summarizeWhatPersonCan({
    isActive: true,
    isOwner: false,
    accessTitle: accessTitle === "custom" ? "custom" : accessTitle,
    titleBasis: accessTitle === "custom" ? titleBasis : accessTitle,
    overrides,
  });

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setBusy(true);
    try {
      const result = await inviteTeamMemberAction({
        name: name.trim(),
        email: email.trim(),
        accessTitle,
        titleBasis: accessTitle === "custom" ? titleBasis : accessTitle,
        capabilityOverrides: overrides,
        isOwner: false,
      });
      if (result.ok) {
        toast.success(`Invitation sent to ${email}`);
        setName("");
        setEmail("");
        setAccessTitle("coordinator");
        setTitleBasis("coordinator");
        setOverrides({});
        setShowCustomize(false);
        setMembers((prev) => [
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
            accessTitle,
            titleBasis: accessTitle === "custom" ? titleBasis : accessTitle,
            capabilityOverrides: overrides,
            ownerInvitePending: false,
            inviteToken: null,
            invitedAt: new Date().toISOString(),
            acceptedAt: null,
            lastActiveAt: null,
            createdAt: new Date().toISOString(),
          },
        ]);
      } else {
        toast.error(result.error ?? "Failed to send invitation");
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
      setMembers((prev) => prev.filter((m) => m.id !== removing.id));
      toast.success(
        removing.isPending
          ? `Invitation to ${removing.name} canceled`
          : `${removing.name} removed from team`,
      );
      setRemoving(null);
    } else {
      toast.error(result.error ?? "Failed to remove member");
    }
  }

  return (
    <div className="space-y-6">
      {/* Informational owners — managed in Business & Brand */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Owners
        </p>
        <p className="text-sm text-muted-foreground">
          Owners have full access to the venue, including team, settings, billing, and
          account ownership.{" "}
          {actorIsOwner ? (
            <>
              Manage owners in{" "}
              <Link href="/settings/business" className="font-medium text-primary hover:underline">
                Business &amp; Brand
              </Link>
              .
            </>
          ) : null}
        </p>
        {owners.length === 0 ? (
          <p className="text-sm text-muted-foreground">No owners listed.</p>
        ) : (
          <div className="space-y-1">
            {owners.map((member) => (
              <div
                key={member.id}
                className="flex flex-col gap-1 border-b py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{member.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.ownerInvitePending && !member.acceptedAt
                      ? "Owner invite pending"
                      : "Owner"}
                    {member.email ? ` · ${member.email}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Staff */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Team members
        </p>
        <p className="text-sm text-muted-foreground">
          Add people who help run your venue. Choose the access level that fits their
          role, and customize individual permissions when needed.
        </p>

        {staffAccepted.length === 0 && staffPending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team members yet.</p>
        ) : null}

        {staffAccepted.map((member) => (
          <div
            key={member.id}
            className="flex flex-col gap-2 border-b py-2.5 last:border-0 sm:flex-row sm:items-center sm:gap-3"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {initials(member.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{member.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[member.jobTitle, member.email].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-medium">
                {formatAccessBadge(member.accessTitle, false)}
              </span>
              {(canChangeAccess || actorIsOwner || canRemove) && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" />}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(canChangeAccess || actorIsOwner) && (
                      <DropdownMenuItem onClick={() => setEditing(member)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit access
                      </DropdownMenuItem>
                    )}
                    {canRemove && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() =>
                          setRemoving({
                            id: member.id,
                            name: member.name,
                            isPending: false,
                          })
                        }
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Remove
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        ))}
      </div>

      {staffPending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pending invitations
          </p>
          {staffPending.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 border-b py-2 opacity-70 last:border-0"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/50 text-xs font-semibold text-muted-foreground">
                {initials(member.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{member.name}</p>
                {member.email && (
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                )}
              </div>
              <span className="inline-flex items-center rounded bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                Invited
              </span>
              {canRemove && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() =>
                    setRemoving({ id: member.id, name: member.name, isPending: true })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {canInvite && (
        <form onSubmit={handleInvite} className="space-y-4 border-t pt-4">
          <p className="text-sm font-medium">Invite a team member</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="team-name" className="text-xs">
                Full name
              </Label>
              <Input
                id="team-name"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-email" className="text-xs">
                Email address
              </Label>
              <Input
                id="team-email"
                type="email"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="team-access" className="text-xs">
              Access
            </Label>
            <Select
              value={accessTitle}
              onValueChange={(v) => {
                const next = v as AccessTitle;
                setAccessTitle(next);
                setOverrides({});
                if (next !== "custom") setTitleBasis(next as BasisTitle);
              }}
              items={Object.fromEntries(
                INVITE_TITLES.map((t) => [t, ACCESS_TITLE_LABELS[t]]),
              )}
            >
              <SelectTrigger id="team-access">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITE_TITLES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ACCESS_TITLE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {ACCESS_TITLE_DESCRIPTIONS[accessTitle]}
            </p>
          </div>

          {accessTitle === "custom" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Start from</Label>
              <Select
                value={titleBasis}
                onValueChange={(v) => {
                  setTitleBasis(v as BasisTitle);
                  setOverrides({});
                }}
                items={{
                  administrator: "Administrator",
                  manager: "Manager",
                  coordinator: "Coordinator",
                  staff: "Staff",
                  view_only: "View Only",
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    ["administrator", "manager", "coordinator", "staff", "view_only"] as BasisTitle[]
                  ).map((t) => (
                    <SelectItem key={t} value={t}>
                      {ACCESS_TITLE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowCustomize((s) => !s)}
          >
            {showCustomize ? "Hide customize access" : "Customize access"}
          </Button>

          {showCustomize && (
            <TeamCapabilityCustomizer
              accessTitle={accessTitle}
              titleBasis={accessTitle === "custom" ? titleBasis : (accessTitle as BasisTitle)}
              overrides={overrides}
              onChange={setOverrides}
              actorIsOwner={actorIsOwner}
            />
          )}

          {invitePreview.length > 0 && (
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">
                This person can… ({ACCESS_TITLE_LABELS[accessTitle]})
              </p>
              <ul className="list-inside list-disc text-sm">
                {invitePreview.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <Button type="submit" size="sm" disabled={busy}>
            <UserPlus className="mr-2 h-4 w-4" />
            {busy ? "Sending…" : "Send Invitation"}
          </Button>
        </form>
      )}

      {editing && (
        <TeamMemberEditDialog
          member={editing}
          actorIsOwner={actorIsOwner}
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onSaved={(updated) => {
            setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            setEditing(null);
          }}
        />
      )}

      <LibraryDeleteConfirmDialog
        open={!!removing}
        itemName={removing?.name ?? ""}
        itemLabel={removing?.isPending ? "invitation" : "team member"}
        actionVerb={removing?.isPending ? "Cancel" : "Remove"}
        pendingLabel={removing?.isPending ? "Canceling…" : "Removing…"}
        title={
          removing?.isPending ? (
            <>Cancel the invitation to &ldquo;{removing.name}&rdquo;?</>
          ) : (
            <>Remove &ldquo;{removing?.name}&rdquo; from the team?</>
          )
        }
        description={
          removing?.isPending
            ? "They won't be able to accept this invitation. You can invite them again anytime."
            : "They'll immediately lose access to this venue's workspace. You can invite them back anytime — this doesn't delete their history or activity on past events."
        }
        pending={removePending}
        onConfirm={handleRemoveConfirmed}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}

function TeamMemberEditDialog({
  member,
  actorIsOwner,
  open,
  onOpenChange,
  onSaved,
}: {
  member: StaffMember;
  actorIsOwner: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (m: StaffMember) => void;
}) {
  const [accessTitle, setAccessTitle] = React.useState<AccessTitle>(member.accessTitle);
  const [titleBasis, setTitleBasis] = React.useState<BasisTitle>(
    member.titleBasis ??
      (member.accessTitle === "custom" ? "manager" : (member.accessTitle as BasisTitle)),
  );
  const [overrides, setOverrides] = React.useState<CapabilityOverrides>(member.capabilityOverrides);
  const [jobTitle, setJobTitle] = React.useState(member.jobTitle ?? "");
  const [showCustomize, setShowCustomize] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const preview = summarizeWhatPersonCan({
    isActive: true,
    isOwner: false,
    accessTitle,
    titleBasis: accessTitle === "custom" ? titleBasis : accessTitle,
    overrides,
  });

  async function handleSave() {
    setBusy(true);
    try {
      const result = await updateTeamMemberAccessAction(member.id, {
        accessTitle,
        titleBasis: accessTitle === "custom" ? titleBasis : accessTitle,
        capabilityOverrides: overrides,
        jobTitle: jobTitle.trim() || null,
        // Ownership is not edited here — Business & Brand owns that.
      });
      if (result.ok) {
        toast.success("Access updated");
        onSaved({
          ...member,
          accessTitle,
          titleBasis: accessTitle === "custom" ? titleBasis : accessTitle,
          capabilityOverrides: overrides,
          jobTitle: jobTitle.trim() || null,
        });
      } else {
        toast.error(result.error ?? "Failed to update access");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit access — {member.name}</DialogTitle>
          <DialogDescription>
            Change what they can do day to day. Ownership is managed in Business &amp; Brand.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Job title</Label>
            <Input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="General Manager"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Access</Label>
            <Select
              value={accessTitle}
              onValueChange={(v) => {
                const next = v as AccessTitle;
                setAccessTitle(next);
                setOverrides({});
                if (next !== "custom") setTitleBasis(next as BasisTitle);
              }}
              items={Object.fromEntries(ACCESS_TITLES.map((t) => [t, ACCESS_TITLE_LABELS[t]]))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCESS_TITLES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ACCESS_TITLE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {ACCESS_TITLE_DESCRIPTIONS[accessTitle]}
            </p>
          </div>

          {accessTitle === "custom" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Start from</Label>
              <Select
                value={titleBasis}
                onValueChange={(v) => {
                  setTitleBasis(v as BasisTitle);
                  setOverrides({});
                }}
                items={{
                  administrator: "Administrator",
                  manager: "Manager",
                  coordinator: "Coordinator",
                  staff: "Staff",
                  view_only: "View Only",
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    ["administrator", "manager", "coordinator", "staff", "view_only"] as BasisTitle[]
                  ).map((t) => (
                    <SelectItem key={t} value={t}>
                      {ACCESS_TITLE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowCustomize((s) => !s)}
          >
            {showCustomize ? "Hide customize access" : "Customize access"}
          </Button>

          {showCustomize && (
            <TeamCapabilityCustomizer
              accessTitle={accessTitle}
              titleBasis={accessTitle === "custom" ? titleBasis : (accessTitle as BasisTitle)}
              overrides={overrides}
              onChange={setOverrides}
              actorIsOwner={actorIsOwner}
            />
          )}

          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="mb-1 text-xs font-semibold text-muted-foreground">
              This person can… ({ACCESS_TITLE_LABELS[accessTitle]})
            </p>
            <ul className="list-inside list-disc text-sm">
              {preview.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? "Saving…" : "Save access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
