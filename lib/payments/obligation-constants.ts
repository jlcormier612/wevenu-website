/**
 * Pure constants/types for payment obligations — split out of
 * final-payment-obligation.ts so a client-reachable module (e.g.
 * lib/portal/unified-tasks.ts, imported by components/portal/portal-shell.tsx)
 * can use FINAL_PAYMENT_OBLIGATION_TRIGGER without pulling in that file's
 * server-only DB functions, which transitively import
 * integrations/supabase/server.ts (next/headers) via lib/playbooks/repository.ts.
 * Next.js's "next/headers only in Server Components" check is file-level,
 * not per-export, so any import from the same file poisons the whole chain.
 */
import type { PaymentObligationKind } from "@/lib/payments/types";

/** Narrow playbook trigger for couple Final Payment (not payment_received). */
export const FINAL_PAYMENT_OBLIGATION_TRIGGER = "final_payment_obligation_paid" as const;

/** One-shot Luv type — distinct from paid-in-full `final_payment_received`. */
export const FINAL_PAYMENT_OBLIGATION_CELEBRATION =
  "final_payment_obligation_paid" as const;

export const PAYMENT_OBLIGATION_KINDS: PaymentObligationKind[] = [
  "deposit",
  "installment",
  "final",
  "other",
];

export function isPaymentObligationKind(v: string | null | undefined): v is PaymentObligationKind {
  return v === "deposit" || v === "installment" || v === "final" || v === "other";
}
