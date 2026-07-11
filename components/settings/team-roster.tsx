"use client";

import * as React from "react";
import { UserPlus, Trash2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { StaffMember, StaffRole } from "@/lib/team/types";
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
  inviteTeamMemberAction,
  removeTeamMemberAction,
  updateTeamMemberRoleAction,
} from "@/app/(app)/settings/team/actions";

interface Props {
  initialMembers: StaffMember[];
  venueId: string;
}

const ROLE_LABELS: Record<StaffRole, string> = {
  owner:       "Owner",
  manager:     "Manager",
  coordinator: "Coordinator",
  staff:       "Staff",
};

const ROLE_BADGE_CLASS: Record<StaffRole, string> = {
  owner:       "bg-gray-900 text-white",
  manager:     "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  coordinator: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  staff:       "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TeamRoster({ initialMembers, venueId: _venueId }: Props) {
  const [members, setMembers] = React.useState(initialMembers);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<StaffRole>("coordinator");
  const [busy, setBusy] = React.useState(false);

  const accepted  = members.filter((m) => m.acceptedAt);
  const pending   = members.filter((m) => !m.acceptedAt);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setBusy(true);
    try {
      const result = await inviteTeamMemberAction({ name: name.trim(), email: email.trim(), role });
      if (result.ok) {
        toast.success(`Invitation sent to ${email}`);
        setName("");
        setEmail("");
        setRole("coordinator");
        // Add optimistic pending row
        setMembers((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            venueId: "",
            userId: null,
            role,
            name: name.trim(),
            email: email.trim(),
            isOwner: false,
            isActive: true,
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

  async function handleRemove(staffId: string, memberName: string) {
    const result = await removeTeamMemberAction(staffId);
    if (result.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== staffId));
      toast.success(`${memberName} removed from team`);
    } else {
      toast.error(result.error ?? "Failed to remove member");
    }
  }

  async function handleRoleChange(staffId: string, newRole: StaffRole) {
    const result = await updateTeamMemberRoleAction(staffId, newRole);
    if (result.ok) {
      setMembers((prev) =>
        prev.map((m) => (m.id === staffId ? { ...m, role: newRole } : m))
      );
    } else {
      toast.error(result.error ?? "Failed to update role");
    }
  }

  return (
    <div className="space-y-6">
      {/* Active members */}
      {accepted.length > 0 && (
        <div className="space-y-2">
          {accepted.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 py-2.5 border-b last:border-0"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {initials(member.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{member.name}</p>
                {member.email && (
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                )}
              </div>
              <span
                className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_CLASS[member.role]}`}
              >
                {ROLE_LABELS[member.role]}
              </span>
              {!member.isOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" />}>
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(["manager", "coordinator", "staff"] as StaffRole[])
                      .filter((r) => r !== member.role)
                      .map((r) => (
                        <DropdownMenuItem
                          key={r}
                          onSelect={() => handleRoleChange(member.id, r)}
                        >
                          Change to {ROLE_LABELS[r]}
                        </DropdownMenuItem>
                      ))}
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => handleRemove(member.id, member.name)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pending invitations */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Pending Invitations
          </p>
          {pending.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 py-2 border-b last:border-0 opacity-70"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/50 text-xs font-semibold text-muted-foreground">
                {initials(member.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{member.name}</p>
                {member.email && (
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                )}
              </div>
              <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                Invited
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => handleRemove(member.id, member.name)}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Invite form */}
      <form onSubmit={handleInvite} className="space-y-4 pt-2 border-t">
        <p className="text-sm font-medium">Invite a team member</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="team-name" className="text-xs">Full name</Label>
            <Input
              id="team-name"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team-email" className="text-xs">Email address</Label>
            <Input
              id="team-email"
              type="email"
              placeholder="jane@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team-role" className="text-xs">Role</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as StaffRole)}
              items={{ manager: "Manager", coordinator: "Coordinator", staff: "Staff" }}
            >
              <SelectTrigger id="team-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="coordinator">Coordinator</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button type="submit" size="sm" disabled={busy}>
          <UserPlus className="mr-2 h-4 w-4" />
          {busy ? "Sending…" : "Send Invitation"}
        </Button>
      </form>
    </div>
  );
}
