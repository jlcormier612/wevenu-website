/**
 * Maps Hello to Cheers invoice_line_items into QuickBooks Invoice Line + tax
 * fields for the one-way Accounting sync.
 *
 * Rules (launch scope — no QBO tax codes / multicurrency / chart mapping):
 * - Revenue-like types → SalesItemLineDetail under the venue's placeholder Item.
 * - `discount` → DiscountLineDetail (must not be posted as SalesItem revenue).
 * - `tax` → summed into TxnTaxDetail.TotalTax (not a SalesItem income line).
 * - Never set TaxCodeRef / automated sales-tax calculation on lines (avoids
 *   QuickBooks adding a second tax on top of HTC-calculated tax).
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

const SALES_ITEM_TYPES = new Set([
  "package",
  "addon",
  "inventory",
  "fee",
  "item",
  "deposit",
  // Legacy / unknown rows without a type still represent charge amounts.
  "",
]);

export type QuickBooksInvoiceLinePayload = {
  Line: QuickBooksInvoiceLine[];
  /** Present only when HTC tax lines contribute a positive total. */
  TxnTaxDetail?: { TotalTax: number };
  /** Sum of HTC `tax` line amounts (0 when none). */
  totalTax: number;
  /** Sum of HTC `discount` line amounts (0 when none). */
  totalDiscount: number;
};

export function buildQuickBooksInvoiceLinePayload(
  lines: HtcInvoiceLineItem[],
  itemId: string,
): QuickBooksInvoiceLinePayload {
  const Line: QuickBooksInvoiceLine[] = [];
  let totalTax = 0;
  let totalDiscount = 0;

  for (const line of lines) {
    const type = (line.type ?? "").trim().toLowerCase();
    const amount = Number(line.amount) || 0;
    const description = line.description?.trim() || undefined;

    if (type === "tax") {
      totalTax += amount;
      continue;
    }

    if (type === "discount") {
      const discountAmount = Math.abs(amount);
      if (discountAmount <= 0) continue;
      totalDiscount += discountAmount;
      Line.push({
        Amount: discountAmount,
        DetailType: "DiscountLineDetail",
        Description: description,
        DiscountLineDetail: { PercentBased: false },
      });
      continue;
    }

    if (!SALES_ITEM_TYPES.has(type) && type !== "") {
      // Unknown types: still sync as sales lines so totals are not silently dropped.
    }

    Line.push({
      Amount: amount,
      DetailType: "SalesItemLineDetail",
      Description: description,
      SalesItemLineDetail: {
        ItemRef: { value: itemId },
        Qty: Number(line.quantity) || 0,
        UnitPrice: Number(line.unit_price) || 0,
      },
    });
  }

  const payload: QuickBooksInvoiceLinePayload = {
    Line,
    totalTax,
    totalDiscount,
  };

  if (totalTax > 0) {
    payload.TxnTaxDetail = { TotalTax: Number(totalTax.toFixed(2)) };
  }

  return payload;
}
