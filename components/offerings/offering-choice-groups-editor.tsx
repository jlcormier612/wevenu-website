"use client";

/**
 * Catalog choice groups under a parent/major Offering.
 */
import * as React from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addOfferingChoiceGroupMemberAction,
  createOfferingChoiceGroupAction,
  deleteOfferingChoiceGroupAction,
  removeOfferingChoiceGroupMemberAction,
  renameOfferingChoiceGroupAction,
} from "@/app/(app)/library/offerings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  eligibleChildrenNotInGroup,
  groupsForParent,
  type OfferingChoiceGroup,
} from "@/lib/offerings/choice-groups";
import type { OfferingWithCategory } from "@/lib/offerings/types";

type Props = {
  parentOffering: OfferingWithCategory;
  allOfferings: OfferingWithCategory[];
  initialGroups: OfferingChoiceGroup[];
  onGroupsChange?: (groups: OfferingChoiceGroup[]) => void;
};

export function OfferingChoiceGroupsEditor({
  parentOffering,
  allOfferings,
  initialGroups,
  onGroupsChange,
}: Props) {
  const [groups, setGroups] = React.useState(initialGroups);
  const [pending, startTransition] = React.useTransition();
  const [newName, setNewName] = React.useState("");

  React.useEffect(() => {
    setGroups(initialGroups);
  }, [initialGroups, parentOffering.id]);

  const parentGroups = groupsForParent(groups, parentOffering.id);

  function sync(next: OfferingChoiceGroup[]) {
    setGroups(next);
    onGroupsChange?.(next);
  }

  function createGroup() {
    const name = newName.trim();
    if (!name) {
      toast.error("Enter a group name (for example Entrées).");
      return;
    }
    startTransition(async () => {
      const r = await createOfferingChoiceGroupAction(parentOffering.id, name);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      if (r.group) sync([...groups, r.group]);
      setNewName("");
      toast.success(`Created “${name}”`);
    });
  }

  return (
    <div className="space-y-3" data-testid="offering-choice-groups-editor">
      <div>
        <p className="text-sm font-medium text-heading">Choice groups</p>
        <p className="text-xs text-muted-foreground">
          Organize items under {parentOffering.name} into reusable groups (for example Entrées
          or Desserts). Event Order templates can include these groups without retyping names.
        </p>
      </div>

      {parentGroups.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-testid="offering-choice-groups-empty">
          No groups yet. Create one, then assign catalog items that belong under this parent.
        </p>
      ) : null}

      <ul className="space-y-3">
        {parentGroups.map((g) => (
          <ChoiceGroupCard
            key={g.id}
            group={g}
            parentOffering={parentOffering}
            allOfferings={allOfferings}
            pending={pending}
            onRename={(name) => {
              startTransition(async () => {
                const r = await renameOfferingChoiceGroupAction(g.id, name);
                if (!r.ok) {
                  toast.error(r.message);
                  return;
                }
                sync(groups.map((x) => (x.id === g.id ? { ...x, name } : x)));
              });
            }}
            onDelete={() => {
              startTransition(async () => {
                const r = await deleteOfferingChoiceGroupAction(g.id);
                if (!r.ok) {
                  toast.error(r.message);
                  return;
                }
                sync(groups.filter((x) => x.id !== g.id));
              });
            }}
            onAddMember={(offeringId) => {
              startTransition(async () => {
                const r = await addOfferingChoiceGroupMemberAction(g.id, offeringId);
                if (!r.ok) {
                  toast.error(r.message);
                  return;
                }
                sync(
                  groups.map((x) =>
                    x.id === g.id
                      ? {
                          ...x,
                          memberOfferingIds: [...x.memberOfferingIds, offeringId],
                        }
                      : x,
                  ),
                );
              });
            }}
            onRemoveMember={(offeringId) => {
              startTransition(async () => {
                const r = await removeOfferingChoiceGroupMemberAction(g.id, offeringId);
                if (!r.ok) {
                  toast.error(r.message);
                  return;
                }
                sync(
                  groups.map((x) =>
                    x.id === g.id
                      ? {
                          ...x,
                          memberOfferingIds: x.memberOfferingIds.filter((id) => id !== offeringId),
                        }
                      : x,
                  ),
                );
              });
            }}
          />
        ))}
      </ul>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[10rem] flex-1 space-y-1">
          <Label className="text-xs text-muted-foreground">New group name</Label>
          <Input
            value={newName}
            disabled={pending}
            placeholder="e.g. Entrées"
            data-testid="offering-choice-group-new-name"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createGroup();
              }
            }}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          data-testid="offering-choice-group-create"
          onClick={createGroup}
        >
          {pending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
          Add group
        </Button>
      </div>
    </div>
  );
}

function ChoiceGroupCard({
  group,
  parentOffering,
  allOfferings,
  pending,
  onRename,
  onDelete,
  onAddMember,
  onRemoveMember,
}: {
  group: OfferingChoiceGroup;
  parentOffering: OfferingWithCategory;
  allOfferings: OfferingWithCategory[];
  pending: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddMember: (offeringId: string) => void;
  onRemoveMember: (offeringId: string) => void;
}) {
  const [name, setName] = React.useState(group.name);
  const [pick, setPick] = React.useState("");
  const byId = React.useMemo(
    () => new Map(allOfferings.map((o) => [o.id, o])),
    [allOfferings],
  );
  const eligible = eligibleChildrenNotInGroup(allOfferings, parentOffering.id, group);

  React.useEffect(() => {
    setName(group.name);
  }, [group.name]);

  return (
    <li
      className="space-y-2 rounded-md border border-border p-3"
      data-testid={`offering-choice-group-${group.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Input
          value={name}
          disabled={pending}
          className="max-w-xs"
          data-testid={`offering-choice-group-name-${group.id}`}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name.trim() !== group.name) onRename(name.trim());
            else setName(group.name);
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          aria-label={`Delete ${group.name}`}
          data-testid={`offering-choice-group-delete-${group.id}`}
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <ul className="space-y-1">
        {group.memberOfferingIds.map((id) => {
          const o = byId.get(id);
          return (
            <li
              key={id}
              className="flex items-center justify-between gap-2 text-sm"
              data-testid={`offering-choice-group-member-${id}`}
            >
              <span>{o?.name ?? id}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => onRemoveMember(id)}
              >
                Remove
              </Button>
            </li>
          );
        })}
        {group.memberOfferingIds.length === 0 ? (
          <li className="text-xs text-muted-foreground">No items in this group yet.</li>
        ) : null}
      </ul>

      {eligible.length > 0 ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Add item from catalog</Label>
          <select
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
            value={pick}
            disabled={pending}
            data-testid={`offering-choice-group-add-member-${group.id}`}
            onChange={(e) => {
              const id = e.target.value;
              setPick("");
              if (id) onAddMember(id);
            }}
          >
            <option value="">Choose an item…</option>
            {eligible.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          All eligible child Offerings under this parent are already in this group, or none are
          linked yet.
        </p>
      )}
    </li>
  );
}
