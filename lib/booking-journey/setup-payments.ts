import { remainingAmount, roundMoney } from "@/lib/commercial-selections/constants";
import {
  getSelectedPackage,
  linkSelectionInvoice,
} from "@/lib/commercial-selections/service";
import type { CommercialSelection } from "@/lib/commercial-selections/types";
import { createClient } from "@/integrations/supabase/server";
import {
  createInvoice,
  addLineItem as addInvoiceLine,
  updateInvoiceStatus,
} from "@/lib/invoices/service";
import { SCHEDULE_PRESETS } from "@/lib/payments/constants";
import { allocatePresetAmounts } from "@/lib/payments/starters";
import { createPaymentSchedule, addLineItem, deletePaymentSchedule } from "@/lib/payments/service";
import type { PaymentObligationKind } from "@/lib/payments/types";
import { getCurrentVenue, getCurrentUserRole } from "@/lib/venue/service";
import { getVenueTimezone, venueToday } from "@/lib/venue/timezone";
import { isSupabaseConfigured } from "@/lib/env";

export type SetupPaymentsResult =
  | { ok: true; invoiceId: string; scheduleId: string }
  | { ok: false; message: string };

export type SetupPaymentsInput = {
  selectionId: string;
  clientId: string;
  eventId?: string | null;
  depositAmount?: number;
  requestDeposit?: boolean;
  /** YYYY-MM-DD — required when remaining > 0 and no event date is available. */
  remainingDueDate?: string | null;
  /** YYYY-MM-DD event date when known (preferred remaining due date). */
  eventDate?: string | null;
  /**
   * Schedule structure:
   * - omit / "deposit_remaining" — deposit + final remaining
   * - "full" — one full-payment (deposit) line for the commitment
   * - a SCHEDULE_PRESETS id — deposit override + remaining installments from preset
   */
  scheduleStructure?: string | null;
};

/** Pure: resolve deposit (today) + remaining due dates for guided setup. */
export function resolveGuidedSetupDueDates(input: {
  depositAmount: number;
  remainingAmount: number;
  today: string;
  eventDate?: string | null;
  remainingDueDate?: string | null;
}): { ok: true; depositDueDate: string; remainingDueDate: string | null } | { ok: false; message: string } {
  const depositDueDate = input.today;
  if (!(input.remainingAmount > 0)) {
    return { ok: true, depositDueDate, remainingDueDate: null };
  }
  const fromInput = input.remainingDueDate?.trim() || null;
  const fromEvent = input.eventDate?.trim() || null;
  const remainingDueDate = fromInput || fromEvent;
  if (!remainingDueDate || !/^\d{4}-\d{2}-\d{2}$/.test(remainingDueDate)) {
    return {
      ok: false,
      message:
        "Set a due date for the remaining balance (or add the event date) before setting up payments.",
    };
  }
  return { ok: true, depositDueDate, remainingDueDate };
}

export type ScheduleLineDraft = {
  label: string;
  amount: number;
  dueDate: string;
  obligationKind: PaymentObligationKind;
};

/**
 * Build schedule lines that reconcile exactly to the commitment total.
 * Catalog presets are starting points; the deposit amount is the booking commitment.
 */
