"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createLeadAction, previewPossibleDuplicateLeadAction } from "@/app/(app)/leads/actions";
import { checkAvailabilityAction, markScheduleItemConvertedAction } from "@/app/(app)/availability/actions";
import { LeadDateUnavailableDialog } from "@/components/leads/lead-date-unavailable-dialog";
import { PreferredDateConflictPanel } from "@/components/leads/preferred-date-conflict-panel";
import { PossibleMatchCreateDialog } from "@/components/leads/possible-match-create-dialog";
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
import type { VenueEventTypeOption } from "@/lib/event-types/venue-options";
import type { ConflictItem } from "@/lib/availability/types";
import {
  LEAD_SOURCES,
  createInitialLeadInput,
  formatMoneyInputDisplay,
  parseMoneyInput,
} from "@/lib/leads/constants";
import type { DuplicateCandidate } from "@/lib/leads/duplicate-detection";
import {
  PREFERRED_EVENT_DATE_HINT,
  PREFERRED_EVENT_DATE_LABEL,
  blockingPreferredDateConflicts,
  isStalePreferredDateResult,
  saveMaySkipPreferredDateDialog,
} from "@/lib/leads/preferred-date-check";
import type { LeadErrors, LeadInput } from "@/lib/leads/types";
import type { IdentityDecision } from "@/lib/identity/decision";
import {
  INTERNAL_NOTES_LABEL,
  NEW_LEAD_INTERNAL_NOTES_HINT,
} from "@/lib/notes/internal-notes-copy";

function TextField({
  id, label, value, onChange, error, hint, type = "text",
  placeholder, required, autoComplete, inputMode, onBlur, onFocus,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  error?: string; hint?: string; type?: string; placeholder?: string;
  required?: boolean; autoComplete?: string; inputMode?: React.ComponentProps<typeof Input>["inputMode"];
  onBlur?: () => void;
  onFocus?: () => void;
}) {
  return (
    <Field label={label} htmlFor={id} required={required} error={error} hint={hint}>
      <Input id={id} type={type} value={value} placeholder={placeholder}
        autoComplete={autoComplete} inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onFocus={onFocus} />
    </Field>
  );
}

function legacyCurrentDescription(
  options: VenueEventTypeOption[] | { value: string; label: string }[],
  value: string,
): string | undefined {
  for (const option of options) {
    if (!("isLegacyCurrent" in option) || option.isLegacyCurrent !== true) continue;
    if (option.value !== value) continue;
    if ("description" in option && typeof option.description === "string") {
      return option.description;
    }
  }
  return undefined;
}

