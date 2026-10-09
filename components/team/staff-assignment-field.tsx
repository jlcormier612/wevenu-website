"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [pending, start] = React.useTransition();

  React.useEffect(() => {
    setSelected(value ?? "");
  }, [value]);

  function save() {
    start(async () => {
      const result = await onSave(selected.trim() || null);
      if (result.ok) {
        toast.success("Assignment saved.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not save the assignment.");
      }
    });
  }

  const currentName = staff.find((member) => member.id === (value ?? ""))?.name ?? null;

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
      <div className={compact ? "flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-none" : "flex flex-wrap items-center gap-2"}>
        <Select
          value={selected || "__unassigned__"}
          onValueChange={(next) => setSelected(next === "__unassigned__" ? "" : next)}
          items={[
            { value: "__unassigned__", label: "Unassigned" },
            ...staff.map((member) => ({ value: member.id, label: member.name })),
          ]}
        >
          <SelectTrigger className={compact ? "h-8 w-full min-w-[10.5rem] sm:w-52" : "h-9 w-56"} aria-label={label}>
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__unassigned__">Unassigned</SelectItem>
            {staff.map((member) => (
              <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" className={compact ? "h-8 shrink-0" : undefined} disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save assignment"}
        </Button>
      </div>
    </div>
  );
}