export function buildGuidedScheduleLines(input: {
  total: number;
  deposit: number;
  today: string;
  remainingDueDate: string | null;
  eventDate?: string | null;
  scheduleStructure?: string | null;
}): { ok: true; lines: ScheduleLineDraft[] } | { ok: false; message: string } {
  const total = roundMoney(input.total);
  const deposit = roundMoney(input.deposit);
  const remaining = remainingAmount(total, deposit);
  const structure = input.scheduleStructure?.trim() || "deposit_remaining";

  if (structure === "full" || remaining <= 0) {
    return {
      ok: true,
      lines: [
        {
          label: remaining <= 0 && structure === "full" ? "Full payment" : remaining <= 0 ? "Full payment" : "Deposit",
          amount: total,
          dueDate: input.today,
          obligationKind: "deposit",
        },
      ],
    };
  }

  const preset = structure !== "deposit_remaining"
    ? SCHEDULE_PRESETS.find((p) => p.id === structure && p.items.length > 0)
    : null;

  if (!preset) {
    if (!input.remainingDueDate) {
      return { ok: false, message: "Set a due date for the remaining balance." };
    }
    return {
      ok: true,
      lines: [
        {
          label: "Deposit",
          amount: deposit,
          dueDate: input.today,
          obligationKind: "deposit",
        },
        {
          label: "Remaining balance",
          amount: remaining,
          dueDate: input.remainingDueDate,
          obligationKind: "final",
        },
      ],
    };
  }

  const baseAmounts = allocatePresetAmounts(total, preset.items);
  const restOriginal = roundMoney(baseAmounts.slice(1).reduce((s, a) => s + a, 0));
  const restLines = preset.items.slice(1).map((item, i) => {
    const raw = baseAmounts[i + 1] ?? 0;
    const share = restOriginal > 0 ? raw / restOriginal : 1 / Math.max(1, preset.items.length - 1);
    return {
      item,
      amount: roundMoney(remaining * share),
    };
  });
  const restSum = roundMoney(restLines.reduce((s, l) => s + l.amount, 0));
  if (restLines.length > 0 && restSum !== remaining) {
    restLines[restLines.length - 1]!.amount = roundMoney(
      restLines[restLines.length - 1]!.amount + (remaining - restSum),
    );
  }

  const eventDate = input.eventDate ?? input.remainingDueDate;
  const lines: ScheduleLineDraft[] = [
    {
      label: preset.items[0]?.label ?? "Deposit",
      amount: deposit,
      dueDate: input.today,
      obligationKind: "deposit",
    },
  ];
  for (const { item, amount } of restLines) {
    let dueDate = input.remainingDueDate ?? input.today;
    if (item.timing.type === "before_event" && eventDate) {
      const d = new Date(`${eventDate}T12:00:00`);
      d.setDate(d.getDate() - (item.timing.days ?? 30));
      dueDate = d.toISOString().slice(0, 10);
    } else if (item.timing.type === "after_booking") {
      const d = new Date(`${input.today}T12:00:00`);
      d.setDate(d.getDate() + (item.timing.days ?? 30));
      dueDate = d.toISOString().slice(0, 10);
    }
    lines.push({
      label: item.label,
      amount,
      dueDate,
      obligationKind: item.obligationKind,
    });
  }

  const sum = roundMoney(lines.reduce((s, l) => s + l.amount, 0));
  if (sum !== total) {
    return { ok: false, message: "Payment schedule must reconcile to the commitment total." };
  }
  return { ok: true, lines };
}

export type RecoverableCommitment = { invoiceId: string; scheduleId: string };

export type SetupPaymentsDeps = {
  getSelection: (id: string) => Promise<CommercialSelection | null>;
  findRecoverable: (
    selection: CommercialSelection,
    clientId: string,
  ) => Promise<RecoverableCommitment | null>;
  linkSelection: (selectionId: string, invoiceId: string) => Promise<{ ok: true } | { ok: false; message?: string }>;
  createInvoice: typeof createInvoice;
  addInvoiceLine: typeof addInvoiceLine;
  createPaymentSchedule: typeof createPaymentSchedule;
  addLineItem: typeof addLineItem;
  updateInvoiceStatus: typeof updateInvoiceStatus;
  compensate: (invoiceId: string, scheduleId: string | null) => Promise<void>;
  today: string;
};

function commitmentNotes(selectionName: string): string {
  return `${selectionName} — booking commitment`;
}

/**
 * Injectable guided setup — unit-tested for fail-after-invoice / fail-after-schedule / link failure.
 */
