"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ASSIGNMENT_FULL_LABEL_MIN_WIDTH_PX,
  assignmentActionLabel,
} from "@/lib/team/assignment-action-label";

export function StaffAssignmentField({
  label,
  hint,
  staff,
  value,
  testId,
  onSave,
  compact = false,
}: {
  label: string;
  hint?: string;
  staff: Array<{ id: string; name: string }>;
  value: string | null;
  testId: string;
  onSave: (staffId: string | null) => Promise<{ ok: boolean; message?: string }>;
  /** One inline control. The select shows the current owner, including Unassigned. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState(value ?? "");
  const selectedRef = React.useRef(value ?? "");
  const dirtyRef = React.useRef(false);
  /** Last successfully persisted id (prop sync + successful save). */
  const [persistedId, setPersistedId] = React.useState(value ?? "");
  const [pending, start] = React.useTransition();
  const rowRef = React.useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = React.useState(compact);

  React.useEffect(() => {
    // A late router.refresh() must not overwrite a choice the user has
    // already made and not yet saved.
    if (dirtyRef.current) return;
    selectedRef.current = value ?? "";
    setSelected(value ?? "");
    setPersistedId(value ?? "");
  }, [value]);

  React.useEffect(() => {
    const el = rowRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      setNarrow(compact);
      return;
    }
    const update = () => {
      // Compact layouts and tight rows use the short label so it stays one line.
      setNarrow(compact || el.clientWidth < ASSIGNMENT_FULL_LABEL_MIN_WIDTH_PX + 180);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact]);

  function save() {
    const next = selectedRef.current;
    start(async () => {
      const result = await onSave(next.trim() || null);
      if (result.ok) {
        dirtyRef.current = false;
        selectedRef.current = next;
        setSelected(next);
        setPersistedId(next);
        toast.success("Assignment saved.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not save the assignment.");
      }
    });
  }

  const currentName = staff.find((member) => member.id === (value ?? ""))?.name ?? null;
  const actionLabel = pending
    ? "Saving…"
    : assignmentActionLabel(persistedId, { compact: narrow });

  return (
    <div className={compact ? "flex min-w-0 flex-wrap items-center gap-2" : "space-y-2"} data-testid={testId}>
      {compact ? (
        <span className="shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      ) : (
        <div>
          <p className="text-sm font-semibold text-heading">{label}</p>
          {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
        </div>
      )}
      {compact ? null : (
        <p className="text-sm text-foreground">
          {currentName ? currentName : "Unassigned"}
        </p>
      )}
      <div
        ref={rowRef}
        className={compact ? "flex min-w-0 flex-wrap items-center gap-2" : "flex flex-wrap items-center gap-2"}
      >
        <Select
          value={selected || "__unassigned__"}
          onValueChange={(next) => {
            const resolved = next === "__unassigned__" ? "" : next;
            dirtyRef.current = true;
            selectedRef.current = resolved;
            setSelected(resolved);
          }}
          items={[
            { value: "__unassigned__", label: "Unassigned" },
            ...staff.map((member) => ({ value: member.id, label: member.name })),
          ]}
        >
          <SelectTrigger className={compact ? "h-8 w-[9.5rem] max-w-full sm:w-40" : "h-9 w-56"} aria-label={label}>
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__unassigned__">Unassigned</SelectItem>
            {staff.map((member) => (
              <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          className={compact ? "h-8 shrink-0 whitespace-nowrap" : "shrink-0 whitespace-nowrap"}
          disabled={pending}
          onClick={save}
          data-testid={`${testId}-save`}
          data-assignment-action={persistedId.trim() ? "edit" : "save"}
          data-assignment-label={narrow ? "short" : "full"}
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
