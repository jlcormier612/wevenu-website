"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateLeadInfoAction } from "@/app/(app)/leads/[id]/actions";
import { Field } from "@/components/setup/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_TYPES, LEAD_SOURCES } from "@/lib/leads/constants";
import type { Lead, LeadErrors, LeadInput } from "@/lib/leads/types";

function leadToInput(lead: Lead): LeadInput {
  return {
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    partnerFirstName: lead.partnerFirstName ?? "",
    partnerLastName: lead.partnerLastName ?? "",
    partnerEmail: lead.partnerEmail ?? "",
    eventType: lead.eventType ?? "",
    eventDate: lead.eventDate ?? "",
    endDate: lead.endDate ?? "",
    guestCount: lead.guestCount != null ? String(lead.guestCount) : "",
    estimatedBudget: lead.estimatedBudget != null ? String(lead.estimatedBudget) : "",
    source: lead.source ?? "",
    inquiryMessage: lead.inquiryMessage ?? "",
    inquiryDate: lead.inquiryDate,
  };
}

export function LeadEditForm({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [input, setInput] = React.useState<LeadInput>(() => leadToInput(lead));
  const [errors, setErrors] = React.useState<LeadErrors>({});
  const [pending, startTransition] = React.useTransition();

  const set = <K extends keyof LeadInput>(key: K, value: LeadInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
  };

  function handleSubmit() {
    startTransition(async () => {
      const result = await updateLeadInfoAction(lead.id, input);
      if (result.ok) {
        toast.success("Lead updated.");
        router.push(`/leads/${lead.id}`);
        router.refresh();
        return;
      }
      if (result.errors) setErrors(result.errors);
      toast.error(result.message ?? "Please fix the highlighted fields.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-sm font-medium text-heading">Contact information</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="fn" required error={errors.firstName}>
            <Input id="fn" value={input.firstName} onChange={(e) => set("firstName", e.target.value)} aria-invalid={errors.firstName ? true : undefined} />
          </Field>
          <Field label="Last name" htmlFor="ln" required error={errors.lastName}>
            <Input id="ln" value={input.lastName} onChange={(e) => set("lastName", e.target.value)} aria-invalid={errors.lastName ? true : undefined} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="em" error={errors.email}>
            <Input id="em" type="email" value={input.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="ph">
            <Input id="ph" type="tel" value={input.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <p className="text-sm font-medium text-heading">
          Partner contact <span className="font-normal text-muted-foreground">(optional)</span>
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Partner first name" htmlFor="pfn">
            <Input id="pfn" value={input.partnerFirstName} onChange={(e) => set("partnerFirstName", e.target.value)} />
          </Field>
          <Field label="Partner last name" htmlFor="pln">
            <Input id="pln" value={input.partnerLastName} onChange={(e) => set("partnerLastName", e.target.value)} />
          </Field>
        </div>
        <Field label="Partner email" htmlFor="pem" error={errors.partnerEmail}>
          <Input id="pem" type="email" value={input.partnerEmail} onChange={(e) => set("partnerEmail", e.target.value)} />
        </Field>
      </div>

      <Separator />

      <div className="space-y-4">
        <p className="text-sm font-medium text-heading">Event details</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Event type" htmlFor="et">
            <Select value={input.eventType} onValueChange={(v) => set("eventType", v)}>
              <SelectTrigger id="et"><SelectValue placeholder="Select a type" /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Event date" htmlFor="ed">
            <Input id="ed" type="date" value={input.eventDate} onChange={(e) => set("eventDate", e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Estimated guests" htmlFor="gc" error={errors.guestCount}>
            <Input id="gc" type="number" value={input.guestCount} onChange={(e) => set("guestCount", e.target.value)} placeholder="150" />
          </Field>
          <Field label="Estimated budget (USD)" htmlFor="eb" error={errors.estimatedBudget}>
            <Input id="eb" value={input.estimatedBudget} onChange={(e) => set("estimatedBudget", e.target.value)} placeholder="10,000" />
          </Field>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <p className="text-sm font-medium text-heading">Inquiry</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="How did they find you?" htmlFor="src">
            <Select value={input.source} onValueChange={(v) => set("source", v)}>
              <SelectTrigger id="src"><SelectValue placeholder="Select source" /></SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Inquiry date" htmlFor="iqd">
            <Input id="iqd" type="date" value={input.inquiryDate} onChange={(e) => set("inquiryDate", e.target.value)} />
          </Field>
        </div>
        <Field label="Message / notes" htmlFor="msg">
          <Textarea id="msg" value={input.inquiryMessage} rows={4}
            placeholder="Notes from the initial inquiry…"
            onChange={(e) => set("inquiryMessage", e.target.value)} />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={pending}>
          {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Saving…</> : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
