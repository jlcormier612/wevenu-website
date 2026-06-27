"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createScheduleAction } from "@/app/(app)/payments/actions";
import { Field } from "@/components/setup/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { clientDisplayName } from "@/lib/clients/constants";
import type { Client } from "@/lib/clients/types";
import { SCHEDULE_PRESETS } from "@/lib/payments/constants";
import type { PaymentErrors, ScheduleInput } from "@/lib/payments/types";

export function NewScheduleForm({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [input, setInput] = React.useState<ScheduleInput>({
    title: "", clientId: "", eventId: "", totalAmount: "", notes: "",
  });
  const [presetId, setPresetId] = React.useState("fifty_fifty");
  const [errors, setErrors] = React.useState<PaymentErrors>({});
  const [pending, startTransition] = React.useTransition();

  function handleClientChange(id: string) {
    const c = clients.find((c) => c.id === id);
    setInput((p) => ({
      ...p, clientId: id,
      title: c
        ? `Payment Schedule — ${clientDisplayName(c.firstName, c.lastName, c.partnerFirstName, c.partnerLastName)}`
        : p.title,
      totalAmount: p.totalAmount,
    }));
  }

  function handleSubmit() {
    startTransition(async () => {
      const selectedClient = clients.find((c) => c.id === input.clientId);
      const result = await createScheduleAction(input, presetId, selectedClient?.eventDate ?? null);
      if (result.ok) { toast.success("Payment schedule created."); router.push(`/payments/${result.scheduleId}`); return; }
      if (result.errors) setErrors(result.errors);
      toast.error(result.message ?? "Please fix the highlighted fields.");
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client *" htmlFor="ps-client" error={errors.clientId}>
          <Select value={input.clientId} onValueChange={handleClientChange}>
            <SelectTrigger id="ps-client" aria-invalid={errors.clientId ? true : undefined}>
              <SelectValue placeholder="Select a client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {clientDisplayName(c.firstName, c.lastName, c.partnerFirstName, c.partnerLastName)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Total contract amount *" htmlFor="ps-total" error={errors.totalAmount}>
          <Input id="ps-total" value={input.totalAmount}
            onChange={(e) => { setInput((p) => ({ ...p, totalAmount: e.target.value })); setErrors((p) => { const n = {...p}; delete n.totalAmount; return n; }); }}
            placeholder="18,000" aria-invalid={errors.totalAmount ? true : undefined} />
        </Field>
      </div>

      <Field label="Schedule title *" htmlFor="ps-title" error={errors.title}>
        <Input id="ps-title" value={input.title}
          onChange={(e) => { setInput((p) => ({ ...p, title: e.target.value })); setErrors((p) => { const n = {...p}; delete n.title; return n; }); }}
          placeholder="Payment Schedule — Couple Name" aria-invalid={errors.title ? true : undefined} />
      </Field>

      <Separator />
      <div className="space-y-3">
        <p className="text-sm font-medium text-heading">Payment structure</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {SCHEDULE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setPresetId(preset.id)}
              className={`rounded-lg border p-3 text-left transition-colors ${presetId === preset.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"}`}
            >
              <p className="text-sm font-medium text-foreground">{preset.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Dates are calculated from the event date (if set on the client). You can adjust everything after creation.
        </p>
      </div>

      <Field label="Internal notes" htmlFor="ps-notes" hint="Optional — visible only to your team.">
        <Textarea id="ps-notes" value={input.notes}
          onChange={(e) => setInput((p) => ({ ...p, notes: e.target.value }))}
          placeholder="Any notes about this payment arrangement…" rows={2} />
      </Field>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="button" onClick={handleSubmit} disabled={pending}>
          {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Creating…</> : "Create Schedule"}
        </Button>
      </div>
    </div>
  );
}