export async function runSetupPaymentsFromSelection(
  input: SetupPaymentsInput,
  deps: SetupPaymentsDeps,
): Promise<SetupPaymentsResult> {
  const selection = await deps.getSelection(input.selectionId);
  if (!selection || selection.status === "superseded") {
    return { ok: false, message: "Selected package not found." };
  }
  if (selection.invoiceId) {
    return {
      ok: false,
      message: "Payments are already set up for this selected package. Open the existing invoice instead.",
    };
  }

  const recovered = await deps.findRecoverable(selection, input.clientId);
  if (recovered) {
    const linked = await deps.linkSelection(selection.id, recovered.invoiceId);
    if (!linked.ok) {
      return {
        ok: false,
        message: linked.message ?? "Could not link the existing payment setup to this package.",
      };
    }
    if (input.requestDeposit) {
      await deps.updateInvoiceStatus(recovered.invoiceId, "sent").catch(() => {
        /* best-effort */
      });
    }
    return { ok: true, invoiceId: recovered.invoiceId, scheduleId: recovered.scheduleId };
  }

  const total = roundMoney(selection.totalAmount);
  let deposit = roundMoney(
    input.depositAmount != null ? input.depositAmount : selection.depositAmount,
  );
  if (input.scheduleStructure === "full") {
    deposit = total;
  }
  if (!(total > 0)) return { ok: false, message: "Package total must be greater than zero." };
  if (!(deposit >= 0) || deposit > total) {
    return { ok: false, message: "Enter a valid deposit amount." };
  }
  const remaining = remainingAmount(total, deposit);
  const dueDates = resolveGuidedSetupDueDates({
    depositAmount: deposit,
    remainingAmount: remaining,
    today: deps.today,
    eventDate: input.eventDate,
    remainingDueDate: input.remainingDueDate,
  });
  if (!dueDates.ok) return dueDates;

  const scheduleLines = buildGuidedScheduleLines({
    total,
    deposit,
    today: deps.today,
    remainingDueDate: dueDates.remainingDueDate,
    eventDate: input.eventDate,
    scheduleStructure: input.scheduleStructure,
  });
  if (!scheduleLines.ok) return scheduleLines;

  let invoiceId: string | null = null;
  let scheduleId: string | null = null;

  try {
    const { defaultInvoiceDisplayName } = await import("@/lib/invoices/display-name");
    const depositLine = scheduleLines.lines.find((l) => l.obligationKind === "deposit")
      ?? scheduleLines.lines[0];
    const invoiceResult = await deps.createInvoice({
      clientId: input.clientId,
      eventId: input.eventId ?? "",
      notes: commitmentNotes(selection.name),
      dueDate: dueDates.depositDueDate,
      displayName: defaultInvoiceDisplayName({
        obligationKind: depositLine?.obligationKind ?? "deposit",
        scheduleLabel: depositLine?.label,
        packageName: selection.name,
      }),
    });
    if (!invoiceResult.ok) {
      return { ok: false, message: invoiceResult.message ?? "Could not create the invoice." };
    }
    invoiceId = invoiceResult.invoiceId;

    const lineResult = await deps.addInvoiceLine(invoiceId, {
      type: "package",
      description: selection.name,
      quantity: "1",
      unitPrice: String(total),
      packageId: selection.sourcePackageId ?? "",
    });
    if (!lineResult.ok) {
      await deps.compensate(invoiceId, null);
      return { ok: false, message: lineResult.message ?? "Could not add the package line." };
    }

    const scheduleResult = await deps.createPaymentSchedule(
      {
        title: `${selection.name} payments`,
        invoiceId,
        notes: "",
      },
      "custom",
    );
    if (!scheduleResult.ok) {
      await deps.compensate(invoiceId, null);
      return { ok: false, message: scheduleResult.message ?? "Could not create the payment schedule." };
    }
    scheduleId = scheduleResult.scheduleId;

    for (const line of scheduleLines.lines) {
      if (!(line.amount > 0)) continue;
      const added = await deps.addLineItem(scheduleId, {
        label: line.label,
        amount: String(line.amount),
        dueDate: line.dueDate,
        obligationKind: line.obligationKind,
      });
      if (!added.ok) {
        await deps.compensate(invoiceId, scheduleId);
        return { ok: false, message: added.message ?? "Could not add a payment line." };
      }
    }

    const linked = await deps.linkSelection(selection.id, invoiceId);
    if (!linked.ok) {
      await deps.compensate(invoiceId, scheduleId);
      return {
        ok: false,
        message: linked.message ?? "Could not link the invoice to this selected package.",
      };
    }

    if (input.requestDeposit) {
      await deps.updateInvoiceStatus(invoiceId, "sent").catch(() => {
        /* create succeeded; status update is best-effort */
      });
    }

    return { ok: true, invoiceId, scheduleId };
  } catch (err) {
    if (invoiceId) await deps.compensate(invoiceId, scheduleId).catch(() => {});
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not set up payments.",
    };
  }
}

