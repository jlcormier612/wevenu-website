/**
 * Authoritative contract-document balance remaining.
 *
 * Balance remaining = contracted amount − actual qualifying payments received.
 * A configured deposit / initial-payment allocation is a payment-plan obligation,
 * not money received, and must never reduce this balance by itself.
 */
import { roundMoney } from "@/lib/commercial-selections/constants";

export type ContractBalanceInput = {
  /** Agreed contract total after valid contract-level pricing, discounts, taxes. */
  contractedTotal: number;
  /**
   * Net retained collections from qualifying payment transactions / paid
   * schedule lines. Planned installments and configured deposits are not
   * payments received.
   */
  paymentsReceived: number;
};

/**
 * Amount still owed on the contract document.
 * Floors at 0; rounds to cents.
 */
export function contractDocumentBalanceRemaining(input: ContractBalanceInput): number {
  const contracted = Number(input.contractedTotal);
  const received = Number(input.paymentsReceived);
  if (!Number.isFinite(contracted) || contracted < 0) return 0;
  if (!Number.isFinite(received) || received <= 0) {
    return roundMoney(contracted);
  }
  return roundMoney(Math.max(0, contracted - received));
}
