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
import { createPaymentSchedule, addLineItem, deletePaymentSchedule } from "@/lib/payments/service";
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
  const deposit = roundMoney(
    input.depositAmount != null ? input.depositAmount : selection.depositAmount,
  );
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

  let invoiceId: string | null = null;
  let scheduleId: string | null = null;

  try {
    const invoiceResult = await deps.createInvoice({
      clientId: input.clientId,
      eventId: input.eventId ?? "",
      notes: commitmentNotes(selection.name),
      dueDate: dueDates.depositDueDate,
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

    const depositLine = await deps.addLineItem(scheduleId, {
      label: "Deposit",
      amount: String(deposit),
      dueDate: dueDates.depositDueDate,
      obligationKind: "deposit",
    });
    if (!depositLine.ok) {
      await deps.compensate(invoiceId, scheduleId);
      return { ok: false, message: depositLine.message ?? "Could not add the deposit." };
    }

    if (remaining > 0 && dueDates.remainingDueDate) {
      const remainingLine = await deps.addLineItem(scheduleId, {
        label: "Remaining balance",
        amount: String(remaining),
        dueDate: dueDates.remainingDueDate,
        obligationKind: "final",
      });
      if (!remainingLine.ok) {
        await deps.compensate(invoiceId, scheduleId);
        return { ok: false, message: remainingLine.message ?? "Could not add the remaining balance." };
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
 * one commitment invoice from Selected Package + deposit/remaining schedule.
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
