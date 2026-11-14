"use client";

/**
 * Phase 3 — progressive venue setup package authoring.
 * Setup-scoped couple selection establishes that setup's working layout
 * (no Approve / Decline / Defer ceremony). Post-approval switches are proposed
 * replacements requiring deliberate venue review.
 */
import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";

import {
  attachLayoutToSetupAction,
  createRequiredSetupAction,
  decideSetupFloorPlanPreferenceAction,
  detachLayoutFromSetupAction,
  ensureDefaultWeddingSetupsAction,
  listSetupsWithMembersAction,
  removeRequiredSetupAction,
  setSetupWorkingLayoutAction,
} from "@/app/(app)/events/[id]/floor-plan-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { classifyPreferenceApprovalCase } from "@/lib/floor-plans/preference-lifecycle";
import type { SetupWithMembers } from "@/lib/floor-plans/setups";
import type { FloorPlan } from "@/lib/floor-plans/types";

type Props = {
  eventId: string;
  floorPlans: FloorPlan[];
  canEdit: boolean;
  seatCounts?: Record<string, number>;
};

export function FloorPlanSetupPackagePanel({
  eventId,
  floorPlans,
  canEdit,
  seatCounts = {},
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [setups, setSetups] = React.useState<SetupWithMembers[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [newName, setNewName] = React.useState("");
  const [caseCChoice, setCaseCChoice] = React.useState<Record<string, string>>({});

  async function reload() {
    setLoading(true);
    try {
      const next = await listSetupsWithMembersAction(eventId);
      setSetups(next);
      if (next.length > 0) setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, floorPlans.length]);

  const assignedIds = new Set(setups.flatMap((s) => s.members.map((m) => m.floorPlanId)));
  const unassigned = floorPlans.filter((p) => !assignedIds.has(p.id));

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.message ?? "Could not update setups.");
        return;
      }
      await reload();
      router.refresh();
    });
  }

  return (
    <section
      className="rounded-lg border border-border bg-muted/10 p-4 space-y-3"
      data-testid="floor-plan-setup-package"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-heading">Wedding setups</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
            For multi-part weddings, start with Ceremony + Reception so the couple can choose one
            starting layout per part of the day. Their selection becomes that setup&apos;s working
            layout — no separate Approve / Decline / Defer step. Furniture approval stays separate.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="floor-plan-setup-package-toggle"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide setup organizer" : "Organize wedding setups"}
        </Button>
      </div>

      {!open ? (
        setups.length > 0 ? (
          <p className="text-xs text-muted-foreground" data-testid="floor-plan-setup-package-summary">
            {setups.length} required setup{setups.length === 1 ? "" : "s"} configured. Open the organizer to
            review or edit.
          </p>
        ) : null
      ) : (
        <div className="space-y-4" data-testid="floor-plan-setup-package-editor">
          {loading && setups.length === 0 ? (
            <p className="text-xs text-muted-foreground">Loading setups…</p>
          ) : null}

          {setups.map((setup) => {
            const status = setup.couplePreferenceStatus;
            const preferred = setup.members.find((m) => m.floorPlanId === setup.coupleSelectedFloorPlanId);
            const working = setup.members.find((m) => m.floorPlanId === setup.operationalFloorPlanId);
            const isProposed = status === "proposed_replacement" && Boolean(preferred);
            const currentSeats = setup.operationalFloorPlanId
              ? (seatCounts[setup.operationalFloorPlanId] ?? 0)
              : 0;
            const proposedSeats = setup.coupleSelectedFloorPlanId
              ? (seatCounts[setup.coupleSelectedFloorPlanId] ?? 0)
              : 0;
            const seatingCase =
              isProposed && setup.coupleSelectedFloorPlanId
                ? classifyPreferenceApprovalCase({
                    currentOperationalId: setup.operationalFloorPlanId,
                    preferredId: setup.coupleSelectedFloorPlanId,
                    currentHasSeats: currentSeats > 0,
                    preferredHasSeats: proposedSeats > 0,
                  })
                : null;

            return (
              <div
                key={setup.id}
                className="rounded-md border border-border bg-background p-3 space-y-2"
                data-testid={`floor-plan-setup-${setup.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Required setup
                    </p>
                    <p className="text-sm font-medium text-heading">{setup.name}</p>
                  </div>
                  {canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      aria-label={`Remove setup ${setup.name}`}
                      data-testid={`floor-plan-setup-remove-${setup.id}`}
                      onClick={() => {
                        if (!confirm(`Remove setup “${setup.name}”? Layouts stay on the event; only the setup grouping is removed.`)) {
                          return;
                        }
                        run(() => removeRequiredSetupAction(eventId, setup.id));
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>

                <ul className="space-y-1">
                  {setup.members.length === 0 ? (
                    <li className="text-xs text-muted-foreground">No layouts attached yet.</li>
                  ) : (
                    setup.members.map((m) => {
                      const isWorking = setup.operationalFloorPlanId === m.floorPlanId;
                      const isAlt = !isWorking && setup.members.length > 1;
                      const isCouplePick = setup.coupleSelectedFloorPlanId === m.floorPlanId;
                      return (
                        <li
                          key={m.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded border border-transparent px-1 py-1 text-sm hover:border-border/60"
                          data-testid={`floor-plan-setup-member-${m.floorPlanId}`}
                        >
                          <span>
                            <span className="font-medium text-heading">{m.floorPlanName}</span>
                            <span className="ml-2 text-[0.7rem] text-muted-foreground">
                              {isWorking ? "Working layout for this setup" : isAlt ? "Alternative in this setup" : "Layout"}
                              {m.sharedWithCouple ? " · Shared with couple" : " · Not shared"}
                              {isCouplePick && isProposed ? " · Proposed replacement" : ""}
                              {isCouplePick && !isProposed ? " · Couple selection" : ""}
                            </span>
                          </span>
                          {canEdit ? (
                            <span className="flex flex-wrap gap-1">
                              {!isWorking ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={pending}
                                  onClick={() =>
                                    run(() => setSetupWorkingLayoutAction(eventId, setup.id, m.floorPlanId))
                                  }
                                >
                                  Set as working
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={pending}
                                onClick={() =>
                                  run(() => detachLayoutFromSetupAction(eventId, setup.id, m.floorPlanId))
                                }
                              >
                                Detach
                              </Button>
                            </span>
                          ) : null}
                        </li>
                      );
                    })
                  )}
                </ul>

                {canEdit && unassigned.length > 0 ? (
                  <div className="flex flex-wrap gap-2 items-center">
                    <label className="text-xs text-muted-foreground" htmlFor={`attach-${setup.id}`}>
                      Attach layout
                    </label>
                    <select
                      id={`attach-${setup.id}`}
                      className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                      defaultValue=""
                      disabled={pending}
                      data-testid={`floor-plan-setup-attach-${setup.id}`}
                      onChange={(e) => {
                        const id = e.target.value;
                        if (!id) return;
                        run(() => attachLayoutToSetupAction(eventId, setup.id, id));
                        e.target.value = "";
                      }}
                    >
                      <option value="">Select layout…</option>
                      {unassigned.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {isProposed && preferred ? (
                  <div
                    className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 space-y-2"
                    data-testid={`floor-plan-setup-preference-${setup.id}`}
                  >
                    <p className="text-xs text-heading">
                      Proposed layout change for {setup.name}: “{preferred.floorPlanName}”. Current working
                      layout{working ? ` (“${working.floorPlanName}”)` : ""} stays until you accept. Seating
                      assignments are never moved or deleted.
                    </p>
                    {canEdit ? (
                      <div className="flex flex-wrap gap-2">
                        {seatingCase === "C" && setup.operationalFloorPlanId ? (
                          <div className="w-full space-y-1.5 text-xs text-muted-foreground">
                            <p>Both layouts have seating. Choose which seating arrangement stays in use.</p>
                            {[{
                              id: setup.operationalFloorPlanId,
                              name: working?.floorPlanName ?? "Current working",
                              seats: currentSeats,
                            }, {
                              id: preferred.floorPlanId,
                              name: preferred.floorPlanName,
                              seats: proposedSeats,
                            }].map((opt) => (
                              <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`setup-seating-${setup.id}`}
                                  checked={caseCChoice[setup.id] === opt.id}
                                  onChange={() =>
                                    setCaseCChoice((prev) => ({ ...prev, [setup.id]: opt.id }))
                                  }
                                />
                                <span>
                                  {opt.name}
                                  {opt.seats > 0 ? ` · ${opt.seats} seated` : ""}
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending || (seatingCase === "C" && !caseCChoice[setup.id])}
                          data-testid={`floor-plan-setup-accept-replacement-${setup.id}`}
                          onClick={() =>
                            run(() =>
                              decideSetupFloorPlanPreferenceAction(eventId, setup.id, {
                                decision: "accept",
                                seatingChoice:
                                  seatingCase === "B" ? "start_on_proposed" : undefined,
                                seatingInUseFloorPlanId:
                                  seatingCase === "C" ? caseCChoice[setup.id] : undefined,
                              }),
                            )
                          }
                        >
                          {seatingCase === "B"
                            ? "Accept and start seating on proposed"
                            : "Accept layout replacement"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          data-testid={`floor-plan-setup-keep-current-${setup.id}`}
                          onClick={() =>
                            run(() =>
                              decideSetupFloorPlanPreferenceAction(eventId, setup.id, {
                                decision: "decline",
                              }),
                            )
                          }
                        >
                          Keep current layout
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}

          {canEdit && setups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-background/60 p-3 space-y-2" data-testid="floor-plan-setup-defaults">
              <p className="text-xs text-muted-foreground">
                Recommended for multi-part weddings: create Ceremony and Reception setups in one step.
              </p>
              <Button
                type="button"
                size="sm"
                disabled={pending}
                data-testid="floor-plan-setup-defaults-create"
                onClick={() => run(() => ensureDefaultWeddingSetupsAction(eventId))}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Start with Ceremony + Reception
              </Button>
            </div>
          ) : null}

          {canEdit ? (
            <div className="flex flex-wrap gap-2 items-end" data-testid="floor-plan-setup-add">
              <div className="space-y-1 grow min-w-[12rem]">
                <label className="text-xs text-muted-foreground" htmlFor="new-setup-name">
                  Add another setup
                </label>
                <Input
                  id="new-setup-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Cocktail hour"
                  data-testid="floor-plan-setup-name-input"
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={pending || !newName.trim()}
                data-testid="floor-plan-setup-add-submit"
                onClick={() => {
                  const name = newName.trim();
                  if (!name) return;
                  run(async () => {
                    const r = await createRequiredSetupAction(eventId, name);
                    if (r.ok) setNewName("");
                    return r;
                  });
                }}
              >
                Add setup
              </Button>
            </div>
          ) : null}

          {error ? (
            <p className="text-xs text-destructive" data-testid="floor-plan-setup-package-error">{error}</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
