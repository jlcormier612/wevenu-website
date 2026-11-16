"use client";

import * as React from "react";
import { toast } from "sonner";

import { setHostedEventTypesAction } from "@/app/(app)/setup-hub/actions";
import { Button } from "@/components/ui/button";
import {
  HOSTED_EVENT_TYPE_OPTIONS,
  type HostedEventTypeValue,
} from "@/lib/setup-hub/phase-b1-event-types";

export function HostedEventTypesForm({
  initialTypes,
}: {
  initialTypes: HostedEventTypeValue[];
}) {
  const [selected, setSelected] = React.useState<HostedEventTypeValue[]>(initialTypes);
  const [pending, startTransition] = React.useTransition();

  function toggle(value: HostedEventTypeValue) {
    setSelected((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function save() {
    startTransition(async () => {
      const result = await setHostedEventTypesAction(selected);
      if (result.ok) toast.success("Saved.");
      else toast.error(result.error ?? "Could not save your event types yet.");
    });
  }

  return (
    <div className="space-y-4" data-testid="phase-b1-hosted-event-types">
      <fieldset className="space-y-3">
        <legend className="font-heading text-lg font-medium text-heading">
          What types of events does your venue host?
        </legend>
        <p className="text-sm text-muted-foreground">
          Choose the types of events you want to manage in HTC. We&apos;ll help you prepare an experience
          for each one. You can always add more later.
        </p>
        {HOSTED_EVENT_TYPE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-3"
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={selected.includes(option.value)}
              onChange={() => toggle(option.value)}
              data-testid={`phase-b1-hosted-type-${option.value}`}
            />
            <span className="min-w-0 flex-1 whitespace-normal break-words text-sm text-foreground">
              {"checkboxLabel" in option ? option.checkboxLabel : option.label}
            </span>
          </label>
        ))}
      </fieldset>
      <Button
        type="button"
        disabled={pending || selected.length === 0}
        onClick={save}
        data-testid="phase-b1-save-hosted-types"
      >
        Save event types
      </Button>
      <p className="text-xs text-muted-foreground">
        Only selected event types need to be prepared. You can add more later.
      </p>
    </div>
  );
}
