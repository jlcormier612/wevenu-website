"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createRetainerAction } from "@/app/(app)/payments/actions";
import { Field } from "@/components/setup/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/**
 * Booking Financial Architecture Phase 1's "booking-confirmation moment"
 * shortcut (docs/booking-financial-architecture-roadmap.md) — a real,
 * linked Invoice + Payment Schedule pair in one step, so a coordinator can
 * collect a deposit before Package/Event Order exist. Deliberately manual,
 * not automated yet — Phase 7 is where this becomes system-triggered.
 */
export function CreateRetainerSheet({ eventId, clientId }: { eventId: string; clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function reset() { setAmount(""); setDueDate(""); setError(""); }

  function handleSubmit() {
    if (!amount.trim()) { setError("Enter a retainer amount."); return; }
    startTransition(async () => {
      const result = await createRetainerAction({ clientId, eventId, amount, dueDate: dueDate || undefined });
      if (!result.ok) { setError(result.message); toast.error(result.message); return; }
      toast.success("Retainer invoice and payment plan created.");
      setOpen(false);
      reset();
      router.push(`/invoices/${result.invoiceId}`);
    });
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <SheetTrigger render={<Button type="button" size="sm" />}>
        Create Retainer Invoice
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="mb-6">
          <SheetTitle>Create a retainer invoice</SheetTitle>
          <p className="text-sm text-muted-foreground">
            A single-line invoice and its matching payment plan, ready in one step — nothing here needs to be final. Add packages or more line items to this same invoice later.
          </p>
        </SheetHeader>
        <div className="space-y-4">
          <Field label="Retainer amount *" htmlFor="retainer-amount" error={error || undefined}>
            <Input id="retainer-amount" value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(""); }}
              placeholder="1,500" aria-invalid={error ? true : undefined} />
          </Field>
          <Field label="Due date" htmlFor="retainer-due" hint="Optional — leave blank if due immediately.">
            <Input id="retainer-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button type="button" onClick={handleSubmit} disabled={pending}>
            {pending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creating…</> : "Create"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
