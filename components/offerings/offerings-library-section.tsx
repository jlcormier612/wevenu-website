"use client";

import * as React from "react";

import { ArrowLeft, Layers } from "lucide-react";
import { toast } from "sonner";

import {
  addOfferingChoiceGroupMemberAction,
  createOfferingAction,
  createOfferingCategoryAction,
  createOfferingChoiceGroupAction,
  removeOfferingChoiceGroupMemberAction,
  setOfferingArchivedAction,
  updateOfferingAction,
  updateOfferingImageAction,
} from "@/app/(app)/library/offerings/actions";
import { OfferingChoiceGroupsEditor } from "@/components/offerings/offering-choice-groups-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { effectiveOfferingImageUrl, offeringImageBasePath } from "@/lib/catalog-images/types";
import {
  removeCatalogImage,
  uploadCatalogImage,
} from "@/lib/catalog-images/upload-client";
import { validateCatalogImageFile } from "@/lib/catalog-images/validate";
import { formatOptionalMoney } from "@/lib/event-orders/constants";
import type { InventoryItem } from "@/lib/inventory/types";
import {
  convertibleCategoryCandidates,
  groupIdsContainingOffering,
  groupsUnderParents,
  looksLikeCategoryLabel,
  orderCatalogListWithChoiceGroups,
  planConvertItemToCategory,
  sanitizeChoiceGroupName,
  type CatalogListRow,
  type OfferingChoiceGroup,
} from "@/lib/offerings/choice-groups";

/** Group flat catalog rows into major-offering section containers for visual hierarchy. */
function groupCatalogSections<T extends OfferingWithCategory>(
  rows: CatalogListRow<T>[],
): { key: string; major: Extract<CatalogListRow<T>, { kind: "offering" }> | null; children: CatalogListRow<T>[] }[] {
  const sections: {
    key: string;
    major: Extract<CatalogListRow<T>, { kind: "offering" }> | null;
    children: CatalogListRow<T>[];
  }[] = [];
  let current: (typeof sections)[number] | null = null;

  for (const row of rows) {
    const isTopMajor =
      row.kind === "offering" &&
      row.nestUnderParentId == null &&
      row.nestUnderGroupId == null;
    if (isTopMajor) {
      if (current) sections.push(current);
      current = { key: `section::${row.offering.id}`, major: row, children: [] };
      continue;
    }
    if (!current) {
      current = {
        key: `section::orphan::${row.kind === "choice-group" ? row.group.id : row.offering.id}`,
        major: null,
        children: [row],
      };
    } else {
      current.children.push(row);
    }
  }
  if (current) sections.push(current);
  return sections;
}
import {
  formatParentOfferingNames,
  hasParents,
  majorOfferingIds,
  offeringRole,
  offeringRoleLabel,
  parentIdsOf,
  topLevelOfferings,
} from "@/lib/offerings/hierarchy";
import { isRentalCategoryName, isUnpriced, needsInventoryLink } from "@/lib/offerings/readiness";
import type { OfferingCategory, OfferingInput, OfferingWithCategory } from "@/lib/offerings/types";

export const OfferingsLibrarySection = React.forwardRef<
  { openCreate: () => void },
  {
    venueId: string;
    initialOfferings: OfferingWithCategory[];
    categories: OfferingCategory[];
    inventoryItems: InventoryItem[];
    initialChoiceGroups?: OfferingChoiceGroup[];
    /** When false, PageHeader owns + New Offering. */
    headerCreate?: boolean;
  }
