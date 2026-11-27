/**
 * Maps Hello to Cheers invoice_line_items into QuickBooks Invoice Line fields.
 *
 * US QuickBooks Online accounting model (Intuit Global Tax Model):
 * - Taxable sales lines use SalesItemLineDetail.TaxCodeRef = "TAX".
 * - Non-taxable sales lines use TaxCodeRef = "NON".
 * - Do not post HTC `tax` rows as SalesItem income (misclassifies revenue).
 * - Do not invent TxnTaxDetail.TotalTax without tax codes — sync sets
 *   TxnTaxDetail.TxnTaxCodeRef from company TaxPrefs.TaxGroupCodeRef and QBO
 *   calculates tax from TAX/NON + that group when TaxExcluded is used.
 * - HTC `discount` rows use DiscountLineDetail (not SalesItem revenue).
 * - GlobalTaxCalculation: TaxExcluded when taxable; NotApplicable when not.
 *
 * If QuickBooks rejects the payload (discounts disabled, tax setup missing,
 * etc.), sync must fail clearly — never fall back to an inaccurate record.
 */
export type HtcInvoiceLineItem = {
  type: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

export type QuickBooksInvoiceLine =
  | {
      Amount: number;
      DetailType: "SalesItemLineDetail";
      Description?: string;
      SalesItemLineDetail: {
        ItemRef: { value: string };
        Qty: number;
        UnitPrice: number;
        TaxCodeRef: { value: "TAX" | "NON" };
      };
    }
  | {
      Amount: number;
      DetailType: "DiscountLineDetail";
      Description?: string;
      DiscountLineDetail: {
        PercentBased: false;
      };
    };

export type QuickBooksInvoiceLinePayload = {
  Line: QuickBooksInvoiceLine[];
  /** US model: TaxExcluded when HTC has tax lines; NotApplicable otherwise. */
  GlobalTaxCalculation: "TaxExcluded" | "NotApplicable";
  /** Sum of HTC `tax` line amounts (informational; not posted as SalesItem). */
  htcTaxAmount: number;
  /** Sum of HTC `discount` line amounts. */
  htcDiscountAmount: number;
  /** True when HTC included one or more tax lines. */
  taxable: boolean;
  /** Expected HTC invoice total: sales − discounts + tax. */
  expectedTotal: number;
};

const SALES_ITEM_TYPES = new Set([
  "package",
  "addon",
  "inventory",
  "fee",
  "item",
  "deposit",
  "",
]);

export function buildQuickBooksInvoiceLinePayload(
  lines: HtcInvoiceLineItem[],
  itemId: string,
): QuickBooksInvoiceLinePayload {
  const Line: QuickBooksInvoiceLine[] = [];
  let htcTaxAmount = 0;
  let htcDiscountAmount = 0;
  let salesSum = 0;

  for (const line of lines) {
    const type = (line.type ?? "").trim().toLowerCase();
    const amount = Number(line.amount) || 0;
    const description = line.description?.trim() || undefined;

    if (type === "tax") {
      htcTaxAmount += amount;
      continue;
    }

    if (type === "discount") {
      const discountAmount = Math.abs(amount);
      if (discountAmount <= 0) continue;
      htcDiscountAmount += discountAmount;
      Line.push({
        Amount: discountAmount,
        DetailType: "DiscountLineDetail",
        Description: description,
        DiscountLineDetail: { PercentBased: false },
      });
      continue;
    }

    if (!SALES_ITEM_TYPES.has(type) && type !== "") {
      // Unknown types still sync as sales lines so charge amounts are not dropped.
    }

    salesSum += amount;
    Line.push({
      Amount: amount,
      DetailType: "SalesItemLineDetail",
      Description: description,
      SalesItemLineDetail: {
        ItemRef: { value: itemId },
        Qty: Number(line.quantity) || 0,
        UnitPrice: Number(line.unit_price) || 0,
        // Placeholder — finalized after we know whether the invoice is taxable.
        TaxCodeRef: { value: "NON" },
      },
    });
  }

  const taxable = htcTaxAmount > 0;
  const taxCode = taxable ? "TAX" : "NON";
  for (const row of Line) {
    if (row.DetailType === "SalesItemLineDetail") {
      row.SalesItemLineDetail.TaxCodeRef = { value: taxCode };
    }
  }

  return {
    Line,
    GlobalTaxCalculation: taxable ? "TaxExcluded" : "NotApplicable",
    htcTaxAmount: Number(htcTaxAmount.toFixed(2)),
    htcDiscountAmount: Number(htcDiscountAmount.toFixed(2)),
    taxable,
    expectedTotal: Number((salesSum - htcDiscountAmount + htcTaxAmount).toFixed(2)),
  };
}