function SelectField({
  id, label, value, onValueChange, options, placeholder, error, hint,
}: {
  id: string; label: string; value: string; onValueChange: (v: string) => void;
  options: VenueEventTypeOption[] | { value: string; label: string }[];
  placeholder?: string;
  error?: string; hint?: string;
}) {
  const legacyHint = hint ?? legacyCurrentDescription(options, value);

  return (
    <Field label={label} htmlFor={id} error={error} hint={legacyHint}>
      {/* `items` makes Select.Value show the matched option's label
          instead of the raw stored value (Base UI doesn't derive this
          automatically the way Radix does). */}
      <Select value={value} onValueChange={onValueChange} items={options}>
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

type PreferredDateCheckState = {
  date: string;
  checking: boolean;
  checkFailed: boolean;
  conflicts: ConflictItem[];
};

export function NewInquiryForm({
  initial, fromBlockId, eventTypeOptions, venueTimezone,
}: {
  /** Calendar Booking Placeholder — "Convert to Booking" pre-fill. Merged over the usual blank defaults; every field stays editable. */
  initial?: Partial<LeadInput>;
  /** Set only when arriving via "Convert to Booking" — marks the originating placeholder converted once this Lead is actually created. */
  fromBlockId?: string;
  /** Venue accepted inquiry types (plus convert-from-hold legacy current when needed). */
  eventTypeOptions: VenueEventTypeOption[];
  /** Venue IANA timezone — Inquiry date defaults to this calendar's today. */
  venueTimezone?: string | null;
}) {
  const router = useRouter();
  const [input, setInput] = React.useState<LeadInput>(() => ({
    ...createInitialLeadInput(venueTimezone),
    ...initial,
  }));
  const [errors, setErrors] = React.useState<LeadErrors>({});
  const [pending, startTransition] = React.useTransition();
  const [matchOpen, setMatchOpen] = React.useState(false);
  const [matches, setMatches] = React.useState<DuplicateCandidate[]>([]);
  const [dateWarnOpen, setDateWarnOpen] = React.useState(false);
  const [dateReasons, setDateReasons] = React.useState<ConflictItem[]>([]);
  const pendingDecisionRef = React.useRef<IdentityDecision | undefined>(undefined);
  const dateInputRef = React.useRef<HTMLInputElement | null>(null);
  const preferredCheckGen = React.useRef(0);
  const eventDateRef = React.useRef(input.eventDate);
  const [acknowledgedPreferredDate, setAcknowledgedPreferredDate] = React.useState<string | null>(null);
  const [preferredCheck, setPreferredCheck] = React.useState<PreferredDateCheckState>({
    date: "",
    checking: false,
    checkFailed: false,
    conflicts: [],
  });

  eventDateRef.current = input.eventDate;

  const set = <K extends keyof LeadInput>(key: K, value: LeadInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
  };

  const runPreferredDateCheck = React.useCallback(async (date: string) => {
    const trimmed = date.trim();
    if (!trimmed) {
      preferredCheckGen.current += 1;
      setPreferredCheck({ date: "", checking: false, checkFailed: false, conflicts: [] });
      return;
    }
    const requestId = ++preferredCheckGen.current;
    setPreferredCheck({ date: trimmed, checking: true, checkFailed: false, conflicts: [] });
    try {
      const status = await checkAvailabilityAction({
        date: trimmed,
        type: "event",
        purpose: "preferred_date",
      });
      if (isStalePreferredDateResult(requestId, preferredCheckGen.current, trimmed, eventDateRef.current.trim())) {
        return;
      }
      setPreferredCheck({
        date: trimmed,
        checking: false,
        checkFailed: false,
        conflicts: blockingPreferredDateConflicts(status),
      });
    } catch {
      if (isStalePreferredDateResult(requestId, preferredCheckGen.current, trimmed, eventDateRef.current.trim())) {
        return;
      }
      setPreferredCheck({
        date: trimmed,
        checking: false,
        checkFailed: true,
        conflicts: [],
      });
    }
  }, []);

  function setPreferredEventDate(value: string) {
    set("eventDate", value);
    setAcknowledgedPreferredDate(null);
    setDateWarnOpen(false);
    void runPreferredDateCheck(value);
  }

  React.useEffect(() => {
    const initialDate = input.eventDate?.trim();
    if (initialDate) void runPreferredDateCheck(initialDate);
    // Prefill from Calendar convert-to-lead only — intentional mount once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveLead(decision?: IdentityDecision) {
    const result = await createLeadAction({ ...input, identityDecision: decision });
    if (result.ok) {
      if (fromBlockId) {
        // Best-effort — the Lead is the source of truth either way; if
        // this fails, the placeholder just stays un-marked, not broken.
        await markScheduleItemConvertedAction(fromBlockId, result.leadId).catch(() => {});
      }
      toast.success("Inquiry saved.");
      router.push(`/leads/${result.leadId}`);
      return;
    }
    if ("errors" in result && result.errors) setErrors(result.errors);
    toast.error(result.message ?? "Please fix the highlighted fields.");
  }

  /** Soft availability gate — never hard-blocks Lead create. Always rechecks on save. */
  async function checkPreferredDateThenSave(decision?: IdentityDecision) {
    const date = input.eventDate?.trim();
    if (!date) {
      await saveLead(decision);
      return;
    }
    let status;
    try {
      status = await checkAvailabilityAction({
        date,
        type: "event",
        purpose: "preferred_date",
      });
    } catch {
      toast.error("Could not recheck availability. Try again.");
      return;
    }
    const blocking = blockingPreferredDateConflicts(status);
    setPreferredCheck({
      date,
      checking: false,
      checkFailed: false,
      conflicts: blocking,
    });
    if (saveMaySkipPreferredDateDialog({
      date,
      acknowledgedDate: acknowledgedPreferredDate,
      blocking,
    })) {
      await saveLead(decision);
      return;
    }
    pendingDecisionRef.current = decision;
    setDateReasons(blocking);
    setDateWarnOpen(true);
  }

  function handleSubmit() {
    startTransition(async () => {
      const preview = await previewPossibleDuplicateLeadAction({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        partnerFirstName: input.partnerFirstName,
        partnerLastName: input.partnerLastName,
        partnerEmail: input.partnerEmail,
      });
      if (preview.ok && preview.matches.length > 0) {
        setMatches(preview.matches);
        setMatchOpen(true);
        return;
      }
      await checkPreferredDateThenSave();
    });
  }

  const showPreferredPanel = !!input.eventDate?.trim()
    && (preferredCheck.checking
      || preferredCheck.checkFailed
      || preferredCheck.conflicts.length > 0);

  return (
    <div className="space-y-6">
      <PossibleMatchCreateDialog
        open={matchOpen}
        matches={matches}
        pending={pending}
        onCancel={() => setMatchOpen(false)}
        onDecide={(decision) => {
          setMatchOpen(false);
          startTransition(async () => {
            await checkPreferredDateThenSave(decision);
          });
        }}
      />
      <LeadDateUnavailableDialog
        open={dateWarnOpen}
        reasons={dateReasons}
        pending={pending}
        onGoBack={() => {
          setDateWarnOpen(false);
          pendingDecisionRef.current = undefined;
          requestAnimationFrame(() => dateInputRef.current?.focus());
        }}
        onSaveAnyway={() => {
          const date = input.eventDate?.trim() || null;
          setAcknowledgedPreferredDate(date);
          setDateWarnOpen(false);
          const decision = pendingDecisionRef.current;
          pendingDecisionRef.current = undefined;
          startTransition(async () => {
            await saveLead(decision);
          });
        }}
      />
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
            onValueChange={(v) => set("eventType", v)} options={eventTypeOptions}
            placeholder="Select a type" error={errors.eventType} />
          <Field
            label={PREFERRED_EVENT_DATE_LABEL}
            htmlFor="eventDate"
            error={errors.eventDate}
            hint={PREFERRED_EVENT_DATE_HINT}
          >
            <Input
              id="eventDate"
              ref={dateInputRef}
              type="date"
              value={input.eventDate}
              data-testid="preferred-event-date"
              aria-invalid={errors.eventDate ? true : undefined}
              onChange={(e) => setPreferredEventDate(e.target.value)}
            />
          </Field>
        </div>
        {showPreferredPanel ? (
          <PreferredDateConflictPanel
            checking={preferredCheck.checking}
            checkFailed={preferredCheck.checkFailed}
            conflicts={preferredCheck.conflicts}
            acknowledged={acknowledgedPreferredDate === input.eventDate?.trim()}
            onChooseAnother={() => {
              requestAnimationFrame(() => {
                dateInputRef.current?.focus();
                dateInputRef.current?.showPicker?.();
              });
            }}
            onKeepPreferred={() => {
              const date = input.eventDate?.trim() || null;
              setAcknowledgedPreferredDate(date);
            }}
          />
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="guestCount" label="Estimated guests" type="number"
            inputMode="numeric" value={input.guestCount} error={errors.guestCount}
            onChange={(v) => set("guestCount", v)} placeholder="150" />
          <TextField id="estimatedBudget" label="Estimated budget (USD)" value={input.estimatedBudget}
            onChange={(v) => set("estimatedBudget", v)} error={errors.estimatedBudget}
            placeholder="$20,000" inputMode="decimal"
            onBlur={() => set("estimatedBudget", formatMoneyInputDisplay(input.estimatedBudget))}
            onFocus={() => set("estimatedBudget", parseMoneyInput(input.estimatedBudget))} />
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
        <Field
          label={INTERNAL_NOTES_LABEL}
          htmlFor="inquiryMessage"
          hint={NEW_LEAD_INTERNAL_NOTES_HINT}
        >
          <Textarea id="inquiryMessage" value={input.inquiryMessage} rows={4}
            placeholder="Private venue notes — not the customer's original inquiry."
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