>(function OfferingsLibrarySection({
  venueId, initialOfferings, categories, inventoryItems, initialChoiceGroups = [], headerCreate = true,
}, ref) {
  const [choiceGroups, setChoiceGroups] = React.useState(initialChoiceGroups);
  React.useEffect(() => {
    setChoiceGroups(initialChoiceGroups);
  }, [initialChoiceGroups]);
  const [offerings, setOfferings] = React.useState(initialOfferings);
  const [cats, setCats] = React.useState(categories);
  const [editing, setEditing] = React.useState<OfferingWithCategory | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [createParentId, setCreateParentId] = React.useState<string | null>(null);
  const [createGroupId, setCreateGroupId] = React.useState<string | null>(null);
  const [managingGroupsFor, setManagingGroupsFor] = React.useState<OfferingWithCategory | null>(null);
  const [convertingItem, setConvertingItem] = React.useState<OfferingWithCategory | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);

  React.useImperativeHandle(ref, () => ({
    openCreate: () => { setEditing(null); setCreateParentId(null); setCreateGroupId(null); setCreating(true); },
  }));

  const visible = offerings.filter((o) => showArchived || !o.isArchived);
  const listRows = orderCatalogListWithChoiceGroups(visible, choiceGroups);
  const catalogSections = groupCatalogSections(listRows);
  const majors = majorOfferingIds(offerings);
  const nameById = new Map(offerings.map((o) => [o.id, o.name]));
  const groupNameById = new Map(choiceGroups.map((g) => [g.id, g.name]));

  return (
    <div className="space-y-4" data-testid="offerings-library">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Hide archived" : "Show archived"}
        </Button>
        {headerCreate ? (
          <Button
            type="button"
            size="sm"
            data-testid="offerings-new"
            onClick={() => { setEditing(null); setCreateParentId(null); setCreateGroupId(null); setCreating(true); }}
          >
            + New Offering
          </Button>
        ) : null}
      </div>

      {listRows.length === 0 ? (
        <div className="htc-surface-guidance border-dashed py-12 text-center text-sm text-muted-foreground">
          No offerings yet. Add a service category, then major choices and the items that belong under them.
        </div>
      ) : (
        <div className="htc-hospitality-catalog" data-testid="offerings-list">
          {catalogSections.map((section) => {
            const renderOfferingRow = (
              row: Extract<CatalogListRow<OfferingWithCategory>, { kind: "offering" }>,
              surface: "major" | "item" | "nested",
            ) => {
              const o = row.offering;
              const nestUnderParentId = row.nestUnderParentId;
              const nestUnderGroupId = row.nestUnderGroupId;
              const role = offeringRole(o, majors);
              const isChild = hasParents(o);
              const nestLabel = nestUnderParentId
                ? nameById.get(nestUnderParentId) ?? null
                : null;
              const groupLabel = nestUnderGroupId
                ? groupNameById.get(nestUnderGroupId) ?? null
                : null;
              const underLabel = nestLabel
                ? nestLabel
                : o.parentOfferingName ?? null;
              const surfaceClass =
                surface === "major"
                  ? "htc-catalog-major"
                  : surface === "nested"
                    ? "htc-catalog-item-nested pl-10 sm:pl-14"
                    : "htc-catalog-item pl-6 sm:pl-8";
              return (
                <li
                  key={`${o.id}::${nestUnderParentId ?? "top"}::${nestUnderGroupId ?? "none"}`}
                  className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 ${surfaceClass}`}
                  data-testid={`offering-row-${o.id}`}
                  data-nest-under={nestUnderParentId ?? ""}
                  data-nest-under-group={nestUnderGroupId ?? ""}
                  data-offering-role={role}
                  data-parent-ids={parentIdsOf(o).join(",")}
                  data-standalone={surface === "major" && section.children.length === 0 ? "true" : undefined}
                  data-has-children={surface === "major" && section.children.length > 0 ? "true" : undefined}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    {(() => {
                      const thumb = effectiveOfferingImageUrl({
                        imageUrl: o.imageUrl,
                        inventoryImageUrl: o.inventoryImageUrl,
                      });
                      if (!thumb) return null;
                      return (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-md border border-border/60 bg-muted/30 object-contain"
                          data-testid={`offering-thumb-${o.id}`}
                        />
                      );
                    })()}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={surface === "major" ? "font-semibold text-heading" : "font-medium text-foreground"}>
                          {o.name}
                        </p>
                        {o.categoryName && (
                          <Badge variant="outline" className="bg-card">{o.categoryName}</Badge>
                        )}
                        <Badge variant="outline" className="htc-badge-active">
                          {offeringRoleLabel(role)}
                        </Badge>
                        {o.isArchived && <Badge variant="outline">Archived</Badge>}
                        {isUnpriced(o) && (
                          <Badge variant="outline" className="border-amber-300 text-amber-800" data-testid={`offering-unpriced-${o.id}`}>
                            Unpriced
                          </Badge>
                        )}
                        {needsInventoryLink(o) && (
                          <Badge variant="outline" className="border-amber-300 text-amber-800" data-testid={`offering-no-inventory-${o.id}`}>
                            No inventory link
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {isChild && underLabel
                          ? groupLabel
                            ? `Under ${underLabel} · ${groupLabel} · `
                            : `Under ${underLabel} · `
                          : ""}
                        {formatOptionalMoney(o.defaultUnitPrice)}
                        {o.unit ? ` / ${o.unit}` : ""}
                        {o.description ? ` · ${o.description}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {role !== "item" && !o.isArchived ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          data-testid={`offering-manage-groups-${o.id}`}
                          onClick={() => {
                            setCreating(false);
                            setEditing(null);
                            setCreateParentId(null);
                            setCreateGroupId(null);
                            setManagingGroupsFor(o);
                          }}
                        >
                          + Category under this
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          data-testid={`offering-add-item-${o.id}`}
                          onClick={() => {
                            setEditing(null);
                            setCreateParentId(o.id);
                            setCreateGroupId(null);
                            setCreating(true);
                          }}
                        >
                          + Item under this
                        </Button>
                      </>
                    ) : null}
                    {role === "item" && !o.isArchived && nestUnderGroupId == null && looksLikeCategoryLabel(o.name) ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid={`offering-convert-category-${o.id}`}
                        onClick={() => {
                          setCreating(false);
                          setEditing(null);
                          setConvertingItem(o);
                        }}
                      >
                        Make this a category
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" size="sm" onClick={() => { setCreating(false); setCreateParentId(null); setCreateGroupId(null); setEditing(o); }}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const result = await setOfferingArchivedAction(o.id, !o.isArchived);
                        if (!result.ok) toast.error(result.message ?? "Could not update.");
                        else {
                          setOfferings((prev) => prev.map((x) => x.id === o.id ? { ...x, isArchived: !o.isArchived } : x));
                          toast.success(o.isArchived ? "Restored." : "Archived.");
                        }
                      }}
                    >
                      {o.isArchived ? "Restore" : "Archive"}
                    </Button>
                  </div>
                </li>
              );
            };

            return (
              <section key={section.key} className="htc-catalog-section">
                <ul>
                  {section.major ? renderOfferingRow(section.major, "major") : null}
                  {section.children.map((row) => {
                    if (row.kind === "choice-group") {
                      const parentName = nameById.get(row.nestUnderParentId) ?? "this major";
                      const parentOffering = offerings.find((x) => x.id === row.nestUnderParentId) ?? null;
                      const memberCount = row.group.memberOfferingIds.length;
                      return (
                        <li
                          key={`group::${row.group.id}`}
                          className="htc-catalog-category flex flex-wrap items-center justify-between gap-3 px-4 py-3 pl-6 sm:pl-8"
                          data-testid={`offering-choice-group-row-${row.group.id}`}
                          data-nest-under={row.nestUnderParentId}
                          data-choice-group-id={row.group.id}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Layers className="h-3.5 w-3.5 shrink-0 text-heading" aria-hidden />
                              <p className="text-sm font-semibold text-heading">{row.group.name}</p>
                              <Badge variant="outline" className="bg-card">Category</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Category under {parentName} · {memberCount} item{memberCount === 1 ? "" : "s"} the couple can pick from
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              data-testid={`offering-category-add-item-${row.group.id}`}
                              onClick={() => {
                                setEditing(null);
                                setCreateParentId(row.nestUnderParentId);
                                setCreateGroupId(row.group.id);
                                setCreating(true);
                              }}
                            >
                              + Item in this category
                            </Button>
                            {parentOffering ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                data-testid={`offering-category-manage-${row.group.id}`}
                                onClick={() => {
                                  setCreating(false);
                                  setEditing(null);
                                  setManagingGroupsFor(parentOffering);
                                }}
                              >
                                Edit category
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      );
                    }
                    return renderOfferingRow(
                      row,
                      row.nestUnderGroupId != null ? "nested" : "item",
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <OfferingFormSheet
        open={creating || !!editing}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false);
            setEditing(null);
            setCreateParentId(null);
            setCreateGroupId(null);
          }
        }}
        venueId={venueId}
        offering={editing}
        defaultParentId={createParentId}
        defaultGroupId={creating ? createGroupId : null}
        targetGroupName={
          creating && createGroupId ? groupNameById.get(createGroupId) ?? null : null
        }
        offerings={offerings}
        categories={cats}
        inventoryItems={inventoryItems}
        choiceGroups={choiceGroups}
        onChoiceGroupsChange={setChoiceGroups}
        onOfferingsChange={setOfferings}
        onCategoryCreated={(c) => setCats((prev) => [...prev, c])}
        onSaved={(o) => {
          setOfferings((prev) => {
            const idx = prev.findIndex((x) => x.id === o.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = o;
              return next;
            }
            return [...prev, o];
          });
          setCreating(false);
          setEditing(null);
          setCreateParentId(null);
          setCreateGroupId(null);
        }}
      />

      <ConvertToCategorySheet
        key={convertingItem?.id ?? "none"}
        item={convertingItem}
        offerings={offerings}
        choiceGroups={choiceGroups}
        onClose={() => setConvertingItem(null)}
        onConverted={({ groups, archivedId }) => {
          setChoiceGroups(groups);
          setOfferings((prev) => prev.map((x) => (x.id === archivedId ? { ...x, isArchived: true } : x)));
          setConvertingItem(null);
        }}
      />

      <Sheet
        open={!!managingGroupsFor}
        onOpenChange={(v) => {
          if (!v) setManagingGroupsFor(null);
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              Categories{managingGroupsFor ? ` · ${managingGroupsFor.name}` : ""}
            </SheetTitle>
          </SheetHeader>
          {managingGroupsFor ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Add categories under {managingGroupsFor.name} (for example Entrées, Sides, Desserts),
                then put the items the couple picks from into each one (for example Chicken, Beef, Fish).
              </p>
              <OfferingChoiceGroupsEditor
                parentOffering={managingGroupsFor}
                allOfferings={offerings}
                initialGroups={choiceGroups}
                onGroupsChange={setChoiceGroups}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

    </div>
  );
});

function ConvertToCategorySheet({
  item, offerings, choiceGroups, onClose, onConverted,
}: {
  item: OfferingWithCategory | null;
  offerings: OfferingWithCategory[];
  choiceGroups: OfferingChoiceGroup[];
  onClose: () => void;
  onConverted: (result: { groups: OfferingChoiceGroup[]; archivedId: string }) => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const plan = React.useMemo(
    () => (item ? planConvertItemToCategory(item, offerings, choiceGroups) : []),
    [item, offerings, choiceGroups],
  );
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(plan.flatMap((t) => t.alreadyMemberIds.map((id) => `${t.parentOfferingId}::${id}`))),
  );
  const nameById = new Map(offerings.map((o) => [o.id, o.name]));

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function convert() {
    if (!item) return;
    startTransition(async () => {
      let groups = [...choiceGroups];
      for (const target of plan) {
        let groupId = target.existingGroupId;
        if (!groupId) {
          const created = await createOfferingChoiceGroupAction(target.parentOfferingId, item.name);
          if (!created.ok || !created.group) {
            toast.error(created.ok ? "Could not create the category." : created.message);
            return;
          }
          groupId = created.group.id;
          groups = [...groups, created.group];
        }
        for (const memberId of target.candidateMemberIds) {
          if (!selected.has(`${target.parentOfferingId}::${memberId}`)) continue;
          if (target.alreadyMemberIds.includes(memberId)) continue;
          const added = await addOfferingChoiceGroupMemberAction(groupId, memberId);
          if (!added.ok) {
            toast.error(added.message);
            return;
          }
          const gid = groupId;
          groups = groups.map((g) =>
            g.id === gid ? { ...g, memberOfferingIds: [...g.memberOfferingIds, memberId] } : g,
          );
        }
      }
      const archived = await setOfferingArchivedAction(item.id, true);
      if (!archived.ok) {
        toast.error(archived.message ?? "Category created, but the old item could not be archived.");
        onConverted({ groups, archivedId: "" });
        return;
      }
      toast.success(`“${item.name}” is now a category.`);
      onConverted({ groups, archivedId: item.id });
    });
  }

  return (
    <Sheet open={!!item} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="overflow-y-auto sm:max-w-lg" data-testid="offering-convert-sheet">
        <SheetHeader>
          <SheetTitle>Make “{item?.name}” a category</SheetTitle>
        </SheetHeader>
        {item ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              “{item.name}” becomes a category under{" "}
              {plan.map((t) => nameById.get(t.parentOfferingId) ?? "its major").join(" and ")}. Check the
              items that belong in it. The old “{item.name}” item is archived, so you can restore it later.
            </p>
            {plan.map((t) => (
              <div key={t.parentOfferingId} className="space-y-1.5" data-testid={`offering-convert-parent-${t.parentOfferingId}`}>
                <p className="text-sm font-medium text-heading">
                  {nameById.get(t.parentOfferingId) ?? "Major"} → {item.name}
                </p>
                {t.candidateMemberIds.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No other items under this major yet.</p>
                ) : (
                  <div className="space-y-1 rounded-md border border-border p-2">
                    {t.candidateMemberIds.map((id) => {
                      const key = `${t.parentOfferingId}::${id}`;
                      return (
                        <label key={key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/40">
                          <input
                            type="checkbox"
                            checked={selected.has(key)}
                            disabled={pending || t.alreadyMemberIds.includes(id)}
                            onChange={() => toggle(key)}
                            data-testid={`offering-convert-member-${t.parentOfferingId}-${id}`}
                          />
                          <span>{nameById.get(id) ?? id}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>
              <Button type="button" disabled={pending || plan.length === 0} onClick={convert} data-testid="offering-convert-confirm">
                {pending ? "Converting…" : "Make category"}
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function OfferingFormSheet({
  open, onOpenChange, venueId, offering, defaultParentId, defaultGroupId, targetGroupName, offerings, categories, inventoryItems,
  choiceGroups, onChoiceGroupsChange, onOfferingsChange, onSaved, onCategoryCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  venueId: string;
  offering: OfferingWithCategory | null;
  defaultParentId: string | null;
  defaultGroupId: string | null;
  targetGroupName: string | null;
  offerings: OfferingWithCategory[];
  categories: OfferingCategory[];
  inventoryItems: InventoryItem[];
  choiceGroups: OfferingChoiceGroup[];
  onChoiceGroupsChange: (groups: OfferingChoiceGroup[]) => void;
  onOfferingsChange: (offerings: OfferingWithCategory[]) => void;
  onSaved: (o: OfferingWithCategory) => void;
  onCategoryCreated: (c: OfferingCategory) => void;
}) {
  const [name, setName] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [parentOfferingIds, setParentOfferingIds] = React.useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>([]);
  const [convertItemIds, setConvertItemIds] = React.useState<string[]>([]);
  const [newListCategory, setNewListCategory] = React.useState("");
  const [showAllMajors, setShowAllMajors] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [defaultUnitPrice, setDefaultUnitPrice] = React.useState("");
  const [inventoryItemId, setInventoryItemId] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [newCategory, setNewCategory] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const majorsWithChildren = majorOfferingIds(offerings);
  const editingIsMajorWithChildren = Boolean(offering && majorsWithChildren.has(offering.id));
  const allParentCandidates = topLevelOfferings(offerings).filter((o) => o.id !== offering?.id);
  const sameServiceParents = categoryId
    ? allParentCandidates.filter((o) => o.categoryId === categoryId)
    : allParentCandidates;
  const parentCandidates = showAllMajors || sameServiceParents.length === 0
    ? allParentCandidates
    : sameServiceParents;
  const listCategories = groupsUnderParents(choiceGroups, parentOfferingIds);
  const convertibleFolders = convertibleCategoryCandidates(
    offerings,
    choiceGroups,
    parentOfferingIds,
    offering?.id,
  );
  const nameById = React.useMemo(
    () => new Map(offerings.map((o) => [o.id, o.name])),
    [offerings],
  );

  React.useEffect(() => {
    if (!open) return;
    setName(offering?.name ?? "");
    const existingParents = offering
      ? parentIdsOf(offering)
      : defaultParentId
        ? [defaultParentId]
        : [];
    setParentOfferingIds(existingParents);
    const firstParent = offerings.find((o) => o.id === existingParents[0]);
    setCategoryId(offering?.categoryId ?? firstParent?.categoryId ?? "");
    const existingGroups = offering
      ? groupIdsContainingOffering(choiceGroups, offering.id)
      : defaultGroupId
        ? [defaultGroupId]
        : [];
    setSelectedGroupIds(existingGroups);
    setConvertItemIds([]);
    setNewListCategory("");
    setShowAllMajors(false);
    setDescription(offering?.description ?? "");
    setUnit(offering?.unit ?? "");
    setDefaultUnitPrice(offering?.defaultUnitPrice != null ? String(offering.defaultUnitPrice) : "");
    setInventoryItemId(offering?.inventoryItemId ?? "");
    setImageUrl(offering?.imageUrl ?? null);
    setFile(null);
    setNewCategory("");
  }, [open, offering, defaultParentId, defaultGroupId, offerings, choiceGroups]);

  function toggleParent(id: string) {
    setParentOfferingIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (!prev.includes(id)) {
        const parent = offerings.find((o) => o.id === id);
        if (parent?.categoryId) setCategoryId(parent.categoryId);
      }
      const allowed = new Set(groupsUnderParents(choiceGroups, next).map((g) => g.id));
      setSelectedGroupIds((ids) => ids.filter((gid) => allowed.has(gid)));
      setConvertItemIds((ids) =>
        ids.filter((itemId) => {
          const item = offerings.find((o) => o.id === itemId);
          return item ? parentIdsOf(item).some((p) => next.includes(p)) : false;
        }),
      );
      return next;
    });
  }

  function toggleGroup(id: string) {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleConvertItem(id: string) {
    setConvertItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function input(): OfferingInput {
    return {
      name,
      categoryId: categoryId || null,
      parentOfferingIds: editingIsMajorWithChildren ? [] : parentOfferingIds,
      description,
      unit,
      defaultUnitPrice,
      inventoryItemId: inventoryItemId || null,
    };
  }

  function buildSaved(partial: {
    id: string;
    venueId: string;
    isArchived: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
  }): OfferingWithCategory {
    const catName = categories.find((c) => c.id === (categoryId || null))?.name ?? null;
    const parentNames = parentOfferingIds
      .map((id) => offerings.find((o) => o.id === id)?.name)
      .filter((n): n is string => Boolean(n))
      .sort((a, b) => a.localeCompare(b));
    const primary = parentOfferingIds[0] ?? null;
    return {
      ...partial,
      name: name.trim(),
      categoryId: categoryId || null,
      parentOfferingIds: [...parentOfferingIds],
      parentOfferingId: primary,
      description: description.trim() || null,
      unit: unit.trim() || null,
      defaultUnitPrice: defaultUnitPrice.trim() === "" ? null : Number(defaultUnitPrice.replace(/[$,]/g, "")),
      inventoryItemId: inventoryItemId || null,
      imageUrl,
      inventoryImageUrl: inventoryItemId
        ? inventoryItems.find((i) => i.id === inventoryItemId)?.imageUrl ?? null
        : null,
      categoryName: catName,
      parentOfferingNames: parentNames,
      parentOfferingName: formatParentOfferingNames(parentNames),
    };
  }

  async function persistImage(offeringId: string): Promise<string | null> {
    if (!file) return imageUrl;
    const validated = validateCatalogImageFile(file);
    if (!validated.ok) {
      toast.error(validated.message);
      return imageUrl;
    }
    if (!venueId) {
      toast.error("Could not determine venue for photo upload.");
      return imageUrl;
    }
    try {
      const url = await uploadCatalogImage({
        basePath: offeringImageBasePath(venueId, offeringId),
        file,
      });
      const result = await updateOfferingImageAction(offeringId, url);
      if (!result.ok) throw new Error(result.message ?? "Could not save photo.");
      setImageUrl(url);
      setFile(null);
      return url;
    } catch {
      toast.error("Offering saved, but the photo upload failed — try again from Edit.");
      return imageUrl;
    }
  }

  async function clearImage() {
    if (!offering?.id || !venueId) return;
    startTransition(async () => {
      try {
        await removeCatalogImage(offeringImageBasePath(venueId, offering.id));
        const result = await updateOfferingImageAction(offering.id, null);
        if (!result.ok) throw new Error(result.message ?? "Could not remove photo.");
        setImageUrl(null);
        setFile(null);
        onSaved({
          ...buildSaved({
            id: offering.id,
            venueId: offering.venueId || venueId,
            isArchived: offering.isArchived,
            sortOrder: offering.sortOrder,
            createdAt: offering.createdAt,
            updatedAt: new Date().toISOString(),
          }),
          imageUrl: null,
        });
        toast.success("Photo removed.");
      } catch {
        toast.error("Could not remove the photo.");
      }
    });
  }

  async function ensureCategoriesAndMembership(offeringId: string): Promise<boolean> {
    if (editingIsMajorWithChildren || parentOfferingIds.length === 0) return true;

    let groups = [...choiceGroups];
    let nextSelected = [...selectedGroupIds];
    let nextOfferings = [...offerings];

    for (const convertId of convertItemIds) {
      const item = nextOfferings.find((o) => o.id === convertId);
      if (!item || item.isArchived) continue;
      const plan = planConvertItemToCategory(item, nextOfferings, groups).filter((t) =>
        parentOfferingIds.includes(t.parentOfferingId),
      );
      for (const target of plan) {
        let groupId = target.existingGroupId;
        if (!groupId) {
          const created = await createOfferingChoiceGroupAction(target.parentOfferingId, item.name);
          if (!created.ok || !created.group) {
            toast.error(created.ok ? "Could not create the category." : created.message);
            return false;
          }
          groupId = created.group.id;
          groups = [...groups, created.group];
        }
        if (!nextSelected.includes(groupId)) nextSelected.push(groupId);
      }
      const archived = await setOfferingArchivedAction(item.id, true);
      if (!archived.ok) {
        toast.error(archived.message ?? "Could not convert the folder item into a category.");
        return false;
      }
      nextOfferings = nextOfferings.map((o) =>
        o.id === item.id ? { ...o, isArchived: true } : o,
      );
    }

    const newName = sanitizeChoiceGroupName(newListCategory);
    if (newName) {
      for (const parentId of parentOfferingIds) {
        const existing = groups.find(
          (g) =>
            g.parentOfferingId === parentId &&
            g.name.toLocaleLowerCase() === newName.toLocaleLowerCase(),
        );
        if (existing) {
          if (!nextSelected.includes(existing.id)) nextSelected.push(existing.id);
          continue;
        }
        const created = await createOfferingChoiceGroupAction(parentId, newName);
        if (!created.ok || !created.group) {
          toast.error(created.ok ? "Could not create the category." : created.message);
          return false;
        }
        groups = [...groups, created.group];
        nextSelected.push(created.group.id);
      }
      // If a peer "Entrees" item still exists, archive it so the category owns that name.
      const peer = nextOfferings.find(
        (o) =>
          !o.isArchived &&
          o.id !== offeringId &&
          sanitizeChoiceGroupName(o.name).toLocaleLowerCase() === newName.toLocaleLowerCase() &&
          parentIdsOf(o).some((p) => parentOfferingIds.includes(p)) &&
          o.defaultUnitPrice == null,
      );
      if (peer) {
        const archived = await setOfferingArchivedAction(peer.id, true);
        if (archived.ok) {
          nextOfferings = nextOfferings.map((o) =>
            o.id === peer.id ? { ...o, isArchived: true } : o,
          );
        }
      }
    }

    const relevant = groupsUnderParents(groups, parentOfferingIds);
    const want = new Set(nextSelected);
    for (const g of relevant) {
      const isIn = g.memberOfferingIds.includes(offeringId);
      const should = want.has(g.id);
      if (should && !isIn) {
        const r = await addOfferingChoiceGroupMemberAction(g.id, offeringId);
        if (!r.ok) {
          toast.error(r.message ?? "Could not add this item to the category.");
          return false;
        }
        groups = groups.map((x) =>
          x.id === g.id ? { ...x, memberOfferingIds: [...x.memberOfferingIds, offeringId] } : x,
        );
      } else if (!should && isIn) {
        const r = await removeOfferingChoiceGroupMemberAction(g.id, offeringId);
        if (!r.ok) {
          toast.error(r.message ?? "Could not remove this item from the category.");
          return false;
        }
        groups = groups.map((x) =>
          x.id === g.id
            ? { ...x, memberOfferingIds: x.memberOfferingIds.filter((id) => id !== offeringId) }
            : x,
        );
      }
    }

    onChoiceGroupsChange(groups);
    onOfferingsChange(nextOfferings);
    setSelectedGroupIds(nextSelected);
    setConvertItemIds([]);
    setNewListCategory("");
    return true;
  }

  function handleSave() {
    startTransition(async () => {
      if (offering) {
        const result = await updateOfferingAction(offering.id, input());
        if (!result.ok) { toast.error(result.message ?? "Could not save."); return; }
        const nextImage = await persistImage(offering.id);
        const ok = await ensureCategoriesAndMembership(offering.id);
        if (!ok) return;
        onSaved({
          ...buildSaved({
            id: offering.id,
            venueId: offering.venueId || venueId,
            isArchived: offering.isArchived,
            sortOrder: offering.sortOrder,
            createdAt: offering.createdAt,
            updatedAt: new Date().toISOString(),
          }),
          imageUrl: nextImage,
        });
        toast.success("Offering updated.");
      } else {
        const result = await createOfferingAction(input());
        if (!result.ok) { toast.error(result.message ?? "Could not create."); return; }
        const nextImage = await persistImage(result.offeringId);
        const ok = await ensureCategoriesAndMembership(result.offeringId);
        if (!ok) return;
        onSaved({
          ...buildSaved({
            id: result.offeringId,
            venueId,
            isArchived: false,
            sortOrder: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
          imageUrl: nextImage,
        });
        toast.success("Offering created.");
      }
    });
  }

  function handleAddCategory() {
    startTransition(async () => {
      const result = await createOfferingCategoryAction(newCategory);
      if (!result.ok) { toast.error(result.message ?? "Could not add category."); return; }
      const created = {
        id: result.categoryId, venueId: "", name: newCategory.trim(), sortOrder: 0,
        createdAt: "", updatedAt: "",
      };
      onCategoryCreated(created);
      setCategoryId(created.id);
      setNewCategory("");
      toast.success("Category added.");
    });
  }

  const hasAnyParent = parentOfferingIds.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6 space-y-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Offerings
          </Button>
          <SheetTitle>
            {offering
              ? "Edit offering"
              : targetGroupName
                ? `Add item to ${targetGroupName}`
                : hasAnyParent
                  ? "Add item under major choice"
                  : "Add offering"}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" data-testid="offering-name" />
          </div>
          <div>
            <Label className="text-xs">Service category</Label>
            <select
              className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              data-testid="offering-category"
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="mt-2 flex gap-2">
              <Input placeholder="New category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="h-9 text-sm" />
              <Button type="button" variant="outline" size="sm" disabled={!newCategory.trim() || pending} onClick={handleAddCategory}>Add</Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">1. Belongs under major choices (optional)</Label>
            {editingIsMajorWithChildren ? (
              <p className="mt-1 text-[0.7rem] text-muted-foreground" data-testid="offering-parent-locked">
                This offering is already a major choice with items under it, so it stays top-level.
              </p>
            ) : (
              <>
                <div
                  className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-background p-2"
                  data-testid="offering-parents"
                  role="group"
                  aria-label="Major choices this offering belongs under"
                >
                  {parentCandidates.length === 0 ? (
                    <p className="px-1 py-1 text-xs text-muted-foreground">
                      No top-level major choices yet. Leave unchecked for a standalone or major choice.
                    </p>
                  ) : (
                    parentCandidates.map((p) => {
                      const checked = parentOfferingIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm hover:bg-muted/40"
                          data-testid={`offering-parent-${p.id}`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            onChange={() => toggleParent(p.id)}
                            data-testid={`offering-parent-check-${p.id}`}
                          />
                          <span>
                            {p.name}
                            {p.categoryName ? (
                              <span className="text-muted-foreground"> · {p.categoryName}</span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                {categoryId && sameServiceParents.length > 0 && sameServiceParents.length < allParentCandidates.length ? (
                  <button
                    type="button"
                    className="mt-1 text-[0.7rem] text-primary underline"
                    data-testid="offering-parents-show-all"
                    onClick={() => setShowAllMajors((v) => !v)}
                  >
                    {showAllMajors
                      ? "Show only this service category’s majors"
                      : "Show majors from other service categories"}
                  </button>
                ) : null}
                <p className="mt-1 text-[0.7rem] text-muted-foreground">
                  Layer 1 — check Plated Dinner and/or Buffet Style Service (same item can sit under both).
                  Leave none selected for a major choice or standalone offering.
                </p>
              </>
            )}
          </div>
          {!editingIsMajorWithChildren && parentOfferingIds.length > 0 ? (
            <div>
              <Label className="text-xs">2. List under category (Entrees, Sides…)</Label>
              <div
                className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-background p-2"
                data-testid="offering-list-under-categories"
                role="group"
                aria-label="Categories under the selected majors"
              >
                {listCategories.length === 0 && convertibleFolders.length === 0 ? (
                  <p className="px-1 py-1 text-xs text-muted-foreground">
                    No categories under these majors yet. Create one below (for example Entrees), or use
                    “+ Category under this” / “Make this a category” on the list.
                  </p>
                ) : null}
                {listCategories.map((g) => {
                  const checked = selectedGroupIds.includes(g.id);
                  const parentLabel = nameById.get(g.parentOfferingId) ?? "major";
                  return (
                    <label
                      key={g.id}
                      className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm hover:bg-muted/40"
                      data-testid={`offering-list-category-${g.id}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={checked}
                        onChange={() => toggleGroup(g.id)}
                        data-testid={`offering-list-category-check-${g.id}`}
                      />
                      <span>
                        {g.name}
                        <span className="text-muted-foreground"> · under {parentLabel}</span>
                      </span>
                    </label>
                  );
                })}
                {convertibleFolders.map((folder) => {
                  const checked = convertItemIds.includes(folder.id);
                  return (
                    <label
                      key={`convert-${folder.id}`}
                      className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm hover:bg-muted/40"
                      data-testid={`offering-convert-folder-${folder.id}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={checked}
                        onChange={() => toggleConvertItem(folder.id)}
                        data-testid={`offering-convert-folder-check-${folder.id}`}
                      />
                      <span>
                        {folder.name}
                        <span className="text-muted-foreground">
                          {" "}
                          · still an item — check to turn into a category and place this dish under it
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder="New category (e.g. Entrees)"
                  value={newListCategory}
                  onChange={(e) => setNewListCategory(e.target.value)}
                  className="h-9 text-sm"
                  data-testid="offering-new-list-category"
                />
              </div>
              <p className="mt-1 text-[0.7rem] text-muted-foreground">
                Layer 2 — Entrees / Desserts / Sides under the majors above. Layer 3 is this dish
                (Chicken Marsala). Checking a still-item folder converts it into a real category on Save.
              </p>
            </div>
          ) : null}
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="guest, each…" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Default price (optional)</Label>
              <Input value={defaultUnitPrice} onChange={(e) => setDefaultUnitPrice(e.target.value)} placeholder="—" className="h-9 text-sm" />
            </div>
          </div>
          {defaultUnitPrice.trim() === "" && (
            <p className="-mt-1 text-[0.7rem] text-amber-800" data-testid="offering-unpriced-hint">
              No price yet — Event Orders and templates that use this offering will start unpriced until you set one.
            </p>
          )}
          <div>
            <Label className="text-xs">Link to Inventory (optional — rentals)</Label>
            <select
              className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={inventoryItemId}
              onChange={(e) => setInventoryItemId(e.target.value)}
            >
              <option value="">None</option>
              {inventoryItems.map((i) => (
                <option key={i.id} value={i.id}>{i.printableName || i.name}</option>
              ))}
            </select>
            {!inventoryItemId && isRentalCategoryName(categories.find((c) => c.id === categoryId)?.name) && (
              <p className="mt-1 text-[0.7rem] text-amber-800" data-testid="offering-inventory-link-hint">
                Rentals should point at the inventory item they use, so each unit on an Event Order counts one of that item.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              Photo <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            {imageUrl && !file ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="h-20 w-20 rounded-lg border border-border bg-muted/40 object-contain"
                data-testid="offering-photo-preview"
              />
            ) : null}
            {!imageUrl && !file && inventoryItemId ? (() => {
              const fallback = inventoryItems.find((i) => i.id === inventoryItemId)?.imageUrl;
              if (!fallback) return null;
              return (
                <p className="text-[0.7rem] text-muted-foreground">
                  No dedicated photo yet — couples will see the linked Inventory photo until you upload one.
                </p>
              );
            })() : null}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              data-testid="offering-photo-input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
            />
            {offering?.imageUrl ? (
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => void clearImage()}>
                Remove photo
              </Button>
            ) : null}
          </div>
          {offering && !hasParents(offering) ? (
            <div className="border-t border-border pt-4">
              <OfferingChoiceGroupsEditor
                parentOffering={offering}
                allOfferings={offerings}
                initialGroups={choiceGroups}
                onGroupsChange={onChoiceGroupsChange}
              />
            </div>
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button type="button" disabled={!name.trim() || pending} onClick={handleSave} data-testid="offering-save">
            {offering ? "Save" : "Create"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
