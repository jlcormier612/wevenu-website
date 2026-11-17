/**
 * Loads one invoice's existing financial movements for staff display.
 * Read-only: no insert, update, delete, charge, or notification.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { sortInvoiceActivity, type InvoiceActivity } from "@/lib/invoices/activity-history";
import type { MovementKind } from "@/lib/migration/financial-activity";

type MovementRow = {
  id: string;
  kind: MovementKind;
  amount: number;
  effect: InvoiceActivity["effect"];
  occurred_on: string | null;
  method: string | null;
  reference_number: string | null;
  notes: string | null;
  source_id: string | null;
  related_movement_id: string | null;
  counter_invoice_id: string | null;
  line_item_id: string | null;
  created_at: string;
};

export async function listInvoiceActivity(invoiceId: string): Promise<InvoiceActivity[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_movements")
    .select("id, kind, amount, effect, occurred_on, method, reference_number, notes, source_id, related_movement_id, counter_invoice_id, line_item_id, created_at")
    .eq("invoice_id", invoiceId);
  if (error || !data) return [];
  const rows = data as MovementRow[];
  const counterIds = [...new Set(rows.map((row) => row.counter_invoice_id).filter((id): id is string => !!id))];
  const lineIds = [...new Set(rows.map((row) => row.line_item_id).filter((id): id is string => !!id))];
  const relatedIds = [...new Set(rows.map((row) => row.related_movement_id).filter((id): id is string => !!id))];
  const invoiceNumbers = new Map<string, string>();
  const lineLabels = new Map<string, string>();
  const relatedReferences = new Map<string, string>();
  if (counterIds.length > 0) {
    const { data: invoices } = await supabase.from("invoices").select("id, invoice_number").in("id", counterIds);
    for (const invoice of (invoices ?? []) as { id: string; invoice_number: string }[]) {
      invoiceNumbers.set(invoice.id, invoice.invoice_number);
    }
  }
  if (lineIds.length > 0) {
    const { data: lines } = await supabase.from("payment_line_items").select("id, label").in("id", lineIds);
    for (const line of (lines ?? []) as { id: string; label: string }[]) {
      lineLabels.set(line.id, line.label);
    }
  }
  if (relatedIds.length > 0) {
    const { data: related } = await supabase.from("financial_movements").select("id, reference_number").in("id", relatedIds);
    for (const movement of (related ?? []) as { id: string; reference_number: string | null }[]) {
      if (movement.reference_number) relatedReferences.set(movement.id, movement.reference_number);
    }
  }
  return sortInvoiceActivity(rows.map((row) => ({
    id: row.id,
    occurredOn: row.occurred_on,
    kind: row.kind,
    amount: Number(row.amount),
    effect: row.effect,
    method: row.method,
    reference: row.reference_number,
    notes: row.notes,
    sourceId: row.source_id,
    relatedReference: row.related_movement_id ? relatedReferences.get(row.related_movement_id) ?? null : null,
    counterInvoiceNumber: row.counter_invoice_id ? invoiceNumbers.get(row.counter_invoice_id) ?? null : null,
    installmentLabel: row.line_item_id ? lineLabels.get(row.line_item_id) ?? null : null,
    createdAt: row.created_at,
  })));
}