async function findRecoverableCommitment(
  selection: CommercialSelection,
  clientId: string,
): Promise<RecoverableCommitment | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const notes = commitmentNotes(selection.name);

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, notes, status")
    .eq("venue_id", venue.id)
    .eq("client_id", clientId)
    .neq("status", "void")
    .order("created_at", { ascending: false })
    .limit(20);

  const candidates = ((invoices ?? []) as { id: string; notes: string | null; status: string }[])
    .filter((inv) => (inv.notes ?? "") === notes);
  if (candidates.length === 0) return null;

  for (const inv of candidates) {
    const { data: linkedSel } = await supabase
      .from("commercial_selections")
      .select("id")
      .eq("venue_id", venue.id)
      .eq("invoice_id", inv.id)
      .limit(1)
      .maybeSingle();
    if (linkedSel) continue;

    const { data: schedule } = await supabase
      .from("payment_schedules")
      .select("id")
      .eq("venue_id", venue.id)
      .eq("invoice_id", inv.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (!schedule) continue;

    return { invoiceId: inv.id, scheduleId: schedule.id };
  }
  return null;
}

async function compensateSetupWrites(invoiceId: string, scheduleId: string | null): Promise<void> {
  if (scheduleId) {
    await deletePaymentSchedule(scheduleId).catch(() => {
      /* Owner/Manager only — orphan remains recoverable via findRecoverable */
    });
  }
  const role = await getCurrentUserRole();
  if (role === "owner" || role === "manager") {
    await updateInvoiceStatus(invoiceId, "void").catch(() => {});
  }
}

async function resolveTodayForVenue(): Promise<string> {
  if (!isSupabaseConfigured) return new Date().toISOString().slice(0, 10);
  const venue = await getCurrentVenue();
  if (!venue) return new Date().toISOString().slice(0, 10);
  const supabase = await createClient();
  const tz = await getVenueTimezone(supabase, venue.id);
  return venueToday(tz);
}

async function resolveEventDate(eventId?: string | null): Promise<string | null> {
  if (!eventId || !isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("event_date")
    .eq("id", eventId)
    .eq("venue_id", venue.id)
    .maybeSingle<{ event_date: string | null }>();
  return data?.event_date ?? null;
}

/**
 * Guided Booking Journey payment setup:
 * one commitment invoice from Selected Package + linked payment schedule.
 */
export async function setupPaymentsFromSelection(
  input: SetupPaymentsInput,
): Promise<SetupPaymentsResult> {
  const today = await resolveTodayForVenue();
  const eventDate = input.eventDate ?? (await resolveEventDate(input.eventId));

  return runSetupPaymentsFromSelection(
    { ...input, eventDate },
    {
      getSelection: getSelectedPackage,
      findRecoverable: findRecoverableCommitment,
      linkSelection: async (selectionId, invoiceId) => {
        const result = await linkSelectionInvoice(selectionId, invoiceId);
        if (!result.ok) {
          return { ok: false, message: result.message ?? "Could not link the invoice." };
        }
        return { ok: true };
      },
      createInvoice,
      addInvoiceLine,
      createPaymentSchedule,
      addLineItem,
      updateInvoiceStatus,
      compensate: compensateSetupWrites,
      today,
    },
  );
}
