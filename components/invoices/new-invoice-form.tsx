"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createInvoiceAction } from "@/app/(app)/invoices/actions";
import { Field } from "@/components/setup/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { clientDisplayName } from "@/lib/clients/constants";
import type { Client } from "@/lib/clients/types";
import type { InvoiceErrors, InvoiceInput } from "@/lib/invoices/types";
import { defaultInvoiceNotes, safePaymentScheduleReturnPath } from "@/lib/payments/starters";

export function NewInvoiceForm({
  clients, prefillClientId, prefillEventId, venueName = "us", returnTo,
}: {
  clients: Client[];
  prefillClientId?: string;
  prefillEventId?: string;
  venueName?: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const [input, setInput] = React.useState<InvoiceInput>({
    clientId: prefillClientId ?? "",
    eventId: prefillEventId ?? "",
    notes: defaultInvoiceNotes(venueName),
    dueDate: "",
  });
  const [errors, setErrors] = React.useState<InvoiceErrors>({});
  const [pending, startTransition] = React.useTransition();

  const selectedClient = clients.find((c) => c.id === input.clientId);
  const handoff = safePaymentScheduleReturnPath(returnTo);

  function handleSubmit() {
    startTransition(async () => {
      const result = await createInvoiceAction(input);
      if (result.ok) {
        toast.success("Invoice created. Add line items now so it can get a payment schedule.");
        const next = handoff
          ? `/invoices/${result.invoiceId}?returnTo=${encodeURIComponent(handoff)}`
          : `/invoices/${result.invoiceId}`;
        router.push(next);
        return;
      }
      if (result.errors) setErrors(result.errors);
      toast.error(result.message ?? "Please fix the highlighted fields.");
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client *" htmlFor="inv-client" error={errors.clientId}>
          <Select
            value={input.clientId}
            onValueChange={(v) => setInput((p) => ({ ...p, clientId: v, eventId: "" }))}
            items={clients.map((c) => ({ value: c.id, label: clientDisplayName(c.firstName, c.lastName, c.partnerFirstName, c.partnerLastName) }))}
          >
            <SelectTrigger id="inv-client" aria-invalid={errors.clientId ? true : undefined}>
              <SelectValue placeholder="Select client" />
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
        <Field label="Due date" htmlFor="inv-due" hint="Optional">
          <Input id="inv-due" type="date" value={input.dueDate} onChange={(e) => setInput((p) => ({ ...p, dueDate: e.target.value }))} />
        </Field>
      </div>

      <Field label="Notes from your venue" htmlFor="inv-notes" hint="Shown on the printed invoice. Safe starter copy — customize anytime.">
        <Textarea id="inv-notes" value={input.notes} onChange={(e) => setInput((p) => ({ ...p, notes: e.target.value }))}
          placeholder="Thank you for choosing us…" rows={3} />
      </Field>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="button" onClick={handleSubmit} disabled={!input.clientId || pending}>
          {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Creating…</> : "Create Invoice"}
        </Button>
      </div>
    </div>
  );
}
