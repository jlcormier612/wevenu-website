"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createLeadAction } from "@/app/(app)/leads/actions";
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
import {
  EVENT_TYPES,
  LEAD_SOURCES,
  createInitialLeadInput,
} from "@/lib/leads/constants";
import type { LeadErrors, LeadInput } from "@/lib/leads/types";

function TextField({
  id, label, value, onChange, error, hint, type = "text",
  placeholder, required, autoComplete, inputMode,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  error?: string; hint?: string; type?: string; placeholder?: string;
  required?: boolean; autoComplete?: string; inputMode?: React.ComponentProps<typeof Input>["inputMode"];
}) {
  return (
    <Field label={label} htmlFor={id} required={required} error={error} hint={hint}>
      <Input id={id} type={type} value={value} placeholder={placeholder}
        autoComplete={autoComplete} inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function SelectField({
  id, label, value, onValueChange, options, placeholder, error, hint,
}: {
  id: string; label: string; value: string; onValueChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
  error?: string; hint?: string;
}) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} aria-invalid={error ? true : undefined}>
          <SelectValue placeholder={placeholder ?? "Select…"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function NewInquiryForm() {
  const router = useRouter();
  const [input, setInput] = React.useState<LeadInput>(createInitialLeadInput);
  const [errors, setErrors] = React.useState<LeadErrors>({});
  const [pending, startTransition] = React.useTransition();

  const set = <K extends keyof LeadInput>(key: K, value: LeadInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
  };

  function handleSubmit() {
    startTransition(async () => {
      const result = await createLeadAction(input);
      if (result.ok) {
        toast.success("Inquiry saved.");
        router.push(`/leads/${result.leadId}`);
        return;
      }
      if (result.errors) setErrors(result.errors);
      toast.error(result.message ?? "Please fix the highlighted fields.");
    });
  }

  return (
    <div className="space-y-6">
      {/* Contact information */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-heading">Contact information</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="firstName" label="First name" required value={input.firstName}
            onChange={(v) => set("firstName", v)} error={errors.firstName}
            autoComplete="given-name" />
          <TextField id="lastName" label="Last name" required value={input.lastName}
            onChange={(v) => set("lastName", v)} error={errors.lastName}
            autoComplete="family-name" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="email" label="Email" type="email" value={input.email}
            onChange={(v) => set("email", v)} error={errors.email}
            placeholder="their@email.com" autoComplete="email" />
          <TextField id="phone" label="Phone" type="tel" value={input.phone}
            onChange={(v) => set("phone", v)} placeholder="(555) 000-0000" />
        </div>
      </div>

      <Separator />

      {/* Partner contact */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-heading">
          Partner contact <span className="font-normal text-muted-foreground">(optional)</span>
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="partnerFirstName" label="Partner first name" value={input.partnerFirstName}
            onChange={(v) => set("partnerFirstName", v)} />
          <TextField id="partnerLastName" label="Partner last name" value={input.partnerLastName}
            onChange={(v) => set("partnerLastName", v)} />
        </div>
        <TextField id="partnerEmail" label="Partner email" type="email" value={input.partnerEmail}
          onChange={(v) => set("partnerEmail", v)} error={errors.partnerEmail}
          placeholder="partner@email.com" />
      </div>

      <Separator />

      {/* Event details */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-heading">Event details</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="eventType" label="Event type" value={input.eventType}
            onValueChange={(v) => set("eventType", v)} options={EVENT_TYPES}
            placeholder="Select a type" />
          <TextField id="eventDate" label="Event date" type="date" value={input.eventDate}
            onChange={(v) => set("eventDate", v)} error={errors.eventDate} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="guestCount" label="Estimated guests" type="number"
            inputMode="numeric" value={input.guestCount} error={errors.guestCount}
            onChange={(v) => set("guestCount", v)} placeholder="150" />
          <TextField id="estimatedBudget" label="Estimated budget (USD)" value={input.estimatedBudget}
            onChange={(v) => set("estimatedBudget", v)} error={errors.estimatedBudget}
            placeholder="10,000" inputMode="numeric" />
        </div>
      </div>

      <Separator />

      {/* Inquiry metadata */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-heading">Inquiry</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="source" label="How did they find you?" value={input.source}
            onValueChange={(v) => set("source", v)} options={LEAD_SOURCES}
            placeholder="Select source" />
          <TextField id="inquiryDate" label="Inquiry date" type="date" value={input.inquiryDate}
            onChange={(v) => set("inquiryDate", v)} />
        </div>
        <Field label="Message / notes" htmlFor="inquiryMessage">
          <Textarea id="inquiryMessage" value={input.inquiryMessage} rows={4}
            placeholder="Any details from the initial inquiry…"
            onChange={(e) => set("inquiryMessage", e.target.value)} />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={pending}>
          {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Saving…</> : "Save inquiry"}
        </Button>
      </div>
    </div>
  );
}
